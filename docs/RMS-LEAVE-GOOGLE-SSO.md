# RMS and Leave Google SSO

## What FIU Global now does

The RMS and Leave cards open same-origin launch endpoints instead of opening an arbitrary external URL:

| Platform | FIU launch route | Allowlisted external OAuth start route |
| --- | --- | --- |
| RMS | `/sso/rms` | `https://rms.fnlsrv.website/Auth/googleLogin.php` |
| Leave | `/sso/leave` | `https://leave.fnlsrv.website/google_login.php` |

FIU Global first validates its own, still-valid portal session and checks that the stored account email ends in `@final.edu.tr`. It then issues a `302` to the exact allowlisted platform Google-login route. The `Location` header contains no FIU cookie, email address, access token, refresh token, password, state, or return URL.

RMS and Leave must each finish their own OAuth login. Because Google authentication is in the same browser, Google can use its existing Google session and normally returns to the platform without asking for credentials again. The platforms create their own cookies after their own callbacks; FIU Global's `LeaveRms.Session` cookie is never shared across domains.

FIU Global's own Google authorization-code flow now issues a short-lived, one-time state transaction, PKCE verifier/challenge (`S256`), and nonce. It consumes state once, requires the double-submit state cookie to match in constant time, validates ID-token issuer/audience/nonce/expiry/email verification, and exchanges the authorization code server-side.

## Required RMS and Leave implementation

The live RMS and Leave source code and OAuth callback configuration are not present in this repository. The current live applications expose only the Google-start routes listed above. Do **not** attempt to pass FIU Global's session cookie or any Google token to them.

On each external platform, implement or verify all of the following:

1. A separate Google OAuth **Web application** client for RMS and for Leave. Keep each client secret only in that platform's server environment.
2. Authorization Code flow with `openid email profile`, PKCE `S256`, cryptographically random state and nonce, and short one-time server-side transaction storage.
3. Exact redirect URI validation and Google Cloud authorized redirect URI registration for the actual platform callback handler. Do not use wildcards.
4. Server-side code exchange only. Never put tokens in URLs, local storage, or logs.
5. ID-token signature validation against Google's JWKS, plus `iss` (`https://accounts.google.com` or `accounts.google.com`), audience/client ID, nonce, expiry, and `email_verified` validation.
6. Normalize the verified email and require `@final.edu.tr`. Map that email to a local RMS/Leave account, then create that platform's own secure, `HttpOnly`, `Secure` session cookie.
7. Reject missing local accounts instead of silently creating a privileged account. If approved automatic provisioning is desired, add it explicitly with least-privilege roles.

### Required external configuration

Set these in the **RMS deployment**:

```dotenv
RMS_GOOGLE_CLIENT_ID=...
RMS_GOOGLE_CLIENT_SECRET=...
RMS_GOOGLE_REDIRECT_URI=https://rms.fnlsrv.website/<exact-rms-google-callback>
RMS_GOOGLE_SCOPES=openid email profile
RMS_SSO_ERROR_RETURN_URI=https://global.fnlsrv.website/sso/error
```

Set these in the **Leave deployment**:

```dotenv
LEAVE_GOOGLE_CLIENT_ID=...
LEAVE_GOOGLE_CLIENT_SECRET=...
LEAVE_GOOGLE_REDIRECT_URI=https://leave.fnlsrv.website/<exact-leave-google-callback>
LEAVE_GOOGLE_SCOPES=openid email profile
LEAVE_SSO_ERROR_RETURN_URI=https://global.fnlsrv.website/sso/error
```

The callback paths shown as placeholders must be replaced with the real handlers implemented on the external hosts. They cannot be inferred from FIU Global and must be added to Google Cloud exactly. The FIU Global application's own authorized redirect URI remains `GOOGLE_REDIRECT_URI` (for example `https://global.fnlsrv.website/auth/google/callback`) and must also appear in `GOOGLE_ALLOWED_REDIRECT_URIS`.

FIU Global supports these own-deployment launch variables:

```dotenv
RMS_SSO_START_URL=https://rms.fnlsrv.website/Auth/googleLogin.php
RMS_SSO_DASHBOARD_URL=https://rms.fnlsrv.website/
LEAVE_SSO_START_URL=https://leave.fnlsrv.website/google_login.php
LEAVE_SSO_DASHBOARD_URL=https://leave.fnlsrv.website/
```

The launch route rejects an override unless it exactly matches the HTTPS hostname and path in the allowlist. This deliberately prevents environment configuration from creating an open redirect.

## External error contract

After the external platform has validated its own state, it may send users back to FIU Global's non-sensitive error display endpoint:

```text
https://global.fnlsrv.website/sso/error?code=<one-of-the-codes-below>
```

Allowed codes are `cancelled`, `invalid_state`, `expired_authorization`, `unauthorized_email`, `missing_platform_account`, and `unavailable_platform`. No user identifiers, tokens, OAuth errors, or raw state values may be appended. Invalid/reused state must be rejected by the platform before any redirect back to FIU Global.

## Verification

Run the portal-side automated checks with:

```powershell
dotnet run --project tests/FiuGlobal.SsoSecurityTests/FiuGlobal.SsoSecurityTests.csproj
```

They cover a successful eligible launch decision, invalid/reused state, an expired authorization transaction, university-domain rejection, allowlisted redirects without query data, and the missing-platform-account error return. The actual Google callback, JWKS validation, and account mapping tests must be added and run in the RMS and Leave repositories once their callback code is available.

The FIU Global 15-minute session policy is intentionally unchanged. A launch requires a currently valid FIU session; the destination service still enforces its own session policy independently.
