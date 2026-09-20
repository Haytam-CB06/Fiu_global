/*
 * Shared FIU Global Portal internationalisation runtime.
 *
 * It is intentionally framework-free: login, portal, archive and admin pages
 * can all use it.  Legacy `data-translate` markup and `window.translations`
 * remain supported while new work should prefer the namespaced `data-i18n`
 * attributes and `window.t()`.
 */
(function fiuGlobalI18n(window, document) {
    'use strict';

    const COOKIE_NAME = 'FiuGlobal.Language';
    const STORAGE_KEY = 'language';
    const LEGACY_STORAGE_KEY = 'selectedLanguage';
    const DEFAULT_LANGUAGE = 'en';
    const SUPPORTED_LANGUAGES = Object.freeze(['en', 'tr', 'fr', 'ru', 'ar']);
    const RTL_LANGUAGES = new Set(['ar']);
    const LOCALES = Object.freeze({
        en: 'en-US', tr: 'tr-TR', fr: 'fr-FR', ru: 'ru-RU',
        // Use the Gregorian calendar while retaining Arabic language and digits.
        ar: 'ar-EG-u-ca-gregory'
    });

    const translations = {
        en: {
            'language.label': 'Language', 'language.name.en': 'English', 'language.name.tr': 'Turkish', 'language.name.fr': 'French', 'language.name.ru': 'Russian', 'language.name.ar': 'Arabic',
            'common.portalName': 'FIU Global Portal', 'common.open': 'Open', 'common.close': 'Close', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.edit': 'Edit', 'common.delete': 'Delete', 'common.remove': 'Remove', 'common.refresh': 'Refresh', 'common.retry': 'Try again', 'common.previous': 'Previous', 'common.next': 'Next', 'common.loading': 'Loading…', 'common.search': 'Search', 'common.filter': 'Filter', 'common.actions': 'Actions', 'common.status': 'Status', 'common.active': 'Active', 'common.inactive': 'Inactive', 'common.all': 'All', 'common.none': 'None', 'common.create': 'Create', 'common.update': 'Update', 'common.upload': 'Upload', 'common.download': 'Download', 'common.view': 'View', 'common.account': 'Account', 'common.profile': 'Profile', 'common.dashboard': 'Dashboard', 'common.user': 'User', 'common.users': 'Users', 'common.role': 'Role', 'common.email': 'Email', 'common.username': 'Username', 'common.password': 'Password', 'common.error': 'Error', 'common.unavailable': 'Unavailable', 'common.notAvailable': 'Not available', 'common.logout': 'Logout',
            'auth.welcome': 'Welcome to FIU Global Portal', 'auth.signInContinue': 'Sign in to continue to your account', 'auth.username': 'Username', 'auth.usernamePlaceholder': 'Enter your username', 'auth.password': 'Password', 'auth.passwordPlaceholder': 'Enter your password', 'auth.signIn': 'Sign In', 'auth.signInWithGoogle': 'Continue with Google', 'auth.or': 'or', 'auth.showPassword': 'Show password', 'auth.hidePassword': 'Hide password', 'auth.loginRequired': 'Please Login', 'auth.loginRequiredDescription': 'You need to login to access the platforms.', 'auth.goToLogin': 'Go to Login', 'auth.credentialsRequired': 'Please enter both username and password.', 'auth.invalidCredentials': 'Invalid credentials. Please check your username and password.', 'auth.googleUnavailable': 'Unable to complete Google login.',
            'theme.light': 'Light Mode', 'theme.dark': 'Dark Mode',
            'navigation.dashboard': 'Dashboard', 'navigation.chat': 'Chat', 'navigation.platforms': 'Platforms', 'navigation.announcements': 'Announcements', 'navigation.diningMenu': 'Dining menu', 'navigation.archive': 'Archive', 'navigation.profile': 'Profile', 'navigation.faculties': 'Faculties & Departments', 'navigation.roleAccess': 'Role Access', 'navigation.holidays': 'Holidays & Days Off',
            'portal.welcomeUser': 'Welcome, {name}', 'portal.selectPlatform': 'Select a Platform', 'portal.choosePlatform': 'Choose one of the following platforms to access:', 'portal.accessPlatform': 'Access Platform', 'portal.directAccess': 'Direct Access', 'portal.campusPortal': 'Campus portal', 'portal.yourCampusOrganized': 'Your campus, organized.', 'portal.dashboardDescription': 'Find academic services, campus updates, and dining information from one clear dashboard.', 'portal.personalizedForYou': 'Personalized for you', 'portal.mostAccessed': 'Most accessed platforms', 'portal.quickAccess': 'Quick access', 'portal.visit': { one: '{count} visit', other: '{count} visits' }, 'portal.service': { one: '{count} service', other: '{count} services' }, 'portal.pageOf': 'Page {current} of {total}',
            'profile.title': 'My profile', 'profile.description': 'View and update your account details.', 'profile.studentNumber': 'Student number', 'profile.firstName': 'First name', 'profile.surname': 'Surname', 'profile.picture': 'Profile picture', 'profile.uploadPicture': 'Upload profile picture', 'profile.upload': 'Upload', 'profile.faculty': 'Faculty', 'profile.department': 'Department', 'profile.selectFaculty': 'Select a faculty', 'profile.selectDepartment': 'Select a department', 'profile.chooseFacultyFirst': 'Choose a faculty first', 'profile.save': 'Save profile', 'profile.changePassword': 'Change password', 'profile.currentPassword': 'Current password', 'profile.newPassword': 'New password', 'profile.confirmNewPassword': 'Confirm new password', 'profile.showCurrentPassword': 'Show current password', 'profile.showNewPassword': 'Show new password', 'profile.showConfirmedPassword': 'Show confirmed password', 'profile.saved': 'Profile saved.', 'profile.pictureUploaded': 'Profile picture uploaded.', 'profile.passwordChanged': 'Password changed.', 'profile.passwordMismatch': 'New passwords do not match.', 'profile.unavailable': 'Profile unavailable.', 'profile.uploadHelp': 'JPG, PNG, WebP or GIF, up to 5MB',
            'chat.title': 'Connect with campus', 'chat.description': 'Chat in real time with instructors and students.', 'chat.people': 'People', 'chat.connecting': 'Connecting…', 'chat.searchPeople': 'Search people', 'chat.choosePerson': 'Choose a person to start chatting.', 'chat.messagesAppear': 'Your messages will appear here.', 'chat.message': 'Message', 'chat.choosePersonFirst': 'Choose a person first…', 'chat.send': 'Send', 'chat.noUsers': 'No users found.', 'chat.noMessages': 'No messages yet', 'chat.unavailable': 'Unavailable', 'chat.live': 'Live', 'chat.offline': 'Offline', 'chat.loadingConversation': 'Loading conversation…', 'chat.startConversation': 'Start a conversation with {name}.', 'chat.unread': { one: '{count} unread message', other: '{count} unread messages' }, 'chat.sent': 'Sent', 'chat.received': 'Received', 'chat.seen': 'Seen',
            'announcements.title': 'Announcements', 'announcements.description': 'Latest announcements from administrators:', 'announcements.loading': 'Loading announcements…', 'announcements.empty': 'No announcements found.', 'announcements.error': 'Error loading announcements.',
            'dining.title': 'Dining Menu', 'dining.description': 'Dining menu and meal schedules:', 'dining.today': 'Today’s menu', 'dining.breakfast': 'Breakfast', 'dining.lunch': 'Lunch', 'dining.noMenu': 'No menu', 'dining.noMenuToday': 'No menu has been added for today.', 'dining.noBreakfast': 'No breakfast menu available', 'dining.noLunch': 'No lunch menu available', 'dining.loading': 'Loading dining menu…', 'dining.previousMonth': 'Previous month', 'dining.nextMonth': 'Next month',
            'notifications.title': 'Notifications', 'notifications.loading': 'Loading…', 'notifications.empty': 'No notifications.', 'notifications.error': 'Error loading notifications.', 'notifications.deleteConfirm': 'Delete this notification?', 'notifications.deleteFailed': 'Failed to delete notification.',
            'archive.title': 'Archive', 'archive.loadingAccount': 'Loading account…', 'archive.hero': 'Your Archived Campus Updates', 'archive.description': 'Review announcements after 50 days and past dining menus that are available for your account.', 'archive.announcements': 'Archived Announcements', 'archive.dining': 'Past Dining Menus', 'archive.emptyAnnouncements': 'No archived announcements yet.', 'archive.emptyDining': 'No past dining menus yet.', 'archive.weeklyDining': 'Weekly dining menu', 'archive.item': { one: '{count} item', other: '{count} items' }, 'archive.menu': { one: '{count} menu', other: '{count} menus' },
            'validation.unableToLoad': 'Unable to load {resource}.', 'validation.unableToSave': 'Unable to save {resource}.', 'validation.unableToDelete': 'Unable to delete {resource}.', 'validation.networkError': 'A network error occurred. Please try again.',
            'tour.notifications.title': 'Notifications Center', 'tour.notifications.content': 'Click the bell icon to view your notifications from all connected platforms including RMS, Leave Portal, SIS, and LMS.', 'tour.platforms.title': 'Platform Access', 'tour.platforms.content': 'This is where you can access all your university platforms. Click on any platform card to open it in a new tab.', 'tour.dining.title': 'Dining Menu', 'tour.dining.content': 'Check today\'s dining menu and meal schedules. Click on the card to view full details including breakfast and lunch times.', 'tour.announcements.title': 'Announcements', 'tour.announcements.content': 'Stay updated with the latest announcements from administrators. Click on any announcement to read the full details.', 'tour.settings.title': 'User Settings', 'tour.settings.content': 'Click here to access your account settings, change language, toggle dark mode, or log out.', 'tour.navigation.title': 'Platform Navigation', 'tour.navigation.content': 'This is your central hub for accessing all university systems. You can always return here to switch between platforms.', 'tour.welcome.title': 'Welcome Message', 'tour.welcome.content': 'You\'re all set! Your username is displayed here. You can now explore all the platforms and features available to you.', 'tour.previous': 'Previous', 'tour.next': 'Next', 'tour.finish': 'Finish', 'tour.restart': 'Restart Tour', 'tour.skip': 'Skip'
        },
        tr: {
            'language.label': 'Dil', 'language.name.en': 'İngilizce', 'language.name.tr': 'Türkçe', 'language.name.fr': 'Fransızca', 'language.name.ru': 'Rusça', 'language.name.ar': 'Arapça',
            'common.open': 'Aç', 'common.close': 'Kapat', 'common.cancel': 'İptal', 'common.save': 'Kaydet', 'common.edit': 'Düzenle', 'common.delete': 'Sil', 'common.remove': 'Kaldır', 'common.refresh': 'Yenile', 'common.retry': 'Tekrar dene', 'common.previous': 'Önceki', 'common.next': 'Sonraki', 'common.loading': 'Yükleniyor…', 'common.search': 'Ara', 'common.filter': 'Filtrele', 'common.actions': 'İşlemler', 'common.status': 'Durum', 'common.active': 'Aktif', 'common.inactive': 'Pasif', 'common.all': 'Tümü', 'common.none': 'Yok', 'common.create': 'Oluştur', 'common.update': 'Güncelle', 'common.upload': 'Yükle', 'common.download': 'İndir', 'common.view': 'Görüntüle', 'common.account': 'Hesap', 'common.profile': 'Profil', 'common.dashboard': 'Gösterge paneli', 'common.user': 'Kullanıcı', 'common.users': 'Kullanıcılar', 'common.role': 'Rol', 'common.email': 'E-posta', 'common.username': 'Kullanıcı adı', 'common.password': 'Şifre', 'common.error': 'Hata', 'common.unavailable': 'Kullanılamıyor', 'common.notAvailable': 'Mevcut değil', 'common.logout': 'Çıkış Yap',
            'auth.welcome': 'FIU Global Portal\'a hoş geldiniz', 'auth.signInContinue': 'Hesabınıza devam etmek için giriş yapın', 'auth.username': 'Kullanıcı adı', 'auth.usernamePlaceholder': 'Kullanıcı adınızı girin', 'auth.password': 'Şifre', 'auth.passwordPlaceholder': 'Şifrenizi girin', 'auth.signIn': 'Giriş Yap', 'auth.signInWithGoogle': 'Google ile devam et', 'auth.or': 'veya', 'auth.showPassword': 'Şifreyi göster', 'auth.hidePassword': 'Şifreyi gizle', 'auth.loginRequired': 'Lütfen giriş yapın', 'auth.loginRequiredDescription': 'Platformlara erişmek için giriş yapmanız gerekiyor.', 'auth.goToLogin': 'Giriş sayfasına git', 'auth.credentialsRequired': 'Lütfen kullanıcı adı ve şifreyi girin.', 'auth.invalidCredentials': 'Geçersiz kimlik bilgileri. Lütfen kullanıcı adınızı ve şifrenizi kontrol edin.', 'auth.googleUnavailable': 'Google ile giriş tamamlanamadı.',
            'theme.light': 'Aydınlık mod', 'theme.dark': 'Karanlık mod',
            'navigation.dashboard': 'Gösterge paneli', 'navigation.chat': 'Sohbet', 'navigation.platforms': 'Platformlar', 'navigation.announcements': 'Duyurular', 'navigation.diningMenu': 'Yemek menüsü', 'navigation.archive': 'Arşiv', 'navigation.profile': 'Profil', 'navigation.faculties': 'Fakülteler ve Bölümler', 'navigation.roleAccess': 'Rol Erişimi', 'navigation.holidays': 'Tatiller ve İzin Günleri',
            'portal.welcomeUser': 'Hoş geldiniz, {name}', 'portal.selectPlatform': 'Bir Platform Seçin', 'portal.choosePlatform': 'Erişmek için aşağıdaki platformlardan birini seçin:', 'portal.accessPlatform': 'Platforma Eriş', 'portal.directAccess': 'Doğrudan Erişim', 'portal.campusPortal': 'Kampüs portalı', 'portal.yourCampusOrganized': 'Kampüsünüz düzenli.', 'portal.dashboardDescription': 'Akademik hizmetlere, kampüs güncellemelerine ve yemek bilgilerine tek bir anlaşılır gösterge panelinden erişin.', 'portal.personalizedForYou': 'Size özel', 'portal.mostAccessed': 'En çok erişilen platformlar', 'portal.quickAccess': 'Hızlı erişim', 'portal.visit': { one: '{count} ziyaret', other: '{count} ziyaret' }, 'portal.service': { one: '{count} hizmet', other: '{count} hizmet' }, 'portal.pageOf': '{current}. sayfa / {total}',
            'profile.title': 'Profilim', 'profile.description': 'Hesap bilgilerinizi görüntüleyin ve güncelleyin.', 'profile.studentNumber': 'Öğrenci numarası', 'profile.firstName': 'Ad', 'profile.surname': 'Soyad', 'profile.picture': 'Profil resmi', 'profile.uploadPicture': 'Profil resmi yükle', 'profile.upload': 'Yükle', 'profile.faculty': 'Fakülte', 'profile.department': 'Bölüm', 'profile.selectFaculty': 'Bir fakülte seçin', 'profile.selectDepartment': 'Bir bölüm seçin', 'profile.chooseFacultyFirst': 'Önce bir fakülte seçin', 'profile.save': 'Profili kaydet', 'profile.changePassword': 'Şifre değiştir', 'profile.currentPassword': 'Mevcut şifre', 'profile.newPassword': 'Yeni şifre', 'profile.confirmNewPassword': 'Yeni şifreyi onaylayın', 'profile.showCurrentPassword': 'Mevcut şifreyi göster', 'profile.showNewPassword': 'Yeni şifreyi göster', 'profile.showConfirmedPassword': 'Onaylanan şifreyi göster', 'profile.saved': 'Profil kaydedildi.', 'profile.pictureUploaded': 'Profil resmi yüklendi.', 'profile.passwordChanged': 'Şifre değiştirildi.', 'profile.passwordMismatch': 'Yeni şifreler eşleşmiyor.', 'profile.unavailable': 'Profil kullanılamıyor.', 'profile.uploadHelp': 'JPG, PNG, WebP veya GIF, en fazla 5 MB',
            'chat.title': 'Kampüsle bağlantı kurun', 'chat.description': 'Öğretim görevlileri ve öğrencilerle gerçek zamanlı sohbet edin.', 'chat.people': 'Kişiler', 'chat.connecting': 'Bağlanıyor…', 'chat.searchPeople': 'Kişi ara', 'chat.choosePerson': 'Sohbet etmeye başlamak için bir kişi seçin.', 'chat.messagesAppear': 'Mesajlarınız burada görünür.', 'chat.message': 'Mesaj', 'chat.choosePersonFirst': 'Önce bir kişi seçin…', 'chat.send': 'Gönder', 'chat.noUsers': 'Kullanıcı bulunamadı.', 'chat.noMessages': 'Henüz mesaj yok', 'chat.unavailable': 'Kullanılamıyor', 'chat.live': 'Canlı', 'chat.offline': 'Çevrimdışı', 'chat.loadingConversation': 'Konuşma yükleniyor…', 'chat.startConversation': '{name} ile bir konuşma başlatın.', 'chat.unread': { one: '{count} okunmamış mesaj', other: '{count} okunmamış mesaj' }, 'chat.sent': 'Gönderildi', 'chat.received': 'Alındı', 'chat.seen': 'Görüldü',
            'announcements.title': 'Duyurular', 'announcements.description': 'Yöneticilerden en son duyurular:', 'announcements.loading': 'Duyurular yükleniyor…', 'announcements.empty': 'Duyuru bulunamadı.', 'announcements.error': 'Duyurular yüklenirken hata oluştu.',
            'dining.title': 'Yemek Menüsü', 'dining.description': 'Yemek menüsü ve öğün saatleri:', 'dining.today': 'Bugünün menüsü', 'dining.breakfast': 'Kahvaltı', 'dining.lunch': 'Öğle yemeği', 'dining.noMenu': 'Menü yok', 'dining.noMenuToday': 'Bugün için menü eklenmedi.', 'dining.noBreakfast': 'Kahvaltı menüsü mevcut değil', 'dining.noLunch': 'Öğle yemeği mevcut değil', 'dining.loading': 'Yemek menüsü yükleniyor…', 'dining.previousMonth': 'Önceki ay', 'dining.nextMonth': 'Sonraki ay',
            'notifications.title': 'Bildirimler', 'notifications.loading': 'Yükleniyor…', 'notifications.empty': 'Bildirim yok.', 'notifications.error': 'Bildirimler yüklenirken hata oluştu.', 'notifications.deleteConfirm': 'Bu bildirimi silmek istiyor musunuz?', 'notifications.deleteFailed': 'Bildirim silinemedi.',
            'archive.title': 'Arşiv', 'archive.loadingAccount': 'Hesap yükleniyor…', 'archive.hero': 'Arşivlenmiş Kampüs Güncellemeleriniz', 'archive.description': '50 gün sonraki duyuruları ve hesabınız için sunulan geçmiş yemek menülerini inceleyin.', 'archive.announcements': 'Arşivlenmiş Duyurular', 'archive.dining': 'Geçmiş Yemek Menüleri', 'archive.emptyAnnouncements': 'Henüz arşivlenmiş duyuru yok.', 'archive.emptyDining': 'Henüz geçmiş yemek menüsü yok.', 'archive.weeklyDining': 'Haftalık yemek menüsü', 'archive.item': { one: '{count} öğe', other: '{count} öğe' }, 'archive.menu': { one: '{count} menü', other: '{count} menü' },
            'validation.unableToLoad': '{resource} yüklenemedi.', 'validation.unableToSave': '{resource} kaydedilemedi.', 'validation.unableToDelete': '{resource} silinemedi.', 'validation.networkError': 'Bir ağ hatası oluştu. Lütfen tekrar deneyin.'
        },
        fr: {
            'language.label': 'Langue', 'language.name.en': 'Anglais', 'language.name.tr': 'Turc', 'language.name.fr': 'Français', 'language.name.ru': 'Russe', 'language.name.ar': 'Arabe',
            'common.open': 'Ouvrir', 'common.close': 'Fermer', 'common.cancel': 'Annuler', 'common.save': 'Enregistrer', 'common.edit': 'Modifier', 'common.delete': 'Supprimer', 'common.remove': 'Retirer', 'common.refresh': 'Actualiser', 'common.retry': 'Réessayer', 'common.previous': 'Précédent', 'common.next': 'Suivant', 'common.loading': 'Chargement…', 'common.search': 'Rechercher', 'common.filter': 'Filtrer', 'common.actions': 'Actions', 'common.status': 'Statut', 'common.active': 'Actif', 'common.inactive': 'Inactif', 'common.all': 'Tout', 'common.none': 'Aucun', 'common.create': 'Créer', 'common.update': 'Mettre à jour', 'common.upload': 'Téléverser', 'common.download': 'Télécharger', 'common.view': 'Afficher', 'common.account': 'Compte', 'common.profile': 'Profil', 'common.dashboard': 'Tableau de bord', 'common.user': 'Utilisateur', 'common.users': 'Utilisateurs', 'common.role': 'Rôle', 'common.email': 'E-mail', 'common.username': 'Nom d’utilisateur', 'common.password': 'Mot de passe', 'common.error': 'Erreur', 'common.unavailable': 'Indisponible', 'common.notAvailable': 'Non disponible', 'common.logout': 'Se déconnecter',
            'auth.welcome': 'Bienvenue sur FIU Global Portal', 'auth.signInContinue': 'Connectez-vous pour continuer vers votre compte', 'auth.username': 'Nom d’utilisateur', 'auth.usernamePlaceholder': 'Entrez votre nom d’utilisateur', 'auth.password': 'Mot de passe', 'auth.passwordPlaceholder': 'Entrez votre mot de passe', 'auth.signIn': 'Se connecter', 'auth.signInWithGoogle': 'Continuer avec Google', 'auth.or': 'ou', 'auth.showPassword': 'Afficher le mot de passe', 'auth.hidePassword': 'Masquer le mot de passe', 'auth.loginRequired': 'Veuillez vous connecter', 'auth.loginRequiredDescription': 'Vous devez vous connecter pour accéder aux plateformes.', 'auth.goToLogin': 'Aller à la connexion', 'auth.credentialsRequired': 'Saisissez votre nom d’utilisateur et votre mot de passe.', 'auth.invalidCredentials': 'Identifiants invalides. Vérifiez votre nom d’utilisateur et votre mot de passe.', 'auth.googleUnavailable': 'Impossible de terminer la connexion Google.',
            'theme.light': 'Mode clair', 'theme.dark': 'Mode sombre',
            'navigation.dashboard': 'Tableau de bord', 'navigation.chat': 'Discussion', 'navigation.platforms': 'Plateformes', 'navigation.announcements': 'Annonces', 'navigation.diningMenu': 'Menu de restauration', 'navigation.archive': 'Archives', 'navigation.profile': 'Profil', 'navigation.faculties': 'Facultés et départements', 'navigation.roleAccess': 'Accès par rôle', 'navigation.holidays': 'Jours fériés et congés',
            'portal.welcomeUser': 'Bienvenue, {name}', 'portal.selectPlatform': 'Sélectionnez une plateforme', 'portal.choosePlatform': 'Choisissez l’une des plateformes suivantes pour y accéder :', 'portal.accessPlatform': 'Accéder à la plateforme', 'portal.directAccess': 'Accès direct', 'portal.campusPortal': 'Portail du campus', 'portal.yourCampusOrganized': 'Votre campus, bien organisé.', 'portal.dashboardDescription': 'Accédez aux services académiques, aux actualités du campus et aux informations de restauration depuis un tableau de bord clair.', 'portal.personalizedForYou': 'Personnalisé pour vous', 'portal.mostAccessed': 'Plateformes les plus consultées', 'portal.quickAccess': 'Accès rapide', 'portal.visit': { one: '{count} visite', other: '{count} visites' }, 'portal.service': { one: '{count} service', other: '{count} services' }, 'portal.pageOf': 'Page {current} sur {total}',
            'profile.title': 'Mon profil', 'profile.description': 'Consultez et mettez à jour les informations de votre compte.', 'profile.studentNumber': 'Numéro d’étudiant', 'profile.firstName': 'Prénom', 'profile.surname': 'Nom', 'profile.picture': 'Photo de profil', 'profile.uploadPicture': 'Téléverser une photo de profil', 'profile.upload': 'Téléverser', 'profile.faculty': 'Faculté', 'profile.department': 'Département', 'profile.selectFaculty': 'Sélectionnez une faculté', 'profile.selectDepartment': 'Sélectionnez un département', 'profile.chooseFacultyFirst': 'Choisissez d’abord une faculté', 'profile.save': 'Enregistrer le profil', 'profile.changePassword': 'Changer le mot de passe', 'profile.currentPassword': 'Mot de passe actuel', 'profile.newPassword': 'Nouveau mot de passe', 'profile.confirmNewPassword': 'Confirmer le nouveau mot de passe', 'profile.showCurrentPassword': 'Afficher le mot de passe actuel', 'profile.showNewPassword': 'Afficher le nouveau mot de passe', 'profile.showConfirmedPassword': 'Afficher le mot de passe confirmé', 'profile.saved': 'Profil enregistré.', 'profile.pictureUploaded': 'Photo de profil téléversée.', 'profile.passwordChanged': 'Mot de passe modifié.', 'profile.passwordMismatch': 'Les nouveaux mots de passe ne correspondent pas.', 'profile.unavailable': 'Profil indisponible.', 'profile.uploadHelp': 'JPG, PNG, WebP ou GIF, jusqu’à 5 Mo',
            'chat.title': 'Restez en contact avec le campus', 'chat.description': 'Discutez en temps réel avec les enseignants et les étudiants.', 'chat.people': 'Personnes', 'chat.connecting': 'Connexion…', 'chat.searchPeople': 'Rechercher des personnes', 'chat.choosePerson': 'Choisissez une personne pour commencer à discuter.', 'chat.messagesAppear': 'Vos messages apparaîtront ici.', 'chat.message': 'Message', 'chat.choosePersonFirst': 'Choisissez d’abord une personne…', 'chat.send': 'Envoyer', 'chat.noUsers': 'Aucun utilisateur trouvé.', 'chat.noMessages': 'Aucun message pour le moment', 'chat.unavailable': 'Indisponible', 'chat.live': 'En direct', 'chat.offline': 'Hors ligne', 'chat.loadingConversation': 'Chargement de la conversation…', 'chat.startConversation': 'Commencez une conversation avec {name}.', 'chat.unread': { one: '{count} message non lu', other: '{count} messages non lus' }, 'chat.sent': 'Envoyé', 'chat.received': 'Reçu', 'chat.seen': 'Vu',
            'announcements.title': 'Annonces', 'announcements.description': 'Dernières annonces des administrateurs :', 'announcements.loading': 'Chargement des annonces…', 'announcements.empty': 'Aucune annonce trouvée.', 'announcements.error': 'Erreur lors du chargement des annonces.',
            'dining.title': 'Menu de restauration', 'dining.description': 'Menu et horaires des repas :', 'dining.today': 'Menu du jour', 'dining.breakfast': 'Petit-déjeuner', 'dining.lunch': 'Déjeuner', 'dining.noMenu': 'Aucun menu', 'dining.noMenuToday': 'Aucun menu n’a été ajouté pour aujourd’hui.', 'dining.noBreakfast': 'Aucun menu de petit-déjeuner disponible', 'dining.noLunch': 'Aucun menu de déjeuner disponible', 'dining.loading': 'Chargement du menu…', 'dining.previousMonth': 'Mois précédent', 'dining.nextMonth': 'Mois suivant',
            'notifications.title': 'Notifications', 'notifications.loading': 'Chargement…', 'notifications.empty': 'Aucune notification.', 'notifications.error': 'Erreur lors du chargement des notifications.', 'notifications.deleteConfirm': 'Supprimer cette notification ?', 'notifications.deleteFailed': 'Échec de la suppression de la notification.',
            'archive.title': 'Archives', 'archive.loadingAccount': 'Chargement du compte…', 'archive.hero': 'Vos actualités de campus archivées', 'archive.description': 'Consultez les annonces après 50 jours et les anciens menus de restauration disponibles pour votre compte.', 'archive.announcements': 'Annonces archivées', 'archive.dining': 'Anciens menus de restauration', 'archive.emptyAnnouncements': 'Aucune annonce archivée pour le moment.', 'archive.emptyDining': 'Aucun ancien menu pour le moment.', 'archive.weeklyDining': 'Menu de restauration hebdomadaire', 'archive.item': { one: '{count} élément', other: '{count} éléments' }, 'archive.menu': { one: '{count} menu', other: '{count} menus' },
            'validation.unableToLoad': 'Impossible de charger {resource}.', 'validation.unableToSave': 'Impossible d’enregistrer {resource}.', 'validation.unableToDelete': 'Impossible de supprimer {resource}.', 'validation.networkError': 'Une erreur réseau s’est produite. Réessayez.'
        },
        ru: {
            'language.label': 'Язык', 'language.name.en': 'Английский', 'language.name.tr': 'Турецкий', 'language.name.fr': 'Французский', 'language.name.ru': 'Русский', 'language.name.ar': 'Арабский',
            'common.open': 'Открыть', 'common.close': 'Закрыть', 'common.cancel': 'Отмена', 'common.save': 'Сохранить', 'common.edit': 'Изменить', 'common.delete': 'Удалить', 'common.remove': 'Убрать', 'common.refresh': 'Обновить', 'common.retry': 'Повторить', 'common.previous': 'Назад', 'common.next': 'Далее', 'common.loading': 'Загрузка…', 'common.search': 'Поиск', 'common.filter': 'Фильтр', 'common.actions': 'Действия', 'common.status': 'Статус', 'common.active': 'Активный', 'common.inactive': 'Неактивный', 'common.all': 'Все', 'common.none': 'Нет', 'common.create': 'Создать', 'common.update': 'Обновить', 'common.upload': 'Загрузить', 'common.download': 'Скачать', 'common.view': 'Просмотреть', 'common.account': 'Учётная запись', 'common.profile': 'Профиль', 'common.dashboard': 'Панель управления', 'common.user': 'Пользователь', 'common.users': 'Пользователи', 'common.role': 'Роль', 'common.email': 'Электронная почта', 'common.username': 'Имя пользователя', 'common.password': 'Пароль', 'common.error': 'Ошибка', 'common.unavailable': 'Недоступно', 'common.notAvailable': 'Недоступно', 'common.logout': 'Выйти',
            'auth.welcome': 'Добро пожаловать в FIU Global Portal', 'auth.signInContinue': 'Войдите, чтобы продолжить работу с учётной записью', 'auth.username': 'Имя пользователя', 'auth.usernamePlaceholder': 'Введите имя пользователя', 'auth.password': 'Пароль', 'auth.passwordPlaceholder': 'Введите пароль', 'auth.signIn': 'Войти', 'auth.signInWithGoogle': 'Продолжить с Google', 'auth.or': 'или', 'auth.showPassword': 'Показать пароль', 'auth.hidePassword': 'Скрыть пароль', 'auth.loginRequired': 'Пожалуйста, войдите', 'auth.loginRequiredDescription': 'Для доступа к платформам необходимо войти.', 'auth.goToLogin': 'Перейти к входу', 'auth.credentialsRequired': 'Введите имя пользователя и пароль.', 'auth.invalidCredentials': 'Неверные учётные данные. Проверьте имя пользователя и пароль.', 'auth.googleUnavailable': 'Не удалось завершить вход через Google.',
            'theme.light': 'Светлый режим', 'theme.dark': 'Тёмный режим',
            'navigation.dashboard': 'Панель управления', 'navigation.chat': 'Чат', 'navigation.platforms': 'Платформы', 'navigation.announcements': 'Объявления', 'navigation.diningMenu': 'Меню столовой', 'navigation.archive': 'Архив', 'navigation.profile': 'Профиль', 'navigation.faculties': 'Факультеты и кафедры', 'navigation.roleAccess': 'Доступ по ролям', 'navigation.holidays': 'Праздники и выходные',
            'portal.welcomeUser': 'Добро пожаловать, {name}', 'portal.selectPlatform': 'Выберите платформу', 'portal.choosePlatform': 'Выберите одну из следующих платформ для доступа:', 'portal.accessPlatform': 'Перейти к платформе', 'portal.directAccess': 'Прямой доступ', 'portal.campusPortal': 'Портал кампуса', 'portal.yourCampusOrganized': 'Ваш кампус организован.', 'portal.dashboardDescription': 'Получайте доступ к академическим сервисам, новостям кампуса и информации о питании с одной понятной панели управления.', 'portal.personalizedForYou': 'Персонально для вас', 'portal.mostAccessed': 'Самые посещаемые платформы', 'portal.quickAccess': 'Быстрый доступ', 'portal.visit': { one: '{count} посещение', few: '{count} посещения', many: '{count} посещений', other: '{count} посещения' }, 'portal.service': { one: '{count} сервис', few: '{count} сервиса', many: '{count} сервисов', other: '{count} сервиса' }, 'portal.pageOf': 'Страница {current} из {total}',
            'profile.title': 'Мой профиль', 'profile.description': 'Просматривайте и обновляйте сведения о своей учётной записи.', 'profile.studentNumber': 'Номер студента', 'profile.firstName': 'Имя', 'profile.surname': 'Фамилия', 'profile.picture': 'Фото профиля', 'profile.uploadPicture': 'Загрузить фото профиля', 'profile.upload': 'Загрузить', 'profile.faculty': 'Факультет', 'profile.department': 'Кафедра', 'profile.selectFaculty': 'Выберите факультет', 'profile.selectDepartment': 'Выберите кафедру', 'profile.chooseFacultyFirst': 'Сначала выберите факультет', 'profile.save': 'Сохранить профиль', 'profile.changePassword': 'Изменить пароль', 'profile.currentPassword': 'Текущий пароль', 'profile.newPassword': 'Новый пароль', 'profile.confirmNewPassword': 'Подтвердите новый пароль', 'profile.showCurrentPassword': 'Показать текущий пароль', 'profile.showNewPassword': 'Показать новый пароль', 'profile.showConfirmedPassword': 'Показать подтверждённый пароль', 'profile.saved': 'Профиль сохранён.', 'profile.pictureUploaded': 'Фото профиля загружено.', 'profile.passwordChanged': 'Пароль изменён.', 'profile.passwordMismatch': 'Новые пароли не совпадают.', 'profile.unavailable': 'Профиль недоступен.', 'profile.uploadHelp': 'JPG, PNG, WebP или GIF, до 5 МБ',
            'chat.title': 'Общайтесь с кампусом', 'chat.description': 'Общайтесь в реальном времени с преподавателями и студентами.', 'chat.people': 'Люди', 'chat.connecting': 'Подключение…', 'chat.searchPeople': 'Поиск людей', 'chat.choosePerson': 'Выберите человека, чтобы начать чат.', 'chat.messagesAppear': 'Ваши сообщения появятся здесь.', 'chat.message': 'Сообщение', 'chat.choosePersonFirst': 'Сначала выберите человека…', 'chat.send': 'Отправить', 'chat.noUsers': 'Пользователи не найдены.', 'chat.noMessages': 'Сообщений пока нет', 'chat.unavailable': 'Недоступно', 'chat.live': 'В сети', 'chat.offline': 'Не в сети', 'chat.loadingConversation': 'Загрузка разговора…', 'chat.startConversation': 'Начните разговор с {name}.', 'chat.unread': { one: '{count} непрочитанное сообщение', few: '{count} непрочитанных сообщения', many: '{count} непрочитанных сообщений', other: '{count} непрочитанных сообщения' }, 'chat.sent': 'Отправлено', 'chat.received': 'Получено', 'chat.seen': 'Просмотрено',
            'announcements.title': 'Объявления', 'announcements.description': 'Последние объявления от администраторов:', 'announcements.loading': 'Загрузка объявлений…', 'announcements.empty': 'Объявления не найдены.', 'announcements.error': 'Ошибка загрузки объявлений.',
            'dining.title': 'Меню столовой', 'dining.description': 'Меню и расписание приёмов пищи:', 'dining.today': 'Меню на сегодня', 'dining.breakfast': 'Завтрак', 'dining.lunch': 'Обед', 'dining.noMenu': 'Нет меню', 'dining.noMenuToday': 'На сегодня меню не добавлено.', 'dining.noBreakfast': 'Меню завтрака недоступно', 'dining.noLunch': 'Меню обеда недоступно', 'dining.loading': 'Загрузка меню…', 'dining.previousMonth': 'Предыдущий месяц', 'dining.nextMonth': 'Следующий месяц',
            'notifications.title': 'Уведомления', 'notifications.loading': 'Загрузка…', 'notifications.empty': 'Нет уведомлений.', 'notifications.error': 'Ошибка загрузки уведомлений.', 'notifications.deleteConfirm': 'Удалить это уведомление?', 'notifications.deleteFailed': 'Не удалось удалить уведомление.',
            'archive.title': 'Архив', 'archive.loadingAccount': 'Загрузка учётной записи…', 'archive.hero': 'Ваши архивные обновления кампуса', 'archive.description': 'Просматривайте объявления через 50 дней и прошлые меню столовой, доступные для вашей учётной записи.', 'archive.announcements': 'Архивные объявления', 'archive.dining': 'Прошлые меню столовой', 'archive.emptyAnnouncements': 'Архивных объявлений пока нет.', 'archive.emptyDining': 'Прошлых меню пока нет.', 'archive.weeklyDining': 'Еженедельное меню столовой', 'archive.item': { one: '{count} элемент', few: '{count} элемента', many: '{count} элементов', other: '{count} элемента' }, 'archive.menu': { one: '{count} меню', few: '{count} меню', many: '{count} меню', other: '{count} меню' },
            'validation.unableToLoad': 'Не удалось загрузить: {resource}.', 'validation.unableToSave': 'Не удалось сохранить: {resource}.', 'validation.unableToDelete': 'Не удалось удалить: {resource}.', 'validation.networkError': 'Произошла ошибка сети. Повторите попытку.'
        },
        ar: {
            'language.label': 'اللغة', 'language.name.en': 'الإنجليزية', 'language.name.tr': 'التركية', 'language.name.fr': 'الفرنسية', 'language.name.ru': 'الروسية', 'language.name.ar': 'العربية',
            'common.open': 'فتح', 'common.close': 'إغلاق', 'common.cancel': 'إلغاء', 'common.save': 'حفظ', 'common.edit': 'تعديل', 'common.delete': 'حذف', 'common.remove': 'إزالة', 'common.refresh': 'تحديث', 'common.retry': 'إعادة المحاولة', 'common.previous': 'السابق', 'common.next': 'التالي', 'common.loading': 'جارٍ التحميل…', 'common.search': 'بحث', 'common.filter': 'تصفية', 'common.actions': 'الإجراءات', 'common.status': 'الحالة', 'common.active': 'نشط', 'common.inactive': 'غير نشط', 'common.all': 'الكل', 'common.none': 'لا شيء', 'common.create': 'إنشاء', 'common.update': 'تحديث', 'common.upload': 'رفع', 'common.download': 'تنزيل', 'common.view': 'عرض', 'common.account': 'الحساب', 'common.profile': 'الملف الشخصي', 'common.dashboard': 'لوحة التحكم', 'common.user': 'المستخدم', 'common.users': 'المستخدمون', 'common.role': 'الدور', 'common.email': 'البريد الإلكتروني', 'common.username': 'اسم المستخدم', 'common.password': 'كلمة المرور', 'common.error': 'خطأ', 'common.unavailable': 'غير متاح', 'common.notAvailable': 'غير متاح', 'common.logout': 'تسجيل الخروج',
            'auth.welcome': 'مرحباً بك في بوابة FIU Global', 'auth.signInContinue': 'سجّل الدخول للمتابعة إلى حسابك', 'auth.username': 'اسم المستخدم', 'auth.usernamePlaceholder': 'أدخل اسم المستخدم', 'auth.password': 'كلمة المرور', 'auth.passwordPlaceholder': 'أدخل كلمة المرور', 'auth.signIn': 'تسجيل الدخول', 'auth.signInWithGoogle': 'المتابعة باستخدام Google', 'auth.or': 'أو', 'auth.showPassword': 'إظهار كلمة المرور', 'auth.hidePassword': 'إخفاء كلمة المرور', 'auth.loginRequired': 'يرجى تسجيل الدخول', 'auth.loginRequiredDescription': 'تحتاج إلى تسجيل الدخول للوصول إلى المنصات.', 'auth.goToLogin': 'الانتقال إلى تسجيل الدخول', 'auth.credentialsRequired': 'أدخل اسم المستخدم وكلمة المرور.', 'auth.invalidCredentials': 'بيانات الاعتماد غير صحيحة. تحقق من اسم المستخدم وكلمة المرور.', 'auth.googleUnavailable': 'تعذر إكمال تسجيل الدخول باستخدام Google.',
            'theme.light': 'الوضع الفاتح', 'theme.dark': 'الوضع الداكن',
            'navigation.dashboard': 'لوحة التحكم', 'navigation.chat': 'الدردشة', 'navigation.platforms': 'المنصات', 'navigation.announcements': 'الإعلانات', 'navigation.diningMenu': 'قائمة الطعام', 'navigation.archive': 'الأرشيف', 'navigation.profile': 'الملف الشخصي', 'navigation.faculties': 'الكليات والأقسام', 'navigation.roleAccess': 'صلاحيات الدور', 'navigation.holidays': 'العطلات وأيام الإجازة',
            'portal.welcomeUser': 'مرحباً، {name}', 'portal.selectPlatform': 'اختر منصة', 'portal.choosePlatform': 'اختر إحدى المنصات التالية للوصول إليها:', 'portal.accessPlatform': 'الوصول إلى المنصة', 'portal.directAccess': 'الوصول المباشر', 'portal.campusPortal': 'بوابة الحرم الجامعي', 'portal.yourCampusOrganized': 'حرمك الجامعي منظّم.', 'portal.dashboardDescription': 'يمكنك الوصول إلى الخدمات الأكاديمية وتحديثات الحرم ومعلومات الطعام من لوحة تحكم واضحة واحدة.', 'portal.personalizedForYou': 'مخصّص لك', 'portal.mostAccessed': 'المنصات الأكثر استخداماً', 'portal.quickAccess': 'وصول سريع', 'portal.visit': { zero: '{count} زيارة', one: 'زيارة واحدة', two: 'زيارتان', few: '{count} زيارات', many: '{count} زيارة', other: '{count} زيارة' }, 'portal.service': { zero: 'لا خدمات', one: 'خدمة واحدة', two: 'خدمتان', few: '{count} خدمات', many: '{count} خدمة', other: '{count} خدمة' }, 'portal.pageOf': 'الصفحة {current} من {total}',
            'profile.title': 'ملفي الشخصي', 'profile.description': 'اعرض وحدّث تفاصيل حسابك.', 'profile.studentNumber': 'رقم الطالب', 'profile.firstName': 'الاسم الأول', 'profile.surname': 'اسم العائلة', 'profile.picture': 'صورة الملف الشخصي', 'profile.uploadPicture': 'رفع صورة الملف الشخصي', 'profile.upload': 'رفع', 'profile.faculty': 'الكلية', 'profile.department': 'القسم', 'profile.selectFaculty': 'اختر كلية', 'profile.selectDepartment': 'اختر قسماً', 'profile.chooseFacultyFirst': 'اختر كلية أولاً', 'profile.save': 'حفظ الملف الشخصي', 'profile.changePassword': 'تغيير كلمة المرور', 'profile.currentPassword': 'كلمة المرور الحالية', 'profile.newPassword': 'كلمة المرور الجديدة', 'profile.confirmNewPassword': 'تأكيد كلمة المرور الجديدة', 'profile.showCurrentPassword': 'إظهار كلمة المرور الحالية', 'profile.showNewPassword': 'إظهار كلمة المرور الجديدة', 'profile.showConfirmedPassword': 'إظهار كلمة المرور المؤكدة', 'profile.saved': 'تم حفظ الملف الشخصي.', 'profile.pictureUploaded': 'تم رفع صورة الملف الشخصي.', 'profile.passwordChanged': 'تم تغيير كلمة المرور.', 'profile.passwordMismatch': 'كلمتا المرور الجديدتان غير متطابقتين.', 'profile.unavailable': 'الملف الشخصي غير متاح.', 'profile.uploadHelp': 'JPG أو PNG أو WebP أو GIF، حتى 5 ميجابايت',
            'chat.title': 'تواصل مع الحرم الجامعي', 'chat.description': 'تحدث في الوقت الفعلي مع المدرسين والطلاب.', 'chat.people': 'الأشخاص', 'chat.connecting': 'جارٍ الاتصال…', 'chat.searchPeople': 'البحث عن أشخاص', 'chat.choosePerson': 'اختر شخصاً لبدء الدردشة.', 'chat.messagesAppear': 'ستظهر رسائلك هنا.', 'chat.message': 'رسالة', 'chat.choosePersonFirst': 'اختر شخصاً أولاً…', 'chat.send': 'إرسال', 'chat.noUsers': 'لم يتم العثور على مستخدمين.', 'chat.noMessages': 'لا توجد رسائل بعد', 'chat.unavailable': 'غير متاح', 'chat.live': 'متصل', 'chat.offline': 'غير متصل', 'chat.loadingConversation': 'جارٍ تحميل المحادثة…', 'chat.startConversation': 'ابدأ محادثة مع {name}.', 'chat.unread': { zero: 'لا رسائل غير مقروءة', one: 'رسالة واحدة غير مقروءة', two: 'رسالتان غير مقروءتان', few: '{count} رسائل غير مقروءة', many: '{count} رسالة غير مقروءة', other: '{count} رسالة غير مقروءة' }, 'chat.sent': 'تم الإرسال', 'chat.received': 'تم الاستلام', 'chat.seen': 'تمت المشاهدة',
            'announcements.title': 'الإعلانات', 'announcements.description': 'أحدث الإعلانات من المسؤولين:', 'announcements.loading': 'جارٍ تحميل الإعلانات…', 'announcements.empty': 'لم يتم العثور على إعلانات.', 'announcements.error': 'حدث خطأ أثناء تحميل الإعلانات.',
            'dining.title': 'قائمة الطعام', 'dining.description': 'قائمة الطعام ومواعيد الوجبات:', 'dining.today': 'قائمة اليوم', 'dining.breakfast': 'الإفطار', 'dining.lunch': 'الغداء', 'dining.noMenu': 'لا توجد قائمة', 'dining.noMenuToday': 'لم تتم إضافة قائمة لليوم.', 'dining.noBreakfast': 'قائمة الإفطار غير متاحة', 'dining.noLunch': 'قائمة الغداء غير متاحة', 'dining.loading': 'جارٍ تحميل قائمة الطعام…', 'dining.previousMonth': 'الشهر السابق', 'dining.nextMonth': 'الشهر التالي',
            'notifications.title': 'الإشعارات', 'notifications.loading': 'جارٍ التحميل…', 'notifications.empty': 'لا توجد إشعارات.', 'notifications.error': 'حدث خطأ أثناء تحميل الإشعارات.', 'notifications.deleteConfirm': 'هل تريد حذف هذا الإشعار؟', 'notifications.deleteFailed': 'تعذر حذف الإشعار.',
            'archive.title': 'الأرشيف', 'archive.loadingAccount': 'جارٍ تحميل الحساب…', 'archive.hero': 'تحديثات الحرم الجامعي المؤرشفة', 'archive.description': 'راجع الإعلانات بعد 50 يوماً وقوائم الطعام السابقة المتاحة لحسابك.', 'archive.announcements': 'الإعلانات المؤرشفة', 'archive.dining': 'قوائم الطعام السابقة', 'archive.emptyAnnouncements': 'لا توجد إعلانات مؤرشفة حتى الآن.', 'archive.emptyDining': 'لا توجد قوائم طعام سابقة حتى الآن.', 'archive.weeklyDining': 'قائمة الطعام الأسبوعية', 'archive.item': { zero: 'لا عناصر', one: 'عنصر واحد', two: 'عنصران', few: '{count} عناصر', many: '{count} عنصراً', other: '{count} عنصر' }, 'archive.menu': { zero: 'لا قوائم', one: 'قائمة واحدة', two: 'قائمتان', few: '{count} قوائم', many: '{count} قائمة', other: '{count} قائمة' },
            'validation.unableToLoad': 'تعذر تحميل {resource}.', 'validation.unableToSave': 'تعذر حفظ {resource}.', 'validation.unableToDelete': 'تعذر حذف {resource}.', 'validation.networkError': 'حدث خطأ في الشبكة. يرجى إعادة المحاولة.'
        }
    };

    // Legacy aliases are materialized into every locale because existing main
    // and tour scripts access `window.translations[lang][legacyKey]` directly.
    const legacyAliases = Object.freeze({
        welcome: 'auth.welcome', 'sign-in-continue': 'auth.signInContinue', email: 'auth.username', 'enter-username': 'auth.usernamePlaceholder', password: 'auth.password', 'enter-password': 'auth.passwordPlaceholder', 'sign-in': 'auth.signIn', 'welcome-to-platform': 'common.portalName', 'welcome-user': 'portal.welcomeUser', logout: 'common.logout', 'please-login': 'auth.loginRequired', 'need-login': 'auth.loginRequiredDescription', 'go-to-login': 'auth.goToLogin', 'select-platform': 'portal.selectPlatform', 'choose-platform': 'portal.choosePlatform', 'access-platform': 'portal.accessPlatform', 'direct-access': 'portal.directAccess', Open: 'common.open', notifications: 'notifications.title', 'notifications-loading': 'notifications.loading', 'notifications-none': 'notifications.empty', 'notifications-error': 'notifications.error', 'notifications-delete-confirm': 'notifications.deleteConfirm', 'notifications-delete-failed': 'notifications.deleteFailed', options: 'common.actions', 'light-mode': 'theme.light', 'dark-mode': 'theme.dark', announcements: 'announcements.title', 'announcements-description': 'announcements.description', 'dining-menu': 'dining.title', 'dining-menu-description': 'dining.description', 'tour-notifications-title': 'tour.notifications.title', 'tour-notifications-content': 'tour.notifications.content', 'tour-platforms-title': 'tour.platforms.title', 'tour-platforms-content': 'tour.platforms.content', 'tour-dining-menu-title': 'tour.dining.title', 'tour-dining-menu-content': 'tour.dining.content', 'tour-announcements-title': 'tour.announcements.title', 'tour-announcements-content': 'tour.announcements.content', 'tour-settings-title': 'tour.settings.title', 'tour-settings-content': 'tour.settings.content', 'tour-navigation-title': 'tour.navigation.title', 'tour-navigation-content': 'tour.navigation.content', 'tour-welcome-title': 'tour.welcome.title', 'tour-welcome-content': 'tour.welcome.content', 'tour-previous': 'tour.previous', 'tour-next': 'tour.next', 'tour-finish': 'tour.finish', 'tour-restart': 'tour.restart', 'tour-skip': 'tour.skip'
    });

    // Current HTML uses these semantic names.  Several map to legacy/base
    // labels, while the rest are included here so every static portal key has a
    // real translation in all five shipped locales.
    const markupAliases = Object.freeze({
        'auth.continueWithGoogle': 'auth.signInWithGoogle',
        'auth.logout': 'common.logout',
        'common.loadingAccount': 'archive.loadingAccount',
        'theme.darkMode': 'theme.dark',
        'portal.dashboardTitle': 'portal.yourCampusOrganized',
        'profile.myProfile': 'profile.title',
        'profile.chooseFaculty': 'profile.chooseFacultyFirst',
        'profile.showPassword': 'auth.showPassword',
        'dining.todaysMenu': 'dining.today'
    });

    const staticPortalCatalog = {
        en: {
            'navigation.superAdmin': 'Super Admin', 'navigation.accountMenu': 'Account menu', 'navigation.archiveNavigation': 'Archive navigation', 'navigation.portalNavigation': 'Portal navigation',
            'portal.portal': 'Portal', 'portal.dashboardShortcuts': 'Dashboard shortcuts', 'portal.todayAtCampus': 'Today at campus', 'portal.todayInformation': 'Today’s campus information',
            'platforms.campusAccess': 'Campus access', 'platforms.servicesForDay': 'Services for your day', 'platforms.available': 'Your available platforms', 'platforms.personalized': 'Personalized for you', 'platforms.mostAccessed': 'Most accessed platforms', 'platforms.mostAccessedShort': 'Most accessed', 'platforms.frequentlyUsed': 'Your frequently used services', 'platforms.mostAccessedEmpty': 'Your most frequently opened campus services will appear here.', 'platforms.lmsModules': 'LMS Faculties / Modules',
            'dining.campusDining': 'Campus dining', 'dining.import': 'Import dining menu', 'dining.loadingToday': 'Loading today’s menu…', 'dining.viewFullMenu': 'View full menu',
            'announcements.campusUpdates': 'Campus updates', 'announcements.stayInformed': 'Stay informed', 'announcements.view': 'View announcements',
            'auth.accessStartsHere': 'Your university access starts here', 'auth.portalIntroduction': 'Portal introduction', 'auth.portalIntroductionCopy': 'The platform that redirects you to what you need in your university, providing a secure and professional gateway to campus services, announcements, dining information, and academic platforms.',
            'chat.campusChat': 'Campus chat', 'chat.connect': 'Connect with campus', 'profile.account': 'Account', 'profile.loadingFaculties': 'Loading faculties…',
            'weekday.sun.short': 'Sun', 'weekday.mon.short': 'Mon', 'weekday.tue.short': 'Tue', 'weekday.wed.short': 'Wed', 'weekday.thu.short': 'Thu', 'weekday.fri.short': 'Fri', 'weekday.sat.short': 'Sat'
        },
        tr: {
            'navigation.superAdmin': 'Süper Yönetici', 'navigation.accountMenu': 'Hesap menüsü', 'navigation.archiveNavigation': 'Arşiv gezintisi', 'navigation.portalNavigation': 'Portal gezintisi',
            'portal.portal': 'Portal', 'portal.dashboardShortcuts': 'Gösterge paneli kısayolları', 'portal.todayAtCampus': 'Bugün kampüste', 'portal.todayInformation': 'Bugünün kampüs bilgileri',
            'platforms.campusAccess': 'Kampüs erişimi', 'platforms.servicesForDay': 'Günün hizmetleri', 'platforms.available': 'Kullanabileceğiniz platformlar', 'platforms.personalized': 'Size özel', 'platforms.mostAccessed': 'En çok erişilen platformlar', 'platforms.mostAccessedShort': 'En çok erişilen', 'platforms.frequentlyUsed': 'Sık kullandığınız hizmetler', 'platforms.mostAccessedEmpty': 'En sık açtığınız kampüs hizmetleri burada görünecek.', 'platforms.lmsModules': 'LMS Fakülteleri / Modülleri',
            'dining.campusDining': 'Kampüs yemek hizmetleri', 'dining.import': 'Yemek menüsünü içe aktar', 'dining.loadingToday': 'Bugünün menüsü yükleniyor…', 'dining.viewFullMenu': 'Menünün tamamını görüntüle',
            'announcements.campusUpdates': 'Kampüs güncellemeleri', 'announcements.stayInformed': 'Haberdar olun', 'announcements.view': 'Duyuruları görüntüle',
            'auth.accessStartsHere': 'Üniversite erişiminiz burada başlar', 'auth.portalIntroduction': 'Portal tanıtımı', 'auth.portalIntroductionCopy': 'Üniversitenizde ihtiyacınız olan yere yönlendiren; kampüs hizmetleri, duyurular, yemek bilgileri ve akademik platformlara güvenli ve profesyonel erişim sağlayan platform.',
            'chat.campusChat': 'Kampüs sohbeti', 'chat.connect': 'Kampüsle bağlantı kurun', 'profile.account': 'Hesap', 'profile.loadingFaculties': 'Fakülteler yükleniyor…',
            'weekday.sun.short': 'Paz', 'weekday.mon.short': 'Pzt', 'weekday.tue.short': 'Sal', 'weekday.wed.short': 'Çar', 'weekday.thu.short': 'Per', 'weekday.fri.short': 'Cum', 'weekday.sat.short': 'Cmt'
        },
        fr: {
            'navigation.superAdmin': 'Super administrateur', 'navigation.accountMenu': 'Menu du compte', 'navigation.archiveNavigation': 'Navigation des archives', 'navigation.portalNavigation': 'Navigation du portail',
            'portal.portal': 'Portail', 'portal.dashboardShortcuts': 'Raccourcis du tableau de bord', 'portal.todayAtCampus': 'Aujourd’hui sur le campus', 'portal.todayInformation': 'Informations du campus pour aujourd’hui',
            'platforms.campusAccess': 'Accès au campus', 'platforms.servicesForDay': 'Services pour votre journée', 'platforms.available': 'Vos plateformes disponibles', 'platforms.personalized': 'Personnalisé pour vous', 'platforms.mostAccessed': 'Plateformes les plus consultées', 'platforms.mostAccessedShort': 'Les plus consultées', 'platforms.frequentlyUsed': 'Vos services les plus utilisés', 'platforms.mostAccessedEmpty': 'Vos services de campus les plus consultés apparaîtront ici.', 'platforms.lmsModules': 'Facultés / modules LMS',
            'dining.campusDining': 'Restauration du campus', 'dining.import': 'Importer le menu', 'dining.loadingToday': 'Chargement du menu du jour…', 'dining.viewFullMenu': 'Voir le menu complet',
            'announcements.campusUpdates': 'Actualités du campus', 'announcements.stayInformed': 'Restez informé', 'announcements.view': 'Voir les annonces',
            'auth.accessStartsHere': 'Votre accès à l’université commence ici', 'auth.portalIntroduction': 'Présentation du portail', 'auth.portalIntroductionCopy': 'La plateforme qui vous oriente vers ce dont vous avez besoin à l’université, avec un accès sécurisé et professionnel aux services du campus, aux annonces, à la restauration et aux plateformes académiques.',
            'chat.campusChat': 'Discussion du campus', 'chat.connect': 'Restez en contact avec le campus', 'profile.account': 'Compte', 'profile.loadingFaculties': 'Chargement des facultés…',
            'weekday.sun.short': 'Dim', 'weekday.mon.short': 'Lun', 'weekday.tue.short': 'Mar', 'weekday.wed.short': 'Mer', 'weekday.thu.short': 'Jeu', 'weekday.fri.short': 'Ven', 'weekday.sat.short': 'Sam'
        },
        ru: {
            'navigation.superAdmin': 'Суперадминистратор', 'navigation.accountMenu': 'Меню учётной записи', 'navigation.archiveNavigation': 'Навигация по архиву', 'navigation.portalNavigation': 'Навигация по порталу',
            'portal.portal': 'Портал', 'portal.dashboardShortcuts': 'Ярлыки панели управления', 'portal.todayAtCampus': 'Сегодня в кампусе', 'portal.todayInformation': 'Информация кампуса на сегодня',
            'platforms.campusAccess': 'Доступ к кампусу', 'platforms.servicesForDay': 'Сервисы на день', 'platforms.available': 'Доступные вам платформы', 'platforms.personalized': 'Персонально для вас', 'platforms.mostAccessed': 'Самые посещаемые платформы', 'platforms.mostAccessedShort': 'Самые посещаемые', 'platforms.frequentlyUsed': 'Часто используемые сервисы', 'platforms.mostAccessedEmpty': 'Здесь появятся ваши наиболее часто открываемые сервисы кампуса.', 'platforms.lmsModules': 'Факультеты / модули LMS',
            'dining.campusDining': 'Питание в кампусе', 'dining.import': 'Импортировать меню', 'dining.loadingToday': 'Загрузка меню на сегодня…', 'dining.viewFullMenu': 'Посмотреть полное меню',
            'announcements.campusUpdates': 'Новости кампуса', 'announcements.stayInformed': 'Будьте в курсе', 'announcements.view': 'Просмотреть объявления',
            'auth.accessStartsHere': 'Ваш доступ к университету начинается здесь', 'auth.portalIntroduction': 'О портале', 'auth.portalIntroductionCopy': 'Платформа направляет вас к нужным университетским ресурсам, предоставляя безопасный и профессиональный доступ к сервисам кампуса, объявлениям, информации о питании и академическим платформам.',
            'chat.campusChat': 'Чат кампуса', 'chat.connect': 'Общайтесь с кампусом', 'profile.account': 'Учётная запись', 'profile.loadingFaculties': 'Загрузка факультетов…',
            'weekday.sun.short': 'Вс', 'weekday.mon.short': 'Пн', 'weekday.tue.short': 'Вт', 'weekday.wed.short': 'Ср', 'weekday.thu.short': 'Чт', 'weekday.fri.short': 'Пт', 'weekday.sat.short': 'Сб'
        },
        ar: {
            'navigation.superAdmin': 'المسؤول الأعلى', 'navigation.accountMenu': 'قائمة الحساب', 'navigation.archiveNavigation': 'تنقل الأرشيف', 'navigation.portalNavigation': 'تنقل البوابة',
            'portal.portal': 'البوابة', 'portal.dashboardShortcuts': 'اختصارات لوحة التحكم', 'portal.todayAtCampus': 'اليوم في الحرم الجامعي', 'portal.todayInformation': 'معلومات الحرم الجامعي اليوم',
            'platforms.campusAccess': 'الوصول إلى الحرم الجامعي', 'platforms.servicesForDay': 'خدمات ليومك', 'platforms.available': 'منصاتك المتاحة', 'platforms.personalized': 'مخصّص لك', 'platforms.mostAccessed': 'المنصات الأكثر استخداماً', 'platforms.mostAccessedShort': 'الأكثر استخداماً', 'platforms.frequentlyUsed': 'خدماتك المستخدمة كثيراً', 'platforms.mostAccessedEmpty': 'ستظهر هنا خدمات الحرم الجامعي التي تفتحها كثيراً.', 'platforms.lmsModules': 'كليات / وحدات LMS',
            'dining.campusDining': 'طعام الحرم الجامعي', 'dining.import': 'استيراد قائمة الطعام', 'dining.loadingToday': 'جارٍ تحميل قائمة اليوم…', 'dining.viewFullMenu': 'عرض القائمة الكاملة',
            'announcements.campusUpdates': 'تحديثات الحرم الجامعي', 'announcements.stayInformed': 'ابقَ على اطلاع', 'announcements.view': 'عرض الإعلانات',
            'auth.accessStartsHere': 'يبدأ وصولك إلى الجامعة من هنا', 'auth.portalIntroduction': 'مقدمة البوابة', 'auth.portalIntroductionCopy': 'منصة توجّهك إلى ما تحتاج إليه في الجامعة، وتوفر بوابة آمنة واحترافية لخدمات الحرم والإعلانات ومعلومات الطعام والمنصات الأكاديمية.',
            'chat.campusChat': 'دردشة الحرم الجامعي', 'chat.connect': 'تواصل مع الحرم الجامعي', 'profile.account': 'الحساب', 'profile.loadingFaculties': 'جارٍ تحميل الكليات…',
            'weekday.sun.short': 'الأحد', 'weekday.mon.short': 'الاثنين', 'weekday.tue.short': 'الثلاثاء', 'weekday.wed.short': 'الأربعاء', 'weekday.thu.short': 'الخميس', 'weekday.fri.short': 'الجمعة', 'weekday.sat.short': 'السبت'
        }
    };

    const state = { language: DEFAULT_LANGUAGE, domReady: document.readyState !== 'loading', controlsBound: false, syncRequest: null };

    function normaliseLanguage(value) {
        const language = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
        return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
    }

    function safeStorageGet(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } }
    function safeStorageSet(key, value) { try { window.localStorage.setItem(key, value); } catch (_) { /* private storage can be disabled */ } }

    function readCookie(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        return document.cookie.split(';').map(item => item.trim()).reduce((found, item) => {
            if (found || !item.startsWith(prefix)) return found;
            try { return decodeURIComponent(item.slice(prefix.length)); } catch (_) { return item.slice(prefix.length); }
        }, '');
    }

    function writeLanguageCookie(language) {
        document.cookie = `${encodeURIComponent(COOKIE_NAME)}=${encodeURIComponent(language)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }

    function readStoredLanguage() {
        return safeStorageGet(LEGACY_STORAGE_KEY) || safeStorageGet(STORAGE_KEY) || readCookie(COOKIE_NAME) || document.documentElement.lang || DEFAULT_LANGUAGE;
    }

    function isPlainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
    function isPluralObject(value) { return isPlainObject(value) && ['zero', 'one', 'two', 'few', 'many', 'other'].some(key => Object.prototype.hasOwnProperty.call(value, key)); }

    function getValue(catalog, key) {
        if (!catalog || !key) return undefined;
        if (Object.prototype.hasOwnProperty.call(catalog, key)) return catalog[key];
        return String(key).split('.').reduce((value, segment) => isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, segment) ? value[segment] : undefined, catalog);
    }

    function mergeObjects(target, source) {
        if (!isPlainObject(source)) return target;
        Object.entries(source).forEach(([key, value]) => {
            if (isPlainObject(value) && isPlainObject(target[key]) && !isPluralObject(value)) mergeObjects(target[key], value);
            else target[key] = value;
        });
        return target;
    }

    function applyLegacyAliases() {
        SUPPORTED_LANGUAGES.forEach(language => {
            const catalog = translations[language] || (translations[language] = {});
            Object.entries(legacyAliases).forEach(([legacy, canonical]) => {
                const value = getValue(catalog, canonical) ?? getValue(translations.en, canonical);
                if (value !== undefined) catalog[legacy] = value;
            });
            Object.entries(markupAliases).forEach(([markupKey, canonical]) => {
                const value = getValue(catalog, canonical) ?? getValue(translations.en, canonical);
                if (value !== undefined) catalog[markupKey] = value;
            });
            catalog.copyright = `© 2025 ${getValue(catalog, 'common.portalName') || getValue(translations.en, 'common.portalName')}`;
        });
    }

    function mergeBuiltInPortalCatalog() {
        SUPPORTED_LANGUAGES.forEach(language => {
            translations[language] = translations[language] || {};
            mergeObjects(translations[language], staticPortalCatalog[language] || {});
        });
    }

    function lookup(key, language = state.language) {
        const canonical = legacyAliases[key] || markupAliases[key] || key;
        return getValue(translations[language], canonical) ?? getValue(translations.en, canonical);
    }

    function formatTemplate(value, params) {
        if (typeof value !== 'string') return value;
        return value.replace(/\{([\w.-]+)\}/g, (match, name) => params?.[name] === undefined || params[name] === null ? match : String(params[name]));
    }

    function choosePlural(value, params, language) {
        if (!isPluralObject(value)) return value;
        const count = Number(params?.count);
        const category = Number.isFinite(count) ? new Intl.PluralRules(LOCALES[language] || LOCALES.en).select(count) : 'other';
        return value[category] ?? value.other ?? value.one ?? '';
    }

    /** Translate a key, with an English literal fallback for staged markup. */
    function t(key, params, fallback) {
        const variables = isPlainObject(params) ? params : {};
        const fallbackText = typeof params === 'string' && fallback === undefined ? params : fallback;
        const translated = choosePlural(lookup(key), variables, state.language);
        if (typeof translated === 'string') return formatTemplate(translated, variables);
        if (fallbackText !== undefined && fallbackText !== null && fallbackText !== '') return formatTemplate(String(fallbackText), variables);
        return String(key || '');
    }

    function formatPlural(key, count, params, fallback) { return t(key, { ...(isPlainObject(params) ? params : {}), count }, fallback); }

    function parseDate(value) {
        if (value instanceof Date) return new Date(value.getTime());
        if (typeof value === 'string') {
            const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        }
        return new Date(value);
    }

    function formatDate(value, options) {
        const date = parseDate(value);
        if (Number.isNaN(date.getTime())) return String(value ?? '');
        return new Intl.DateTimeFormat(LOCALES[state.language] || LOCALES.en, isPlainObject(options) ? options : { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    }

    function formatDateTime(value, options) {
        const date = parseDate(value);
        if (Number.isNaN(date.getTime())) return String(value ?? '');
        return new Intl.DateTimeFormat(LOCALES[state.language] || LOCALES.en, isPlainObject(options) ? options : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function formatNumber(value, options) {
        const number = Number(value);
        return Number.isFinite(number) ? new Intl.NumberFormat(LOCALES[state.language] || LOCALES.en, isPlainObject(options) ? options : undefined).format(number) : String(value ?? '');
    }

    /** Prefer a backend translation key, then retain legacy server text safely. */
    function localizeApiMessage(payload, fallback, params) {
        const source = isPlainObject(payload) ? payload : {};
        const key = source.message_key || source.error_key || source.translation_key || source.key;
        const args = source.message_args || source.error_args || source.translation_args || source.args || params || {};
        if (key) return t(key, args, fallback || source.message || source.error || '');
        if (source.message || source.error) return String(source.message || source.error);
        if (!fallback) return '';
        return lookup(fallback) !== undefined ? t(fallback, params) : String(fallback);
    }

    function applyDocumentLanguage(language) {
        const rtl = RTL_LANGUAGES.has(language);
        document.documentElement.lang = language;
        document.documentElement.dir = rtl ? 'rtl' : 'ltr';
        document.documentElement.dataset.language = language;
        if (document.body) {
            document.body.classList.toggle('rtl', rtl);
            document.body.classList.toggle('ltr', !rtl);
        }
    }

    function setText(element, value, legacy) {
        if (!value) return;
        const buttonInput = element.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(String(element.type).toLowerCase());
        if ((legacy && element.hasAttribute('placeholder')) || element.hasAttribute('data-i18n-placeholder')) {
            if (element.getAttribute('placeholder') !== value) element.setAttribute('placeholder', value);
        } else if (buttonInput || (legacy && element.hasAttribute('value'))) {
            if (element.value !== value) element.value = value;
        } else if (element.textContent !== value) {
            element.textContent = value;
        }
    }

    function translateAttribute(element, sourceAttribute, targetAttribute) {
        const key = element.getAttribute(sourceAttribute);
        if (!key) return;
        const fallback = element.getAttribute(`${sourceAttribute}-fallback`) || element.getAttribute('data-i18n-fallback');
        const value = t(key, {}, fallback);
        if (value && element.getAttribute(targetAttribute) !== value) element.setAttribute(targetAttribute, value);
    }

    function refreshLanguageControls(scope = document) {
        const language = state.language;
        const name = t(`language.name.${language}`, {}, language.toUpperCase());
        scope.querySelectorAll('#current-language, [data-current-language]').forEach(element => { if (element.textContent !== name) element.textContent = name; });
        scope.querySelectorAll('#admin-language-switch, [data-language-select]').forEach(select => {
            if (select.value !== language) select.value = language;
            select.querySelectorAll('option[value]').forEach(option => {
                const label = t(`language.name.${normaliseLanguage(option.value)}`, {}, option.textContent);
                if (option.textContent !== label) option.textContent = label;
            });
        });
        scope.querySelectorAll('#language-btn, [data-language-button]').forEach(button => button.setAttribute('aria-label', t('language.label')));
    }

    /** Translate declarative text and attribute keys inside a page or fragment. */
    function translatePage(root = document) {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        const elements = [];
        if (window.Element && scope instanceof window.Element && scope.matches('[data-i18n], [data-translate]')) elements.push(scope);
        scope.querySelectorAll('[data-i18n], [data-translate]').forEach(element => elements.push(element));
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n') || element.getAttribute('data-translate');
            const fallback = element.getAttribute('data-i18n-fallback');
            const value = t(key, {}, fallback);
            // A legacy label should remain visible if a third-party key was not
            // registered yet; new markup supplies its own fallback instead.
            if (value !== key || fallback) setText(element, value, element.hasAttribute('data-translate') && !element.hasAttribute('data-i18n'));
        });
        [['data-i18n-placeholder', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label'], ['data-i18n-alt', 'alt'], ['data-i18n-value', 'value']]
            .forEach(([source, target]) => scope.querySelectorAll(`[${source}]`).forEach(element => translateAttribute(element, source, target)));
        scope.querySelectorAll('[data-i18n-attr]').forEach(element => String(element.getAttribute('data-i18n-attr') || '').split(',').forEach(pair => {
            const [attribute, key] = pair.split(':').map(value => value.trim());
            if (!attribute || !key) return;
            const value = t(key, {}, element.getAttribute('data-i18n-fallback'));
            if (value && element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
        }));
        refreshLanguageControls(scope);
        return scope;
    }

    function findLanguageDropdown(button) {
        const owner = button.closest('.language-switcher, .language-selector, .user-dropdown') || button.parentElement;
        return owner?.querySelector('.language-dropdown') || document.getElementById('language-dropdown');
    }

    function closeLanguageDropdowns(except) {
        document.querySelectorAll('.language-dropdown.show').forEach(dropdown => { if (dropdown !== except) dropdown.classList.remove('show'); });
    }

    function bindLanguageControls() {
        if (state.controlsBound) return;
        state.controlsBound = true;
        document.addEventListener('click', event => {
            const option = event.target.closest('.language-option[data-lang], [data-language-option][data-lang]');
            if (option) {
                event.preventDefault();
                setLanguage(option.getAttribute('data-lang'));
                closeLanguageDropdowns();
                return;
            }
            const button = event.target.closest('#language-btn, [data-language-button]');
            if (button) {
                event.preventDefault();
                const dropdown = findLanguageDropdown(button);
                if (!dropdown) return;
                const open = !dropdown.classList.contains('show');
                closeLanguageDropdowns(open ? dropdown : undefined);
                dropdown.classList.toggle('show', open);
                button.setAttribute('aria-expanded', String(open));
                return;
            }
            if (!event.target.closest('.language-switcher, .language-selector')) closeLanguageDropdowns();
        });
        document.addEventListener('change', event => {
            const select = event.target.closest('#admin-language-switch, [data-language-select]');
            if (select) setLanguage(select.value);
        });
    }

    function ensureSharedStyles() {
        if (document.querySelector('link[data-fiu-i18n-styles]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/i18n.css?v=1';
        link.dataset.fiuI18nStyles = 'true';
        document.head.appendChild(link);
    }

    function persistLanguage(language) {
        safeStorageSet(STORAGE_KEY, language);
        safeStorageSet(LEGACY_STORAGE_KEY, language);
        writeLanguageCookie(language);
    }

    // New .NET builds provide this endpoint. Writing the same cookie above
    // keeps switching functional on static previews and older deployments.
    function syncLanguageCookie(language) {
        if (typeof window.fetch !== 'function') return Promise.resolve(false);
        const request = window.fetch('/auth/language', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ language })
        }).then(response => response.ok).catch(() => false);
        state.syncRequest = request;
        return request;
    }

    function setLanguage(language, options = {}) {
        const nextLanguage = normaliseLanguage(language);
        const previousLanguage = state.language;
        state.language = nextLanguage;
        if (options.persist !== false) persistLanguage(nextLanguage);
        applyDocumentLanguage(nextLanguage);
        if (state.domReady) {
            ensureSharedStyles();
            translatePage();
            bindLanguageControls();
        }
        if (options.sync !== false) void syncLanguageCookie(nextLanguage);
        if (options.dispatch !== false && (previousLanguage !== nextLanguage || options.forceEvent)) {
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: nextLanguage, previousLanguage, source: 'FiuGlobal.I18n' } }));
        }
        return nextLanguage;
    }

    function getLanguage() { return state.language; }

    /** Merge a flat or nested page catalogue without replacing existing keys. */
    function registerTranslations(catalog, options = {}) {
        if (!isPlainObject(catalog)) return translations;
        Object.entries(catalog).forEach(([locale, messages]) => {
            const language = normaliseLanguage(locale);
            translations[language] = translations[language] || {};
            mergeObjects(translations[language], messages);
        });
        mergeBuiltInPortalCatalog();
        applyLegacyAliases();
        if (state.domReady && options.apply !== false) translatePage();
        return translations;
    }

    mergeBuiltInPortalCatalog();
    applyLegacyAliases();
    state.language = normaliseLanguage(readStoredLanguage());
    window.translations = translations;
    window.t = t;
    window.translatePage = translatePage;
    window.formatDate = formatDate;
    window.formatDateTime = formatDateTime;
    window.formatNumber = formatNumber;
    window.formatPlural = formatPlural;
    window.localizeApiMessage = localizeApiMessage;
    window.setLanguage = setLanguage;
    window.getLanguage = getLanguage;
    window.registerTranslations = registerTranslations;
    window.FiuGlobal = window.FiuGlobal || {};
    window.FiuGlobal.I18n = { cookieName: COOKIE_NAME, defaultLanguage: DEFAULT_LANGUAGE, supportedLanguages: SUPPORTED_LANGUAGES, getLanguage, setLanguage, t, translatePage, formatDate, formatDateTime, formatNumber, formatPlural, localizeApiMessage, registerTranslations, syncLanguageCookie };

    // A page may declare a feature catalogue before this runtime, or add one
    // later through registerTranslations().
    if (isPlainObject(window.FIU_I18N_CATALOG)) registerTranslations(window.FIU_I18N_CATALOG, { apply: false });
    applyDocumentLanguage(state.language);

    function initialiseDom() {
        state.domReady = true;
        applyDocumentLanguage(state.language);
        ensureSharedStyles();
        translatePage();
        bindLanguageControls();
    }

    if (state.domReady) initialiseDom();
    else document.addEventListener('DOMContentLoaded', initialiseDom, { once: true });

    // Honour older admin-shell code that stored the selected value and emitted
    // languageChanged itself before it is migrated to setLanguage().
    window.addEventListener('languageChanged', event => {
        const requested = normaliseLanguage(event.detail?.language || readStoredLanguage());
        if (requested !== state.language) setLanguage(requested, { sync: false, dispatch: false });
    });
})(window, document);
