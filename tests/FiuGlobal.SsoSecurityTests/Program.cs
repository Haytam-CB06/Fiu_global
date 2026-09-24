using FiuGlobal.DotNet.Services;

var failures = new List<string>();

void Check(bool condition, string name)
{
    if (condition) return;
    failures.Add(name);
}

var now = new DateTimeOffset(2026, 9, 20, 12, 0, 0, TimeSpan.Zero);
var stateStore = new OidcAuthorizationStateStore();
var transaction = stateStore.Issue(TimeSpan.FromMinutes(10), now);

// Successful eligible authorization transaction / launch decision.
Check(OidcAuthorizationStateStore.ValuesMatch(transaction.State, transaction.State), "valid state comparison");
Check(PlatformSsoPolicy.IsFinalUniversityEmail("student@final.edu.tr"), "approved university domain");
var rms = PlatformSsoPolicy.FindTarget("rms");
Check(rms is not null, "RMS SSO target exists");
Check(rms is not null && PlatformSsoPolicy.TryGetApprovedStartUrl(rms, rms.DefaultStartUrl, out var rmsStart) &&
      rmsStart is not null && string.IsNullOrEmpty(rmsStart.Query) && string.IsNullOrEmpty(rmsStart.Fragment),
    "successful allowlisted RMS launch has no URL data");

// Invalid and reused state values are rejected; the server-side transaction is one-time.
Check(!stateStore.TryConsume("not-a-known-state", now, out _), "invalid state is rejected");
Check(stateStore.TryConsume(transaction.State, now, out _), "valid state is consumed once");
Check(!stateStore.TryConsume(transaction.State, now, out _), "reused state is rejected");

// Expired authorizations do not survive a callback after their lifetime.
var expired = stateStore.Issue(TimeSpan.FromMinutes(1), now);
Check(!stateStore.TryConsume(expired.State, now.AddMinutes(2), out _), "expired authorization is rejected");

// Only verified university-domain identities can start an FIU-side handoff.
Check(!PlatformSsoPolicy.IsFinalUniversityEmail("student@example.edu"), "wrong email domain is rejected");

// FIU's safe external error endpoint has a deterministic, non-sensitive
// missing-account response until the target platform owns the actual mapping.
var missingAccount = SsoErrorCatalog.Resolve("missing_platform_account");
Check(missingAccount.StatusCode == 403 && missingAccount.Code == "missing_platform_account", "missing platform account error");

// Platform visibility is an administrator-configured ceiling, including when
// per-user platform access explicitly grants a platform to a hidden role.
foreach (var key in new[] { "DB_CONNECTION_STRING", "DB_HOST", "DB_DATABASE", "DB_USERNAME", "DB_PASSWORD", "DB_PORT" })
{
    Environment.SetEnvironmentVariable(key, null);
}
var platformStore = new AppDataStore(null!, new LocalizationService());
Check(!platformStore.IsDatabaseAvailable, "platform visibility checks use isolated in-memory state");
Check(platformStore.CreatePlatform("Campus", "AIS", "https://ais.final.edu.tr/", "Academic Information System", null, ["student", "instructor"]), "AIS test platform created");
var ais = platformStore.GetPlatforms().SingleOrDefault(platform => platform.Name == "AIS");
Check(ais is not null, "admin catalog includes AIS");
if (ais is not null)
{
    Check(platformStore.UpdatePlatform(ais.Id, "Campus", ais.Name, ais.Url, ais.Description, null, []), "AIS can be saved with no visible roles");
    Check(!platformStore.GetPlatforms("instructor").Any(platform => platform.Name == "AIS"), "empty AIS visibility denies instructors");
    Check(!platformStore.GetPlatforms("student").Any(platform => platform.Name == "AIS"), "empty AIS visibility denies students");
    Check(platformStore.UpdatePlatform(ais.Id, "Campus", ais.Name, ais.Url, ais.Description, null, ["Instructor"]), "AIS role visibility update succeeds");
}
Check(platformStore.GetPlatforms("instructor").Any(platform => platform.Name == "AIS"), "instructor role sees AIS");
Check(!platformStore.GetPlatforms("student").Any(platform => platform.Name == "AIS"), "student role does not see AIS");

var instructor = platformStore.CreateUser("test-instructor", "test-instructor@example.test", "temporary-test-password", "instructor");
var student = platformStore.CreateUser("test-student", "test-student@example.test", "temporary-test-password", "student");
Check(instructor.Success && student.Success, "isolated instructor and student accounts created");
var userAccess = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase) { ["AIS"] = true };
var testUserIds = platformStore.GetUserRoleAccess().ToDictionary(
    row => (string)row.GetType().GetProperty("username")!.GetValue(row)!,
    row => (int)row.GetType().GetProperty("id")!.GetValue(row)!,
    StringComparer.OrdinalIgnoreCase);
if (testUserIds.TryGetValue("test-instructor", out var instructorId))
{
    Check(platformStore.UpdateUserRoleAccess(instructorId, "instructor", ["platforms"], userAccess), "instructor per-user AIS override saved");
    Check(platformStore.GetPlatformsForUser(instructorId).Any(platform => platform.Name == "AIS"), "instructor user sees AIS");
}
if (testUserIds.TryGetValue("test-student", out var studentId))
{
    Check(platformStore.UpdateUserRoleAccess(studentId, "student", ["platforms"], userAccess), "student per-user AIS override saved");
    Check(!platformStore.GetPlatformsForUser(studentId).Any(platform => platform.Name == "AIS"), "student override cannot bypass AIS role visibility");

    var secondStudent = platformStore.CreateUser("test-student-two", "test-student-two@example.test", "temporary-test-password", "student");
    Check(secondStudent.Success, "second isolated student account created for bulk-delete test");
    var allTestUsers = platformStore.GetUserRoleAccess().ToDictionary(
        row => (string)row.GetType().GetProperty("username")!.GetValue(row)!,
        row => (int)row.GetType().GetProperty("id")!.GetValue(row)!,
        StringComparer.OrdinalIgnoreCase);
    if (allTestUsers.TryGetValue("test-student-two", out var secondStudentId) && testUserIds.TryGetValue("test-instructor", out var protectedInstructorId))
    {
        Check(platformStore.DeleteUsers([studentId, protectedInstructorId], "student") == 0, "bulk delete rejects mixed-role selections without partial deletion");
        Check(platformStore.GetUserRoleAccess().Any(row => (string)row.GetType().GetProperty("username")!.GetValue(row)! == "test-instructor"), "mixed-role rejection preserves the instructor");
        Check(platformStore.DeleteUsers([studentId, secondStudentId], "student") == 2, "bulk delete removes the selected accounts in one role");
        Check(!platformStore.GetUserRoleAccess().Any(row =>
            (string)row.GetType().GetProperty("username")!.GetValue(row)! is "test-student" or "test-student-two"), "bulk delete removes the selected student accounts");
    }
}

if (failures.Count == 0)
{
    Console.WriteLine("SSO security checks passed.");
    return 0;
}

Console.Error.WriteLine("SSO security checks failed: " + string.Join(", ", failures));
return 1;
