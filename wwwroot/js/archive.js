const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || window.API_BASE_URL;

function archiveT(key, fallback, params = {}) {
    const translated = typeof window.t === 'function' ? window.t(key, params) : null;
    return translated && translated !== key ? translated : fallback;
}

function archiveDate(value, options) {
    if (!value) return archiveT('common.noDate', 'No date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    if (typeof window.formatLocalizedDate === 'function') return window.formatLocalizedDate(date, options);
    const locale = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : (localStorage.getItem('language') || 'en');
    return date.toLocaleDateString(locale, options);
}

function archiveCount(key, count, englishSingular, englishPlural) {
    const translated = typeof window.t === 'function' ? window.t(key, { count }) : null;
    return translated && translated !== key
        ? translated
        : `${count} ${count === 1 ? englishSingular : englishPlural}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const userLabel = document.getElementById('archive-user');
    const dashboardLink = document.getElementById('dashboard-link');
    const logoutBtn = document.getElementById('logout-btn');
    const themeBtn = document.getElementById('dark-mode-btn');
    const themeText = document.getElementById('current-theme');
    const announcementsContainer = document.getElementById('archive-announcements');
    const diningContainer = document.getElementById('archive-dining');
    const state = {
        announcements: [],
        diningMenus: [],
        announcementsPage: 1,
        diningPage: 1,
        announcementsFilter: '',
        diningFilter: '',
        pageSize: 8
    };

    initTheme();
    setupArchiveCollection('announcements', announcementsContainer, archiveT('archive.searchAnnouncements', 'Search announcements by title, message, or date'));
    setupArchiveCollection('dining', diningContainer, archiveT('archive.searchDining', 'Search dining menus by date, breakfast, or lunch'));
    hydrateSession();

    logoutBtn?.addEventListener('click', async () => {
        await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        localStorage.removeItem('user');
        localStorage.removeItem('adminSession');
        window.location.replace('/login.html');
    });

    themeBtn?.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeText();
    });

    window.addEventListener('languageChanged', () => {
        updateThemeText();
        document.querySelectorAll('[data-archive-controls] input').forEach(input => {
            input.placeholder = input.dataset.archiveControls === 'dining'
                ? archiveT('archive.searchDining', 'Search dining menus by date, breakfast, or lunch')
                : archiveT('archive.searchAnnouncements', 'Search announcements by title, message, or date');
        });
        renderAnnouncements();
        renderDiningMenus();
    });

    async function hydrateSession() {
        try {
            const response = await fetch('/auth/session', { credentials: 'same-origin' });
            if (!response.ok) {
                window.location.replace('/login.html');
                return;
            }

            const data = await response.json();
            if (!data.session?.is_user || !data.user) {
                window.location.replace('/login.html');
                return;
            }

            localStorage.setItem('user', JSON.stringify(data.user));
            if (userLabel) {
                userLabel.textContent = `${data.user.username} · ${data.user.role}`;
            }
            if (dashboardLink) {
                dashboardLink.href = getDashboardPath(data.user.role);
            }

            loadArchive();
        } catch (_) {
            window.location.replace('/login.html');
        }
    }

    async function loadArchive() {
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=archive`, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error('Archive request failed');
            }

            const data = await response.json();
            const archive = data.archive || {};
            state.announcements = Array.isArray(archive.announcements) ? archive.announcements : [];
            state.diningMenus = Array.isArray(archive.dining_menus) ? archive.dining_menus : [];
            renderAnnouncements();
            renderDiningMenus();
        } catch (_) {
            renderUnavailable(announcementsContainer, archiveT('archive.unavailable', 'Archive is not available right now.'));
            renderUnavailable(diningContainer, archiveT('archive.diningUnavailable', 'Past dining menus are not available right now.'));
        }
    }

    function setupArchiveCollection(type, container, placeholder) {
        if (!container) return;
        const panel = container.closest('.archive-panel');
        if (!panel || panel.querySelector(`[data-archive-controls="${type}"]`)) return;

        const controls = document.createElement('div');
        controls.className = 'archive-filter-row';
        controls.dataset.archiveControls = type;
        controls.innerHTML = `
            <label class="archive-filter-field">
                <span class="sr-only">${placeholder}</span>
                <i class="fas fa-search" aria-hidden="true"></i>
                <input type="search" data-archive-filter="${type}" placeholder="${placeholder}" autocomplete="off">
            </label>
            <span class="archive-result-count" data-archive-count="${type}">${type === 'dining' ? archiveCount('archive.menus', 0, 'menu', 'menus') : archiveCount('common.items', 0, 'item', 'items')}</span>
        `;
        container.before(controls);

        const pagination = document.createElement('div');
        pagination.className = 'pagination-controls archive-pagination';
        pagination.dataset.archivePagination = type;
        container.after(pagination);

        controls.querySelector('input')?.addEventListener('input', event => {
            state[`${type}Filter`] = event.target.value.trim().toLowerCase();
            state[`${type}Page`] = 1;
            type === 'announcements' ? renderAnnouncements() : renderDiningMenus();
        });
    }

    function renderAnnouncements() {
        const filtered = state.announcements.filter(item => {
            const searchable = [
                item.title,
                item.content,
                item.author_name,
                item.author,
                item.created_at,
                item.createdAt
            ].join(' ').toLowerCase();
            return !state.announcementsFilter || searchable.includes(state.announcementsFilter);
        });
        renderCollection('announcements', filtered, announcementsContainer, item => `
            <article class="archive-item">
                <strong>${escapeHtml(item.title || archiveT('announcements.untitled', 'Announcement'))}</strong>
                <span>${archiveDate(item.created_at || item.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <p>${escapeHtml(item.content || '')}</p>
            </article>
        `, archiveT('archive.noAnnouncements', 'No archived announcements yet.'), archiveT('archive.noAnnouncementsFiltered', 'No archived announcements match this filter.'));
    }

    function renderDiningMenus() {
        const filtered = state.diningMenus.filter(item => {
            const searchable = [
                item.date,
                item.day_of_week,
                item.dayOfWeek,
                item.breakfast_menu,
                item.breakfastMenu,
                item.lunch_menu,
                item.lunchMenu
            ].join(' ').toLowerCase();
            return !state.diningFilter || searchable.includes(state.diningFilter);
        });
        const weeks = groupDiningByWeek(filtered);
        const count = document.querySelector('[data-archive-count="dining"]');
        if (count) {
            count.textContent = `${archiveCount('archive.menus', filtered.length, 'menu', 'menus')} · ${archiveCount('archive.weeks', weeks.length, 'week', 'weeks')}`;
        }

        if (!weeks.length) {
            if (diningContainer) {
                const message = state.diningFilter
                    ? archiveT('archive.noDiningFiltered', 'No past dining menus match this filter.')
                    : archiveT('archive.noDining', 'No past dining menus yet.');
                diningContainer.innerHTML = `<p class="archive-empty-state">${message}</p>`;
            }
            state.diningPage = 1;
            renderPagination('dining', 1, 1, 0, 0);
            return;
        }

        const totalPages = weeks.length;
        state.diningPage = Math.min(Math.max(state.diningPage, 1), totalPages);
        const week = weeks[state.diningPage - 1];
        if (diningContainer) {
            diningContainer.innerHTML = renderDiningWeek(week);
        }
        renderPagination('dining', state.diningPage, totalPages, 1, totalPages);
    }

    function groupDiningByWeek(items) {
        const weeks = new Map();
        items.forEach(item => {
            const date = new Date(item.date);
            if (Number.isNaN(date.getTime())) return;
            const start = getWeekStart(date);
            const key = toDateKey(start);
            if (!weeks.has(key)) {
                weeks.set(key, { start, menus: [] });
            }
            weeks.get(key).menus.push(item);
        });
        return Array.from(weeks.values())
            .map(week => ({ ...week, menus: week.menus.sort((a, b) => new Date(a.date) - new Date(b.date)) }))
            .sort((a, b) => b.start - a.start);
    }

    function getWeekStart(date) {
        const start = new Date(date);
        const daysFromMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysFromMonday);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    function toDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function renderDiningWeek(week) {
        const end = new Date(week.start);
        end.setDate(end.getDate() + 6);
        return `
            <section class="archive-week">
                <header class="archive-week-header">
                    <div class="archive-week-title">
                        <span class="archive-week-kicker"><i class="fas fa-calendar-week" aria-hidden="true"></i> ${archiveT('archive.weeklyDining', 'Weekly dining menu')}</span>
                        <strong>${archiveDate(week.start, { year: 'numeric', month: 'short', day: 'numeric' })} <span aria-hidden="true">→</span> ${archiveDate(end, { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                    </div>
                    <span class="archive-week-count"><i class="fas fa-utensils" aria-hidden="true"></i> ${archiveCount('archive.menus', week.menus.length, 'menu', 'menus')}</span>
                </header>
                <div class="archive-week-days">
                    ${week.menus.map(item => `
                        <article class="archive-week-day">
                            <header class="archive-day-heading">
                                <strong>${archiveDate(item.date, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                                <span>${escapeHtml(item.day_of_week || item.dayOfWeek || '')}</span>
                            </header>
                            <div class="archive-meal-grid">
                                <div class="archive-meal archive-meal-breakfast"><span><i class="fas fa-sun" aria-hidden="true"></i> ${archiveT('dining.breakfast', 'Breakfast')}</span><p>${escapeHtml(item.breakfast_menu || item.breakfastMenu || archiveT('common.notAvailable', 'Not available'))}</p></div>
                                <div class="archive-meal archive-meal-lunch"><span><i class="fas fa-utensils" aria-hidden="true"></i> ${archiveT('dining.lunch', 'Lunch')}</span><p>${escapeHtml(item.lunch_menu || item.lunchMenu || archiveT('common.notAvailable', 'Not available'))}</p></div>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        `;
    }

    function renderCollection(type, items, container, itemTemplate, emptyMessage, filteredMessage) {
        if (!container) return;
        const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
        const pageKey = `${type}Page`;
        state[pageKey] = Math.min(Math.max(state[pageKey], 1), totalPages);
        const start = (state[pageKey] - 1) * state.pageSize;
        const pageItems = items.slice(start, start + state.pageSize);
        const hasFilter = Boolean(state[`${type}Filter`]);
        container.innerHTML = pageItems.length
            ? pageItems.map(itemTemplate).join('')
            : `<p class="archive-empty-state">${hasFilter ? filteredMessage : emptyMessage}</p>`;

        const count = document.querySelector(`[data-archive-count="${type}"]`);
        if (count) {
            count.textContent = archiveCount('common.items', items.length, 'item', 'items');
        }
        renderPagination(type, state[pageKey], totalPages, pageItems.length, items.length);
    }

    function renderPagination(type, currentPage, totalPages, visibleCount, totalCount) {
        const pagination = document.querySelector(`[data-archive-pagination="${type}"]`);
        if (!pagination) return;
        pagination.innerHTML = `
            <button class="btn btn-secondary" type="button" data-archive-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>${archiveT('common.previous', 'Previous')}</button>
            <span>${archiveT('pagination.showing', `Showing ${visibleCount} of ${totalCount}`, { visible: visibleCount, total: totalCount })} · ${archiveT('pagination.pageOf', `Page ${currentPage} of ${totalPages}`, { page: currentPage, total: totalPages })}</span>
            <button class="btn btn-secondary" type="button" data-archive-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>${archiveT('common.next', 'Next')}</button>
        `;
        pagination.querySelector('[data-archive-page="prev"]')?.addEventListener('click', () => {
            state[`${type}Page`] -= 1;
            type === 'announcements' ? renderAnnouncements() : renderDiningMenus();
        });
        pagination.querySelector('[data-archive-page="next"]')?.addEventListener('click', () => {
            state[`${type}Page`] += 1;
            type === 'announcements' ? renderAnnouncements() : renderDiningMenus();
        });
    }

    function renderUnavailable(container, message) {
        if (container) container.innerHTML = `<p class="archive-empty-state">${message}</p>`;
    }

    function getDashboardPath(role) {
        return String(role || '').toLowerCase() === 'instructor'
            ? '/instructor_dashboard'
            : '/student_dashboard';
    }

    function initTheme() {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
        updateThemeText();
    }

    function updateThemeText() {
        if (themeText) {
            themeText.textContent = document.body.classList.contains('dark-mode')
                ? archiveT('theme.lightMode', 'Light Mode')
                : archiveT('theme.darkMode', 'Dark Mode');
        }
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
});
