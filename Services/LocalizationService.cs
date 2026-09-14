using System.Globalization;
using System.Text.RegularExpressions;

namespace FiuGlobal.DotNet.Services;

/// <summary>
/// Provides the server-side part of the portal's localization contract.
/// Browser UI translations still live in the existing client dictionary, while
/// APIs and background jobs use these stable keys and cultures.
/// </summary>
public sealed class LocalizationService
{
    public const string LanguageCookieName = "FiuGlobal.Language";

    private static readonly string[] SupportedLanguageCodes = ["en", "tr", "fr", "ru", "ar"];
    private static readonly Regex TokenPattern = new("\\{(?<name>[A-Za-z0-9_]+)\\}", RegexOptions.Compiled);

    private static readonly IReadOnlyDictionary<string, CultureInfo> Cultures =
        new Dictionary<string, CultureInfo>(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = CultureInfo.GetCultureInfo("en-US"),
            ["tr"] = CultureInfo.GetCultureInfo("tr-TR"),
            ["fr"] = CultureInfo.GetCultureInfo("fr-FR"),
            ["ru"] = CultureInfo.GetCultureInfo("ru-RU"),
            ["ar"] = CultureInfo.GetCultureInfo("ar-SA")
        };

    private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Resources =
        new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["api.auth.credentialsRequired"] = "Username and password are required.",
                ["api.auth.invalidCredentials"] = "Invalid username or password.",
                ["api.language.updated"] = "Language updated.",
                ["api.language.unsupported"] = "Choose a supported language.",
                ["api.chat.recipientUnavailable"] = "That chat recipient is unavailable.",
                ["api.chat.messageSaveFailed"] = "Your message could not be saved. Please try again.",
                ["system.databaseUnavailable.title"] = "Temporarily unavailable",
                ["system.databaseUnavailable.message"] = "The database service is not reachable. Start MariaDB, then retry this page.",
                ["system.databaseUnavailable.api"] = "Database is temporarily unavailable. Start MariaDB and retry.",
                ["common.retry"] = "Retry",
                ["email.chatReminder.subject"] = "A FIU Global Portal message is awaiting your reply",
                ["email.chatReminder.body"] = "Hello {recipientName},\n\n{senderName} sent you a message in FIU Global Portal more than 48 hours ago. Please sign in to review and reply.\n\nFor privacy, message contents are not included in this email."
            },
            ["tr"] = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["api.auth.credentialsRequired"] = "Kullanıcı adı ve şifre gereklidir.",
                ["api.auth.invalidCredentials"] = "Kullanıcı adı veya şifre geçersiz.",
                ["api.language.updated"] = "Dil güncellendi.",
                ["api.language.unsupported"] = "Desteklenen bir dil seçin.",
                ["api.chat.recipientUnavailable"] = "Bu sohbet kişisine şu anda ulaşılamıyor.",
                ["api.chat.messageSaveFailed"] = "Mesajınız kaydedilemedi. Lütfen tekrar deneyin.",
                ["system.databaseUnavailable.title"] = "Geçici olarak kullanılamıyor",
                ["system.databaseUnavailable.message"] = "Veritabanı hizmetine ulaşılamıyor. MariaDB'yi başlatıp bu sayfayı yeniden deneyin.",
                ["system.databaseUnavailable.api"] = "Veritabanı geçici olarak kullanılamıyor. MariaDB'yi başlatıp yeniden deneyin.",
                ["common.retry"] = "Yeniden dene",
                ["email.chatReminder.subject"] = "FIU Global Portal'da yanıtınızı bekleyen bir mesaj var",
                ["email.chatReminder.body"] = "Merhaba {recipientName},\n\n{senderName}, 48 saatten uzun süre önce size FIU Global Portal üzerinden bir mesaj gönderdi. İncelemek ve yanıtlamak için lütfen giriş yapın.\n\nGizliliğiniz için mesaj içeriği bu e-postaya eklenmemiştir."
            },
            ["fr"] = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["api.auth.credentialsRequired"] = "Le nom d’utilisateur et le mot de passe sont obligatoires.",
                ["api.auth.invalidCredentials"] = "Nom d’utilisateur ou mot de passe incorrect.",
                ["api.language.updated"] = "Langue mise à jour.",
                ["api.language.unsupported"] = "Choisissez une langue prise en charge.",
                ["api.chat.recipientUnavailable"] = "Ce contact de discussion n’est pas disponible.",
                ["api.chat.messageSaveFailed"] = "Votre message n’a pas pu être enregistré. Veuillez réessayer.",
                ["system.databaseUnavailable.title"] = "Temporairement indisponible",
                ["system.databaseUnavailable.message"] = "Le service de base de données est inaccessible. Démarrez MariaDB, puis réessayez cette page.",
                ["system.databaseUnavailable.api"] = "La base de données est temporairement indisponible. Démarrez MariaDB et réessayez.",
                ["common.retry"] = "Réessayer",
                ["email.chatReminder.subject"] = "Un message FIU Global Portal attend votre réponse",
                ["email.chatReminder.body"] = "Bonjour {recipientName},\n\n{senderName} vous a envoyé un message dans FIU Global Portal il y a plus de 48 heures. Connectez-vous pour le consulter et y répondre.\n\nPour protéger votre vie privée, le contenu du message n’est pas inclus dans cet e-mail."
            },
            ["ru"] = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["api.auth.credentialsRequired"] = "Требуются имя пользователя и пароль.",
                ["api.auth.invalidCredentials"] = "Неверное имя пользователя или пароль.",
                ["api.language.updated"] = "Язык обновлён.",
                ["api.language.unsupported"] = "Выберите поддерживаемый язык.",
                ["api.chat.recipientUnavailable"] = "Этот собеседник сейчас недоступен.",
                ["api.chat.messageSaveFailed"] = "Не удалось сохранить сообщение. Повторите попытку.",
                ["system.databaseUnavailable.title"] = "Временно недоступно",
                ["system.databaseUnavailable.message"] = "Служба базы данных недоступна. Запустите MariaDB, затем повторите попытку.",
                ["system.databaseUnavailable.api"] = "База данных временно недоступна. Запустите MariaDB и повторите попытку.",
                ["common.retry"] = "Повторить",
                ["email.chatReminder.subject"] = "Вас ждёт сообщение в FIU Global Portal",
                ["email.chatReminder.body"] = "Здравствуйте, {recipientName}!\n\n{senderName} отправил(а) вам сообщение в FIU Global Portal более 48 часов назад. Войдите в систему, чтобы прочитать его и ответить.\n\nВ целях конфиденциальности содержание сообщения не включено в это письмо."
            },
            ["ar"] = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["api.auth.credentialsRequired"] = "اسم المستخدم وكلمة المرور مطلوبان.",
                ["api.auth.invalidCredentials"] = "اسم المستخدم أو كلمة المرور غير صحيحة.",
                ["api.language.updated"] = "تم تحديث اللغة.",
                ["api.language.unsupported"] = "يرجى اختيار لغة مدعومة.",
                ["api.chat.recipientUnavailable"] = "جهة اتصال الدردشة هذه غير متاحة.",
                ["api.chat.messageSaveFailed"] = "تعذر حفظ رسالتك. يرجى المحاولة مرة أخرى.",
                ["system.databaseUnavailable.title"] = "غير متاح مؤقتًا",
                ["system.databaseUnavailable.message"] = "لا يمكن الوصول إلى خدمة قاعدة البيانات. ابدأ MariaDB ثم أعد محاولة هذه الصفحة.",
                ["system.databaseUnavailable.api"] = "قاعدة البيانات غير متاحة مؤقتًا. ابدأ MariaDB ثم أعد المحاولة.",
                ["common.retry"] = "إعادة المحاولة",
                ["email.chatReminder.subject"] = "هناك رسالة في FIU Global Portal بانتظار ردك",
                ["email.chatReminder.body"] = "مرحبًا {recipientName}،\n\nأرسل لك {senderName} رسالة في FIU Global Portal منذ أكثر من 48 ساعة. يرجى تسجيل الدخول لمراجعتها والرد عليها.\n\nلحماية خصوصيتك، لا يتضمن هذا البريد محتوى الرسالة."
            }
        };

    public IReadOnlyCollection<string> SupportedLanguages => SupportedLanguageCodes;

    public string ResolveLanguage(HttpRequest request)
    {
        if (request.Cookies.TryGetValue(LanguageCookieName, out var cookieLanguage) && IsSupportedLanguage(cookieLanguage))
        {
            return NormalizeLanguage(cookieLanguage);
        }

        var acceptLanguage = request.Headers.AcceptLanguage.ToString();
        foreach (var candidate in acceptLanguage.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var language = candidate.Split(';', 2)[0];
            if (IsSupportedLanguage(language))
            {
                return NormalizeLanguage(language);
            }
        }

        return "en";
    }

    public bool IsSupportedLanguage(string? language) =>
        TryGetLanguageCode(language) is { } normalized &&
        SupportedLanguageCodes.Contains(normalized, StringComparer.OrdinalIgnoreCase);

    public static string NormalizeLanguage(string? language)
    {
        var normalized = TryGetLanguageCode(language);
        return normalized is not null && SupportedLanguageCodes.Contains(normalized, StringComparer.OrdinalIgnoreCase)
            ? normalized
            : "en";
    }

    public CultureInfo GetCulture(string? language) => Cultures[NormalizeLanguage(language)];

    public bool IsRightToLeft(string? language) => NormalizeLanguage(language) == "ar";

    public string Translate(string? language, string key, IReadOnlyDictionary<string, object?>? arguments = null)
    {
        var normalizedLanguage = NormalizeLanguage(language);
        var template = Resources[normalizedLanguage].TryGetValue(key, out var localized)
            ? localized
            : Resources["en"].TryGetValue(key, out var english)
                ? english
                : key;

        if (arguments is null || arguments.Count == 0) return template;

        var culture = GetCulture(normalizedLanguage);
        return TokenPattern.Replace(template, match =>
        {
            var name = match.Groups["name"].Value;
            if (!arguments.TryGetValue(name, out var value) || value is null) return match.Value;
            return value switch
            {
                IFormattable formattable => formattable.ToString(null, culture),
                _ => Convert.ToString(value, culture) ?? string.Empty
            };
        });
    }

    public LocalizedEmailTemplate GetChatReplyReminder(string? language, string recipientName, string senderName)
    {
        var arguments = new Dictionary<string, object?>
        {
            ["recipientName"] = recipientName,
            ["senderName"] = senderName
        };
        return new LocalizedEmailTemplate(
            Translate(language, "email.chatReminder.subject", arguments),
            Translate(language, "email.chatReminder.body", arguments));
    }

    private static string? TryGetLanguageCode(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return null;
        return language.Trim().Replace('_', '-').Split('-', 2)[0].ToLowerInvariant();
    }
}

public sealed record LocalizedEmailTemplate(string Subject, string Body);

/// <summary>
/// Additive JSON envelopes for localized API feedback. Existing `message` and
/// `error` fields are retained, while clients can prefer the stable key/args.
/// </summary>
public static class LocalizedApi
{
    private static readonly IReadOnlyDictionary<string, object?> EmptyArguments = new Dictionary<string, object?>();

    public static IResult Success(HttpContext context, LocalizationService localizer, string key, IReadOnlyDictionary<string, object?>? arguments = null, int statusCode = StatusCodes.Status200OK, string? language = null)
    {
        var values = arguments ?? EmptyArguments;
        var resolvedLanguage = language is null ? localizer.ResolveLanguage(context.Request) : LocalizationService.NormalizeLanguage(language);
        return Results.Json(new
        {
            success = true,
            message = localizer.Translate(resolvedLanguage, key, values),
            message_key = key,
            message_args = values
        }, statusCode: statusCode);
    }

    public static IResult Error(HttpContext context, LocalizationService localizer, int statusCode, string key, IReadOnlyDictionary<string, object?>? arguments = null)
    {
        var values = arguments ?? EmptyArguments;
        var language = localizer.ResolveLanguage(context.Request);
        return Results.Json(new
        {
            success = false,
            error = localizer.Translate(language, key, values),
            error_key = key,
            error_args = values
        }, statusCode: statusCode);
    }

    public static object ErrorPayload(HttpContext context, LocalizationService localizer, string key, IReadOnlyDictionary<string, object?>? arguments = null)
    {
        var values = arguments ?? EmptyArguments;
        var language = localizer.ResolveLanguage(context.Request);
        return new
        {
            error = localizer.Translate(language, key, values),
            error_key = key,
            error_args = values
        };
    }
}
