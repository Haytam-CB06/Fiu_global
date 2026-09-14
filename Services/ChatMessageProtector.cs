using System.Security.Cryptography;
using System.Text;

namespace FiuGlobal.DotNet.Services;

/// <summary>
/// Encrypts chat bodies before they reach MySQL. Passwords are one-way
/// hashes; conversations must remain readable by their participants, so they
/// use authenticated encryption instead of an irreversible hash.
/// </summary>
public sealed class ChatMessageProtector
{
    private const string Prefix = "enc:v1:";
    private readonly byte[] _key;

    public ChatMessageProtector()
    {
        var material = ReadEnvironment("CHAT_ENCRYPTION_KEY");
        if (string.IsNullOrWhiteSpace(material)) material = ReadEnvironment("DATA_PROTECTION_KEY");
        if (string.IsNullOrWhiteSpace(material)) material = ReadEnvironment("DB_PASSWORD");
        if (string.IsNullOrWhiteSpace(material)) material = ReadEnvironment("DB_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(material))
        {
            throw new InvalidOperationException("Set CHAT_ENCRYPTION_KEY before enabling database chat storage.");
        }

        _key = SHA256.HashData(Encoding.UTF8.GetBytes($"fiu-global-chat-v1:{material}"));
    }

    public bool IsEncrypted(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.StartsWith(Prefix, StringComparison.Ordinal);

    public string Encrypt(string plaintext)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plainBytes.Length];
        var tag = new byte[16];

        using (var aes = new AesGcm(_key, tag.Length))
        {
            aes.Encrypt(nonce, plainBytes, ciphertext, tag);
        }

        var payload = new byte[nonce.Length + tag.Length + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, payload, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, payload, nonce.Length, tag.Length);
        Buffer.BlockCopy(ciphertext, 0, payload, nonce.Length + tag.Length, ciphertext.Length);
        return Prefix + Convert.ToBase64String(payload);
    }

    public string DecryptOrLegacy(string storedValue)
    {
        if (!IsEncrypted(storedValue)) return storedValue;

        var payload = Convert.FromBase64String(storedValue[Prefix.Length..]);
        if (payload.Length < 12 + 16)
        {
            throw new CryptographicException("Invalid encrypted chat payload.");
        }

        var nonce = payload[..12];
        var tag = payload[12..28];
        var ciphertext = payload[28..];
        var plaintext = new byte[ciphertext.Length];
        using (var aes = new AesGcm(_key, tag.Length))
        {
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
        }

        return Encoding.UTF8.GetString(plaintext);
    }

    private static string ReadEnvironment(string key) =>
        (Environment.GetEnvironmentVariable(key) ?? string.Empty).Trim().Trim('"');
}
