/**
 * LEAVE RMS - Main Frontend JavaScript
 *
 * Handles user interface, platform integration, authentication, notifications,
 * and theme management for the LEAVE RMS system.
 *
 * @author System Administrator
 * @version 2.0
 */

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

// Read API endpoint from global config (set in config.js)
const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || window.API_BASE_URL || '/database/api.php';
const SIS_URL = 'https://sis.final.edu.tr/';

function portalT(key, fallback, params = {}) {
    const translated = typeof window.t === 'function' ? window.t(key, params, fallback) : null;
    return translated && translated !== key ? translated : fallback;
}

function portalFormatDate(value, options) {
    if (typeof window.formatDate === 'function') return window.formatDate(value, options);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value ?? '') : date.toLocaleDateString(undefined, options);
}

function portalFormatDateTime(value, options) {
    if (typeof window.formatDateTime === 'function') return window.formatDateTime(value, options);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value ?? '') : date.toLocaleString(undefined, options);
}

function portalApiText(payload, fallback) {
    return typeof window.localizeApiMessage === 'function'
        ? window.localizeApiMessage(payload, fallback)
        : (payload?.error || payload?.message || fallback);
}

// =============================================================================
// NOTIFICATION SYSTEM
// =============================================================================

/**
 * Shows a custom notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'warning', 'info')
 */
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--portal-toast-bg, #d1ecf1);
        color: var(--portal-toast-text, #0c5460);
        border: 1px solid var(--portal-toast-border, #bee5eb);
        border-radius: 4px;
        padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .notification-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }
        .notification-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: inherit;
            padding: 0;
            line-height: 1;
        }
        .notification-close:hover {
            opacity: 0.7;
        }
    `;
    document.head.appendChild(style);

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);

    // Add to page
    document.body.appendChild(notification);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // DOM element references
    const elements = {
        loginSection: document.getElementById('login-section'),
        sectionsContainer: document.getElementById('sections-container'),
        platformsSection: document.getElementById('platforms-section'),
        announcementsSection: document.getElementById('announcements-section'),
        diningMenuSection: document.getElementById('dining-menu-section'),
        usernameElement: document.getElementById('username'),
        headerProfileAvatar: document.getElementById('header-profile-avatar'),
        headerProfileName: document.getElementById('header-profile-name'),
        superAdminEntry: document.getElementById('super-admin-entry'),
        logoutBtn: document.getElementById('logout-btn'),
        darkModeBtn: document.getElementById('dark-mode-btn'),
        currentThemeText: document.getElementById('current-theme'),
        userDropdownBtn: document.getElementById('user-dropdown-btn'),
        userDropdown: document.querySelector('.user-dropdown'),
        notificationList: document.getElementById('notification-list'),
        platformsContainer: document.querySelector('.platforms-container'),
        announcementsContainer: document.querySelector('.announcements-container'),
        announcementsList: document.getElementById('announcements-list'),
        archiveContainer: document.getElementById('archive-container'),
        diningMenuContainer: document.querySelector('.dining-menu-container'),
        diningMenuSlider: document.getElementById('dining-menu-slider'),
        diningMenuDots: document.getElementById('dining-menu-dots'),
        diningPrevBtn: document.getElementById('dining-prev-btn'),
        diningNextBtn: document.getElementById('dining-next-btn'),
        diningCalendar: document.getElementById('dining-calendar'),
        diningCalendarGrid: document.getElementById('dining-calendar-grid'),
        diningCalendarMonth: document.getElementById('dining-calendar-month'),
        diningCalendarPrev: document.getElementById('dining-calendar-prev'),
        diningCalendarNext: document.getElementById('dining-calendar-next'),
        diningMenuImportActions: document.getElementById('dining-menu-import-actions'),
        diningMenuImportButton: document.getElementById('dining-menu-import-btn'),
        diningMenuImportFile: document.getElementById('dining-menu-import-file'),
        diningMenuImportStatus: document.getElementById('dining-menu-import-status'),
        dashboardFocusGrid: document.getElementById('dashboard-focus-grid'),
        dashboardMenuSummary: document.getElementById('dashboard-menu-summary'),
        dashboardAnnouncementsSummary: document.getElementById('dashboard-announcements-summary'),
        profileSection: document.getElementById('profile-section'),
        notificationsSection: document.getElementById('notification-section'),
        notificationBtn: document.getElementById('notification-btn'),
        notificationDropdown: document.getElementById('notification-dropdown-content'),
        notificationBadge: document.getElementById('notification-badge')
    };

    // Dining menu slider state
    let diningMenuState = {
        currentSlide: 0,
        totalSlides: 0,
        slides: [],
        touchStartX: 0,
        touchEndX: 0
    };

    // Announcements list state
    let announcementsState = {
        totalSlides: 0,
        slides: [],
        currentPage: 1,
        pageSize: 6,
        searchQuery: ''
    };

    let diningCalendarState = {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        menus: new Map()
    };

    let chatState = {
        socket: null,
        contacts: [],
        activeContact: null,
        messages: new Map(),
        currentUserId: null,
        loadingContactId: null,
        historyRequestId: 0,
        receiptStates: new Map(),
        contactsRefreshTimer: null,
        contactsRefreshInFlight: false,
        contactsRefreshQueued: false
    };

    let platformCatalog = [];
    let mostAccessedPlatforms = [];
    let mostAccessedLoadState = 'idle';
    let educationDirectory = null;

    // Initialize application state
    initializeApplication();

    // =============================================================================
    // EVENT LISTENERS
    // =============================================================================

    setupEventListeners();

    // =============================================================================
    // INITIALIZATION FUNCTIONS
    // =============================================================================

    /**
     * Initializes the application
     */
    function initializeApplication() {
        checkAuthStatus();
        initTheme();
    }

    /**
     * Sets up all event listeners
     */
    function setupEventListeners() {
        setupLogoutHandler();
        setupDarkModeHandler();
        setupPlatformAccessHandler();
        setupUserDropdownHandler();
        setupProfileHandler();
        setupProfilePasswordToggles();
        setupUserSidebar();
        setupCampusChat();
        setupLanguageChangeHandler();
        setupDiningMenuSlider();
        setupDiningCalendar();
        setupDiningMenuImport();
        setupDashboardQuickActions();
    }

    function setupDashboardQuickActions() {
        document.querySelectorAll('[data-dashboard-jump]').forEach(button => {
            button.addEventListener('click', () => {
                const destination = document.getElementById(button.dataset.dashboardJump);
                if (!destination || button.hidden) return;
                if (destination.classList.contains('hidden')) {
                    const sectionById = {
                        'platforms-section': 'platforms',
                        'dining-menu-section': 'dining-menu',
                        'announcements-section': 'announcements'
                    };
                    const sectionKey = sectionById[button.dataset.dashboardJump];
                    if (sectionKey) navigateUserView('section', sectionKey);
                    return;
                }
                destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function setupDiningMenuImport() {
        elements.diningMenuImportButton?.addEventListener('click', () => elements.diningMenuImportFile?.click());
        elements.diningMenuImportFile?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            await importDiningMenu(file);
            event.target.value = '';
        });
    }

    async function importDiningMenu(file) {
        const status = elements.diningMenuImportStatus;
        if (status) status.textContent = portalT('common.loading', 'Importing…');
        const form = new FormData();
        form.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=dining-menu-import`, {
                method: 'POST',
                credentials: 'same-origin',
                body: form
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(portalApiText(data, data.errors?.join(' ') || portalT('dining.importFailed', 'Dining menu import failed.')));
            }
            const details = data.errors?.length ? ` ${data.errors.join(' ')}` : '';
            const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
            const skippedDetails = skipped ? ` ${portalT('dining.skippedDates', 'Skipped {count} weekend/holiday dates.', { count: skipped })}` : '';
            showNotification(`${portalT('dining.imported', 'Imported {count} dining menus.', { count: data.imported || 0 })}${skippedDetails}${details}`, data.imported ? 'success' : 'warning');
            if (status) status.textContent = data.has_conflicts ? portalT('dining.reviewDates', 'Some dates need review.') : skipped ? portalT('dining.importCompleteSkipped', 'Import complete; {count} weekend/holiday dates skipped.', { count: skipped }) : portalT('dining.importComplete', 'Import complete.');
            loadDiningMenu();
        } catch (error) {
            if (status) status.textContent = error.message || portalT('dining.importFailed', 'Import failed.');
            showNotification(error.message || portalT('dining.importFailed', 'Dining menu import failed.'), 'error');
        }
    }

    function setupProfileHandler() {
        const button = document.getElementById('profile-btn');
        const page = elements.profileSection;
        if (!page) return;
        setupProfileEducationFields();
        if (button) {
            button.addEventListener('click', event => {
                event.preventDefault();
                navigateUserView('profile');
            });
        }

        const pictureFile = document.getElementById('profile-page-picture-file');
        document.getElementById('profile-page-picture-trigger')?.addEventListener('click', () => pictureFile?.click());
        pictureFile?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const preview = document.getElementById('profile-page-picture-preview');
            if (preview) preview.src = URL.createObjectURL(file);
            const upload = new FormData();
            upload.append('file', file);
            try {
                const result = await (await fetch(`${API_BASE_URL}?endpoint=profile-picture-upload`, { method: 'POST', body: upload })).json();
                if (!result.success) throw new Error(portalApiText(result, portalT('validation.unableToSave', 'Unable to upload picture', { resource: portalT('profile.picture', 'profile picture') })));
                if (preview) preview.src = result.profile_picture;
                updatePortalProfilePresentation({ profile_picture: result.profile_picture });
                setProfilePageFeedback(portalT('profile.pictureUploaded', 'Profile picture uploaded.'), 'success');
            } catch (error) {
                setProfilePageFeedback(error.message || portalT('validation.unableToSave', 'Unable to upload picture', { resource: portalT('profile.picture', 'profile picture') }), 'error');
            }
        });

        document.getElementById('profile-page-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
            delete payload.file;
            try {
                const result = await (await fetch(`${API_BASE_URL}?endpoint=profile-update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json();
                setProfilePageFeedback(result.success ? portalT('profile.saved', 'Profile saved.') : portalApiText(result, portalT('validation.unableToSave', 'Unable to save profile', { resource: portalT('profile.title', 'profile') })), result.success ? 'success' : 'error');
                if (result.success) updatePortalProfilePresentation(payload);
            } catch (error) {
                setProfilePageFeedback(error.message || portalT('validation.unableToSave', 'Unable to save profile', { resource: portalT('profile.title', 'profile') }), 'error');
            }
        });

        document.getElementById('profile-page-password-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget).entries());
            if (data.new_password !== data.confirm_password) {
                setProfilePageFeedback(portalT('profile.passwordMismatch', 'New passwords do not match.'), 'error');
                return;
            }
            try {
                const result = await (await fetch(`${API_BASE_URL}?endpoint=change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
                setProfilePageFeedback(result.success ? portalT('profile.passwordChanged', 'Password changed.') : portalApiText(result, portalT('validation.unableToSave', 'Unable to change password', { resource: portalT('profile.changePassword', 'password') })), result.success ? 'success' : 'error');
                if (result.success) event.currentTarget.reset();
            } catch (error) {
                setProfilePageFeedback(error.message || portalT('validation.unableToSave', 'Unable to change password', { resource: portalT('profile.changePassword', 'password') }), 'error');
            }
        });
    }

    async function loadProfilePage() {
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=profile`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!data.success) throw new Error(portalApiText(data, portalT('profile.unavailable', 'Profile unavailable.')));
            const profile = data.profile || {};
            const studentNumberField = document.getElementById('profile-page-student-number-field');
            if (studentNumberField) studentNumberField.hidden = String(profile.role || '').toLowerCase() !== 'student';
            ['student_number', 'first_name', 'last_name', 'email'].forEach(key => {
                const field = document.getElementById(`profile-page-${key}`);
                if (field) field.value = profile[key] || '';
            });
            await hydrateProfileEducationFields(profile);
            const preview = document.getElementById('profile-page-picture-preview');
            if (preview) {
                preview.src = profile.profile_picture || '/img/fiu9-mark2.png';
                preview.onerror = () => { preview.src = '/img/fiu9-mark2.png'; };
            }
            updatePortalProfilePresentation(profile);
        } catch (error) {
            setProfilePageFeedback(error.message || portalT('validation.unableToLoad', 'Unable to load profile', { resource: portalT('profile.title', 'profile') }), 'error');
        }
    }

    function setProfilePageFeedback(message, type) {
        const target = document.getElementById('profile-page-feedback');
        if (target) {
            target.textContent = '';
            target.className = '';
        }
        if (message) showNotification(message, type || 'info');
    }

    function setupProfilePasswordToggles() {
        document.querySelectorAll('[data-password-toggle]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const input = document.getElementById(toggle.dataset.passwordToggle);
                if (!input) return;
                const shouldShow = input.type === 'password';
                input.type = shouldShow ? 'text' : 'password';
                toggle.setAttribute('aria-pressed', String(shouldShow));
                toggle.setAttribute('aria-label', `${shouldShow ? 'Hide' : 'Show'} ${input.closest('label')?.childNodes[0]?.textContent?.trim() || 'password'}`);
                const icon = toggle.querySelector('i');
                if (icon) icon.className = `fas fa-eye${shouldShow ? '-slash' : ''}`;
            });
        });
    }

    function setupProfileEducationFields() {
        const faculty = document.getElementById('profile-page-faculty');
        if (!faculty || faculty.dataset.educationBound === 'true') return;
        faculty.dataset.educationBound = 'true';
        faculty.addEventListener('change', () => populateDepartmentSelect(faculty.value, ''));
    }

    async function hydrateProfileEducationFields(profile = {}) {
        const facultyValue = String(profile.faculty || '').trim();
        const departmentValue = String(profile.department || '').trim();
        const canEditAffiliation = String(profile.role || '').toLowerCase() === 'instructor';
        try {
            const directory = await loadEducationDirectory();
            populateFacultySelect(directory, facultyValue);
            populateDepartmentSelect(facultyValue, departmentValue, directory);
        } catch (_) {
            populateFacultySelect(null, facultyValue);
            populateDepartmentSelect(facultyValue, departmentValue, null);
        }
        const faculty = document.getElementById('profile-page-faculty');
        const department = document.getElementById('profile-page-department');
        if (faculty) faculty.disabled = faculty.disabled || !canEditAffiliation;
        if (department) department.disabled = department.disabled || !canEditAffiliation;
    }

    async function loadEducationDirectory() {
        if (educationDirectory) return educationDirectory;
        const response = await fetch(`${API_BASE_URL}?endpoint=faculty-departments`, { credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.error || 'Faculty and department configuration is unavailable');
        educationDirectory = normalizeEducationDirectory(data);
        return educationDirectory;
    }

    function normalizeEducationDirectory(payload) {
        const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
        const rawFaculties = Array.isArray(data.faculties)
            ? data.faculties
            : Array.isArray(data.faculty_departments)
                ? data.faculty_departments
                : [];
        const faculties = [];
        const byKey = new Map();
        const normalizeKey = value => String(value || '').trim().toLocaleLowerCase();
        const optionName = (item, fields) => {
            if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
            if (!item || typeof item !== 'object') return '';
            for (const field of fields) {
                const value = item[field];
                if (typeof value === 'string' || typeof value === 'number') {
                    if (String(value).trim()) return String(value).trim();
                }
                if (value && typeof value === 'object') {
                    const nested = value.name || value.label || value.title;
                    if (String(nested || '').trim()) return String(nested).trim();
                }
            }
            return '';
        };
        const addFaculty = item => {
            const name = optionName(item, ['name', 'faculty_name', 'faculty', 'label', 'title']);
            if (!name) return null;
            const key = normalizeKey(name);
            if (!byKey.has(key)) {
                const record = { id: String(item?.id || item?.faculty_id || name), name, departments: [] };
                byKey.set(key, record);
                faculties.push(record);
            }
            return byKey.get(key);
        };
        const addDepartment = (faculty, item) => {
            if (!faculty) return;
            const name = optionName(item, ['name', 'department_name', 'department', 'label', 'title']);
            if (!name || faculty.departments.some(entry => normalizeKey(entry) === normalizeKey(name))) return;
            faculty.departments.push(name);
        };

        rawFaculties.forEach(item => {
            const faculty = addFaculty(item);
            const departments = Array.isArray(item?.departments)
                ? item.departments
                : Array.isArray(item?.department_list)
                    ? item.department_list
                    : [];
            departments.forEach(department => addDepartment(faculty, department));
        });

        if (data.faculties && !Array.isArray(data.faculties) && typeof data.faculties === 'object') {
            Object.entries(data.faculties).forEach(([facultyName, departments]) => {
                const faculty = addFaculty(facultyName);
                (Array.isArray(departments) ? departments : []).forEach(department => addDepartment(faculty, department));
            });
        }

        const globalDepartments = Array.isArray(data.departments) ? data.departments : [];
        globalDepartments.forEach(department => {
            const facultyName = optionName(department, ['faculty_name', 'faculty', 'faculty_label']);
            const facultyId = String(department?.faculty_id || department?.facultyId || '');
            const faculty = faculties.find(entry =>
                (facultyId && String(entry.id) === facultyId) ||
                normalizeKey(entry.name) === normalizeKey(facultyName)
            );
            addDepartment(faculty, department);
        });

        return faculties
            .map(faculty => ({ ...faculty, departments: faculty.departments.sort((a, b) => a.localeCompare(b)) }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    function populateFacultySelect(directory, selectedValue = '') {
        const select = document.getElementById('profile-page-faculty');
        if (!select) return;
        const selected = String(selectedValue || '').trim();
        const faculties = Array.isArray(directory) ? directory : [];
        select.replaceChildren();
        appendSelectOption(select, '', faculties.length ? portalT('profile.selectFaculty', 'Select a faculty') : portalT('profile.facultyUnavailable', 'Faculty configuration is unavailable'));
        faculties.forEach(faculty => appendSelectOption(select, faculty.name, faculty.name));
        if (selected && !faculties.some(faculty => faculty.name.localeCompare(selected, undefined, { sensitivity: 'accent' }) === 0)) {
            appendSelectOption(select, selected, `${selected} (current)`);
        }
        select.disabled = !faculties.length && !selected;
        select.value = selected;
    }

    function populateDepartmentSelect(facultyValue, selectedValue = '', directory = educationDirectory) {
        const select = document.getElementById('profile-page-department');
        if (!select) return;
        const faculty = String(facultyValue || '').trim();
        const selected = String(selectedValue || '').trim();
        const entries = Array.isArray(directory) ? directory : [];
        const activeFaculty = entries.find(entry => entry.name.localeCompare(faculty, undefined, { sensitivity: 'accent' }) === 0);
        const departments = activeFaculty?.departments || [];
        select.replaceChildren();
        appendSelectOption(select, '', faculty ? (departments.length ? portalT('profile.selectDepartment', 'Select a department') : portalT('profile.noDepartments', 'No departments configured')) : portalT('profile.chooseFacultyFirst', 'Choose a faculty first'));
        departments.forEach(department => appendSelectOption(select, department, department));
        if (selected && !departments.some(department => department.localeCompare(selected, undefined, { sensitivity: 'accent' }) === 0)) {
            appendSelectOption(select, selected, `${selected} (current)`);
        }
        // Keep an empty department selectable when a faculty has no configured
        // departments yet; otherwise a stale saved department could never be
        // cleared from the profile form.
        select.disabled = !faculty;
        select.value = selected;
    }

    function appendSelectOption(select, value, label) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }

    function updatePortalProfilePresentation(changes = {}) {
        const current = getUserFromStorage() || {};
        const user = { ...current, ...changes };
        if (Object.keys(user).length) localStorage.setItem('user', JSON.stringify(user));
        const picture = user.profile_picture || '/img/fiu9-mark2.png';
        if (elements.headerProfileAvatar) {
            elements.headerProfileAvatar.src = picture;
            elements.headerProfileAvatar.onerror = () => { elements.headerProfileAvatar.src = '/img/fiu9-mark2.png'; };
        }
        if (elements.headerProfileName) {
            const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || 'Account';
            elements.headerProfileName.textContent = displayName;
        }
    }

    function injectProfileModal() {
        if (document.getElementById('profile-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `<div id="profile-modal" class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div class="profile-dialog"><button type="button" class="profile-close" id="profile-close" data-i18n-aria-label="common.close">&times;</button><div class="profile-heading"><img id="profile-picture-preview" src="/img/fiu9-mark2.png" alt="Profile picture" data-i18n-alt="profile.picture"><div><h2 id="profile-title" data-i18n="profile.title">My profile</h2><p data-i18n="profile.description">Keep your account details up to date.</p></div></div><form id="profile-form" class="profile-form"><label id="profile-modal-student-number-field"><span data-i18n="profile.studentNumber">Student number</span><input id="profile-student_number" name="student_number"></label><label><span data-i18n="profile.firstName">First name</span><input id="profile-first_name" name="first_name"></label><label><span data-i18n="profile.surname">Surname</span><input id="profile-last_name" name="last_name"></label><label class="profile-upload-field"><span data-i18n="profile.picture">Profile picture</span><input id="profile-picture-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small data-i18n="profile.uploadHelp">JPG, PNG, WebP or GIF, up to 5MB</small></label><label><span data-i18n="profile.faculty">Faculty</span><input id="profile-faculty" name="faculty"></label><label><span data-i18n="profile.department">Department</span><input id="profile-department" name="department"></label><button class="btn btn-primary" type="submit" data-i18n="profile.save">Save profile</button></form><hr><form id="profile-password-form" class="profile-form"><h3 data-i18n="profile.changePassword">Change password</h3><label><span data-i18n="profile.currentPassword">Current password</span><input name="current_password" type="password" required></label><label><span data-i18n="profile.newPassword">New password</span><input name="new_password" type="password" minlength="8" required></label><label><span data-i18n="profile.confirmNewPassword">Confirm new password</span><input name="confirm_password" type="password" minlength="8" required></label><button class="btn" type="submit" data-i18n="profile.changePassword">Change password</button></form><div id="profile-feedback" aria-live="polite"></div></div></div>`);
        const profileRole = String(getUserFromStorage()?.role || '').toLowerCase();
        const studentNumberField = document.getElementById('profile-modal-student-number-field');
        if (studentNumberField) studentNumberField.hidden = profileRole !== 'student';
        window.translatePage?.(document.getElementById('profile-modal'));
        document.getElementById('profile-close').addEventListener('click', () => document.getElementById('profile-modal').classList.remove('show'));
        document.getElementById('profile-picture-preview').addEventListener('error', event => { event.currentTarget.src = '/img/fiu9-mark2.png'; });
        document.getElementById('profile-picture-file').addEventListener('change', async event => {
            const file = event.target.files?.[0]; if (!file) return;
            const preview = document.getElementById('profile-picture-preview'); preview.src = URL.createObjectURL(file);
            const upload = new FormData(); upload.append('file', file);
            try { const result = await (await fetch(`${API_BASE_URL}?endpoint=profile-picture-upload`, { method: 'POST', body: upload })).json(); if (!result.success) throw new Error(portalApiText(result, portalT('validation.unableToSave', 'Unable to upload picture', { resource: portalT('profile.picture', 'profile picture') }))); preview.src = result.profile_picture; setProfileFeedback(portalT('profile.pictureUploaded', 'Profile picture uploaded.'), 'success'); }
            catch (error) { setProfileFeedback(error.message || portalT('validation.unableToSave', 'Unable to upload picture', { resource: portalT('profile.picture', 'profile picture') }), 'error'); }
        });
        document.getElementById('profile-form').addEventListener('submit', async event => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget).entries()); delete payload.file; const result = await (await fetch(`${API_BASE_URL}?endpoint=profile-update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json(); setProfileFeedback(result.success ? 'Profile saved.' : (result.error || 'Unable to save profile'), result.success ? 'success' : 'error'); });
        document.getElementById('profile-password-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); if (data.new_password !== data.confirm_password) { setProfileFeedback('New passwords do not match.', 'error'); return; } const result = await (await fetch(`${API_BASE_URL}?endpoint=change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json(); setProfileFeedback(result.success ? 'Password changed.' : (result.error || 'Unable to change password'), result.success ? 'success' : 'error'); if (result.success) event.currentTarget.reset(); });
        document.getElementById('profile-modal').addEventListener('click', event => { if (event.target.id === 'profile-modal') event.currentTarget.classList.remove('show'); });
    }

    function setProfileFeedback(message, type) { const target = document.getElementById('profile-feedback'); if (target) { target.textContent = message; target.className = type; } }

    function setupUserSidebar() {
        const navigation = document.getElementById('user-sidebar-nav');
        const mobileNavigation = document.getElementById('mobile-section-nav');
        const menuButton = document.getElementById('mobile-section-menu-btn');
        const drawer = document.getElementById('mobile-section-drawer');
        const closeButton = document.getElementById('mobile-section-drawer-close');
        const backdrop = document.getElementById('mobile-section-drawer-backdrop');
        document.body.classList.remove('user-sidebar-collapsed');
        localStorage.removeItem('user_sidebar_collapsed');

        const handleNavigationClick = event => {
            const button = event.target.closest('[data-user-view]');
            if (button) {
                navigateUserView(button.dataset.userView, button.dataset.sectionKey);
                setMobileSectionDrawerOpen(false);
                return;
            }
            if (event.target.closest('a[href]')) setMobileSectionDrawerOpen(false);
        };

        navigation?.addEventListener('click', handleNavigationClick);
        mobileNavigation?.addEventListener('click', handleNavigationClick);
        menuButton?.addEventListener('click', () => setMobileSectionDrawerOpen(drawer?.hidden !== false));
        closeButton?.addEventListener('click', () => setMobileSectionDrawerOpen(false));
        backdrop?.addEventListener('click', () => setMobileSectionDrawerOpen(false));
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape') setMobileSectionDrawerOpen(false);
        });

        window.addEventListener('popstate', () => {
            const route = getPortalRoute();
            showUserView(route.view, route.sectionKey);
        });

    }

    function setMobileSectionDrawerOpen(open) {
        const drawer = document.getElementById('mobile-section-drawer');
        const backdrop = document.getElementById('mobile-section-drawer-backdrop');
        const menuButton = document.getElementById('mobile-section-menu-btn');
        if (drawer) drawer.hidden = !open;
        if (backdrop) backdrop.hidden = !open;
        menuButton?.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('mobile-section-drawer-open', open);
    }

    function renderUserSidebar(user) {
        document.body.classList.add('portal-ready');
        document.querySelector('.container')?.classList.add('portal-with-sidebar');
        const roleLabel = document.getElementById('user-sidebar-role');
        if (roleLabel) roleLabel.textContent = `${String(user.role || 'user').replace(/[-_]/g, ' ')} ${portalT('portal.portal', 'portal')}`;
        const labels = {
            platforms: ['fa-layer-group', portalT('navigation.platforms', 'Platforms')],
            announcements: ['fa-bullhorn', portalT('navigation.announcements', 'Announcements')],
            'dining-menu': ['fa-utensils', portalT('navigation.diningMenu', 'Dining menu')]
        };
        const allowed = Array.isArray(user.allowed_sections)
            ? user.allowed_sections.map(section => String(section).toLowerCase())
            : ['platforms', 'announcements', 'dining-menu'];
        const markup = allowed.filter(section => labels[section]).map(section => `<button type="button" class="mobile-section-entry" data-user-view="section" data-section-key="${section}"><i class="fas ${labels[section][0]}" aria-hidden="true"></i><span>${labels[section][1]}</span></button>`).join('');
        document.getElementById('user-sidebar-granted')?.replaceChildren();
        document.getElementById('user-sidebar-granted')?.insertAdjacentHTML('beforeend', markup);
        document.getElementById('mobile-sidebar-granted')?.replaceChildren();
        document.getElementById('mobile-sidebar-granted')?.insertAdjacentHTML('beforeend', markup);
    }

    function getPortalBasePath() {
        return /^\/student_dashboard(?:\/|$)/i.test(window.location.pathname)
            ? '/student_dashboard'
            : '/instructor_dashboard';
    }

    function getPortalRoute() {
        const base = getPortalBasePath();
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const suffix = path.slice(base.length).replace(/^\/+/, '').toLowerCase();
        if (suffix === 'chat') return { view: 'chat', sectionKey: null };
        if (suffix === 'profile') return { view: 'profile', sectionKey: null };
        if (suffix === 'platforms') return { view: 'section', sectionKey: 'platforms' };
        if (suffix === 'dining-menu') return { view: 'section', sectionKey: 'dining-menu' };
        if (suffix === 'announcements') return { view: 'section', sectionKey: 'announcements' };
        return { view: 'dashboard', sectionKey: null };
    }

    function navigateUserView(view, sectionKey) {
        const key = view === 'section' ? sectionKey : view;
        const segment = key && key !== 'dashboard' ? `/${key}` : '';
        const route = `${getPortalBasePath()}${segment}`;
        if (window.location.pathname !== route) {
            window.history.pushState({ portalView: key || 'dashboard' }, '', route);
        }
        showUserView(view, sectionKey);
    }

    function showUserView(view, sectionKey) {
        const dashboard = elements.sectionsContainer;
        const chat = document.getElementById('chat-section');
        const profile = elements.profileSection;
        const dining = elements.diningMenuSection;
        const announcements = elements.announcementsSection;
        const user = getUserFromStorage() || {};
        const requestedSection = view === 'section' ? sectionKey : null;

        // A route can be entered directly even when its sidebar item is not
        // available. Keep the view, data requests, and route authorization in
        // agreement instead of leaving the user on an empty or partially
        // visible section.
        if (requestedSection && !hasSectionAccess(user, requestedSection)) {
            navigateUserView('dashboard');
            return;
        }

        const canUseDining = hasSectionAccess(user, 'dining-menu');
        const canUseAnnouncements = hasSectionAccess(user, 'announcements');
        document.documentElement.dataset.portalView = view === 'section' ? (sectionKey || 'dashboard') : (view || 'dashboard');
        document.body.classList.remove('portal-view-dashboard', 'portal-view-chat', 'portal-view-profile', 'portal-view-platforms', 'portal-view-dining-menu', 'portal-view-announcements');
        const viewClass = view === 'section' ? `portal-view-${sectionKey || 'dashboard'}` : `portal-view-${view || 'dashboard'}`;
        document.body.classList.add(viewClass);
        document.querySelectorAll('#user-sidebar-nav [data-user-view], #mobile-section-nav [data-user-view]').forEach(button => button.classList.toggle('active', button.dataset.userView === view && (!sectionKey || button.dataset.sectionKey === sectionKey)));
        const showDashboard = view === 'dashboard' || (view === 'section' && sectionKey === 'platforms');
        const isPlatformsRoute = view === 'section' && sectionKey === 'platforms';
        const showDining = canUseDining && view === 'section' && sectionKey === 'dining-menu';
        const showAnnouncements = canUseAnnouncements && view === 'section' && sectionKey === 'announcements';
        dashboard?.classList.toggle('hidden', !showDashboard);
        elements.dashboardFocusGrid?.classList.toggle('hidden', isPlatformsRoute);
        chat?.classList.toggle('hidden', view !== 'chat');
        profile?.classList.toggle('hidden', view !== 'profile');
        dining?.classList.toggle('hidden', !showDining);
        announcements?.classList.toggle('hidden', !showAnnouncements);
        if (view === 'chat') {
            setTimeout(() => document.getElementById('chat-contact-search')?.focus(), 0);
            return;
        }
        if (view === 'profile') {
            loadProfilePage();
            return;
        }
        applySectionAccess(user);
        if (canUseDining && (view === 'dashboard' || (view === 'section' && sectionKey === 'dining-menu'))) loadDiningMenu();
        if (canUseAnnouncements && (view === 'dashboard' || (view === 'section' && sectionKey === 'announcements'))) loadAnnouncements();
    }

    function setupCampusChat() {
        const form = document.getElementById('campus-chat-form');
        const messages = document.getElementById('campus-chat-messages');
        const contactsList = document.getElementById('chat-contacts-list');
        if (!form || !messages || !contactsList) return;
        const user = getUserFromStorage() || {};
        chatState.currentUserId = Number(user.id) || null;
        loadChatContacts();
        connectChatSocket();

        document.getElementById('chat-contact-search')?.addEventListener('input', event => {
            renderChatContacts(event.target.value || '');
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const input = document.getElementById('campus-chat-input');
            const message = input?.value.trim();
            if (!message || !chatState.activeContact || !chatState.socket || chatState.socket.readyState !== WebSocket.OPEN) return;
            chatState.socket.send(JSON.stringify({ type: 'message', recipient_id: chatState.activeContact.id, text: message }));
            input.value = '';
        });
    }

    async function loadChatContacts() {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;
        if (chatState.contactsRefreshInFlight) {
            chatState.contactsRefreshQueued = true;
            return;
        }
        chatState.contactsRefreshInFlight = true;
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=chat-users`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(portalApiText(data, portalT('validation.unableToLoad', 'Unable to load people', { resource: portalT('chat.people', 'people') })));
            const previousById = new Map(chatState.contacts.map(contact => [Number(contact.id), contact]));
            const incoming = Array.isArray(data.users) ? data.users : [];
            chatState.contacts = incoming.map(contact => ({ ...previousById.get(Number(contact.id)), ...contact }));
            if (chatState.activeContact) {
                chatState.activeContact = chatState.contacts.find(contact => Number(contact.id) === Number(chatState.activeContact.id)) || null;
            }
            renderChatContacts(document.getElementById('chat-contact-search')?.value || '');
            updateChatUnreadIndicator();
        } catch (error) {
            list.innerHTML = `<p class="chat-empty-state">${escapePortalHtml(error.message || portalT('validation.unableToLoad', 'Unable to load people', { resource: portalT('chat.people', 'people') }))}</p>`;
        } finally {
            chatState.contactsRefreshInFlight = false;
            if (chatState.contactsRefreshQueued && chatState.currentUserId) {
                chatState.contactsRefreshQueued = false;
                loadChatContacts();
            } else {
                chatState.contactsRefreshQueued = false;
            }
        }
    }

    function startChatContactRefresh() {
        if (chatState.contactsRefreshTimer) return;
        chatState.contactsRefreshTimer = window.setInterval(() => {
            if (document.visibilityState !== 'hidden' && chatState.currentUserId) loadChatContacts();
        }, 15000);
    }

    function updateChatUnreadIndicator() {
        const button = document.querySelector('#user-sidebar-nav [data-user-view="chat"]');
        if (!button) return;
        let badge = button.querySelector('[data-chat-nav-unread]');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'chat-nav-unread';
            badge.dataset.chatNavUnread = '';
            badge.setAttribute('aria-live', 'polite');
            button.appendChild(badge);
        }
        const count = chatState.contacts.reduce((total, contact) => total + (Number(contact.unread_count) || 0), 0);
        badge.hidden = count === 0;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.title = count ? `${count} unread chat message${count === 1 ? '' : 's'}` : '';
        badge.setAttribute('aria-label', count ? `${count} unread chat message${count === 1 ? '' : 's'}` : 'No unread chat messages');
        button.classList.toggle('has-chat-unread', count > 0);
    }

    function renderChatContacts(filter = '') {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;
        const normalized = String(filter).trim().toLowerCase();
        const contacts = chatState.contacts
            .filter(contact => `${contact.name} ${contact.username} ${contact.role} ${contact.last_message || ''}`.toLowerCase().includes(normalized))
            .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
        if (!contacts.length) {
            list.innerHTML = `<p class="chat-empty-state">${portalT('chat.noUsers', 'No users found.')}</p>`;
            updateChatUnreadIndicator();
            return;
        }
        list.innerHTML = contacts.map(contact => {
            const unread = Number(contact.unread_count) || 0;
            const preview = contact.last_message ? contact.last_message : portalT('chat.noMessages', 'No messages yet');
            const time = formatChatContactTime(contact.last_message_at);
            const unreadLabel = unread ? portalT('chat.unread', '{count} unread messages', { count: unread }) : '';
            return `<button type="button" class="chat-contact${chatState.activeContact?.id === contact.id ? ' active' : ''}${unread ? ' has-unread' : ''}" data-chat-contact-id="${contact.id}" aria-label="Chat with ${escapePortalHtml(contact.name || contact.username)}${unread ? `, ${escapePortalHtml(unreadLabel)}` : ''}"><img src="${escapePortalHtml(contact.profile_picture || '/img/fiu9-mark2.png')}" alt=""><span class="chat-contact-copy"><strong>${escapePortalHtml(contact.name || contact.username)}</strong><small class="chat-contact-preview">${escapePortalHtml(preview)}</small></span><span class="chat-contact-meta">${time ? `<time class="chat-contact-time">${escapePortalHtml(time)}</time>` : ''}${unread ? `<span class="chat-unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</span></button>`;
        }).join('');
        list.querySelectorAll('[data-chat-contact-id]').forEach(button => button.addEventListener('click', () => selectChatContact(Number(button.dataset.chatContactId))));
        updateChatUnreadIndicator();
    }

    function formatChatContactTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const now = new Date();
        if (date.toDateString() === now.toDateString()) return portalFormatDateTime(date, { hour: '2-digit', minute: '2-digit' });
        const dayDiff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
        return dayDiff >= 0 && dayDiff < 7 ? portalFormatDate(date, { weekday: 'short' }) : portalFormatDate(date, { month: 'short', day: 'numeric' });
    }

    async function selectChatContact(contactId) {
        const contact = chatState.contacts.find(item => item.id === contactId);
        if (!contact) return;
        chatState.activeContact = contact;
        contact.unread_count = 0;
        updateChatUnreadIndicator();
        const active = document.getElementById('chat-active-contact');
        if (active) active.innerHTML = `<img src="${escapePortalHtml(contact.profile_picture || '/img/fiu9-mark2.png')}" alt=""><span><strong>${escapePortalHtml(contact.name || contact.username)}</strong><small>${escapePortalHtml(contact.role || 'user')}</small></span>`;
        const input = document.getElementById('campus-chat-input');
        const submit = document.querySelector('#campus-chat-form button[type="submit"]');
        if (input) { input.disabled = false; input.placeholder = `Message ${contact.name || contact.username}…`; }
        if (submit) submit.disabled = false;
        renderChatContacts(document.getElementById('chat-contact-search')?.value || '');
        const requestId = ++chatState.historyRequestId;
        chatState.loadingContactId = contactId;
        chatState.messages.set(contactId, []);
        renderChatMessages();
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=chat-history&contact_id=${encodeURIComponent(contactId)}`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(portalApiText(data, portalT('validation.unableToLoad', 'Unable to load conversation', { resource: portalT('chat.title', 'conversation') })));
            if (requestId !== chatState.historyRequestId || chatState.activeContact?.id !== contactId) return;
            const stored = Array.isArray(data.messages) ? data.messages : [];
            const live = chatState.messages.get(contactId) || [];
            const merged = new Map([...stored, ...live].map(item => [item.id || `${item.sender_id}:${item.sent_at}:${item.text}`, item]));
            const history = Array.from(merged.values()).sort((a, b) => new Date(a.sent_at || 0) - new Date(b.sent_at || 0));
            chatState.messages.set(contactId, history);
            updateContactSummaryFromHistory(contactId, history);
        } catch (error) {
            if (requestId !== chatState.historyRequestId || chatState.activeContact?.id !== contactId) return;
            chatState.messages.set(contactId, []);
            showNotification(error.message || portalT('validation.unableToLoad', 'Unable to load conversation', { resource: portalT('chat.title', 'conversation') }), 'error');
        } finally {
            if (requestId === chatState.historyRequestId && chatState.activeContact?.id === contactId) {
                chatState.loadingContactId = null;
                renderChatMessages();
            }
        }
    }

    function updateContactSummaryFromHistory(contactId, items) {
        const contact = chatState.contacts.find(item => Number(item.id) === Number(contactId));
        if (!contact || !items.length) return;
        const latest = items[items.length - 1];
        contact.last_message = latest.text || '';
        contact.last_message_at = latest.sent_at || contact.last_message_at || null;
        contact.last_message_sender_id = latest.sender_id;
        contact.unread_count = 0;
        renderChatContacts(document.getElementById('chat-contact-search')?.value || '');
        updateChatUnreadIndicator();
    }

    function connectChatSocket() {
        if (!chatState.currentUserId) return;
        if (chatState.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(chatState.socket.readyState)) return;
        const status = document.getElementById('chat-connection-status');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        try {
            chatState.socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
        } catch (_) {
            if (status) status.textContent = portalT('chat.unavailable', 'Unavailable');
            return;
        }
        chatState.socket.addEventListener('open', () => {
            if (status) { status.textContent = portalT('chat.live', 'Live'); status.classList.add('is-online'); }
            if (chatState.activeContact) renderChatMessages();
        });
        chatState.socket.addEventListener('message', event => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'message') {
                    const otherId = Number(payload.sender_id) === chatState.currentUserId ? Number(payload.recipient_id) : Number(payload.sender_id);
                    const items = chatState.messages.get(otherId) || [];
                    items.push(payload);
                    chatState.messages.set(otherId, items);
                    const isIncoming = Number(payload.recipient_id) === chatState.currentUserId && Number(payload.sender_id) !== chatState.currentUserId;
                    const contact = chatState.contacts.find(item => Number(item.id) === otherId);
                    if (contact) {
                        contact.last_message = payload.text || '';
                        contact.last_message_at = payload.sent_at || new Date().toISOString();
                        contact.last_message_sender_id = payload.sender_id;
                        if (isIncoming && chatState.activeContact?.id !== otherId) {
                            contact.unread_count = (Number(contact.unread_count) || 0) + 1;
                        }
                        renderChatContacts(document.getElementById('chat-contact-search')?.value || '');
                        updateChatUnreadIndicator();
                    }
                    if (isIncoming) sendChatReceipt(payload, 'received');
                    if (chatState.activeContact?.id === otherId) renderChatMessages();
                } else if (payload.type === 'message-status' || payload.type === 'message_status' || payload.type === 'receipt') {
                    updateChatMessageStatus(payload);
                } else if (payload.type === 'error') {
                    showNotification(portalApiText(payload, portalT('validation.unableToSave', 'Unable to send message', { resource: portalT('chat.message', 'message') })), 'error');
                }
            } catch (_) { }
        });
        chatState.socket.addEventListener('close', () => {
            if (status) { status.textContent = portalT('chat.offline', 'Offline'); status.classList.remove('is-online'); }
            window.setTimeout(() => { if (document.visibilityState !== 'hidden' && chatState.currentUserId) connectChatSocket(); }, 2500);
        });
        chatState.socket.addEventListener('error', () => {
            if (status) { status.textContent = portalT('chat.offline', 'Offline'); status.classList.remove('is-online'); }
        });
    }

    function renderChatMessages() {
        const messages = document.getElementById('campus-chat-messages');
        if (!messages) return;
        if (!chatState.activeContact) {
            messages.innerHTML = `<div class="chat-empty-state">${portalT('chat.messagesAppear', 'Your messages will appear here.')}</div>`;
            return;
        }
        if (chatState.loadingContactId === chatState.activeContact.id) {
            messages.innerHTML = `<div class="chat-empty-state">${portalT('chat.loadingConversation', 'Loading conversation…')}</div>`;
            return;
        }
        const items = chatState.messages.get(chatState.activeContact.id) || [];
        if (!items.length) {
            messages.innerHTML = `<div class="chat-empty-state">${portalT('chat.noMessages', 'No messages yet.')}</div>`;
            return;
        }
        messages.innerHTML = items.map(item => {
            const isMine = Number(item.sender_id) === chatState.currentUserId;
            const time = item.sent_at ? portalFormatDateTime(item.sent_at, { hour: '2-digit', minute: '2-digit' }) : '';
            const delivery = isMine ? getChatDeliveryStatus(item) : null;
            const deliveryMarkup = delivery ? `<span class="chat-delivery-status is-${delivery}" aria-label="${portalT('chat.message', 'Message')} ${delivery}"><i class="fas ${delivery === 'seen' ? 'fa-check-double' : delivery === 'received' ? 'fa-check-double' : 'fa-check'}" aria-hidden="true"></i>${escapePortalHtml(formatChatDeliveryStatus(delivery))}</span>` : '';
            const metaMarkup = (time || deliveryMarkup) ? `<div class="chat-message-meta">${time ? `<time>${time}</time>` : ''}${deliveryMarkup}</div>` : '';
            return `<div class="chat-message ${isMine ? 'user' : 'assistant'}"><span>${escapePortalHtml(isMine ? 'You' : item.sender_name)}</span><p>${escapePortalHtml(item.text)}</p>${metaMarkup}</div>`;
        }).join('');
        messages.scrollTop = messages.scrollHeight;
        markActiveConversationSeen(items);
    }

    function getChatDeliveryStatus(message) {
        const raw = String(message?.delivery_status || message?.deliveryStatus || message?.status || message?.state || '').trim().toLowerCase();
        if (['seen', 'read'].includes(raw) || message?.seen_at) return 'seen';
        if (['received', 'delivered'].includes(raw) || message?.received_at || message?.delivered_at) return 'received';
        if (['sent', 'queued', 'sending'].includes(raw)) return raw === 'queued' || raw === 'sending' ? 'sent' : raw;
        return '';
    }

    function formatChatDeliveryStatus(status) {
        return ({ sent: portalT('chat.sent', 'Sent'), received: portalT('chat.received', 'Received'), seen: portalT('chat.seen', 'Seen') })[status] || '';
    }

    function updateChatMessageStatus(payload) {
        const source = payload?.message && typeof payload.message === 'object' ? { ...payload, ...payload.message } : payload || {};
        const messageId = String(source.message_id || source.id || '');
        const status = getChatDeliveryStatus(source);
        if (!messageId || !status) return;
        let changedActiveConversation = false;
        chatState.messages.forEach((items, contactId) => {
            const message = items.find(item => String(item.id || item.message_id || '') === messageId);
            if (!message) return;
            message.delivery_status = status;
            if (status === 'seen') message.seen_at = source.seen_at || source.updated_at || new Date().toISOString();
            if (status === 'received') message.received_at = source.received_at || source.delivered_at || source.updated_at || new Date().toISOString();
            if (chatState.activeContact?.id === contactId) changedActiveConversation = true;
        });
        if (changedActiveConversation) renderChatMessages();
    }

    function markActiveConversationSeen(items) {
        items.filter(item => Number(item.sender_id) !== chatState.currentUserId).forEach(item => sendChatReceipt(item, 'seen'));
    }

    function sendChatReceipt(message, status) {
        const messageId = message?.id || message?.message_id;
        if (!messageId || !chatState.socket || chatState.socket.readyState !== WebSocket.OPEN) return;
        const desired = status === 'seen' ? 2 : 1;
        const previous = chatState.receiptStates.get(String(messageId)) || 0;
        if (previous >= desired) return;
        try {
            chatState.socket.send(JSON.stringify({ type: 'receipt', message_id: messageId, status }));
            chatState.receiptStates.set(String(messageId), desired);
        } catch (_) {
            // A close event will reconnect the socket. Keep the message visible
            // even if this best-effort receipt cannot be sent immediately.
        }
    }

    function escapePortalHtml(value) { return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]); }

    function hasSectionPart(user, section, keyword) {
        if (section === 'dining-menu' && ['breakfast', 'lunch'].includes(String(keyword).toLowerCase())) {
            return hasSectionAccess(user, 'dining-menu');
        }
        const parts = user?.section_permissions?.[section];
        if (!Array.isArray(parts)) return false;
        return parts.some(part => String(part).toLowerCase().includes(keyword));
    }

    /**
     * Sets up logout button handler
     */
    function setupLogoutHandler() {
        if (elements.logoutBtn) {
            elements.logoutBtn.onclick = function(e) {
                e.preventDefault();
                handleLogout();
            };
        }
    }

    /**
     * Sets up dark mode toggle handler
     */
    function setupDarkModeHandler() {
        if (elements.darkModeBtn) {
            elements.darkModeBtn.onclick = function(e) {
                e.preventDefault();
                toggleDarkMode();
            };
        }
    }

    /**
     * Sets up platform access button handler (event delegation for dynamic content)
     */
    function setupPlatformAccessHandler() {
        document.addEventListener('click', function(e) {
            const button = e.target instanceof Element ? e.target.closest('.access-platform-btn') : null;
            if (!button) return;
            e.preventDefault();
            handlePlatformAccess(button);
        });
    }

    /**
     * Sets up user dropdown functionality
     */
    function setupUserDropdownHandler() {
        if (elements.userDropdownBtn && elements.userDropdown) {
            elements.userDropdownBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isOpen = elements.userDropdown.classList.toggle('show');
                elements.userDropdownBtn.setAttribute('aria-expanded', String(isOpen));
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!elements.userDropdown.contains(e.target)) {
                    elements.userDropdown.classList.remove('show');
                    elements.userDropdownBtn.setAttribute('aria-expanded', 'false');
                }
            });

            elements.userDropdown.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    elements.userDropdown.classList.remove('show');
                    elements.userDropdownBtn.setAttribute('aria-expanded', 'false');
                    elements.userDropdownBtn.focus();
                    return;
                }
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                const menuItems = Array.from(document.querySelectorAll('#user-dropdown-content button, #user-dropdown-content a'))
                    .filter(item => !item.disabled && item.offsetParent !== null);
                if (!menuItems.length) return;
                event.preventDefault();
                const currentIndex = menuItems.indexOf(document.activeElement);
                if (event.key === 'Home') return menuItems[0].focus();
                if (event.key === 'End') return menuItems.at(-1).focus();
                const nextIndex = event.key === 'ArrowDown'
                    ? (currentIndex + 1 + menuItems.length) % menuItems.length
                    : (currentIndex - 1 + menuItems.length) % menuItems.length;
                menuItems[nextIndex].focus();
            });

            elements.userDropdownBtn.addEventListener('keydown', event => {
                if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                elements.userDropdown.classList.add('show');
                elements.userDropdownBtn.setAttribute('aria-expanded', 'true');
                const menuItems = Array.from(document.querySelectorAll('#user-dropdown-content button, #user-dropdown-content a'))
                    .filter(item => !item.disabled && item.offsetParent !== null);
                const nextItem = event.key === 'ArrowDown' ? menuItems[0] : menuItems.at(-1);
                nextItem?.focus();
            });

            document.getElementById('profile-btn')?.addEventListener('click', () => {
                elements.userDropdown.classList.remove('show');
                elements.userDropdownBtn.setAttribute('aria-expanded', 'false');
            });
        }

        elements.superAdminEntry?.addEventListener('click', event => {
            if (elements.superAdminEntry.hidden) event.preventDefault();
        });
    }

    /**
     * Sets up language change event listener
     */
    function setupLanguageChangeHandler() {
        window.addEventListener('languageChanged', function() {
            console.log('Language change event detected in main.js');
            updateGreeting();
            const user = getUserFromStorage() || {};
            renderUserSidebar(user);
            // Refresh theme toggle label to reflect new language
            updateThemeLabels();

            if (hasSectionAccess(user, 'platforms')) loadPlatforms();
            if (hasSectionAccess(user, 'announcements')) loadAnnouncements();
            if (hasSectionAccess(user, 'dining-menu')) loadDiningMenu();
            loadArchive();
            console.log('Language change handling complete in main.js');
        });
    }

    /**
     * Sets up notification dropdown handler
     */
    function setupNotificationDropdownHandler() {
        console.log('Setting up notification dropdown handler');
        console.log('Notification button:', elements.notificationBtn);
        console.log('Notification dropdown:', elements.notificationDropdown);
        
        if (elements.notificationBtn && elements.notificationDropdown) {
            elements.notificationBtn.addEventListener('click', function(e) {
                console.log('Notification button clicked');
                e.stopPropagation();
                elements.notificationDropdown.classList.toggle('show');
                console.log('Dropdown show class:', elements.notificationDropdown.classList.contains('show'));
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!elements.notificationDropdown.contains(e.target) && !elements.notificationBtn.contains(e.target)) {
                    elements.notificationDropdown.classList.remove('show');
                }
            });
        } else {
            console.error('Notification elements not found');
        }
    }

    /**
     * Updates notification header text
     */
    function updateNotificationHeader() {
        const notifSection = document.getElementById('notification-section');
        if (notifSection) {
            const notifHeader = notifSection.querySelector('h2[data-translate="notifications"]');
            if (notifHeader) {
                console.log('Updating notification header text');
                notifHeader.textContent = getTranslation('notifications');
            }
        }
    }

    // =============================================================================
    // AUTHENTICATION & USER MANAGEMENT
    // =============================================================================

    /**
     * Handles user logout
     */
    async function handleLogout() {
        try {
            const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
            if (!response.ok) throw new Error('The server did not confirm logout.');
        } catch (error) {
            console.error('Could not finish the server session:', error);
            showNotification(portalT('auth.logoutFailed', 'Could not finish your session. Check your connection and try again.'), 'error');
            return;
        }
        const preserved = {};
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('tour_seen_') || key.startsWith('tour_completed_')) {
                preserved[key] = localStorage.getItem(key);
            }
        });
        localStorage.clear();
        Object.entries(preserved).forEach(([key, value]) => localStorage.setItem(key, value));
        sessionStorage.clear();
        window.location.replace('/login.html');
    }

    /**
     * Checks authentication status and updates UI accordingly
     */
    async function checkAuthStatus() {
        try {
            const response = await fetch('/auth/session', { credentials: 'same-origin' });
            if (!response.ok) {
                localStorage.removeItem('user');
                localStorage.removeItem('adminSession');
                window.location.replace('/login.html');
                return;
            }

            const data = await response.json();
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            } else {
                localStorage.removeItem('user');
            }

            const activeRole = String(data.user?.role || data.session?.user_role || '').toLowerCase();
            const canUseAdminEntry = ['admin', 'super_admin'].includes(activeRole);
            if (data.admin && canUseAdminEntry) {
                localStorage.setItem('adminSession', JSON.stringify(data.admin));
            } else {
                localStorage.removeItem('adminSession');
            }

            updateSuperAdminEntry(data);

            const user = data.user || getUserFromStorage();
            if (user) {
                showLoggedInState(user);
                if (hasSectionAccess(user, 'platforms')) loadPlatforms();
                if (hasSectionAccess(user, 'announcements')) loadAnnouncements();
                loadArchive();
            } else {
                showLoggedOutState();
                window.location.replace('/login.html');
            }
        } catch (_) {
            localStorage.removeItem('user');
            localStorage.removeItem('adminSession');
            window.location.replace('/login.html');
        }
    }

    /**
     * Shows the logged-in state
     * @param {Object} user - User object
     */
    function showLoggedInState(user) {
        // Role-based gating for students (platforms to be applied later)
        const userRole = (user && user.role) ? user.role : 'instructor';
        const isStudent = userRole === 'student';

        // Authentication completes asynchronously on a fresh page load. Keep
        // the chat client in sync with the authenticated account so messages
        // echoed over WebSocket are rendered in the active conversation even
        // when localStorage was empty before the auth check finished.
        chatState.currentUserId = Number(user?.id) || null;
        if (document.getElementById('chat-contacts-list')) {
            // setupCampusChat can run before /auth/session resolves. Refresh
            // the contacts and socket now that the authenticated id is known.
            loadChatContacts();
            connectChatSocket();
            startChatContactRefresh();
        }
        updatePortalProfilePresentation(user);
        
        elements.loginSection.classList.add('hidden');
        elements.sectionsContainer.classList.remove('hidden');
        renderUserSidebar(user);
        const route = getPortalRoute();
        showUserView(route.view, route.sectionKey);
        
        // Add student-view class for styling adjustments
        if (isStudent) {
            elements.sectionsContainer.classList.add('student-view');
        } else {
            elements.sectionsContainer.classList.remove('student-view');
        }
        
        if (elements.usernameElement) {
            elements.usernameElement.textContent = portalT('portal.welcomeUser', 'Welcome, {name}', { name: user.username || portalT('common.user', 'User') });
        }
        
        if (elements.logoutBtn) {
            elements.logoutBtn.classList.remove('hidden');
        }

        if (hasSectionAccess(user, 'announcements')) loadAnnouncements();
        if (hasSectionAccess(user, 'dining-menu')) loadDiningMenu();
        loadMostAccessedPlatforms();

        // Show platforms section for all roles (students will see filtered platforms)
        if (elements.platformsSection) {
            elements.platformsSection.classList.remove('hidden');
        }

        applySectionAccess(user);

    }

    /**
     * Shows the logged-out state
     */
    function showLoggedOutState() {
        chatState.currentUserId = null;
        chatState.contacts = [];
        chatState.activeContact = null;
        updateChatUnreadIndicator();
        if (chatState.socket) {
            try { chatState.socket.close(); } catch (_) { }
            chatState.socket = null;
        }
        if (chatState.contactsRefreshTimer) {
            window.clearInterval(chatState.contactsRefreshTimer);
            chatState.contactsRefreshTimer = null;
        }
        elements.loginSection.classList.remove('hidden');
        elements.sectionsContainer.classList.add('hidden');
        
        if (elements.logoutBtn) {
            elements.logoutBtn.classList.add('hidden');
        }
        
        if (elements.usernameElement) {
            elements.usernameElement.textContent = '';
        }
        if (elements.headerProfileName) elements.headerProfileName.textContent = portalT('common.account', 'Account');
        if (elements.headerProfileAvatar) elements.headerProfileAvatar.src = '/img/fiu9-mark2.png';
        updateSuperAdminEntry(null);
    }

    function updateSuperAdminEntry(sessionData) {
        const entry = elements.superAdminEntry;
        if (!entry) return;
        const role = String(sessionData?.user?.role || sessionData?.session?.user_role || '')
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_');
        const isSuperAdmin = Boolean(sessionData?.session?.is_super_admin) || role === 'super_admin' || role === 'superadmin';
        entry.hidden = !isSuperAdmin;
        entry.setAttribute('aria-hidden', String(!isSuperAdmin));
        entry.tabIndex = isSuperAdmin ? 0 : -1;
    }

    /**
     * Updates the greeting message
     */
    function updateGreeting() {
        const user = getUserFromStorage();
        if (elements.usernameElement && user) {
            elements.usernameElement.textContent = portalT('portal.welcomeUser', 'Welcome, {name}', { name: user.username || portalT('common.user', 'User') });
        }
    }

    /**
     * Gets user from localStorage
     * @returns {Object|null} User object or null
     */
    function getUserFromStorage() {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch (_) {
            return null;
        }
    }

    function hasSectionAccess(user, section) {
        const allowed = Array.isArray(user?.allowed_sections)
            ? user.allowed_sections
            : ['platforms', 'announcements', 'dining-menu'];
        return allowed.some(item => String(item).toLowerCase() === String(section).toLowerCase());
    }

    function applySectionAccess(user) {
        const allowed = Array.isArray(user.allowed_sections)
            ? user.allowed_sections.map(section => String(section).toLowerCase())
            : ['platforms', 'announcements', 'dining-menu'];
        const route = getPortalRoute();
        const routeKey = route.view === 'section' ? route.sectionKey : route.view;
        const sectionMap = {
            'platforms': elements.platformsSection,
            'announcements': elements.announcementsSection,
            'dining-menu': elements.diningMenuSection,
            'notifications': elements.notificationsSection
        };
        Object.entries(sectionMap).forEach(([key, element]) => {
            if (!element) return;
            const isCurrentRoute = key === 'platforms'
                ? routeKey === 'dashboard' || routeKey === 'platforms'
                : routeKey === key;
            element.classList.toggle('hidden', !allowed.includes(key) || !isCurrentRoute);
        });
        const platformsPanel = document.querySelector('.platforms-panel');
        if (platformsPanel) {
            const isCurrentPlatformsView = routeKey === 'dashboard' || routeKey === 'platforms';
            platformsPanel.classList.toggle('hidden', !allowed.includes('platforms') || !isCurrentPlatformsView);
        }
        document.querySelectorAll('[data-dashboard-section]').forEach(control => {
            control.hidden = !allowed.includes(control.dataset.dashboardSection);
        });
        renderDashboardFocusCards();
        if (elements.notificationBtn) {
            elements.notificationBtn.classList.toggle('hidden', !allowed.includes('notifications'));
        }
        if (elements.diningMenuImportActions) {
            const canImportDining = allowed.includes('dining-menu') && hasSectionPart(user, 'dining-menu', 'import');
            elements.diningMenuImportActions.classList.toggle('hidden', !canImportDining);
        }
    }

    function trackActivity(action, detail) {
        fetch(`${API_BASE_URL}?endpoint=activity-track&action=${encodeURIComponent(action)}&detail=${encodeURIComponent(detail || '')}`)
            .catch(() => {});
    }

    // =============================================================================
    // PLATFORM ACCESS HANDLERS
    // =============================================================================

    /**
     * Handles platform access button clicks
     * @param {HTMLElement} button - Platform action button
     */
    function handlePlatformAccess(button) {
        const platform = button.dataset.platform;
        const user = getUserFromStorage();
        
        if (!user || !user.username) {
            showNotification(portalT('auth.loginRequiredDescription', 'Please log in first.'), 'warning');
            return;
        }

        trackActivity('platform_open', platform);
        setButtonLoadingState(button, portalT('common.opening', 'Opening…'));

        const platformHandlers = {
            'SIS': () => handleSISAccess(button),
            'LMS': () => handleLMSAccess(button)
        };

        const handler = platformHandlers[platform];
        if (handler) {
            handler();
        } else {
            console.warn('Unknown platform:', platform);
            resetButtonState(button);
        }
    }

    /**
     * Sets button to loading state
     * @param {HTMLElement} button - Button element
     * @param {string} text - Loading text
     */
    function setButtonLoadingState(button, text) {
        button.disabled = true;
        button.textContent = text;
    }

    /**
     * Resets button to normal state
     * @param {HTMLElement} button - Button element
     */
    function resetButtonState(button) {
        button.disabled = false;
        button.textContent = getTranslation('access-platform');
    }

    /**
     * Handles SIS platform access - direct access only
     * @param {HTMLElement} button - The clicked button
     */
    function handleSISAccess(button) {
        // Direct access to SIS without authentication
        window.open(SIS_URL, '_blank');
        resetButtonState(button);
    }



    /**
     * Handles LMS platform access
     * @param {HTMLElement} button - The clicked button
     */
    function handleLMSAccess(button) {
        setButtonLoadingState(button, portalT('common.loading', 'Loading…'));
        
        fetch(`${API_BASE_URL}?endpoint=lms_subplatforms`)
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.subplatforms)) {
                    showLmsModal(data.subplatforms);
                } else {
                    showNotification(portalT('platforms.lmsLoadFailed', 'Failed to load LMS sub-platforms.'), 'error');
                }
            })
            .catch(error => {
                console.error('Error loading LMS sub-platforms:', error);
                showNotification(portalT('platforms.lmsLoadFailed', 'Failed to load LMS sub-platforms.'), 'error');
            })
            .finally(() => {
                resetButtonState(button);
            });
    }

    /**
     * Shows LMS modal with sub-platforms
     * @param {Array} subplatforms - Array of sub-platform objects
     */
    function showLmsModal(subplatforms) {
        const modal = document.getElementById('lms-modal');
        const list = document.getElementById('lms-subplatforms-list');
        
        if (!modal || !list) return;
        
        list.innerHTML = '';

        [...subplatforms]
            .sort((left, right) => {
                const numberDiff = getLmsNumberFromUrl(left.url) - getLmsNumberFromUrl(right.url);
                return numberDiff !== 0 ? numberDiff : String(left.name || '').localeCompare(String(right.name || ''));
            })
            .forEach(sp => {
            const div = document.createElement('div');
            div.className = 'lms-subplatform-card';
            const lmsNumber = getLmsNumberFromUrl(sp.url);
            const lmsName = Number.isFinite(lmsNumber) ? `LMS${lmsNumber}` : getLmsNameFromUrl(sp.url);
            const cleanBaseUrl = sanitizePlatformUrl(sp.url);
            const cleanLoginPath = sanitizeLmsPath(sp.loginEndpoint || sp.login_endpoint || '/LMS/login/index.php');
            const cleanNotifPath = sanitizeLmsPath(sp.notificationsEndpoint || sp.notifications_endpoint || '');
            div.innerHTML = `
                <span><strong>${lmsName}</strong> - ${sp.name}</span> 
                <button class='btn btn-primary lms-access-btn' 
                        data-url='${cleanBaseUrl}' 
                        data-login='${cleanLoginPath}' 
                        data-notif='${cleanNotifPath}'>
                    ${getTranslation('access-platform')}
                </button>
            `;
            list.appendChild(div);
        });
        
        // Show modal as flex for overlay centering
        modal.style.display = 'flex';
        
        // Setup close button
        setupModalCloseButton(modal);
        
        // Setup access buttons
        setupLmsAccessButtons(list);
    }

    function getLmsNameFromUrl(url) {
        try {
            return new URL(url).hostname.split('.')[0].toUpperCase();
        } catch (_) {
            return 'LMS';
        }
    }

    function getLmsNumberFromUrl(url) {
        try {
            const host = new URL(url).hostname.split('.')[0].toLowerCase();
            if (host.startsWith('lms')) {
                const number = Number.parseInt(host.slice(3), 10);
                return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
            }
        } catch (_) {
        }

        return Number.MAX_SAFE_INTEGER;
    }

    function sanitizePlatformUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return '';

        try {
            const parsed = new URL(raw);
            parsed.pathname = parsed.pathname.replace(/\/undefined(?=\/|$)/gi, '/').replace(/\/+$/g, '/');
            return parsed.toString();
        } catch (_) {
            return raw.replace(/\/undefined(?=\/|$)/gi, '').replace(/\/+$/g, '');
        }
    }

    // RMS and Leave use a same-origin FIU route first. The server checks the
    // current FIU session and then redirects only to each platform's
    // allowlisted Google/OIDC entry point; platform URLs from the catalogue
    // are never trusted for these two SSO-enabled services.
    function getPlatformSsoLaunchUrl(platform) {
        const name = String(platform?.name || platform || '').trim().toLowerCase();
        if (name === 'rms' || name.includes('residency management')) return '/sso/rms';
        if (name === 'leave' || name.includes('leave and absence') || name.includes('leave & absence')) return '/sso/leave';
        return '';
    }

    function sanitizeLmsPath(path) {
        const raw = String(path || '').trim();
        if (!raw) return '';

        const cleaned = raw
            .replace(/undefined/gi, '')
            .replace(/\/{2,}/g, '/')
            .replace(/\/+$/g, '');

        return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    }

    /**
     * Sets up modal close button
     * @param {HTMLElement} modal - Modal element
     */
    function setupModalCloseButton(modal) {
        const closeBtn = document.getElementById('close-lms-modal');
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
    }

    /**
     * Sets up LMS access buttons
     * @param {HTMLElement} list - List container
     */
    function setupLmsAccessButtons(list) {
        list.querySelectorAll('.lms-access-btn').forEach(btn => {
            btn.onclick = function() {
                // Open the subplatform's real login page directly
                const baseUrl = this.dataset.url || '';
                const loginPath = sanitizeLmsPath(this.dataset.login || '/LMS/login/index.php');
                try {
                    const absoluteUrl = new URL(loginPath, baseUrl).toString();
                    if (absoluteUrl) {
                        window.open(absoluteUrl, '_blank');
                    } else {
                        showNotification(portalT('platforms.loginUrlUnavailable', 'Login URL not available for this sub-platform.'), 'warning');
                    }
                } catch (e) {
                    console.error('Failed to build sub-platform URL', e);
                    showNotification(portalT('platforms.invalidUrl', 'Invalid sub-platform URL.'), 'error');
                }
            };
        });
    }

    /**
     * Handles LMS sub-platform authentication and notification fetching
     * @param {string} url - Base URL of the sub-platform
     * @param {string} loginEndpoint - Login endpoint path
     * @param {string} notifEndpoint - Notifications endpoint path
     * @param {HTMLElement} btn - The clicked button
     */
    function handleLmsSubplatformAccess(url, loginEndpoint, notifEndpoint, btn) {
        const user = getUserFromStorage();
        
        if (!user || !user.username) {
            showNotification(portalT('auth.loginRequiredDescription', 'Please log in first.'), 'warning');
            return;
        }
        
        setButtonLoadingState(btn, portalT('common.opening', 'Opening…'));
        
        const subplatformCard = btn.closest('.lms-subplatform-card');
        const subplatformName = subplatformCard ? subplatformCard.querySelector('span').textContent : 'Unknown';
        
        // Use server-side direct link for LMS (similar to RMS)
        const directLinkUrl = `${API_BASE_URL}?endpoint=lms_subplatform_direct_link&username=${encodeURIComponent(user.username)}&subplatform=${encodeURIComponent(subplatformName)}`;
        
        fetch(directLinkUrl)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.url) {
                    window.open(data.url, '_blank');
                } else {
                    showNotification(`${portalT('platforms.lmsAccessFailed', 'Failed to access LMS')}: ${portalApiText(data, portalT('common.unknownError', 'Unknown error'))}`, 'error');
                }
            })
            .catch(error => {
                console.error('Error accessing LMS:', error);
                showNotification(portalT('platforms.lmsAccessRetry', 'Failed to access LMS. Please try again.'), 'error');
            });
        
        // Reset button state
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = getTranslation('access-platform');
        }, 1000);
    }

    // =============================================================================
    // PLATFORM MANAGEMENT
    // =============================================================================

    /**
     * Loads platforms from the PHP API
     */
    function loadPlatforms() {
        const user = getUserFromStorage();
        if (user && !hasSectionAccess(user, 'platforms')) return;
        if (!elements.platformsContainer) {
            console.error('Platforms container not found');
            return;
        }

        elements.platformsContainer.innerHTML = '';

        fetch(`${API_BASE_URL}?endpoint=platforms`)
            .then(response => {
                if (!response.ok) throw new Error(portalT('validation.unableToLoad', 'Failed to fetch platforms', { resource: portalT('navigation.platforms', 'platforms') }));
                return response.json();
            })
            .then(data => {
                console.log('Platforms data received:', data);
                if (data.success && data.platforms && data.platforms.length > 0) {
                    const filteredPlatforms = data.platforms.filter(platform => isPlatformVisibleToRole(platform, user?.role));
                    console.log('Creating platform cards for role-visible platforms:', filteredPlatforms.length);
                    platformCatalog = filteredPlatforms;
                    if (filteredPlatforms.length > 0) {
                        renderPlatformSections(filteredPlatforms);
                        renderMostAccessedPlatforms();
                    } else {
                        elements.platformsContainer.innerHTML = `<p>${portalT('platforms.unavailable', 'No platforms available for your role.')}</p>`;
                        renderMostAccessedPlatforms();
                    }
                } else {
                    platformCatalog = [];
                    elements.platformsContainer.innerHTML = `<p>${portalT('platforms.none', 'No platforms found.')}</p>`;
                    renderMostAccessedPlatforms();
                }
            })
            .catch(error => {
                console.error('Error loading platforms:', error);
                platformCatalog = [];
                elements.platformsContainer.innerHTML = `<p>${portalT('announcements.error', 'Error loading platforms.')}</p>`;
                renderMostAccessedPlatforms();
            });
    }

    function normalizePlatformRole(role) {
        return String(role || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    function isPlatformVisibleToRole(platform, role) {
        const normalizedRole = normalizePlatformRole(role);
        const configuredRoles = platform?.visible_to_roles ?? platform?.visibleToRoles ?? platform?.VisibleToRoles;
        return Boolean(normalizedRole && Array.isArray(configuredRoles) && configuredRoles.some(visibleRole => normalizePlatformRole(visibleRole) === normalizedRole));
    }

    async function loadMostAccessedPlatforms() {
        if (mostAccessedLoadState === 'loading') return;
        mostAccessedLoadState = 'loading';
        renderMostAccessedPlatforms();
        try {
            const response = await fetch(`${API_BASE_URL}?endpoint=most-accessed-platforms`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || data.success === false) throw new Error(portalApiText(data, portalT('platforms.unavailable', 'Unable to load frequently used platforms')));
            mostAccessedPlatforms = getMostAccessedPlatformItems(data);
            mostAccessedLoadState = mostAccessedPlatforms.length ? 'ready' : 'empty';
        } catch (error) {
            console.warn('Unable to load most accessed platforms:', error);
            mostAccessedPlatforms = [];
            mostAccessedLoadState = 'error';
        }
        renderMostAccessedPlatforms();
    }

    function getMostAccessedPlatformItems(data) {
        const payload = data?.data && typeof data.data === 'object' ? data.data : data || {};
        const items = payload.platforms || payload.most_accessed_platforms || payload.most_accessed || payload.mostAccessedPlatforms || payload.items || payload.results || [];
        if (!Array.isArray(items)) return [];
        return items.map(item => {
            if (typeof item === 'string') return { name: item };
            if (!item || typeof item !== 'object') return null;
            return item;
        }).filter(Boolean).slice(0, 6);
    }

    function resolveMostAccessedPlatform(item) {
        const itemId = String(item?.platform_id || item?.id || '');
        const itemName = String(item?.platform_name || item?.name || item?.platform || '').trim();
        const catalogItem = platformCatalog.find(platform =>
            (itemId && String(platform.id || '') === itemId) ||
            (itemName && String(platform.name || '').localeCompare(itemName, undefined, { sensitivity: 'accent' }) === 0)
        ) || {};
        return {
            ...catalogItem,
            ...item,
            name: itemName || catalogItem.name || 'Campus service',
            url: item?.url || catalogItem.url || '',
            image_url: item?.image_url || item?.imageUrl || catalogItem.image_url || catalogItem.imageUrl || '',
            count: Number(item?.access_count ?? item?.count ?? item?.opens ?? 0) || 0
        };
    }

    function renderMostAccessedPlatforms() {
        const section = document.getElementById('most-accessed-platforms-section');
        const list = document.getElementById('most-accessed-platforms-list');
        const copy = document.getElementById('most-accessed-platforms-copy');
        if (!section || !list || !copy) return;
        const user = getUserFromStorage() || {};
        if (!hasSectionAccess(user, 'platforms')) {
            section.classList.add('hidden');
            return;
        }
        section.classList.remove('hidden');
        list.replaceChildren();
        const visiblePlatforms = mostAccessedPlatforms
            .map(resolveMostAccessedPlatform)
            .filter(platform => isPlatformVisibleToRole(platform, user.role));

        if (mostAccessedLoadState === 'loading') {
            copy.textContent = portalT('platforms.loadingCopy', 'Loading the campus services you use most.');
            appendMostAccessedEmptyState(list, portalT('platforms.loading', 'Loading your most accessed platforms…'));
            return;
        }

        if (mostAccessedLoadState === 'error') {
            copy.textContent = portalT('platforms.shortcutsUnavailable', 'Your personal shortcuts are temporarily unavailable.');
            appendMostAccessedEmptyState(list, portalT('platforms.openFromList', 'Open a platform from the service list and it will appear here when activity data is available.'));
            return;
        }

        if (mostAccessedLoadState === 'empty' || !visiblePlatforms.length) {
            copy.textContent = portalT('platforms.mostAccessedEmpty', 'Your most frequently opened campus services will appear here.');
            appendMostAccessedEmptyState(list, portalT('platforms.noShortcuts', 'No personal shortcuts yet — open a platform to start building your list.'));
            return;
        }

        copy.textContent = portalT('platforms.quickReturn', 'Quickly return to the campus services you use most.');
        visiblePlatforms.forEach(platform => {
            const url = getPlatformSsoLaunchUrl(platform) || sanitizePlatformUrl(platform.url);
            const card = document.createElement(url ? 'a' : 'div');
            card.className = 'most-accessed-platform';
            if (url) {
                card.href = url;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                card.addEventListener('click', () => trackActivity('platform_open', platform.name));
            } else {
                card.setAttribute('aria-disabled', 'true');
                card.title = portalT('platforms.notAvailable', 'This platform is not currently available.');
            }
            const image = document.createElement('img');
            image.src = getPlatformImageUrl(platform);
            image.alt = '';
            image.addEventListener('error', () => { image.src = '/img/fiu9-mark2.png'; });
            const text = document.createElement('span');
            const name = document.createElement('strong');
            name.textContent = platform.name;
            const detail = document.createElement('small');
            detail.textContent = platform.count ? portalT('portal.visit', '{count} visits', { count: platform.count }) : portalT('portal.quickAccess', 'Quick access');
            text.append(name, detail);
            card.append(image, text);
            list.appendChild(card);
        });
    }

    function renderDashboardFocusCards() {
        const menuSummary = elements.dashboardMenuSummary;
        const announcementsSummary = elements.dashboardAnnouncementsSummary;
        const grid = elements.dashboardFocusGrid;
        if (!grid || !menuSummary || !announcementsSummary) return;

        const user = getUserFromStorage() || {};
        const menuAllowed = hasSectionAccess(user, 'dining-menu');
        const announcementsAllowed = hasSectionAccess(user, 'announcements');
        const route = getPortalRoute();
        const isPlatformsRoute = route.view === 'section' && route.sectionKey === 'platforms';
        const menuCard = document.getElementById('dashboard-menu-card');
        const announcementsCard = document.getElementById('dashboard-announcements-card');
        if (menuCard) menuCard.hidden = isPlatformsRoute || !menuAllowed;
        if (announcementsCard) announcementsCard.hidden = isPlatformsRoute || !announcementsAllowed;
        grid.hidden = isPlatformsRoute || (!menuAllowed && !announcementsAllowed);
        if (isPlatformsRoute) return;

        if (menuAllowed) {
            const today = new Date();
            const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todayMenu = diningCalendarState.menus.get(todayKey);
            if (!todayMenu) {
                menuSummary.innerHTML = `<p class="dashboard-focus-empty">${portalT('dining.noMenuToday', 'No menu has been added for today.')}</p>`;
            } else {
                const dateLabel = portalFormatDate(today, { weekday: 'long', month: 'long', day: 'numeric' });
                const breakfast = todayMenu.breakfast_menu || portalT('dining.noBreakfast', 'Not listed');
                const lunch = todayMenu.lunch_menu || portalT('dining.noLunch', 'Not listed');
                menuSummary.innerHTML = `<strong>${escapePortalHtml(dateLabel)}</strong><div class="dashboard-focus-meals"><span><small>${portalT('dining.breakfast', 'Breakfast')}</small>${escapePortalHtml(breakfast)}</span><span><small>${portalT('dining.lunch', 'Lunch')}</small>${escapePortalHtml(lunch)}</span></div>`;
            }
        }

        if (announcementsAllowed) {
            const announcements = Array.isArray(announcementsState.slides) ? announcementsState.slides : [];
            if (!announcements.length) {
                announcementsSummary.innerHTML = `<p class="dashboard-focus-empty">${portalT('announcements.noNew', 'No new announcements right now.')}</p>`;
            } else {
                const visible = announcements.slice(0, 2);
                announcementsSummary.innerHTML = `<div class="dashboard-focus-announcement-list">${visible.map(item => {
                    const title = escapePortalHtml(item.title || 'Campus announcement');
                    const rawContent = String(item.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    const excerpt = escapePortalHtml(rawContent.slice(0, 96) + (rawContent.length > 96 ? '…' : ''));
                    const priority = String(item.priority || 'medium').toLowerCase();
                    const isImportant = priority === 'high' || priority === 'urgent';
                    const priorityLabel = getAnnouncementPriorityLabel(priority);
                    return `<div class="dashboard-focus-announcement${isImportant ? ' is-important' : ''}" data-priority="${priority}">${isImportant ? `<span class="announcement-priority-tag"><i class="fas fa-bolt" aria-hidden="true"></i>${priorityLabel}</span>` : ''}<strong>${title}</strong>${excerpt ? `<small>${excerpt}</small>` : ''}</div>`;
                }).join('')}</div>${announcements.length > 2 ? `<small class="dashboard-focus-count">${announcements.length} announcements available</small>` : ''}`;
            }
        }
    }

    function appendMostAccessedEmptyState(container, message) {
        const empty = document.createElement('p');
        empty.className = 'most-accessed-empty-state';
        empty.textContent = message;
        container.appendChild(empty);
    }

    function renderPlatformSections(platforms) {
        const groups = platforms.reduce((acc, platform) => {
            const section = platform.section || 'Campus';
            if (!acc[section]) acc[section] = [];
            acc[section].push(platform);
            return acc;
        }, {});

        Object.entries(groups).forEach(([section, items]) => {
            const group = document.createElement('section');
            group.className = 'platform-section-group';
            group.setAttribute('aria-labelledby', `platform-group-${section.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'campus'}`);

            const heading = document.createElement('div');
            heading.className = 'platform-section-heading';
            const headingIcon = document.createElement('span');
            headingIcon.className = 'platform-section-icon';
            headingIcon.setAttribute('aria-hidden', 'true');
            headingIcon.innerHTML = `<i class="fas ${getPlatformSectionIcon(section)}"></i>`;
            const headingCopy = document.createElement('div');
            headingCopy.className = 'platform-section-copy';
            const kicker = document.createElement('span');
            kicker.className = 'platform-section-kicker';
            kicker.textContent = 'Service collection';
            const title = document.createElement('h3');
            title.className = 'platform-section-title';
            title.id = group.getAttribute('aria-labelledby');
            title.textContent = section;
            headingCopy.append(kicker, title);
            const count = document.createElement('span');
            count.className = 'platform-section-count';
            count.textContent = `${items.length} ${items.length === 1 ? 'service' : 'services'}`;
            heading.append(headingIcon, headingCopy, count);

            const grid = document.createElement('div');
            grid.className = 'platform-section-grid';
            const sortedItems = items
                .slice()
                .sort((left, right) => {
                    if (section.toLowerCase() === 'lms') {
                        return getLmsNumberFromUrl(left.url) - getLmsNumberFromUrl(right.url);
                    }

                    return String(left.name || '').localeCompare(String(right.name || ''));
                });
            // Keep every service visible in the dashboard. The portal already
            // scopes the returned catalogue by the user's role/access policy;
            // pagination here only hid otherwise available platforms.
            const pageSize = Math.max(sortedItems.length, 1);
            const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
            let currentPage = 1;
            const pagination = document.createElement('nav');
            pagination.className = 'platform-pagination';
            pagination.setAttribute('aria-label', `${section} platform pages`);
            pagination.innerHTML = `<button type="button" class="btn btn-secondary platform-page-prev">${portalT('common.previous', 'Previous')}</button><span class="platform-page-status" aria-live="polite"></span><button type="button" class="btn btn-secondary platform-page-next">${portalT('common.next', 'Next')}</button>`;

            const renderPage = () => {
                grid.innerHTML = '';
                sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .forEach(platform => createPlatformCard(platform, grid));
                if (totalPages > 1) {
                    pagination.hidden = false;
                    pagination.querySelector('.platform-page-status').textContent = portalT('pagination.pageOf', 'Page {page} of {total}', { page: currentPage, total: totalPages });
                    pagination.querySelector('.platform-page-prev').disabled = currentPage === 1;
                    pagination.querySelector('.platform-page-next').disabled = currentPage === totalPages;
                } else {
                    pagination.hidden = true;
                }
            };

            pagination.querySelector('.platform-page-prev').addEventListener('click', () => {
                if (currentPage > 1) { currentPage -= 1; renderPage(); }
            });
            pagination.querySelector('.platform-page-next').addEventListener('click', () => {
                if (currentPage < totalPages) { currentPage += 1; renderPage(); }
            });
            group.append(heading, grid, pagination);
            renderPage();
            elements.platformsContainer.appendChild(group);
        });
    }

    function getPlatformSectionIcon(section) {
        const normalized = String(section || '').toLowerCase();
        if (normalized.includes('learning') || normalized.includes('lms')) return 'fa-graduation-cap';
        if (normalized.includes('support')) return 'fa-headset';
        if (normalized.includes('academic')) return 'fa-book-open';
        return 'fa-building-columns';
    }

    function getPlatformIcon(platformName) {
        const name = String(platformName || '').toLowerCase();
        if (name.includes('accommodation') || name.includes('booking')) return 'fa-bed';
        if (name.includes('document')) return 'fa-file-lines';
        if (name.includes('exam')) return 'fa-clipboard-check';
        if (name.includes('leave') || name.includes('absence')) return 'fa-calendar-check';
        if (name.includes('support')) return 'fa-headset';
        if (name.includes('summer')) return 'fa-sun';
        if (name.includes('lms') || name.includes('learning')) return 'fa-graduation-cap';
        if (name.includes('sis') || name.includes('ais') || name.includes('academic')) return 'fa-book-open';
        return 'fa-arrow-up-right-from-square';
    }

    /**
     * Creates a platform card element
     * @param {Object} platform - Platform data
     * @param {HTMLElement} container - Container to append the card to
     */
    function createPlatformCard(platform, container) {
        const platformCard = document.createElement('article');
        platformCard.className = 'platform-card';
        const { platformUrl, buttonClass } = getPlatformButtonConfig(platform);

        const header = document.createElement('div');
        header.className = 'platform-card-header';
        const image = document.createElement('img');
        image.className = 'platform-card-image';
        image.src = getPlatformImageUrl(platform);
        image.alt = `${platform.name || 'Campus service'} logo`;
        image.addEventListener('error', () => {
            if (!image.src.endsWith('/img/fiu9-mark2.png')) image.src = '/img/fiu9-mark2.png';
        });
        const title = document.createElement('h3');
        title.textContent = platform.name || 'Campus service';
        header.append(image, title);

        const body = document.createElement('div');
        body.className = 'platform-card-body';
        const description = document.createElement('p');
        description.textContent = platform.description || 'Open this campus service.';
        body.appendChild(description);

        const footer = document.createElement('div');
        footer.className = 'platform-card-footer';
        const accessLink = document.createElement('a');
        accessLink.href = platformUrl;
        accessLink.className = buttonClass;
        accessLink.target = '_blank';
        accessLink.rel = 'noopener noreferrer';
        accessLink.dataset.platform = platform.name || '';
        accessLink.dataset.translate = 'access-platform';
        const accessIcon = document.createElement('i');
        accessIcon.className = 'fas fa-arrow-up-right-from-square';
        accessIcon.setAttribute('aria-hidden', 'true');
        accessLink.append(accessIcon, document.createTextNode(getTranslation('access-platform')));
        footer.appendChild(accessLink);
        platformCard.append(header, body, footer);

        if (accessLink && !accessLink.classList.contains('access-platform-btn')) {
            accessLink.addEventListener('click', () => trackActivity('platform_open', platform.name));
        }
        
        container.appendChild(platformCard);
    }

    function getPlatformImageUrl(platform) {
        const imageUrl = String(platform?.image_url || platform?.imageUrl || '').trim();
        return imageUrl || '/img/fiu9-mark2.png';
    }

    /**
     * Gets platform button configuration
     * @param {Object} platform - Platform object
     * @returns {Object} Button configuration
     */
    function getPlatformButtonConfig(platform) {
        const specialPlatforms = ['SIS', 'AIS', 'LMS', 'LMS0', 'Document Application System', 'Summer School Application', 'Accommodation Booking Portal', 'Support Center', 'Student Exam Registration', 'Exemption exam form', 'Resit Exams Application'];
        const isSpecialPlatform = specialPlatforms.includes(platform.name);
        const ssoLaunchUrl = getPlatformSsoLaunchUrl(platform);
        if (ssoLaunchUrl) {
            return {
                platformUrl: ssoLaunchUrl,
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F510}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: SIS should be a direct link
        // SIS uses its fixed URL; AIS must use its own URL from DB (or fallback)
        if (platform.name === 'SIS') {
            return {
                platformUrl: SIS_URL,
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        if (platform.name === 'AIS') {
            const aisUrl = platform.url || 'https://ais.final.edu.tr/';
            return {
                platformUrl: aisUrl,
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: LMS should open sub-platform modal (both roles)
        if (platform.name === 'LMS') {
            return {
                platformUrl: '#',
                buttonClass: 'btn btn-primary access-platform-btn',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: LMS0 should be a direct link
        if (platform.name === 'LMS0') {
            return {
                platformUrl: 'https://lms0.final.edu.tr/',
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: Document Application System should be direct access to login
        if (platform.name === 'Document Application System') {
            return {
                platformUrl: 'https://docs.final.edu.tr/pages/login',
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: Summer School Application should be direct access
        if (platform.name === 'Summer School Application') {
            return {
                platformUrl: 'https://online.final.edu.tr/yazokulu/login.php',
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
        // Special case: Accommodation Booking Portal should be direct access
        if (platform.name === 'Accommodation Booking Portal') {
            return {
                platformUrl: 'https://dorms.final.edu.tr/',
                buttonClass: 'btn btn-primary',
                buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
            };
        }
                    // Special case: Support Center should be direct access to login
            if (platform.name === 'Support Center') {
                return {
                    platformUrl: 'https://destek.final.edu.tr/index.php',
                    buttonClass: 'btn btn-primary',
                    buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
                };
            }
            // Special case: Student Exam Registration should be direct access
            if (platform.name === 'Student Exam Registration') {
                return {
                    platformUrl: 'https://online.final.edu.tr/exam/',
                    buttonClass: 'btn btn-primary',
                    buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
                };
            }
            // Special case: Exemption exam form should be direct access
            if (platform.name === 'Exemption exam form') {
                return {
                    platformUrl: 'https://online.final.edu.tr/muafiyet',
                    buttonClass: 'btn btn-primary',
                    buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
                };
            }
            // Special case: Resit Exams Application should be direct access
            if (platform.name === 'Resit Exams Application') {
                return {
                    platformUrl: 'https://online.final.edu.tr/resit/login.php',
                    buttonClass: 'btn btn-primary',
                    buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
                };
            }
        return {
            platformUrl: isSpecialPlatform ? '#' : sanitizePlatformUrl(platform.url),
            buttonClass: isSpecialPlatform ? 'btn btn-primary access-platform-btn' : 'btn btn-primary',
            buttonText: `<span style="margin-right:6px;">\u{1F517}</span>${getTranslation('access-platform')}`
        };
    }

    // =============================================================================
    // ANNOUNCEMENTS MANAGEMENT
    // =============================================================================

    /**
     * Loads announcements from the PHP API
     */
    function getAnnouncementPriorityRank(priority) {
        return { urgent: 4, high: 3, medium: 2, low: 1 }[String(priority || 'medium').toLowerCase()] || 2;
    }

    function getAnnouncementPriorityLabel(priority) {
        const normalized = String(priority || 'medium').toLowerCase();
        return normalized === 'urgent' ? 'Urgent' : normalized === 'high' ? 'High priority' : normalized === 'low' ? 'Low priority' : 'Priority';
    }

    function loadAnnouncements() {
        const user = getUserFromStorage();
        if (user && !hasSectionAccess(user, 'announcements')) return;
        if (!elements.announcementsList) {
            console.error('Announcements list not found');
            return;
        }

        setupAnnouncementControls();
        elements.announcementsList.replaceChildren();

        fetch(`${API_BASE_URL}?endpoint=announcements`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch announcements');
                return response.json();
            })
            .then(data => {
                console.log('Announcements data received:', data);
                if (data.success && data.announcements && data.announcements.length > 0) {
                    // Filter announcements by target audience based on user role
                    const user = getUserFromStorage();
                    const role = (user && user.role) ? String(user.role).toLowerCase().trim() : 'instructor';
                    const filtered = data.announcements.filter(a => {
                        const target = (a.target_audience || 'all').toLowerCase();
                        if (target === 'all') return true;
                        if (target === 'students') return role === 'student';
                        if (target === 'instructors') return role !== 'student';
                        return true;
                    }).sort((left, right) => {
                        const priorityDifference = getAnnouncementPriorityRank(right.priority) - getAnnouncementPriorityRank(left.priority);
                        if (priorityDifference !== 0) return priorityDifference;
                        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
                    });

                    announcementsState.slides = filtered;
                    announcementsState.totalSlides = filtered.length;
                    announcementsState.currentPage = 1;
                    renderAnnouncementFeed();
                    renderDashboardFocusCards();
                } else {
                    announcementsState.slides = [];
                    announcementsState.totalSlides = 0;
                    announcementsState.currentPage = 1;
                    renderAnnouncementFeed();
                    renderDashboardFocusCards();
                }
            })
            .catch(error => {
                console.error('Error loading announcements:', error);
                elements.announcementsList.innerHTML = `<p class="announcements-empty">${portalT('announcements.error', 'Error loading announcements.')}</p>`;
                announcementsState.slides = [];
                announcementsState.totalSlides = 0;
                announcementsState.currentPage = 1;
                renderAnnouncementFeed(portalT('announcements.error', 'Error loading announcements.'));
                renderDashboardFocusCards();
            });
    }

    function setupAnnouncementControls() {
        const search = document.getElementById('announcements-search');
        const previous = document.getElementById('announcements-page-prev');
        const next = document.getElementById('announcements-page-next');
        if (search && search.dataset.bound !== 'true') {
            search.dataset.bound = 'true';
            search.addEventListener('input', () => {
                announcementsState.searchQuery = search.value;
                announcementsState.currentPage = 1;
                renderAnnouncementFeed();
            });
        }
        if (previous && previous.dataset.bound !== 'true') {
            previous.dataset.bound = 'true';
            previous.addEventListener('click', () => {
                if (announcementsState.currentPage <= 1) return;
                announcementsState.currentPage -= 1;
                renderAnnouncementFeed();
            });
        }
        if (next && next.dataset.bound !== 'true') {
            next.dataset.bound = 'true';
            next.addEventListener('click', () => {
                const pageCount = Math.ceil(getMatchingAnnouncements().length / announcementsState.pageSize);
                if (announcementsState.currentPage >= pageCount) return;
                announcementsState.currentPage += 1;
                renderAnnouncementFeed();
            });
        }
        if (search) search.value = announcementsState.searchQuery;
    }

    function normalizeAnnouncementSearch(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    }

    function getMatchingAnnouncements() {
        const terms = normalizeAnnouncementSearch(announcementsState.searchQuery).split(/\s+/).filter(Boolean);
        if (!terms.length) return announcementsState.slides;
        return announcementsState.slides.filter(announcement => {
            const createdAt = announcement.created_at || '';
            const date = new Date(createdAt);
            const searchableText = normalizeAnnouncementSearch([
                announcement.title,
                announcement.content,
                announcement.author_name,
                announcement.priority,
                announcement.target_audience,
                createdAt,
                Number.isNaN(date.getTime()) ? '' : portalFormatDate(date)
            ].join(' '));
            return terms.every(term => searchableText.includes(term));
        });
    }

    function renderAnnouncementFeed(emptyStateMessage = '') {
        const list = elements.announcementsList;
        if (!list) return;
        const matches = getMatchingAnnouncements();
        const pageCount = Math.max(1, Math.ceil(matches.length / announcementsState.pageSize));
        announcementsState.currentPage = Math.min(Math.max(1, announcementsState.currentPage), pageCount);
        const startIndex = (announcementsState.currentPage - 1) * announcementsState.pageSize;
        const pageItems = matches.slice(startIndex, startIndex + announcementsState.pageSize);
        list.replaceChildren();

        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'announcements-empty';
            empty.textContent = emptyStateMessage || (announcementsState.searchQuery.trim()
                ? portalT('archive.noAnnouncementsFiltered', 'No announcements match this search.')
                : portalT('announcements.empty', 'No announcements found.'));
            list.appendChild(empty);
        } else {
            pageItems.forEach(announcement => createAnnouncementCard(announcement, list));
        }

        const results = document.getElementById('announcements-results');
        if (results) {
            results.hidden = !matches.length;
            results.textContent = portalT('pagination.showing', 'Showing {visible} of {total}', {
                visible: pageItems.length,
                total: matches.length
            });
        }

        const pagination = document.getElementById('announcements-pagination');
        const status = document.getElementById('announcements-page-status');
        const previous = document.getElementById('announcements-page-prev');
        const next = document.getElementById('announcements-page-next');
        if (pagination) pagination.hidden = pageCount <= 1;
        if (status) status.textContent = portalT('pagination.pageOf', 'Page {page} of {total}', {
            page: announcementsState.currentPage,
            total: pageCount
        });
        if (previous) previous.disabled = announcementsState.currentPage <= 1;
        if (next) next.disabled = announcementsState.currentPage >= pageCount;
    }

    function loadArchive() {
        if (!elements.archiveContainer) return;
        fetch(`${API_BASE_URL}?endpoint=archive`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    elements.archiveContainer.innerHTML = `<p>${portalT('archive.unavailable', 'Archive is not available.')}</p>`;
                    return;
                }

                const announcements = data.archive.announcements || [];
                const diningMenus = data.archive.dining_menus || [];
                elements.archiveContainer.innerHTML = `
                    <div class="archive-block">
                        <h3>${portalT('announcements.title', 'Announcements')}</h3>
                        ${announcements.length ? announcements.map(item => `
                            <button class="archive-row" type="button" data-archive-announcement="${item.id}">
                                <strong>${item.title}</strong>
                                <span>${portalFormatDate(item.created_at)}</span>
                            </button>
                        `).join('') : `<p>${portalT('archive.noAnnouncements', 'No archived announcements yet.')}</p>`}
                    </div>
                    <div class="archive-block">
                        <h3>${portalT('dining.title', 'Dining Menu')}</h3>
                        ${diningMenus.length ? diningMenus.map(item => `
                            <div class="archive-row">
                                <strong>${portalFormatDate(item.date)}</strong>
                                <span>${item.breakfast_menu || portalT('dining.noBreakfast', 'No breakfast')} / ${item.lunch_menu || portalT('dining.noLunch', 'No lunch')}</span>
                            </div>
                    `).join('') : `<p>${portalT('archive.noDining', 'No archived dining menus yet.')}</p>`}
                    </div>
                `;

                elements.archiveContainer.querySelectorAll('[data-archive-announcement]').forEach(button => {
                    button.addEventListener('click', () => {
                        const item = announcements.find(entry => String(entry.id) === button.dataset.archiveAnnouncement);
                        if (item) showAnnouncementModal(item);
                    });
                });
            })
            .catch(() => {
                elements.archiveContainer.innerHTML = `<p>${portalT('validation.unableToLoad', 'Error loading archive.', { resource: portalT('archive.title', 'archive') })}</p>`;
            });
    }

    /**
     * Creates an announcement card element
     * @param {Object} announcement - Announcement data
     * @param {HTMLElement} container - Container to append the card to
     */
    function createAnnouncementCard(announcement, container) {
        const listItem = document.createElement('article');
        listItem.className = 'announcements-list-entry';
        listItem.setAttribute('role', 'listitem');

        const announcementCard = document.createElement('button');
        announcementCard.type = 'button';
        const priority = String(announcement.priority || 'medium').toLowerCase();
        const isImportant = priority === 'high' || priority === 'urgent';
        announcementCard.className = `announcement-card announcement-list-item${isImportant ? ' is-important' : ''}`;
        announcementCard.dataset.priority = priority;

        const date = new Date(announcement.created_at);
        const formattedDate = Number.isNaN(date.getTime()) ? '' : portalFormatDate(date, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) + ' · ' + portalFormatDateTime(date, { hour: '2-digit', minute: '2-digit' });

        if (isImportant) {
            const badge = document.createElement('span');
            badge.className = 'announcement-priority-tag';
            const icon = document.createElement('i');
            icon.className = 'fas fa-bolt';
            icon.setAttribute('aria-hidden', 'true');
            badge.append(icon, document.createTextNode(getAnnouncementPriorityLabel(priority)));
            announcementCard.appendChild(badge);
        }

        const title = document.createElement('h3');
        title.textContent = announcement.title || portalT('announcements.title', 'Campus announcement');
        announcementCard.appendChild(title);

        const rawContent = String(announcement.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (rawContent) {
            const excerpt = document.createElement('p');
            excerpt.className = 'announcement-excerpt';
            excerpt.textContent = rawContent;
            announcementCard.appendChild(excerpt);
        }

        if (formattedDate) {
            const time = document.createElement('time');
            time.className = 'announcement-date';
            time.dateTime = date.toISOString();
            time.textContent = formattedDate;
            announcementCard.appendChild(time);
        }

        const openLabel = document.createElement('span');
        openLabel.className = 'announcement-open-label';
        openLabel.textContent = portalT('announcements.read', 'Read announcement');
        const arrow = document.createElement('i');
        arrow.className = 'fas fa-arrow-right';
        arrow.setAttribute('aria-hidden', 'true');
        openLabel.appendChild(arrow);
        announcementCard.appendChild(openLabel);

        announcementCard.addEventListener('click', () => {
            showAnnouncementModal(announcement);
        });

        listItem.appendChild(announcementCard);
        container.appendChild(listItem);
    }

    /**
     * Shows announcement modal with full details
     * @param {Object} announcement - Announcement data
     */
    function showAnnouncementModal(announcement) {
        // Create modal HTML
        const modalHTML = `
            <div id="announcement-modal" class="modal" style="display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
                <div class="modal-content" style="background:#fff; border-radius:8px; max-width:600px; width:90%; max-height:80vh; margin:40px auto; padding:32px; position:relative; display:flex; flex-direction:column;">
                    <button id="close-announcement-modal" style="position:absolute; top:12px; right:16px; font-size:24px; background:none; border:none; cursor:pointer;">&times;</button>
                    <h2 style="margin-bottom:16px; flex-shrink:0;">${announcement.title}</h2>
                    <div style="flex:1; overflow-y:auto; padding-right:8px;">
                        <div style="font-size:12px; color:#888; margin-bottom:16px; font-style:italic;">
                            ${portalFormatDateTime(announcement.created_at, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </div>
                        <div style="line-height:1.6; margin-bottom:16px;">
                            ${announcement.content}
                        </div>
                        <div style="font-size:12px; color:#666; font-weight:500;">
                            ${portalT('announcements.by', 'By: {name}', { name: announcement.created_by || portalT('common.admin', 'Administrator') })}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup close button
        const closeBtn = document.getElementById('close-announcement-modal');
        const modal = document.getElementById('announcement-modal');
        
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.remove();
            };
        }
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // =============================================================================
    // DINING MENU MANAGEMENT
    // =============================================================================

    /**
     * Loads dining menu from the PHP API
     */
    function loadDiningMenu() {
        const user = getUserFromStorage() || {};
        if (!hasSectionAccess(user, 'dining-menu')) return;
        if (!elements.diningCalendarGrid) {
            console.error('Dining menu calendar not found');
            return;
        }
        const { year, month } = diningCalendarState;
        elements.diningCalendarGrid.innerHTML = `<div class="chat-empty-state" style="grid-column:1/-1;padding:20px;text-align:center;">${portalT('common.loading', 'Loading…')}</div>`;
        fetch(`${API_BASE_URL}?endpoint=dining-menu-month&year=${year}&month=${month}`, { credentials: 'same-origin' })
            .then(response => response.json().then(data => ({ response, data })))
            .then(({ response, data }) => {
                if (!response.ok || !data.success) throw new Error(portalApiText(data, portalT('validation.unableToLoad', 'Unable to load dining menu', { resource: portalT('dining.title', 'dining menu') })));
                diningCalendarState.menus = new Map((data.dining_menus || []).map(menu => [menu.date, menu]));
                renderDiningCalendar();
                renderDashboardFocusCards();
            })
            .catch(error => {
                elements.diningCalendarGrid.innerHTML = `<div class="chat-empty-state" style="grid-column:1/-1;padding:20px;text-align:center;">${escapePortalHtml(error.message || portalT('validation.unableToLoad', 'Unable to load dining menu', { resource: portalT('dining.title', 'dining menu') }))}</div>`;
                diningCalendarState.menus = new Map();
                renderDashboardFocusCards();
            });
    }

    function renderDiningCalendar() {
        const { year, month, menus } = diningCalendarState;
        if (elements.diningCalendarMonth) {
            elements.diningCalendarMonth.textContent = portalFormatDate(new Date(year, month - 1, 1), { month: 'long', year: 'numeric' });
        }
        if (!elements.diningCalendarGrid) return;
        elements.diningCalendarGrid.innerHTML = '';
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let i = 0; i < firstDay; i++) {
            const blank = document.createElement('div');
            blank.className = 'dining-calendar-day is-empty';
            blank.setAttribute('aria-hidden', 'true');
            elements.diningCalendarGrid.appendChild(blank);
        }
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const menu = menus.get(dateKey);
            const cell = document.createElement(menu ? 'button' : 'div');
            cell.className = `dining-calendar-day${today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day ? ' is-today' : ''}`;
            cell.innerHTML = `<strong>${day}</strong>`;
            if (menu) {
                const showBreakfast = hasSectionPart(getUserFromStorage() || {}, 'dining-menu', 'breakfast');
                const showLunch = hasSectionPart(getUserFromStorage() || {}, 'dining-menu', 'lunch');
                if (showBreakfast && menu.breakfast_menu) cell.insertAdjacentHTML('beforeend', `<small title="${portalT('dining.breakfast', 'Breakfast')}">☀ ${escapePortalHtml(menu.breakfast_menu)}</small>`);
                if (showLunch && menu.lunch_menu) cell.insertAdjacentHTML('beforeend', `<small title="${portalT('dining.lunch', 'Lunch')}">🍴 ${escapePortalHtml(menu.lunch_menu)}</small>`);
                cell.setAttribute('type', 'button');
                cell.setAttribute('aria-label', portalT('dining.menuFor', 'Dining menu for {date}', { date: dateKey }));
                cell.addEventListener('click', () => showDiningMenuModal(menu));
            } else {
                cell.insertAdjacentHTML('beforeend', `<span class="calendar-no-menu">${portalT('dining.noMenu', 'No menu')}</span>`);
            }
            elements.diningCalendarGrid.appendChild(cell);
        }
    }

    function setupDiningCalendar() {
        elements.diningCalendarPrev?.addEventListener('click', () => {
            diningCalendarState.month -= 1;
            if (diningCalendarState.month < 1) { diningCalendarState.month = 12; diningCalendarState.year -= 1; }
            loadDiningMenu();
        });
        elements.diningCalendarNext?.addEventListener('click', () => {
            diningCalendarState.month += 1;
            if (diningCalendarState.month > 12) { diningCalendarState.month = 1; diningCalendarState.year += 1; }
            loadDiningMenu();
        });
    }

    /**
     * Creates a dining menu card element
     * @param {Object} diningMenu - Dining menu data
     * @param {HTMLElement} container - Container to append the card to
     */
    function createDiningMenuCard(diningMenu, container) {
        const diningMenuCard = document.createElement('div');
        diningMenuCard.className = 'dining-menu-card';
        
        // Format the date with day name
        const date = new Date(diningMenu.date);
        const formattedDate = portalFormatDate(date, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Format times to show only hours and minutes
        const formatTime = (timeString) => {
            if (!timeString || timeString === 'N/A') return 'N/A';
            return timeString.substring(0, 5); // Take only HH:MM part
        };

        const user = getUserFromStorage() || {};
        const showBreakfast = hasSectionPart(user, 'dining-menu', 'breakfast');
        const showLunch = hasSectionPart(user, 'dining-menu', 'lunch');
        diningMenuCard.innerHTML = `
            <h3>${formattedDate}</h3>
            ${showBreakfast ? `<div class="meal-section">
                <h4><i class="fas fa-sun" style="color: #c0392b; margin-right: 8px;"></i>${portalT('dining.breakfast', 'Breakfast')}</h4>
                <p>${diningMenu.breakfast_menu || portalT('dining.noBreakfast', 'No breakfast menu available')}</p>
                <small>${portalT('dining.time', 'Time')}: ${formatTime(diningMenu.breakfast_start_time)} - ${formatTime(diningMenu.breakfast_end_time)}</small>
            </div>` : ''}
            ${showLunch ? `<div class="meal-section">
                <h4><i class="fas fa-utensils" style="color: #c0392b; margin-right: 8px;"></i>${portalT('dining.lunch', 'Lunch')}</h4>
                <p>${diningMenu.lunch_menu || portalT('dining.noLunch', 'No lunch menu available')}</p>
                <small>${portalT('dining.time', 'Time')}: ${formatTime(diningMenu.lunch_start_time)} - ${formatTime(diningMenu.lunch_end_time)}</small>
            </div>` : ''}
        `;
        
        // Add click event to show full dining menu details
        diningMenuCard.addEventListener('click', () => {
            showDiningMenuModal(diningMenu);
        });
        
        container.appendChild(diningMenuCard);
    }

    /**
     * Shows dining menu modal with full details
     * @param {Object} diningMenu - Dining menu data
     */
    function showDiningMenuModal(diningMenu) {
        const user = getUserFromStorage() || {};
        const showBreakfast = hasSectionPart(user, 'dining-menu', 'breakfast');
        const showLunch = hasSectionPart(user, 'dining-menu', 'lunch');
        const diningPermissions = user.section_permissions?.['dining-menu'];
        const canRemoveDining = Array.isArray(diningPermissions) && diningPermissions.some(part => String(part).toLowerCase() === 'remove');
        // Create modal HTML
        const modalHTML = `
            <div id="dining-menu-modal" class="modal" style="display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
                <div class="modal-content" style="background:#fff; border-radius:8px; max-width:600px; width:90%; max-height:80vh; margin:40px auto; padding:32px; position:relative; display:flex; flex-direction:column;">
                    <button id="close-dining-menu-modal" style="position:absolute; top:12px; right:16px; font-size:24px; background:none; border:none; cursor:pointer;">&times;</button>
                    <h2 style="margin-bottom:16px; flex-shrink:0;">${portalT('dining.menuFor', 'Dining Menu - {date}', { date: portalFormatDate(diningMenu.date, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) })}</h2>
                                         <div style="flex:1; overflow-y:auto; padding-right:8px;">
                         ${showBreakfast ? `<div class="meal-section" style="margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #eee;">
                             <h3 style="color:#c0392b; margin-bottom:12px; font-size:18px;"><i class="fas fa-sun" style="color: #c0392b; margin-right: 8px;"></i>${portalT('dining.breakfast', 'Breakfast')}</h3>
                             <p style="line-height:1.6; margin-bottom:8px;">${diningMenu.breakfast_menu || portalT('dining.noBreakfast', 'No breakfast menu available')}</p>
                             <small style="color:#888; font-style:italic;">${portalT('dining.time', 'Time')}: ${diningMenu.breakfast_start_time ? diningMenu.breakfast_start_time.substring(0, 5) : 'N/A'} - ${diningMenu.breakfast_end_time ? diningMenu.breakfast_end_time.substring(0, 5) : 'N/A'}</small>
                         </div>` : ''}
                         ${showLunch ? `<div class="meal-section">
                             <h3 style="color:#c0392b; margin-bottom:12px; font-size:18px;"><i class="fas fa-utensils" style="color: #c0392b; margin-right: 8px;"></i>${portalT('dining.lunch', 'Lunch')}</h3>
                             <p style="line-height:1.6; margin-bottom:8px;">${diningMenu.lunch_menu || portalT('dining.noLunch', 'No lunch menu available')}</p>
                             <small style="color:#888; font-style:italic;">${portalT('dining.time', 'Time')}: ${diningMenu.lunch_start_time ? diningMenu.lunch_start_time.substring(0, 5) : 'N/A'} - ${diningMenu.lunch_end_time ? diningMenu.lunch_end_time.substring(0, 5) : 'N/A'}</small>
                         </div>` : ''}
                     </div>
                    ${canRemoveDining ? `<button id="remove-dining-menu" type="button" class="btn btn-danger" style="align-self:flex-start; margin-top:16px;"><i class="fas fa-trash" aria-hidden="true"></i> ${portalT('common.remove', 'Remove')} ${portalT('dining.title', 'menu')}</button>` : ''}
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup close button
        const closeBtn = document.getElementById('close-dining-menu-modal');
        const modal = document.getElementById('dining-menu-modal');
        
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.remove();
            };
        }

        const removeBtn = document.getElementById('remove-dining-menu');
        if (removeBtn) {
            removeBtn.onclick = async function() {
                if (!window.confirm(portalT('dining.removeConfirm', 'Remove this dining menu?'))) return;
                removeBtn.disabled = true;
                try {
                    const response = await fetch(`${API_BASE_URL}?endpoint=dining-menu-delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ id: diningMenu.id })
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(portalApiText(data, portalT('validation.unableToDelete', 'Unable to remove dining menu', { resource: portalT('dining.title', 'dining menu') })));
                    modal.remove();
                    showNotification(portalT('dining.removed', 'Dining menu removed.'), 'success');
                    loadDiningMenu();
                } catch (error) {
                    removeBtn.disabled = false;
                    showNotification(error.message || portalT('validation.unableToDelete', 'Unable to remove dining menu.', { resource: portalT('dining.title', 'dining menu') }), 'error');
                }
            };
        }
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // =============================================================================
    // NOTIFICATION MANAGEMENT
    // =============================================================================

    /**
     * Loads notifications from backend and renders them
     */
    function loadNotifications() {
        if (!elements.notificationList) {
            console.error('Notification list container not found');
            return;
        }

        elements.notificationList.innerHTML = `<p class="no-notifications">${getTranslation('notifications-loading')}</p>`;
        
        const user = getUserFromStorage();
        if (!user || !user.username) {
            elements.notificationList.innerHTML = `<p class="no-notifications">${getTranslation('notifications-none')}</p>`;
            updateNotificationBadge(0);
            return;
        }

        // Fetch and display all notifications
        fetchAllNotifications(user.username)
            .then(allNotifications => {
                handleFetchedNotifications(allNotifications, []);
            })
            .catch((err) => {
                console.error('Error fetching notifications:', err);
                elements.notificationList.innerHTML = `<p class="no-notifications">${getTranslation('notifications-error')}</p>`;
                updateNotificationBadge(0);
            });
    }



    /**
     * Handles fetched notifications
     * @param {Array} allNotifications - All fetched notifications
     * @param {Array} storedNotifications - Previously stored notifications (unused)
     */
    function handleFetchedNotifications(allNotifications, storedNotifications) {
        if (allNotifications.length === 0) {
            elements.notificationList.innerHTML = `<p class="no-notifications">${getTranslation('notifications-none')}</p>`;
            updateNotificationBadge(0);
            return;
        }
        
        // Replace loading message with all notifications
        elements.notificationList.innerHTML = '';
        allNotifications.forEach(notification => {
            createNotificationItem(notification, elements.notificationList);
        });
        
        // Update notification badge
        updateNotificationBadge(allNotifications.length);
    }

    /**
     * Fetches all notifications from the API
     * @param {string} username - Username to fetch notifications for
     * @returns {Promise<Array>} Promise resolving to array of notifications
     */
    function fetchAllNotifications(username) {
        return fetch(`${API_BASE_URL}?endpoint=notifications&username=${encodeURIComponent(username)}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.notifications)) {
                    return data.notifications;
                }
                return [];
            })
            .catch(error => {
                console.error('Error fetching notifications:', error);
                return [];
            });
    }

    /**
     * Creates a notification card element
     * @param {Object} notification - Notification data
     * @param {HTMLElement} container - Container to append the card to
     */
    function createNotificationCard(notification, container) {
        const notifDiv = document.createElement('div');
        notifDiv.className = 'notification-card';
        
        const notificationUrl = getNotificationUrl(notification);
        const dateDisplay = getNotificationDateDisplay(notification);
        
        const cardHTML = `
            <h3>${notification.platform}</h3>
            ${dateDisplay}
            <p>${notification.message}</p>
            <a href="${notificationUrl}" 
               target="_blank" 
               class="btn btn-primary" 
               data-translate="open">
                ${getTranslation('Open')}
            </a>
        `;
        
        notifDiv.innerHTML = cardHTML;
        container.appendChild(notifDiv);
    }

    /**
     * Creates a notification item for the dropdown
     * @param {Object} notification - Notification data
     * @param {HTMLElement} container - Container to append the item to
     */
    function createNotificationItem(notification, container) {
        const notifDiv = document.createElement('div');
        notifDiv.className = 'notification-item';
        
        const notificationUrl = getNotificationUrl(notification);
        const dateDisplay = getNotificationDateDisplay(notification);
        
        const itemHTML = `
            <div class="notification-title">${notification.platform}</div>
            <div class="notification-content">${notification.message}</div>
            ${dateDisplay ? `<div class="notification-time">${notification.date}</div>` : ''}
            <a href="${notificationUrl}" target="_blank" class="btn btn-primary" style="margin-top: 8px; font-size: 12px; padding: 4px 8px;">
                ${getTranslation('Open')}
            </a>
        `;
        
        notifDiv.innerHTML = itemHTML;
        container.appendChild(notifDiv);
    }

    /**
     * Updates the notification badge count
     * @param {number} count - Number of notifications
     */
    function updateNotificationBadge(count) {
        if (elements.notificationBadge) {
            if (count > 0) {
                elements.notificationBadge.textContent = count > 99 ? '99+' : count.toString();
                elements.notificationBadge.style.display = 'block';
            } else {
                elements.notificationBadge.style.display = 'none';
            }
        }
    }

    /**
     * Gets notification URL based on platform
     * @param {Object} notification - Notification object
     * @returns {string} Notification URL
     */
    function getNotificationUrl(notification) {
        let notificationUrl = notification.url;
        const user = getUserFromStorage();
        
        if (notification.platform === 'RMS' || notification.platform === 'Leave and Absence') {
            const configuredPlatform = platformCatalog.find(platform => String(platform.name || '').toLowerCase() === String(notification.platform || '').toLowerCase());
            notificationUrl = getPlatformSsoLaunchUrl(configuredPlatform || notification.platform) || notificationUrl || configuredPlatform?.notifications_url || configuredPlatform?.url || '#';
        } else if (notification.platform === 'LMS' && user && user.username) {
            // Use server-side direct link for LMS notifications
            const subplatformName = notification.subplatform || 'Unknown';
            notificationUrl = `${API_BASE_URL}?endpoint=lms_subplatform_direct_link&username=${encodeURIComponent(user.username)}&subplatform=${encodeURIComponent(subplatformName)}`;
        }
        
        return notificationUrl;
    }

    /**
     * Gets notification date display HTML
     * @param {Object} notification - Notification object
     * @returns {string} Date display HTML
     */
    function getNotificationDateDisplay(notification) {
        if (notification.date) {
            return `<small style="color: #888; display: block; margin-bottom: 10px;">${notification.date}</small>`;
        }
        return '';
    }

    // =============================================================================
    // TRANSLATION & INTERNATIONALIZATION
    // =============================================================================

    /**
     * Gets the current language setting
     * @returns {string} Current language code
     */
    function getCurrentLanguage() {
        return localStorage.getItem('language') || 'en';
    }

    /**
     * Gets translation for a given key
     * @param {string} key - Translation key
     * @returns {string} Translated text or key if translation not found
     */
    function getTranslation(key) {
        const currentLang = getCurrentLanguage();
        
        if (window.translations && window.translations[currentLang]) {
            const translation = window.translations[currentLang][key];
            
            if (translation) {
                return translation;
            } else {
                console.log('No translation found for key:', key, 'in language:', currentLang);
                return key;
            }
        } else {
            console.log('No translations available for language:', currentLang);
            return key;
        }
    }

    // =============================================================================
    // THEME MANAGEMENT
    // =============================================================================

    /**
     * Initializes theme based on saved preference
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme === 'dark') {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
        // Ensure labels reflect current language and correct target mode
        updateThemeLabels();
    }

    /**
     * Enables dark mode
     */
    function enableDarkMode() {
        document.body.classList.add('dark-mode');
        updateThemeLabels();
    }

    /**
     * Disables dark mode
     */
    function disableDarkMode() {
        document.body.classList.remove('dark-mode');
        updateThemeLabels();
    }

    /**
     * Toggles dark mode
     */
    function toggleDarkMode() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        
        if (isDarkMode) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
        updateThemeLabels();
    }

    /**
     * Updates theme labels to reflect current theme and translations
     * Button should show the target mode (opposite of current)
     */
    function updateThemeLabels() {
        const isDark = document.body.classList.contains('dark-mode');
        const targetKey = isDark ? 'light-mode' : 'dark-mode';
        const targetText = getTranslation(targetKey) || (isDark ? 'Light Mode' : 'Dark Mode');
        if (elements.currentThemeText) {
            elements.currentThemeText.textContent = targetText;
            elements.currentThemeText.setAttribute('data-translate', targetKey);
        }
    }

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Proxy AJAX/API requests to LMS subplatforms via backend to avoid CORS
     * @param {string} subplatformName - The name of the LMS subplatform
     * @param {string} username - The current user's username
     * @param {string} apiPath - The API path on the LMS server (relative)
     * @param {Object} [options] - fetch options (method, headers, body, etc.)
     * @returns {Promise<Response>}
     */
    function proxyLmsAjax(subplatformName, username, apiPath, options = {}) {
        const url = `${API_BASE_URL}?endpoint=lms_ajax_proxy&subplatform=${encodeURIComponent(subplatformName)}&username=${encodeURIComponent(username)}&apipath=${encodeURIComponent(apiPath)}`;
        return fetch(url, options);
    }

    // Example usage:
    // proxyLmsAjax('Üniversite Ortak/University Common', 'student1', 'webservice/rest/server.php?wsfunction=core_user_get_users_by_field&field=username&values[0]=student1')
    //     .then(response => response.json())
    //     .then(data => console.log('LMS API data:', data));
    
    // Make loadNotifications available globally for tour system
    window.loadNotifications = loadNotifications;

    // =============================================================================
    // DINING MENU SLIDER FUNCTIONS
    // =============================================================================

    /**
     * Sets up dining menu slider functionality
     */
    function setupDiningMenuSlider() {
        if (elements.diningPrevBtn) {
            elements.diningPrevBtn.addEventListener('click', () => {
                navigateDiningMenu('prev');
            });
        }

        if (elements.diningNextBtn) {
            elements.diningNextBtn.addEventListener('click', () => {
                navigateDiningMenu('next');
            });
        }

        // Touch events for swipe
        if (elements.diningMenuSlider) {
            elements.diningMenuSlider.addEventListener('touchstart', handleTouchStart);
            elements.diningMenuSlider.addEventListener('touchend', handleTouchEnd);
        }
    }

    /**
     * Handles touch start event
     */
    function handleTouchStart(e) {
        diningMenuState.touchStartX = e.changedTouches[0].screenX;
    }

    /**
     * Handles touch end event
     */
    function handleTouchEnd(e) {
        diningMenuState.touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }

    /**
     * Handles swipe gesture
     */
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = diningMenuState.touchStartX - diningMenuState.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next slide
                navigateDiningMenu('next');
            } else {
                // Swipe right - previous slide
                navigateDiningMenu('prev');
            }
        }
    }

    /**
     * Navigates to previous or next dining menu slide
     */
    function navigateDiningMenu(direction) {
        if (diningMenuState.totalSlides === 0) return;

        if (direction === 'prev' && diningMenuState.currentSlide > 0) {
            diningMenuState.currentSlide--;
        } else if (direction === 'next' && diningMenuState.currentSlide < diningMenuState.totalSlides - 1) {
            diningMenuState.currentSlide++;
        }

        updateDiningMenuSlider();
        updateDiningMenuNavigation();
        updateDiningMenuDots();
    }

    /**
     * Updates the dining menu slider position
     */
    function updateDiningMenuSlider() {
        if (elements.diningMenuSlider) {
            const translateX = -diningMenuState.currentSlide * 100;
            elements.diningMenuSlider.style.transform = `translateX(${translateX}%)`;
        }
    }

    /**
     * Updates dining menu navigation buttons
     */
    function updateDiningMenuNavigation() {
        if (elements.diningPrevBtn) {
            elements.diningPrevBtn.style.display = diningMenuState.currentSlide > 0 ? 'flex' : 'none';
            elements.diningPrevBtn.disabled = diningMenuState.currentSlide === 0;
        }

        if (elements.diningNextBtn) {
            elements.diningNextBtn.style.display = diningMenuState.currentSlide < diningMenuState.totalSlides - 1 ? 'flex' : 'none';
            elements.diningNextBtn.disabled = diningMenuState.currentSlide === diningMenuState.totalSlides - 1;
        }
    }

    /**
     * Creates navigation dots for dining menu
     */
    function createDiningMenuDots() {
        if (!elements.diningMenuDots) return;

        elements.diningMenuDots.innerHTML = '';
        
        for (let i = 0; i < diningMenuState.totalSlides; i++) {
            const dot = document.createElement('div');
            dot.className = 'dining-menu-dot';
            if (i === 0) dot.classList.add('active');
            
            dot.addEventListener('click', () => {
                diningMenuState.currentSlide = i;
                updateDiningMenuSlider();
                updateDiningMenuNavigation();
                updateDiningMenuDots();
            });
            
            elements.diningMenuDots.appendChild(dot);
        }
    }

    /**
     * Updates dining menu dots
     */
    function updateDiningMenuDots() {
        const dots = elements.diningMenuDots?.querySelectorAll('.dining-menu-dot');
        if (!dots) return;

        dots.forEach((dot, index) => {
            if (index === diningMenuState.currentSlide) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

});
