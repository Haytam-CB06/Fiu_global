using FiuGlobal.DotNet.Models;
using MySqlConnector;
using System.Security.Cryptography;
using System.Text.Json;

namespace FiuGlobal.DotNet.Services;

public sealed class DatabaseStateStorage
{
    private const string StateKey = "default";
    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly ChatMessageProtector? _chatProtector;
    public bool IsConfigured { get; private set; }
    public string? InitializationError { get; private set; }

    public DatabaseStateStorage(JsonSerializerOptions jsonOptions)
    {
        _jsonOptions = jsonOptions;
        _connectionString = BuildConnectionString();
        _chatProtector = string.IsNullOrWhiteSpace(_connectionString) ? null : new ChatMessageProtector();
        TryInitialize();
    }

    public bool TryInitialize()
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            IsConfigured = false;
            InitializationError = "Configure DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD.";
            return false;
        }

        try
        {
            EnsureSchema();
            MigrateLegacyChatMessages();
            IsConfigured = true;
            InitializationError = null;
            return true;
        }
        catch (Exception ex)
        {
            IsConfigured = false;
            InitializationError = ex.Message;
            return false;
        }
    }

    public void MarkUnavailable(Exception exception)
    {
        IsConfigured = false;
        InitializationError = string.IsNullOrWhiteSpace(exception.Message)
            ? "Database storage is temporarily unavailable."
            : exception.Message;
    }

    public AppState? LoadState()
    {
        if (!IsConfigured)
        {
            return null;
        }

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT state_json FROM dotnet_app_state WHERE state_key = @state_key LIMIT 1";
            command.Parameters.AddWithValue("@state_key", StateKey);
            var json = command.ExecuteScalar() as string;
            return string.IsNullOrWhiteSpace(json) ? null : JsonSerializer.Deserialize<AppState>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    /// <summary>
    /// Imports accounts that were created by the older PHP application and
    /// makes <c>users.id</c> the canonical user identifier everywhere in the
    /// portal. Chat rows must use the same identifier that phpMyAdmin and the
    /// legacy application expose; keeping a separate JSON-only ID causes
    /// sender_id/recipient_id to point at the wrong person after an import.
    /// </summary>
    public void MergeLegacyAccounts(AppState state)
    {
        if (!IsConfigured) return;

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();

            var legacyUsers = new List<LegacyUserRow>();
            if (LegacyTableExists(connection, "users"))
            {
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT id, username, password, email, role, created_at FROM users ORDER BY id";
                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var username = ReadString(reader, "username");
                    var email = ReadString(reader, "email");
                    if (string.IsNullOrWhiteSpace(username)) continue;
                    legacyUsers.Add(new LegacyUserRow(
                        reader.GetInt32("id"),
                        username,
                        ReadString(reader, "password"),
                        email,
                        ReadString(reader, "role"),
                        ReadDate(reader, "created_at")));
                }
            }

            ReconcileUserIds(state, connection, legacyUsers);

            var nextAdminId = state.Admins.Count == 0 ? 1 : state.Admins.Max(item => item.Id) + 1;
            if (LegacyTableExists(connection, "admins"))
            {
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT id, username, password, email, role, is_active, created_at, last_login FROM admins ORDER BY id";
                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var username = ReadString(reader, "username");
                    var email = ReadString(reader, "email");
                    if (string.IsNullOrWhiteSpace(username) ||
                        state.Admins.Any(item => item.Username.Equals(username, StringComparison.OrdinalIgnoreCase) ||
                                                 (!string.IsNullOrWhiteSpace(email) && item.Email.Equals(email, StringComparison.OrdinalIgnoreCase))))
                    {
                        continue;
                    }

                    state.Admins.Add(new AdminAccount
                    {
                        Id = nextAdminId++,
                        Username = username,
                        Password = ReadString(reader, "password"),
                        Email = email,
                        Role = "admin",
                        IsActive = ReadBoolean(reader, "is_active"),
                        CreatedAt = ReadDate(reader, "created_at"),
                        LastLogin = ReadNullableDate(reader, "last_login")
                    });
                }
            }

            state.Counters.NextAdminId = Math.Max(state.Counters.NextAdminId, nextAdminId);
        }
        catch (Exception ex)
        {
            // Import is additive and optional. Keep the normal JSON state
            // available if an older installation has a different schema.
            Console.Error.WriteLine($"Legacy account import skipped: {ex.Message}");
        }
    }

    /// <summary>
    /// Adds the relational guarantees once every persisted chat row has been
    /// reconciled. Some legacy installations use a non-InnoDB users table, so
    /// failure to add the optional database constraint must not take the portal
    /// offline; the application-level canonical-ID validation still applies.
    /// </summary>
    public void EnsureChatUserForeignKeys()
    {
        if (!IsConfigured) return;

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            if (!LegacyTableExists(connection, "users") || HasInvalidChatUserReferences(connection)) return;

            EnsureChatForeignKey(connection, "fk_dotnet_chat_sender_user", "sender_id");
            EnsureChatForeignKey(connection, "fk_dotnet_chat_recipient_user", "recipient_id");
        }
        catch
        {
            // The portal continues securely when a host cannot add foreign
            // keys (for example, an older MyISAM users table). Never include
            // provider diagnostics or connection details in application logs.
            Console.Error.WriteLine("Chat user foreign-key enforcement was not added by this host.");
        }
    }

    public void SaveState(AppState state)
    {
        if (!IsConfigured)
        {
            return;
        }

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dotnet_app_state (state_key, state_json, updated_at)
                VALUES (@state_key, @state_json, UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = UTC_TIMESTAMP()
                """;
            command.Parameters.AddWithValue("@state_key", StateKey);
            command.Parameters.AddWithValue("@state_json", JsonSerializer.Serialize(state, _jsonOptions));
            command.ExecuteNonQuery();

            SyncFacultyDirectory(connection, state);

            // Keep the legacy relational tables in sync as well. The .NET
            // application has fields (role-access rules, profile details,
            // etc.) that do not exist in the original PHP schema, so the JSON
            // document remains the complete backup while these tables expose
            // the core records to the existing phpMyAdmin/PHP tooling.
            SyncLegacyTablesBestEffort(state);
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    public Dictionary<string, SessionInfo> LoadSessions()
    {
        var sessions = new Dictionary<string, SessionInfo>(StringComparer.Ordinal);
        if (!IsConfigured)
        {
            return sessions;
        }

        using var connection = new MySqlConnection(_connectionString);
        connection.Open();
        using var cleanup = connection.CreateCommand();
        cleanup.CommandText = "DELETE FROM dotnet_sessions WHERE expires_at <= UTC_TIMESTAMP()";
        cleanup.ExecuteNonQuery();

        using var command = connection.CreateCommand();
        command.CommandText = "SELECT token, session_json FROM dotnet_sessions";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var token = reader.GetString("token");
            var json = reader.GetString("session_json");
            var session = JsonSerializer.Deserialize<SessionInfo>(json, _jsonOptions);
            if (session is not null)
            {
                sessions[token] = session;
            }
        }

        return sessions;
    }

    public void SaveSession(SessionInfo session)
    {
        if (!IsConfigured)
        {
            return;
        }

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dotnet_sessions (token, session_json, expires_at, updated_at)
                VALUES (@token, @session_json, @expires_at, UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE session_json = VALUES(session_json), expires_at = VALUES(expires_at), updated_at = UTC_TIMESTAMP()
                """;
            command.Parameters.AddWithValue("@token", session.Token);
            command.Parameters.AddWithValue("@session_json", JsonSerializer.Serialize(session, _jsonOptions));
            command.Parameters.AddWithValue("@expires_at", session.ExpiresAt);
            command.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    public void DeleteSession(string token)
    {
        if (!IsConfigured)
        {
            return;
        }

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM dotnet_sessions WHERE token = @token";
            command.Parameters.AddWithValue("@token", token);
            command.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    public void SaveChatMessage(ChatMessageItem message)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Database storage is unavailable.");
        }

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dotnet_chat_messages
                    (message_id, sender_id, recipient_id, message_text, sent_at, received_at, seen_at, reminder_sent_at)
                VALUES
                    (@message_id, @sender_id, @recipient_id, @message_text, @sent_at, @received_at, @seen_at, @reminder_sent_at)
                """;
            command.Parameters.AddWithValue("@message_id", message.Id);
            command.Parameters.AddWithValue("@sender_id", message.SenderId);
            command.Parameters.AddWithValue("@recipient_id", message.RecipientId);
            command.Parameters.AddWithValue("@message_text", (_chatProtector ?? throw new InvalidOperationException("Chat encryption is unavailable.")).Encrypt(message.Text));
            command.Parameters.AddWithValue("@sent_at", message.SentAt.UtcDateTime);
            command.Parameters.AddWithValue("@received_at", message.ReceivedAt?.UtcDateTime ?? (object)DBNull.Value);
            command.Parameters.AddWithValue("@seen_at", message.SeenAt?.UtcDateTime ?? (object)DBNull.Value);
            command.Parameters.AddWithValue("@reminder_sent_at", message.ReminderSentAt?.UtcDateTime ?? (object)DBNull.Value);
            command.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    public List<ChatMessageItem> LoadChatMessages(int userId, int otherUserId, int limit = 200)
    {
        var messages = new List<ChatMessageItem>();
        if (!IsConfigured)
        {
            return messages;
        }

        try
        {
            limit = Math.Clamp(limit, 1, 500);
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT message_id, sender_id, recipient_id, message_text, sent_at, received_at, seen_at, reminder_sent_at
                FROM dotnet_chat_messages
                WHERE (sender_id = @user_id AND recipient_id = @other_user_id)
                   OR (sender_id = @other_user_id AND recipient_id = @user_id)
                ORDER BY sent_at DESC
                LIMIT @limit
                """;
            command.Parameters.AddWithValue("@user_id", userId);
            command.Parameters.AddWithValue("@other_user_id", otherUserId);
            command.Parameters.AddWithValue("@limit", limit);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var sentAt = DateTime.SpecifyKind(reader.GetDateTime("sent_at"), DateTimeKind.Utc);
                var storedText = reader.GetString("message_text");
                var messageText = DecryptChatText(storedText);
                messages.Add(new ChatMessageItem
                {
                    Id = reader.GetString("message_id"),
                    SenderId = reader.GetInt32("sender_id"),
                    RecipientId = reader.GetInt32("recipient_id"),
                    Text = messageText,
                    SentAt = new DateTimeOffset(sentAt),
                    ReceivedAt = ReadNullableDateTimeOffset(reader, "received_at"),
                    SeenAt = ReadNullableDateTimeOffset(reader, "seen_at"),
                    ReminderSentAt = ReadNullableDateTimeOffset(reader, "reminder_sent_at")
                });
            }
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            return messages;
        }

        messages.Reverse();
        return messages;
    }

    private string DecryptChatText(string storedText)
    {
        try
        {
            return (_chatProtector ?? throw new InvalidOperationException("Chat encryption is unavailable.")).DecryptOrLegacy(storedText);
        }
        catch (CryptographicException)
        {
            // A message written with a retired encryption key should not hide
            // the rest of the conversation or suppress its unread count.
            return "[Protected message]";
        }
        catch (FormatException)
        {
            // Keep malformed legacy ciphertext visible as a protected item
            // while allowing valid messages in the same conversation to load.
            return "[Protected message]";
        }
    }

    public ChatMessageStatusUpdate? UpdateChatMessageStatus(string messageId, int recipientId, bool seen)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(messageId)) return null;

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = seen
                    ? """
                        UPDATE dotnet_chat_messages
                        SET received_at = COALESCE(received_at, UTC_TIMESTAMP(6)),
                            seen_at = COALESCE(seen_at, UTC_TIMESTAMP(6))
                        WHERE message_id = @message_id AND recipient_id = @recipient_id
                        """
                    : """
                        UPDATE dotnet_chat_messages
                        SET received_at = COALESCE(received_at, UTC_TIMESTAMP(6))
                        WHERE message_id = @message_id AND recipient_id = @recipient_id
                        """;
                command.Parameters.AddWithValue("@message_id", messageId);
                command.Parameters.AddWithValue("@recipient_id", recipientId);
                if (command.ExecuteNonQuery() == 0) return null;
            }

            using var select = connection.CreateCommand();
            select.CommandText = """
                SELECT message_id, sender_id, recipient_id, received_at, seen_at
                FROM dotnet_chat_messages
                WHERE message_id = @message_id AND recipient_id = @recipient_id
                """;
            select.Parameters.AddWithValue("@message_id", messageId);
            select.Parameters.AddWithValue("@recipient_id", recipientId);
            using var reader = select.ExecuteReader();
            if (!reader.Read()) return null;
            return new ChatMessageStatusUpdate
            {
                MessageId = reader.GetString("message_id"),
                SenderId = reader.GetInt32("sender_id"),
                RecipientId = reader.GetInt32("recipient_id"),
                ReceivedAt = ReadNullableDateTimeOffset(reader, "received_at"),
                SeenAt = ReadNullableDateTimeOffset(reader, "seen_at")
            };
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            return null;
        }
    }

    public List<ChatReplyReminderCandidate> GetUnansweredChatReminderCandidates(DateTimeOffset cutoff)
    {
        var candidates = new List<ChatReplyReminderCandidate>();
        if (!IsConfigured) return candidates;

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT message_id, sender_id, recipient_id, sent_at
                FROM dotnet_chat_messages AS message
                WHERE message.sent_at <= @cutoff
                  AND message.seen_at IS NULL
                  AND message.reminder_sent_at IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dotnet_chat_messages AS reply
                      WHERE reply.sender_id = message.recipient_id
                        AND reply.recipient_id = message.sender_id
                        AND reply.sent_at > message.sent_at
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dotnet_chat_messages AS newer_message
                      WHERE newer_message.sender_id = message.sender_id
                        AND newer_message.recipient_id = message.recipient_id
                        AND newer_message.sent_at > message.sent_at
                  )
                ORDER BY message.sent_at
                LIMIT 100
                """;
            command.Parameters.AddWithValue("@cutoff", cutoff.UtcDateTime);
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                candidates.Add(new ChatReplyReminderCandidate
                {
                    MessageId = reader.GetString("message_id"),
                    SenderId = reader.GetInt32("sender_id"),
                    RecipientId = reader.GetInt32("recipient_id"),
                    SentAt = new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime("sent_at"), DateTimeKind.Utc))
                });
            }
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
        }

        return candidates;
    }

    public bool MarkChatReminderSent(string messageId, DateTimeOffset sentAt)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(messageId)) return false;
        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                UPDATE dotnet_chat_messages
                SET reminder_sent_at = @reminder_sent_at
                WHERE message_id = @message_id AND reminder_sent_at IS NULL
                """;
            command.Parameters.AddWithValue("@message_id", messageId);
            command.Parameters.AddWithValue("@reminder_sent_at", sentAt.UtcDateTime);
            return command.ExecuteNonQuery() > 0;
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            return false;
        }
    }

    public void MergeFacultyDirectory(AppState state)
    {
        if (!IsConfigured) return;

        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();
            using (var facultyCommand = connection.CreateCommand())
            {
                facultyCommand.CommandText = "SELECT id, name, is_active, created_at, updated_at FROM dotnet_faculties ORDER BY name";
                using var reader = facultyCommand.ExecuteReader();
                while (reader.Read())
                {
                    var imported = new FacultyItem
                    {
                        Id = reader.GetInt32("id"),
                        Name = reader.GetString("name"),
                        IsActive = ReadBoolean(reader, "is_active"),
                        CreatedAt = ReadDate(reader, "created_at"),
                        UpdatedAt = ReadDate(reader, "updated_at")
                    };
                    var existing = state.Faculties.FirstOrDefault(item => item.Id == imported.Id);
                    if (existing is null)
                    {
                        state.Faculties.Add(imported);
                    }
                    else
                    {
                        existing.Name = imported.Name;
                        existing.IsActive = imported.IsActive;
                        existing.CreatedAt = imported.CreatedAt;
                        existing.UpdatedAt = imported.UpdatedAt;
                    }
                }
            }

            using var departmentCommand = connection.CreateCommand();
            departmentCommand.CommandText = "SELECT id, faculty_id, name, is_active, created_at, updated_at FROM dotnet_departments ORDER BY faculty_id, name";
            using var departmentReader = departmentCommand.ExecuteReader();
            while (departmentReader.Read())
            {
                var imported = new DepartmentItem
                {
                    Id = departmentReader.GetInt32("id"),
                    FacultyId = departmentReader.GetInt32("faculty_id"),
                    Name = departmentReader.GetString("name"),
                    IsActive = ReadBoolean(departmentReader, "is_active"),
                    CreatedAt = ReadDate(departmentReader, "created_at"),
                    UpdatedAt = ReadDate(departmentReader, "updated_at")
                };
                var existing = state.Departments.FirstOrDefault(item => item.Id == imported.Id);
                if (existing is null)
                {
                    state.Departments.Add(imported);
                }
                else
                {
                    existing.FacultyId = imported.FacultyId;
                    existing.Name = imported.Name;
                    existing.IsActive = imported.IsActive;
                    existing.CreatedAt = imported.CreatedAt;
                    existing.UpdatedAt = imported.UpdatedAt;
                }
            }
        }
        catch (Exception ex)
        {
            MarkUnavailable(ex);
            throw;
        }
    }

    private void ReconcileUserIds(AppState state, MySqlConnection connection, IReadOnlyList<LegacyUserRow> legacyUsers)
    {
        state.UserPlatformAccess ??= [];
        state.ActivityLogs ??= [];

        var stateUsers = state.Users.ToList();
        var legacyIds = legacyUsers.Select(item => item.Id).ToHashSet();
        var claimedLegacyIds = new HashSet<int>();
        var desiredIds = new Dictionary<int, int>();

        // First reserve the IDs belonging to accounts we can identify by the
        // immutable account identifiers available in the legacy system.
        foreach (var user in stateUsers)
        {
            var legacyUser = legacyUsers.FirstOrDefault(item =>
                !claimedLegacyIds.Contains(item.Id) &&
                (item.Username.Equals(user.Username, StringComparison.OrdinalIgnoreCase) ||
                 (!string.IsNullOrWhiteSpace(user.Email) && item.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase))));
            if (legacyUser is null) continue;

            desiredIds[user.Id] = legacyUser.Id;
            claimedLegacyIds.Add(legacyUser.Id);
        }

        // State-only accounts are assigned an unused, deterministic ID above
        // both current ranges. SyncLegacyUsers then inserts that exact ID,
        // rather than relying on MySQL AUTO_INCREMENT to choose a different
        // value after the chat message has already been written.
        var usedDesiredIds = desiredIds.Values.ToHashSet();
        var nextAvailableId = Math.Max(
            stateUsers.Count == 0 ? 0 : stateUsers.Max(item => item.Id),
            legacyUsers.Count == 0 ? 0 : legacyUsers.Max(item => item.Id)) + 1;
        foreach (var user in stateUsers.Where(item => !desiredIds.ContainsKey(item.Id)))
        {
            if (!legacyIds.Contains(user.Id) && !usedDesiredIds.Contains(user.Id))
            {
                desiredIds[user.Id] = user.Id;
                usedDesiredIds.Add(user.Id);
                continue;
            }

            while (legacyIds.Contains(nextAvailableId) || usedDesiredIds.Contains(nextAvailableId))
            {
                nextAvailableId++;
            }

            desiredIds[user.Id] = nextAvailableId;
            usedDesiredIds.Add(nextAvailableId++);
        }

        var remappedIds = desiredIds
            .Where(item => item.Key != item.Value)
            .ToDictionary(item => item.Key, item => item.Value);
        if (remappedIds.Count > 0)
        {
            RemapPersistedUserIds(connection, remappedIds);
            ApplyUserIdRemapToState(state, remappedIds);
        }

        foreach (var legacyUser in legacyUsers.Where(item => !claimedLegacyIds.Contains(item.Id)))
        {
            state.Users.Add(new UserAccount
            {
                Id = legacyUser.Id,
                Username = legacyUser.Username,
                Password = legacyUser.Password,
                Email = legacyUser.Email,
                Role = string.Equals(legacyUser.Role, "student", StringComparison.OrdinalIgnoreCase) ? "student" : "instructor",
                CreatedAt = legacyUser.CreatedAt
            });
        }

        state.Counters.NextUserId = Math.Max(
            state.Counters.NextUserId,
            state.Users.Count == 0 ? 1 : state.Users.Max(item => item.Id) + 1);
    }

    private void RemapPersistedUserIds(MySqlConnection connection, IReadOnlyDictionary<int, int> remappedIds)
    {
        using var transaction = connection.BeginTransaction();
        try
        {
            var orderedMappings = remappedIds.OrderBy(item => item.Key).ToList();
            using (var updateChat = connection.CreateCommand())
            {
                updateChat.Transaction = transaction;
                var senderCases = new List<string>();
                var recipientCases = new List<string>();
                var sourceIds = new List<string>();
                for (var index = 0; index < orderedMappings.Count; index++)
                {
                    var sourceParameter = $"@source_{index}";
                    var destinationParameter = $"@destination_{index}";
                    senderCases.Add($"WHEN {sourceParameter} THEN {destinationParameter}");
                    recipientCases.Add($"WHEN {sourceParameter} THEN {destinationParameter}");
                    sourceIds.Add(sourceParameter);
                    updateChat.Parameters.AddWithValue(sourceParameter, orderedMappings[index].Key);
                    updateChat.Parameters.AddWithValue(destinationParameter, orderedMappings[index].Value);
                }

                updateChat.CommandText = $"""
                    UPDATE dotnet_chat_messages
                    SET sender_id = CASE sender_id {string.Join(' ', senderCases)} ELSE sender_id END,
                        recipient_id = CASE recipient_id {string.Join(' ', recipientCases)} ELSE recipient_id END
                    WHERE sender_id IN ({string.Join(", ", sourceIds)})
                       OR recipient_id IN ({string.Join(", ", sourceIds)})
                    """;
                updateChat.ExecuteNonQuery();
            }

            var sessionUpdates = new List<(string Token, SessionInfo Session)>();
            using (var selectSessions = connection.CreateCommand())
            {
                selectSessions.Transaction = transaction;
                selectSessions.CommandText = "SELECT token, session_json FROM dotnet_sessions";
                using var reader = selectSessions.ExecuteReader();
                while (reader.Read())
                {
                    var session = JsonSerializer.Deserialize<SessionInfo>(reader.GetString("session_json"), _jsonOptions);
                    if (session?.UserId is not int userId || !remappedIds.TryGetValue(userId, out var canonicalUserId)) continue;

                    session.UserId = canonicalUserId;
                    sessionUpdates.Add((reader.GetString("token"), session));
                }
            }

            foreach (var update in sessionUpdates)
            {
                using var updateSession = connection.CreateCommand();
                updateSession.Transaction = transaction;
                updateSession.CommandText = "UPDATE dotnet_sessions SET session_json = @session_json, updated_at = UTC_TIMESTAMP() WHERE token = @token";
                updateSession.Parameters.AddWithValue("@token", update.Token);
                updateSession.Parameters.AddWithValue("@session_json", JsonSerializer.Serialize(update.Session, _jsonOptions));
                updateSession.ExecuteNonQuery();
            }

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    private static void ApplyUserIdRemapToState(AppState state, IReadOnlyDictionary<int, int> remappedIds)
    {
        foreach (var user in state.Users)
        {
            if (remappedIds.TryGetValue(user.Id, out var canonicalUserId)) user.Id = canonicalUserId;
        }

        foreach (var access in state.UserPlatformAccess)
        {
            if (remappedIds.TryGetValue(access.UserId, out var canonicalUserId)) access.UserId = canonicalUserId;
        }

        foreach (var activity in state.ActivityLogs)
        {
            if (activity.UserId is int userId && remappedIds.TryGetValue(userId, out var canonicalUserId))
            {
                activity.UserId = canonicalUserId;
            }
        }
    }

    private void MigrateLegacyChatMessages()
    {
        if (string.IsNullOrWhiteSpace(_connectionString) || _chatProtector is null) return;

        using var connection = new MySqlConnection(_connectionString);
        connection.Open();
        var legacyMessages = new List<(string Id, string Text)>();
        using (var select = connection.CreateCommand())
        {
            select.CommandText = """
                SELECT message_id, message_text
                FROM dotnet_chat_messages
                WHERE message_text NOT LIKE 'enc:v1:%'
                """;
            using var reader = select.ExecuteReader();
            while (reader.Read())
            {
                legacyMessages.Add((reader.GetString("message_id"), reader.GetString("message_text")));
            }
        }

        foreach (var message in legacyMessages)
        {
            using var update = connection.CreateCommand();
            update.CommandText = """
                UPDATE dotnet_chat_messages
                SET message_text = @message_text
                WHERE message_id = @message_id AND message_text NOT LIKE 'enc:v1:%'
                """;
            update.Parameters.AddWithValue("@message_id", message.Id);
            update.Parameters.AddWithValue("@message_text", _chatProtector.Encrypt(message.Text));
            update.ExecuteNonQuery();
        }
    }

    private static void SyncFacultyDirectory(MySqlConnection connection, AppState state)
    {
        foreach (var faculty in state.Faculties)
        {
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dotnet_faculties (id, name, is_active, created_at, updated_at)
                VALUES (@id, @name, @is_active, @created_at, @updated_at)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), is_active = VALUES(is_active), updated_at = VALUES(updated_at)
                """;
            command.Parameters.AddWithValue("@id", faculty.Id);
            command.Parameters.AddWithValue("@name", faculty.Name);
            command.Parameters.AddWithValue("@is_active", faculty.IsActive);
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(faculty.CreatedAt));
            command.Parameters.AddWithValue("@updated_at", ToDatabaseDate(faculty.UpdatedAt));
            command.ExecuteNonQuery();
        }

        foreach (var department in state.Departments)
        {
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dotnet_departments (id, faculty_id, name, is_active, created_at, updated_at)
                VALUES (@id, @faculty_id, @name, @is_active, @created_at, @updated_at)
                ON DUPLICATE KEY UPDATE
                    faculty_id = VALUES(faculty_id), name = VALUES(name), is_active = VALUES(is_active), updated_at = VALUES(updated_at)
                """;
            command.Parameters.AddWithValue("@id", department.Id);
            command.Parameters.AddWithValue("@faculty_id", department.FacultyId);
            command.Parameters.AddWithValue("@name", department.Name);
            command.Parameters.AddWithValue("@is_active", department.IsActive);
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(department.CreatedAt));
            command.Parameters.AddWithValue("@updated_at", ToDatabaseDate(department.UpdatedAt));
            command.ExecuteNonQuery();
        }

        DeleteStaleDirectoryRows(connection, "dotnet_departments", state.Departments.Select(item => item.Id));
        DeleteStaleDirectoryRows(connection, "dotnet_faculties", state.Faculties.Select(item => item.Id));
    }

    private static void DeleteStaleDirectoryRows(MySqlConnection connection, string table, IEnumerable<int> ids)
    {
        var idList = ids.Where(id => id > 0).Distinct().OrderBy(id => id).ToList();
        using var command = connection.CreateCommand();
        command.CommandText = idList.Count == 0
            ? $"DELETE FROM `{table}`"
            : $"DELETE FROM `{table}` WHERE id NOT IN ({string.Join(',', idList)})";
        command.ExecuteNonQuery();
    }

    private void SyncLegacyTablesBestEffort(AppState state)
    {
        try
        {
            using var connection = new MySqlConnection(_connectionString);
            connection.Open();

            RunLegacySync("users", () => SyncLegacyUsers(connection, state.Users));
            RunLegacySync("admins", () => SyncLegacyAdmins(connection, state.Admins));
            RunLegacySync("platforms", () => SyncLegacyPlatforms(connection, state.Platforms));
            RunLegacySync("announcements", () => SyncLegacyAnnouncements(connection, state.Announcements));
            RunLegacySync("dining_menu", () => SyncLegacyDiningMenus(connection, state.DiningMenus));
            RunLegacySync("holidays_days_off", () => SyncLegacyHolidays(connection, state.Holidays));
        }
        catch (Exception ex)
        {
            // A legacy table can differ between installations. Do not take
            // the whole .NET application offline when that optional mirror
            // cannot be updated; dotnet_app_state was already saved above.
            Console.Error.WriteLine($"Legacy relational-table sync skipped: {ex.Message}");
        }
    }

    private static void RunLegacySync(string tableName, Action sync)
    {
        try
        {
            sync();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Legacy table '{tableName}' was not synchronized: {ex.Message}");
        }
    }

    private static void SyncLegacyUsers(MySqlConnection connection, IEnumerable<UserAccount> users)
    {
        if (!LegacyTableExists(connection, "users")) return;

        foreach (var user in users.Where(item => !string.IsNullOrWhiteSpace(item.Username)))
        {
            var matchedLegacyId = FindLegacyId(connection, "users", user.Email, user.Username);
            if (matchedLegacyId.HasValue && matchedLegacyId.Value != user.Id)
            {
                // Never let an email/username unique key redirect an update to
                // a different account ID. The next startup reconciliation can
                // safely resolve an externally-created legacy account.
                Console.Error.WriteLine("Legacy user synchronization skipped an unresolved account-ID collision.");
                continue;
            }

            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO users (id, username, password, email, role, created_at)
                VALUES (@id, @username, @password, @email, @role, @created_at)
                ON DUPLICATE KEY UPDATE
                    username = VALUES(username), password = VALUES(password), email = VALUES(email), role = VALUES(role)
                """;
            // The portal always writes the canonical state ID explicitly.
            // This prevents AUTO_INCREMENT from silently assigning a different
            // users.id to an account that may subsequently send chat messages.
            command.Parameters.AddWithValue("@id", user.Id);
            command.Parameters.AddWithValue("@username", user.Username);
            command.Parameters.AddWithValue("@password", user.Password);
            command.Parameters.AddWithValue("@email", user.Email);
            command.Parameters.AddWithValue("@role", ToLegacyUserRole(user.Role));
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(user.CreatedAt));
            command.ExecuteNonQuery();
        }
    }

    private static void SyncLegacyAdmins(MySqlConnection connection, IEnumerable<AdminAccount> admins)
    {
        if (!LegacyTableExists(connection, "admins")) return;

        foreach (var admin in admins.Where(item => !string.IsNullOrWhiteSpace(item.Username)))
        {
            var existingId = FindLegacyId(connection, "admins", admin.Email, admin.Username);
            using var command = connection.CreateCommand();
            if (existingId.HasValue)
            {
                command.CommandText = """
                    UPDATE admins
                    SET username = @username, password = @password, email = @email,
                        role = @role, is_active = @is_active, last_login = @last_login
                    WHERE id = @id
                    """;
                command.Parameters.AddWithValue("@id", existingId.Value);
            }
            else
            {
                command.CommandText = """
                    INSERT INTO admins (username, password, email, role, is_active, created_at, last_login)
                    VALUES (@username, @password, @email, @role, @is_active, @created_at, @last_login)
                    """;
                command.Parameters.AddWithValue("@created_at", ToDatabaseDate(admin.CreatedAt));
            }

            command.Parameters.AddWithValue("@username", admin.Username);
            command.Parameters.AddWithValue("@password", admin.Password);
            command.Parameters.AddWithValue("@email", admin.Email);
            command.Parameters.AddWithValue("@role", "admin");
            command.Parameters.AddWithValue("@is_active", admin.IsActive);
            command.Parameters.AddWithValue("@last_login", admin.LastLogin.HasValue
                ? admin.LastLogin.Value
                : DBNull.Value);
            command.ExecuteNonQuery();
        }
    }

    private static void SyncLegacyPlatforms(MySqlConnection connection, IEnumerable<PlatformLink> platforms)
    {
        if (!LegacyTableExists(connection, "platforms")) return;

        foreach (var platform in platforms.Where(item => !string.IsNullOrWhiteSpace(item.Name)))
        {
            var existingId = FindLegacyIdByName(connection, "platforms", platform.Name);
            using var command = connection.CreateCommand();
            if (existingId.HasValue)
            {
                command.CommandText = """
                    UPDATE platforms
                    SET description = @description, url = @url, notifications_url = @notifications_url
                    WHERE id = @id
                    """;
                command.Parameters.AddWithValue("@id", existingId.Value);
            }
            else
            {
                command.CommandText = """
                    INSERT INTO platforms (name, description, url, notifications_url, created_at)
                    VALUES (@name, @description, @url, @notifications_url, @created_at)
                    """;
                command.Parameters.AddWithValue("@name", platform.Name);
                command.Parameters.AddWithValue("@created_at", ToDatabaseDate(platform.CreatedAt));
            }

            command.Parameters.AddWithValue("@description", platform.Description);
            command.Parameters.AddWithValue("@url", platform.Url);
            command.Parameters.AddWithValue("@notifications_url", (object?)platform.NotificationsUrl ?? DBNull.Value);
            command.ExecuteNonQuery();
        }
    }

    private static void SyncLegacyAnnouncements(MySqlConnection connection, IEnumerable<AnnouncementItem> announcements)
    {
        if (!LegacyTableExists(connection, "announcements")) return;

        foreach (var announcement in announcements.Where(item => item.Id > 0))
        {
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO announcements
                    (id, title, content, author_id, is_active, priority, target_audience, created_at, updated_at)
                VALUES
                    (@id, @title, @content, @author_id, @is_active, @priority, @target_audience, @created_at, @updated_at)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title), content = VALUES(content), author_id = VALUES(author_id),
                    is_active = VALUES(is_active), priority = VALUES(priority),
                    target_audience = VALUES(target_audience), updated_at = VALUES(updated_at)
                """;
            command.Parameters.AddWithValue("@id", announcement.Id);
            command.Parameters.AddWithValue("@title", announcement.Title);
            command.Parameters.AddWithValue("@content", announcement.Content);
            command.Parameters.AddWithValue("@author_id", announcement.AuthorId);
            command.Parameters.AddWithValue("@is_active", announcement.IsActive);
            command.Parameters.AddWithValue("@priority", ToLegacyPriority(announcement.Priority));
            command.Parameters.AddWithValue("@target_audience", ToLegacyAudience(announcement.TargetAudience));
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(announcement.CreatedAt));
            command.Parameters.AddWithValue("@updated_at", ToDatabaseDate(announcement.UpdatedAt));
            command.ExecuteNonQuery();
        }
    }

    private static void SyncLegacyDiningMenus(MySqlConnection connection, IEnumerable<DiningMenuItem> menus)
    {
        if (!LegacyTableExists(connection, "dining_menu")) return;

        foreach (var menu in menus.Where(item => item.Id > 0))
        {
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO dining_menu
                    (id, date, day_of_week, breakfast_menu, breakfast_start_time, breakfast_end_time,
                     lunch_menu, lunch_start_time, lunch_end_time, is_recurring, created_by, created_at, updated_at)
                VALUES
                    (@id, @date, @day_of_week, @breakfast_menu, @breakfast_start_time, @breakfast_end_time,
                     @lunch_menu, @lunch_start_time, @lunch_end_time, @is_recurring, @created_by, @created_at, @updated_at)
                ON DUPLICATE KEY UPDATE
                    date = VALUES(date), day_of_week = VALUES(day_of_week), breakfast_menu = VALUES(breakfast_menu),
                    breakfast_start_time = VALUES(breakfast_start_time), breakfast_end_time = VALUES(breakfast_end_time),
                    lunch_menu = VALUES(lunch_menu), lunch_start_time = VALUES(lunch_start_time),
                    lunch_end_time = VALUES(lunch_end_time), is_recurring = VALUES(is_recurring),
                    created_by = VALUES(created_by), updated_at = VALUES(updated_at)
                """;
            command.Parameters.AddWithValue("@id", menu.Id);
            command.Parameters.AddWithValue("@date", menu.Date.ToDateTime(TimeOnly.MinValue));
            command.Parameters.AddWithValue("@day_of_week", menu.DayOfWeek);
            command.Parameters.AddWithValue("@breakfast_menu", menu.BreakfastMenu);
            command.Parameters.AddWithValue("@breakfast_start_time", ToDatabaseTime(menu.BreakfastStartTime));
            command.Parameters.AddWithValue("@breakfast_end_time", ToDatabaseTime(menu.BreakfastEndTime));
            command.Parameters.AddWithValue("@lunch_menu", menu.LunchMenu);
            command.Parameters.AddWithValue("@lunch_start_time", ToDatabaseTime(menu.LunchStartTime));
            command.Parameters.AddWithValue("@lunch_end_time", ToDatabaseTime(menu.LunchEndTime));
            command.Parameters.AddWithValue("@is_recurring", menu.IsRecurring);
            command.Parameters.AddWithValue("@created_by", menu.CreatedBy);
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(menu.CreatedAt));
            command.Parameters.AddWithValue("@updated_at", ToDatabaseDate(menu.UpdatedAt));
            command.ExecuteNonQuery();
        }
    }

    private static void SyncLegacyHolidays(MySqlConnection connection, IEnumerable<HolidayItem> holidays)
    {
        if (!LegacyTableExists(connection, "holidays_days_off")) return;

        foreach (var holiday in holidays.Where(item => item.Id > 0))
        {
            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO holidays_days_off
                    (id, date, year, day_of_week, holiday_name, type, description, is_recurring, created_by, created_at, updated_at)
                VALUES
                    (@id, @date, @year, @day_of_week, @holiday_name, @type, @description, @is_recurring, @created_by, @created_at, @updated_at)
                ON DUPLICATE KEY UPDATE
                    date = VALUES(date), year = VALUES(year), day_of_week = VALUES(day_of_week),
                    holiday_name = VALUES(holiday_name), type = VALUES(type), description = VALUES(description),
                    is_recurring = VALUES(is_recurring), created_by = VALUES(created_by), updated_at = VALUES(updated_at)
                """;
            command.Parameters.AddWithValue("@id", holiday.Id);
            command.Parameters.AddWithValue("@date", holiday.Date.ToDateTime(TimeOnly.MinValue));
            command.Parameters.AddWithValue("@year", holiday.Year);
            command.Parameters.AddWithValue("@day_of_week", holiday.DayOfWeek);
            command.Parameters.AddWithValue("@holiday_name", holiday.HolidayName);
            command.Parameters.AddWithValue("@type", ToLegacyHolidayType(holiday.Type));
            command.Parameters.AddWithValue("@description", (object?)holiday.Description ?? DBNull.Value);
            command.Parameters.AddWithValue("@is_recurring", holiday.IsRecurring);
            command.Parameters.AddWithValue("@created_by", (object?)holiday.CreatedBy ?? DBNull.Value);
            command.Parameters.AddWithValue("@created_at", ToDatabaseDate(holiday.CreatedAt));
            command.Parameters.AddWithValue("@updated_at", ToDatabaseDate(holiday.UpdatedAt));
            command.ExecuteNonQuery();
        }
    }

    private static bool LegacyTableExists(MySqlConnection connection, string tableName)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = @table_name
            """;
        command.Parameters.AddWithValue("@table_name", tableName);
        return Convert.ToInt32(command.ExecuteScalar()) > 0;
    }

    private static int? FindLegacyId(MySqlConnection connection, string tableName, string email, string username)
    {
        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(username)) return null;
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT id FROM `{tableName}` WHERE (email = @email AND @email <> '') OR username = @username LIMIT 1";
        command.Parameters.AddWithValue("@email", email);
        command.Parameters.AddWithValue("@username", username);
        var result = command.ExecuteScalar();
        return result is null || result == DBNull.Value ? null : Convert.ToInt32(result);
    }

    private static int? FindLegacyIdByName(MySqlConnection connection, string tableName, string name)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"SELECT id FROM `{tableName}` WHERE name = @name LIMIT 1";
        command.Parameters.AddWithValue("@name", name);
        var result = command.ExecuteScalar();
        return result is null || result == DBNull.Value ? null : Convert.ToInt32(result);
    }

    private static DateTime ToDatabaseDate(DateTime value) =>
        value == default ? DateTime.UtcNow : value.ToUniversalTime();

    private static object ToDatabaseTime(string value) =>
        TimeSpan.TryParse(value, out var time) ? time : TimeSpan.Zero;

    private static string ToLegacyUserRole(string role) =>
        string.Equals(role, "student", StringComparison.OrdinalIgnoreCase) ? "student" : "instructor";

    private static string ToLegacyPriority(string priority) => priority.Trim().ToLowerInvariant() switch
    {
        "low" => "low",
        "high" => "high",
        _ => "medium"
    };

    private static string ToLegacyAudience(string audience) => audience.Trim().ToLowerInvariant() switch
    {
        "student" or "students" => "students",
        "instructor" or "instructors" => "instructors",
        _ => "all"
    };

    private static string ToLegacyHolidayType(string type) => type.Trim().ToLowerInvariant() switch
    {
        "holiday" or "weekend" or "closure" or "custom" => type.Trim().ToLowerInvariant(),
        _ => "custom"
    };

    private static string ReadString(MySqlDataReader reader, string column) =>
        reader[column] == DBNull.Value ? string.Empty : Convert.ToString(reader[column]) ?? string.Empty;

    private static DateTime ReadDate(MySqlDataReader reader, string column) =>
        reader[column] == DBNull.Value ? DateTime.UtcNow : Convert.ToDateTime(reader[column]).ToUniversalTime();

    private static DateTime? ReadNullableDate(MySqlDataReader reader, string column) =>
        reader[column] == DBNull.Value ? null : Convert.ToDateTime(reader[column]).ToUniversalTime();

    private static DateTimeOffset? ReadNullableDateTimeOffset(MySqlDataReader reader, string column) =>
        reader[column] == DBNull.Value
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(Convert.ToDateTime(reader[column]), DateTimeKind.Utc));

    private static bool ReadBoolean(MySqlDataReader reader, string column) =>
        reader[column] != DBNull.Value && Convert.ToBoolean(reader[column]);

    private void EnsureSchema()
    {
        using var connection = new MySqlConnection(_connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS dotnet_app_state (
                state_key VARCHAR(64) NOT NULL PRIMARY KEY,
                state_json JSON NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS dotnet_sessions (
                token CHAR(32) NOT NULL PRIMARY KEY,
                session_json JSON NOT NULL,
                expires_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_dotnet_sessions_expires_at (expires_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS dotnet_chat_messages (
                message_id CHAR(32) NOT NULL PRIMARY KEY,
                sender_id INT NOT NULL,
                recipient_id INT NOT NULL,
                message_text TEXT NOT NULL,
                sent_at DATETIME(6) NOT NULL,
                INDEX idx_chat_sender_recipient_time (sender_id, recipient_id, sent_at),
                INDEX idx_chat_recipient_sender_time (recipient_id, sender_id, sent_at)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS dotnet_faculties (
                id INT NOT NULL PRIMARY KEY,
                name VARCHAR(180) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY uq_dotnet_faculty_name (name)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS dotnet_departments (
                id INT NOT NULL PRIMARY KEY,
                faculty_id INT NOT NULL,
                name VARCHAR(180) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                UNIQUE KEY uq_dotnet_department_faculty_name (faculty_id, name),
                INDEX idx_dotnet_departments_faculty_id (faculty_id),
                CONSTRAINT fk_dotnet_department_faculty
                    FOREIGN KEY (faculty_id) REFERENCES dotnet_faculties(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """;
        command.ExecuteNonQuery();

        EnsureChatColumn(connection, "received_at", "DATETIME(6) NULL AFTER sent_at");
        EnsureChatColumn(connection, "seen_at", "DATETIME(6) NULL AFTER received_at");
        EnsureChatColumn(connection, "reminder_sent_at", "DATETIME(6) NULL AFTER seen_at");
        EnsureChatIndex(connection, "idx_chat_reminder_candidates", "(reminder_sent_at, sent_at)");
    }

    private static void EnsureChatColumn(MySqlConnection connection, string name, string definition)
    {
        using var exists = connection.CreateCommand();
        exists.CommandText = """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'dotnet_chat_messages' AND column_name = @column_name
            """;
        exists.Parameters.AddWithValue("@column_name", name);
        if (Convert.ToInt32(exists.ExecuteScalar()) > 0) return;

        using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE dotnet_chat_messages ADD COLUMN `{name}` {definition}";
        alter.ExecuteNonQuery();
    }

    private static void EnsureChatIndex(MySqlConnection connection, string name, string definition)
    {
        using var exists = connection.CreateCommand();
        exists.CommandText = """
            SELECT COUNT(*)
            FROM information_schema.statistics
            WHERE table_schema = DATABASE() AND table_name = 'dotnet_chat_messages' AND index_name = @index_name
            """;
        exists.Parameters.AddWithValue("@index_name", name);
        if (Convert.ToInt32(exists.ExecuteScalar()) > 0) return;

        using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE dotnet_chat_messages ADD INDEX `{name}` {definition}";
        alter.ExecuteNonQuery();
    }

    private static bool HasInvalidChatUserReferences(MySqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT COUNT(*)
            FROM dotnet_chat_messages AS message
            LEFT JOIN users AS sender ON sender.id = message.sender_id
            LEFT JOIN users AS recipient ON recipient.id = message.recipient_id
            WHERE sender.id IS NULL OR recipient.id IS NULL
            """;
        return Convert.ToInt32(command.ExecuteScalar()) > 0;
    }

    private static void EnsureChatForeignKey(MySqlConnection connection, string constraintName, string columnName)
    {
        using var exists = connection.CreateCommand();
        exists.CommandText = """
            SELECT COUNT(*)
            FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
              AND table_name = 'dotnet_chat_messages'
              AND constraint_name = @constraint_name
              AND constraint_type = 'FOREIGN KEY'
            """;
        exists.Parameters.AddWithValue("@constraint_name", constraintName);
        if (Convert.ToInt32(exists.ExecuteScalar()) > 0) return;

        using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE dotnet_chat_messages ADD CONSTRAINT `{constraintName}` FOREIGN KEY (`{columnName}`) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT";
        alter.ExecuteNonQuery();
    }

    private static string BuildConnectionString()
    {
        var explicitConnectionString = GetEnv("DB_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(explicitConnectionString))
        {
            return explicitConnectionString;
        }

        var host = GetEnv("DB_HOST");
        var database = GetEnv("DB_DATABASE");
        var username = GetEnv("DB_USERNAME");
        var password = GetEnv("DB_PASSWORD");
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(username))
        {
            return string.Empty;
        }

        var builder = new MySqlConnectionStringBuilder
        {
            Server = host,
            Database = database,
            UserID = username,
            Password = password,
            CharacterSet = "utf8mb4",
            SslMode = MySqlSslMode.Preferred,
            AllowUserVariables = true,
            ConnectionTimeout = 5
        };

        if (uint.TryParse(GetEnv("DB_PORT"), out var port))
        {
            builder.Port = port;
        }

        return builder.ConnectionString;
    }

    private static string GetEnv(string key) =>
        (Environment.GetEnvironmentVariable(key) ?? string.Empty).Trim().Trim('"');

    private sealed record LegacyUserRow(
        int Id,
        string Username,
        string Password,
        string Email,
        string Role,
        DateTime CreatedAt);
}
