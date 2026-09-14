using System.Security.Cryptography;
using System.Text;

namespace FiuGlobal.DotNet.Services;

/// <summary>
/// Central password hashing policy for the portal and its legacy database
/// mirror.  The portable format is deliberately understood by the adjacent
/// PHP compatibility layer so one account can continue to sign in safely
/// while the old helper is still deployed.
/// </summary>
public static class PasswordSecurity
{
    private const string FormatPrefix = "$fiu$pbkdf2-sha512$";
    private const int DefaultIterations = 210_000;
    private const int SaltLength = 16;
    private const int SubkeyLength = 32;

    public static string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var subkey = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            DefaultIterations,
            HashAlgorithmName.SHA512,
            SubkeyLength);

        return $"{FormatPrefix}{DefaultIterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(subkey)}";
    }

    public static PasswordVerificationResult Verify(string? password, string? storedValue)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedValue) ||
            storedValue.StartsWith("google-oauth:", StringComparison.OrdinalIgnoreCase))
        {
            return PasswordVerificationResult.Failed;
        }

        if (storedValue.StartsWith(FormatPrefix, StringComparison.Ordinal))
        {
            return VerifyFiuHash(password, storedValue);
        }

        // A small number of legacy installations stored raw SHA-256 values.
        // Preserve a one-time sign-in path for those users, then upgrade them
        // to the slow, salted PBKDF2 representation.
        if (IsRawSha256(storedValue) &&
            CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(storedValue),
                SHA256.HashData(Encoding.UTF8.GetBytes(password))))
        {
            return new PasswordVerificationResult(true, true);
        }

        // Existing plaintext values are migrated during startup, but this
        // fallback prevents a race with an older state document from locking a
        // valid account out.  It is intentionally constant-time.
        return FixedTimeStringEquals(password, storedValue)
            ? new PasswordVerificationResult(true, true)
            : PasswordVerificationResult.Failed;
    }

    public static bool IsCurrentHash(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.StartsWith(FormatPrefix, StringComparison.Ordinal);

    private static PasswordVerificationResult VerifyFiuHash(string password, string storedValue)
    {
        try
        {
            var parts = storedValue.Split('$');
            if (parts.Length != 6 ||
                !string.Equals(parts[1], "fiu", StringComparison.Ordinal) ||
                !string.Equals(parts[2], "pbkdf2-sha512", StringComparison.Ordinal) ||
                !int.TryParse(parts[3], out var iterations) ||
                iterations is < 100_000 or > 2_000_000)
            {
                return PasswordVerificationResult.Failed;
            }

            var salt = Convert.FromBase64String(parts[4]);
            var expected = Convert.FromBase64String(parts[5]);
            if (salt.Length < SaltLength || expected.Length < SubkeyLength)
            {
                return PasswordVerificationResult.Failed;
            }

            var actual = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password),
                salt,
                iterations,
                HashAlgorithmName.SHA512,
                expected.Length);

            if (!CryptographicOperations.FixedTimeEquals(actual, expected))
            {
                return PasswordVerificationResult.Failed;
            }

            return new PasswordVerificationResult(true, iterations < DefaultIterations || expected.Length < SubkeyLength);
        }
        catch (FormatException)
        {
            return PasswordVerificationResult.Failed;
        }
    }

    private static bool IsRawSha256(string value) =>
        value.Length == 64 && value.All(Uri.IsHexDigit);

    private static bool FixedTimeStringEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}

public readonly record struct PasswordVerificationResult(bool Success, bool NeedsUpgrade)
{
    public static PasswordVerificationResult Failed { get; } = new(false, false);
}
