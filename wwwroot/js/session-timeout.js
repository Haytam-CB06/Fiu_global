(function sessionTimeout(window, document) {
    'use strict';

    const WARNING_MS = 2 * 60 * 1000;
    const SESSION_ENDPOINT = '/auth/session';
    const CONTINUE_ENDPOINT = '/auth/session/continue';
    const channel = typeof window.BroadcastChannel === 'function'
        ? new window.BroadcastChannel('fiu-global-session')
        : null;
    let expiresAt = 0;
    let timer = null;
    let warningVisible = false;
    let continuationPending = false;
    let modal = null;
    let lastFocusedElement = null;

    const copy = {
        en: {
            title: 'Your session is about to expire',
            body: 'For your security, your session ends in {time}. Continue to stay signed in.',
            continue: 'Continue session',
            logout: 'Log out',
            continuing: 'Continuing…',
            expired: 'Your session has expired. Redirecting to login…'
        },
        tr: {
            title: 'Oturumunuz sona ermek üzere',
            body: 'Güvenliğiniz için oturumunuz {time} içinde sona erecek. Giriş yapmaya devam etmek ister misiniz?',
            continue: 'Oturumu sürdür',
            logout: 'Çıkış yap',
            continuing: 'Sürdürülüyor…',
            expired: 'Oturumunuz sona erdi. Giriş sayfasına yönlendiriliyorsunuz…'
        },
        fr: {
            title: 'Votre session va expirer',
            body: 'Pour votre sécurité, votre session se termine dans {time}. Continuez pour rester connecté.',
            continue: 'Continuer la session',
            logout: 'Se déconnecter',
            continuing: 'Continuation…',
            expired: 'Votre session a expiré. Redirection vers la connexion…'
        },
        ru: {
            title: 'Срок действия сеанса скоро истечёт',
            body: 'В целях безопасности сеанс завершится через {time}. Продолжить сеанс?',
            continue: 'Продолжить сеанс',
            logout: 'Выйти',
            continuing: 'Продление…',
            expired: 'Срок действия сеанса истёк. Переход к странице входа…'
        },
        ar: {
            title: 'ستنتهي جلستك قريباً',
            body: 'لحمايتك، ستنتهي الجلسة خلال {time}. هل تريد متابعة تسجيل الدخول؟',
            continue: 'متابعة الجلسة',
            logout: 'تسجيل الخروج',
            continuing: 'جارٍ المتابعة…',
            expired: 'انتهت جلستك. جارٍ تحويلك إلى صفحة تسجيل الدخول…'
        }
    };

    function language() {
        const stored = String(window.localStorage?.getItem('language') || '').toLowerCase().split(/[-_]/)[0];
        const documentLanguage = String(document.documentElement.lang || '').toLowerCase().split(/[-_]/)[0];
        return copy[stored] ? stored : (copy[documentLanguage] ? documentLanguage : 'en');
    }

    function text(key, values = {}) {
        const template = copy[language()][key] || copy.en[key];
        return String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
    }

    function formatRemaining(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function createModal() {
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'fiu-session-timeout';
        modal.className = 'fiu-session-timeout';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="fiu-session-timeout__backdrop" aria-hidden="true"></div>
            <section class="fiu-session-timeout__dialog" role="dialog" aria-modal="true" aria-labelledby="fiu-session-timeout-title" aria-describedby="fiu-session-timeout-message">
                <div class="fiu-session-timeout__icon" aria-hidden="true"><i class="fas fa-clock"></i></div>
                <h2 id="fiu-session-timeout-title"></h2>
                <p id="fiu-session-timeout-message"></p>
                <div class="fiu-session-timeout__actions">
                    <button type="button" class="fiu-session-timeout__secondary" data-session-logout></button>
                    <button type="button" class="fiu-session-timeout__primary" data-session-continue></button>
                </div>
            </section>`;
        document.body.appendChild(modal);

        modal.querySelector('[data-session-continue]')?.addEventListener('click', continueSession);
        modal.querySelector('[data-session-logout]')?.addEventListener('click', logout);
        return modal;
    }

    function updateCopy(remaining) {
        const root = createModal();
        root.querySelector('#fiu-session-timeout-title').textContent = text('title');
        root.querySelector('#fiu-session-timeout-message').textContent = text('body', { time: formatRemaining(remaining) });
        root.querySelector('[data-session-continue]').textContent = continuationPending ? text('continuing') : text('continue');
        root.querySelector('[data-session-logout]').textContent = text('logout');
    }

    function showWarning(remaining) {
        const root = createModal();
        if (!warningVisible) {
            lastFocusedElement = document.activeElement;
            warningVisible = true;
            root.hidden = false;
            document.body.classList.add('fiu-session-timeout-open');
            root.querySelector('[data-session-continue]')?.focus();
        }
        updateCopy(remaining);
    }

    function hideWarning() {
        if (!modal) return;
        warningVisible = false;
        modal.hidden = true;
        document.body.classList.remove('fiu-session-timeout-open');
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function clearTimer() {
        if (timer) window.clearInterval(timer);
        timer = null;
    }

    function clearClientAccount() {
        window.localStorage?.removeItem('user');
        window.localStorage?.removeItem('adminSession');
        window.sessionStorage?.clear();
    }

    function redirectToLogin(error = 'session_expired') {
        clearClientAccount();
        const target = error ? `/login.html?error=${encodeURIComponent(error)}` : '/login.html';
        window.location.replace(target);
    }

    async function logout() {
        clearTimer();
        try {
            await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (_) {}
        channel?.postMessage({ type: 'logged-out' });
        redirectToLogin(null);
    }

    async function expireSession() {
        clearTimer();
        if (modal) {
            updateCopy(0);
            modal.querySelector('#fiu-session-timeout-message').textContent = text('expired');
            modal.querySelector('[data-session-continue]').disabled = true;
            modal.querySelector('[data-session-logout]').disabled = true;
            modal.hidden = false;
        }
        channel?.postMessage({ type: 'expired' });
        try {
            await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (_) {}
        redirectToLogin();
    }

    function setExpiry(value) {
        const parsed = Date.parse(value || '');
        if (!Number.isFinite(parsed)) return false;
        expiresAt = parsed;
        warningVisible = false;
        continuationPending = false;
        if (modal) {
            modal.querySelector('[data-session-continue]').disabled = false;
            modal.querySelector('[data-session-logout]').disabled = false;
        }
        hideWarning();
        return true;
    }

    async function continueSession() {
        if (continuationPending) return;
        continuationPending = true;
        updateCopy(Math.max(0, expiresAt - Date.now()));
        const button = modal?.querySelector('[data-session-continue]');
        if (button) button.disabled = true;
        try {
            const response = await fetch(CONTINUE_ENDPOINT, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                await expireSession();
                return;
            }
            const data = await response.json();
            if (!setExpiry(data.session?.expires_at)) {
                await expireSession();
                return;
            }
            channel?.postMessage({ type: 'renewed', expiresAt });
        } catch (_) {
            continuationPending = false;
            if (button) button.disabled = false;
            updateCopy(Math.max(0, expiresAt - Date.now()));
        }
    }

    function tick() {
        if (!expiresAt) return;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
            expireSession();
            return;
        }
        if (remaining <= WARNING_MS) {
            showWarning(remaining);
        }
    }

    async function start() {
        if (/^\/login(?:\.html)?$/i.test(window.location.pathname)) return;
        createModal();
        try {
            const response = await fetch(SESSION_ENDPOINT, { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) {
                redirectToLogin();
                return;
            }
            const data = await response.json();
            if (!setExpiry(data.session?.expires_at)) {
                redirectToLogin();
                return;
            }
            clearTimer();
            timer = window.setInterval(tick, 1000);
            tick();
        } catch (_) {
            redirectToLogin();
        }
    }

    channel?.addEventListener('message', event => {
        const message = event.data || {};
        if (message.type === 'renewed' && Number.isFinite(Number(message.expiresAt))) {
            setExpiry(Number(message.expiresAt));
        } else if (message.type === 'expired' || message.type === 'logged-out') {
            clearTimer();
            redirectToLogin(message.type === 'logged-out' ? 'logged_out' : 'session_expired');
        }
    });

    window.addEventListener('storage', event => {
        if (event.key === 'fiu-session-renewed' && Number.isFinite(Number(event.newValue))) {
            setExpiry(Number(event.newValue));
        }
    });
    window.addEventListener('languageChanged', () => {
        if (warningVisible) updateCopy(Math.max(0, expiresAt - Date.now()));
    });
    document.addEventListener('DOMContentLoaded', start, { once: true });
})(window, document);
