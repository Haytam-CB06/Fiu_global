namespace FiuGlobal.DotNet.Models;

using System.Text.Json.Serialization;

public sealed class AppState
{
    public List<UserAccount> Users { get; set; } = [];
    public List<AdminAccount> Admins { get; set; } = [];
    public List<PlatformLink> Platforms { get; set; } = [];
    public List<FacultyItem> Faculties { get; set; } = [];
    public List<DepartmentItem> Departments { get; set; } = [];
    public List<AnnouncementItem> Announcements { get; set; } = [];
    public List<DiningMenuItem> DiningMenus { get; set; } = [];
    public List<HolidayItem> Holidays { get; set; } = [];
    public List<NotificationItem> Notifications { get; set; } = [];
    public List<LmsSubplatform> LmsSubplatforms { get; set; } = [];
    public List<ActivityLogItem> ActivityLogs { get; set; } = [];
    public List<UserPlatformAccess> UserPlatformAccess { get; set; } = [];
    public Dictionary<string, List<string>> RoleSectionAccess { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, Dictionary<string, List<string>>> RoleSectionParts { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public int RoleAccessDefaultsVersion { get; set; }
    public int PlatformRoleGrantSyncVersion { get; set; }
    public SmtpSettings Smtp { get; set; } = new();
    public Counters Counters { get; set; } = new();
}

public sealed class Counters
{
    public int NextUserId { get; set; } = 3;
    public int NextAdminId { get; set; } = 3;
    public int NextAnnouncementId { get; set; } = 3;
    public int NextDiningMenuId { get; set; } = 4;
    public int NextHolidayId { get; set; } = 3;
    public int NextNotificationId { get; set; } = 4;
    public int NextActivityLogId { get; set; } = 1;
    public int NextFacultyId { get; set; } = 1;
    public int NextDepartmentId { get; set; } = 1;
}

public sealed class UserAccount
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "instructor";
    public string StudentNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string ProfilePicture { get; set; } = string.Empty;
    public int? FacultyId { get; set; }
    public int? DepartmentId { get; set; }
    public string Faculty { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    // Kept in the JSON application state so background messages and email can
    // use the recipient's chosen portal language even without an HTTP request.
    public string PreferredLanguage { get; set; } = "en";
    public List<string> AllowedSections { get; set; } = [];
    public bool SectionAccessConfigured { get; set; }
    public Dictionary<string, List<string>> SectionPermissions { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public DateTime CreatedAt { get; set; }
}

public sealed class AdminAccount
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "admin";
    public bool IsActive { get; set; } = true;
    public string StudentNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string ProfilePicture { get; set; } = string.Empty;
    public int? FacultyId { get; set; }
    public int? DepartmentId { get; set; }
    public string Faculty { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string PreferredLanguage { get; set; } = "en";
    public List<string> AllowedSections { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLogin { get; set; }
}

public sealed class PlatformLink
{
    public int Id { get; set; }
    public string Section { get; set; } = "Campus";
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? NotificationsUrl { get; set; }
    public string ImageUrl { get; set; } = "/img/fiu9-mark2.png";
    public List<string> VisibleToRoles { get; set; } = ["student", "instructor"];
    public DateTime CreatedAt { get; set; }
}

public sealed class FacultyItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class DepartmentItem
{
    public int Id { get; set; }
    public int FacultyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class AnnouncementItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string Priority { get; set; } = "medium";
    public string TargetAudience { get; set; } = "all";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class DiningMenuItem
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public string BreakfastMenu { get; set; } = string.Empty;
    public string BreakfastStartTime { get; set; } = "07:00:00";
    public string BreakfastEndTime { get; set; } = "09:00:00";
    public string LunchMenu { get; set; } = string.Empty;
    public string LunchStartTime { get; set; } = "12:00:00";
    public string LunchEndTime { get; set; } = "14:00:00";
    public bool IsRecurring { get; set; }
    public int CreatedBy { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class HolidayItem
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int Year { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public string HolidayName { get; set; } = string.Empty;
    public string Type { get; set; } = "holiday";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsRecurring { get; set; }
    public int? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class UserPlatformAccess
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string StudentNumber { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
}

public sealed class NotificationItem
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Status { get; set; } = "unread";
    public string? Date { get; set; }
    public string? Subplatform { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class LmsSubplatform
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string LoginEndpoint { get; set; } = "/LMS/login/index.php";
    public string NotificationsEndpoint { get; set; } = "message/output/popup/notifications.php";
}

public sealed class ActivityLogItem
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public sealed class ChatMessageItem
{
    public string Id { get; set; } = string.Empty;
    public int SenderId { get; set; }
    public int RecipientId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTimeOffset SentAt { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public DateTimeOffset? SeenAt { get; set; }
    public DateTimeOffset? ReminderSentAt { get; set; }
}

public sealed class ChatReplyReminderCandidate
{
    public string MessageId { get; set; } = string.Empty;
    public int SenderId { get; set; }
    public int RecipientId { get; set; }
    public DateTimeOffset SentAt { get; set; }
}

public sealed class ChatMessageStatusUpdate
{
    public string MessageId { get; set; } = string.Empty;
    public int SenderId { get; set; }
    public int RecipientId { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public DateTimeOffset? SeenAt { get; set; }
}

public sealed class SmtpSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    // SMTP credentials must stay in environment/secret storage. The app reads
    // this value at runtime and deliberately never writes it into state_json.
    [JsonIgnore]
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "FIU Global Portal";
    public bool EnableSsl { get; set; } = true;
}

public sealed record LoginRequest(string Username, string Password);

public sealed record LanguagePreferenceRequest(string? Language);

public sealed record HolidayCsvRow(string Date, string DayOfWeek, string HolidayName);

public sealed record UserImportRow(
    string Username,
    string Email,
    string Role,
    string Password,
    string Faculty = "",
    string Department = "",
    int RowNumber = 0);

public sealed record DiningMenuImportRow(string Date, string BreakfastMenu, string BreakfastStartTime, string BreakfastEndTime, string LunchMenu, string LunchStartTime, string LunchEndTime);

public sealed record OperationResult(bool Success, string? Error = null, int RecurringMenusCreated = 0);

public sealed record UserImportResult(bool Success, int Imported, IReadOnlyList<string> Errors, int Skipped = 0);

public sealed class SessionInfo
{
    public string Token { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public int? AdminId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string UserRole { get; set; } = "guest";
    public string? AdminRole { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public DateTime LastSeenAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUser => UserId.HasValue;
    public bool IsAdmin => AdminId.HasValue;
    public bool IsSuperAdmin => string.Equals(AdminRole, "admin", StringComparison.OrdinalIgnoreCase);
}
