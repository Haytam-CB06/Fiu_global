using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace FiuGlobal.DotNet.Services;

/// <summary>
/// Holds short-lived OAuth transaction data server-side. The state value is
/// deliberately opaque to the browser and is removed when it is consumed.
/// </summary>
public sealed class OidcAuthorizationStateStore
{
    private readonly ConcurrentDictionary<string, OidcAuthorizationTransaction> _transactions = new(StringComparer.Ordinal);

    public OidcAuthorizationTransaction Issue(TimeSpan lifetime, DateTimeOffset? issuedAt = null)
    {
        var now = issuedAt ?? DateTimeOffset.UtcNow;
        RemoveExpired(now);

        var transaction = new OidcAuthorizationTransaction(
            CreateRandomUrlSafeValue(32),
            CreateRandomUrlSafeValue(32),
            CreateRandomUrlSafeValue(64),
            now.Add(lifetime));

        _transactions[transaction.State] = transaction;
        return transaction;
    }

    public bool TryConsume(string? state, DateTimeOffset now, out OidcAuthorizationTransaction? transaction)
    {
        transaction = null;
        if (string.IsNullOrWhiteSpace(state) || !_transactions.TryRemove(state, out var stored))
        {
            return false;
        }

        if (stored.ExpiresAt <= now)
        {
            return false;
        }

        transaction = stored;
        return true;
    }

    public static bool ValuesMatch(string? first, string? second)
    {
        if (string.IsNullOrWhiteSpace(first) || string.IsNullOrWhiteSpace(second))
        {
            return false;
        }

        var firstBytes = Encoding.UTF8.GetBytes(first);
        var secondBytes = Encoding.UTF8.GetBytes(second);
        return firstBytes.Length == secondBytes.Length && CryptographicOperations.FixedTimeEquals(firstBytes, secondBytes);
    }

    public static string CreateCodeChallenge(string codeVerifier)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeVerifier);
        return ToBase64Url(SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier)));
    }

    private void RemoveExpired(DateTimeOffset now)
    {
        foreach (var item in _transactions.Where(item => item.Value.ExpiresAt <= now))
        {
            _transactions.TryRemove(item.Key, out _);
        }
    }

    private static string CreateRandomUrlSafeValue(int byteCount) =>
        ToBase64Url(RandomNumberGenerator.GetBytes(byteCount));

    private static string ToBase64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed record OidcAuthorizationTransaction(
    string State,
    string Nonce,
    string CodeVerifier,
    DateTimeOffset ExpiresAt);

/// <summary>
/// Describes the only external OAuth launch URLs FIU Global is permitted to
/// redirect to. It prevents an environment typo from becoming an open redirect.
/// </summary>
public sealed record PlatformSsoTarget(
    string Key,
    string DisplayName,
    string StartUrlEnvironmentVariable,
    string DashboardUrlEnvironmentVariable,
    string DefaultStartUrl,
    string AllowedHost,
    string AllowedPath);

public static class PlatformSsoPolicy
{
    private static readonly PlatformSsoTarget[] Targets =
    [
        new(
            "rms",
            "RMS",
            "RMS_SSO_START_URL",
            "RMS_SSO_DASHBOARD_URL",
            "https://rms.fnlsrv.website/Auth/googleLogin.php",
            "rms.fnlsrv.website",
            "/Auth/googleLogin.php"),
        new(
            "leave",
            "Leave",
            "LEAVE_SSO_START_URL",
            "LEAVE_SSO_DASHBOARD_URL",
            "https://leave.fnlsrv.website/google_login.php",
            "leave.fnlsrv.website",
            "/google_login.php")
    ];

    public static PlatformSsoTarget? FindTarget(string? key) =>
        Targets.FirstOrDefault(target => target.Key.Equals(key?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static bool IsFinalUniversityEmail(string? email) =>
        !string.IsNullOrWhiteSpace(email) &&
        email.Trim().EndsWith("@final.edu.tr", StringComparison.OrdinalIgnoreCase);

    public static bool TryGetApprovedStartUrl(PlatformSsoTarget target, string? configuredUrl, out Uri? startUrl)
    {
        var candidate = string.IsNullOrWhiteSpace(configuredUrl) ? target.DefaultStartUrl : configuredUrl.Trim();
        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri) ||
            !uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !uri.Host.Equals(target.AllowedHost, StringComparison.OrdinalIgnoreCase) ||
            !uri.AbsolutePath.Equals(target.AllowedPath, StringComparison.Ordinal) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment))
        {
            startUrl = null;
            return false;
        }

        startUrl = uri;
        return true;
    }
}

public sealed record SsoErrorDefinition(string Code, int StatusCode, string Title, string Message);

public static class SsoErrorCatalog
{
    private static readonly IReadOnlyDictionary<string, SsoErrorDefinition> Errors =
        new Dictionary<string, SsoErrorDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["login_required"] = new("login_required", 401, "Sign in required", "Sign in to FIU Global before opening this platform."),
            ["invalid_platform"] = new("invalid_platform", 404, "Platform unavailable", "This platform is not configured for secure sign-in."),
            ["invalid_redirect"] = new("invalid_redirect", 503, "Secure sign-in unavailable", "The platform sign-in destination is not configured safely."),
            ["unauthorized_email"] = new("unauthorized_email", 403, "University account required", "Use a verified @final.edu.tr Google account to continue."),
            ["cancelled"] = new("cancelled", 400, "Sign-in cancelled", "Google sign-in was cancelled before it completed."),
            ["invalid_state"] = new("invalid_state", 400, "Sign-in could not be verified", "The sign-in request was invalid or has already been used."),
            ["expired_authorization"] = new("expired_authorization", 400, "Sign-in expired", "The sign-in request expired. Start again from FIU Global."),
            ["missing_platform_account"] = new("missing_platform_account", 403, "Platform account unavailable", "Your university account does not have an account on this platform."),
            ["unavailable_platform"] = new("unavailable_platform", 503, "Platform unavailable", "The platform is temporarily unavailable. Please try again later.")
        };

    public static SsoErrorDefinition Resolve(string? code) =>
        !string.IsNullOrWhiteSpace(code) && Errors.TryGetValue(code, out var error)
            ? error
            : Errors["unavailable_platform"];
}
