namespace FiuGlobal.DotNet.Services;

public sealed class ChatReminderService : BackgroundService
{
    private readonly AppDataStore _store;
    private readonly ILogger<ChatReminderService> _logger;

    public ChatReminderService(AppDataStore store, ILogger<ChatReminderService> logger)
    {
        _store = store;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessSafely(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ProcessSafely(stoppingToken);
        }
    }

    private async Task ProcessSafely(CancellationToken stoppingToken)
    {
        try
        {
            var sent = await _store.SendPendingChatReplyRemindersAsync(stoppingToken);
            if (sent > 0)
            {
                _logger.LogInformation("Sent {Count} pending chat-reply reminder(s).", sent);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unable to process pending chat-reply reminders.");
        }
    }
}
