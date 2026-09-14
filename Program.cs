using FiuGlobal.DotNet.Models;
using FiuGlobal.DotNet.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;
using System.Globalization;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

const string SessionCookieName = "LeaveRms.Session";
var googleAuthStates = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.Ordinal);

// Resolve the project/publish root before creating the host.  A compiled
// executable is often launched from bin/publish, while .env and wwwroot live
// beside the project output.  Supplying these paths through WebApplicationOptions
// avoids the unsupported WebHost.UseWebRoot mutation that can crash apphost.exe.
var startupWebRoot = FindDirectory("wwwroot", Environment.CurrentDirectory);
var startupContentRoot = startupWebRoot is null
    ? Environment.CurrentDirectory
    : Directory.GetParent(startupWebRoot)?.FullName ?? Environment.CurrentDirectory;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = startupContentRoot,
    WebRootPath = startupWebRoot
});
LoadDotEnv(FindDotEnv(builder.Environment.ContentRootPath));
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10 * 1024 * 1024;
});
builder.Services.AddSingleton<LocalizationService>();
builder.Services.AddSingleton<AppDataStore>();
builder.Services.AddHostedService<ChatReminderService>();

var app = builder.Build();
var store = app.Services.GetRequiredService<AppDataStore>();
var localizer = app.Services.GetRequiredService<LocalizationService>();

app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

// Keep a missing or temporarily stopped database from terminating the
// executable. The app remains alive and returns a clear retryable response
// until the configured database becomes available again.
app.Use(async (context, next) =>
{
    if (RequiresDatabase(context.Request.Path) && !store.TryReconnect())
    {
        await WriteDatabaseUnavailable(context, localizer);
        return;
    }

    await next();
});

app.Use(async (context, next) =>
{
    var token = context.Request.Cookies[SessionCookieName];
    var session = store.GetSession(token);
    if (session is not null)
    {
        context.Items["Session"] = session;
    }

    var path = context.Request.Path.Value ?? "/";
    if (path.Equals("/login.html", StringComparison.OrdinalIgnoreCase) && session is not null)
    {
        context.Response.Redirect(GetDashboardPath(session));
        return;
    }

    if (path.Equals("/admin-panel.html", StringComparison.OrdinalIgnoreCase) ||
        path.Equals("/index.html", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.Redirect(session is null ? "/login.html" : GetDashboardPath(session));
        return;
    }

    if (path.Equals("/admin_dashboard", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/admin_dashboard/", StringComparison.OrdinalIgnoreCase))
    {
        // A person can legitimately have both a portal-user record and an
        // administrator role. Google sign-in resolves that role from the
        // database, so do not reject the administrator destination merely
        // because the same email also has a user account.
        if (session is null || !session.IsAdmin)
        {
            context.Response.Redirect("/login.html");
            return;
        }
    }
    else if (path.Equals("/student_dashboard", StringComparison.OrdinalIgnoreCase) ||
             path.StartsWith("/student_dashboard/", StringComparison.OrdinalIgnoreCase))
    {
        // Both portal shells are available to every authenticated user. The
        // effective role/capabilities determine which sections are shown; a
        // custom role must not be redirected back to login just because it
        // uses the student shell as its default landing page.
        if (session is null || !session.IsUser)
        {
            context.Response.Redirect("/login.html");
            return;
        }
    }
    else if (path.Equals("/instructor_dashboard", StringComparison.OrdinalIgnoreCase) ||
             path.StartsWith("/instructor_dashboard/", StringComparison.OrdinalIgnoreCase))
    {
        if (session is null || !session.IsUser)
        {
            context.Response.Redirect("/login.html");
            return;
        }
    }
    else if (path.Equals("/archive", StringComparison.OrdinalIgnoreCase))
    {
        if (session is null || !session.IsUser)
        {
            context.Response.Redirect("/login.html");
            return;
        }
    }

    await next();
});

app.Map("/ws/chat", branch =>
{
    branch.Run(context => HandleChatWebSocket(context, store, localizer));
});

app.MapGet("/auth/session", (HttpContext context, AppDataStore dataStore) =>
{
    var session = GetSessionInfo(context);
    if (session is null)
    {
        return Results.Unauthorized();
    }

    var user = session.UserId.HasValue ? dataStore.GetUserById(session.UserId.Value) : null;
    var admin = session.AdminId.HasValue ? dataStore.GetAdminById(session.AdminId.Value) : null;

    return Results.Json(new
    {
        authenticated = true,
        session = new
        {
            username = session.Username,
            is_user = session.IsUser,
            is_admin = session.IsAdmin,
            is_super_admin = session.IsSuperAdmin,
            user_role = session.UserRole,
            admin_role = session.AdminRole,
            language = session.PreferredLanguage
        },
        user = user is null ? null : new
        {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            role = user.Role,
            student_number = user.StudentNumber,
            first_name = user.FirstName,
            last_name = user.LastName,
            profile_picture = user.ProfilePicture,
            faculty_id = user.FacultyId,
            department_id = user.DepartmentId,
            faculty = user.Faculty,
            department = user.Department,
            preferred_language = user.PreferredLanguage,
            created_at = user.CreatedAt,
            allowed_sections = dataStore.GetAllowedSectionsForUser(user.Id),
            section_permissions = dataStore.GetSectionPermissionsForUser(user.Id)
        },
        admin = admin is null ? null : new
        {
            id = admin.Id,
            username = admin.Username,
            email = admin.Email,
            role = admin.Role,
            is_active = admin.IsActive,
            student_number = admin.StudentNumber,
            first_name = admin.FirstName,
            last_name = admin.LastName,
            profile_picture = admin.ProfilePicture,
            faculty_id = admin.FacultyId,
            department_id = admin.DepartmentId,
            faculty = admin.Faculty,
            department = admin.Department,
            preferred_language = admin.PreferredLanguage,
            created_at = admin.CreatedAt,
            last_login = admin.LastLogin
        }
    });
});

app.MapPost("/auth/logout", (HttpContext context, AppDataStore dataStore) =>
{
    var token = context.Request.Cookies[SessionCookieName];
    dataStore.RemoveSession(token);
    context.Response.Cookies.Delete(SessionCookieName);
    return Results.Json(new { success = true });
});

// The client language selector updates this cookie without changing the
// authenticated session. It also persists the preference for background email
// and notification work when an account is signed in.
app.MapPost("/auth/language", async (HttpContext context, AppDataStore dataStore) =>
{
    var payload = await context.Request.ReadFromJsonAsync<LanguagePreferenceRequest>();
    if (payload is null || !localizer.IsSupportedLanguage(payload.Language))
    {
        return LocalizedApi.Error(context, localizer, StatusCodes.Status400BadRequest, "api.language.unsupported");
    }

    var language = LocalizationService.NormalizeLanguage(payload.Language);
    context.Response.Cookies.Append(LocalizationService.LanguageCookieName, language, new CookieOptions
    {
        // The selected interface language is not sensitive. Keeping it
        // readable lets the existing browser selector use it as a fallback
        // when localStorage has been cleared.
        HttpOnly = false,
        IsEssential = true,
        SameSite = SameSiteMode.Lax,
        Secure = ShouldUseSecureCookies(context.Request),
        Expires = DateTimeOffset.UtcNow.AddYears(1)
    });

    var session = GetSessionInfo(context);
    if (session is not null)
    {
        dataStore.UpdatePreferredLanguage(session, language);
    }

    return LocalizedApi.Success(context, localizer, "api.language.updated", new Dictionary<string, object?>
    {
        ["language"] = language
    }, language: language);
});

app.MapGet("/auth/google/login", (HttpContext context) =>
{
    var clientId = GetEnv("GOOGLE_CLIENT_ID");
    var redirectUri = GetGoogleRedirectUri(context.Request);
    if (!IsValidGoogleClientId(clientId) || !Uri.TryCreate(redirectUri, UriKind.Absolute, out _))
    {
        return Results.Redirect("/login.html?error=google_config");
    }

    var state = Guid.NewGuid().ToString("N");
    CleanupGoogleAuthStates(googleAuthStates);
    googleAuthStates[state] = DateTimeOffset.UtcNow.AddMinutes(10);
    context.Response.Cookies.Append("GoogleAuth.State", state, new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        Secure = ShouldUseSecureCookies(context.Request),
        Expires = DateTimeOffset.UtcNow.AddMinutes(10)
    });

    var url = "https://accounts.google.com/o/oauth2/v2/auth" +
        $"?client_id={Uri.EscapeDataString(clientId)}" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        "&response_type=code" +
        "&scope=openid%20email%20profile" +
        "&hd=final.edu.tr" +
        "&include_granted_scopes=true" +
        $"&state={Uri.EscapeDataString(state)}";

    return Results.Redirect(url);
});

app.MapGet("/auth/google/callback", async (HttpContext context, AppDataStore dataStore) =>
{
    var expectedState = context.Request.Cookies["GoogleAuth.State"];
    var state = context.Request.Query["state"].ToString();
    var code = context.Request.Query["code"].ToString();
    var hasValidCookieState = !string.IsNullOrWhiteSpace(expectedState) && expectedState == state;
    var hasValidServerState = googleAuthStates.TryRemove(state, out var stateExpiresAt) && stateExpiresAt > DateTimeOffset.UtcNow;
    if (string.IsNullOrWhiteSpace(state) || string.IsNullOrWhiteSpace(code) || (!hasValidCookieState && !hasValidServerState))
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        app.Logger.LogWarning("Google login rejected before token exchange: invalid state or missing code.");
        return Results.Redirect("/login.html?error=google");
    }

    var (email, exchangeError) = await ExchangeGoogleCodeForEmail(context.Request, code);
    if (string.IsNullOrWhiteSpace(email))
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        app.Logger.LogWarning("Google login token/profile exchange failed: {Reason}", exchangeError ?? "unknown_error");
        var errorCode = exchangeError switch
        {
            "google_oauth_env_missing_or_invalid" => "google_config",
            "google_network" => "google_network",
            "google_timeout" => "google_timeout",
            _ => "google_exchange"
        };
        return Results.Redirect($"/login.html?error={errorCode}");
    }

    if (!email.EndsWith("@final.edu.tr", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        app.Logger.LogWarning("Google login rejected for non-final.edu.tr account: {Email}", email);
        return Results.Redirect("/login.html?error=final_domain_required");
    }

    var (user, admin) = dataStore.FindAccountByEmail(email);
    if (admin is not null && user is null)
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        var session = dataStore.CreateAdminSession(admin);
        SetSessionCookie(context.Response, session.Token);
        return Results.Redirect(GetDashboardPath(session));
    }

    if (user is not null)
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        var session = dataStore.CreateUserSession(user, admin);
        SetSessionCookie(context.Response, session.Token);
        return Results.Redirect(GetDashboardPath(session));
    }

    var newGoogleUser = dataStore.CreateGoogleStudentAccount(email);
    if (newGoogleUser is not null)
    {
        context.Response.Cookies.Delete("GoogleAuth.State");
        var session = dataStore.CreateUserSession(newGoogleUser);
        SetSessionCookie(context.Response, session.Token);
        app.Logger.LogInformation("Google login provisioned new student account for {Email}", email);
        return Results.Redirect(GetDashboardPath(session));
    }

    context.Response.Cookies.Delete("GoogleAuth.State");
    app.Logger.LogWarning("Google login rejected because no portal account exists for {Email}", email);
    return Results.Redirect("/login.html?error=unauthorized_google");
});

app.MapGet("/rms_auth_bridge.php", () =>
    Results.Redirect("https://rms.fnlsrv.website/publicHome.php"));

app.MapMethods("/database/api.php", new[] { "GET", "POST" }, async (HttpRequest request) =>
{
    var endpoint = request.Query["endpoint"].ToString();

    if (request.Method == HttpMethods.Post && endpoint == "login")
    {
        var payload = await request.ReadFromJsonAsync<LoginRequest>();
        if (payload is null || string.IsNullOrWhiteSpace(payload.Username) || string.IsNullOrWhiteSpace(payload.Password))
        {
            return LocalizedApi.Error(request.HttpContext, localizer, StatusCodes.Status400BadRequest, "api.auth.credentialsRequired");
        }

        var user = store.ValidateUser(payload.Username, payload.Password);
        if (user is null)
        {
            return LocalizedApi.Error(request.HttpContext, localizer, StatusCodes.Status401Unauthorized, "api.auth.invalidCredentials");
        }

        var admin = store.ValidateAdmin(payload.Username, payload.Password);
        var session = store.CreateUserSession(user, admin);
        SetSessionCookie(request.HttpContext.Response, session.Token);

        return Results.Json(new
        {
            success = true,
            user = new
            {
                id = user.Id,
                username = user.Username,
                email = user.Email,
                role = user.Role,
                student_number = user.StudentNumber,
                first_name = user.FirstName,
                last_name = user.LastName,
                profile_picture = user.ProfilePicture,
                faculty_id = user.FacultyId,
                department_id = user.DepartmentId,
                faculty = user.Faculty,
                department = user.Department,
                preferred_language = user.PreferredLanguage,
                created_at = user.CreatedAt,
                allowed_sections = store.GetAllowedSectionsForUser(user.Id),
                section_permissions = store.GetSectionPermissionsForUser(user.Id)
            },
            admin = admin is null ? null : SanitizeAdmin(admin),
            language = session.PreferredLanguage,
            platforms = store.GetPlatformsForUser(user.Id)
        });
    }

    var userSession = GetSessionInfo(request.HttpContext);
    if (endpoint != "login" && (userSession is null || !userSession.IsUser))
    {
        return Results.Unauthorized();
    }
    var role = userSession?.UserRole ?? "guest";

    if (!IsUserEndpointAllowed(endpoint, role, store, userSession?.UserId))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    if (endpoint == "dining-menu-import" && request.Method == HttpMethods.Post && request.HasFormContentType)
    {
        if (userSession?.UserId is not int userId || !HasUserSectionPart(store, userId, "dining-menu", "import"))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        return await HandleDiningMenuUserUpload(await request.ReadFormAsync(), store, userId);
    }

    if (endpoint == "dining-menu-delete" && request.Method == HttpMethods.Post)
    {
        if (userSession?.UserId is not int userId || !HasUserSectionPart(store, userId, "dining-menu", "remove"))
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var body = await request.ReadFromJsonAsync<Dictionary<string, object?>>() ?? new();
        var deleted = store.DeleteDiningMenu(body.GetInt("id"));
        return deleted
            ? Results.Json(new { success = true, message = "Dining menu removed successfully" })
            : Results.BadRequest(new { success = false, error = "Dining menu was not found" });
    }

    if (endpoint == "profile" && request.Method == HttpMethods.Get)
    {
        var profile = userSession!.UserId.HasValue ? store.GetUserProfile(userSession.UserId.Value) : null;
        return profile is null ? Results.NotFound(new { error = "Profile not found" }) : Results.Json(new { success = true, profile });
    }

    if (request.Method == HttpMethods.Post && endpoint == "profile-picture-upload" && request.HasFormContentType)
    {
        if (!userSession!.UserId.HasValue) return Results.Unauthorized();
        var form = await request.ReadFormAsync();
        return await HandleProfilePictureUpload(form, userSession.UserId.Value, false, store, app.Environment);
    }

    if (request.Method == HttpMethods.Post && endpoint is "profile-update" or "change-password")
    {
        var body = await request.ReadFromJsonAsync<Dictionary<string, object?>>() ?? new();
        if (!userSession!.UserId.HasValue) return Results.Unauthorized();
        if (endpoint == "profile-update")
        {
            var update = store.UpdateUserProfile(userSession.UserId.Value, body);
            return update.Success
                ? Results.Json(new { success = true, message = "Profile updated successfully" })
                : Results.BadRequest(new { error = update.Error ?? "Unable to update profile" });
        }
        var changed = store.ChangeUserPasswordWithCurrent(userSession.UserId.Value, body.GetString("current_password"), body.GetString("new_password"), out var error);
        return changed ? Results.Json(new { success = true, message = "Password changed successfully" }) : Results.BadRequest(new { error });
    }

    if (endpoint == "notifications" &&
        !request.Query["username"].ToString().Equals(userSession!.Username, StringComparison.OrdinalIgnoreCase))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    return endpoint switch
    {
        "platforms" => Results.Json(new { success = true, platforms = userSession?.UserId.HasValue == true ? store.GetPlatformsForUser(userSession.UserId.Value) : store.GetPlatforms(role) }),
        "announcements" => Results.Json(new { success = true, announcements = store.GetActiveAnnouncements() }),
        "archive" => Results.Json(new { success = true, archive = store.GetArchiveForRole(role) }),
        "chat-users" => Results.Json(new { success = true, users = userSession?.UserId.HasValue == true ? store.GetUsersForChat(userSession.UserId.Value) : [] }),
        "chat-history" => HandleChatHistory(request, store, userSession?.UserId),
        "faculty-departments" => Results.Json(new { success = true, faculties = store.GetFacultyDepartments() }),
        "most-accessed-platforms" => Results.Json(new { success = true, platforms = userSession?.UserId.HasValue == true ? store.GetMostAccessedPlatformsForUser(userSession.UserId.Value) : [] }),
        "dining-menu-month" => HandleDiningMenuMonth(request, store),
        "dining-menu-today" => HandleDiningMenuToday(request, store),
        "notifications" => Results.Json(new
        {
            success = true,
            notifications = store.GetNotifications(request.Query["username"].ToString())
        }),
        "lms_subplatforms" => Results.Json(new { success = true, subplatforms = store.GetLmsSubplatforms() }),
        "lms_subplatform_direct_link" => HandleLmsDirectLink(request, store),
        "activity-track" => HandleActivityTrack(request, store),
        _ => Results.NotFound(new { error = "Endpoint not found" })
    };
});

app.MapMethods("/database/admin_api.php", new[] { "GET", "POST" }, async (HttpRequest request) =>
{
    var existingSession = GetSessionInfo(request.HttpContext);
    if (request.Method == HttpMethods.Get)
    {
        if (existingSession is null || !existingSession.IsAdmin)
        {
            return Results.Unauthorized();
        }

        var endpoint = request.Query["endpoint"].ToString();
        return endpoint switch
        {
            "dashboard-stats" => Results.Json(new { success = true, stats = store.GetDashboardStats() }),
            "admin-list" => HandleAdminList(request, store),
            "users-list" => Results.Json(new { success = true, users = store.GetUsersForAdmin() }),
            "platforms-list" => Results.Json(new { success = true, platforms = store.GetPlatforms() }),
            "faculty-departments-list" => HandleFacultyDepartmentsList(request, store),
            "announcement-list" => Results.Json(new { success = true, announcements = store.GetAnnouncementsForAdmin() }),
            "dining-menu-list" => Results.Json(new { success = true, dining_menus = store.GetDiningMenus() }),
            "holiday-list" => Results.Json(new
            {
                success = true,
                year = DateTime.UtcNow.Year,
                holidays = store.GetHolidaysByYear(ParseInt(request.Query["year"], DateTime.UtcNow.Year)).Select(ToHolidayDto)
            }),
            "check-date-availability" => HandleDateAvailability(request, store),
            "holiday-export" => HandleHolidayExport(request, store),
            "holiday-template" => HandleHolidayTemplate(request),
            "dining-menu-template" => HandleDiningMenuTemplate(),
            "dining-menu-export" => HandleDiningMenuExport(request, store),
            "admin-by-username" => HandleAdminByUsername(request, store),
            "role-access" => Results.Json(new { success = true, access = store.GetRoleSectionAccess(), parts = store.GetRoleSectionParts() }),
            "user-role-access-list" => Results.Json(new { success = true, users = store.GetUserRoleAccess() }),
            "profile" => HandleAdminProfile(request, store),
            "role-access-template" => Results.File(BuildRoleAccessTemplateWorkbook(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "role_access_template.xlsx"),
            _ => Results.NotFound(new { error = "Endpoint not found" })
        };
    }

    if (request.HasFormContentType)
    {
        if (existingSession is null || !existingSession.IsAdmin)
        {
            return Results.Unauthorized();
        }

        var form = await request.ReadFormAsync();
        var formAction = form["action"].ToString();
        if (formAction == "holiday-upload")
        {
            return await HandleHolidayUpload(form, store);
        }


        if (formAction == "holiday-preview")
        {
            return await HandleHolidayPreview(form, store);
        }

        if (formAction == "admin-profile-picture-upload")
        {
            if (!existingSession.AdminId.HasValue) return Results.Unauthorized();
            return await HandleProfilePictureUpload(form, existingSession.AdminId.Value, true, store, app.Environment);
        }

        if (formAction == "platform-image-upload")
        {
            if (!existingSession.IsSuperAdmin) return Results.StatusCode(StatusCodes.Status403Forbidden);
            return await HandlePlatformImageUpload(form, store, app.Environment);
        }

        if (formAction == "dining-menu-upload")
        {
            return await HandleDiningMenuUpload(form, store);
        }

        if (formAction == "role-access-upload")
        {
            return await HandleRoleAccessUpload(form, store);
        }
    }

    var body = await request.ReadFromJsonAsync<Dictionary<string, object?>>() ?? new Dictionary<string, object?>();
    if (body.TryGetValue("action", out var actionValue) is false &&
        !string.IsNullOrWhiteSpace(body.GetString("username")) &&
        !string.IsNullOrWhiteSpace(body.GetString("password")))
    {
        var admin = store.ValidateAdmin(body.GetString("username"), body.GetString("password"));
        if (admin is null)
        {
            return Results.Unauthorized();
        }

        var user = store.ValidateUser(body.GetString("username"), body.GetString("password"));
        var session = user is not null ? store.CreateUserSession(user, admin) : store.CreateAdminSession(admin);
        SetSessionCookie(request.HttpContext.Response, session.Token);
        return Results.Json(new { success = true, admin = SanitizeAdmin(admin) });
    }

    if (existingSession is null || !existingSession.IsSuperAdmin)
    {
        return Results.Unauthorized();
    }

    var action = body.GetString("action");
    return action switch
    {
        "admin-login" => HandleAdminLogin(body, store),
        "admin-create" => HandleAdminCreate(body, store),
        "admin-update" => HandleAdminUpdate(body, store),
        "admin-delete" => HandleAdminDelete(body, store),
        "admin-change-password" => HandleAdminPassword(body, store),
        "user-create" => HandleUserCreate(body, store),
        "user-update" => HandleUserUpdate(body, store),
        "user-delete" => HandleUserDelete(body, store),
        "user-change-password" => HandleUserPassword(body, store),
        "user-promote-to-admin" => HandlePromoteUser(body, store),
        "admin-demote-to-user" => HandleDemoteAdmin(body, store),
        "platform-create" => HandlePlatformCreate(body, store),
        "platform-update" => HandlePlatformUpdate(body, store),
        "platform-delete" => HandlePlatformDelete(body, store),
        "faculty-create" => HandleFacultyCreate(body, store),
        "faculty-update" => HandleFacultyUpdate(body, store),
        "faculty-delete" => HandleFacultyDelete(body, store),
        "department-create" => HandleDepartmentCreate(body, store),
        "department-update" => HandleDepartmentUpdate(body, store),
        "department-delete" => HandleDepartmentDelete(body, store),
        "role-access-update" => HandleRoleAccessUpdate(body, store),
        "role-create" => HandleRoleCreate(body, store),
        "user-role-access-update" => HandleUserRoleAccessUpdate(body, store),
        "role-access-apply-users" => HandleRoleAccessApplyUsers(body, store),
        "role-access-apply-all-roles" => HandleRoleAccessApplyAllRoles(body, store),
        "user-role-access-apply-all-users" => HandleUserRoleAccessApplyAllUsers(body, store),
        "admin-profile-update" => HandleAdminProfileUpdate(request.HttpContext, body, store),
        "admin-change-password-current" => HandleAdminChangePasswordCurrent(request.HttpContext, body, store),
        "announcement-create" => HandleAnnouncementCreate(body, store),
        "announcement-update" => HandleAnnouncementUpdate(body, store),
        "announcement-delete" => HandleAnnouncementDelete(body, store),
        "dining-menu-create" => HandleDiningMenuCreate(body, store),
        "dining-menu-update" => HandleDiningMenuUpdate(body, store),
        "dining-menu-delete" => HandleDiningMenuDelete(body, store),
        "holiday-create" => HandleHolidayCreate(body, store),
        "holiday-update" => HandleHolidayUpdate(body, store),
        "holiday-delete" => HandleHolidayDelete(body, store),
        "holiday-delete-by-year" => HandleHolidayDeleteByYear(body, store),
        _ => Results.NotFound(new { error = "Endpoint not found" })
    };
});

app.UseDefaultFiles();
app.MapGet("/login", () => Results.Redirect("/login.html"));
app.MapGet("/admin_dashboard", (IWebHostEnvironment environment) =>
    Results.File(Path.Combine(environment.WebRootPath, "admin-panel.html"), "text/html"));
app.MapGet("/admin_dashboard/{section}", (IWebHostEnvironment environment, string section) =>
    Results.File(Path.Combine(environment.WebRootPath, "admin-panel.html"), "text/html"));
app.MapGet("/student_dashboard", (IWebHostEnvironment environment) =>
    Results.File(Path.Combine(environment.WebRootPath, "index.html"), "text/html"));
app.MapGet("/student_dashboard/{section}", (IWebHostEnvironment environment, string section) =>
    Results.File(Path.Combine(environment.WebRootPath, "index.html"), "text/html"));
app.MapGet("/instructor_dashboard", (IWebHostEnvironment environment) =>
    Results.File(Path.Combine(environment.WebRootPath, "index.html"), "text/html"));
app.MapGet("/instructor_dashboard/{section}", (IWebHostEnvironment environment, string section) =>
    Results.File(Path.Combine(environment.WebRootPath, "index.html"), "text/html"));
app.MapGet("/archive", (IWebHostEnvironment environment) =>
    Results.File(Path.Combine(environment.WebRootPath, "archive.html"), "text/html"));
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        context.Context.Response.Headers.Pragma = "no-cache";
        context.Context.Response.Headers.Expires = "0";
    }
});
app.MapGet("/", () => Results.Redirect("/login.html"));
app.Run();

static string GetDashboardPath(SessionInfo session)
{
    if (session.IsSuperAdmin)
    {
        return "/admin_dashboard";
    }

    if (session.IsAdmin)
    {
        return "/admin_dashboard";
    }

    if (session.IsUser)
    {
        // Every non-administrator account uses the same portal dashboard. The
        // role-access policy controls which sections and platforms are shown;
        // the shell itself is intentionally consistent for every account.
        return "/student_dashboard";
    }

    return "/login.html?error=invalid_role";
}

static bool IsUserEndpointAllowed(string endpoint, string role, AppDataStore store, int? userId = null)
{
    var section = endpoint switch
    {
        "platforms" or "lms_subplatforms" or "lms_subplatform_direct_link" => "platforms",
        "announcements" => "announcements",
        "archive" => null,
        "dining-menu-month" or "dining-menu-today" or "dining-menu-import" or "dining-menu-delete" => "dining-menu",
        "notifications" => "notifications",
        "activity-track" => null,
        _ => null
    };

    return section is null || (userId.HasValue ? store.GetAllowedSectionsForUser(userId.Value) : store.GetAllowedSectionsForRole(role)).Contains(section, StringComparer.OrdinalIgnoreCase);
}

static bool HasUserSectionPart(AppDataStore store, int userId, string section, string part)
{
    var permissions = store.GetSectionPermissionsForUser(userId);
    return permissions.TryGetValue(section, out var parts) &&
           parts.Any(value => value.Equals(part, StringComparison.OrdinalIgnoreCase));
}

static IResult HandleChatHistory(HttpRequest request, AppDataStore store, int? userId)
{
    if (!userId.HasValue || !int.TryParse(request.Query["contact_id"].ToString(), out var contactId))
    {
        return Results.BadRequest(new { success = false, error = "A valid chat contact is required." });
    }

    if (!store.CanChatWith(userId.Value, contactId))
    {
        return Results.BadRequest(new { success = false, error = "That chat contact is unavailable." });
    }

    return Results.Json(new
    {
        success = true,
        messages = store.GetChatHistory(userId.Value, contactId)
    });
}

static IResult HandleDiningMenuToday(HttpRequest request, AppDataStore store)
{
    var dateValue = request.Query["date"].ToString();
    if (!DateOnly.TryParse(dateValue, out var date))
    {
        date = DateOnly.FromDateTime(DateTime.Today);
    }

    var menu = store.GetDiningMenuByDate(date);
    return menu is null
        ? Results.Json(new { success = false, error = "Dining menu not found" })
        : Results.Json(new { success = true, dining_menu = menu });
}

static IResult HandleDiningMenuMonth(HttpRequest request, AppDataStore store)
{
    var year = ParseInt(request.Query["year"], DateTime.UtcNow.Year);
    var month = ParseInt(request.Query["month"], DateTime.UtcNow.Month);
    if (year is < 2000 or > 2200 || month is < 1 or > 12)
    {
        return Results.BadRequest(new { success = false, error = "A valid year and month are required." });
    }

    return Results.Json(new
    {
        success = true,
        year,
        month,
        dining_menus = store.GetDiningMenuDtosByMonth(year, month)
    });
}

static async Task HandleChatWebSocket(HttpContext context, AppDataStore store, LocalizationService localizer)
{
    var session = GetSessionInfo(context);
    if (session?.IsUser != true || !session.UserId.HasValue)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }

    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var user = store.GetUserById(session.UserId.Value);
    if (user is null)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }

    var language = localizer.ResolveLanguage(context.Request);

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    var connectionId = Guid.NewGuid();
    ChatHub.Add(user.Id, connectionId, socket);
    await ChatHub.SendAsync(user.Id, new
    {
        type = "ready",
        user_id = user.Id,
        name = string.Join(" ", new[] { user.FirstName, user.LastName }.Where(value => !string.IsNullOrWhiteSpace(value))).Trim() is { Length: > 0 } displayName
            ? displayName
            : user.Username
    });

    try
    {
        var buffer = new byte[4096];
        while (socket.State == WebSocketState.Open)
        {
            using var message = new MemoryStream();
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(buffer, context.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    return;
                }

                message.Write(buffer, 0, result.Count);
            }
            while (!result.EndOfMessage);

            if (result.MessageType != WebSocketMessageType.Text) continue;
            using var document = JsonDocument.Parse(message.ToArray());
            var root = document.RootElement;
            if (!root.TryGetProperty("type", out var type)) continue;

            if (string.Equals(type.GetString(), "receipt", StringComparison.OrdinalIgnoreCase))
            {
                var messageId = root.TryGetProperty("message_id", out var messageIdElement) ? messageIdElement.GetString() : null;
                var receiptStatus = root.TryGetProperty("status", out var statusElement) ? statusElement.GetString() : null;
                if (string.IsNullOrWhiteSpace(messageId) ||
                    (!string.Equals(receiptStatus, "received", StringComparison.OrdinalIgnoreCase) &&
                     !string.Equals(receiptStatus, "seen", StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                var update = store.UpdateChatMessageStatus(user.Id, messageId, string.Equals(receiptStatus, "seen", StringComparison.OrdinalIgnoreCase));
                if (update is not null)
                {
                    var statusPayload = new
                    {
                        type = "message-status",
                        message_id = update.MessageId,
                        sender_id = update.SenderId,
                        recipient_id = update.RecipientId,
                        status = update.SeenAt.HasValue ? "seen" : "received",
                        received_at = update.ReceivedAt,
                        seen_at = update.SeenAt
                    };
                    await ChatHub.SendAsync(update.SenderId, statusPayload);
                    await ChatHub.SendAsync(update.RecipientId, statusPayload);
                }
                continue;
            }

            if (!string.Equals(type.GetString(), "message", StringComparison.OrdinalIgnoreCase)) continue;
            if (!root.TryGetProperty("recipient_id", out var recipientElement) || !recipientElement.TryGetInt32(out var recipientId)) continue;
            var text = root.TryGetProperty("text", out var textElement) ? textElement.GetString()?.Trim() : null;
            if (string.IsNullOrWhiteSpace(text)) continue;
            if (text.Length > 2000) text = text[..2000];

            var recipient = store.GetUserById(recipientId);
            if (recipient is null || recipient.Id == user.Id || string.IsNullOrWhiteSpace(recipient.Role))
            {
                await ChatHub.SendAsync(user.Id, new
                {
                    type = "error",
                    message = localizer.Translate(language, "api.chat.recipientUnavailable"),
                    message_key = "api.chat.recipientUnavailable",
                    message_args = new Dictionary<string, object?>()
                });
                continue;
            }

            object? payload;
            try
            {
                payload = store.AddChatMessage(user.Id, recipient.Id, text);
            }
            catch
            {
                await ChatHub.SendAsync(user.Id, new
                {
                    type = "error",
                    message = localizer.Translate(language, "api.chat.messageSaveFailed"),
                    message_key = "api.chat.messageSaveFailed",
                    message_args = new Dictionary<string, object?>()
                });
                continue;
            }

            if (payload is null)
            {
                await ChatHub.SendAsync(user.Id, new
                {
                    type = "error",
                    message = localizer.Translate(language, "api.chat.messageSaveFailed"),
                    message_key = "api.chat.messageSaveFailed",
                    message_args = new Dictionary<string, object?>()
                });
                continue;
            }

            await ChatHub.SendAsync(user.Id, payload);
            await ChatHub.SendAsync(recipient.Id, payload);
        }
    }
    catch (OperationCanceledException)
    {
    }
    catch (WebSocketException)
    {
    }
    finally
    {
        ChatHub.Remove(user.Id, connectionId);
    }
}

static IResult HandleLmsDirectLink(HttpRequest request, AppDataStore store)
{
    var subplatform = request.Query["subplatform"].ToString();
    var item = store.GetLmsSubplatforms().FirstOrDefault(x => x.Name.Equals(subplatform, StringComparison.OrdinalIgnoreCase))
        ?? store.GetLmsSubplatforms().First();

    return Results.Json(new { success = true, url = new Uri(new Uri(item.Url), item.LoginEndpoint).ToString() });
}

static IResult HandleActivityTrack(HttpRequest request, AppDataStore store)
{
    var session = GetSessionInfo(request.HttpContext);
    if (session is null)
    {
        return Results.Unauthorized();
    }

    store.TrackActivity(session.Username, session.UserRole, request.Query["action"].ToString(), request.Query["detail"].ToString());
    return Results.Json(new { success = true });
}

static IResult HandleAdminList(HttpRequest request, AppDataStore store)
{
    var session = GetSessionInfo(request.HttpContext);
    if (session is null || !session.IsSuperAdmin)
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    return Results.Json(new { success = true, admins = store.GetManageableAdmins() });
}

static IResult HandleDateAvailability(HttpRequest request, AppDataStore store)
{
    var dateValue = request.Query["date"].ToString();
    if (!DateOnly.TryParse(dateValue, out var date))
    {
        return Results.BadRequest(new { error = "Date parameter is required" });
    }

    var holiday = store.GetHolidayOrWeekend(date);
    if (holiday is null)
    {
        return Results.Json(new { success = true, available = true, message = "Date is available for dining menu" });
    }

    return Results.Json(new
    {
        success = true,
        available = false,
        holiday,
        message = holiday.Type == "weekend"
            ? "Date is not available: Weekend (Saturday/Sunday)"
            : $"Date is not available: {holiday.HolidayName}"
    });
}

static IResult HandleHolidayExport(HttpRequest request, AppDataStore store)
{
    var year = ParseInt(request.Query["year"], DateTime.Today.Year);
    var holidays = store.GetHolidaysByYear(year);
    if (request.Query["format"].ToString().Equals("xlsx", StringComparison.OrdinalIgnoreCase))
    {
        var rows = holidays.Select(item => new HolidayCsvRow(
            item.Date.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture),
            item.DayOfWeek,
            item.HolidayName));
        return Results.File(
            BuildHolidayWorkbook(rows),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"holidays_{year}.xlsx");
    }

    var builder = new StringBuilder();
    builder.AppendLine("Date,DayOfWeek,HolidayName,Type,Description,IsRecurring");
    foreach (var holiday in holidays)
    {
        builder.AppendLine($"{holiday.Date:yyyy-MM-dd},{holiday.DayOfWeek},{EscapeCsv(holiday.HolidayName)},{holiday.Type},{EscapeCsv(holiday.Description ?? string.Empty)},{(holiday.IsRecurring ? "Yes" : "No")}");
    }

    return Results.File(Encoding.UTF8.GetBytes(builder.ToString()), "text/csv", $"holidays_{year}.csv");
}

static IResult HandleHolidayTemplate(HttpRequest request)
{
    var year = ParseInt(request.Query["year"], DateTime.Today.Year);
    var first = new DateOnly(year, 1, 1);
    var second = new DateOnly(year, 1, 15);
    var rows = new List<HolidayCsvRow>
    {
        new(first.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture), first.DayOfWeek.ToString(), "New Year's Day"),
        new(second.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture), second.DayOfWeek.ToString(), "University Closure")
    };
    if (request.Query["format"].ToString().Equals("xlsx", StringComparison.OrdinalIgnoreCase))
    {
        return Results.File(
            BuildHolidayWorkbook(rows),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"holiday_template_{year}.xlsx");
    }

    var content = new StringBuilder()
        .AppendLine("Date,DayOfWeek,HolidayName")
        .AppendLine($"{rows[0].Date},{rows[0].DayOfWeek},{EscapeCsv(rows[0].HolidayName)}")
        .AppendLine($"{rows[1].Date},{rows[1].DayOfWeek},{EscapeCsv(rows[1].HolidayName)}")
        .ToString();

    return Results.File(Encoding.UTF8.GetBytes(content), "text/csv", $"holiday_template_{year}.csv");
}

static byte[] BuildHolidayWorkbook(IEnumerable<HolidayCsvRow> holidayRows)
{
    var rows = holidayRows.ToList();
    using var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
    {
        AddZipEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>
            """);
        AddZipEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>
            """);
        AddZipEntry(archive, "xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Holidays" sheetId="1" r:id="rId1"/></sheets></workbook>
            """);
        AddZipEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>
            """);

        var lastRow = Math.Max(1, rows.Count + 1);
        var worksheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">")
            .Append("<dimension ref=\"A1:C").Append(lastRow).Append("\"/><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><cols><col min=\"1\" max=\"1\" width=\"16\" customWidth=\"1\"/><col min=\"2\" max=\"2\" width=\"16\" customWidth=\"1\"/><col min=\"3\" max=\"3\" width=\"34\" customWidth=\"1\"/></cols><sheetData>");
        var headers = new[] { "Date", "DayOfWeek", "HolidayName" };
        worksheet.Append("<row r=\"1\">");
        for (var column = 0; column < headers.Length; column++) AppendInlineStringCell(worksheet, column, 1, headers[column]);
        worksheet.Append("</row>");
        for (var index = 0; index < rows.Count; index++)
        {
            var rowNumber = index + 2;
            var values = new[] { rows[index].Date, rows[index].DayOfWeek, rows[index].HolidayName };
            worksheet.Append($"<row r=\"{rowNumber}\">");
            for (var column = 0; column < values.Length; column++) AppendInlineStringCell(worksheet, column, rowNumber, values[column]);
            worksheet.Append("</row>");
        }
        worksheet.Append("</sheetData><autoFilter ref=\"A1:C").Append(lastRow).Append("\"/></worksheet>");
        AddZipEntry(archive, "xl/worksheets/sheet1.xml", worksheet.ToString());
    }
    return stream.ToArray();
}

static IResult HandleDiningMenuTemplate()
{
    return Results.File(
        BuildDiningTemplateWorkbook(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "dining_menu_import_template.xlsx");
}

static byte[] BuildRoleAccessTemplateWorkbook()
{
    using var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
    {
        AddZipEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>
            """);
        AddZipEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>
            """);
        AddZipEntry(archive, "xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Role Access" sheetId="1" r:id="rId1"/></sheets></workbook>
            """);
        AddZipEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>
            """);
        var worksheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><dimension ref=\"A1:C2\"/><sheetData>");
        var headers = new[] { "student num", "platform", "active or inactive" };
        worksheet.Append("<row r=\"1\">");
        for (var i = 0; i < headers.Length; i++) AppendInlineStringCell(worksheet, i, 1, headers[i], 0);
        worksheet.Append("</row><row r=\"2\">");
        var sample = new[] { "STU-000001", "AIS", "active" };
        for (var i = 0; i < sample.Length; i++) AppendInlineStringCell(worksheet, i, 2, sample[i], 0);
        worksheet.Append("</row></sheetData><autoFilter ref=\"A1:C2\"/></worksheet>");
        AddZipEntry(archive, "xl/worksheets/sheet1.xml", worksheet.ToString());
    }
    return stream.ToArray();
}

static byte[] BuildDiningTemplateWorkbook()
{
    using var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
    {
        AddZipEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
              <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
            </Types>
            """);
        AddZipEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddZipEntry(archive, "xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets><sheet name="Dining Menu Template" sheetId="1" r:id="rId1"/></sheets>
            </workbook>
            """);
        AddZipEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            </Relationships>
            """);
        AddZipEntry(archive, "xl/styles.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <fonts count="2">
                <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
                <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
              </fonts>
              <fills count="3">
                <fill><patternFill patternType="none"/></fill>
                <fill><patternFill patternType="gray125"/></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>
              </fills>
              <borders count="2">
                <border><left/><right/><top/><bottom/><diagonal/></border>
                <border>
                  <left style="thin"><color rgb="FFD9E2F3"/></left>
                  <right style="thin"><color rgb="FFD9E2F3"/></right>
                  <top style="thin"><color rgb="FFD9E2F3"/></top>
                  <bottom style="thin"><color rgb="FFD9E2F3"/></bottom>
                  <diagonal/>
                </border>
              </borders>
              <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
              <cellXfs count="3">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
              </cellXfs>
              <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
            </styleSheet>
            """);

        var worksheet = new StringBuilder()
            .Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
            .Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">")
            .Append("<dimension ref=\"A1:G2\"/>")
            .Append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>")
            .Append("<sheetFormatPr defaultRowHeight=\"18\"/>")
            .Append("<cols>")
            .Append("<col min=\"1\" max=\"1\" width=\"18\" customWidth=\"1\"/>")
            .Append("<col min=\"2\" max=\"2\" width=\"30\" customWidth=\"1\"/>")
            .Append("<col min=\"3\" max=\"4\" width=\"22\" customWidth=\"1\"/>")
            .Append("<col min=\"5\" max=\"5\" width=\"34\" customWidth=\"1\"/>")
            .Append("<col min=\"6\" max=\"7\" width=\"20\" customWidth=\"1\"/>")
            .Append("</cols><sheetData>");

        var headers = new[]
        {
            "Date (MM/DD/YYYY)", "Breakfast Menu", "Breakfast Start Time", "Breakfast End Time",
            "Lunch Menu", "Lunch Start Time", "Lunch End Time"
        };
        worksheet.Append("<row r=\"1\" ht=\"32\" customHeight=\"1\">");
        for (var column = 0; column < headers.Length; column++)
        {
            AppendInlineStringCell(worksheet, column, 1, headers[column], 1);
        }
        worksheet.Append("</row>");

        var sampleValues = new[]
        {
            DateTime.Today.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture),
            "Eggs, olives and bread",
            "07:00",
            "09:00",
            "Chicken wrap and soup",
            "12:00",
            "14:00"
        };
        worksheet.Append("<row r=\"2\" ht=\"30\" customHeight=\"1\">");
        for (var column = 0; column < sampleValues.Length; column++)
        {
            AppendInlineStringCell(worksheet, column, 2, sampleValues[column], 2);
        }
        worksheet.Append("</row></sheetData><autoFilter ref=\"A1:G2\"/></worksheet>");
        AddZipEntry(archive, "xl/worksheets/sheet1.xml", worksheet.ToString());
    }

    return stream.ToArray();
}

static IResult HandleDiningMenuExport(HttpRequest request, AppDataStore store)
{
    var year = ParseInt(request.Query["year"], DateTime.Today.Year);
    var month = ParseInt(request.Query["month"], DateTime.Today.Month);
    if (month is < 1 or > 12)
    {
        return Results.BadRequest(new { error = "Month must be between 1 and 12" });
    }

    var menus = store.GetDiningMenusByMonth(year, month);
    var workbook = BuildDiningWorkbook(menus, year, month);
    return Results.File(
        workbook,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        $"dining_menu_{year}_{month:00}.xlsx");
}

static byte[] BuildDiningWorkbook(IReadOnlyCollection<DiningMenuItem> menus, int year, int month)
{
    using var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
    {
        AddZipEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
            </Types>
            """);
        AddZipEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddZipEntry(archive, "xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets><sheet name="Dining Menu" sheetId="1" r:id="rId1"/></sheets>
            </workbook>
            """);
        AddZipEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            </Relationships>
            """);

        var worksheet = new StringBuilder()
            .Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
            .Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        var headers = new[]
        {
            "Date", "Day of Week", "Breakfast Menu", "Breakfast Start Time", "Breakfast End Time",
            "Lunch Menu", "Lunch Start Time", "Lunch End Time", "Recurring"
        };
        worksheet.Append("<row r=\"1\">");
        for (var column = 0; column < headers.Length; column++)
        {
            AppendInlineStringCell(worksheet, column, 1, headers[column]);
        }
        worksheet.Append("</row>");

        var rowNumber = 2;
        foreach (var menu in menus.OrderBy(item => item.Date))
        {
            var values = new[]
            {
                menu.Date.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture),
                menu.DayOfWeek,
                menu.BreakfastMenu,
                menu.BreakfastStartTime,
                menu.BreakfastEndTime,
                menu.LunchMenu,
                menu.LunchStartTime,
                menu.LunchEndTime,
                menu.IsRecurring ? "Yes" : "No"
            };
            worksheet.Append($"<row r=\"{rowNumber}\">");
            for (var column = 0; column < values.Length; column++)
            {
                AppendInlineStringCell(worksheet, column, rowNumber, values[column]);
            }
            worksheet.Append("</row>");
            rowNumber++;
        }

        worksheet.Append("</sheetData></worksheet>");
        AddZipEntry(archive, "xl/worksheets/sheet1.xml", worksheet.ToString());
    }

    return stream.ToArray();
}

static void AddZipEntry(ZipArchive archive, string path, string content)
{
    var entry = archive.CreateEntry(path, CompressionLevel.Fastest);
    using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
    writer.Write(content);
}

static void AppendInlineStringCell(StringBuilder worksheet, int columnIndex, int rowNumber, string? value, int styleIndex = 0)
{
    var styleAttribute = styleIndex > 0 ? $" s=\"{styleIndex}\"" : string.Empty;
    worksheet.Append($"<c r=\"{ExcelColumnName(columnIndex)}{rowNumber}\"{styleAttribute} t=\"inlineStr\"><is><t xml:space=\"preserve\">");
    worksheet.Append(System.Security.SecurityElement.Escape(value ?? string.Empty));
    worksheet.Append("</t></is></c>");
}

static string ExcelColumnName(int columnIndex)
{
    var name = string.Empty;
    for (var value = columnIndex + 1; value > 0; value = (value - 1) / 26)
    {
        name = (char)('A' + ((value - 1) % 26)) + name;
    }
    return name;
}

static IResult HandleAdminByUsername(HttpRequest request, AppDataStore store)
{
    var username = request.Query["username"].ToString();
    var admin = store.GetAdminByUsername(username);
    return admin is null
        ? Results.Json(new { success = false })
        : Results.Json(new { success = true, admin = SanitizeAdmin(admin) });
}

static async Task<IResult> HandleProfilePictureUpload(IFormCollection form, int accountId, bool isAdmin, AppDataStore store, IWebHostEnvironment environment)
{
    var file = form.Files["file"];
    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { success = false, error = "Choose a profile picture to upload." });
    }
    if (file.Length > 5 * 1024 * 1024)
    {
        return Results.BadRequest(new { success = false, error = "Profile pictures must be 5MB or smaller." });
    }

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (extension is not ".jpg" and not ".jpeg" and not ".png" and not ".webp" and not ".gif")
    {
        return Results.BadRequest(new { success = false, error = "Upload a JPG, PNG, WebP or GIF image." });
    }

    await using var memory = new MemoryStream();
    await file.CopyToAsync(memory);
    var bytes = memory.ToArray();
    if (!HasSupportedImageSignature(bytes, extension))
    {
        return Results.BadRequest(new { success = false, error = "The selected file is not a valid image." });
    }

    var uploadDirectory = Path.Combine(environment.WebRootPath, "uploads", "profiles");
    Directory.CreateDirectory(uploadDirectory);
    var safeExtension = extension == ".jpeg" ? ".jpg" : extension;
    var fileName = $"{(isAdmin ? "admin" : "user")}-{accountId}-{Guid.NewGuid():N}{safeExtension}";
    var fullPath = Path.Combine(uploadDirectory, fileName);
    await File.WriteAllBytesAsync(fullPath, bytes);
    var pictureUrl = $"/uploads/profiles/{fileName}";
    var updated = isAdmin
        ? store.UpdateAdminProfilePicture(accountId, pictureUrl)
        : store.UpdateUserProfilePicture(accountId, pictureUrl);
    if (!updated)
    {
        File.Delete(fullPath);
        return Results.BadRequest(new { success = false, error = "The account could not be updated." });
    }
    return Results.Json(new { success = true, profile_picture = pictureUrl, message = "Profile picture uploaded successfully." });
}

static async Task<IResult> HandlePlatformImageUpload(IFormCollection form, AppDataStore store, IWebHostEnvironment environment)
{
    var platformId = ParseInt(form["platform_id"].ToString(), 0);
    var file = form.Files["file"];
    if (platformId <= 0 || file is null || file.Length == 0)
    {
        return Results.BadRequest(new { success = false, error = "Choose a platform and image to upload." });
    }
    if (file.Length > 5 * 1024 * 1024)
    {
        return Results.BadRequest(new { success = false, error = "Platform images must be 5MB or smaller." });
    }

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (extension is not ".jpg" and not ".jpeg" and not ".png" and not ".webp" and not ".gif")
    {
        return Results.BadRequest(new { success = false, error = "Upload a JPG, PNG, WebP or GIF image." });
    }

    await using var memory = new MemoryStream();
    await file.CopyToAsync(memory);
    var bytes = memory.ToArray();
    if (!HasSupportedImageSignature(bytes, extension))
    {
        return Results.BadRequest(new { success = false, error = "The selected file is not a valid image." });
    }

    var uploadDirectory = Path.Combine(environment.WebRootPath, "uploads", "platforms");
    Directory.CreateDirectory(uploadDirectory);
    var safeExtension = extension == ".jpeg" ? ".jpg" : extension;
    var fileName = $"platform-{platformId}-{Guid.NewGuid():N}{safeExtension}";
    var fullPath = Path.Combine(uploadDirectory, fileName);
    await File.WriteAllBytesAsync(fullPath, bytes);
    var imageUrl = $"/uploads/platforms/{fileName}";
    if (!store.UpdatePlatformImage(platformId, imageUrl))
    {
        File.Delete(fullPath);
        return Results.BadRequest(new { success = false, error = "The platform could not be updated." });
    }

    return Results.Json(new { success = true, image_url = imageUrl, message = "Platform image uploaded successfully." });
}

static bool HasSupportedImageSignature(byte[] bytes, string extension)
{
    if (bytes.Length < 12) return false;
    return extension switch
    {
        ".jpg" or ".jpeg" => bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF,
        ".png" => bytes.Take(8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        ".gif" => Encoding.ASCII.GetString(bytes, 0, 6) is "GIF87a" or "GIF89a",
        ".webp" => Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        _ => false
    };
}

static async Task<IResult> HandleHolidayUpload(IFormCollection form, AppDataStore store)
{
    var adminId = ParseInt(form["current_admin_id"], 0);
    if (!store.AdminExists(adminId))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var year = ParseInt(form["year"], DateTime.Today.Year);
    var rows = new List<HolidayCsvRow>();
    var parseErrors = new List<string>();
    var rowsJson = form["rows_json"].ToString();
    if (!string.IsNullOrWhiteSpace(rowsJson))
    {
        try
        {
            rows = JsonSerializer.Deserialize<List<HolidayCsvRow>>(rowsJson, new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                PropertyNameCaseInsensitive = true
            }) ?? [];
        }
        catch (JsonException)
        {
            parseErrors.Add("The editable holiday table contains invalid data.");
        }
    }
    else
    {
        var file = form.Files["file"];
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { success = false, error = "Add holiday rows or choose a CSV/Excel file." });
        }
        var parsed = await ReadHolidayRows(file);
        rows = parsed.Rows;
        parseErrors.AddRange(parsed.Errors);
    }

    if (parseErrors.Count > 0)
    {
        return Results.Json(new { success = false, imported = 0, errors = parseErrors });
    }

    var result = store.ImportHolidays(year, rows, adminId);
    return Results.Json(new
    {
        success = result.Errors.Count == 0,
        message = result.Errors.Count == 0 ? "Holiday schedule imported successfully" : "Nothing was imported. Fix the highlighted rows and try again.",
        imported = result.Imported,
        errors = result.Errors,
        deleted_menus = result.DeletedMenus
    });
}

static async Task<IResult> HandleHolidayPreview(IFormCollection form, AppDataStore store)
{
    var adminId = ParseInt(form["current_admin_id"], 0);
    if (!store.AdminExists(adminId)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var file = form.Files["file"];
    if (file is null || file.Length == 0) return Results.BadRequest(new { success = false, error = "Choose a CSV or Excel file." });
    var parsed = await ReadHolidayRows(file);
    return Results.Json(new
    {
        success = parsed.Errors.Count == 0,
        rows = parsed.Rows.Select(row => new { date = row.Date, day_of_week = row.DayOfWeek, holiday_name = row.HolidayName }),
        errors = parsed.Errors
    });
}

static async Task<(List<HolidayCsvRow> Rows, List<string> Errors)> ReadHolidayRows(IFormFile file)
{
    var rows = new List<HolidayCsvRow>();
    var errors = new List<string>();
    if (file.Length > 10 * 1024 * 1024)
    {
        return (rows, ["The file is larger than 10MB."]);
    }

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (extension == ".xlsx")
    {
        try
        {
            var sourceRows = ReadSimpleRowsFromXlsx(file);
            for (var index = 0; index < sourceRows.Count; index++)
            {
                var values = sourceRows[index];
                if (values.Count < 3)
                {
                    errors.Add($"Row {index + 2}: expected Date, DayOfWeek and HolidayName.");
                    continue;
                }
                var dateValue = values[0];
                if (double.TryParse(dateValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var serial) && serial is > 20000 and < 60000)
                {
                    dateValue = DateTime.FromOADate(serial).ToString("MM/dd/yyyy", CultureInfo.InvariantCulture);
                }
                rows.Add(new HolidayCsvRow(dateValue.Trim(), values[1].Trim(), values[2].Trim()));
            }
            return (rows, errors);
        }
        catch (Exception)
        {
            return (rows, ["The Excel file could not be read. Use the downloaded .xlsx template."]);
        }
    }

    if (extension != ".csv")
    {
        return (rows, ["Unsupported file type. Upload a CSV or Excel (.xlsx) file."]);
    }

    using var reader = new StreamReader(file.OpenReadStream());
    string? line;
    var lineIndex = 0;
    while ((line = await reader.ReadLineAsync()) is not null)
    {
        lineIndex++;
        if (lineIndex == 1 || string.IsNullOrWhiteSpace(line)) continue;
        var columns = ParseCsvLine(line);
        if (columns.Count < 3)
        {
            errors.Add($"Row {lineIndex}: expected Date, DayOfWeek and HolidayName.");
            continue;
        }
        rows.Add(new HolidayCsvRow(columns[0].Trim(), columns[1].Trim(), columns[2].Trim()));
    }
    return (rows, errors);
}

static async Task<IResult> HandleDiningMenuUpload(IFormCollection form, AppDataStore store)
{
    var adminId = ParseInt(form["current_admin_id"], 0);
    if (!store.AdminExists(adminId))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var file = form.Files["file"];
    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "File is required" });
    }
    if (file.Length > 10 * 1024 * 1024)
    {
        return Results.BadRequest(new { error = "The file is larger than 10MB." });
    }

    var rows = new List<DiningMenuImportRow>();
    if (Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
    {
        rows.AddRange(ReadDiningRowsFromXlsx(file));
    }
    else
    {
        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        string? line;
        var lineIndex = 0;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            lineIndex++;
            if (lineIndex == 1 || string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var columns = ParseCsvLine(line);
            if (columns.Count < 7)
            {
                continue;
            }

            rows.Add(new DiningMenuImportRow(columns[0], columns[1], columns[2], columns[3], columns[4], columns[5], columns[6]));
        }
    }

    var overwriteConflicts = string.Equals(form["overwrite_conflicts"].ToString(), "true", StringComparison.OrdinalIgnoreCase);
    var result = store.ImportDiningMenus(rows, adminId, overwriteConflicts);
    return Results.Json(new { success = true, imported = result.Imported, errors = result.Errors, skipped = result.Skipped, conflicts = result.Conflicts, has_conflicts = result.Conflicts.Count > 0 });
}

static async Task<IResult> HandleDiningMenuUserUpload(IFormCollection form, AppDataStore store, int userId)
{
    var file = form.Files["file"];
    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "File is required" });
    }
    if (file.Length > 10 * 1024 * 1024)
    {
        return Results.BadRequest(new { error = "The file is larger than 10MB." });
    }

    var rows = new List<DiningMenuImportRow>();
    var errors = new List<string>();
    if (Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            rows.AddRange(ReadDiningRowsFromXlsx(file));
        }
        catch (Exception)
        {
            errors.Add("The Excel file could not be read. Use the downloaded .xlsx template.");
        }
    }
    else if (Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
    {
        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        string? line;
        var lineIndex = 0;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            lineIndex++;
            if (lineIndex == 1 || string.IsNullOrWhiteSpace(line)) continue;
            var columns = ParseCsvLine(line);
            if (columns.Count < 7)
            {
                errors.Add($"Row {lineIndex}: expected Date, BreakfastMenu, BreakfastStartTime, BreakfastEndTime, LunchMenu, LunchStartTime and LunchEndTime.");
                continue;
            }
            rows.Add(new DiningMenuImportRow(columns[0], columns[1], columns[2], columns[3], columns[4], columns[5], columns[6]));
        }
    }
    else
    {
        return Results.BadRequest(new { error = "Unsupported file type. Upload a CSV or Excel (.xlsx) file." });
    }

    var overwriteConflicts = string.Equals(form["overwrite_conflicts"].ToString(), "true", StringComparison.OrdinalIgnoreCase);
    var result = store.ImportDiningMenusForUser(rows, userId, overwriteConflicts);
    return Results.Json(new
    {
        success = result.Errors.Count == 0 || result.Imported > 0,
        imported = result.Imported,
        errors = errors.Concat(result.Errors).ToList(),
        skipped = result.Skipped,
        conflicts = result.Conflicts,
        has_conflicts = result.Conflicts.Count > 0
    });
}

static async Task<IResult> HandleRoleAccessUpload(IFormCollection form, AppDataStore store)
{
    var adminId = ParseInt(form["current_admin_id"], 0);
    if (!store.IsSuperAdmin(adminId)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var file = form.Files["file"];
    if (file is null || file.Length == 0) return Results.BadRequest(new { error = "Choose an Excel or CSV file" });
    var rows = new List<(string StudentNumber, string Platform, bool IsActive)>();
    var parseErrors = new List<string>();
    if (Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
    {
        foreach (var values in ReadSimpleRowsFromXlsx(file))
        {
            if (values.Count < 3) { parseErrors.Add("A row must contain student num, platform, and active or inactive"); continue; }
            if (!TryParseAccessStatus(values[2], out var active)) { parseErrors.Add($"Invalid status '{values[2]}'. Use active or inactive"); continue; }
            rows.Add((values[0], values[1], active));
        }
    }
    else
    {
        using var reader = new StreamReader(file.OpenReadStream());
        string? line; var lineIndex = 0;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            lineIndex++;
            if (lineIndex == 1 || string.IsNullOrWhiteSpace(line)) continue;
            var values = ParseCsvLine(line);
            if (values.Count < 3) { parseErrors.Add("A row must contain student num, platform, and active or inactive"); continue; }
            if (!TryParseAccessStatus(values[2], out var active)) { parseErrors.Add($"Invalid status '{values[2]}'. Use active or inactive"); continue; }
            rows.Add((values[0], values[1], active));
        }
    }
    var result = store.ImportUserPlatformAccess(rows);
    return Results.Json(new { success = true, imported = result.Imported, errors = parseErrors.Concat(result.Errors).ToList(), message = $"Imported {result.Imported} access rows" });
}

static bool TryParseAccessStatus(string value, out bool active)
{
    active = value.Equals("active", StringComparison.OrdinalIgnoreCase) || value.Equals("true", StringComparison.OrdinalIgnoreCase) || value.Equals("1", StringComparison.OrdinalIgnoreCase);
    return active || value.Equals("inactive", StringComparison.OrdinalIgnoreCase) || value.Equals("false", StringComparison.OrdinalIgnoreCase) || value.Equals("0", StringComparison.OrdinalIgnoreCase);
}

static IResult HandleAdminLogin(Dictionary<string, object?> body, AppDataStore store)
{
    var username = body.GetString("username");
    var password = body.GetString("password");
    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
    {
        return Results.BadRequest(new { error = "Username and password are required" });
    }

    var admin = store.ValidateAdmin(username, password);
    return admin is null
        ? Results.Unauthorized()
        : Results.Json(new { success = true, admin });
}

static IResult HandleAdminCreate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var username = body.GetString("username");
    var password = body.GetString("password");
    var email = body.GetString("email");

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(email))
    {
        return Results.BadRequest(new { error = "Username, password, and email are required" });
    }

    var created = store.CreateAdmin(username, email, password);
    return created
        ? Results.Json(new { success = true, message = "Admin created successfully" })
        : Results.BadRequest(new { error = "Failed to create admin. Username might already exist." });
}

static IResult HandleAdminUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var updated = store.UpdateAdmin(body.GetInt("id"), body.GetString("username"), body.GetString("email"));
    return updated
        ? Results.Json(new { success = true, message = "Admin updated successfully" })
        : Results.BadRequest(new { error = "Failed to update admin" });
}

static IResult HandleAdminDelete(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var deleted = store.DeleteAdmin(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "Admin deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete admin" });
}

static IResult HandleAdminPassword(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var updated = store.ChangeAdminPassword(body.GetInt("id"), body.GetString("new_password"));
    return updated
        ? Results.Json(new { success = true, message = "Password changed successfully" })
        : Results.BadRequest(new { error = "Failed to change password" });
}

static IResult HandleUserCreate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var result = store.CreateUser(body.GetString("username"), body.GetString("email"), body.GetString("password"), body.GetString("role", "student"));
    return result.Success
        ? Results.Json(new { success = true, message = "User created successfully" })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleUserUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var result = store.UpdateUser(body.GetInt("id"), body.GetString("username"), body.GetString("email"), body.GetString("role", "student"));
    return result.Success
        ? Results.Json(new { success = true, message = "User updated successfully" })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleUserDelete(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var deleted = store.DeleteUser(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "User deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete user" });
}

static IResult HandleUserPassword(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var updated = store.ChangeUserPassword(body.GetInt("id"), body.GetString("new_password"));
    return updated
        ? Results.Json(new { success = true, message = "Password changed successfully" })
        : Results.BadRequest(new { error = "Failed to change password" });
}

static IResult HandlePromoteUser(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var promoted = store.PromoteUserToAdmin(body.GetString("username"));
    return promoted
        ? Results.Json(new { success = true, message = "User promoted to admin successfully" })
        : Results.BadRequest(new { error = "Failed to promote user" });
}

static IResult HandleDemoteAdmin(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var demoted = store.DemoteAdminToUser(body.GetString("username"));
    return demoted
        ? Results.Json(new { success = true, message = "Admin demoted to user successfully" })
        : Results.BadRequest(new { error = "Failed to demote admin" });
}

static IResult HandlePlatformCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var created = store.CreatePlatform(
        body.GetString("section", "Campus"),
        body.GetString("name"),
        body.GetString("url"),
        body.GetString("description"),
        body.GetString("notifications_url"),
        body.GetStringList("visible_to_roles"),
        body.GetString("image_url"));

    return created
        ? Results.Json(new { success = true, message = "Platform created successfully" })
        : Results.BadRequest(new { error = "Name and a valid http/https link are required" });
}

static IResult HandlePlatformUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var updated = store.UpdatePlatform(
        body.GetInt("id"),
        body.GetString("section", "Campus"),
        body.GetString("name"),
        body.GetString("url"),
        body.GetString("description"),
        body.GetString("notifications_url"),
        body.GetStringList("visible_to_roles"),
        body.GetString("image_url"));

    return updated
        ? Results.Json(new { success = true, message = "Platform updated successfully" })
        : Results.BadRequest(new { error = "Name and a valid http/https link are required" });
}

static IResult HandlePlatformDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var deleted = store.DeletePlatform(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "Platform deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete platform" });
}

static IResult HandleFacultyDepartmentsList(HttpRequest request, AppDataStore store)
{
    var session = GetSessionInfo(request.HttpContext);
    if (session is null || !session.IsSuperAdmin) return Results.StatusCode(StatusCodes.Status403Forbidden);
    return Results.Json(new { success = true, faculties = store.GetFacultyDepartments(includeInactive: true) });
}

static IResult HandleFacultyCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.CreateFaculty(body.GetString("name"));
    return result.Success ? Results.Json(new { success = true, message = "Faculty created." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleFacultyUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.UpdateFaculty(body.GetInt("id"), body.GetString("name"), body.GetBool("is_active", true));
    return result.Success ? Results.Json(new { success = true, message = "Faculty updated." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleFacultyDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.DeleteFaculty(body.GetInt("id"));
    return result.Success ? Results.Json(new { success = true, message = "Faculty deleted." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleDepartmentCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.CreateDepartment(body.GetInt("faculty_id"), body.GetString("name"));
    return result.Success ? Results.Json(new { success = true, message = "Department created." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleDepartmentUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.UpdateDepartment(body.GetInt("id"), body.GetInt("faculty_id"), body.GetString("name"), body.GetBool("is_active", true));
    return result.Success ? Results.Json(new { success = true, message = "Department updated." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleDepartmentDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.DeleteDepartment(body.GetInt("id"));
    return result.Success ? Results.Json(new { success = true, message = "Department deleted." }) : Results.BadRequest(new { error = result.Error });
}

static IResult HandleRoleAccessUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var node = body.TryGetValue("access", out var raw) && raw is JsonElement element ? element : default;
    if (node.ValueKind != JsonValueKind.Object)
    {
        return Results.BadRequest(new { error = "Access map is required" });
    }

    var access = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    foreach (var role in node.EnumerateObject())
    {
        access[role.Name] = role.Value.ValueKind == JsonValueKind.Array
            ? role.Value.EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => !string.IsNullOrWhiteSpace(item)).ToList()
            : [];
    }

    store.UpdateRoleSectionAccess(access);
    if (body.TryGetValue("parts", out var rawParts) && rawParts is JsonElement partsElement && partsElement.ValueKind == JsonValueKind.Object)
    {
        store.UpdateRoleSectionParts(ParseSectionPermissionsByRole(partsElement));
    }
    return Results.Json(new { success = true });
}

static IResult HandleRoleCreate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var role = body.GetString("role");
    if (string.IsNullOrWhiteSpace(role)) return Results.BadRequest(new { error = "Role name is required." });
    return store.CreateRole(role)
        ? Results.Json(new { success = true, message = "Role added successfully." })
        : Results.BadRequest(new { error = "That role already exists or the name is invalid." });
}

static IResult HandleUserRoleAccessUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var sections = new List<string>();
    if (body.TryGetValue("allowed_sections", out var rawSections) && rawSections is JsonElement sectionElement && sectionElement.ValueKind == JsonValueKind.Array)
    {
        sections = sectionElement.EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToList();
    }
    var platforms = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
    if (body.TryGetValue("platform_access", out var rawPlatforms) && rawPlatforms is JsonElement platformElement && platformElement.ValueKind == JsonValueKind.Object)
    {
        foreach (var item in platformElement.EnumerateObject())
        {
            platforms[item.Name] = item.Value.ValueKind == JsonValueKind.True || (item.Value.ValueKind == JsonValueKind.String && bool.TryParse(item.Value.GetString(), out var value) && value);
        }
    }
    var sectionPermissions = body.TryGetValue("section_permissions", out var rawPermissions) && rawPermissions is JsonElement permissionsElement && permissionsElement.ValueKind == JsonValueKind.Object
        ? ParseSectionPermissions(permissionsElement)
        : new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    var updated = store.UpdateUserRoleAccess(body.GetInt("user_id"), body.GetString("role"), sections, platforms, sectionPermissions);
    if (updated && body.GetString("role").Equals("admin", StringComparison.OrdinalIgnoreCase)) store.PromoteUserToAdmin(body.GetString("username"));
    return updated ? Results.Json(new { success = true, message = "Role access updated successfully" }) : Results.BadRequest(new { error = "User not found" });
}

static IResult HandleRoleAccessApplyUsers(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var role = body.GetString("role");
    if (string.IsNullOrWhiteSpace(role)) return Results.BadRequest(new { error = "A role is required." });

    var sections = body.TryGetValue("allowed_sections", out var rawSections) && rawSections is JsonElement sectionElement && sectionElement.ValueKind == JsonValueKind.Array
        ? sectionElement.EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToList()
        : [];
    var platforms = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
    if (body.TryGetValue("platform_access", out var rawPlatforms) && rawPlatforms is JsonElement platformElement && platformElement.ValueKind == JsonValueKind.Object)
    {
        foreach (var item in platformElement.EnumerateObject())
        {
            platforms[item.Name] = item.Value.ValueKind == JsonValueKind.True || (item.Value.ValueKind == JsonValueKind.String && bool.TryParse(item.Value.GetString(), out var value) && value);
        }
    }
    var sectionPermissions = body.TryGetValue("section_permissions", out var rawPermissions) && rawPermissions is JsonElement permissionsElement && permissionsElement.ValueKind == JsonValueKind.Object
        ? ParseSectionPermissions(permissionsElement)
        : new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    var updated = store.UpdateRoleAccessForUsers(role, sections, platforms, sectionPermissions);
    return Results.Json(new { success = true, updated_users = updated, message = $"Access applied to {updated} {role} user{(updated == 1 ? string.Empty : "s")}." });
}

static IResult HandleRoleAccessApplyAllRoles(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var sections = body.TryGetValue("allowed_sections", out var rawSections) && rawSections is JsonElement sectionElement && sectionElement.ValueKind == JsonValueKind.Array
        ? sectionElement.EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToList()
        : [];
    var platforms = ParsePlatformAccess(body);
    var sectionPermissions = body.TryGetValue("section_permissions", out var rawPermissions) && rawPermissions is JsonElement permissionsElement && permissionsElement.ValueKind == JsonValueKind.Object
        ? ParseSectionPermissions(permissionsElement)
        : new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    var updated = store.UpdateRoleAccessForAllRoles(sections, platforms, sectionPermissions);
    return Results.Json(new { success = true, updated_roles = updated, message = $"Access applied to all {updated} role defaults." });
}

static IResult HandleUserRoleAccessApplyAllUsers(Dictionary<string, object?> body, AppDataStore store)
{
    if (!RequireSuperAdmin(body, store)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    var sections = body.TryGetValue("allowed_sections", out var rawSections) && rawSections is JsonElement sectionElement && sectionElement.ValueKind == JsonValueKind.Array
        ? sectionElement.EnumerateArray().Select(item => item.GetString() ?? string.Empty).ToList()
        : [];
    var platforms = ParsePlatformAccess(body);
    var sectionPermissions = body.TryGetValue("section_permissions", out var rawPermissions) && rawPermissions is JsonElement permissionsElement && permissionsElement.ValueKind == JsonValueKind.Object
        ? ParseSectionPermissions(permissionsElement)
        : new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    var updated = store.UpdateRoleAccessForAllUsers(sections, platforms, sectionPermissions);
    return Results.Json(new { success = true, updated_users = updated, message = $"Access applied to all {updated} users." });
}

static Dictionary<string, bool> ParsePlatformAccess(Dictionary<string, object?> body)
{
    var platforms = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
    if (body.TryGetValue("platform_access", out var rawPlatforms) && rawPlatforms is JsonElement platformElement && platformElement.ValueKind == JsonValueKind.Object)
    {
        foreach (var item in platformElement.EnumerateObject())
        {
            platforms[item.Name] = item.Value.ValueKind == JsonValueKind.True ||
                                   (item.Value.ValueKind == JsonValueKind.String && bool.TryParse(item.Value.GetString(), out var value) && value);
        }
    }
    return platforms;
}

static Dictionary<string, List<string>> ParseSectionPermissions(JsonElement element)
{
    var result = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
    foreach (var section in element.EnumerateObject())
    {
        result[section.Name] = section.Value.ValueKind == JsonValueKind.Array
            ? section.Value.EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => !string.IsNullOrWhiteSpace(item)).ToList()
            : [];
    }
    return result;
}

static Dictionary<string, Dictionary<string, List<string>>> ParseSectionPermissionsByRole(JsonElement element)
{
    var result = new Dictionary<string, Dictionary<string, List<string>>>(StringComparer.OrdinalIgnoreCase);
    foreach (var role in element.EnumerateObject())
    {
        if (role.Value.ValueKind == JsonValueKind.Object) result[role.Name] = ParseSectionPermissions(role.Value);
    }
    return result;
}

static IResult HandleAdminProfile(HttpRequest request, AppDataStore store)
{
    var session = GetSessionInfo(request.HttpContext);
    if (session is null || !session.AdminId.HasValue) return Results.Unauthorized();
    var profile = store.GetAdminProfile(session.AdminId.Value);
    return profile is null ? Results.NotFound(new { error = "Profile not found" }) : Results.Json(new { success = true, profile });
}

static IResult HandleAdminProfileUpdate(HttpContext context, Dictionary<string, object?> body, AppDataStore store)
{
    var session = GetSessionInfo(context);
    if (session?.AdminId is not int id) return Results.Unauthorized();
    var result = store.UpdateAdminProfile(id, body);
    return result.Success
        ? Results.Json(new { success = true, message = "Profile updated successfully" })
        : Results.BadRequest(new { error = result.Error ?? "Unable to update profile" });
}

static IResult HandleAdminChangePasswordCurrent(HttpContext context, Dictionary<string, object?> body, AppDataStore store)
{
    var session = GetSessionInfo(context);
    if (session?.AdminId is not int id) return Results.Unauthorized();
    var changed = store.ChangeAdminPasswordWithCurrent(id, body.GetString("current_password"), body.GetString("new_password"), out var error);
    return changed ? Results.Json(new { success = true, message = "Password changed successfully" }) : Results.BadRequest(new { error });
}

static IResult HandleAnnouncementCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var created = store.CreateAnnouncement(
        body.GetString("title"),
        body.GetString("content"),
        body.GetInt("current_admin_id"),
        body.GetString("priority", "medium"),
        body.GetString("target_audience", "all"));

    return created
        ? Results.Json(new { success = true, message = "Announcement created successfully" })
        : Results.BadRequest(new { error = "Failed to create announcement" });
}

static IResult HandleAnnouncementUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var updated = store.UpdateAnnouncement(
        body.GetInt("id"),
        body.GetString("title"),
        body.GetString("content"),
        body.GetString("priority", "medium"),
        body.GetBool("is_active", true),
        body.GetString("target_audience", "all"));

    return updated
        ? Results.Json(new { success = true, message = "Announcement updated successfully" })
        : Results.BadRequest(new { error = "Failed to update announcement" });
}

static IResult HandleAnnouncementDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var deleted = store.DeleteAnnouncement(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "Announcement deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete announcement" });
}

static IResult HandleDiningMenuCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.CreateDiningMenu(body);
    return result.Success
        ? Results.Json(new { success = true, message = "Dining menu created successfully", recurring_menus_created = result.RecurringMenusCreated })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleDiningMenuUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.UpdateDiningMenu(body);
    return result.Success
        ? Results.Json(new { success = true, message = "Dining menu updated successfully", recurring_menus_created = result.RecurringMenusCreated })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleDiningMenuDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var deleted = store.DeleteDiningMenu(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "Dining menu deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete dining menu" });
}

static IResult HandleHolidayCreate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.CreateHoliday(body);
    return result.Success
        ? Results.Json(new { success = true, message = "Holiday created successfully" })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleHolidayUpdate(Dictionary<string, object?> body, AppDataStore store)
{
    var result = store.UpdateHoliday(body);
    return result.Success
        ? Results.Json(new { success = true, message = "Holiday updated successfully" })
        : Results.BadRequest(new { error = result.Error });
}

static IResult HandleHolidayDelete(Dictionary<string, object?> body, AppDataStore store)
{
    var deleted = store.DeleteHoliday(body.GetInt("id"));
    return deleted
        ? Results.Json(new { success = true, message = "Holiday deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete holiday" });
}

static IResult HandleHolidayDeleteByYear(Dictionary<string, object?> body, AppDataStore store)
{
    var deleted = store.DeleteHolidaysByYear(body.GetInt("year"));
    return deleted
        ? Results.Json(new { success = true, message = "All holidays deleted successfully" })
        : Results.BadRequest(new { error = "Failed to delete holidays" });
}

static int ParseInt(string? value, int fallback) => int.TryParse(value, out var number) ? number : fallback;

static bool RequireSuperAdmin(Dictionary<string, object?> body, AppDataStore store) =>
    store.IsSuperAdmin(body.GetInt("current_admin_id"));

static string? FindDotEnv(string contentRoot)
{
    var starts = new[]
    {
        AppContext.BaseDirectory,
        contentRoot,
        Environment.CurrentDirectory
    };

    foreach (var start in starts.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
    {
        var directory = new DirectoryInfo(Path.GetFullPath(start));
        for (var depth = 0; directory is not null && depth < 8; depth++, directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }
    }

    return null;
}

static string? FindDirectory(string name, string contentRoot)
{
    var starts = new[]
    {
        AppContext.BaseDirectory,
        contentRoot,
        Environment.CurrentDirectory
    };

    foreach (var start in starts.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
    {
        var directory = new DirectoryInfo(Path.GetFullPath(start));
        for (var depth = 0; directory is not null && depth < 8; depth++, directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, name);
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }
    }

    return null;
}

static bool RequiresDatabase(PathString path) =>
    path == "/" ||
    path.Value?.EndsWith(".html", StringComparison.OrdinalIgnoreCase) == true ||
    path.StartsWithSegments("/auth") ||
    path.StartsWithSegments("/database") ||
    path.StartsWithSegments("/ws") ||
    path.StartsWithSegments("/admin_dashboard") ||
    path.StartsWithSegments("/student_dashboard") ||
    path.StartsWithSegments("/instructor_dashboard") ||
    path.StartsWithSegments("/archive");

static async Task WriteDatabaseUnavailable(HttpContext context, LocalizationService localizer)
{
    var language = localizer.ResolveLanguage(context.Request);
    context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
    context.Response.Headers.RetryAfter = "5";
    if (context.Request.Path.StartsWithSegments("/auth") ||
        context.Request.Path.StartsWithSegments("/database") ||
        context.Request.Path.StartsWithSegments("/ws"))
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            error = localizer.Translate(language, "system.databaseUnavailable.api"),
            error_key = "system.databaseUnavailable.api",
            error_args = new Dictionary<string, object?>(),
            retryable = true
        });
        return;
    }

    context.Response.ContentType = "text/html; charset=utf-8";
    var title = System.Net.WebUtility.HtmlEncode(localizer.Translate(language, "system.databaseUnavailable.title"));
    var message = System.Net.WebUtility.HtmlEncode(localizer.Translate(language, "system.databaseUnavailable.message"));
    var retry = System.Net.WebUtility.HtmlEncode(localizer.Translate(language, "common.retry"));
    var direction = localizer.IsRightToLeft(language) ? "rtl" : "ltr";
    await context.Response.WriteAsync($"<!doctype html><html lang=\"{language}\" dir=\"{direction}\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>FIU Global Portal - {title}</title><style>body{{font-family:system-ui,sans-serif;background:#f3f6fb;color:#14223b;display:grid;place-items:center;min-height:100vh;margin:0;direction:{direction}}}.card{{max-width:520px;margin:24px;padding:32px;border-radius:18px;background:#fff;box-shadow:0 12px 40px rgba(20,34,59,.12);text-align:center}}h1{{margin-top:0}}p{{color:#5d6d86}}button{{padding:10px 18px;border:0;border-radius:10px;background:#15396d;color:#fff;font-weight:700;cursor:pointer}}</style></head><body><main class=\"card\"><h1>{title}</h1><p>{message}</p><button onclick=\"location.reload()\">{retry}</button></main></body></html>");
}

static void LoadDotEnv(string? path)
{
    if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
    {
        return;
    }

    foreach (var line in File.ReadAllLines(path))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#') || !trimmed.Contains('='))
        {
            continue;
        }

        var parts = trimmed.Split('=', 2);
        var key = parts[0].Trim();
        var value = parts[1].Trim().Trim('"');
        // Explicit process/server environment variables take precedence over
        // the local .env file. This lets XAMPP, containers, and hosting
        // platforms provide their own database credentials without requiring
        // secrets to be copied into the project folder.
        if (!string.IsNullOrWhiteSpace(key) && Environment.GetEnvironmentVariable(key) is null)
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}

static string BuildAbsoluteUrl(HttpRequest request, string path) =>
    $"{request.Scheme}://{request.Host}{path}";

static string GetEnv(string key) =>
    (Environment.GetEnvironmentVariable(key) ?? string.Empty).Trim().Trim('"');

static bool IsValidGoogleClientId(string clientId) =>
    !string.IsNullOrWhiteSpace(clientId) &&
    clientId.EndsWith(".apps.googleusercontent.com", StringComparison.OrdinalIgnoreCase) &&
    !clientId.Contains("your-google-client-id", StringComparison.OrdinalIgnoreCase);

static string GetGoogleRedirectUri(HttpRequest request)
{
    var configured = GetEnv("GOOGLE_REDIRECT_URI");
    if (Uri.TryCreate(configured, UriKind.Absolute, out _))
    {
        return configured;
    }

    // APP_BASE_URL is useful on cPanel/LiteSpeed, where the browser reaches
    // HTTPS but Kestrel itself receives an internal HTTP request from the
    // reverse proxy. Fall back to the public base URL before deriving the
    // callback from the internal request scheme/host.
    var appBaseUrl = GetEnv("APP_BASE_URL").TrimEnd('/');
    if (Uri.TryCreate(appBaseUrl, UriKind.Absolute, out var appBase))
    {
        return new Uri(appBase, "/auth/google/callback").ToString();
    }

    return BuildAbsoluteUrl(request, "/auth/google/callback");
}

static async Task<(string? Email, string? Error)> ExchangeGoogleCodeForEmail(HttpRequest request, string code)
{
    var clientId = GetEnv("GOOGLE_CLIENT_ID");
    var clientSecret = GetEnv("GOOGLE_CLIENT_SECRET");
    if (!IsValidGoogleClientId(clientId) || string.IsNullOrWhiteSpace(clientSecret))
    {
        return (null, "google_oauth_env_missing_or_invalid");
    }

    try
    {
        using var http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(20)
        };
        var tokenResponse = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = GetGoogleRedirectUri(request)
        }));
        var tokenBody = await tokenResponse.Content.ReadAsStringAsync();
        if (!tokenResponse.IsSuccessStatusCode)
        {
            return (null, GetGoogleError(tokenBody) ?? $"token_http_{(int)tokenResponse.StatusCode}");
        }

        using var tokenJson = JsonDocument.Parse(tokenBody);
        if (tokenJson.RootElement.TryGetProperty("id_token", out var idToken))
        {
            var (emailFromToken, tokenError) = TryGetEmailFromGoogleIdToken(idToken.GetString(), clientId);
            if (!string.IsNullOrWhiteSpace(emailFromToken))
            {
                return (emailFromToken, null);
            }

            if (!string.IsNullOrWhiteSpace(tokenError))
            {
                return (null, tokenError);
            }
        }

        if (!tokenJson.RootElement.TryGetProperty("access_token", out var accessToken) || string.IsNullOrWhiteSpace(accessToken.GetString()))
        {
            return (null, "missing_access_token");
        }

        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.GetString());
        var userInfoResponse = await http.GetAsync("https://openidconnect.googleapis.com/v1/userinfo");
        var userInfo = await userInfoResponse.Content.ReadAsStringAsync();
        if (!userInfoResponse.IsSuccessStatusCode)
        {
            return (null, $"userinfo_http_{(int)userInfoResponse.StatusCode}");
        }

        using var userJson = JsonDocument.Parse(userInfo);
        return userJson.RootElement.TryGetProperty("email", out var email)
            ? (email.GetString(), null)
            : (null, "missing_email");
    }
    catch (TaskCanceledException)
    {
        return (null, "google_timeout");
    }
    catch (HttpRequestException)
    {
        return (null, "google_network");
    }
    catch (Exception ex) when (ex is JsonException or FormatException)
    {
        return (null, ex.GetType().Name);
    }
}

static string? GetGoogleError(string responseBody)
{
    try
    {
        using var json = JsonDocument.Parse(responseBody);
        return json.RootElement.TryGetProperty("error", out var error)
            ? $"google_{error.GetString()}"
            : null;
    }
    catch (JsonException)
    {
        return null;
    }
}

static (string? Email, string? Error) TryGetEmailFromGoogleIdToken(string? idToken, string expectedAudience)
{
    if (string.IsNullOrWhiteSpace(idToken))
    {
        return (null, "missing_id_token");
    }

    var parts = idToken.Split('.');
    if (parts.Length < 2)
    {
        return (null, "invalid_id_token_format");
    }

    using var payload = JsonDocument.Parse(Base64UrlDecode(parts[1]));
    var root = payload.RootElement;

    if (!root.TryGetProperty("aud", out var audience) ||
        !string.Equals(audience.GetString(), expectedAudience, StringComparison.Ordinal))
    {
        return (null, "invalid_id_token_audience");
    }

    if (root.TryGetProperty("exp", out var expiresAt) &&
        expiresAt.TryGetInt64(out var exp) &&
        DateTimeOffset.FromUnixTimeSeconds(exp) <= DateTimeOffset.UtcNow)
    {
        return (null, "expired_id_token");
    }

    if (root.TryGetProperty("email_verified", out var emailVerified) &&
        emailVerified.ValueKind == JsonValueKind.False)
    {
        return (null, "email_not_verified");
    }

    return root.TryGetProperty("email", out var email)
        ? (email.GetString(), null)
        : (null, "missing_email");
}

static byte[] Base64UrlDecode(string value)
{
    var padded = value.Replace('-', '+').Replace('_', '/');
    padded = padded.PadRight(padded.Length + ((4 - padded.Length % 4) % 4), '=');
    return Convert.FromBase64String(padded);
}

static void CleanupGoogleAuthStates(ConcurrentDictionary<string, DateTimeOffset> states)
{
    var now = DateTimeOffset.UtcNow;
    foreach (var item in states.Where(item => item.Value <= now).ToList())
    {
        states.TryRemove(item.Key, out _);
    }
}

static void SetSessionCookie(HttpResponse response, string token)
{
    response.Cookies.Append(SessionCookieName, token, new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        Secure = ShouldUseSecureCookies(),
        Expires = DateTimeOffset.UtcNow.AddHours(8),
        IsEssential = true
    });
}

static bool ShouldUseSecureCookies(HttpRequest? request = null)
{
    if (request?.IsHttps == true) return true;
    var configuredBaseUrl = GetEnv("APP_BASE_URL");
    return Uri.TryCreate(configuredBaseUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

static SessionInfo? GetSessionInfo(HttpContext context) =>
    context.Items.TryGetValue("Session", out var value) ? value as SessionInfo : null;

static string EscapeCsv(string value) =>
    value.Contains(',') || value.Contains('"') || value.Contains('\n')
        ? $"\"{value.Replace("\"", "\"\"")}\""
        : value;

static List<string> ParseCsvLine(string line)
{
    var columns = new List<string>();
    var current = new StringBuilder();
    var quoted = false;
    for (var i = 0; i < line.Length; i++)
    {
        var c = line[i];
        if (c == '"' && quoted && i + 1 < line.Length && line[i + 1] == '"')
        {
            current.Append('"');
            i++;
        }
        else if (c == '"')
        {
            quoted = !quoted;
        }
        else if (c == ',' && !quoted)
        {
            columns.Add(current.ToString().Trim());
            current.Clear();
        }
        else
        {
            current.Append(c);
        }
    }
    columns.Add(current.ToString().Trim());
    return columns;
}

static List<DiningMenuImportRow> ReadDiningRowsFromXlsx(IFormFile file)
{
    using var archive = new ZipArchive(file.OpenReadStream(), ZipArchiveMode.Read);
    var sharedStrings = archive.GetEntry("xl/sharedStrings.xml") is { } sharedEntry
        ? XDocument.Load(sharedEntry.Open()).Descendants().Where(node => node.Name.LocalName == "t").Select(node => node.Value).ToList()
        : [];
    var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml");
    if (sheetEntry is null)
    {
        return [];
    }

    var sheet = XDocument.Load(sheetEntry.Open());
    var rows = new List<DiningMenuImportRow>();
    foreach (var row in sheet.Descendants().Where(node => node.Name.LocalName == "row").Skip(1))
    {
        var values = row.Elements().Where(node => node.Name.LocalName == "c").Select(cell =>
        {
            var type = cell.Attribute("t")?.Value;
            if (type == "inlineStr")
            {
                return string.Concat(cell.Descendants().Where(node => node.Name.LocalName == "t").Select(node => node.Value));
            }

            var raw = cell.Elements().FirstOrDefault(node => node.Name.LocalName == "v")?.Value ?? string.Empty;
            if (type == "s" && int.TryParse(raw, out var index) && index >= 0 && index < sharedStrings.Count)
            {
                return sharedStrings[index];
            }

            if (double.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var number) && number > 20000 && number < 60000)
            {
                return DateTime.FromOADate(number).ToString("MM/dd/yyyy", CultureInfo.InvariantCulture);
            }

            return raw;
        }).ToList();

        if (values.Count >= 7)
        {
            rows.Add(new DiningMenuImportRow(values[0], values[1], values[2], values[3], values[4], values[5], values[6]));
        }
    }

    return rows;
}

static List<List<string>> ReadSimpleRowsFromXlsx(IFormFile file)
{
    using var archive = new ZipArchive(file.OpenReadStream(), ZipArchiveMode.Read);
    var sharedStrings = archive.GetEntry("xl/sharedStrings.xml") is { } sharedEntry
        ? XDocument.Load(sharedEntry.Open()).Descendants().Where(node => node.Name.LocalName == "t").Select(node => node.Value).ToList()
        : [];
    var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml");
    if (sheetEntry is null) return [];
    var sheet = XDocument.Load(sheetEntry.Open());
    return sheet.Descendants().Where(node => node.Name.LocalName == "row").Skip(1).Select(row => row.Elements().Where(node => node.Name.LocalName == "c").Select(cell =>
    {
        var type = cell.Attribute("t")?.Value;
        if (type == "inlineStr") return string.Concat(cell.Descendants().Where(node => node.Name.LocalName == "t").Select(node => node.Value));
        var raw = cell.Elements().FirstOrDefault(node => node.Name.LocalName == "v")?.Value ?? string.Empty;
        return type == "s" && int.TryParse(raw, out var index) && index >= 0 && index < sharedStrings.Count ? sharedStrings[index] : raw;
    }).ToList()).ToList();
}

static object ToHolidayDto(HolidayItem holiday) => new
{
    id = holiday.Id,
    date = holiday.Date.ToString("yyyy-MM-dd"),
    year = holiday.Year,
    day_of_week = holiday.DayOfWeek,
    holiday_name = holiday.HolidayName,
    type = holiday.Type,
    description = holiday.Description,
    is_active = holiday.IsActive,
    is_recurring = holiday.IsRecurring,
    created_by = holiday.CreatedBy,
    created_by_name = holiday.CreatedByName,
    created_at = holiday.CreatedAt,
    updated_at = holiday.UpdatedAt
};

static object SanitizeAdmin(AdminAccount admin) => new
{
    id = admin.Id,
    username = admin.Username,
    email = admin.Email,
    role = admin.Role,
    is_active = admin.IsActive,
    student_number = admin.StudentNumber,
    first_name = admin.FirstName,
    last_name = admin.LastName,
    profile_picture = admin.ProfilePicture,
    faculty_id = admin.FacultyId,
    department_id = admin.DepartmentId,
    faculty = admin.Faculty,
    department = admin.Department,
    preferred_language = admin.PreferredLanguage,
    created_at = admin.CreatedAt,
    last_login = admin.LastLogin
};

static class ChatHub
{
    private sealed class Connection
    {
        public required WebSocket Socket { get; init; }
        public SemaphoreSlim Gate { get; } = new(1, 1);
    }

    private static readonly ConcurrentDictionary<int, ConcurrentDictionary<Guid, Connection>> Connections = new();

    public static void Add(int userId, Guid connectionId, WebSocket socket)
    {
        var userConnections = Connections.GetOrAdd(userId, _ => new ConcurrentDictionary<Guid, Connection>());
        userConnections[connectionId] = new Connection { Socket = socket };
    }

    public static void Remove(int userId, Guid connectionId)
    {
        if (!Connections.TryGetValue(userId, out var userConnections)) return;
        userConnections.TryRemove(connectionId, out _);
        if (userConnections.IsEmpty) Connections.TryRemove(userId, out _);
    }

    public static async Task SendAsync(int userId, object payload)
    {
        if (!Connections.TryGetValue(userId, out var userConnections)) return;
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        foreach (var item in userConnections.ToArray())
        {
            var connection = item.Value;
            if (connection.Socket.State != WebSocketState.Open)
            {
                Remove(userId, item.Key);
                continue;
            }

            await connection.Gate.WaitAsync();
            try
            {
                if (connection.Socket.State == WebSocketState.Open)
                {
                    await connection.Socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
                }
            }
            catch (WebSocketException)
            {
                Remove(userId, item.Key);
            }
            catch (ObjectDisposedException)
            {
                Remove(userId, item.Key);
            }
            finally
            {
                connection.Gate.Release();
            }
        }
    }
}
