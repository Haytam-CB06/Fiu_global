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

if (failures.Count == 0)
{
    Console.WriteLine("SSO security checks passed.");
    return 0;
}

Console.Error.WriteLine("SSO security checks failed: " + string.Join(", ", failures));
return 1;
