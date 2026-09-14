/*
 * Admin-only bridge for the portal language runtime.
 *
 * The public portal's language module owns the selected-language preference.
 * This bridge adds admin shell strings, applies semantic data-i18n attributes,
 * and keeps the document language/direction in sync without requiring a sign-in
 * or page reload.
 */
(function () {
    'use strict';

    const supportedLanguages = ['en', 'tr', 'fr', 'ru', 'ar'];
    const localeByLanguage = {
        en: 'en-US',
        tr: 'tr-TR',
        fr: 'fr-FR',
        ru: 'ru-RU',
        ar: 'ar'
    };

    const translations = {
        en: {
            'admin.documentTitle': 'FIU Global Portal — Administration',
            'admin.panel': 'Admin Panel',
            'admin.nav.dashboard': 'Dashboard',
            'admin.nav.adminManagement': 'Admin Management',
            'admin.nav.users': 'Users',
            'admin.nav.platforms': 'Manage Platforms',
            'admin.nav.faculties': 'Faculties & Departments',
            'admin.nav.announcements': 'Announcements',
            'admin.nav.diningMenu': 'Dining Menu',
            'admin.nav.holidays': 'Holidays & Days Off',
            'admin.nav.roleAccess': 'Role Access',
            'admin.nav.createUser': 'Create User',
            'admin.nav.systemHealth': 'System Health',
            'admin.shell.commandCenter': 'Command Center',
            'admin.shell.liveOperations': 'Live campus operations dashboard',
            'admin.shell.language': 'Language',
            'admin.shell.dark': 'Dark',
            'admin.shell.light': 'Light',
            'admin.shell.logout': 'Logout',
            'admin.shell.toggleSidebar': 'Toggle sidebar',
            'admin.dashboard.totalUsers': 'Total Users',
            'admin.dashboard.registeredUsers': 'Registered users',
            'admin.dashboard.activeAdmins': 'Active Admins',
            'admin.dashboard.administrators': 'Administrators',
            'admin.dashboard.platforms': 'Platforms',
            'admin.dashboard.connectedPlatforms': 'Connected platforms',
            'admin.adminManagement': 'Admin Management',
            'admin.addAdmin': 'Add Admin',
            'admin.table.id': 'ID',
            'admin.table.username': 'Username',
            'admin.table.email': 'Email',
            'admin.table.role': 'Role',
            'admin.table.presence': 'Presence',
            'admin.table.created': 'Created',
            'admin.table.actions': 'Actions'
        },
        tr: {
            'admin.documentTitle': 'FIU Global Portal — Yönetim',
            'admin.panel': 'Yönetim Paneli',
            'admin.nav.dashboard': 'Gösterge Paneli',
            'admin.nav.adminManagement': 'Yönetici Yönetimi',
            'admin.nav.users': 'Kullanıcılar',
            'admin.nav.platforms': 'Platformları Yönet',
            'admin.nav.faculties': 'Fakülteler ve Bölümler',
            'admin.nav.announcements': 'Duyurular',
            'admin.nav.diningMenu': 'Yemek Menüsü',
            'admin.nav.holidays': 'Tatiller ve İzin Günleri',
            'admin.nav.roleAccess': 'Rol Erişimi',
            'admin.nav.createUser': 'Kullanıcı Oluştur',
            'admin.nav.systemHealth': 'Sistem Sağlığı',
            'admin.shell.commandCenter': 'Yönetim Merkezi',
            'admin.shell.liveOperations': 'Canlı kampüs operasyonları panosu',
            'admin.shell.language': 'Dil',
            'admin.shell.dark': 'Koyu',
            'admin.shell.light': 'Açık',
            'admin.shell.logout': 'Çıkış Yap',
            'admin.shell.toggleSidebar': 'Kenar çubuğunu aç/kapat',
            'admin.dashboard.totalUsers': 'Toplam Kullanıcı',
            'admin.dashboard.registeredUsers': 'Kayıtlı kullanıcı',
            'admin.dashboard.activeAdmins': 'Etkin Yöneticiler',
            'admin.dashboard.administrators': 'Yöneticiler',
            'admin.dashboard.platforms': 'Platformlar',
            'admin.dashboard.connectedPlatforms': 'Bağlı platformlar',
            'admin.adminManagement': 'Yönetici Yönetimi',
            'admin.addAdmin': 'Yönetici Ekle',
            'admin.table.id': 'Kimlik',
            'admin.table.username': 'Kullanıcı adı',
            'admin.table.email': 'E-posta',
            'admin.table.role': 'Rol',
            'admin.table.presence': 'Çevrimiçi durumu',
            'admin.table.created': 'Oluşturulma',
            'admin.table.actions': 'İşlemler'
        },
        fr: {
            'admin.documentTitle': 'FIU Global Portal — Administration',
            'admin.panel': 'Panneau d’administration',
            'admin.nav.dashboard': 'Tableau de bord',
            'admin.nav.adminManagement': 'Gestion des administrateurs',
            'admin.nav.users': 'Utilisateurs',
            'admin.nav.platforms': 'Gérer les plateformes',
            'admin.nav.faculties': 'Facultés et départements',
            'admin.nav.announcements': 'Annonces',
            'admin.nav.diningMenu': 'Menu de restauration',
            'admin.nav.holidays': 'Jours fériés et congés',
            'admin.nav.roleAccess': 'Accès par rôle',
            'admin.nav.createUser': 'Créer un utilisateur',
            'admin.nav.systemHealth': 'État du système',
            'admin.shell.commandCenter': 'Centre de commande',
            'admin.shell.liveOperations': 'Tableau de bord des opérations du campus',
            'admin.shell.language': 'Langue',
            'admin.shell.dark': 'Sombre',
            'admin.shell.light': 'Clair',
            'admin.shell.logout': 'Se déconnecter',
            'admin.shell.toggleSidebar': 'Afficher ou masquer la barre latérale',
            'admin.dashboard.totalUsers': 'Utilisateurs au total',
            'admin.dashboard.registeredUsers': 'Utilisateurs inscrits',
            'admin.dashboard.activeAdmins': 'Administrateurs actifs',
            'admin.dashboard.administrators': 'Administrateurs',
            'admin.dashboard.platforms': 'Plateformes',
            'admin.dashboard.connectedPlatforms': 'Plateformes connectées',
            'admin.adminManagement': 'Gestion des administrateurs',
            'admin.addAdmin': 'Ajouter un administrateur',
            'admin.table.id': 'ID',
            'admin.table.username': 'Nom d’utilisateur',
            'admin.table.email': 'E-mail',
            'admin.table.role': 'Rôle',
            'admin.table.presence': 'Présence',
            'admin.table.created': 'Créé le',
            'admin.table.actions': 'Actions'
        },
        ru: {
            'admin.documentTitle': 'FIU Global Portal — Администрирование',
            'admin.panel': 'Панель администратора',
            'admin.nav.dashboard': 'Панель управления',
            'admin.nav.adminManagement': 'Управление администраторами',
            'admin.nav.users': 'Пользователи',
            'admin.nav.platforms': 'Управление платформами',
            'admin.nav.faculties': 'Факультеты и кафедры',
            'admin.nav.announcements': 'Объявления',
            'admin.nav.diningMenu': 'Меню столовой',
            'admin.nav.holidays': 'Праздники и выходные',
            'admin.nav.roleAccess': 'Доступ по ролям',
            'admin.nav.createUser': 'Создать пользователя',
            'admin.nav.systemHealth': 'Состояние системы',
            'admin.shell.commandCenter': 'Центр управления',
            'admin.shell.liveOperations': 'Панель оперативного управления кампусом',
            'admin.shell.language': 'Язык',
            'admin.shell.dark': 'Тёмная',
            'admin.shell.light': 'Светлая',
            'admin.shell.logout': 'Выйти',
            'admin.shell.toggleSidebar': 'Переключить боковую панель',
            'admin.dashboard.totalUsers': 'Всего пользователей',
            'admin.dashboard.registeredUsers': 'Зарегистрированные пользователи',
            'admin.dashboard.activeAdmins': 'Активные администраторы',
            'admin.dashboard.administrators': 'Администраторы',
            'admin.dashboard.platforms': 'Платформы',
            'admin.dashboard.connectedPlatforms': 'Подключённые платформы',
            'admin.adminManagement': 'Управление администраторами',
            'admin.addAdmin': 'Добавить администратора',
            'admin.table.id': 'ID',
            'admin.table.username': 'Имя пользователя',
            'admin.table.email': 'Эл. почта',
            'admin.table.role': 'Роль',
            'admin.table.presence': 'Присутствие',
            'admin.table.created': 'Создано',
            'admin.table.actions': 'Действия'
        },
        ar: {
            'admin.documentTitle': 'بوابة FIU العالمية — الإدارة',
            'admin.panel': 'لوحة الإدارة',
            'admin.nav.dashboard': 'لوحة التحكم',
            'admin.nav.adminManagement': 'إدارة المسؤولين',
            'admin.nav.users': 'المستخدمون',
            'admin.nav.platforms': 'إدارة المنصات',
            'admin.nav.faculties': 'الكليات والأقسام',
            'admin.nav.announcements': 'الإعلانات',
            'admin.nav.diningMenu': 'قائمة الطعام',
            'admin.nav.holidays': 'العطلات وأيام الراحة',
            'admin.nav.roleAccess': 'الوصول حسب الدور',
            'admin.nav.createUser': 'إنشاء مستخدم',
            'admin.nav.systemHealth': 'حالة النظام',
            'admin.shell.commandCenter': 'مركز القيادة',
            'admin.shell.liveOperations': 'لوحة عمليات الحرم المباشرة',
            'admin.shell.language': 'اللغة',
            'admin.shell.dark': 'داكن',
            'admin.shell.light': 'فاتح',
            'admin.shell.logout': 'تسجيل الخروج',
            'admin.shell.toggleSidebar': 'تبديل الشريط الجانبي',
            'admin.dashboard.totalUsers': 'إجمالي المستخدمين',
            'admin.dashboard.registeredUsers': 'المستخدمون المسجلون',
            'admin.dashboard.activeAdmins': 'المسؤولون النشطون',
            'admin.dashboard.administrators': 'المسؤولون',
            'admin.dashboard.platforms': 'المنصات',
            'admin.dashboard.connectedPlatforms': 'المنصات المتصلة',
            'admin.adminManagement': 'إدارة المسؤولين',
            'admin.addAdmin': 'إضافة مسؤول',
            'admin.table.id': 'المعرّف',
            'admin.table.username': 'اسم المستخدم',
            'admin.table.email': 'البريد الإلكتروني',
            'admin.table.role': 'الدور',
            'admin.table.presence': 'التواجد',
            'admin.table.created': 'تاريخ الإنشاء',
            'admin.table.actions': 'الإجراءات'
        }
    };

    function normalizeLanguage(value) {
        return supportedLanguages.includes(value) ? value : 'en';
    }

    function getLanguage() {
        try {
            return normalizeLanguage(localStorage.getItem('selectedLanguage') || localStorage.getItem('language') || document.documentElement.lang);
        } catch {
            return normalizeLanguage(document.documentElement.lang);
        }
    }

    function persistLanguage(language) {
        try {
            localStorage.setItem('selectedLanguage', language);
            localStorage.setItem('language', language);
        } catch {
            // Storage can be unavailable in private or restricted browser contexts.
        }
    }

    function setDocumentLanguage(language) {
        const normalized = normalizeLanguage(language);
        document.documentElement.lang = normalized;
        document.documentElement.dir = normalized === 'ar' ? 'rtl' : 'ltr';
        document.body?.classList.toggle('admin-rtl', normalized === 'ar');
        return normalized;
    }

    function mergeSharedTranslations() {
        if (!window.translations || typeof window.translations !== 'object') return;
        supportedLanguages.forEach(language => {
            window.translations[language] = window.translations[language] || {};
            Object.keys(translations[language]).forEach(key => {
                if (!window.translations[language][key]) window.translations[language][key] = translations[language][key];
            });
        });
    }

    function interpolate(template, values = {}) {
        return String(template).replace(/\{([\w-]+)\}/g, (match, name) => (
            Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
        ));
    }

    function translate(key, language = getLanguage(), values = {}) {
        const normalized = normalizeLanguage(language);
        const message = window.translations?.[normalized]?.[key]
            || translations[normalized]?.[key]
            || window.translations?.en?.[key]
            || translations.en[key]
            || key;
        return interpolate(message, values);
    }

    function translatePlural(key, count, values = {}, language = getLanguage()) {
        const normalized = normalizeLanguage(language);
        const category = new Intl.PluralRules(localeByLanguage[normalized]).select(Number(count) || 0);
        const candidate = `${key}.${category}`;
        const fallback = `${key}.other`;
        const message = translate(candidate, normalized, { count, ...values });
        return message === candidate ? translate(fallback, normalized, { count, ...values }) : message;
    }

    function registerTranslations(catalog) {
        if (!catalog || typeof catalog !== 'object') return;
        supportedLanguages.forEach(language => {
            if (!catalog[language] || typeof catalog[language] !== 'object') return;
            Object.assign(translations[language], catalog[language]);
            if (window.translations && typeof window.translations === 'object') {
                window.translations[language] = window.translations[language] || {};
                Object.assign(window.translations[language], catalog[language]);
            }
        });
    }

    function collect(root, selector) {
        const nodes = [];
        if (root?.nodeType === Node.ELEMENT_NODE && root.matches(selector)) nodes.push(root);
        root?.querySelectorAll?.(selector).forEach(node => nodes.push(node));
        return nodes;
    }

    function applyTranslations(root = document, language = getLanguage()) {
        const normalized = setDocumentLanguage(language);
        mergeSharedTranslations();
        collect(root, '[data-i18n]').forEach(element => {
            element.textContent = translate(element.dataset.i18n, normalized);
        });
        collect(root, '[data-i18n-placeholder]').forEach(element => {
            element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder, normalized));
        });
        collect(root, '[data-i18n-title]').forEach(element => {
            element.setAttribute('title', translate(element.dataset.i18nTitle, normalized));
        });
        collect(root, '[data-i18n-aria-label]').forEach(element => {
            element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel, normalized));
        });
        return normalized;
    }

    function setLanguage(language) {
        const normalized = normalizeLanguage(language);
        persistLanguage(normalized);
        applyTranslations(document, normalized);
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: normalized, source: 'admin' } }));
        return normalized;
    }

    function installRuntimeCompatibilityNode() {
        // language.js predates the admin shell and expects this optional element
        // while handling document clicks. Keeping it hidden avoids a null listener
        // error without creating a second visible language control.
        if (document.getElementById('language-dropdown') || !document.body) return;
        const node = document.createElement('div');
        node.id = 'language-dropdown';
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
        document.body.appendChild(node);
    }

    function formatDate(value, options) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(localeByLanguage[getLanguage()], options).format(date);
    }

    function formatNumber(value, options) {
        return new Intl.NumberFormat(localeByLanguage[getLanguage()], options).format(value);
    }

    installRuntimeCompatibilityNode();
    // Keep the legacy runtime and the admin selector on one language before their
    // DOMContentLoaded handlers initialise.
    persistLanguage(getLanguage());

    window.adminI18n = Object.freeze({
        supportedLanguages,
        getLanguage,
        setLanguage,
        translate,
        translatePlural,
        registerTranslations,
        applyTranslations,
        formatDate,
        formatNumber
    });
    window.adminT = translate;
    window.adminFormat = Object.freeze({ date: formatDate, number: formatNumber, plural: translatePlural });
    window.tAdmin = translate;
    window.applyAdminTranslations = applyTranslations;

    document.addEventListener('DOMContentLoaded', () => {
        applyTranslations();
        document.dispatchEvent(new CustomEvent('adminI18nReady', { detail: { language: getLanguage() } }));
    });

    window.addEventListener('languageChanged', event => {
        const language = normalizeLanguage(event.detail?.language || getLanguage());
        persistLanguage(language);
        window.setTimeout(() => applyTranslations(document, language), 0);
    });
})();
