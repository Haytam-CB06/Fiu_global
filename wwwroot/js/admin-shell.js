(function () {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAdminShell, 0);
    });

    function initAdminShell() {
        if (document.getElementById('admin-topbar')) return;

        const main = document.querySelector('.main-content');
        if (!main) return;

        const admin = getAdmin();
        main.insertAdjacentHTML('afterbegin', `
            <div class="admin-topbar" id="admin-topbar">
                <div class="admin-topbar-title">
                    <strong id="admin-topbar-heading">Command Center</strong>
                    <span data-i18n="admin.shell.liveOperations">Live campus operations dashboard</span>
                </div>
                <div class="admin-topbar-actions">
                    <select class="topbar-pill" id="admin-language-switch" data-i18n-aria-label="admin.shell.language" aria-label="Language">
                        <option value="en">English</option>
                        <option value="tr">Turkish</option>
                        <option value="fr">French</option>
                        <option value="ru">Russian</option>
                        <option value="ar">Arabic</option>
                    </select>
                    <button class="topbar-pill" id="admin-theme-toggle" type="button"><i class="fas fa-moon" aria-hidden="true"></i> <span data-i18n="admin.shell.dark">Dark</span></button>
                    <button class="topbar-pill" id="admin-topbar-logout" type="button"><i class="fas fa-sign-out-alt" aria-hidden="true"></i> <span data-i18n="admin.shell.logout">Logout</span></button>
                </div>
            </div>
        `);

        injectSidebarToggle();
        injectMobileSidebarControls();
        wrapSidebarLabels();
        if (localStorage.getItem('adminSidebarCollapsed') === 'true') {
            document.body.classList.add('sidebar-collapsed');
        }
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('adminSidebarCollapsed', document.body.classList.contains('sidebar-collapsed') ? 'true' : 'false');
        });

        const mobileMenuButton = document.getElementById('admin-mobile-menu-toggle');
        const mobileSidebarCloseButton = document.getElementById('admin-mobile-sidebar-close');
        const sidebarBackdrop = document.getElementById('admin-sidebar-backdrop');
        const setMobileSidebarOpen = isOpen => {
            document.body.classList.toggle('mobile-sidebar-open', isOpen);
            mobileMenuButton?.setAttribute('aria-expanded', String(isOpen));
            if (sidebarBackdrop) sidebarBackdrop.hidden = !isOpen;
            if (mobileMenuButton) {
                mobileMenuButton.innerHTML = `<i class="fas ${isOpen ? 'fa-times' : 'fa-bars'}" aria-hidden="true"></i>`;
            }
        };
        mobileMenuButton?.addEventListener('click', () => {
            setMobileSidebarOpen(!document.body.classList.contains('mobile-sidebar-open'));
        });
        mobileSidebarCloseButton?.addEventListener('click', () => setMobileSidebarOpen(false));
        sidebarBackdrop?.addEventListener('click', () => setMobileSidebarOpen(false));
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => setMobileSidebarOpen(false));
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') setMobileSidebarOpen(false);
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) setMobileSidebarOpen(false);
        });
        document.getElementById('admin-topbar-logout').addEventListener('click', () => window.adminPanel?.logout());

        const savedTheme = localStorage.getItem('adminTheme') || 'light';
        setTheme(savedTheme);
        document.getElementById('admin-theme-toggle').addEventListener('click', () => {
            setTheme(document.body.classList.contains('dark-admin') ? 'light' : 'dark');
        });

        const lang = window.adminI18n?.getLanguage?.() || localStorage.getItem('selectedLanguage') || localStorage.getItem('language') || 'en';
        document.getElementById('admin-language-switch').value = lang;
        document.getElementById('admin-language-switch').addEventListener('change', event => {
            if (window.adminI18n?.setLanguage) {
                window.adminI18n.setLanguage(event.target.value);
                return;
            }
            localStorage.setItem('selectedLanguage', event.target.value);
            localStorage.setItem('language', event.target.value);
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: event.target.value } }));
        });

        patchSectionTitle();
        activateSectionFromPath();
        window.applyAdminTranslations?.(document);

        window.addEventListener('languageChanged', event => {
            const language = event.detail?.language || window.adminI18n?.getLanguage?.() || 'en';
            const select = document.getElementById('admin-language-switch');
            if (select && select.value !== language) select.value = language;
            const heading = document.getElementById('admin-topbar-heading');
            if (heading) heading.textContent = titleFor(sectionFromPath());
            setTheme(document.body.classList.contains('dark-admin') ? 'dark' : 'light');
            window.applyAdminTranslations?.(document);
        });
    }

    function injectSidebarToggle() {
        if (document.getElementById('sidebar-toggle')) return;
        const header = document.querySelector('.sidebar-header');
        if (!header) return;
        header.insertAdjacentHTML('afterbegin', `
            <button class="sidebar-toggle" id="sidebar-toggle" type="button" data-i18n-aria-label="admin.shell.toggleSidebar" aria-label="Toggle sidebar">
                <i class="fas fa-bars"></i>
            </button>
        `);
    }

    function injectMobileSidebarControls() {
        const topbar = document.getElementById('admin-topbar');
        if (!topbar || document.getElementById('admin-mobile-menu-toggle')) return;

        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.id) sidebar.id = 'admin-sidebar';
        if (sidebar && !document.getElementById('admin-mobile-sidebar-close')) {
            sidebar.insertAdjacentHTML('afterbegin', `
                <button class="admin-mobile-sidebar-close" id="admin-mobile-sidebar-close" type="button"
                    aria-label="Close navigation menu" title="Close navigation menu">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            `);
        }
        topbar.insertAdjacentHTML('afterbegin', `
            <button class="admin-mobile-menu-toggle" id="admin-mobile-menu-toggle" type="button"
                data-i18n-aria-label="admin.shell.toggleSidebar" aria-label="Toggle sidebar"
                aria-controls="admin-sidebar" aria-expanded="false">
                <i class="fas fa-bars" aria-hidden="true"></i>
            </button>
        `);

        const backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.id = 'admin-sidebar-backdrop';
        backdrop.className = 'admin-sidebar-backdrop';
        backdrop.setAttribute('aria-label', 'Close navigation menu');
        backdrop.hidden = true;
        document.body.append(backdrop);
    }

    function wrapSidebarLabels() {
        document.querySelectorAll('.sidebar .nav-link, .sidebar .create-toggle').forEach(link => {
            const nodes = Array.from(link.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            nodes.forEach(node => {
                const span = document.createElement('span');
                span.textContent = node.textContent.trim();
                node.replaceWith(span);
            });
        });
    }

    function patchSectionTitle() {
        const panel = window.adminPanel;
        if (!panel || panel.__shellPatched) return;
        const original = panel.showSection.bind(panel);
        panel.showSection = (section, options = {}) => {
            original(section);
            if (!options.skipUrlUpdate) updateAdminPath(section);
            const heading = document.getElementById('admin-topbar-heading');
            if (heading) heading.textContent = titleFor(section);
        };
        panel.__shellPatched = true;
    }

    function activateSectionFromPath() {
        const panel = window.adminPanel;
        if (!panel) return;
        const section = sectionFromPath();
        if (section === 'system-health') {
            panel.showSection('dashboard', { skipUrlUpdate: true });
            window.history.replaceState({ section: 'dashboard' }, '', '/admin_dashboard');
            return;
        }
        if (section && section !== 'dashboard') {
            panel.showSection(section, { skipUrlUpdate: true });
        } else {
            const heading = document.getElementById('admin-topbar-heading');
            if (heading) heading.textContent = titleFor('dashboard');
        }
    }

    function sectionFromPath() {
        const match = window.location.pathname.match(/^\/admin_dashboard\/([^/]+)\/?$/i);
        return match ? decodeURIComponent(match[1]) : 'dashboard';
    }

    function updateAdminPath(section) {
        const route = routeFor(section);
        if (window.location.pathname !== route) {
            window.history.pushState({ section }, '', route);
        }
    }

    function routeFor(section) {
        const clean = String(section || 'dashboard');
        return clean === 'dashboard' ? '/admin_dashboard' : `/admin_dashboard/${clean}`;
    }

    function setTheme(theme) {
        const dark = theme === 'dark';
        document.body.classList.toggle('dark-admin', dark);
        localStorage.setItem('adminTheme', dark ? 'dark' : 'light');
        const button = document.getElementById('admin-theme-toggle');
        if (button) {
            const key = dark ? 'admin.shell.light' : 'admin.shell.dark';
            const icon = dark ? 'fa-sun' : 'fa-moon';
            button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i> <span data-i18n="${key}">${adminText(key, dark ? 'Light' : 'Dark')}</span>`;
        }
    }

    function titleFor(section) {
        const normalized = String(section || 'dashboard');
        const key = {
            dashboard: 'admin.nav.dashboard',
            admins: 'admin.nav.adminManagement',
            users: 'admin.nav.users',
            'manage-platforms': 'admin.nav.platforms',
            platforms: 'admin.nav.platforms',
            faculties: 'admin.nav.faculties',
            announcements: 'admin.nav.announcements',
            'dining-menu': 'admin.nav.diningMenu',
            holidays: 'admin.nav.holidays',
            'role-access': 'admin.nav.roleAccess',
            'create-user': 'admin.nav.createUser',
            'system-health': 'admin.nav.systemHealth'
        }[normalized];
        const fallback = normalized
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        return key ? adminText(key, fallback) : fallback;
    }

    function adminText(key, fallback) {
        return window.adminI18n?.translate?.(key) || fallback;
    }

    function getAdmin() {
        try {
            return JSON.parse(localStorage.getItem('adminSession') || '{}');
        } catch {
            return {};
        }
    }

    function initial(value) {
        return (value || 'A').charAt(0).toUpperCase();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    }
})();
