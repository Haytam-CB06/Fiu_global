# FIU Global notification email setup

Set the SMTP variables in the server environment (or the deployed `.env` file):

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=no-reply@final.edu.tr
SMTP_FROM_NAME=FIU Global Portal
SMTP_ENABLE_SSL=true
SMTP_TEST_RECIPIENT=charafihaytam0@gmail.com
```

The portal sends email for three events:

- a newly created **high** or **urgent** announcement, limited to its target audience;
- a chat message that is still unseen after 24 hours; and
- newly published dining-menu dates, including import batches.

To send the three controlled test messages, sign in as a super administrator and post this same-origin request from the deployed portal:

```js
fetch('/database/admin_api.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'smtp-notification-test' })
});
```

The server accepts no recipient address from the browser. It sends exactly one sample of each email category to `SMTP_TEST_RECIPIENT`, and logs only success/failure metadata—never passwords, SMTP credentials, recipient addresses, or message contents.
