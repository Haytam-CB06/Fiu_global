-- FIU Global Portal chat identity verification (read-only).
-- After deploying the application, both result sets should contain zero rows.

-- Detect a sender_id or recipient_id that does not refer to users.id.
SELECT
  message.message_id,
  message.sender_id,
  message.recipient_id,
  CASE WHEN sender.id IS NULL THEN 'missing_sender' END AS sender_problem,
  CASE WHEN recipient.id IS NULL THEN 'missing_recipient' END AS recipient_problem
FROM dotnet_chat_messages AS message
LEFT JOIN users AS sender ON sender.id = message.sender_id
LEFT JOIN users AS recipient ON recipient.id = message.recipient_id
WHERE sender.id IS NULL OR recipient.id IS NULL;

-- Confirm the two protections are present when the users table is InnoDB.
SELECT constraint_name, column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
  AND table_name = 'dotnet_chat_messages'
  AND referenced_table_name = 'users'
ORDER BY constraint_name, column_name;
