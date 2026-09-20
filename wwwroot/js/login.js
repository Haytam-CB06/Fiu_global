/**
 * LEAVE RMS - Login Frontend JavaScript
 */

const LOGIN_API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || window.API_BASE_URL;
const LOGIN_ADMIN_API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_API_BASE_URL) || window.ADMIN_API_BASE_URL;

function loginT(key, fallback, params = {}) {
    const translated = typeof window.t === 'function' ? window.t(key, params) : null;
    return translated && translated !== key ? translated : fallback;
}

function loginApiMessage(payload, fallback) {
    if (typeof window.localizeApiMessage === 'function') {
        return window.localizeApiMessage(payload, fallback);
    }
    return payload?.error || payload?.message || fallback;
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const passwordToggle = document.getElementById('password-toggle');
    const passwordInput = document.getElementById('password');
    let lastError = null;

    // This bundle is also loaded by the shared portal shell. Only run login
    // page session hydration and form handlers on the actual login screen;
    // otherwise an authenticated user would be redirected to the same
    // dashboard URL on every page load, creating an endless reload loop.
    const isLoginPage = /\/login\.html$/i.test(window.location.pathname)
        || document.body.classList.contains('login-page');
    if (!isLoginPage) return;

    hydrateExistingSession();
    showGoogleErrorFromQuery();

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const visible = passwordInput.type === 'text';
            passwordInput.type = visible ? 'password' : 'text';
            passwordToggle.innerHTML = visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
            passwordToggle.setAttribute('aria-label', visible
                ? loginT('profile.showPassword', 'Show password')
                : loginT('profile.hidePassword', 'Hide password'));
        });
    }

    window.addEventListener('languageChanged', () => {
        if (lastError) showError(lastError.fallback, lastError.key, lastError.args);
    });

    async function hydrateExistingSession() {
        try {
            const response = await fetch('/auth/session', { credentials: 'same-origin' });
            if (!response.ok) {
                localStorage.removeItem('user');
                localStorage.removeItem('adminSession');
                return;
            }

            const data = await response.json();
            syncClientSession(data);

            if (data.session?.is_user) {
                window.location.replace(getDashboardPath(data.session));
            } else if (data.session?.is_admin) {
                window.location.replace('/admin_dashboard');
            }
        } catch (_) {
            localStorage.removeItem('user');
            localStorage.removeItem('adminSession');
        }
    }

    function handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please enter both username and password', 'api.auth.credentialsRequired');
            return;
        }

        clearError();

        loginWithServerSession(username, password)
            .then(result => {
                if (result === 'admin') {
                    window.location.href = '/admin_dashboard';
                } else if (result === true) {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    window.location.href = getDashboardPath({ is_user: true, user_role: user.role });
                }
            })
            .catch(error => {
                const errorMsg = typeof error === 'object' && error?.message
                    ? error.message
                    : loginT('api.auth.invalidCredentials', 'Invalid credentials. Please check your username and password.');
                showError(errorMsg, error?.message_key || error?.error_key || 'api.auth.invalidCredentials');
            });
    }

    async function loginWithServerSession(usernameOrEmail, password) {
        const userResponse = await fetch(`${LOGIN_API_BASE_URL}?endpoint=login`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameOrEmail, password })
        });

        const userData = await userResponse.json().catch(() => ({}));
        if (userResponse.ok) {
            if (userData.success) {
                syncClientSession({
                    session: { is_user: true, is_admin: Boolean(userData.admin) },
                    user: userData.user,
                    admin: userData.admin || null
                });
                return true;
            }
        }

        const adminResponse = await fetch(`${LOGIN_ADMIN_API_BASE_URL}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameOrEmail, password })
        });

        const adminData = await adminResponse.json().catch(() => ({}));
        if (adminResponse.ok) {
            if (adminData.success) {
                syncClientSession({
                    session: { is_user: false, is_admin: true },
                    user: null,
                    admin: adminData.admin
                });
                return 'admin';
            }
        }

        const failedPayload = adminData?.error ? adminData : userData;
        const error = new Error(loginApiMessage(failedPayload, loginT('api.auth.invalidCredentials', 'Invalid credentials. Please check your username and password.')));
        error.error_key = failedPayload?.error_key;
        error.message_key = failedPayload?.message_key;
        throw error;
    }

    function syncClientSession(data) {
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
        } else {
            localStorage.removeItem('user');
        }

        if (data.admin) {
            localStorage.setItem('adminSession', JSON.stringify(data.admin));
        } else {
            localStorage.removeItem('adminSession');
        }
    }

    function getDashboardPath(session) {
        if (session?.is_admin && !session?.is_user) {
            return '/admin_dashboard';
        }

        return String(session?.user_role || '').toLowerCase() === 'instructor'
            ? '/instructor_dashboard'
            : '/student_dashboard';
    }

    function showGoogleErrorFromQuery() {
        const error = new URLSearchParams(window.location.search).get('error');
        if (!error) return;

        const messages = {
            google_config: ['auth.google.config', 'Google login is not configured correctly. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env.'],
            google: ['auth.google.failed', 'Google login failed. Please try again or use your username and password.'],
            google_cancelled: ['auth.google.cancelled', 'Google sign-in was cancelled. You can start it again when ready.'],
            google_state: ['auth.google.state', 'Google sign-in could not be verified. Please start the login again.'],
            google_exchange: ['auth.google.exchange', 'Google could not complete the sign-in request. Please start the Google login again.'],
            google_network: ['auth.google.network', 'The local .NET server could not reach Google. Please retry in a moment.'],
            google_timeout: ['auth.google.timeout', 'Google took too long to respond. Please start the login again.'],
            final_domain_required: ['auth.google.finalDomain', 'Google login is restricted to final.edu.tr accounts only.'],
            unauthorized_google: ['auth.google.unauthorized', 'No FIU Global Portal account is linked to this Google email.'],
            invalid_role: ['auth.google.invalidRole', 'Your account role is not configured. Please contact an administrator.'],
            sso_login_required: [null, 'Sign in to FIU Global before opening a secure campus platform.'],
            session_expired: [null, 'Your 15-minute session expired. Please sign in again.']
        };

        const [key, fallback] = messages[error] || ['auth.google.unavailable', 'Unable to complete Google login.'];
        showError(fallback, key);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    function showError(message, key = null, args = {}) {
        lastError = { fallback: message, key, args };
        if (errorMessage) {
            errorMessage.textContent = key ? loginT(key, message, args) : message;
            errorMessage.classList.remove('hidden');
        }
    }

    function clearError() {
        lastError = null;
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
        }
    }
});
