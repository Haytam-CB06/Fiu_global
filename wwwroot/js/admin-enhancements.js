(function () {
    const api = () => (window.APP_CONFIG && window.APP_CONFIG.ADMIN_API_BASE_URL) || window.ADMIN_API_BASE_URL;
    const defaultPlatformImage = '/img/fiu9-mark2.png';
    let platformPage = 1;
    const platformPageSize = 6;
    let pendingDiningImportForm = null;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const panel = window.adminPanel;
            if (!panel) return;
            enhanceCreateUser(panel);
            enhanceDashboard(panel);
            enhanceAdminTable(panel);
            enhancePlatforms(panel);
            enhanceDining(panel);
            loadEnhancedStats(panel);
        }, 0);
    });

    async function postJson(payload) {
        const response = await fetch(api(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    function notify(panel, message, type = 'success') {
        if (panel.showNotification) panel.showNotification(message, type);
    }

    async function loadEnhancedStats(panel) {
        try {
            const response = await fetch(`${api()}?endpoint=dashboard-stats`);
            const data = await response.json();
            if (!data.success) return;
            renderActivity(data.stats.activity);
            renderDashboardCharts(data.stats);
        } catch (error) {
            renderDashboardCharts(null, true);
        }
    }

    function enhanceDashboard(panel) {
        const section = document.getElementById('dashboard-section');
        if (!section || document.getElementById('dashboard-operations')) return;
        document.getElementById('activity-dashboard')?.remove();
        section.insertAdjacentHTML('beforeend', `
            <section class="dashboard-charts" id="dashboard-charts" aria-labelledby="dashboard-charts-title">
                <div class="dashboard-charts-heading">
                    <div>
                        <span class="dashboard-eyebrow">Live analytics</span>
                        <h2 id="dashboard-charts-title">Campus activity</h2>
                        <p>Account distribution and administrator activity from the latest system data.</p>
                    </div>
                    <span class="chart-freshness"><i class="fas fa-circle" aria-hidden="true"></i> Live data</span>
                </div>
                <div class="dashboard-charts-grid">
                    <article class="dashboard-chart-card dashboard-chart-card-wide">
                        <div class="dashboard-chart-header">
                            <div>
                                <h3>Activity trend</h3>
                                <p>Events recorded during the last seven days</p>
                            </div>
                            <strong class="chart-metric" id="activity-total-events">—</strong>
                        </div>
                        <div class="dashboard-chart-host" id="activity-trend-chart" aria-live="polite">
                            <div class="chart-loading">Loading activity…</div>
                        </div>
                    </article>
                    <article class="dashboard-chart-card dashboard-chart-card-wide">
                        <div class="dashboard-chart-header">
                            <div>
                                <h3>Top platforms accessed</h3>
                                <p>Platform opens split between instructors and students</p>
                            </div>
                            <strong class="chart-metric" id="platform-access-total">—</strong>
                        </div>
                        <div class="dashboard-chart-host" id="platform-access-chart" aria-live="polite">
                            <div class="chart-loading">Loading platform access…</div>
                        </div>
                    </article>
                    <article class="dashboard-chart-card">
                        <div class="dashboard-chart-header">
                            <div>
                                <h3>Account mix</h3>
                                <p>Accounts grouped by role</p>
                            </div>
                        </div>
                        <div class="dashboard-chart-host" id="account-mix-chart" aria-live="polite">
                            <div class="chart-loading">Loading accounts…</div>
                        </div>
                    </article>
                    <article class="dashboard-chart-card">
                        <div class="dashboard-chart-header">
                            <div>
                                <h3>Top activity</h3>
                                <p>Most frequent administrator actions</p>
                            </div>
                            <strong class="chart-metric" id="activity-last-day">—</strong>
                        </div>
                        <div class="dashboard-chart-host" id="activity-actions-chart" aria-live="polite">
                            <div class="chart-loading">Loading actions…</div>
                        </div>
                    </article>
                </div>
            </section>
            <div class="content-section enhanced-panel" id="dashboard-operations">
                <div class="section-header">
                    <div>
                        <h2>Today at a Glance</h2>
                        <p class="section-subtitle">Useful campus operations for today instead of raw activity counters.</p>
                    </div>
                    <button class="btn btn-secondary" id="refresh-dashboard-ops"><i class="fas fa-sync"></i> Refresh</button>
                </div>
                <div class="ops-grid">
                    <article class="ops-card ops-card-wide">
                        <span class="ops-kicker"><i class="fas fa-utensils"></i> Dining Menu Today</span>
                        <h3 id="ops-dining-date">Loading...</h3>
                        <div id="ops-dining-body">Checking today's menu.</div>
                    </article>
                    <article class="ops-card">
                        <span class="ops-kicker"><i class="fas fa-bullhorn"></i> Announcements</span>
                        <strong id="ops-announcements-count">0</strong>
                        <p>Active items visible to campus users.</p>
                    </article>
                </div>
            </div>
        `);
        document.getElementById('refresh-dashboard-ops')?.addEventListener('click', () => loadDashboardOperations(panel, { notifyOnError: true }));
        loadDashboardOperations(panel);
        panel.__dashboardOperationsTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') loadDashboardOperations(panel);
        }, 30000);
    }

    function renderActivity(activity) {
        return activity;
    }

    function renderDashboardCharts(stats, failed = false) {
        const trendHost = document.getElementById('activity-trend-chart');
        const platformHost = document.getElementById('platform-access-chart');
        const mixHost = document.getElementById('account-mix-chart');
        const actionsHost = document.getElementById('activity-actions-chart');
        if (!trendHost || !platformHost || !mixHost || !actionsHost) return;

        if (failed || !stats) {
            const message = '<div class="chart-empty"><i class="fas fa-chart-line" aria-hidden="true"></i><span>Chart data is unavailable. Refresh to try again.</span></div>';
            trendHost.innerHTML = message;
            platformHost.innerHTML = message;
            mixHost.innerHTML = message;
            actionsHost.innerHTML = message;
            return;
        }

        const activity = stats.activity || {};
        renderActivityTrend(trendHost, Array.isArray(activity.daily) ? activity.daily : []);
        const platformUsage = stats.platform_usage || {};
        renderPlatformAccess(platformHost, Array.isArray(platformUsage.by_platform) ? platformUsage.by_platform : []);
        renderAccountMix(mixHost, Array.isArray(stats.accounts_by_role) ? stats.accounts_by_role : []);
        renderActionBars(actionsHost, Array.isArray(activity.by_action) ? activity.by_action : []);

        const total = document.getElementById('activity-total-events');
        if (total) total.textContent = `${Number(activity.total_events) || 0} total`;
        const lastDay = document.getElementById('activity-last-day');
        if (lastDay) lastDay.textContent = `${Number(activity.last_24h) || 0} today`;
        const platformTotal = document.getElementById('platform-access-total');
        if (platformTotal) platformTotal.textContent = `${Number(platformUsage.total_accesses) || 0} opens`;
    }

    function renderPlatformAccess(host, rawItems) {
        const items = rawItems
            .map(item => ({
                platform: String(item.platform || 'Unknown platform'),
                instructor: Math.max(0, Number(item.instructor) || 0),
                student: Math.max(0, Number(item.student) || 0),
                other: Math.max(0, Number(item.other) || 0),
                total: Math.max(0, Number(item.total) || 0)
            }))
            .filter(item => item.total > 0)
            .slice(0, 8);
        if (!items.length) {
            host.innerHTML = '<div class="chart-empty"><i class="fas fa-ranking-star" aria-hidden="true"></i><span>Platform access will appear after users open a platform.</span></div>';
            return;
        }
        const maxCount = Math.max(...items.map(item => item.total), 1);
        const hasOther = items.some(item => item.other > 0);
        host.innerHTML = `<div class="platform-access-chart" role="img" aria-label="Top platforms accessed by instructors and students">
            <div class="platform-access-legend"><span><i class="platform-access-swatch instructor"></i>Instructors</span><span><i class="platform-access-swatch student"></i>Students</span>${hasOther ? '<span><i class="platform-access-swatch other"></i>Other roles</span>' : ''}</div>
            ${items.map(item => {
                const instructorWidth = (item.instructor / maxCount) * 100;
                const studentWidth = (item.student / maxCount) * 100;
                const otherWidth = (item.other / maxCount) * 100;
                return `<div class="platform-access-row"><div class="platform-access-label"><span title="${escapeHtml(item.platform)}">${escapeHtml(item.platform)}</span><strong>${item.total}</strong></div><div class="platform-access-track" aria-label="${escapeHtml(item.platform)}: ${item.instructor} instructors, ${item.student} students${hasOther ? `, ${item.other} other roles` : ''}"><span class="instructor" style="width:${instructorWidth.toFixed(1)}%;background:#2f6fb5" title="Instructors: ${item.instructor}"></span><span class="student" style="width:${studentWidth.toFixed(1)}%;background:#d6a037" title="Students: ${item.student}"></span>${hasOther ? `<span class="other" style="width:${otherWidth.toFixed(1)}%;background:#8a6bb8" title="Other roles: ${item.other}"></span>` : ''}</div><div class="platform-access-counts${hasOther ? ' has-other' : ''}"><span>${item.instructor}</span><span>${item.student}</span>${hasOther ? `<span>${item.other}</span>` : ''}</div></div>`;
            }).join('')}
        </div>`;
    }

    function renderActivityTrend(host, rawItems) {
        const items = rawItems.slice(-7).map(item => ({
            date: String(item.date || ''),
            count: Math.max(0, Number(item.count) || 0)
        }));
        if (!items.length) {
            host.innerHTML = '<div class="chart-empty"><i class="fas fa-wave-square" aria-hidden="true"></i><span>No activity history is available yet.</span></div>';
            return;
        }

        const width = 700;
        const plotTop = 22;
        const plotBottom = 188;
        const plotLeft = 44;
        const plotRight = 674;
        const maxCount = Math.max(1, ...items.map(item => item.count));
        const stepX = items.length > 1 ? (plotRight - plotLeft) / (items.length - 1) : 0;
        const points = items.map((item, index) => ({
            ...item,
            x: plotLeft + (index * stepX),
            y: plotBottom - ((item.count / maxCount) * (plotBottom - plotTop))
        }));
        const pointList = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
        const areaPath = `M ${points[0].x.toFixed(1)} ${plotBottom} L ${pointList.replaceAll(',', ' ')} L ${points.at(-1).x.toFixed(1)} ${plotBottom} Z`;
        const grid = [0, .5, 1].map(ratio => {
            const y = plotBottom - ((plotBottom - plotTop) * ratio);
            const label = Math.round(maxCount * ratio);
            return `<g><line class="chart-grid-line" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}"></line><text class="chart-axis-value" x="32" y="${y + 4}" text-anchor="end">${label}</text></g>`;
        }).join('');
        const labels = points.map(point => {
            const date = new Date(`${point.date}T12:00:00`);
            const day = Number.isNaN(date.getTime()) ? point.date : date.toLocaleDateString('en-US', { weekday: 'short' });
            return `<text class="chart-axis-label" x="${point.x}" y="220" text-anchor="middle">${escapeHtml(day)}</text>`;
        }).join('');
        const dots = points.map(point => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="5"><title>${escapeHtml(point.date)}: ${point.count} events</title></circle>`).join('');
        const total = items.reduce((sum, item) => sum + item.count, 0);

        host.innerHTML = `
            <svg class="activity-trend-svg" viewBox="0 0 ${width} 238" role="img" aria-label="${total} activity events recorded during the last seven days">
                <defs>
                    <linearGradient id="activity-area-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2f6fb5" stop-opacity=".32"></stop>
                        <stop offset="100%" stop-color="#2f6fb5" stop-opacity=".02"></stop>
                    </linearGradient>
                </defs>
                ${grid}
                <path class="chart-area" d="${areaPath}"></path>
                <polyline class="chart-line" points="${pointList}"></polyline>
                ${dots}
                ${labels}
            </svg>
            ${total === 0 ? '<p class="chart-zero-note">No activity has been recorded in this period.</p>' : ''}
        `;
    }

    function renderAccountMix(host, rawItems) {
        const items = rawItems
            .map(item => ({ role: prettyChartLabel(item.role), count: Math.max(0, Number(item.count) || 0) }))
            .filter(item => item.count > 0);
        const total = items.reduce((sum, item) => sum + item.count, 0);
        if (!total) {
            host.innerHTML = '<div class="chart-empty"><i class="fas fa-users" aria-hidden="true"></i><span>No accounts are available yet.</span></div>';
            return;
        }

        const colors = ['#2f6fb5', '#d6a037', '#2e8b68', '#b8555e', '#7557a6'];
        const circumference = 326.73;
        let offset = 0;
        const segments = items.map((item, index) => {
            const length = (item.count / total) * circumference;
            const segment = `<circle class="donut-segment" cx="80" cy="80" r="52" pathLength="${circumference}" stroke="${colors[index % colors.length]}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"><title>${escapeHtml(item.role)}: ${item.count}</title></circle>`;
            offset += length;
            return segment;
        }).join('');
        const legend = items.map((item, index) => `
            <li><span class="chart-legend-swatch" style="background:${colors[index % colors.length]}"></span><span>${escapeHtml(item.role)}</span><strong>${item.count}</strong></li>
        `).join('');

        host.innerHTML = `
            <div class="account-mix-layout">
                <svg class="donut-chart" viewBox="0 0 160 160" role="img" aria-label="${total} accounts grouped by role">
                    <circle class="donut-track" cx="80" cy="80" r="52"></circle>
                    ${segments}
                    <text class="donut-total" x="80" y="77" text-anchor="middle">${total}</text>
                    <text class="donut-caption" x="80" y="96" text-anchor="middle">accounts</text>
                </svg>
                <ul class="chart-legend">${legend}</ul>
            </div>
        `;
    }

    function renderActionBars(host, rawItems) {
        const items = rawItems
            .map(item => ({ action: prettyChartLabel(item.action), count: Math.max(0, Number(item.count) || 0) }))
            .filter(item => item.count > 0)
            .slice(0, 5);
        if (!items.length) {
            host.innerHTML = '<div class="chart-empty"><i class="fas fa-list-check" aria-hidden="true"></i><span>Actions will appear after administrators begin using the portal.</span></div>';
            return;
        }
        const maxCount = Math.max(...items.map(item => item.count), 1);
        const totalActions = items.reduce((sum, item) => sum + item.count, 0);
        host.innerHTML = `<div class="action-bars" role="list" aria-label="Top administrator activity categories">
            <div class="action-bar-scale" aria-hidden="true"><span>0</span><span>${maxCount} events</span></div>
            ${items.map(item => {
                const percentage = (item.count / maxCount) * 100;
                const share = Math.round((item.count / totalActions) * 100);
                return `
                <div class="action-bar-row" role="listitem">
                    <div class="action-bar-label"><span>${escapeHtml(item.action)}</span><strong>${item.count}<small>${share}%</small></strong></div>
                    <div class="action-bar-track" role="progressbar" aria-label="${escapeHtml(item.action)}: ${item.count} events" aria-valuemin="0" aria-valuemax="${maxCount}" aria-valuenow="${item.count}"><span class="action-bar-fill" style="--action-bar-width:${Math.max(4, percentage).toFixed(1)}%;width:var(--action-bar-width)"></span></div>
                </div>`;
            }).join('')}
        </div>`;
    }

    function prettyChartLabel(value) {
        return String(value || 'Other')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    async function loadDashboardOperations(panel, options = {}) {
        try {
            const responses = await Promise.all([
                fetch(`${api()}?endpoint=dashboard-stats`, { credentials: 'same-origin' }),
                fetch(`${api()}?endpoint=announcement-list`, { credentials: 'same-origin' }),
                fetch(`${api()}?endpoint=dining-menu-list`, { credentials: 'same-origin' })
            ]);
            const payloads = await Promise.all(responses.map(response => response.json()));
            const [statsPayload, announcementsPayload, diningPayload] = payloads;
            if (responses.some(response => !response.ok) || !statsPayload.success || !announcementsPayload.success || !diningPayload.success) {
                throw new Error('Dashboard data could not be refreshed.');
            }

            panel.announcements = Array.isArray(announcementsPayload.announcements)
                ? announcementsPayload.announcements
                : [];
            panel.diningMenus = Array.isArray(diningPayload.dining_menus)
                ? diningPayload.dining_menus
                : (Array.isArray(diningPayload.menus) ? diningPayload.menus : []);

            renderDashboardCharts(statsPayload.stats);
            renderDashboardOperations(panel);
        } catch (error) {
            console.error('Error refreshing dashboard operations:', error);
            if (options.notifyOnError) notify(panel, 'Dashboard data could not be refreshed.', 'error');
        }
    }

    function renderDashboardOperations(panel) {
        const today = new Date();
        const todayKey = toDateKey(today);
        const date = document.getElementById('ops-dining-date');
        if (date) date.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const menu = (panel.diningMenus || []).find(item => toDateKey(new Date(item.date)) === todayKey);
        const body = document.getElementById('ops-dining-body');
        if (body) {
            body.innerHTML = menu ? `
                <div class="ops-meal"><strong>Breakfast</strong><span>${escapeHtml(menu.breakfast_menu || 'Not set')}</span></div>
                <div class="ops-meal"><strong>Lunch</strong><span>${escapeHtml(menu.lunch_menu || 'Not set')}</span></div>
                <button class="btn btn-secondary" type="button" id="ops-edit-dining"><i class="fas fa-edit"></i> Edit Today</button>
            ` : '<p>No dining menu has been added for today.</p>';
            document.getElementById('ops-edit-dining')?.addEventListener('click', () => panel.editDiningMenu(menu.id));
        }
        const announcements = document.getElementById('ops-announcements-count');
        if (announcements) announcements.textContent = (panel.announcements || []).length;
    }

    function enhanceAdminTable(panel) {
        const section = document.getElementById('admins-section');
        if (!section || panel.__adminTableEnhanced) return;
        panel.__adminTableEnhanced = true;
        panel.adminPage = 1;
        section.querySelector('.section-header')?.insertAdjacentHTML('afterend', `
            <div class="smart-filter-row admin-smart-filter">
                <input type="search" id="admin-filter-input" placeholder="Search admins by username, email, status, role, or ID">
                <span id="admin-filter-count">0 admins</span>
            </div>
        `);
        const tableContainer = document.getElementById('admins-table-container');
        tableContainer?.classList.add('eight-row-table-shell');
        tableContainer?.insertAdjacentHTML('afterend', `
            <div class="pagination-controls" id="admin-table-pagination"></div>
        `);
        document.getElementById('admin-filter-input')?.addEventListener('input', () => {
            panel.adminPage = 1;
            panel.renderAdminsTable();
        });
        const originalRender = panel.renderAdminsTable.bind(panel);
        panel.renderAdminsTable = () => renderAdminsPaged(panel, originalRender);
        panel.renderAdminsTable();
        panel.__adminPresenceTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible' && document.getElementById('admins-section')?.classList.contains('hidden') === false) {
                panel.loadAdmins();
            }
        }, 30000);
    }

    function renderAdminsPaged(panel) {
        const tbody = document.getElementById('admins-table-body');
        if (!tbody) return;
        const filter = (document.getElementById('admin-filter-input')?.value || '').trim().toLowerCase();
        const admins = (panel.admins || []).filter(admin => [
            admin.id,
            admin.username,
            admin.email,
            admin.role,
            admin.is_active == 1 ? 'enabled' : 'disabled',
            admin.is_online ? 'online' : 'offline'
        ].join(' ').toLowerCase().includes(filter));
        const pageSize = 8;
        const totalPages = Math.max(1, Math.ceil(admins.length / pageSize));
        panel.adminPage = Math.min(Math.max(panel.adminPage || 1, 1), totalPages);
        const pageItems = admins.slice((panel.adminPage - 1) * pageSize, panel.adminPage * pageSize);
        tbody.innerHTML = pageItems.map(admin => {
            const presence = admin.is_active == 0 ? 'disabled' : (admin.is_online ? 'online' : 'offline');
            const label = presence.charAt(0).toUpperCase() + presence.slice(1);
            return `
            <tr>
                <td>${admin.id}</td>
                <td>${escapeHtml(admin.username)}</td>
                <td>${escapeHtml(admin.email || 'N/A')}</td>
                <td>${escapeHtml(String(admin.role || '').replace('_', ' ').toUpperCase())}</td>
                <td><span class="status-pill ${presence}"><i class="fas fa-circle" aria-hidden="true"></i>${label}</span></td>
                <td>${formatDate(admin.created_at)}</td>
                <td>
                    <button class="btn" onclick="adminPanel.editAdmin(${admin.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" onclick="adminPanel.deleteAdmin(${admin.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        }).join('') || '<tr><td colspan="7">No matching admins found.</td></tr>';
        const count = document.getElementById('admin-filter-count');
        if (count) count.textContent = `${admins.length} admin${admins.length === 1 ? '' : 's'}`;
        const pager = document.getElementById('admin-table-pagination');
        if (pager) {
            pager.innerHTML = `
                <button class="btn btn-secondary" id="admin-prev-page" ${panel.adminPage <= 1 ? 'disabled' : ''}>Previous</button>
                <span>Showing ${pageItems.length} of ${admins.length} · Page ${panel.adminPage} of ${totalPages}</span>
                <button class="btn btn-secondary" id="admin-next-page" ${panel.adminPage >= totalPages ? 'disabled' : ''}>Next</button>
            `;
            document.getElementById('admin-prev-page')?.addEventListener('click', () => {
                panel.adminPage -= 1;
                panel.renderAdminsTable();
            });
            document.getElementById('admin-next-page')?.addEventListener('click', () => {
                panel.adminPage += 1;
                panel.renderAdminsTable();
            });
        }
    }

    function enhanceCreateUser(panel) {
        const section = document.getElementById('create-user-section');
        const list = document.getElementById('create-user-directory-list');
        if (!section || !list || panel.__createUserDirectoryEnhanced) return;
        panel.__createUserDirectoryEnhanced = true;
        panel.createUserDirectoryPage = 1;

        document.getElementById('create-user-search')?.addEventListener('input', () => {
            panel.createUserDirectoryPage = 1;
            renderCreateUserDirectory(panel);
        });

        const originalRenderUsers = panel.renderUsers.bind(panel);
        panel.renderUsers = users => {
            panel.users = Array.isArray(users) ? users : [];
            originalRenderUsers(users);
            renderCreateUserDirectory(panel);
        };

        loadCreateUserDirectory(panel);
    }

    async function loadCreateUserDirectory(panel) {
        const list = document.getElementById('create-user-directory-list');
        if (!list) return;

        try {
            const response = await fetch(`${api()}?endpoint=users-list`, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.users)) {
                throw new Error(data.error || `User directory request failed (${response.status})`);
            }

            panel.users = data.users;
            renderCreateUserDirectory(panel);
        } catch (error) {
            console.error('Error loading create user directory:', error);
            list.innerHTML = '<div class="directory-empty-state">Unable to load users. Refresh and try again.</div>';
            const count = document.getElementById('create-user-directory-count');
            if (count) count.textContent = 'Unavailable';
        }
    }

    function renderCreateUserDirectory(panel) {
        const list = document.getElementById('create-user-directory-list');
        if (!list) return;
        const filter = (document.getElementById('create-user-search')?.value || '').trim().toLowerCase();
        const users = (panel.users || []).filter(user => [
            user.id,
            user.username,
            user.email,
            user.role,
            user.admin_role,
            user.created_at
        ].join(' ').toLowerCase().includes(filter));
        const pageSize = 8;
        const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
        panel.createUserDirectoryPage = Math.min(Math.max(panel.createUserDirectoryPage || 1, 1), totalPages);
        const start = (panel.createUserDirectoryPage - 1) * pageSize;
        const pageItems = users.slice(start, start + pageSize);

        list.innerHTML = pageItems.length
            ? pageItems.map(user => {
                const isAdmin = Boolean(user.admin_id);
                const role = user.admin_role || user.role || 'user';
                return `
                    <article class="directory-user-row">
                        <div class="directory-user-identity">
                            <span class="directory-user-avatar">${escapeHtml(String(user.username || '?').charAt(0).toUpperCase())}</span>
                            <div>
                                <strong>${escapeHtml(user.username || 'Unnamed user')}</strong>
                                <span>${escapeHtml(user.email || 'No email')}</span>
                            </div>
                        </div>
                        <span class="directory-user-role ${isAdmin ? 'is-admin' : ''}">${escapeHtml(String(role).replace('_', ' ').toUpperCase())}</span>
                        <span class="directory-user-created">${formatDate(user.created_at)}</span>
                    </article>
                `;
            }).join('')
            : '<div class="directory-empty-state">No users match this search.</div>';

        const count = document.getElementById('create-user-directory-count');
        if (count) count.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;

        const pager = document.getElementById('create-user-directory-pagination');
        if (!pager) return;
        pager.innerHTML = `
            <button class="btn btn-secondary" type="button" id="create-user-prev" ${panel.createUserDirectoryPage <= 1 ? 'disabled' : ''}>Previous</button>
            <span>Showing ${pageItems.length} of ${users.length} · Page ${panel.createUserDirectoryPage} of ${totalPages}</span>
            <button class="btn btn-secondary" type="button" id="create-user-next" ${panel.createUserDirectoryPage >= totalPages ? 'disabled' : ''}>Next</button>
        `;
        document.getElementById('create-user-prev')?.addEventListener('click', () => {
            panel.createUserDirectoryPage -= 1;
            renderCreateUserDirectory(panel);
        });
        document.getElementById('create-user-next')?.addEventListener('click', () => {
            panel.createUserDirectoryPage += 1;
            renderCreateUserDirectory(panel);
        });
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
    }

    function enhancePlatforms(panel) {
        const main = document.querySelector('.main-content');
        if (!main || document.getElementById('manage-platforms-section')) return;
        main.insertAdjacentHTML('beforeend', `
            <div id="manage-platforms-section" class="section-content hidden">
                <div class="content-section enhanced-panel">
                    <div class="section-header"><h2 class="section-title">Manage Platforms</h2></div>
                    <button class="btn" type="button" id="new-platform-btn"><i class="fas fa-plus"></i> Create Platform</button>
                    <form id="manage-platform-form" class="enhanced-form hidden">
                        <input type="hidden" name="id">
                        <input type="hidden" name="image_url">
                        <input name="section" placeholder="Section, e.g. LMS" required>
                        <input name="name" placeholder="Platform name, e.g. LMS1" required>
                        <input name="url" placeholder="https://platform.example.com" required>
                        <input name="description" placeholder="Short description">
                        <input name="notifications_url" placeholder="Optional notifications link">
                        <div class="platform-role-options" data-visible-role-options><span class="muted">Loading roles…</span></div>

                    </form>
                    <div id="manage-platform-list" class="activity-grid"></div>
                    <div id="manage-platform-pagination" class="pagination-controls"></div>
                </div>
            </div>
            <div class="platform-edit-modal" id="platform-edit-modal">
                <div class="platform-edit-card">
                    <div class="section-header">
                        <h2 id="platform-modal-title">Edit Platform</h2>
                        <button class="btn btn-secondary" type="button" id="close-platform-modal">Close</button>
                    </div>
                    <form id="platform-modal-form" class="enhanced-form">
                        <input type="hidden" name="id">
                        <input name="section" placeholder="Section, e.g. LMS" required>
                        <input name="name" placeholder="Platform name, e.g. LMS1" required>
                        <input name="url" placeholder="https://platform.example.com" required>
                        <input name="description" placeholder="Short description">
                        <input name="notifications_url" placeholder="Optional notifications link">
                        <section class="platform-image-field" aria-labelledby="platform-image-heading">
                            <div class="platform-image-preview-frame">
                                <img class="platform-image-preview" data-platform-image-preview src="/img/fiu9-mark2.png" alt="Platform image preview">
                                <span class="platform-image-preview-caption">User-facing preview</span>
                            </div>
                            <div class="platform-image-controls">
                                <div>
                                    <h3 id="platform-image-heading">Platform image</h3>
                                    <p>Upload a distinctive image for this service. If none is set, the FIU logo is used.</p>
                                </div>
                                <label class="platform-image-upload-button" data-platform-image-upload-label>
                                    <i class="fas fa-image" aria-hidden="true"></i>
                                    <span>Upload image</span>
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-platform-image-input>
                                </label>
                                <input type="hidden" name="image_url" data-platform-image-url>
                                <div class="platform-image-actions">
                                    <button class="btn btn-secondary" type="button" data-platform-image-clear>Use default logo</button>
                                    <span class="platform-image-status" data-platform-image-status aria-live="polite"></span>
                                </div>
                            </div>
                        </section>
                        <div class="platform-role-options" data-visible-role-options><span class="muted">Loading roles…</span></div>
                        <button class="btn" type="submit"><i class="fas fa-save"></i> Save Platform</button>
                    </form>
                </div>
            </div>
        `);
        document.getElementById('new-platform-btn')?.addEventListener('click', () => openPlatformModal());
        document.getElementById('manage-platform-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const payload = Object.fromEntries(new FormData(form).entries());
            payload.visible_to_roles = Array.from(form.querySelectorAll('input[name="visible_to_roles"]:checked')).map(input => input.value);
            const action = payload.id ? 'platform-update' : 'platform-create';
            if (payload.id) payload.id = parseInt(payload.id, 10);
            const data = await postJson({ action, current_admin_id: panel.currentAdmin.id, ...payload });
            notify(panel, data.success ? 'Platform saved' : data.error, data.success ? 'success' : 'error');
            if (data.success) {
                form.reset();
                form.elements.id.value = '';
                panel.loadPlatforms();
                panel.loadDashboardStats();
                setTimeout(() => renderManagePlatforms(panel), 150);
            }
        });
        document.getElementById('reset-platform-form')?.addEventListener('click', () => resetPlatformForm());
        document.getElementById('close-platform-modal')?.addEventListener('click', closePlatformModal);
        document.getElementById('platform-edit-modal')?.addEventListener('click', event => {
            if (event.target.id === 'platform-edit-modal') closePlatformModal();
        });
        document.getElementById('platform-modal-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            await savePlatformForm(event.currentTarget, panel);
            closePlatformModal();
        });
        setupPlatformImageControls(panel);
        loadPlatformRoleOptions();
        const originalRender = panel.renderPlatforms.bind(panel);
        panel.renderPlatforms = platforms => {
            originalRender(platforms);
            renderManagePlatforms(panel);
        };
        renderManagePlatforms(panel);
    }

    async function loadPlatformRoleOptions() {
        try {
            const response = await fetch(`${api()}?endpoint=role-access`);
            const data = await response.json();
            if (!response.ok || data.success === false) return;
            const roles = [...new Set([
                'student',
                'instructor',
                ...Object.keys(data.access || {})
            ].map(role => String(role || '').trim().toLowerCase()).filter(Boolean))]
                .sort((left, right) => left.localeCompare(right));
            document.querySelectorAll('[data-visible-role-options]').forEach(container => {
                container.innerHTML = roles.map(role => `
                    <label class="checkbox-row"><input type="checkbox" name="visible_to_roles" value="${escapeHtml(role)}" checked><span>${escapeHtml(role.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase()))}</span></label>
                `).join('');
            });
        } catch {
            // Keep the forms usable if role metadata is temporarily unavailable.
        }
    }

    function renderManagePlatforms(panel) {
        const list = document.getElementById('manage-platform-list');
        if (!list) return;
        const platforms = panel.platforms || [];
        const totalPages = Math.max(1, Math.ceil(platforms.length / platformPageSize));
        platformPage = Math.min(platformPage, totalPages);
        const pageItems = platforms.slice((platformPage - 1) * platformPageSize, platformPage * platformPageSize);
        list.innerHTML = pageItems.map(platform => `
            <div class="managed-platform-card">
                <div class="managed-platform-image">
                    <img src="${escapeHtml(getPlatformImageUrl(platform))}" alt="${escapeHtml(platform.name || 'Platform')} image">
                </div>
                <div>
                    <small>${platform.section || 'Campus'}</small>
                    <strong>${platform.name}</strong>
                    <a href="${platform.url}" target="_blank">${platform.url}</a>
                </div>
                <div class="managed-platform-actions">
                    <button class="btn btn-secondary" onclick="editManagedPlatform(${platform.id})">Edit</button>
                    <button class="btn" style="background:#e74c3c;" onclick="deleteManagedPlatform(${platform.id})">Delete</button>
                </div>
            </div>
        `).join('') || '<p>No platforms yet.</p>';
        renderPlatformPagination(panel, totalPages);
    }

    function renderPlatformPagination(panel, totalPages) {
        const container = document.getElementById('manage-platform-pagination');
        if (!container) return;
        container.innerHTML = `
            <button class="btn btn-secondary" ${platformPage <= 1 ? 'disabled' : ''} id="platform-prev-page">Previous</button>
            <span>Page ${platformPage} of ${totalPages}</span>
            <button class="btn btn-secondary" ${platformPage >= totalPages ? 'disabled' : ''} id="platform-next-page">Next</button>
        `;
        document.getElementById('platform-prev-page')?.addEventListener('click', () => {
            platformPage = Math.max(1, platformPage - 1);
            renderManagePlatforms(panel);
        });
        document.getElementById('platform-next-page')?.addEventListener('click', () => {
            platformPage = Math.min(totalPages, platformPage + 1);
            renderManagePlatforms(panel);
        });
    }

    function resetPlatformForm() {
        const form = document.getElementById('manage-platform-form');
        if (!form) return;
        form.reset();
        form.elements.id.value = '';
    }

    window.editManagedPlatform = function (id) {
        const panel = window.adminPanel;
        const platform = panel?.platforms?.find(item => item.id === id);
        const form = document.getElementById('platform-modal-form');
        if (!platform || !form) return;
        form.elements.id.value = platform.id;
        form.elements.section.value = platform.section || 'Campus';
        form.elements.name.value = platform.name || '';
        form.elements.url.value = platform.url || '';
        form.elements.description.value = platform.description || '';
        form.elements.notifications_url.value = platform.notifications_url || '';
        const roles = platform.visible_to_roles || ['student', 'instructor'];
        form.querySelectorAll('input[name="visible_to_roles"]').forEach(input => input.checked = roles.includes(input.value));
        setPlatformImageState(form, platform);
        document.getElementById('platform-modal-title').textContent = 'Edit Platform';
        document.getElementById('platform-edit-modal')?.classList.add('show');
    };

    function openPlatformModal(platform) {
        const form = document.getElementById('platform-modal-form');
        if (!form) return;
        form.reset();
        form.elements.id.value = '';
        form.querySelectorAll('input[name="visible_to_roles"]').forEach(input => input.checked = true);
        setPlatformImageState(form, platform || null);
        document.getElementById('platform-modal-title').textContent = platform ? 'Edit Platform' : 'Create Platform';
        document.getElementById('platform-edit-modal')?.classList.add('show');
    }

    function closePlatformModal() {
        document.getElementById('platform-edit-modal')?.classList.remove('show');
    }

    async function savePlatformForm(form, panel) {
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.visible_to_roles = Array.from(form.querySelectorAll('input[name="visible_to_roles"]:checked')).map(input => input.value);
        const action = payload.id ? 'platform-update' : 'platform-create';
        if (payload.id) payload.id = parseInt(payload.id, 10);
        const data = await postJson({ action, current_admin_id: panel.currentAdmin.id, ...payload });
        notify(panel, data.success ? 'Platform saved' : data.error, data.success ? 'success' : 'error');
        if (data.success) {
            form.reset();
            form.elements.id.value = '';
            panel.loadPlatforms();
            panel.loadDashboardStats();
        }
    }

    function setupPlatformImageControls(panel) {
        const form = document.getElementById('platform-modal-form');
        if (!form || form.dataset.platformImageReady === 'true') return;
        form.dataset.platformImageReady = 'true';

        const fileInput = form.querySelector('[data-platform-image-input]');
        const imageUrlInput = form.querySelector('[data-platform-image-url]');
        const clearButton = form.querySelector('[data-platform-image-clear]');
        const preview = form.querySelector('[data-platform-image-preview]');

        preview?.addEventListener('error', () => {
            if (preview.getAttribute('src') !== defaultPlatformImage) preview.src = defaultPlatformImage;
        });
        clearButton?.addEventListener('click', () => {
            if (imageUrlInput) imageUrlInput.value = '';
            if (fileInput) fileInput.value = '';
            if (preview) preview.src = defaultPlatformImage;
            setPlatformImageStatus(form, 'The default FIU logo will be used after you save.', 'info');
        });
        fileInput?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            await uploadPlatformImage(form, panel, file);
            event.target.value = '';
        });
    }

    function setPlatformImageState(form, platform) {
        const imageUrlInput = form.querySelector('[data-platform-image-url]');
        const preview = form.querySelector('[data-platform-image-preview]');
        const fileInput = form.querySelector('[data-platform-image-input]');
        const uploadLabel = form.querySelector('[data-platform-image-upload-label]');
        const isPersisted = Number.isInteger(Number(platform?.id)) && Number(platform.id) > 0;
        const imageUrl = platform?.image_url || platform?.imageUrl || '';

        if (imageUrlInput) imageUrlInput.value = imageUrl;
        if (fileInput) fileInput.value = '';
        if (preview) preview.src = getPlatformImageUrl({ image_url: imageUrl });
        if (fileInput) fileInput.disabled = !isPersisted;
        uploadLabel?.classList.toggle('is-disabled', !isPersisted);
        const uploadText = uploadLabel?.querySelector('span');
        if (uploadText) uploadText.textContent = isPersisted ? 'Replace image' : 'Upload image';
        setPlatformImageStatus(
            form,
            isPersisted
                ? 'JPG, PNG, WebP, or GIF. Uploading replaces this platform image.'
                : 'Save the new platform first, then reopen it to upload an image.',
            isPersisted ? 'info' : 'warning'
        );
    }

    async function uploadPlatformImage(form, panel, file) {
        const platformId = Number(form.elements.id?.value);
        if (!Number.isInteger(platformId) || platformId <= 0) {
            setPlatformImageStatus(form, 'Save this platform before uploading an image.', 'warning');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setPlatformImageStatus(form, 'Choose a JPG, PNG, WebP, or GIF image.', 'error');
            return;
        }

        const upload = new FormData();
        upload.append('action', 'platform-image-upload');
        upload.append('platform_id', String(platformId));
        upload.append('file', file);
        if (panel?.currentAdmin?.id) upload.append('current_admin_id', String(panel.currentAdmin.id));

        const preview = form.querySelector('[data-platform-image-preview]');
        const imageUrlInput = form.querySelector('[data-platform-image-url]');
        const localPreviewUrl = URL.createObjectURL(file);
        if (preview) preview.src = localPreviewUrl;
        setPlatformImageStatus(form, 'Uploading image…', 'info');

        try {
            const response = await fetch(api(), {
                method: 'POST',
                credentials: 'same-origin',
                body: upload
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'The platform image could not be uploaded.');
            }

            const imageUrl = typeof data.image_url === 'string' ? data.image_url.trim() : '';
            if (imageUrl) {
                if (imageUrlInput) imageUrlInput.value = imageUrl;
                if (preview) preview.src = getPlatformImageUrl({ image_url: imageUrl });
                const item = panel?.platforms?.find(platform => Number(platform.id) === platformId);
                if (item) item.image_url = imageUrl;
            } else if (preview) {
                // The upload contract only promises `success`; keep the UI
                // usable even while a deployment returns the new URL only on
                // the next platform-list refresh.
                preview.src = getPlatformImageUrl({ image_url: imageUrlInput?.value });
            }
            setPlatformImageStatus(form, imageUrl ? 'Platform image uploaded.' : 'Platform image uploaded. Save the platform to retain the image URL.', 'success');
            panel?.loadPlatforms?.();
        } catch (error) {
            if (preview) preview.src = getPlatformImageUrl({ image_url: imageUrlInput?.value });
            setPlatformImageStatus(form, error?.message || 'The platform image could not be uploaded.', 'error');
        } finally {
            URL.revokeObjectURL(localPreviewUrl);
        }
    }

    function getPlatformImageUrl(platform) {
        const value = String(platform?.image_url || platform?.imageUrl || '').trim();
        if (!value) return defaultPlatformImage;

        try {
            const url = new URL(value, window.location.origin);
            return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : defaultPlatformImage;
        } catch {
            return defaultPlatformImage;
        }
    }

    function setPlatformImageStatus(form, message, tone) {
        const status = form.querySelector('[data-platform-image-status]');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.tone = tone || 'info';
    }

    window.deleteManagedPlatform = async function (id) {
        const panel = window.adminPanel;
        if (!panel || !confirm('Delete this platform?')) return;
        const data = await postJson({ action: 'platform-delete', current_admin_id: panel.currentAdmin.id, id });
        notify(panel, data.success ? 'Platform deleted' : data.error, data.success ? 'success' : 'error');
        if (data.success) {
            panel.loadPlatforms();
            panel.loadDashboardStats();
        }
    };

    function enhanceDining(panel) {
        const section = document.getElementById('dining-menu-section');
        if (!section || document.getElementById('upload-dining-form')) return;
        installDiningCalendar(panel);
        addDiningSmartFilter(section, panel);
        section.querySelector('.dining-header-actions')?.insertAdjacentHTML('beforeend', `
            <button class="btn btn-secondary" id="download-dining-template-btn"><i class="fas fa-file-excel"></i> Template</button>
            <button class="btn btn-secondary" id="export-dining-month-btn"><i class="fas fa-file-excel"></i> Export Month</button>
            <button class="btn" id="show-upload-dining-btn"><i class="fas fa-upload"></i> Import Excel/CSV</button>
        `);
        section.insertAdjacentHTML('afterbegin', `
            <form id="upload-dining-form" class="enhanced-form hidden" enctype="multipart/form-data">
                <input type="file" name="file" accept=".xlsx,.csv,.txt" required>
                <button class="btn" type="submit"><i class="fas fa-upload"></i> Import</button>
            </form>
            <div class="platform-edit-modal" id="dining-conflict-modal">
                <div class="platform-edit-card">
                    <div class="section-header">
                        <h2>Dining Import Conflicts</h2>
                        <button class="btn btn-secondary" type="button" id="close-dining-conflicts">Close</button>
                    </div>
                    <p>Some dates already have dining menus. Choose whether to keep existing menus or accept the new uploaded changes.</p>
                    <div id="dining-conflict-list"></div>
                    <div class="form-actions">
                        <button class="btn btn-secondary" type="button" id="keep-existing-dining">Keep Existing</button>
                        <button class="btn" type="button" id="overwrite-dining-conflicts">Accept New Changes</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('download-dining-template-btn')?.addEventListener('click', () => {
            window.open(`${api()}?endpoint=dining-menu-template`, '_blank');
        });
        document.getElementById('export-dining-month-btn')?.addEventListener('click', () => {
            const selectedMonth = panel.diningCalendarDate || new Date();
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth() + 1;
            window.location.href = `${api()}?endpoint=dining-menu-export&year=${year}&month=${month}`;
        });
        document.getElementById('show-upload-dining-btn')?.addEventListener('click', () => {
            document.getElementById('upload-dining-form')?.classList.toggle('hidden');
        });
        document.getElementById('upload-dining-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            pendingDiningImportForm = event.currentTarget;
            await submitDiningImport(panel, false);
        });
        document.getElementById('close-dining-conflicts')?.addEventListener('click', closeDiningConflictModal);
        document.getElementById('keep-existing-dining')?.addEventListener('click', () => {
            closeDiningConflictModal();
            pendingDiningImportForm?.reset();
        });
        document.getElementById('overwrite-dining-conflicts')?.addEventListener('click', async () => {
            await submitDiningImport(panel, true);
            closeDiningConflictModal();
        });
    }

    function installDiningCalendar(panel) {
        if (panel.__diningCalendarInstalled) return;
        panel.__diningCalendarInstalled = true;
        panel.diningCalendarDate = new Date();
        const originalRender = panel.renderDiningMenus.bind(panel);
        panel.renderDiningMenus = () => renderDiningCalendar(panel, originalRender);
        renderDiningCalendar(panel);
    }

    function addDiningSmartFilter(section, panel) {
        if (document.getElementById('dining-smart-filter')) return;
        section.querySelector('.section-header')?.insertAdjacentHTML('afterend', `
            <div class="smart-filter-row" id="dining-smart-filter">
                <input type="search" id="dining-filter-input" placeholder="Search menu, meal, date, or recurring status">
                <button class="btn btn-secondary" type="button" id="dining-prev-month"><i class="fas fa-chevron-left"></i></button>
                <button class="btn btn-secondary" type="button" id="dining-next-month"><i class="fas fa-chevron-right"></i></button>
            </div>
        `);
        document.getElementById('dining-filter-input')?.addEventListener('input', () => renderDiningCalendar(panel));
        document.getElementById('dining-prev-month')?.addEventListener('click', () => {
            panel.diningCalendarDate.setMonth(panel.diningCalendarDate.getMonth() - 1);
            renderDiningCalendar(panel);
        });
        document.getElementById('dining-next-month')?.addEventListener('click', () => {
            panel.diningCalendarDate.setMonth(panel.diningCalendarDate.getMonth() + 1);
            renderDiningCalendar(panel);
        });
    }

    function renderDiningCalendar(panel, fallbackRender) {
        const container = document.getElementById('dining-menu-list');
        if (!container) return;
        const menus = [...(panel.diningMenus || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!menus.length) {
            container.innerHTML = '<div class="empty-state">No dining menus found.</div>';
            return;
        }
        const anchor = panel.diningCalendarDate || new Date(menus[0].date);
        const year = anchor.getFullYear();
        const month = anchor.getMonth();
        const filter = (document.getElementById('dining-filter-input')?.value || '').trim().toLowerCase();
        const menuByDate = new Map(menus.map(menu => [toDateKey(new Date(menu.date)), menu]));
        const monthMenus = menus.filter(menu => {
            const date = new Date(menu.date);
            const searchable = [
                date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                menu.breakfast_menu,
                menu.lunch_menu,
                menu.is_recurring ? 'recurring' : 'daily'
            ].join(' ').toLowerCase();
            return date.getFullYear() === year && date.getMonth() === month && (!filter || searchable.includes(filter));
        });
        const visibleKeys = new Set(monthMenus.map(menu => toDateKey(new Date(menu.date))));
        const first = new Date(year, month, 1);
        const start = new Date(first);
        start.setDate(first.getDate() - first.getDay());
        const cells = [];
        for (let i = 0; i < 42; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const key = toDateKey(date);
            const menu = menuByDate.get(key);
            const inMonth = date.getMonth() === month;
            const hiddenByFilter = filter && menu && !visibleKeys.has(key);
            cells.push(`
                <button class="calendar-day ${inMonth ? '' : 'muted'} ${menu && !hiddenByFilter ? 'has-menu' : ''}" type="button" ${menu && !hiddenByFilter ? `data-menu-id="${menu.id}"` : ''}>
                    <span>${date.getDate()}</span>
                    ${menu && !hiddenByFilter ? `<strong>${escapeHtml(menu.breakfast_menu || 'Breakfast')}</strong><small>${escapeHtml(menu.lunch_menu || 'Lunch')}</small>` : '<em>No menu</em>'}
                </button>
            `);
        }
        container.innerHTML = `
            <div class="dining-calendar-shell">
                <div class="calendar-header">
                    <h3>${anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                    <span>${monthMenus.length} menu${monthMenus.length === 1 ? '' : 's'} found</span>
                </div>
                <div class="calendar-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div>
                <div class="dining-calendar-grid">${cells.join('')}</div>
            </div>
            <div class="platform-edit-modal" id="dining-day-modal">
                <div class="platform-edit-card" id="dining-day-card"></div>
            </div>
        `;
        container.querySelectorAll('[data-menu-id]').forEach(button => {
            button.addEventListener('click', () => showDiningDayModal(panel, Number(button.dataset.menuId)));
        });
    }

    function showDiningDayModal(panel, id) {
        const menu = (panel.diningMenus || []).find(item => Number(item.id) === Number(id));
        const modal = document.getElementById('dining-day-modal');
        const card = document.getElementById('dining-day-card');
        if (!menu || !modal || !card) return;
        const date = new Date(menu.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        card.innerHTML = `
            <div class="section-header">
                <div><h2>${date}</h2><p class="section-subtitle">${menu.is_recurring ? 'Recurring menu' : 'Daily menu'}</p></div>
                <button class="btn btn-secondary" type="button" id="close-dining-day">Close</button>
            </div>
            <div class="dining-day-detail">
                <article><h3><i class="fas fa-sun"></i> Breakfast</h3><p>${escapeHtml(menu.breakfast_menu || 'No breakfast menu set')}</p><span>${escapeHtml(menu.breakfast_start_time || '')} - ${escapeHtml(menu.breakfast_end_time || '')}</span></article>
                <article><h3><i class="fas fa-utensils"></i> Lunch</h3><p>${escapeHtml(menu.lunch_menu || 'No lunch menu set')}</p><span>${escapeHtml(menu.lunch_start_time || '')} - ${escapeHtml(menu.lunch_end_time || '')}</span></article>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" type="button" id="edit-dining-day"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger" type="button" id="delete-dining-day"><i class="fas fa-trash"></i> Delete</button>
            </div>
        `;
        modal.classList.add('show');
        document.getElementById('close-dining-day')?.addEventListener('click', () => modal.classList.remove('show'));
        document.getElementById('edit-dining-day')?.addEventListener('click', () => {
            modal.classList.remove('show');
            panel.editDiningMenu(menu.id);
        });
        document.getElementById('delete-dining-day')?.addEventListener('click', () => {
            modal.classList.remove('show');
            panel.deleteDiningMenu(menu.id);
        });
    }

    function toDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
    }

    async function submitDiningImport(panel, overwriteConflicts) {
        if (!pendingDiningImportForm) return;
        const form = new FormData(pendingDiningImportForm);
        form.append('action', 'dining-menu-upload');
        form.append('current_admin_id', panel.currentAdmin.id);
        if (overwriteConflicts) form.append('overwrite_conflicts', 'true');
        const response = await fetch(api(), { method: 'POST', body: form });
        const data = await response.json();
        if (data.has_conflicts && !overwriteConflicts) {
            showDiningConflictModal(data.conflicts || []);
            return;
        }
        const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
        const message = data.success ? `Imported ${data.imported} menus${skipped ? `; skipped ${skipped} weekend/holiday dates` : ''}` : data.error;
        notify(panel, message, data.success ? 'success' : 'error');
        if (data.success) {
            panel.loadDiningMenus();
            pendingDiningImportForm.reset();
        }
    }

    function showDiningConflictModal(conflicts) {
        const list = document.getElementById('dining-conflict-list');
        if (list) {
            list.innerHTML = conflicts.map(conflict => `
                <div class="conflict-card">
                    <h3>${conflict.date}</h3>
                    <div class="conflict-grid">
                        <div><strong>Existing</strong><p>${conflict.existing.breakfast_menu} / ${conflict.existing.lunch_menu}</p></div>
                        <div><strong>New upload</strong><p>${conflict.incoming.breakfast_menu} / ${conflict.incoming.lunch_menu}</p></div>
                    </div>
                </div>
            `).join('');
        }
        document.getElementById('dining-conflict-modal')?.classList.add('show');
    }

    function closeDiningConflictModal() {
        document.getElementById('dining-conflict-modal')?.classList.remove('show');
    }

    function enhanceRoleAccess(panel) {
        const section = document.getElementById('users-section');
        if (!section || document.getElementById('role-access-panel')) return;
        section.insertAdjacentHTML('beforeend', `
            <div class="content-section enhanced-panel" id="role-access-panel">
                <div class="section-header"><h2>Role Section Access</h2></div>
                <form id="role-access-form" class="role-access-grid"></form>
            </div>
        `);
        loadRoleAccess(panel);
    }

    async function loadRoleAccess(panel) {
        const response = await fetch(`${api()}?endpoint=role-access`);
        const data = await response.json();
        if (!data.success) return;
        const sections = ['platforms', 'announcements', 'dining-menu', 'notifications'];
        const form = document.getElementById('role-access-form');
        if (!form) return;
        form.innerHTML = ['instructor', 'student'].map(role => `
            <div class="role-access-card">
                <h3>${role}</h3>
                ${sections.map(section => `
                    <label class="role-access-option"><span>${section}</span><input type="checkbox" name="${role}" value="${section}" ${(data.access[role] || []).includes(section) ? 'checked' : ''}></label>
                `).join('')}
            </div>
        `).join('') + '<button class="btn" type="submit"><i class="fas fa-save"></i> Save access</button>';
        form.onsubmit = async event => {
            event.preventDefault();
            const access = {};
            ['instructor', 'student'].forEach(role => {
                access[role] = Array.from(form.querySelectorAll(`input[name="${role}"]:checked`)).map(input => input.value);
            });
            const result = await postJson({ action: 'role-access-update', current_admin_id: panel.currentAdmin.id, access });
            notify(panel, result.success ? 'Role access saved' : result.error, result.success ? 'success' : 'error');
        };
    }

})();
