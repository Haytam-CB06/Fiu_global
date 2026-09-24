using FiuGlobal.DotNet.Models;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace FiuGlobal.DotNet.Services;

public sealed class AppDataStore
{
    // These sections are available to every user account unless an
    // administrator explicitly saves a per-user access configuration.
    private static readonly string[] DefaultPortalSections = ["platforms", "announcements", "dining-menu"];

    private readonly object _gate = new();
    private readonly Dictionary<string, SessionInfo> _sessions = new(StringComparer.Ordinal);
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly DatabaseStateStorage _database;
    private readonly LocalizationService _localization;
    private AppState _state = new();

    public bool IsDatabaseAvailable => _database.IsConfigured;
    public string? DatabaseError => _database.InitializationError;

    public AppDataStore(IWebHostEnvironment environment, LocalizationService localization)
    {
        _localization = localization;
        _database = new DatabaseStateStorage(_jsonOptions);
        if (!_database.IsConfigured)
        {
            // Keep the host alive when the database is starting or temporarily
            // offline. Requests are gated by Program.cs until reconnection.
            _state = new AppState();
            return;
        }
        try
        {
            InitializeFromDatabase();
        }
        catch (Exception ex)
        {
            // The database can disappear between schema validation and the
            // initial state read. Keep the process alive and let the request
            // middleware present a retryable maintenance response.
            _database.MarkUnavailable(ex);
            _state = new AppState();
            _sessions.Clear();
        }
    }

    public bool TryReconnect()
    {
        lock (_gate)
        {
            if (_database.IsConfigured)
            {
                return true;
            }

            try
            {
                if (!_database.TryInitialize())
                {
                    return false;
                }

                InitializeFromDatabase();
                return true;
            }
            catch (Exception ex)
            {
                _database.MarkUnavailable(ex);
                _state = new AppState();
                _sessions.Clear();
                return false;
            }
        }
    }

    public UserAccount? ValidateUser(string usernameOrEmail, string password)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(user =>
                (user.Username.Equals(usernameOrEmail, StringComparison.OrdinalIgnoreCase) ||
                 user.Email.Equals(usernameOrEmail, StringComparison.OrdinalIgnoreCase)));
            if (user is null) return null;

            var verification = PasswordSecurity.Verify(password, user.Password);
            if (!verification.Success) return null;
            if (verification.NeedsUpgrade)
            {
                user.Password = PasswordSecurity.Hash(password);
                Save();
            }

            return Clone(user);
        }
    }

    public AdminAccount? ValidateAdmin(string username, string password)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item =>
                item.Username.Equals(username, StringComparison.OrdinalIgnoreCase) &&
                item.IsActive);

            if (admin is null)
            {
                return null;
            }

            var verification = PasswordSecurity.Verify(password, admin.Password);
            if (!verification.Success) return null;
            if (verification.NeedsUpgrade) admin.Password = PasswordSecurity.Hash(password);

            admin.LastLogin = DateTime.UtcNow;
            AddActivityInternal(admin.Id, admin.Username, admin.Role, "admin_login", "Admin signed in");
            Save();
            return Clone(admin);
        }
    }

    public AdminAccount? GetAdminById(int id)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id && item.IsActive);
            return admin is null ? null : Clone(admin);
        }
    }

    public UserAccount? GetUserById(int id)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            return user is null ? null : Clone(user);
        }
    }

    public (UserAccount? User, AdminAccount? Admin) FindAccountByEmail(string email)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Email.Equals(email, StringComparison.OrdinalIgnoreCase) && item.IsActive);
            var user = _state.Users.FirstOrDefault(item => item.Email.Equals(email, StringComparison.OrdinalIgnoreCase));
            return (user is null ? null : Clone(user), admin is null ? null : Clone(admin));
        }
    }

    public SessionInfo CreateUserSession(UserAccount user, AdminAccount? admin = null)
    {
        lock (_gate)
        {
            var now = DateTime.UtcNow;
            var session = new SessionInfo
            {
                Token = Guid.NewGuid().ToString("N"),
                UserId = user.Id,
                AdminId = admin?.Id,
                Username = user.Username,
                UserRole = user.Role,
                AdminRole = admin?.Role,
                PreferredLanguage = LocalizationService.NormalizeLanguage(user.PreferredLanguage),
                LastSeenAt = now,
                ExpiresAt = now.Add(SessionPolicy.Lifetime)
            };
            _sessions[session.Token] = session;
            AddActivityInternal(user.Id, user.Username, user.Role, "user_login", admin is null ? "User signed in" : "User/admin signed in");
            Save();
            TrySaveSession(session);
            return Clone(session);
        }
    }

    public SessionInfo CreateAdminSession(AdminAccount admin)
    {
        lock (_gate)
        {
            var now = DateTime.UtcNow;
            var session = new SessionInfo
            {
                Token = Guid.NewGuid().ToString("N"),
                AdminId = admin.Id,
                Username = admin.Username,
                UserRole = "guest",
                AdminRole = admin.Role,
                PreferredLanguage = LocalizationService.NormalizeLanguage(admin.PreferredLanguage),
                LastSeenAt = now,
                ExpiresAt = now.Add(SessionPolicy.Lifetime)
            };
            _sessions[session.Token] = session;
            AddActivityInternal(admin.Id, admin.Username, admin.Role, "admin_login", "Admin signed in");
            Save();
            TrySaveSession(session);
            return Clone(session);
        }
    }

    public SessionInfo? GetSession(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        lock (_gate)
        {
            if (!_sessions.TryGetValue(token, out var session))
            {
                return null;
            }

            if (session.ExpiresAt <= DateTime.UtcNow)
            {
                _sessions.Remove(token);
                return null;
            }

            var now = DateTime.UtcNow;
            // Sessions created before the 15-minute policy was introduced may
            // still carry the old eight-hour expiry. Bring them onto the same
            // policy the next time they are observed.
            if (session.ExpiresAt > now.Add(SessionPolicy.Lifetime))
            {
                session.ExpiresAt = now.Add(SessionPolicy.Lifetime);
            }

            session.LastSeenAt = now;
            TrySaveSession(session);
            return Clone(session);
        }
    }

    public SessionInfo? ContinueSession(string? token, TimeSpan lifetime)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        lock (_gate)
        {
            if (!_sessions.TryGetValue(token, out var session) || session.ExpiresAt <= DateTime.UtcNow)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            session.LastSeenAt = now;
            session.ExpiresAt = now.Add(lifetime);
            TrySaveSession(session);
            return Clone(session);
        }
    }

    public void RemoveSession(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        lock (_gate)
        {
            _sessions.Remove(token);
            try
            {
                _database.DeleteSession(token);
            }
            catch (Exception ex)
            {
                _database.MarkUnavailable(ex);
            }
        }
    }

    /// <summary>
    /// Persists the choice for account-owned background communications while
    /// retaining the existing session/token behavior.
    /// </summary>
    public void UpdatePreferredLanguage(SessionInfo session, string language)
    {
        lock (_gate)
        {
            var normalizedLanguage = LocalizationService.NormalizeLanguage(language);
            var changed = false;

            if (session.UserId is int userId)
            {
                var user = _state.Users.FirstOrDefault(item => item.Id == userId);
                if (user is not null && !string.Equals(user.PreferredLanguage, normalizedLanguage, StringComparison.OrdinalIgnoreCase))
                {
                    user.PreferredLanguage = normalizedLanguage;
                    changed = true;
                }
            }

            if (session.AdminId is int adminId)
            {
                var admin = _state.Admins.FirstOrDefault(item => item.Id == adminId);
                if (admin is not null && !string.Equals(admin.PreferredLanguage, normalizedLanguage, StringComparison.OrdinalIgnoreCase))
                {
                    admin.PreferredLanguage = normalizedLanguage;
                    changed = true;
                }
            }

            if (_sessions.TryGetValue(session.Token, out var storedSession))
            {
                storedSession.PreferredLanguage = normalizedLanguage;
                TrySaveSession(storedSession);
            }

            if (changed)
            {
                Save();
            }
        }
    }

    private void TrySaveSession(SessionInfo session)
    {
        try
        {
            _database.SaveSession(session);
        }
        catch (Exception ex)
        {
            _database.MarkUnavailable(ex);
        }
    }

    public bool AdminExists(int id)
    {
        lock (_gate)
        {
            return _state.Admins.Any(admin => admin.Id == id && admin.IsActive);
        }
    }

    public bool IsSuperAdmin(int id)
    {
        lock (_gate)
        {
            return _state.Admins.Any(admin => admin.Id == id && admin.IsActive && admin.Role == "admin");
        }
    }

    public object GetDashboardStats()
    {
        lock (_gate)
        {
            var errors = GetServerErrorsInternal();
            var byAction = _state.ActivityLogs
                .GroupBy(item => item.Action)
                .Select(group => new { action = group.Key, count = group.Count() })
                .OrderByDescending(item => item.count)
                .ToList();
            var byRole = _state.ActivityLogs
                .Where(item => !string.IsNullOrWhiteSpace(item.Role))
                .GroupBy(item => item.Role)
                .Select(group => new { role = group.Key, count = group.Count() })
                .OrderByDescending(item => item.count)
                .ToList();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var dailyActivity = Enumerable.Range(0, 7)
                .Select(offset => today.AddDays(offset - 6))
                .Select(date => new
                {
                    date,
                    count = _state.ActivityLogs.Count(item => DateOnly.FromDateTime(item.CreatedAt) == date)
                })
                .ToList();
            var accountsByRole = _state.Users
                .GroupBy(user => string.IsNullOrWhiteSpace(user.Role) ? "other" : user.Role.Trim().ToLowerInvariant())
                .Select(group => new { role = group.Key, count = group.Count() })
                .OrderByDescending(item => item.count)
                .ToList();
            var platformAccessEvents = _state.ActivityLogs
                .Where(item => item.Action.Equals("platform_open", StringComparison.OrdinalIgnoreCase))
                .Select(item => new
                {
                    platform = string.IsNullOrWhiteSpace(item.Detail) ? "Unknown platform" : item.Detail.Trim(),
                    role = string.IsNullOrWhiteSpace(item.Role) ? "other" : item.Role.Trim().ToLowerInvariant()
                })
                .ToList();
            var topPlatformAccess = platformAccessEvents
                .GroupBy(item => item.platform, StringComparer.OrdinalIgnoreCase)
                .Select(group => new
                {
                    platform = group.Key,
                    instructor = group.Count(item => item.role.Equals("instructor", StringComparison.OrdinalIgnoreCase)),
                    student = group.Count(item => item.role.Equals("student", StringComparison.OrdinalIgnoreCase)),
                    other = group.Count(item => !item.role.Equals("instructor", StringComparison.OrdinalIgnoreCase) && !item.role.Equals("student", StringComparison.OrdinalIgnoreCase)),
                    total = group.Count()
                })
                .OrderByDescending(item => item.total)
                .ThenBy(item => item.platform)
                .Take(10)
                .ToList();
            if (_state.Admins.Count > 0)
            {
                accountsByRole.Add(new { role = "admin", count = _state.Admins.Count });
            }
            return new
            {
                total_users = _state.Users.Count,
                active_admins = _state.Admins.Count(admin => admin.IsActive),
                total_platforms = _state.Platforms.Count,
                accounts_by_role = accountsByRole,
                recent_logins = _state.Admins
                    .Where(admin => admin.LastLogin is not null)
                    .OrderByDescending(admin => admin.LastLogin)
                    .Take(5)
                    .Select(admin => new { username = admin.Username, last_login = admin.LastLogin })
                    .ToList(),
                system_health = new
                {
                    database = "healthy",
                    tables = "healthy",
                    errors = errors,
                    error_count = errors.Count,
                    last_checked = DateTime.UtcNow,
                    server = errors.Count == 0 ? "healthy" : "error"
                },
                activity = new
                {
                    total_events = _state.ActivityLogs.Count,
                    last_24h = _state.ActivityLogs.Count(item => item.CreatedAt >= DateTime.UtcNow.AddDays(-1)),
                    daily = dailyActivity,
                    by_action = byAction,
                    by_role = byRole,
                    recent = _state.ActivityLogs
                        .OrderByDescending(item => item.CreatedAt)
                        .Take(20)
                        .Select(item => new { item.Id, item.Username, item.Role, item.Action, item.Detail, created_at = item.CreatedAt })
                        .ToList()
                },
                platform_usage = new
                {
                    total_accesses = platformAccessEvents.Count,
                    by_platform = topPlatformAccess
                }
            };
        }
    }

    public List<object> GetUsersForAdmin()
    {
        lock (_gate)
        {
            return _state.Users
                .OrderByDescending(user => user.CreatedAt)
                .Select(user =>
                {
                    var admin = _state.Admins.FirstOrDefault(item => item.Username.Equals(user.Username, StringComparison.OrdinalIgnoreCase));
                    return (object)new
                    {
                        id = user.Id,
                        username = user.Username,
                        email = user.Email,
                        role = user.Role,
                        student_number = IsStudentRole(user.Role) ? user.StudentNumber : string.Empty,
                        first_name = user.FirstName,
                        last_name = user.LastName,
                        profile_picture = user.ProfilePicture,
                        faculty_id = user.FacultyId,
                        department_id = user.DepartmentId,
                        faculty = user.Faculty,
                        department = user.Department,
                        allowed_sections = GetEffectiveSectionsForUser(user),
                        section_permissions = GetEffectivePermissionsForUser(user),
                        platform_access = _state.UserPlatformAccess.Where(access => access.UserId == user.Id).Select(access => new { platform = access.Platform, is_active = access.IsActive }).ToList(),
                        created_at = user.CreatedAt,
                        admin_id = admin?.Id,
                        admin_role = admin?.Role
                    };
                })
                .ToList();
        }
    }

    public List<object> GetManageableAdmins()
    {
        lock (_gate)
        {
            var onlineSince = DateTime.UtcNow.AddMinutes(-5);
            return _state.Admins
                .Where(admin => admin.Role == "admin")
                .OrderByDescending(admin => admin.CreatedAt)
                .Select(admin => (object)new
                {
                    id = admin.Id,
                    username = admin.Username,
                    email = admin.Email,
                    role = admin.Role,
                    is_active = admin.IsActive,
                    student_number = string.Empty,
                    first_name = admin.FirstName,
                    last_name = admin.LastName,
                    profile_picture = admin.ProfilePicture,
                    faculty_id = admin.FacultyId,
                    department_id = admin.DepartmentId,
                    faculty = admin.Faculty,
                    department = admin.Department,
                    created_at = admin.CreatedAt,
                    last_login = admin.LastLogin,
                    is_online = _sessions.Values.Any(session => session.AdminId == admin.Id && session.ExpiresAt > DateTime.UtcNow && session.LastSeenAt >= onlineSince)
                })
                .ToList();
        }
    }

    public AdminAccount? GetAdminByUsername(string username)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase) && item.IsActive);
            return admin is null ? null : Clone(admin);
        }
    }

    public bool CreateAdmin(string username, string email, string password)
    {
        lock (_gate)
        {
            if (_state.Admins.Any(admin => admin.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            _state.Admins.Add(new AdminAccount
            {
                Id = _state.Counters.NextAdminId++,
                Username = username,
                Email = email,
                Password = PasswordSecurity.Hash(password),
                Role = "admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            Save();
            return true;
        }
    }

    public bool UpdateAdmin(int id, string username, string email)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null)
            {
                return false;
            }

            admin.Username = username;
            admin.Email = email;
            admin.IsActive = true;
            Save();
            return true;
        }
    }

    public bool ChangeAdminPassword(int id, string newPassword)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null || string.IsNullOrWhiteSpace(newPassword))
            {
                return false;
            }

            admin.Password = PasswordSecurity.Hash(newPassword);
            Save();
            return true;
        }
    }

    public bool ChangeAdminPasswordWithCurrent(int id, string currentPassword, string newPassword, out string error)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null) { error = "Admin account not found"; return false; }
            if (!PasswordMatches(currentPassword, admin.Password)) { error = "Current password is incorrect"; return false; }
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8) { error = "New password must be at least 8 characters"; return false; }
            admin.Password = PasswordSecurity.Hash(newPassword);
            Save();
            error = string.Empty;
            return true;
        }
    }

    public object? GetAdminProfile(int id)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            return admin is null ? null : ToAdminProfileDto(admin);
        }
    }

    public OperationResult UpdateAdminProfile(int id, Dictionary<string, object?> body)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null) return new OperationResult(false, "Administrator account not found.");
            if (!TryResolveAffiliation(body, out var facultyId, out var departmentId, out var facultyName, out var departmentName, out var affiliationError))
            {
                return new OperationResult(false, affiliationError);
            }
            admin.FirstName = body.GetString("first_name").Trim();
            admin.LastName = body.GetString("last_name").Trim();
            if (body.ContainsKey("profile_picture")) admin.ProfilePicture = body.GetString("profile_picture").Trim();
            admin.FacultyId = facultyId;
            admin.DepartmentId = departmentId;
            admin.Faculty = facultyName;
            admin.Department = departmentName;
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult CreateUser(string username, string email, string password, string role, int? facultyId = null, int? departmentId = null)
    {
        _ = GetFacultyDepartments();
        lock (_gate)
        {
            username = username.Trim();
            email = email.Trim();
            role = NormalizeUserRole(role);

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                return new OperationResult(false, "Username, email, and password are required");
            }

            if (AccountNameExists(username) || AccountEmailExists(email))
            {
                return new OperationResult(false, "Username or email already exists");
            }

            string facultyName = string.Empty;
            string departmentName = string.Empty;
            if (facultyId.HasValue || departmentId.HasValue)
            {
                var affiliationBody = new Dictionary<string, object?>
                {
                    ["faculty_id"] = facultyId.GetValueOrDefault(),
                    ["department_id"] = departmentId.GetValueOrDefault()
                };
                if (!TryResolveAffiliation(affiliationBody, out facultyId, out departmentId, out facultyName, out departmentName, out var affiliationError))
                {
                    return new OperationResult(false, affiliationError);
                }
            }

            var userId = _state.Counters.NextUserId++;
            _state.Users.Add(new UserAccount
            {
                Id = userId,
                Username = username,
                Email = email,
                Password = PasswordSecurity.Hash(password),
                Role = role,
                StudentNumber = IsStudentRole(role) ? FormatStudentNumber(userId) : string.Empty,
                FacultyId = facultyId,
                DepartmentId = departmentId,
                Faculty = facultyName,
                Department = departmentName,
                AllowedSections = [],
                // Inherit the role's current defaults until an administrator
                // explicitly configures this user's access.
                SectionAccessConfigured = false,
                SectionPermissions = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase),
                CreatedAt = DateTime.UtcNow
            });
            AddActivityInternal(null, username, role, "user_create", "User account created");
            Save();
            return new OperationResult(true);
        }
    }

    /// <summary>
    /// Returns the roles that can be assigned to portal user accounts. The list
    /// combines configured role policies with existing account roles, so a role
    /// remains available while it has accounts even if its policy is repaired.
    /// </summary>
    public List<string> GetAvailableUserRoles()
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            return _state.RoleSectionAccess.Keys
                .Concat(_state.Users.Select(user => user.Role))
                .Append("student")
                .Append("instructor")
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Select(NormalizeRoleKey)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(role => role, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }

    /// <summary>
    /// Imports valid rows and skips rows with conflicts or invalid data.
    /// Passwords are hashed before storage and are never included in activity
    /// logs or returned to callers.
    /// </summary>
    public UserImportResult ImportUsers(IEnumerable<UserImportRow>? sourceRows)
    {
        _ = GetFacultyDepartments();
        lock (_gate)
        {
            var rows = sourceRows?.ToList() ?? [];
            if (rows.Count == 0)
            {
                return new UserImportResult(false, 0, ["The workbook does not contain any user rows."]);
            }
            if (rows.Count > 500)
            {
                return new UserImportResult(false, 0, ["A single import can contain up to 500 users."]);
            }

            var availableRoles = new HashSet<string>(GetAvailableUserRoles(), StringComparer.OrdinalIgnoreCase);
            var usernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var normalizedRows = new List<(int RowNumber, string Username, string Email, string Role, string Password, int? FacultyId, int? DepartmentId, string Faculty, string Department)>();
            var errors = new List<string>();
            var skippedRows = new HashSet<int>();

            for (var index = 0; index < rows.Count; index++)
            {
                var rowNumber = rows[index].RowNumber > 0 ? rows[index].RowNumber : index + 2;
                var username = rows[index].Username.Trim();
                var email = rows[index].Email.Trim();
                var role = NormalizeUserRole(rows[index].Role);
                var password = rows[index].Password;

                if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                {
                    errors.Add($"Row {rowNumber}: Username, Email, Role, and Password are required.");
                    skippedRows.Add(rowNumber);
                    continue;
                }
                if (!availableRoles.Contains(role))
                {
                    errors.Add($"Row {rowNumber}: choose a role from the workbook dropdown.");
                    skippedRows.Add(rowNumber);
                    continue;
                }
                var hasIdentityConflict = false;
                if (!usernames.Add(username))
                {
                    errors.Add($"Row {rowNumber}: username '{username}' is duplicated in this workbook.");
                    hasIdentityConflict = true;
                }
                if (!emails.Add(email))
                {
                    errors.Add($"Row {rowNumber}: email '{email}' is duplicated in this workbook.");
                    hasIdentityConflict = true;
                }
                if (AccountNameExists(username))
                {
                    errors.Add($"Row {rowNumber}: username '{username}' already belongs to an account. Use a unique username.");
                    hasIdentityConflict = true;
                }
                if (AccountEmailExists(email))
                {
                    errors.Add($"Row {rowNumber}: email '{email}' already belongs to an account. Use a unique email address.");
                    hasIdentityConflict = true;
                }
                if (hasIdentityConflict)
                {
                    skippedRows.Add(rowNumber);
                    continue;
                }

                var facultyName = rows[index].Faculty.Trim();
                var departmentName = rows[index].Department.Trim();
                FacultyItem? faculty = null;
                DepartmentItem? department = null;
                if (!string.IsNullOrWhiteSpace(departmentName) && string.IsNullOrWhiteSpace(facultyName))
                {
                    errors.Add($"Row {rowNumber}: choose a faculty when a department is provided.");
                    skippedRows.Add(rowNumber);
                    continue;
                }
                if (!string.IsNullOrWhiteSpace(facultyName))
                {
                    faculty = _state.Faculties.FirstOrDefault(item =>
                        item.IsActive && item.Name.Equals(facultyName, StringComparison.OrdinalIgnoreCase));
                    if (faculty is null)
                    {
                        errors.Add($"Row {rowNumber}: faculty '{facultyName}' was not found in the active faculty directory.");
                        skippedRows.Add(rowNumber);
                        continue;
                    }
                }
                if (!string.IsNullOrWhiteSpace(departmentName) && faculty is not null)
                {
                    department = _state.Departments.FirstOrDefault(item =>
                        item.IsActive && item.FacultyId == faculty.Id && item.Name.Equals(departmentName, StringComparison.OrdinalIgnoreCase));
                    if (department is null)
                    {
                        errors.Add($"Row {rowNumber}: department '{departmentName}' was not found under faculty '{faculty.Name}'.");
                        skippedRows.Add(rowNumber);
                        continue;
                    }
                }

                normalizedRows.Add((rowNumber, username, email, role, password, faculty?.Id, department?.Id, faculty?.Name ?? string.Empty, department?.Name ?? string.Empty));
            }

            if (normalizedRows.Count == 0)
            {
                return new UserImportResult(false, 0, errors, skippedRows.Count);
            }

            foreach (var row in normalizedRows)
            {
                var userId = _state.Counters.NextUserId++;
                _state.Users.Add(new UserAccount
                {
                    Id = userId,
                    Username = row.Username,
                    Email = row.Email,
                    Password = PasswordSecurity.Hash(row.Password),
                    Role = row.Role,
                    StudentNumber = IsStudentRole(row.Role) ? FormatStudentNumber(userId) : string.Empty,
                    FacultyId = row.FacultyId,
                    DepartmentId = row.DepartmentId,
                    Faculty = row.Faculty,
                    Department = row.Department,
                    AllowedSections = [],
                    SectionAccessConfigured = false,
                    SectionPermissions = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase),
                    CreatedAt = DateTime.UtcNow
                });
            }

            AddActivityInternal(null, "system", "admin", "user_import", $"{normalizedRows.Count} user accounts imported");
            Save();
            return new UserImportResult(true, normalizedRows.Count, errors, skippedRows.Count);
        }
    }

    public UserAccount? CreateGoogleStudentAccount(string email)
    {
        lock (_gate)
        {
            email = email.Trim();
            if (string.IsNullOrWhiteSpace(email) || AccountEmailExists(email))
            {
                return null;
            }

            var username = GenerateUniqueGoogleUsername(email);
            var user = new UserAccount
            {
                Id = _state.Counters.NextUserId++,
                Username = username,
                Email = email,
                Password = $"google-oauth:{Guid.NewGuid():N}",
                Role = "student",
                AllowedSections = [],
                // New Google accounts inherit the student role defaults. This
                // keeps the account on the normal student dashboard with
                // platforms, announcements, and dining menu available.
                SectionAccessConfigured = false,
                SectionPermissions = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase),
                CreatedAt = DateTime.UtcNow
            };
            user.StudentNumber = FormatStudentNumber(user.Id);

            _state.Users.Add(user);
            AddActivityInternal(user.Id, user.Username, user.Role, "google_user_create", "Student account created from Google sign-in");
            Save();
            return Clone(user);
        }
    }

    public OperationResult UpdateUser(int id, string username, string email, string role, int? facultyId = null, int? departmentId = null)
    {
        _ = GetFacultyDepartments();
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null)
            {
                return new OperationResult(false, "User not found");
            }

            username = username.Trim();
            email = email.Trim();
            role = NormalizeUserRole(role);
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email))
            {
                return new OperationResult(false, "Username and email are required");
            }

            if (_state.Users.Any(item => item.Id != id && item.Username.Equals(username, StringComparison.OrdinalIgnoreCase)) ||
                _state.Admins.Any(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "Username already exists");
            }

            if (_state.Users.Any(item => item.Id != id && item.Email.Equals(email, StringComparison.OrdinalIgnoreCase)) ||
                _state.Admins.Any(item => item.Email.Equals(email, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "Email already exists");
            }

            if (facultyId.HasValue || departmentId.HasValue)
            {
                var requestedFacultyId = facultyId ?? user.FacultyId ?? 0;
                var requestedDepartmentId = departmentId ?? user.DepartmentId ?? 0;
                if (requestedFacultyId != user.FacultyId.GetValueOrDefault() || requestedDepartmentId != user.DepartmentId.GetValueOrDefault())
                {
                    var affiliationBody = new Dictionary<string, object?>
                    {
                        ["faculty_id"] = requestedFacultyId,
                        ["department_id"] = requestedDepartmentId
                    };
                    if (!TryResolveAffiliation(affiliationBody, out var resolvedFacultyId, out var resolvedDepartmentId, out var facultyName, out var departmentName, out var affiliationError))
                    {
                        return new OperationResult(false, affiliationError);
                    }
                    user.FacultyId = resolvedFacultyId;
                    user.DepartmentId = resolvedDepartmentId;
                    user.Faculty = facultyName;
                    user.Department = departmentName;
                }
            }
            user.Username = username;
            user.Email = email;
            user.Role = role;
            user.StudentNumber = IsStudentRole(role)
                ? (string.IsNullOrWhiteSpace(user.StudentNumber) ? FormatStudentNumber(user.Id) : user.StudentNumber)
                : string.Empty;
            AddActivityInternal(user.Id, user.Username, user.Role, "user_update", "User account updated");
            Save();
            return new OperationResult(true);
        }
    }

    public bool ChangeUserPassword(int id, string newPassword)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null || string.IsNullOrWhiteSpace(newPassword))
            {
                return false;
            }

            user.Password = PasswordSecurity.Hash(newPassword);
            AddActivityInternal(user.Id, user.Username, user.Role, "user_password_change", "User password changed");
            Save();
            return true;
        }
    }

    public bool ChangeUserPasswordWithCurrent(int id, string currentPassword, string newPassword, out string error)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) { error = "User account not found"; return false; }
            if (!PasswordMatches(currentPassword, user.Password)) { error = "Current password is incorrect"; return false; }
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8) { error = "New password must be at least 8 characters"; return false; }
            user.Password = PasswordSecurity.Hash(newPassword);
            AddActivityInternal(user.Id, user.Username, user.Role, "user_password_change", "User password changed");
            Save();
            error = string.Empty;
            return true;
        }
    }

    public object? GetUserProfile(int id)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            return user is null ? null : ToUserProfileDto(user);
        }
    }

    public OperationResult UpdateUserProfile(int id, Dictionary<string, object?> body)
    {
        _ = GetFacultyDepartments();
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return new OperationResult(false, "User account not found.");
            var email = body.GetString("email").Trim();
            if (!IsFinalEduEmail(email))
            {
                return new OperationResult(false, "Use a valid @final.edu.tr email address.");
            }
            if (_state.Users.Any(item => item.Id != id && item.Email.Equals(email, StringComparison.OrdinalIgnoreCase)) ||
                _state.Admins.Any(item => item.Email.Equals(email, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "Email already exists.");
            }
            var facultyId = user.FacultyId;
            var departmentId = user.DepartmentId;
            var facultyName = user.Faculty;
            var departmentName = user.Department;
            if (user.Role.Equals("instructor", StringComparison.OrdinalIgnoreCase))
            {
                if (!TryResolveAffiliation(body, out facultyId, out departmentId, out facultyName, out departmentName, out var affiliationError))
                {
                    return new OperationResult(false, affiliationError);
                }
            }
            if (IsStudentRole(user.Role))
            {
                user.StudentNumber = body.GetString("student_number").Trim();
                if (string.IsNullOrWhiteSpace(user.StudentNumber)) user.StudentNumber = FormatStudentNumber(user.Id);
            }
            user.FirstName = body.GetString("first_name").Trim();
            user.LastName = body.GetString("last_name").Trim();
            user.Email = email;
            if (body.ContainsKey("profile_picture")) user.ProfilePicture = body.GetString("profile_picture").Trim();
            user.FacultyId = facultyId;
            user.DepartmentId = departmentId;
            user.Faculty = facultyName;
            user.Department = departmentName;
            Save();
            return new OperationResult(true);
        }
    }

    public bool UpdateUserProfilePicture(int id, string pictureUrl)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return false;
            user.ProfilePicture = pictureUrl.Trim();
            Save();
            return true;
        }
    }

    public bool UpdateAdminProfilePicture(int id, string pictureUrl)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null) return false;
            admin.ProfilePicture = pictureUrl.Trim();
            Save();
            return true;
        }
    }

    public List<object> GetFacultyDepartments(bool includeInactive = false)
    {
        lock (_gate)
        {
            // The relational directory is also edited directly in the
            // deployment database. Refresh it on reads so those changes do
            // not require an application restart to appear in profiles.
            _database.MergeFacultyDirectory(_state);

            var departments = _state.Departments ?? [];
            return (_state.Faculties ?? [])
                .Where(faculty => includeInactive || faculty.IsActive)
                .OrderBy(faculty => faculty.Name)
                .Select(faculty => (object)new
                {
                    id = faculty.Id,
                    name = faculty.Name,
                    is_active = faculty.IsActive,
                    departments = departments
                        .Where(department => department.FacultyId == faculty.Id && (includeInactive || department.IsActive))
                        .OrderBy(department => department.Name)
                        .Select(department => new
                        {
                            id = department.Id,
                            name = department.Name,
                            is_active = department.IsActive,
                            faculty_id = department.FacultyId
                        })
                        .ToList()
                })
                .ToList();
        }
    }

    public OperationResult CreateFaculty(string name)
    {
        lock (_gate)
        {
            name = name.Trim();
            if (string.IsNullOrWhiteSpace(name)) return new OperationResult(false, "Faculty name is required.");
            if (_state.Faculties.Any(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "A faculty with that name already exists.");
            }

            var now = DateTime.UtcNow;
            _state.Faculties.Add(new FacultyItem
            {
                Id = _state.Counters.NextFacultyId++,
                Name = name,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult UpdateFaculty(int id, string name, bool isActive)
    {
        lock (_gate)
        {
            var faculty = _state.Faculties.FirstOrDefault(item => item.Id == id);
            if (faculty is null) return new OperationResult(false, "Faculty not found.");
            name = name.Trim();
            if (string.IsNullOrWhiteSpace(name)) return new OperationResult(false, "Faculty name is required.");
            if (_state.Faculties.Any(item => item.Id != id && item.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "A faculty with that name already exists.");
            }

            faculty.Name = name;
            faculty.IsActive = isActive;
            faculty.UpdatedAt = DateTime.UtcNow;
            foreach (var account in _state.Users.Where(user => user.FacultyId == id)) account.Faculty = name;
            foreach (var account in _state.Admins.Where(admin => admin.FacultyId == id)) account.Faculty = name;
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult DeleteFaculty(int id)
    {
        lock (_gate)
        {
            var faculty = _state.Faculties.FirstOrDefault(item => item.Id == id);
            if (faculty is null) return new OperationResult(false, "Faculty not found.");
            if (_state.Departments.Any(item => item.FacultyId == id) ||
                _state.Users.Any(item => item.FacultyId == id) ||
                _state.Admins.Any(item => item.FacultyId == id))
            {
                return new OperationResult(false, "This faculty is assigned to a department or account. Make it inactive instead.");
            }

            _state.Faculties.Remove(faculty);
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult CreateDepartment(int facultyId, string name)
    {
        lock (_gate)
        {
            var faculty = _state.Faculties.FirstOrDefault(item => item.Id == facultyId);
            if (faculty is null) return new OperationResult(false, "Choose a valid faculty.");
            name = name.Trim();
            if (string.IsNullOrWhiteSpace(name)) return new OperationResult(false, "Department name is required.");
            if (_state.Departments.Any(item => item.FacultyId == facultyId && item.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "This department already exists for the selected faculty.");
            }

            var now = DateTime.UtcNow;
            _state.Departments.Add(new DepartmentItem
            {
                Id = _state.Counters.NextDepartmentId++,
                FacultyId = facultyId,
                Name = name,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult UpdateDepartment(int id, int facultyId, string name, bool isActive)
    {
        lock (_gate)
        {
            var department = _state.Departments.FirstOrDefault(item => item.Id == id);
            if (department is null) return new OperationResult(false, "Department not found.");
            if (!_state.Faculties.Any(item => item.Id == facultyId)) return new OperationResult(false, "Choose a valid faculty.");
            name = name.Trim();
            if (string.IsNullOrWhiteSpace(name)) return new OperationResult(false, "Department name is required.");
            if (_state.Departments.Any(item => item.Id != id && item.FacultyId == facultyId && item.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
            {
                return new OperationResult(false, "This department already exists for the selected faculty.");
            }

            department.FacultyId = facultyId;
            department.Name = name;
            department.IsActive = isActive;
            department.UpdatedAt = DateTime.UtcNow;
            foreach (var account in _state.Users.Where(user => user.DepartmentId == id))
            {
                account.Department = name;
                account.FacultyId = facultyId;
                account.Faculty = _state.Faculties.First(item => item.Id == facultyId).Name;
            }
            foreach (var account in _state.Admins.Where(admin => admin.DepartmentId == id))
            {
                account.Department = name;
                account.FacultyId = facultyId;
                account.Faculty = _state.Faculties.First(item => item.Id == facultyId).Name;
            }
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult DeleteDepartment(int id)
    {
        lock (_gate)
        {
            var department = _state.Departments.FirstOrDefault(item => item.Id == id);
            if (department is null) return new OperationResult(false, "Department not found.");
            if (_state.Users.Any(item => item.DepartmentId == id) || _state.Admins.Any(item => item.DepartmentId == id))
            {
                return new OperationResult(false, "This department is assigned to an account. Make it inactive instead.");
            }

            _state.Departments.Remove(department);
            Save();
            return new OperationResult(true);
        }
    }

    public List<object> GetUserRoleAccess()
    {
        lock (_gate)
        {
            return _state.Users.OrderBy(user => user.Role).ThenBy(user => user.Username).Select(user => (object)new
            {
                id = user.Id,
                username = user.Username,
                email = user.Email,
                role = user.Role,
                student_number = IsStudentRole(user.Role) ? user.StudentNumber : string.Empty,
                first_name = user.FirstName,
                last_name = user.LastName,
                allowed_sections = GetEffectiveSectionsForUser(user),
                section_permissions = GetEffectivePermissionsForUser(user),
                platform_access = _state.UserPlatformAccess.Where(item => item.UserId == user.Id).Select(item => new { platform = item.Platform, is_active = item.IsActive }).ToList()
            }).ToList();
        }
    }

    public bool UpdateUserRoleAccess(int id, string role, IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions = null)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return false;
            ApplyUserRoleAccess(user, role, sections, platforms, sectionPermissions);
            Save();
            return true;
        }
    }

    public int UpdateRoleAccessForUsers(string role, IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions = null)
    {
        lock (_gate)
        {
            var normalizedRole = NormalizeUserRole(role);
            var users = _state.Users
                .Where(item => item.Role.Equals(normalizedRole, StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var user in users)
            {
                ApplyUserRoleAccess(user, normalizedRole, sections, platforms, sectionPermissions);
            }
            if (users.Count > 0) Save();
            return users.Count;
        }
    }

    /// <summary>
    /// Replace the shared dashboard policy for every known role. Individual
    /// user overrides are deliberately preserved; administrators can use the
    /// all-users action when they want to replace those as well.
    /// </summary>
    public int UpdateRoleAccessForAllRoles(IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions = null)
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            var roles = _state.RoleSectionAccess.Keys
                .Concat(_state.Users.Select(user => user.Role))
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Select(NormalizeRoleKey)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var normalizedSections = NormalizeSectionList(sections);
            var normalizedParts = BuildRoleSectionPermissions(normalizedSections, platforms, sectionPermissions);
            foreach (var role in roles)
            {
                _state.RoleSectionAccess[role] = normalizedSections.ToList();
                _state.RoleSectionParts[role] = CopySectionPermissions(normalizedParts);
            }

            Save();
            return roles.Count;
        }
    }

    /// <summary>
    /// Apply one common access policy to every user while preserving each
    /// account's existing role assignment.
    /// </summary>
    public int UpdateRoleAccessForAllUsers(IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions = null)
    {
        lock (_gate)
        {
            var users = _state.Users.ToList();
            foreach (var user in users)
            {
                ApplyUserRoleAccess(user, user.Role, sections, platforms, sectionPermissions);
            }

            if (users.Count > 0) Save();
            return users.Count;
        }
    }

    private Dictionary<string, List<string>> BuildRoleSectionPermissions(IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions)
    {
        var normalizedSections = NormalizeSectionList(sections);
        var result = NormalizeSectionPermissions(sectionPermissions);
        if (platforms is not null)
        {
            result["platforms"] = platforms
                .Where(item => item.Value && !string.IsNullOrWhiteSpace(item.Key))
                .Select(item => item.Key.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        return result
            .Where(item => normalizedSections.Contains(item.Key, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);
    }

    private void ApplyUserRoleAccess(UserAccount user, string role, IEnumerable<string>? sections, IDictionary<string, bool>? platforms, IDictionary<string, List<string>>? sectionPermissions)
    {
        user.Role = string.IsNullOrWhiteSpace(role) ? user.Role : NormalizeUserRole(role);
        user.StudentNumber = IsStudentRole(user.Role)
            ? (string.IsNullOrWhiteSpace(user.StudentNumber) ? FormatStudentNumber(user.Id) : user.StudentNumber)
            : string.Empty;
        user.AllowedSections = NormalizeSectionList(sections);
        user.SectionAccessConfigured = true;
        user.SectionPermissions = NormalizeSectionPermissions(sectionPermissions)
            .Where(item => user.AllowedSections.Contains(item.Key, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);
        if (platforms is not null)
        {
            _state.UserPlatformAccess.RemoveAll(item => item.UserId == user.Id);
            foreach (var pair in platforms.Where(item => !string.IsNullOrWhiteSpace(item.Key)))
            {
                _state.UserPlatformAccess.Add(new UserPlatformAccess
                {
                    Id = _state.UserPlatformAccess.Count == 0 ? 1 : _state.UserPlatformAccess.Max(item => item.Id) + 1,
                    UserId = user.Id,
                    StudentNumber = user.StudentNumber,
                    Platform = pair.Key.Trim(),
                    IsActive = pair.Value,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }
    }

    public (int Imported, List<string> Errors) ImportUserPlatformAccess(IEnumerable<(string StudentNumber, string Platform, bool IsActive)> rows)
    {
        lock (_gate)
        {
            var imported = 0;
            var errors = new List<string>();
            foreach (var row in rows)
            {
                var studentNumber = row.StudentNumber.Trim();
                var platform = row.Platform.Trim();
                var user = _state.Users.FirstOrDefault(item => item.StudentNumber.Equals(studentNumber, StringComparison.OrdinalIgnoreCase));
                if (user is null) { errors.Add($"Student number '{studentNumber}' was not found"); continue; }
                if (!_state.Platforms.Any(item => item.Name.Equals(platform, StringComparison.OrdinalIgnoreCase))) { errors.Add($"Platform '{platform}' was not found"); continue; }
                var access = _state.UserPlatformAccess.FirstOrDefault(item => item.UserId == user.Id && item.Platform.Equals(platform, StringComparison.OrdinalIgnoreCase));
                if (access is null)
                {
                    _state.UserPlatformAccess.Add(new UserPlatformAccess { Id = _state.UserPlatformAccess.Count == 0 ? 1 : _state.UserPlatformAccess.Max(item => item.Id) + 1, UserId = user.Id, StudentNumber = studentNumber, Platform = platform, IsActive = row.IsActive, UpdatedAt = DateTime.UtcNow });
                }
                else { access.IsActive = row.IsActive; access.UpdatedAt = DateTime.UtcNow; }
                imported++;
            }
            Save();
            return (imported, errors);
        }
    }

    public bool DeleteUser(int id)
    {
        return DeleteUsers([id]) == 1;
    }

    public int DeleteUsers(IEnumerable<int>? ids, string? role = null)
    {
        var requestedIds = (ids ?? [])
            .Where(id => id > 0)
            .Distinct()
            .ToHashSet();
        if (requestedIds.Count == 0) return 0;

        lock (_gate)
        {
            var users = _state.Users.Where(item => requestedIds.Contains(item.Id)).ToList();
            if (users.Count != requestedIds.Count) return 0;
            var normalizedRole = string.IsNullOrWhiteSpace(role) ? null : NormalizeUserRole(role);
            if (normalizedRole is not null && users.Any(user => !user.Role.Equals(normalizedRole, StringComparison.OrdinalIgnoreCase))) return 0;

            var deletedUserIds = users.Select(user => user.Id).ToHashSet();
            foreach (var user in users)
            {
                _state.Users.Remove(user);
                AddActivityInternal(user.Id, user.Username, user.Role, "user_delete", "User account deleted");
            }
            _state.UserPlatformAccess.RemoveAll(item => deletedUserIds.Contains(item.UserId));

            var sessions = _sessions.Values.Where(session => session.UserId.HasValue && deletedUserIds.Contains(session.UserId.Value)).ToList();
            foreach (var session in sessions)
            {
                _sessions.Remove(session.Token);
                try
                {
                    _database.DeleteSession(session.Token);
                }
                catch (Exception ex)
                {
                    _database.MarkUnavailable(ex);
                }
            }

            Save();
            return users.Count;
        }
    }

    public bool DeleteAdmin(int id)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == id);
            if (admin is null)
            {
                return false;
            }

            _state.Admins.Remove(admin);
            Save();
            return true;
        }
    }

    public bool PromoteUserToAdmin(string username)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
            if (user is null)
            {
                return false;
            }

            var admin = _state.Admins.FirstOrDefault(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
            if (admin is null)
            {
                _state.Admins.Add(new AdminAccount
                {
                    Id = _state.Counters.NextAdminId++,
                    Username = user.Username,
                    Email = user.Email,
                    // A promotion keeps the user's credential rather than
                    // creating an exposed shared/default administrator password.
                    Password = user.Password,
                    Role = "admin",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                admin.Role = "admin";
                admin.IsActive = true;
            }

            Save();
            return true;
        }
    }

    private bool AccountNameExists(string username) =>
        _state.Users.Any(user => user.Username.Equals(username, StringComparison.OrdinalIgnoreCase)) ||
        _state.Admins.Any(admin => admin.Username.Equals(username, StringComparison.OrdinalIgnoreCase));

    private bool AccountEmailExists(string email) =>
        _state.Users.Any(user => user.Email.Equals(email, StringComparison.OrdinalIgnoreCase)) ||
        _state.Admins.Any(admin => admin.Email.Equals(email, StringComparison.OrdinalIgnoreCase));

    private string GenerateUniqueGoogleUsername(string email)
    {
        var localPart = email.Split('@', 2)[0].Trim().ToLowerInvariant();
        var baseUsername = new string(localPart.Select(ch => char.IsLetterOrDigit(ch) || ch is '.' or '_' or '-' ? ch : '-').ToArray()).Trim('.', '_', '-');
        if (string.IsNullOrWhiteSpace(baseUsername))
        {
            baseUsername = "google-user";
        }

        var username = baseUsername;
        var suffix = 2;
        while (AccountNameExists(username))
        {
            username = $"{baseUsername}{suffix++}";
        }

        return username;
    }

    public bool DemoteAdminToUser(string username)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase) && item.Role == "admin");
            if (admin is null)
            {
                return false;
            }

            _state.Admins.Remove(admin);
            Save();
            return true;
        }
    }

    // Admin platform management intentionally sees every platform; role-based
    // lookups must always have a role and honor each platform's visibility list.
    public List<PlatformLink> GetPlatforms() => GetPlatformsInternal(null, includeAll: true);

    public List<PlatformLink> GetPlatforms(string? role) => GetPlatformsInternal(role, includeAll: false);

    private List<PlatformLink> GetPlatformsInternal(string? role, bool includeAll)
    {
        lock (_gate)
        {
            return _state.Platforms
                .Where(platform => includeAll || IsPlatformVisibleToRole(platform, role))
                .OrderBy(platform => platform.Section)
                .ThenBy(platform => platform.Name)
                .Select(Clone)
                .ToList();
        }
    }

    public List<PlatformLink> GetPlatformsForUser(int id)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return [];
            if (!GetEffectiveSectionsForUser(user).Contains("platforms", StringComparer.OrdinalIgnoreCase)) return [];
            var configured = _state.UserPlatformAccess.Where(item => item.UserId == id).ToList();
            var allowedNames = configured.Where(item => item.IsActive).Select(item => item.Platform).ToHashSet(StringComparer.OrdinalIgnoreCase);
            // Platform role visibility is the global ceiling: explicit user
            // overrides and role-level platform permissions may narrow access,
            // but must never expose a platform to an unchecked role.
            var all = _state.Platforms
                .Where(platform => IsPlatformVisibleToRole(platform, user.Role))
                .OrderBy(platform => platform.Section)
                .ThenBy(platform => platform.Name)
                .Select(Clone)
                .ToList();

            if (configured.Count > 0)
            {
                return all.Where(item => allowedNames.Contains(item.Name)).ToList();
            }

            // Unconfigured users inherit role defaults. Configured users use
            // the platform names explicitly selected in their own access.
            var userPermissions = GetEffectivePermissionsForUser(user);
            if (!userPermissions.TryGetValue("platforms", out var platformParts) || platformParts.Count == 0)
            {
                return [];
            }

            var platformNames = platformParts.ToHashSet(StringComparer.OrdinalIgnoreCase);
            return all.Where(item => platformNames.Contains(item.Name)).ToList();
        }
    }

    public bool CreatePlatform(string section, string name, string url, string description, string? notificationsUrl, List<string>? visibleToRoles, string? imageUrl = null)
    {
        lock (_gate)
        {
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(url) ||
                !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return false;
            }

            // Initialize existing role allowlists before adding the platform so
            // an unconfigured legacy role does not accidentally inherit every
            // newly created platform.
            EnsureDefaultRoleAccess();
            var platform = new PlatformLink
            {
                Id = _state.Platforms.Count == 0 ? 1 : _state.Platforms.Max(item => item.Id) + 1,
                Section = string.IsNullOrWhiteSpace(section) ? "Campus" : section.Trim(),
                Name = name.Trim(),
                Description = description.Trim(),
                Url = url.Trim(),
                NotificationsUrl = string.IsNullOrWhiteSpace(notificationsUrl) ? null : notificationsUrl.Trim(),
                ImageUrl = NormalizePlatformImageUrl(imageUrl),
                VisibleToRoles = NormalizePlatformRoles(visibleToRoles),
                CreatedAt = DateTime.UtcNow
            };
            _state.Platforms.Add(platform);
            GrantPlatformToAssignedRoles(platform);
            AddNotificationsForRolesInternal(
                "New platform",
                $"{platform.Name} is now available in {platform.Section}.",
                platform.Url,
                platform.VisibleToRoles);
            AddActivityInternal(null, "system", "system", "platform_create", name.Trim());
            Save();
            return true;
        }
    }

    public bool UpdatePlatform(int id, string section, string name, string url, string description, string? notificationsUrl, List<string>? visibleToRoles, string? imageUrl = null)
    {
        lock (_gate)
        {
            var platform = _state.Platforms.FirstOrDefault(item => item.Id == id);
            if (platform is null || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(url) ||
                !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return false;
            }

            EnsureDefaultRoleAccess();
            platform.Section = string.IsNullOrWhiteSpace(section) ? "Campus" : section.Trim();
            platform.Name = name.Trim();
            platform.Description = description.Trim();
            platform.Url = url.Trim();
            platform.NotificationsUrl = string.IsNullOrWhiteSpace(notificationsUrl) ? null : notificationsUrl.Trim();
            platform.ImageUrl = NormalizePlatformImageUrl(imageUrl);
            platform.VisibleToRoles = NormalizePlatformRoles(visibleToRoles);
            GrantPlatformToAssignedRoles(platform);
            AddActivityInternal(null, "system", "system", "platform_update", platform.Name);
            Save();
            return true;
        }
    }

    private void GrantPlatformToAssignedRoles(PlatformLink platform)
    {
        var assignedRoles = platform.VisibleToRoles
            .Select(NormalizeRoleKey)
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (assignedRoles.Count == 0) return;

        foreach (var role in assignedRoles)
        {
            if (!_state.RoleSectionParts.TryGetValue(role, out var permissions) || permissions is null)
            {
                permissions = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
                _state.RoleSectionParts[role] = permissions;
            }

            if (!permissions.TryGetValue("platforms", out var rolePlatforms) || rolePlatforms is null)
            {
                rolePlatforms = [];
                permissions["platforms"] = rolePlatforms;
            }
            if (!rolePlatforms.Contains(platform.Name, StringComparer.OrdinalIgnoreCase))
            {
                rolePlatforms.Add(platform.Name);
            }
        }

        foreach (var user in _state.Users.Where(user => assignedRoles.Contains(NormalizeRoleKey(user.Role))))
        {
            if (user.SectionAccessConfigured && GetEffectiveSectionsForUser(user).Contains("platforms", StringComparer.OrdinalIgnoreCase))
            {
                user.SectionPermissions ??= new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
                if (!user.SectionPermissions.TryGetValue("platforms", out var userPlatforms) || userPlatforms is null)
                {
                    userPlatforms = [];
                    user.SectionPermissions["platforms"] = userPlatforms;
                }
                if (!userPlatforms.Contains(platform.Name, StringComparer.OrdinalIgnoreCase))
                {
                    userPlatforms.Add(platform.Name);
                }
            }

            // A saved per-user platform list is also an allowlist. Extend it
            // for newly role-assigned platforms so existing accounts inherit
            // the role assignment without losing their other choices.
            var existingAccess = _state.UserPlatformAccess.FirstOrDefault(access =>
                access.UserId == user.Id && access.Platform.Equals(platform.Name, StringComparison.OrdinalIgnoreCase));
            if (existingAccess is not null)
            {
                existingAccess.IsActive = true;
                existingAccess.UpdatedAt = DateTime.UtcNow;
            }
            else if (_state.UserPlatformAccess.Any(access => access.UserId == user.Id))
            {
                _state.UserPlatformAccess.Add(new UserPlatformAccess
                {
                    Id = _state.UserPlatformAccess.Count == 0 ? 1 : _state.UserPlatformAccess.Max(access => access.Id) + 1,
                    UserId = user.Id,
                    StudentNumber = IsStudentRole(user.Role) ? user.StudentNumber : string.Empty,
                    Platform = platform.Name,
                    IsActive = true,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }
    }

    public bool DeletePlatform(int id)
    {
        lock (_gate)
        {
            var platform = _state.Platforms.FirstOrDefault(item => item.Id == id);
            if (platform is null)
            {
                return false;
            }

            _state.Platforms.Remove(platform);
            AddActivityInternal(null, "system", "system", "platform_delete", platform.Name);
            Save();
            return true;
        }
    }

    public bool UpdatePlatformImage(int id, string imageUrl)
    {
        lock (_gate)
        {
            var platform = _state.Platforms.FirstOrDefault(item => item.Id == id);
            if (platform is null) return false;
            platform.ImageUrl = NormalizePlatformImageUrl(imageUrl);
            AddActivityInternal(null, "system", "system", "platform_image_update", platform.Name);
            Save();
            return true;
        }
    }

    public List<object> GetMostAccessedPlatformsForUser(int userId, int limit = 4)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == userId);
            if (user is null) return [];

            var visible = GetPlatformsForUser(userId).ToDictionary(platform => platform.Name, StringComparer.OrdinalIgnoreCase);
            return _state.ActivityLogs
                .Where(item => item.UserId == userId && item.Action.Equals("platform_open", StringComparison.OrdinalIgnoreCase))
                .GroupBy(item => item.Detail.Trim(), StringComparer.OrdinalIgnoreCase)
                .Where(group => visible.ContainsKey(group.Key))
                .OrderByDescending(group => group.Count())
                .ThenByDescending(group => group.Max(item => item.CreatedAt))
                .ThenBy(group => group.Key)
                .Take(Math.Clamp(limit, 1, 8))
                .Select(group =>
                {
                    var platform = visible[group.Key];
                    return (object)new
                    {
                        id = platform.Id,
                        name = platform.Name,
                        url = platform.Url,
                        image_url = platform.ImageUrl,
                        access_count = group.Count(),
                        last_accessed_at = group.Max(item => item.CreatedAt)
                    };
                })
                .ToList();
        }
    }

    public Dictionary<string, List<string>> GetRoleSectionAccess()
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            return _state.RoleSectionAccess.ToDictionary(pair => pair.Key, pair => pair.Value.ToList(), StringComparer.OrdinalIgnoreCase);
        }
    }

    public Dictionary<string, Dictionary<string, List<string>>> GetRoleSectionParts()
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            return _state.RoleSectionParts.ToDictionary(
                pair => pair.Key,
                pair => CopySectionPermissions(pair.Value),
                StringComparer.OrdinalIgnoreCase);
        }
    }

    public bool CreateRole(string role)
    {
        lock (_gate)
        {
            role = NormalizeRoleKey(role);
            if (string.IsNullOrWhiteSpace(role) || _state.RoleSectionAccess.ContainsKey(role)) return false;
            _state.RoleSectionAccess[role] = DefaultPortalSections.ToList();
            _state.RoleSectionParts[role] = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            Save();
            return true;
        }
    }

    public bool UpdateRoleSectionAccess(Dictionary<string, List<string>> access)
    {
        lock (_gate)
        {
            var allowed = new HashSet<string>(["platforms", "announcements", "dining-menu", "notifications"], StringComparer.OrdinalIgnoreCase);
            _state.RoleSectionAccess = access.ToDictionary(
                pair => pair.Key.Trim().ToLowerInvariant(),
                pair => pair.Value.Where(allowed.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                StringComparer.OrdinalIgnoreCase);
            EnsureDefaultRoleAccess();
            Save();
            return true;
        }
    }

    public bool UpdateRoleSectionParts(Dictionary<string, Dictionary<string, List<string>>> parts)
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            foreach (var role in parts)
            {
                var roleKey = NormalizeRoleKey(role.Key);
                if (string.IsNullOrWhiteSpace(roleKey)) continue;
                _state.RoleSectionParts[roleKey] = role.Value.ToDictionary(
                    item => item.Key.Trim().ToLowerInvariant(),
                    item => item.Key.Equals("dining-menu", StringComparison.OrdinalIgnoreCase)
                        ? NormalizeDiningPermissionParts(item.Value)
                        : item.Value.Select(value => value.Trim()).Where(value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    StringComparer.OrdinalIgnoreCase);
            }
            Save();
            return true;
        }
    }

    public List<string> GetAllowedSectionsForRole(string role)
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            return EffectiveSectionsForRole(role, _state.RoleSectionAccess.TryGetValue(role, out var sections) ? sections : []);
        }
    }

    public Dictionary<string, List<string>> GetSectionPermissionsForRole(string role)
    {
        lock (_gate)
        {
            EnsureDefaultRoleAccess();
            return EffectivePermissionsForRole(role, _state.RoleSectionParts.TryGetValue(role, out var permissions) ? permissions : null);
        }
    }

    public List<string> GetAllowedSectionsForUser(int id)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return [];
            return GetEffectiveSectionsForUser(user);
        }
    }

    public Dictionary<string, List<string>> GetSectionPermissionsForUser(int id)
    {
        lock (_gate)
        {
            var user = _state.Users.FirstOrDefault(item => item.Id == id);
            if (user is null) return new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            return GetEffectivePermissionsForUser(user);
        }
    }

    public SmtpSettings GetSmtpSettings()
    {
        lock (_gate)
        {
            return Clone(_state.Smtp);
        }
    }

    public bool UpdateSmtpSettings(SmtpSettings settings)
    {
        lock (_gate)
        {
            _state.Smtp = settings;
            Save();
            return true;
        }
    }

    /// <summary>
    /// Sends one controlled sample for each automated email category. This is
    /// intentionally admin-triggered and uses only SMTP_TEST_RECIPIENT from
    /// server-side environment configuration; the endpoint never accepts an
    /// arbitrary recipient address from the browser.
    /// </summary>
    public OperationResult SendSmtpNotificationTests()
    {
        lock (_gate)
        {
            var testRecipient = Environment.GetEnvironmentVariable("SMTP_TEST_RECIPIENT")?.Trim();
            if (string.IsNullOrWhiteSpace(testRecipient))
            {
                return new OperationResult(false, "SMTP_TEST_RECIPIENT is not configured");
            }

            if (!IsSmtpConfigured(_state.Smtp))
            {
                return new OperationResult(false, "SMTP is not configured");
            }

            var samples = new[]
            {
                ("[TEST] [HIGH PRIORITY] FIU Global announcement", "This is a test of the high-priority announcement email notification.", MailPriority.High),
                ("[TEST] Unread FIU Global chat message", "This is a test of the 24-hour unread chat-message reminder email notification.", MailPriority.Normal),
                ("[TEST] New FIU Global dining menu", "This is a test of the new dining-menu email notification.", MailPriority.Normal)
            };

            foreach (var sample in samples)
            {
                if (SendEmailInternal([testRecipient], sample.Item1, sample.Item2, sample.Item3) != 1)
                {
                    AddActivityInternal(null, "system", "admin", "smtp_test_notifications_failed", "SMTP test notification failed");
                    Save();
                    return new OperationResult(false, "Unable to send SMTP test notification");
                }
            }

            AddActivityInternal(null, "system", "admin", "smtp_test_notifications_sent", "Three SMTP test notifications sent");
            Save();
            return new OperationResult(true);
        }
    }

    public void TrackActivity(string username, string role, string action, string detail)
    {
        lock (_gate)
        {
            var userId = _state.Users.FirstOrDefault(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase))?.Id;
            AddActivityInternal(userId, username, role, action, detail);
            Save();
        }
    }

    public List<NotificationItem> GetNotifications(string username)
    {
        lock (_gate)
        {
            return _state.Notifications
                .Where(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase) && item.Status == "unread")
                .OrderByDescending(item => item.CreatedAt)
                .Select(Clone)
                .ToList();
        }
    }

    public List<LmsSubplatform> GetLmsSubplatforms()
    {
        lock (_gate)
        {
            return _state.LmsSubplatforms
                .OrderBy(item => GetLmsNumber(item.Url))
                .ThenBy(item => item.Name)
                .Select(Clone)
                .ToList();
        }
    }

    public List<object> GetAnnouncementsForAdmin()
    {
        lock (_gate)
        {
            return _state.Announcements
                .OrderByDescending(item => item.CreatedAt)
                .Select(item => (object)ToAnnouncementDto(item))
                .ToList();
        }
    }

    public List<object> GetActiveAnnouncements()
    {
        lock (_gate)
        {
            var archiveCutoff = DateTime.UtcNow.AddDays(-50);
            return _state.Announcements
                .Where(item => item.IsActive && item.CreatedAt >= archiveCutoff)
                .OrderByDescending(item => AnnouncementPriorityRank(item.Priority))
                .ThenByDescending(item => item.CreatedAt)
                .Select(item => (object)ToAnnouncementDto(item))
                .ToList();
        }
    }

    public object GetArchiveForRole(string role)
    {
        lock (_gate)
        {
            var archiveCutoff = DateTime.UtcNow.AddDays(-50);
            var today = DateOnly.FromDateTime(DateTime.Today);
            return new
            {
                announcements = _state.Announcements
                    .Where(item => item.CreatedAt < archiveCutoff && AnnouncementVisibleToRole(item, role))
                    .OrderByDescending(item => item.CreatedAt)
                    .Select(item => (object)ToAnnouncementDto(item))
                    .ToList(),
                dining_menus = _state.DiningMenus
                    .Where(item => item.Date < today)
                    .OrderByDescending(item => item.Date)
                    .Take(90)
                    .Select(item => (object)ToDiningMenuDto(item))
                    .ToList()
            };
        }
    }

    public bool CreateAnnouncement(string title, string content, int adminId, string priority, string targetAudience)
    {
        lock (_gate)
        {
            var admin = _state.Admins.FirstOrDefault(item => item.Id == adminId);
            if (admin is null || string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(content))
            {
                return false;
            }

            var now = DateTime.UtcNow;
            var announcement = new AnnouncementItem
            {
                Id = _state.Counters.NextAnnouncementId++,
                Title = title,
                Content = content,
                AuthorId = adminId,
                AuthorName = admin.Username,
                Priority = priority,
                TargetAudience = targetAudience,
                CreatedAt = now,
                UpdatedAt = now
            };
            _state.Announcements.Add(announcement);
            AddActivityInternal(adminId, admin.Username, admin.Role, "announcement_create", title);
            AddNotificationsForRolesInternal(
                "Announcement",
                $"New announcement: {announcement.Title}",
                "#announcements-section",
                NotificationRolesForAudience(targetAudience));
            if (AnnouncementPriorityRank(announcement.Priority) >= 3)
            {
                SendAnnouncementEmailInternal(announcement);
            }
            Save();
            return true;
        }
    }

    public bool UpdateAnnouncement(int id, string title, string content, string priority, bool isActive, string targetAudience)
    {
        lock (_gate)
        {
            var announcement = _state.Announcements.FirstOrDefault(item => item.Id == id);
            if (announcement is null)
            {
                return false;
            }

            announcement.Title = title;
            announcement.Content = content;
            announcement.Priority = priority;
            announcement.IsActive = isActive;
            announcement.TargetAudience = targetAudience;
            announcement.UpdatedAt = DateTime.UtcNow;
            Save();
            return true;
        }
    }

    public bool DeleteAnnouncement(int id)
    {
        lock (_gate)
        {
            var announcement = _state.Announcements.FirstOrDefault(item => item.Id == id);
            if (announcement is null)
            {
                return false;
            }

            _state.Announcements.Remove(announcement);
            Save();
            return true;
        }
    }

    public List<object> GetDiningMenus()
    {
        lock (_gate)
        {
            return _state.DiningMenus
                .OrderBy(item => item.Date)
                .Select(item => (object)ToDiningMenuDto(item))
                .ToList();
        }
    }

    public List<DiningMenuItem> GetDiningMenusByMonth(int year, int month)
    {
        lock (_gate)
        {
            return _state.DiningMenus
                .Where(item => item.Date.Year == year && item.Date.Month == month)
                .OrderBy(item => item.Date)
                .Select(item => item)
                .ToList();
        }
    }

    public List<object> GetDiningMenuDtosByMonth(int year, int month)
    {
        lock (_gate)
        {
            return _state.DiningMenus
                .Where(item => item.Date.Year == year && item.Date.Month == month)
                .OrderBy(item => item.Date)
                .Select(item => (object)ToDiningMenuDto(item))
                .ToList();
        }
    }

    public List<object> GetUsersForChat(int excludeUserId)
    {
        lock (_gate)
        {
            return _state.Users
                .Where(user => user.Id != excludeUserId && IsChatRole(user.Role))
                .OrderBy(user => user.FirstName)
                .ThenBy(user => user.LastName)
                .ThenBy(user => user.Username)
                .Select(user =>
                {
                    var history = _database.LoadChatMessages(excludeUserId, user.Id);
                    var latest = history.LastOrDefault();
                    var unread = history.Count(message => message.RecipientId == excludeUserId && !message.SeenAt.HasValue);
                    return (object)new
                    {
                        id = user.Id,
                        username = user.Username,
                        name = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim() is { Length: > 0 } displayName
                            ? displayName
                            : user.Username,
                        role = user.Role,
                        profile_picture = user.ProfilePicture,
                        last_message = latest?.Text ?? string.Empty,
                        last_message_at = latest?.SentAt,
                        last_message_sender_id = latest?.SenderId,
                        unread_count = unread
                    };
                })
                .ToList();
        }
    }

    public bool CanChatWith(int userId, int otherUserId)
    {
        lock (_gate)
        {
            return CanChatWithInternal(userId, otherUserId);
        }
    }

    public List<object> GetChatHistory(int userId, int otherUserId)
    {
        lock (_gate)
        {
            if (!CanChatWithInternal(userId, otherUserId))
            {
                return [];
            }

            return _database.LoadChatMessages(userId, otherUserId)
                .Select(ToChatMessageDto)
                .ToList();
        }
    }

    public object? AddChatMessage(int senderId, int recipientId, string text)
    {
        lock (_gate)
        {
            if (!CanChatWithInternal(senderId, recipientId) || string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            var normalizedText = text.Trim();
            var message = new ChatMessageItem
            {
                Id = Guid.NewGuid().ToString("N"),
                SenderId = senderId,
                RecipientId = recipientId,
                Text = normalizedText[..Math.Min(normalizedText.Length, 2000)],
                SentAt = DateTimeOffset.UtcNow
            };
            _database.SaveChatMessage(message);
            return ToChatMessageDto(message);
        }
    }

    public ChatMessageStatusUpdate? UpdateChatMessageStatus(int recipientId, string messageId, bool seen)
    {
        lock (_gate)
        {
            return _database.UpdateChatMessageStatus(messageId, recipientId, seen);
        }
    }

    public async Task<int> SendPendingChatReplyRemindersAsync(CancellationToken cancellationToken)
    {
        List<(ChatReplyReminderCandidate Candidate, UserAccount Recipient, UserAccount Sender, SmtpSettings Smtp)> reminders;
        lock (_gate)
        {
            if (string.IsNullOrWhiteSpace(_state.Smtp.Host) || string.IsNullOrWhiteSpace(_state.Smtp.FromEmail))
            {
                return 0;
            }

            reminders = _database.GetUnansweredChatReminderCandidates(DateTimeOffset.UtcNow.AddHours(-24))
                .Select(candidate =>
                {
                    var recipient = _state.Users.FirstOrDefault(item => item.Id == candidate.RecipientId);
                    var sender = _state.Users.FirstOrDefault(item => item.Id == candidate.SenderId);
                    return (candidate, recipient, sender);
                })
                .Where(item => item.recipient is not null && item.sender is not null && !string.IsNullOrWhiteSpace(item.recipient.Email))
                .Select(item => (item.candidate, item.recipient!, item.sender!, Clone(_state.Smtp)))
                .ToList();
        }

        var sent = 0;
        foreach (var reminder in reminders)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var client = new SmtpClient(reminder.Smtp.Host, reminder.Smtp.Port)
                {
                    EnableSsl = reminder.Smtp.EnableSsl
                };
                if (!string.IsNullOrWhiteSpace(reminder.Smtp.Username))
                {
                    client.Credentials = new NetworkCredential(reminder.Smtp.Username, reminder.Smtp.Password);
                }

                var recipientName = DisplayName(reminder.Recipient);
                var senderName = DisplayName(reminder.Sender);
                var emailTemplate = _localization.GetChatReplyReminder(
                    reminder.Recipient.PreferredLanguage,
                    recipientName,
                    senderName);
                using var message = new MailMessage
                {
                    From = new MailAddress(reminder.Smtp.FromEmail, reminder.Smtp.FromName),
                    Subject = emailTemplate.Subject,
                    Body = emailTemplate.Body
                };
                message.To.Add(reminder.Recipient.Email);
                await client.SendMailAsync(message, cancellationToken);

                if (_database.MarkChatReminderSent(reminder.Candidate.MessageId, DateTimeOffset.UtcNow))
                {
                    sent++;
                    lock (_gate)
                    {
                        AddActivityInternal(reminder.Recipient.Id, reminder.Recipient.Username, reminder.Recipient.Role, "chat_reply_reminder_sent", "Email notification sent");
                        Save();
                    }
                }
            }
            catch (SmtpException)
            {
                // Leave reminder_sent_at empty so a temporary SMTP outage can be retried.
            }
        }

        return sent;
    }

    private bool CanChatWithInternal(int userId, int otherUserId) =>
        userId != otherUserId &&
        _state.Users.Any(user => user.Id == userId && IsChatRole(user.Role)) &&
        _state.Users.Any(user => user.Id == otherUserId && IsChatRole(user.Role));

    private static bool IsChatRole(string? role) =>
        !string.IsNullOrWhiteSpace(role);

    private object ToChatMessageDto(ChatMessageItem message)
    {
        var sender = _state.Users.FirstOrDefault(user => user.Id == message.SenderId);
        var senderName = string.Join(" ", new[] { sender?.FirstName, sender?.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim();
        return new
        {
            type = "message",
            id = message.Id,
            sender_id = message.SenderId,
            sender_name = senderName.Length > 0 ? senderName : sender?.Username ?? "User",
            sender_role = sender?.Role ?? "user",
            recipient_id = message.RecipientId,
            text = message.Text,
            sent_at = message.SentAt,
            received_at = message.ReceivedAt,
            seen_at = message.SeenAt,
            delivery_status = message.SeenAt.HasValue ? "seen" : message.ReceivedAt.HasValue ? "received" : "sent"
        };
    }

    public (int Imported, List<string> Errors, List<object> Conflicts, List<string> Skipped) ImportDiningMenus(List<DiningMenuImportRow> rows, int adminId, bool overwriteConflicts = false) =>
        ImportDiningMenusInternal(rows, adminId, false, overwriteConflicts);

    public (int Imported, List<string> Errors, List<object> Conflicts, List<string> Skipped) ImportDiningMenusForUser(List<DiningMenuImportRow> rows, int userId, bool overwriteConflicts = false) =>
        ImportDiningMenusInternal(rows, userId, true, overwriteConflicts);

    private (int Imported, List<string> Errors, List<object> Conflicts, List<string> Skipped) ImportDiningMenusInternal(List<DiningMenuImportRow> rows, int actorId, bool actorIsUser, bool overwriteConflicts = false)
    {
        lock (_gate)
        {
            var imported = 0;
            var importedDates = new List<DateOnly>();
            var newlyPublishedDates = new List<DateOnly>();
            var errors = new List<string>();
            var conflicts = new List<object>();
            var skipped = new List<string>();
            var admin = actorIsUser ? null : _state.Admins.FirstOrDefault(item => item.Id == actorId);
            var user = actorIsUser ? _state.Users.FirstOrDefault(item => item.Id == actorId) : null;
            if (admin is null && user is null)
            {
                return (0, ["Authentication required"], [], []);
            }
            var actorName = admin?.Username ?? user!.Username;

            foreach (var row in rows)
            {
                if (!TryParseDate(row.Date, out var date))
                {
                    errors.Add($"Invalid date '{row.Date}'");
                    continue;
                }

                if (GetHolidayOrWeekend(date) is not null)
                {
                    skipped.Add(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    continue;
                }

                var existing = _state.DiningMenus.FirstOrDefault(item => item.Date == date);
                if (existing is not null && !overwriteConflicts)
                {
                    conflicts.Add(new
                    {
                        date = date.ToString("yyyy-MM-dd"),
                        existing = ToDiningMenuDto(existing),
                        incoming = new
                        {
                            date = date.ToString("yyyy-MM-dd"),
                            breakfast_menu = row.BreakfastMenu,
                            breakfast_start_time = NormalizeTime(row.BreakfastStartTime),
                            breakfast_end_time = NormalizeTime(row.BreakfastEndTime),
                            lunch_menu = row.LunchMenu,
                            lunch_start_time = NormalizeTime(row.LunchStartTime),
                            lunch_end_time = NormalizeTime(row.LunchEndTime)
                        }
                    });
                    continue;
                }

                if (existing is null)
                {
                    _state.DiningMenus.Add(new DiningMenuItem
                    {
                        Id = _state.Counters.NextDiningMenuId++,
                        Date = date,
                        DayOfWeek = date.DayOfWeek.ToString(),
                        BreakfastMenu = row.BreakfastMenu,
                        BreakfastStartTime = NormalizeTime(row.BreakfastStartTime),
                        BreakfastEndTime = NormalizeTime(row.BreakfastEndTime),
                        LunchMenu = row.LunchMenu,
                        LunchStartTime = NormalizeTime(row.LunchStartTime),
                        LunchEndTime = NormalizeTime(row.LunchEndTime),
                        CreatedBy = actorId,
                        CreatedByName = actorName,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                    newlyPublishedDates.Add(date);
                }
                else
                {
                    existing.BreakfastMenu = row.BreakfastMenu;
                    existing.BreakfastStartTime = NormalizeTime(row.BreakfastStartTime);
                    existing.BreakfastEndTime = NormalizeTime(row.BreakfastEndTime);
                    existing.LunchMenu = row.LunchMenu;
                    existing.LunchStartTime = NormalizeTime(row.LunchStartTime);
                    existing.LunchEndTime = NormalizeTime(row.LunchEndTime);
                    existing.UpdatedAt = DateTime.UtcNow;
                }

                imported++;
                importedDates.Add(date);
            }

            if (imported > 0)
            {
                var dateSummary = importedDates
                    .Distinct()
                    .OrderBy(date => date)
                    .Take(3)
                    .Select(date => date.ToString("MMM d", CultureInfo.InvariantCulture));
                var suffix = importedDates.Count > 3 ? " and more" : string.Empty;
                AddNotificationsForRolesInternal(
                    "Dining menu",
                    $"{imported} new dining menu{(imported == 1 ? string.Empty : "s")} published ({string.Join(", ", dateSummary)}{suffix}).",
                    "#dining-menu-section",
                    _state.Users
                        .Where(item => (item.SectionAccessConfigured ? item.AllowedSections : GetAllowedSectionsForRole(item.Role))
                            .Contains("dining-menu", StringComparer.OrdinalIgnoreCase))
                        .Select(item => item.Role));
            }
            if (newlyPublishedDates.Count > 0)
            {
                SendDiningMenuEmailInternal(newlyPublishedDates);
            }
            AddActivityInternal(actorId, actorName, admin?.Role ?? user!.Role, "dining_import", $"{imported} menus imported");
            Save();
            return (imported, errors, conflicts, skipped);
        }
    }

    public object? GetDiningMenuByDate(DateOnly date)
    {
        lock (_gate)
        {
            var menu = _state.DiningMenus.FirstOrDefault(item => item.Date == date);
            return menu is null ? null : ToDiningMenuDto(menu);
        }
    }

    public OperationResult CreateDiningMenu(Dictionary<string, object?> body)
    {
        lock (_gate)
        {
            if (!TryParseDate(body.GetString("date"), out var date))
            {
                return new OperationResult(false, "Invalid date format");
            }

            if (GetHolidayOrWeekend(date) is not null)
            {
                return new OperationResult(false, "Selected date is not available for dining menu");
            }

            if (_state.DiningMenus.Any(item => item.Date == date))
            {
                return new OperationResult(false, "Dining menu already exists for that date");
            }

            var admin = _state.Admins.FirstOrDefault(item => item.Id == body.GetInt("current_admin_id"));
            if (admin is null)
            {
                return new OperationResult(false, "Authentication required");
            }

            var recurring = body.GetBool("is_recurring");
            var created = CreateDiningMenuInternal(date, body, admin, recurring);
            var recurringCreated = 0;
            if (created && recurring)
            {
                var selectedDates = GetRecurringMenuDates(body);
                recurringCreated = selectedDates.Count > 0
                    ? CreateRecurringMenusForSelectedDates(date, body, admin, selectedDates)
                    : CreateRecurringMenus(date, body, admin, body.GetInt("weeks_ahead", 12));
            }

            if (created)
            {
                AddNotificationsForRolesInternal(
                    "Dining menu",
                    $"A new dining menu is available for {date:MMMM d, yyyy}.",
                    "#dining-menu-section",
                    ["student", "instructor"]);
                SendDiningMenuEmailInternal([date]);
            }

            Save();
            return new OperationResult(true, RecurringMenusCreated: recurringCreated);
        }
    }

    public OperationResult UpdateDiningMenu(Dictionary<string, object?> body)
    {
        lock (_gate)
        {
            var menu = _state.DiningMenus.FirstOrDefault(item => item.Id == body.GetInt("id"));
            if (menu is null)
            {
                return new OperationResult(false, "Dining menu not found");
            }

            menu.BreakfastMenu = body.GetString("breakfast_menu");
            menu.BreakfastStartTime = NormalizeTime(body.GetString("breakfast_start_time", menu.BreakfastStartTime));
            menu.BreakfastEndTime = NormalizeTime(body.GetString("breakfast_end_time", menu.BreakfastEndTime));
            menu.LunchMenu = body.GetString("lunch_menu");
            menu.LunchStartTime = NormalizeTime(body.GetString("lunch_start_time", menu.LunchStartTime));
            menu.LunchEndTime = NormalizeTime(body.GetString("lunch_end_time", menu.LunchEndTime));
            menu.IsRecurring = body.GetBool("is_recurring", menu.IsRecurring);
            menu.UpdatedAt = DateTime.UtcNow;

            var propagated = 0;
            if (menu.IsRecurring)
            {
                foreach (var item in _state.DiningMenus.Where(item => item.IsRecurring && item.DayOfWeek == menu.DayOfWeek && item.Date >= menu.Date && item.Id != menu.Id))
                {
                    item.BreakfastMenu = menu.BreakfastMenu;
                    item.BreakfastStartTime = menu.BreakfastStartTime;
                    item.BreakfastEndTime = menu.BreakfastEndTime;
                    item.LunchMenu = menu.LunchMenu;
                    item.LunchStartTime = menu.LunchStartTime;
                    item.LunchEndTime = menu.LunchEndTime;
                    item.UpdatedAt = DateTime.UtcNow;
                    propagated++;
                }
            }

            Save();
            return new OperationResult(true, RecurringMenusCreated: propagated);
        }
    }

    public bool DeleteDiningMenu(int id)
    {
        lock (_gate)
        {
            var menu = _state.DiningMenus.FirstOrDefault(item => item.Id == id);
            if (menu is null)
            {
                return false;
            }

            _state.DiningMenus.Remove(menu);
            Save();
            return true;
        }
    }

    public List<HolidayItem> GetHolidaysByYear(int year)
    {
        lock (_gate)
        {
            return _state.Holidays
                .Where(item => item.Year == year)
                .OrderBy(item => item.Date)
                .Select(Clone)
                .ToList();
        }
    }

    public HolidayItem? GetHolidayOrWeekend(DateOnly date)
    {
        lock (_gate)
        {
            var explicitHoliday = _state.Holidays.FirstOrDefault(item => item.Date == date && item.IsActive);
            if (explicitHoliday is not null)
            {
                return Clone(explicitHoliday);
            }

            var dayName = date.DayOfWeek.ToString();
            if (dayName is nameof(DayOfWeek.Saturday) or nameof(DayOfWeek.Sunday))
            {
                return new HolidayItem
                {
                    Date = date,
                    Year = date.Year,
                    DayOfWeek = dayName,
                    HolidayName = "Weekend",
                    Type = "weekend",
                    Description = "Weekend (Saturday/Sunday)",
                    IsRecurring = true
                };
            }

            return null;
        }
    }

    public OperationResult CreateHoliday(Dictionary<string, object?> body)
    {
        lock (_gate)
        {
            if (!TryBuildHoliday(body, out var holiday, out var error))
            {
                return new OperationResult(false, error);
            }

            if (_state.Holidays.Any(item => item.Date == holiday.Date))
            {
                return new OperationResult(false, "Holiday already exists for that date");
            }

            holiday.Id = _state.Counters.NextHolidayId++;
            _state.Holidays.Add(holiday);
            RemoveDiningMenusForHolidayDates([holiday.Date]);
            Save();
            return new OperationResult(true);
        }
    }

    public OperationResult UpdateHoliday(Dictionary<string, object?> body)
    {
        lock (_gate)
        {
            var holiday = _state.Holidays.FirstOrDefault(item => item.Id == body.GetInt("id"));
            if (holiday is null)
            {
                return new OperationResult(false, "Holiday not found");
            }

            if (!TryBuildHoliday(body, out var updated, out var error))
            {
                return new OperationResult(false, error);
            }

            holiday.Date = updated.Date;
            holiday.Year = updated.Year;
            holiday.DayOfWeek = updated.DayOfWeek;
            holiday.HolidayName = updated.HolidayName;
            holiday.Type = updated.Type;
            holiday.Description = updated.Description;
            holiday.IsActive = updated.IsActive;
            holiday.IsRecurring = updated.IsRecurring;
            holiday.UpdatedAt = DateTime.UtcNow;
            RemoveDiningMenusForHolidayDates([holiday.Date]);
            Save();
            return new OperationResult(true);
        }
    }

    public bool DeleteHoliday(int id)
    {
        lock (_gate)
        {
            var holiday = _state.Holidays.FirstOrDefault(item => item.Id == id);
            if (holiday is null)
            {
                return false;
            }

            _state.Holidays.Remove(holiday);
            Save();
            return true;
        }
    }

    public bool DeleteHolidaysByYear(int year)
    {
        lock (_gate)
        {
            var removed = _state.Holidays.RemoveAll(item => item.Year == year);
            if (removed <= 0)
            {
                return false;
            }

            Save();
            return true;
        }
    }

    public (int Imported, List<string> Errors, int DeletedMenus) ImportHolidays(int year, List<HolidayCsvRow> rows, int adminId)
    {
        lock (_gate)
        {
            var errors = new List<string>();
            var pending = new List<HolidayItem>();
            var dates = new HashSet<DateOnly>();
            if (rows.Count == 0)
            {
                return (0, ["Add at least one holiday row before importing."], 0);
            }

            for (var index = 0; index < rows.Count; index++)
            {
                var row = rows[index];
                var rowNumber = index + 2;
                if (!TryParseFlexibleDate(row.Date, year, out var date))
                {
                    errors.Add($"Row {rowNumber}: '{row.Date}' is not a valid date. Use MM/DD/YYYY or YYYY-MM-DD.");
                    continue;
                }

                if (date.Year != year)
                {
                    errors.Add($"Row {rowNumber}: {date:MM/dd/yyyy} is outside the selected year {year}.");
                    continue;
                }

                if (string.IsNullOrWhiteSpace(row.HolidayName))
                {
                    errors.Add($"Row {rowNumber}: holiday name is required.");
                    continue;
                }

                // Weekday is derived from the date on the server. Import files
                // supply only Date and HolidayName, so a spreadsheet cannot
                // accidentally store a mismatched weekday.
                var actualDay = date.DayOfWeek.ToString();

                if (!dates.Add(date))
                {
                    errors.Add($"Row {rowNumber}: {date:MM/dd/yyyy} is duplicated in the import.");
                    continue;
                }

                pending.Add(new HolidayItem
                {
                    Id = _state.Counters.NextHolidayId++,
                    Date = date,
                    Year = year,
                    DayOfWeek = actualDay,
                    HolidayName = row.HolidayName.Trim(),
                    Type = "holiday",
                    IsActive = true,
                    CreatedBy = adminId,
                    CreatedByName = _state.Admins.FirstOrDefault(item => item.Id == adminId)?.Username,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            if (errors.Count > 0)
            {
                _state.Counters.NextHolidayId -= pending.Count;
                return (0, errors, 0);
            }

            _state.Holidays.RemoveAll(item => item.Year == year);
            _state.Holidays.AddRange(pending);
            var deletedMenus = RemoveDiningMenusForHolidayDates(dates);
            Save();
            return (pending.Count, errors, deletedMenus);
        }
    }

    private AppState LoadOrSeed()
    {
        var databaseState = _database.LoadState();
        if (databaseState is not null)
        {
            return databaseState;
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        return new AppState
        {
            Users =
            [
                new UserAccount { Id = 1, Username = "instructor1", Password = PasswordSecurity.Hash("instructor123"), Email = "instructor1@final.edu.tr", Role = "instructor", CreatedAt = DateTime.UtcNow.AddDays(-60) },
                new UserAccount { Id = 2, Username = "student1", Password = PasswordSecurity.Hash("student123"), Email = "student1@final.edu.tr", Role = "student", CreatedAt = DateTime.UtcNow.AddDays(-30) }
            ],
            Admins =
            [
                new AdminAccount { Id = 1, Username = "admin", Password = PasswordSecurity.Hash("admin123"), Email = "admin@final.edu.tr", Role = "admin", IsActive = true, CreatedAt = DateTime.UtcNow.AddDays(-60), LastLogin = DateTime.UtcNow.AddMinutes(-20) },
                new AdminAccount { Id = 2, Username = "coordinator", Password = PasswordSecurity.Hash("admin123"), Email = "coordinator@final.edu.tr", Role = "admin", IsActive = true, CreatedAt = DateTime.UtcNow.AddDays(-15), LastLogin = DateTime.UtcNow.AddHours(-5) }
            ],
            Platforms =
            [
                NewPlatform(1, "Leave and Absence", "Leave and Absence Portal", "https://leave.fnlsrv.website/", null),
                NewPlatform(2, "RMS", "Residency Management System", "https://rms.fnlsrv.website/publicHome.php", null),
                NewPlatform(3, "AIS", "Academic Information System", "https://ais.final.edu.tr/", null, ["instructor"]),
                NewPlatform(4, "LMS", "Learning Management System", "https://lms0.final.edu.tr", null),
                NewPlatform(5, "Document Application System", "Document Application System for Students", "https://docs.final.edu.tr/pages/form", null),
                NewPlatform(6, "Summer School Application", "Summer School Application", "https://online.final.edu.tr/yazokulu/login.php", null),
                NewPlatform(7, "Accommodation Booking Portal", "Accommodation Booking Portal for Students", "https://dorms.final.edu.tr/", null),
                NewPlatform(8, "Support Center", "Support Center", "https://destek.final.edu.tr/index.php", null),
                NewPlatform(9, "Student Exam Registration", "Student Exam Registration for Students", "https://online.final.edu.tr/exam/", null),
                NewPlatform(10, "Exemption exam form", "Exemption exam form for Students", "https://online.final.edu.tr/muafiyet", null),
                NewPlatform(11, "Resit Exams Application", "Resit Exams Application", "https://online.final.edu.tr/resit/login.php", null)
            ],
            Announcements =
            [
                new AnnouncementItem { Id = 1, Title = "Welcome to FIU Global Portal", Content = "The .NET migration preview is live and ready for review.", AuthorId = 1, AuthorName = "admin", Priority = "high", TargetAudience = "all", CreatedAt = DateTime.UtcNow.AddDays(-2), UpdatedAt = DateTime.UtcNow.AddDays(-2), IsActive = true },
                new AnnouncementItem { Id = 2, Title = "Dining Schedule Updated", Content = "This week's breakfast and lunch plans are available in the dashboard.", AuthorId = 2, AuthorName = "coordinator", Priority = "medium", TargetAudience = "instructors", CreatedAt = DateTime.UtcNow.AddDays(-1), UpdatedAt = DateTime.UtcNow.AddDays(-1), IsActive = true }
            ],
            DiningMenus =
            [
                NewDiningMenu(1, today, "Breakfast buffet, tea, and fruit", "Chicken wrap, salad, and soup", true),
                NewDiningMenu(2, today.AddDays(1), "Boiled eggs, olives, and bread", "Rice, grilled vegetables, and yogurt", true),
                NewDiningMenu(3, today.AddDays(2), "Pancakes and fruit juice", "Pasta, chicken strips, and dessert", false)
            ],
            Holidays =
            [
                NewHoliday(1, new DateOnly(today.Year, 12, 25), "University Closure", "closure", "Winter holiday closure."),
                NewHoliday(2, new DateOnly(today.Year, 1, 1), "New Year's Day", "holiday", "Public holiday.")
            ],
            Notifications =
            [
                new NotificationItem { Id = 1, Username = "admin", Platform = "RMS", Message = "Two new RMS notifications are waiting.", Url = "https://rms.fnlsrv.website/publicHome.php", Date = DateTime.Today.ToString("yyyy-MM-dd"), CreatedAt = DateTime.UtcNow.AddHours(-3) },
                new NotificationItem { Id = 2, Username = "admin", Platform = "Leave and Absence", Message = "Leave request status updated.", Url = "https://leave.fnlsrv.website/", Date = DateTime.Today.ToString("yyyy-MM-dd"), CreatedAt = DateTime.UtcNow.AddHours(-2) },
                new NotificationItem { Id = 3, Username = "student1", Platform = "LMS", Message = "A new course announcement was posted.", Url = "https://lms1.final.edu.tr/LMS/", Date = DateTime.Today.ToString("yyyy-MM-dd"), Subplatform = "University Common", CreatedAt = DateTime.UtcNow.AddHours(-1) }
            ],
            LmsSubplatforms =
            [
                new LmsSubplatform { Name = "University Common", Url = "https://lms1.final.edu.tr/LMS/" },
                new LmsSubplatform { Name = "Faculty of Economics and Administrative Sciences", Url = "https://lms2.final.edu.tr/LMS/" },
                new LmsSubplatform { Name = "Faculty of Engineering", Url = "https://lms3.final.edu.tr/LMS/" },
                new LmsSubplatform { Name = "School of Foreign Languages", Url = "https://lms6.final.edu.tr/LMS/" }
            ]
        };
    }

    private void InitializeFromDatabase()
    {
        _state = LoadOrSeed();
        _database.MergeLegacyAccounts(_state);
        _database.MergeFacultyDirectory(_state);
        _sessions.Clear();
        foreach (var session in _database.LoadSessions())
        {
            _sessions[session.Key] = session.Value;
        }
        MigrateState();
        Save();
        _database.EnsureChatUserForeignKeys();
    }

    private void MigrateState()
    {
        _state.UserPlatformAccess ??= [];
        _state.Faculties ??= [];
        _state.Departments ??= [];
        _state.Counters.NextFacultyId = Math.Max(_state.Counters.NextFacultyId, _state.Faculties.Count == 0 ? 1 : _state.Faculties.Max(item => item.Id) + 1);
        _state.Counters.NextDepartmentId = Math.Max(_state.Counters.NextDepartmentId, _state.Departments.Count == 0 ? 1 : _state.Departments.Max(item => item.Id) + 1);
        _state.RoleSectionAccess ??= new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        _state.RoleSectionParts ??= new Dictionary<string, Dictionary<string, List<string>>>(StringComparer.OrdinalIgnoreCase);
        NormalizeLegacyPortalBranding();
        NormalizeAcademicDirectoryEnglish();
        NormalizeLegacyEnglishContent();
        ApplyEnvironmentSmtp();
        EnsureDefaultRoleAccess();
        RefreshLmsSubplatforms();
        foreach (var platform in _state.Platforms)
        {
            if (string.IsNullOrWhiteSpace(platform.Section))
            {
                platform.Section = platform.Name.Equals("LMS", StringComparison.OrdinalIgnoreCase) ? "LMS" : "Campus";
            }

            platform.VisibleToRoles = NormalizePlatformRoles(platform.VisibleToRoles);
            platform.ImageUrl = NormalizePlatformImageUrl(platform.ImageUrl);
            if (platform.Name.Equals("Leave and Absence", StringComparison.OrdinalIgnoreCase))
            {
                platform.Url = "https://leave.fnlsrv.website/";
            }
            else if (platform.Name.Equals("RMS", StringComparison.OrdinalIgnoreCase))
            {
                platform.Url = "https://rms.fnlsrv.website/publicHome.php";
            }
        }

        foreach (var admin in _state.Admins)
        {
            admin.Role = "admin";
            admin.IsActive = true;
            if (string.IsNullOrWhiteSpace(admin.Email))
            {
                admin.Email = $"{admin.Username}@final.edu.tr";
            }
            if (string.IsNullOrWhiteSpace(admin.FirstName)) admin.FirstName = admin.Username;
            if (string.IsNullOrWhiteSpace(admin.ProfilePicture)) admin.ProfilePicture = "/img/fiu9-mark2.png";
            if (admin.AllowedSections is null) admin.AllowedSections = [];
            if (!admin.Password.StartsWith("google-oauth:", StringComparison.OrdinalIgnoreCase) && !PasswordSecurity.IsCurrentHash(admin.Password))
            {
                admin.Password = PasswordSecurity.Hash(admin.Password);
            }
        }

        foreach (var user in _state.Users)
        {
            user.Role = string.IsNullOrWhiteSpace(user.Role) ? "student" : user.Role.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(user.Email))
            {
                user.Email = $"{user.Username}@final.edu.tr";
            }
            if (IsStudentRole(user.Role) && string.IsNullOrWhiteSpace(user.StudentNumber)) user.StudentNumber = FormatStudentNumber(user.Id);
            if (string.IsNullOrWhiteSpace(user.FirstName)) user.FirstName = user.Username;
            if (string.IsNullOrWhiteSpace(user.LastName)) user.LastName = string.Empty;
            if (string.IsNullOrWhiteSpace(user.ProfilePicture)) user.ProfilePicture = "/img/fiu9-mark2.png";
            if (user.AllowedSections is null) user.AllowedSections = [];
            if (user.SectionPermissions is null) user.SectionPermissions = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            if (!user.Password.StartsWith("google-oauth:", StringComparison.OrdinalIgnoreCase) && !PasswordSecurity.IsCurrentHash(user.Password))
            {
                user.Password = PasswordSecurity.Hash(user.Password);
            }

            // Accounts created by the earlier Google flow were marked as
            // explicitly configured with an empty access list. Treat those
            // accounts as normal students so they inherit the role defaults.
            if (user.Password.StartsWith("google-oauth:", StringComparison.OrdinalIgnoreCase) &&
                user.SectionAccessConfigured &&
                user.AllowedSections.Count == 0)
            {
                user.SectionAccessConfigured = false;
                user.SectionPermissions.Clear();
            }
        }

        // Older platforms already have VisibleToRoles, but their role and
        // per-user platform allowlists were snapshots from before the platform
        // existed. Reconcile those saved grants once without overriding later
        // administrator changes to Role Access.
        if (_state.PlatformRoleGrantSyncVersion < 1)
        {
            foreach (var platform in _state.Platforms)
            {
                GrantPlatformToAssignedRoles(platform);
            }
            _state.PlatformRoleGrantSyncVersion = 1;
        }

        MigrateFacultyDirectoryFromAccountProfiles();

        var admins = _state.Admins.ToList();
        foreach (var admin in admins)
        {
            _state.Users.RemoveAll(user => user.Username.Equals(admin.Username, StringComparison.OrdinalIgnoreCase));
        }

        if (_state.Admins.Count == 0)
        {
            _state.Admins.Add(new AdminAccount
            {
                Id = _state.Counters.NextAdminId++,
                Username = "admin",
                Password = PasswordSecurity.Hash("admin123"),
                Email = "admin@final.edu.tr",
                Role = "admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        _state.Counters.NextFacultyId = Math.Max(_state.Counters.NextFacultyId, _state.Faculties.Count == 0 ? 1 : _state.Faculties.Max(item => item.Id) + 1);
        _state.Counters.NextDepartmentId = Math.Max(_state.Counters.NextDepartmentId, _state.Departments.Count == 0 ? 1 : _state.Departments.Max(item => item.Id) + 1);
    }

    private void NormalizeLegacyPortalBranding()
    {
        foreach (var announcement in _state.Announcements)
        {
            announcement.Title = ReplaceLegacyPortalBranding(announcement.Title);
            announcement.Content = ReplaceLegacyPortalBranding(announcement.Content);
        }
    }

    private static string ReplaceLegacyPortalBranding(string value) =>
        value.Replace("Final Global", "FIU Global Portal", StringComparison.OrdinalIgnoreCase);

    private void NormalizeAcademicDirectoryEnglish()
    {
        var facultyTranslations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Diş Hekimliği Fakültesi"] = "Faculty of Dentistry",
            ["Eczacılık Fakültesi"] = "Faculty of Pharmacy",
            ["Eğitim Bilimleri Fakültesi"] = "Faculty of Educational Sciences",
            ["Fen Edebiyat Fakültesi"] = "Faculty of Arts and Sciences",
            ["Hukuk Fakültesi"] = "Faculty of Law",
            ["İktisadi ve İdari Bilimler Fakültesi"] = "Faculty of Economics and Administrative Sciences",
            ["Mimarlık ve Güzel Sanatlar Fakültesi"] = "Faculty of Architecture and Fine Arts",
            ["Mühendislik Fakültesi"] = "Faculty of Engineering",
            ["Sağlık Bilimleri Fakültesi"] = "Faculty of Health Sciences"
        };
        var departmentTranslations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Diş Hekimliği (İngilizce)"] = "Dentistry (English)",
            ["Diş Hekimliği (Türkçe)"] = "Dentistry (Turkish)",
            ["Eczacılık (Türkçe)"] = "Pharmacy (Turkish)",
            ["Eczacılık - 5 Yıllık (İngilizce)"] = "Pharmacy - 5 Year (English)",
            ["Eczacılık - 6 Yıllık (İngilizce)"] = "Pharmacy - 6 Year (English)",
            ["İngilizce Öğretmenliği (İngilizce)"] = "English Language Teaching (English)",
            ["Okul Öncesi Öğretmenliği (Türkçe)"] = "Early Childhood Education (Turkish)",
            ["Özel Eğitim Öğretmenliği (Türkçe)"] = "Special Education Teaching (Turkish)",
            ["Rehberlik ve Psikolojik Danışmanlık (Türkçe)"] = "Guidance and Psychological Counseling (Turkish)",
            ["Türkçe Öğretmenliği (Türkçe)"] = "Turkish Language Teaching (Turkish)",
            ["Psikoloji (İngilizce)"] = "Psychology (English)",
            ["Psikoloji (Türkçe)"] = "Psychology (Turkish)",
            ["Hukuk (Türkçe)"] = "Law (Turkish)",
            ["Uluslararası Hukuk (İngilizce)"] = "International Law (English)",
            ["Bankacılık, Finans ve Muhasebe (İngilizce)"] = "Banking, Finance and Accounting (English)",
            ["Ekonomi (İngilizce)"] = "Economics (English)",
            ["İşletme (İngilizce)"] = "Business Administration (English)",
            ["Pazarlama - Dijital Medya (İngilizce)"] = "Marketing - Digital Media (English)",
            ["Siyaset Bilimi ve Uluslararası İlişkiler (İngilizce)"] = "Political Science and International Relations (English)",
            ["Uluslararası Finans ve Bankacılık (İngilizce)"] = "International Finance and Banking (English)",
            ["Uluslararası Ticaret ve İşletmecilik (İngilizce)"] = "International Trade and Business Administration (English)",
            ["Yönetim Bilişim Sistemleri (İngilizce)"] = "Management Information Systems (English)",
            ["İç Mimarlık (İngilizce)"] = "Interior Architecture (English)",
            ["Mimarlık (İngilizce)"] = "Architecture (English)",
            ["Bilgisayar Mühendisliği (İngilizce)"] = "Computer Engineering (English)",
            ["Elektrik ve Elektronik Mühendisliği (İngilizce)"] = "Electrical and Electronics Engineering (English)",
            ["İnşaat Mühendisliği (İngilizce)"] = "Civil Engineering (English)",
            ["Yapay Zeka Mühendisliği (İngilizce)"] = "Artificial Intelligence Engineering (English)",
            ["Yazılım Mühendisliği (İngilizce)"] = "Software Engineering (English)",
            ["Beslenme ve Diyetetik (İngilizce)"] = "Nutrition and Dietetics (English)",
            ["Fizyoterapi ve Rehabilitasyon (İngilizce)"] = "Physiotherapy and Rehabilitation (English)",
            ["Fizyoterapi ve Rehabilitasyon (Türkçe)"] = "Physiotherapy and Rehabilitation (Turkish)",
            ["Hemşirelik (İngilizce)"] = "Nursing (English)"
        };

        foreach (var faculty in _state.Faculties)
        {
            if (facultyTranslations.TryGetValue(faculty.Name.Trim(), out var translatedName))
            {
                faculty.Name = translatedName;
            }
        }

        foreach (var department in _state.Departments)
        {
            if (departmentTranslations.TryGetValue(department.Name.Trim(), out var translatedName))
            {
                department.Name = translatedName;
            }
        }

        foreach (var account in _state.Users)
        {
            if (account.FacultyId is int facultyId)
            {
                account.Faculty = _state.Faculties.FirstOrDefault(item => item.Id == facultyId)?.Name ?? account.Faculty;
            }
            if (account.DepartmentId is int departmentId)
            {
                account.Department = _state.Departments.FirstOrDefault(item => item.Id == departmentId)?.Name ?? account.Department;
            }
        }

        foreach (var account in _state.Admins)
        {
            if (account.FacultyId is int facultyId)
            {
                account.Faculty = _state.Faculties.FirstOrDefault(item => item.Id == facultyId)?.Name ?? account.Faculty;
            }
            if (account.DepartmentId is int departmentId)
            {
                account.Department = _state.Departments.FirstOrDefault(item => item.Id == departmentId)?.Name ?? account.Department;
            }
        }
    }

    private void NormalizeLegacyEnglishContent()
    {
        foreach (var platform in _state.Platforms)
        {
            platform.Description = platform.Description
                .Replace(" / Yaz Okulu Basvurusu", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace(" / Destek Merkezine", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace(" / Butunleme Sinavlari Basvurusu", string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        if (string.Equals(_state.Smtp.FromName, "Final Global", StringComparison.OrdinalIgnoreCase))
        {
            _state.Smtp.FromName = "FIU Global Portal";
        }
    }

    private void MigrateFacultyDirectoryFromAccountProfiles()
    {
        foreach (var user in _state.Users)
        {
            MigrateAccountAffiliation(user.FacultyId, user.DepartmentId, user.Faculty, user.Department,
                (facultyId, departmentId, facultyName, departmentName) =>
                {
                    user.FacultyId = facultyId;
                    user.DepartmentId = departmentId;
                    user.Faculty = facultyName;
                    user.Department = departmentName;
                });
        }

        foreach (var admin in _state.Admins)
        {
            MigrateAccountAffiliation(admin.FacultyId, admin.DepartmentId, admin.Faculty, admin.Department,
                (facultyId, departmentId, facultyName, departmentName) =>
                {
                    admin.FacultyId = facultyId;
                    admin.DepartmentId = departmentId;
                    admin.Faculty = facultyName;
                    admin.Department = departmentName;
                });
        }
    }

    private void MigrateAccountAffiliation(int? currentFacultyId, int? currentDepartmentId, string facultyName, string departmentName, Action<int?, int?, string, string> apply)
    {
        var faculty = currentFacultyId.HasValue
            ? _state.Faculties.FirstOrDefault(item => item.Id == currentFacultyId.Value)
            : null;
        if (faculty is null && !string.IsNullOrWhiteSpace(facultyName))
        {
            faculty = _state.Faculties.FirstOrDefault(item => item.Name.Equals(facultyName.Trim(), StringComparison.OrdinalIgnoreCase));
            if (faculty is null)
            {
                var now = DateTime.UtcNow;
                faculty = new FacultyItem
                {
                    Id = _state.Counters.NextFacultyId++,
                    Name = facultyName.Trim(),
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _state.Faculties.Add(faculty);
            }
        }

        if (faculty is null)
        {
            apply(null, null, string.Empty, string.Empty);
            return;
        }

        var department = currentDepartmentId.HasValue
            ? _state.Departments.FirstOrDefault(item => item.Id == currentDepartmentId.Value && item.FacultyId == faculty.Id)
            : null;
        if (department is null && !string.IsNullOrWhiteSpace(departmentName))
        {
            department = _state.Departments.FirstOrDefault(item =>
                item.FacultyId == faculty.Id && item.Name.Equals(departmentName.Trim(), StringComparison.OrdinalIgnoreCase));
            if (department is null)
            {
                var now = DateTime.UtcNow;
                department = new DepartmentItem
                {
                    Id = _state.Counters.NextDepartmentId++,
                    FacultyId = faculty.Id,
                    Name = departmentName.Trim(),
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _state.Departments.Add(department);
            }
        }

        apply(faculty.Id, department?.Id, faculty.Name, department?.Name ?? string.Empty);
    }

    private bool TryResolveAffiliation(Dictionary<string, object?> body, out int? facultyId, out int? departmentId, out string facultyName, out string departmentName, out string error)
    {
        facultyId = null;
        departmentId = null;
        facultyName = string.Empty;
        departmentName = string.Empty;
        error = string.Empty;

        var hasIds = body.ContainsKey("faculty_id") || body.ContainsKey("department_id");
        var requestedFacultyId = body.GetInt("faculty_id");
        var requestedDepartmentId = body.GetInt("department_id");

        if (!hasIds)
        {
            var legacyFaculty = body.GetString("faculty").Trim();
            var legacyDepartment = body.GetString("department").Trim();
            if (string.IsNullOrWhiteSpace(legacyFaculty) && string.IsNullOrWhiteSpace(legacyDepartment)) return true;
            var matchedFaculty = _state.Faculties.FirstOrDefault(item => item.Name.Equals(legacyFaculty, StringComparison.OrdinalIgnoreCase));
            var matchedDepartment = matchedFaculty is null ? null : _state.Departments.FirstOrDefault(item =>
                item.FacultyId == matchedFaculty.Id && item.Name.Equals(legacyDepartment, StringComparison.OrdinalIgnoreCase));
            requestedFacultyId = matchedFaculty?.Id ?? 0;
            requestedDepartmentId = matchedDepartment?.Id ?? 0;
        }

        if (requestedFacultyId <= 0 && requestedDepartmentId <= 0) return true;
        if (requestedFacultyId <= 0)
        {
            error = "Choose a faculty before choosing a department.";
            return false;
        }

        var faculty = _state.Faculties.FirstOrDefault(item => item.Id == requestedFacultyId && item.IsActive);
        if (faculty is null)
        {
            error = "Choose an active faculty from the list.";
            return false;
        }

        DepartmentItem? department = null;
        if (requestedDepartmentId > 0)
        {
            department = _state.Departments.FirstOrDefault(item =>
                item.Id == requestedDepartmentId && item.FacultyId == faculty.Id && item.IsActive);
            if (department is null)
            {
                error = "Choose a department belonging to the selected faculty.";
                return false;
            }
        }

        facultyId = faculty.Id;
        departmentId = department?.Id;
        facultyName = faculty.Name;
        departmentName = department?.Name ?? string.Empty;
        return true;
    }

    private void RefreshLmsSubplatforms()
    {
        if (_state.LmsSubplatforms.Count > 0)
        {
            foreach (var item in _state.LmsSubplatforms)
            {
                item.LoginEndpoint = string.IsNullOrWhiteSpace(item.LoginEndpoint) ? "/LMS/login/index.php" : item.LoginEndpoint;
                item.NotificationsEndpoint = string.IsNullOrWhiteSpace(item.NotificationsEndpoint)
                    ? "/LMS/message/output/popup/notifications.php"
                    : item.NotificationsEndpoint;
            }

            _state.LmsSubplatforms = _state.LmsSubplatforms
                .OrderBy(item => ExtractLmsNumber(item.Url))
                .ThenBy(item => item.Name)
                .ToList();
            return;
        }

        _state.LmsSubplatforms =
        [
            NewLms("University Common", "https://lms1.final.edu.tr/"),
            NewLms("School of Foreign Languages", "https://lms6.final.edu.tr/"),
            NewLms("School of Justice", "https://lms3.final.edu.tr/"),
            NewLms("School of Physical Education and Sports", "https://lms5.final.edu.tr/"),
            NewLms("Faculty of Educational Sciences", "https://lms4.final.edu.tr/"),
            NewLms("Faculty of Arts and Sciences", "https://lms5.final.edu.tr/"),
            NewLms("Faculty of Law", "https://lms3.final.edu.tr/"),
            NewLms("Institute of Graduate Studies", "https://lms1.final.edu.tr/"),
            NewLms("Faculty of Architecture and Fine Arts", "https://lms4.final.edu.tr/"),
            NewLms("Faculty of Engineering", "https://lms3.final.edu.tr/"),
            NewLms("Faculty of Health Sciences", "https://lms5.final.edu.tr/"),
            NewLms("Faculty of Pharmacy", "https://lms5.final.edu.tr/"),
            NewLms("Vocational School of Health Services", "https://lms5.final.edu.tr/"),
            NewLms("Faculty of Dentistry", "https://lms5.final.edu.tr/"),
            NewLms("Faculty of Economics and Administrative Sciences", "https://lms2.final.edu.tr/"),
            NewLms("Unal Caginer School of Tourism and Culinary Arts", "https://lms2.final.edu.tr/"),
            NewLms("Vocational School", "https://lms2.final.edu.tr/")
        ];
    }

    private static int ExtractLmsNumber(string url)
    {
        var match = System.Text.RegularExpressions.Regex.Match(url, @"lms(\d+)\.final\.edu\.tr", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success && int.TryParse(match.Groups[1].Value, out var number) ? number : int.MaxValue;
    }

    private void ApplyEnvironmentSmtp()
    {
        var host = Environment.GetEnvironmentVariable("SMTP_HOST");
        if (string.IsNullOrWhiteSpace(host))
        {
            return;
        }

        _state.Smtp.Host = host;
        _state.Smtp.Port = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var port) ? port : 587;
        _state.Smtp.Username = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? string.Empty;
        _state.Smtp.Password = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? string.Empty;
        _state.Smtp.FromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? _state.Smtp.Username;
        _state.Smtp.FromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME") ?? "FIU Global Portal";
        _state.Smtp.EnableSsl = !string.Equals(Environment.GetEnvironmentVariable("SMTP_ENABLE_SSL"), "false", StringComparison.OrdinalIgnoreCase);
    }

    private void Save()
    {
        try
        {
            _database.SaveState(_state);
        }
        catch (Exception ex)
        {
            // A dropped database connection must not crash a request or the
            // process. The next database-gated request will retry cleanly.
            _database.MarkUnavailable(ex);
        }
    }

    private void EnsureDefaultRoleAccess()
    {
        _state.RoleSectionAccess ??= new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        _state.RoleSectionParts ??= new Dictionary<string, Dictionary<string, List<string>>>(StringComparer.OrdinalIgnoreCase);
        var migratedDashboardDefaults = false;
        _state.RoleSectionAccess.TryAdd("instructor", ["platforms", "announcements", "dining-menu", "notifications"]);
        _state.RoleSectionAccess.TryAdd("student", ["platforms", "announcements", "dining-menu"]);

        var platformNames = _state.Platforms.Select(item => item.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        _state.RoleSectionParts.TryAdd("instructor", new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["platforms"] = platformNames,
            ["announcements"] = ["view"],
            ["dining-menu"] = [],
            ["notifications"] = ["view", "mark-read"]
        });
        _state.RoleSectionParts.TryAdd("student", new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["platforms"] = platformNames,
            ["announcements"] = ["view"],
            ["dining-menu"] = []
        });

        // A role that has never been configured starts with the three shared
        // sections. Existing role configurations are deliberately preserved:
        // an administrator must be able to remove a section for a whole role.
        // Explicit per-user configurations still take precedence in
        // GetEffectiveSectionsForUser.
        var roles = _state.RoleSectionAccess.Keys
            .Concat(_state.Users.Select(user => user.Role))
            .Append("student")
            .Append("instructor")
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Select(NormalizeRoleKey)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Existing installations may contain a custom role whose old default
        // exposed only one portal section. Move those role defaults to the
        // common dashboard once; later administrator changes remain respected.
        if (_state.RoleAccessDefaultsVersion < 1)
        {
            foreach (var role in roles)
            {
                var current = _state.RoleSectionAccess.TryGetValue(role, out var configured) ? configured ?? [] : [];
                _state.RoleSectionAccess[role] = current
                    .Concat(DefaultPortalSections)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            _state.RoleAccessDefaultsVersion = 1;
            migratedDashboardDefaults = true;
        }

        foreach (var role in roles)
        {
            var sections = _state.RoleSectionAccess.TryGetValue(role, out var existingSections)
                ? existingSections ?? []
                : DefaultPortalSections.ToList();

            _state.RoleSectionAccess[role] = sections
                .Select(item => item.Trim().ToLowerInvariant())
                .Where(item => item is "platforms" or "announcements" or "dining-menu" or "notifications")
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (!_state.RoleSectionParts.TryGetValue(role, out var parts) || parts is null)
            {
                parts = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
                _state.RoleSectionParts[role] = parts;
            }
            // A missing platform list means legacy/unconfigured data and gets
            // the full catalog. An explicitly empty list is a deliberate
            // revoke-all choice made in Role Access and must be preserved.
            if (!parts.ContainsKey("platforms"))
            {
                parts["platforms"] = platformNames.ToList();
            }
            if (!parts.ContainsKey("announcements")) parts["announcements"] = ["view"];
            if (!parts.ContainsKey("dining-menu")) parts["dining-menu"] = [];
            else parts["dining-menu"] = NormalizeDiningPermissionParts(parts["dining-menu"]);
        }

        if (migratedDashboardDefaults) Save();
    }

    private List<string> EffectiveSectionsForRole(string role, IEnumerable<string>? sections)
    {
        var result = (sections ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim().ToLowerInvariant())
            .Where(item => item is "platforms" or "announcements" or "dining-menu" or "notifications")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return result;
    }

    private Dictionary<string, List<string>> EffectivePermissionsForRole(string role, IDictionary<string, List<string>>? permissions)
    {
        var result = NormalizeSectionPermissions(permissions);
        if (!result.ContainsKey("platforms"))
        {
            result["platforms"] = _state.Platforms.Select(item => item.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        if (!result.ContainsKey("announcements")) result["announcements"] = ["view"];
        if (!result.ContainsKey("dining-menu")) result["dining-menu"] = [];
        return result;
    }

    private List<string> GetEffectiveSectionsForUser(UserAccount user) =>
        user.SectionAccessConfigured
            ? NormalizeSectionList(user.AllowedSections)
            : GetAllowedSectionsForRole(user.Role);

    private Dictionary<string, List<string>> GetEffectivePermissionsForUser(UserAccount user) =>
        user.SectionAccessConfigured
            ? NormalizeSectionPermissions(user.SectionPermissions)
            : GetSectionPermissionsForRole(user.Role);

    private static List<string> NormalizeSectionList(IEnumerable<string>? sections) =>
        (sections ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim().ToLowerInvariant())
            .Where(item => item is "platforms" or "announcements" or "dining-menu" or "notifications")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static List<string> NormalizeDiningPermissionParts(IEnumerable<string>? parts) =>
        (parts ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim().ToLowerInvariant())
            .Where(value => value is not "breakfast" and not "lunch")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static Dictionary<string, List<string>> NormalizeSectionPermissions(IDictionary<string, List<string>>? permissions)
    {
        var result = CopySectionPermissions(permissions ?? new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase));
        if (result.TryGetValue("dining-menu", out var diningParts))
        {
            result["dining-menu"] = NormalizeDiningPermissionParts(diningParts);
        }
        return result;
    }

    private static Dictionary<string, List<string>> CopySectionPermissions(IDictionary<string, List<string>> source) =>
        source.ToDictionary(
            pair => pair.Key,
            pair => (pair.Value ?? []).ToList(),
            StringComparer.OrdinalIgnoreCase);

    private List<object> GetServerErrorsInternal()
    {
        var errors = new List<object>();
        try
        {
            var logPath = Path.Combine(AppContext.BaseDirectory, "server-errors.log");
            if (File.Exists(logPath))
            {
                errors.AddRange(File.ReadLines(logPath).Reverse().Take(25).Select(line => new { source = "server-errors.log", message = line, created_at = DateTime.UtcNow }));
            }
        }
        catch (Exception ex)
        {
            errors.Add(new { source = "health-check", message = ex.Message, created_at = DateTime.UtcNow });
        }

        return errors;
    }

    private void AddActivityInternal(int? userId, string username, string role, string action, string detail)
    {
        _state.ActivityLogs.Add(new ActivityLogItem
        {
            Id = _state.Counters.NextActivityLogId++,
            UserId = userId,
            Username = username,
            Role = role,
            Action = action,
            Detail = detail,
            CreatedAt = DateTime.UtcNow
        });
        if (_state.ActivityLogs.Count > 1000)
        {
            _state.ActivityLogs = _state.ActivityLogs.OrderByDescending(item => item.CreatedAt).Take(1000).ToList();
        }
    }

    private void AddNotificationsForRolesInternal(string platform, string message, string url, IEnumerable<string> roles)
    {
        var roleSet = roles
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Select(role => role.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var user in _state.Users.Where(item => roleSet.Contains(item.Role)))
        {
            _state.Notifications.Add(new NotificationItem
            {
                Id = _state.Counters.NextNotificationId++,
                Username = user.Username,
                Platform = platform,
                Message = message,
                Url = url,
                Status = "unread",
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                CreatedAt = DateTime.UtcNow
            });
        }

        if (_state.Notifications.Count > 2000)
        {
            _state.Notifications = _state.Notifications
                .OrderByDescending(item => item.CreatedAt)
                .Take(2000)
                .ToList();
        }
    }

    private static List<string> NotificationRolesForAudience(string targetAudience) =>
        targetAudience.Trim().ToLowerInvariant() switch
        {
            "students" or "student" => ["student"],
            "instructors" or "instructor" => ["instructor"],
            _ => ["student", "instructor"]
        };

    private void SendAnnouncementEmailInternal(AnnouncementItem announcement)
    {
        if (AnnouncementPriorityRank(announcement.Priority) < 3)
        {
            return;
        }

        var recipients = _state.Users
            .Where(item => NotificationRolesForAudience(announcement.TargetAudience)
                .Contains(item.Role, StringComparer.OrdinalIgnoreCase))
            .Select(item => item.Email);
        var sent = SendEmailInternal(
            recipients,
            $"[HIGH PRIORITY] {announcement.Title}",
            $"A high-priority announcement was posted in FIU Global Portal.\n\n{announcement.Title}\n\n{announcement.Content}\n\nOpen FIU Global Portal to view the announcement.",
            MailPriority.High);
        RecordEmailDeliveryResult(announcement.AuthorId, announcement.AuthorName, "high_priority_announcement_email", sent);
    }

    private void SendDiningMenuEmailInternal(IEnumerable<DateOnly> dates)
    {
        var publishedDates = dates.Distinct().OrderBy(item => item).ToList();
        if (publishedDates.Count == 0) return;

        var dateSummary = string.Join(", ", publishedDates.Take(3).Select(item => item.ToString("MMMM d, yyyy", CultureInfo.InvariantCulture)));
        if (publishedDates.Count > 3) dateSummary += " and more";
        var recipients = _state.Users
            .Where(item => GetEffectiveSectionsForUser(item).Contains("dining-menu", StringComparer.OrdinalIgnoreCase))
            .Select(item => item.Email);
        var sent = SendEmailInternal(
            recipients,
            publishedDates.Count == 1 ? "New FIU Global dining menu" : "New FIU Global dining menus",
            $"A new dining menu is available for {dateSummary}.\n\nOpen FIU Global Portal to view the full menu and meal times.",
            MailPriority.Normal);
        RecordEmailDeliveryResult(null, "system", "dining_menu_email", sent);
    }

    private int SendEmailInternal(IEnumerable<string> emailAddresses, string subject, string body, MailPriority priority)
    {
        if (!IsSmtpConfigured(_state.Smtp))
        {
            return 0;
        }

        try
        {
            using var client = new SmtpClient(_state.Smtp.Host, _state.Smtp.Port)
            {
                EnableSsl = _state.Smtp.EnableSsl
            };
            if (!string.IsNullOrWhiteSpace(_state.Smtp.Username))
            {
                client.Credentials = new NetworkCredential(_state.Smtp.Username, _state.Smtp.Password);
            }

            var recipients = NormalizeEmailAddresses(emailAddresses);
            foreach (var recipient in recipients)
            {
                using var message = new MailMessage
                {
                    From = new MailAddress(_state.Smtp.FromEmail, _state.Smtp.FromName),
                    Subject = subject,
                    Body = body,
                    Priority = priority
                };
                if (priority == MailPriority.High)
                {
                    message.Headers.Add("X-Priority", "1");
                    message.Headers.Add("Importance", "High");
                }
                message.To.Add(recipient);
                client.Send(message);
            }
            return recipients.Count;
        }
        catch
        {
            // SMTP/provider diagnostics may contain recipient and server data.
            // Keep those details out of activity logs and API responses.
            return -1;
        }
    }

    private void RecordEmailDeliveryResult(int? actorId, string actorName, string action, int sent)
    {
        if (sent > 0)
        {
            AddActivityInternal(actorId, actorName, "admin", action, "Email notification sent");
        }
        else if (sent < 0)
        {
            AddActivityInternal(actorId, actorName, "admin", $"{action}_failed", "Email notification failed");
        }
        else if (!IsSmtpConfigured(_state.Smtp))
        {
            AddActivityInternal(actorId, actorName, "admin", $"{action}_skipped", "SMTP is not configured");
        }
    }

    private static bool IsSmtpConfigured(SmtpSettings smtp) =>
        !string.IsNullOrWhiteSpace(smtp.Host) && !string.IsNullOrWhiteSpace(smtp.FromEmail);

    private static List<string> NormalizeEmailAddresses(IEnumerable<string> emailAddresses)
    {
        var recipients = new List<string>();
        foreach (var candidate in emailAddresses.Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item.Trim()))
        {
            try
            {
                var parsed = new MailAddress(candidate);
                if (!recipients.Contains(parsed.Address, StringComparer.OrdinalIgnoreCase))
                {
                    recipients.Add(parsed.Address);
                }
            }
            catch (FormatException)
            {
                // A malformed profile email is skipped without exposing it in
                // logs; the account can be corrected through the profile form.
            }
        }

        return recipients;
    }

    private static bool PasswordMatches(string input, string stored)
    {
        return PasswordSecurity.Verify(input, stored).Success;
    }

    private static string NormalizeUserRole(string role) =>
        string.IsNullOrWhiteSpace(role) ? "student" : NormalizeRoleKey(role);

    private static bool IsStudentRole(string? role) =>
        string.Equals(NormalizeRoleKey(role ?? string.Empty), "student", StringComparison.OrdinalIgnoreCase);

    private static string FormatStudentNumber(int userId) => $"STU-{userId:000000}";

    private static string NormalizeRoleKey(string role)
    {
        var normalized = string.Join('-', role.Trim().ToLowerInvariant().Split([' ', '_'], StringSplitOptions.RemoveEmptyEntries));
        return new string(normalized.Where(character => char.IsLetterOrDigit(character) || character == '-').ToArray());
    }

    private static List<string> NormalizePlatformRoles(List<string>? roles)
    {
        var cleaned = (roles ?? ["student", "instructor"])
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Select(NormalizeRoleKey)
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return cleaned;
    }

    private static bool IsPlatformVisibleToRole(PlatformLink platform, string? role) =>
        !string.IsNullOrWhiteSpace(role) &&
        platform.VisibleToRoles?.Contains(NormalizeRoleKey(role), StringComparer.OrdinalIgnoreCase) == true;

    private static string NormalizePlatformImageUrl(string? value)
    {
        var candidate = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(candidate) || candidate.Equals("default", StringComparison.OrdinalIgnoreCase))
        {
            return "/img/fiu9-mark2.png";
        }

        if (candidate.StartsWith("/", StringComparison.Ordinal) && !candidate.StartsWith("//", StringComparison.Ordinal))
        {
            return candidate;
        }

        return Uri.TryCreate(candidate, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
            ? candidate
            : "/img/fiu9-mark2.png";
    }

    private static string DisplayName(UserAccount user)
    {
        var fullName = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim();
        return fullName.Length > 0 ? fullName : user.Username;
    }

    private bool CreateDiningMenuInternal(DateOnly date, Dictionary<string, object?> body, AdminAccount admin, bool recurring)
    {
        _state.DiningMenus.Add(new DiningMenuItem
        {
            Id = _state.Counters.NextDiningMenuId++,
            Date = date,
            DayOfWeek = date.DayOfWeek.ToString(),
            BreakfastMenu = body.GetString("breakfast_menu"),
            BreakfastStartTime = NormalizeTime(body.GetString("breakfast_start_time", "07:00")),
            BreakfastEndTime = NormalizeTime(body.GetString("breakfast_end_time", "09:00")),
            LunchMenu = body.GetString("lunch_menu"),
            LunchStartTime = NormalizeTime(body.GetString("lunch_start_time", "12:00")),
            LunchEndTime = NormalizeTime(body.GetString("lunch_end_time", "14:00")),
            IsRecurring = recurring,
            CreatedBy = admin.Id,
            CreatedByName = admin.Username,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        return true;
    }

    private int CreateRecurringMenus(DateOnly startDate, Dictionary<string, object?> body, AdminAccount admin, int weeksAhead)
    {
        var created = 0;
        for (var week = 1; week <= weeksAhead; week++)
        {
            var date = startDate.AddDays(week * 7);
            if (_state.DiningMenus.Any(item => item.Date == date) || GetHolidayOrWeekend(date) is not null)
            {
                continue;
            }

            if (CreateDiningMenuInternal(date, body, admin, true))
            {
                created++;
            }
        }

        return created;
    }

    private int CreateRecurringMenusForSelectedDates(DateOnly startDate, Dictionary<string, object?> body, AdminAccount admin, IEnumerable<DateOnly> selectedDates)
    {
        var created = 0;
        foreach (var date in selectedDates.Distinct().Order())
        {
            if (date <= startDate || _state.DiningMenus.Any(item => item.Date == date) || GetHolidayOrWeekend(date) is not null)
            {
                continue;
            }

            if (CreateDiningMenuInternal(date, body, admin, true))
            {
                created++;
            }
        }

        return created;
    }

    private static List<DateOnly> GetRecurringMenuDates(Dictionary<string, object?> body)
    {
        return body.GetStringList("recurring_dates")
            .Select(value => DateOnly.TryParse(value, out var date) ? (DateOnly?)date : null)
            .Where(date => date.HasValue)
            .Select(date => date!.Value)
            .Distinct()
            .ToList();
    }

    private int RemoveDiningMenusForHolidayDates(IEnumerable<DateOnly> holidayDates)
    {
        var dateSet = holidayDates.ToHashSet();
        return _state.DiningMenus.RemoveAll(menu => dateSet.Contains(menu.Date));
    }

    private bool TryBuildHoliday(Dictionary<string, object?> body, out HolidayItem holiday, out string error)
    {
        holiday = new HolidayItem();
        error = string.Empty;
        if (!TryParseDate(body.GetString("date"), out var date))
        {
            error = "Invalid date format";
            return false;
        }

        holiday.Date = date;
        holiday.Year = date.Year;
        holiday.DayOfWeek = date.DayOfWeek.ToString();
        holiday.HolidayName = body.GetString("holiday_name");
        holiday.Type = body.GetString("type", "holiday");
        holiday.Description = body.GetString("description");
        holiday.IsActive = body.GetBool("is_active", true);
        holiday.IsRecurring = body.GetBool("is_recurring");
        holiday.CreatedBy = body.GetInt("current_admin_id");
        var createdById = holiday.CreatedBy;
        holiday.CreatedByName = _state.Admins.FirstOrDefault(item => item.Id == createdById)?.Username;
        holiday.CreatedAt = DateTime.UtcNow;
        holiday.UpdatedAt = DateTime.UtcNow;

        if (string.IsNullOrWhiteSpace(holiday.HolidayName))
        {
            error = "Date and holiday name are required";
            return false;
        }

        return true;
    }

    private static bool TryParseDate(string? value, out DateOnly date)
    {
        if (DateOnly.TryParse(value, out date))
        {
            return true;
        }

        foreach (var format in new[] { "M/d/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "d/M/yyyy", "dd/MM/yyyy" })
        {
            if (DateTime.TryParseExact(value, format, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                date = DateOnly.FromDateTime(parsed);
                return true;
            }
        }

        return false;
    }

    private static bool TryParseFlexibleDate(string value, int fallbackYear, out DateOnly date)
    {
        if (DateOnly.TryParse(value, out date))
        {
            return true;
        }

        foreach (var format in new[] { "M/d/yyyy", "d/M/yyyy", "yyyy/M/d" })
        {
            if (DateTime.TryParseExact(value, format, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                date = DateOnly.FromDateTime(parsed);
                return true;
            }
        }

        var cleaned = value.Replace("st", "", StringComparison.OrdinalIgnoreCase)
            .Replace("nd", "", StringComparison.OrdinalIgnoreCase)
            .Replace("rd", "", StringComparison.OrdinalIgnoreCase)
            .Replace("th", "", StringComparison.OrdinalIgnoreCase);
        if (DateTime.TryParse($"{cleaned} {fallbackYear}", CultureInfo.InvariantCulture, DateTimeStyles.None, out var flexible))
        {
            date = DateOnly.FromDateTime(flexible);
            return true;
        }

        date = default;
        return false;
    }

    private static bool TryNormalizeDayName(string value, out string dayName)
    {
        dayName = string.Empty;
        var supplied = (value ?? string.Empty).Trim();
        if (supplied.Length < 3) return false;
        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            var candidate = day.ToString();
            if (candidate.Equals(supplied, StringComparison.OrdinalIgnoreCase) ||
                candidate.StartsWith(supplied, StringComparison.OrdinalIgnoreCase))
            {
                dayName = candidate;
                return true;
            }
        }
        return false;
    }

    private static string NormalizeTime(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "00:00:00";
        }

        return value.Length == 5 ? $"{value}:00" : value;
    }

    private static int GetLmsNumber(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            var host = uri.Host.Split('.')[0];
            if (host.StartsWith("lms", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(host[3..], out var number))
            {
                return number;
            }
        }

        return int.MaxValue;
    }

    private static object ToAnnouncementDto(AnnouncementItem item) => new
    {
        id = item.Id,
        title = item.Title,
        content = item.Content,
        author_id = item.AuthorId,
        author_name = item.AuthorName,
        created_by = item.AuthorName,
        is_active = item.IsActive,
        priority = item.Priority,
        target_audience = item.TargetAudience,
        created_at = item.CreatedAt,
        updated_at = item.UpdatedAt
    };

    private static int AnnouncementPriorityRank(string? priority) =>
        priority?.Trim().ToLowerInvariant() switch
        {
            "urgent" => 4,
            "high" => 3,
            "medium" => 2,
            "low" => 1,
            _ => 2
        };

    private static bool IsFinalEduEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Any(char.IsWhiteSpace)) return false;
        var at = email.LastIndexOf('@');
        return at > 0 && at == email.IndexOf('@') &&
               email[(at + 1)..].Equals("final.edu.tr", StringComparison.OrdinalIgnoreCase);
    }

    private static bool AnnouncementVisibleToRole(AnnouncementItem item, string role)
    {
        var target = (item.TargetAudience ?? "all").ToLowerInvariant();
        return target == "all" ||
               (target == "students" && role.Equals("student", StringComparison.OrdinalIgnoreCase)) ||
               (target == "instructors" && !role.Equals("student", StringComparison.OrdinalIgnoreCase));
    }

    private static object ToDiningMenuDto(DiningMenuItem item) => new
    {
        id = item.Id,
        date = item.Date.ToString("yyyy-MM-dd"),
        day_of_week = item.DayOfWeek,
        breakfast_menu = item.BreakfastMenu,
        breakfast_start_time = item.BreakfastStartTime,
        breakfast_end_time = item.BreakfastEndTime,
        lunch_menu = item.LunchMenu,
        lunch_start_time = item.LunchStartTime,
        lunch_end_time = item.LunchEndTime,
        is_recurring = item.IsRecurring,
        created_by = item.CreatedBy,
        created_by_name = item.CreatedByName,
        created_at = item.CreatedAt,
        updated_at = item.UpdatedAt
    };

    private static PlatformLink NewPlatform(int id, string name, string description, string url, string? notificationsUrl, List<string>? visibleToRoles = null) =>
        new()
        {
            Id = id,
            Section = name.Equals("LMS", StringComparison.OrdinalIgnoreCase) ? "LMS" : "Campus",
            Name = name,
            Description = description,
            Url = url,
            NotificationsUrl = notificationsUrl,
            VisibleToRoles = visibleToRoles ?? ["student", "instructor"],
            CreatedAt = DateTime.UtcNow.AddDays(-90)
        };

    private static LmsSubplatform NewLms(string name, string url) =>
        new()
        {
            Name = name,
            Url = url,
            LoginEndpoint = "/LMS/login/index.php",
            NotificationsEndpoint = "/LMS/message/output/popup/notifications.php"
        };

    private static DiningMenuItem NewDiningMenu(int id, DateOnly date, string breakfast, string lunch, bool recurring) =>
        new()
        {
            Id = id,
            Date = date,
            DayOfWeek = date.DayOfWeek.ToString(),
            BreakfastMenu = breakfast,
            BreakfastStartTime = "07:00:00",
            BreakfastEndTime = "09:00:00",
            LunchMenu = lunch,
            LunchStartTime = "12:00:00",
            LunchEndTime = "14:00:00",
            IsRecurring = recurring,
            CreatedBy = 1,
            CreatedByName = "admin",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };

    private static HolidayItem NewHoliday(int id, DateOnly date, string name, string type, string description) =>
        new()
        {
            Id = id,
            Date = date,
            Year = date.Year,
            DayOfWeek = date.DayOfWeek.ToString(),
            HolidayName = name,
            Type = type,
            Description = description,
            CreatedBy = 1,
            CreatedByName = "admin",
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow.AddDays(-10)
        };

    private static AdminAccount Clone(AdminAccount admin) => new()
    {
        Id = admin.Id,
        Username = admin.Username,
        // Never let a detached account object carry a password hash. All
        // password checks operate on the protected in-memory state instead.
        Password = string.Empty,
        Email = admin.Email,
        Role = admin.Role,
        IsActive = admin.IsActive,
        StudentNumber = admin.StudentNumber,
        FirstName = admin.FirstName,
        LastName = admin.LastName,
        ProfilePicture = admin.ProfilePicture,
        FacultyId = admin.FacultyId,
        DepartmentId = admin.DepartmentId,
        Faculty = admin.Faculty,
        Department = admin.Department,
        PreferredLanguage = LocalizationService.NormalizeLanguage(admin.PreferredLanguage),
        AllowedSections = admin.AllowedSections.ToList(),
        CreatedAt = admin.CreatedAt,
        LastLogin = admin.LastLogin
    };

    private static SmtpSettings Clone(SmtpSettings settings) => new()
    {
        Host = settings.Host,
        Port = settings.Port,
        Username = settings.Username,
        Password = settings.Password,
        FromEmail = settings.FromEmail,
        FromName = settings.FromName,
        EnableSsl = settings.EnableSsl
    };

    private static UserAccount Clone(UserAccount user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        // Never let a detached account object carry a password hash. All
        // password checks operate on the protected in-memory state instead.
        Password = string.Empty,
        Email = user.Email,
        Role = user.Role,
        StudentNumber = user.StudentNumber,
        FirstName = user.FirstName,
        LastName = user.LastName,
        ProfilePicture = user.ProfilePicture,
        FacultyId = user.FacultyId,
        DepartmentId = user.DepartmentId,
        Faculty = user.Faculty,
        Department = user.Department,
        PreferredLanguage = LocalizationService.NormalizeLanguage(user.PreferredLanguage),
        AllowedSections = user.AllowedSections.ToList(),
        SectionAccessConfigured = user.SectionAccessConfigured,
        SectionPermissions = CopySectionPermissions(user.SectionPermissions),
        CreatedAt = user.CreatedAt
    };

    private static object ToUserProfileDto(UserAccount user) => new
    {
        id = user.Id,
        username = user.Username,
        email = user.Email,
        role = user.Role,
        student_number = IsStudentRole(user.Role) ? user.StudentNumber : string.Empty,
        first_name = user.FirstName,
        last_name = user.LastName,
        profile_picture = user.ProfilePicture,
        faculty_id = user.FacultyId,
        department_id = user.DepartmentId,
        faculty = user.Faculty,
        department = user.Department,
        preferred_language = LocalizationService.NormalizeLanguage(user.PreferredLanguage)
    };

    private static object ToAdminProfileDto(AdminAccount admin) => new
    {
        id = admin.Id,
        username = admin.Username,
        email = admin.Email,
        role = admin.Role,
        student_number = string.Empty,
        first_name = admin.FirstName,
        last_name = admin.LastName,
        profile_picture = admin.ProfilePicture,
        faculty_id = admin.FacultyId,
        department_id = admin.DepartmentId,
        faculty = admin.Faculty,
        department = admin.Department,
        preferred_language = LocalizationService.NormalizeLanguage(admin.PreferredLanguage)
    };

    private static PlatformLink Clone(PlatformLink platform) => new()
    {
        Id = platform.Id,
        Section = platform.Section,
        Name = platform.Name,
        Description = platform.Description,
        Url = platform.Url,
        NotificationsUrl = platform.NotificationsUrl,
        ImageUrl = platform.ImageUrl,
        VisibleToRoles = platform.VisibleToRoles.ToList(),
        CreatedAt = platform.CreatedAt
    };

    private static NotificationItem Clone(NotificationItem notification) => new()
    {
        Id = notification.Id,
        Username = notification.Username,
        Platform = notification.Platform,
        Message = notification.Message,
        Url = notification.Url,
        Status = notification.Status,
        Date = notification.Date,
        Subplatform = notification.Subplatform,
        CreatedAt = notification.CreatedAt
    };

    private static LmsSubplatform Clone(LmsSubplatform item) => new()
    {
        Name = item.Name,
        Url = item.Url,
        LoginEndpoint = string.IsNullOrWhiteSpace(item.LoginEndpoint) ? "/LMS/login/index.php" : item.LoginEndpoint,
        NotificationsEndpoint = string.IsNullOrWhiteSpace(item.NotificationsEndpoint) ? "/LMS/message/output/popup/notifications.php" : item.NotificationsEndpoint
    };

    private static HolidayItem Clone(HolidayItem item) => new()
    {
        Id = item.Id,
        Date = item.Date,
        Year = item.Year,
        DayOfWeek = item.DayOfWeek,
        HolidayName = item.HolidayName,
        Type = item.Type,
        Description = item.Description,
        IsActive = item.IsActive,
        IsRecurring = item.IsRecurring,
        CreatedBy = item.CreatedBy,
        CreatedByName = item.CreatedByName,
        CreatedAt = item.CreatedAt,
        UpdatedAt = item.UpdatedAt
    };

    private static SessionInfo Clone(SessionInfo session) => new()
    {
        Token = session.Token,
        UserId = session.UserId,
        AdminId = session.AdminId,
        Username = session.Username,
        UserRole = session.UserRole,
        AdminRole = session.AdminRole,
        PreferredLanguage = session.PreferredLanguage,
        LastSeenAt = session.LastSeenAt,
        ExpiresAt = session.ExpiresAt
    };
}

internal static class PayloadExtensions
{
    public static string GetString(this Dictionary<string, object?> body, string key, string fallback = "")
    {
        if (!body.TryGetValue(key, out var value) || value is null)
        {
            return fallback;
        }

        return value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.String => element.GetString() ?? fallback,
            JsonElement element => element.ToString(),
            _ => value.ToString() ?? fallback
        };
    }

    public static int GetInt(this Dictionary<string, object?> body, string key, int fallback = 0)
    {
        if (!body.TryGetValue(key, out var value) || value is null)
        {
            return fallback;
        }

        return value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out var number) => number,
            JsonElement element when int.TryParse(element.ToString(), out var number) => number,
            _ when int.TryParse(value.ToString(), out var number) => number,
            _ => fallback
        };
    }

    public static bool GetBool(this Dictionary<string, object?> body, string key, bool fallback = false)
    {
        if (!body.TryGetValue(key, out var value) || value is null)
        {
            return fallback;
        }

        return value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.True => true,
            JsonElement element when element.ValueKind == JsonValueKind.False => false,
            JsonElement element when bool.TryParse(element.ToString(), out var flag) => flag,
            JsonElement element when int.TryParse(element.ToString(), out var numeric) => numeric == 1,
            _ when bool.TryParse(value.ToString(), out var flag) => flag,
            _ when int.TryParse(value.ToString(), out var numeric) => numeric == 1,
            _ => fallback
        };
    }

    public static List<string> GetStringList(this Dictionary<string, object?> body, string key)
    {
        if (!body.TryGetValue(key, out var value) || value is null)
        {
            return [];
        }

        if (value is JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.Array)
            {
                return element.EnumerateArray()
                    .Select(item => item.GetString() ?? string.Empty)
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .ToList();
            }

            return element.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }

        return value.ToString()?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? [];
    }

    public static List<int> GetIntList(this Dictionary<string, object?> body, string key)
    {
        if (!body.TryGetValue(key, out var value) || value is not JsonElement element || element.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return element.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out _))
            .Select(item => item.GetInt32())
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    public static T? ToPayload<T>(this Dictionary<string, object?> body)
    {
        var node = new JsonObject();
        foreach (var pair in body)
        {
            node[pair.Key] = pair.Value switch
            {
                null => null,
                JsonElement element => JsonNode.Parse(element.GetRawText()),
                _ => JsonValue.Create(pair.Value)
            };
        }

        return node.Deserialize<T>();
    }
}
