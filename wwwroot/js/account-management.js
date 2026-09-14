(function () {
    const api = () => (window.APP_CONFIG && window.APP_CONFIG.ADMIN_API_BASE_URL) || window.ADMIN_API_BASE_URL || '/database/admin_api.php';
    let editingUserId = null;

    const ACCOUNT_TRANSLATIONS = {
        en: {
            'admin.action.cancel': 'Cancel', 'admin.action.save': 'Save', 'admin.action.edit': 'Edit', 'admin.action.delete': 'Delete',
            'admin.action.previous': 'Previous', 'admin.action.next': 'Next', 'admin.action.pageOf': 'Page {current} of {total}',
            'admin.common.studentNumber': 'Student number', 'admin.common.name': 'Name', 'admin.common.username': 'Username',
            'admin.common.password': 'Password', 'admin.common.active': 'Active', 'admin.common.inactive': 'Inactive',
            'admin.role.student': 'Student', 'admin.role.instructor': 'Instructor', 'admin.role.admin': 'Administrator',
            'admin.account.searchHolidays': 'Search date, day, holiday, type, or status…', 'admin.account.date': 'Date',
            'admin.account.day': 'Day', 'admin.account.holiday': 'Holiday', 'admin.account.type': 'Type', 'admin.account.status': 'Status',
            'admin.account.actions': 'Actions', 'admin.account.noHolidays': 'No holidays match this search.',
            'admin.account.holidayCount.one': '{count} holiday', 'admin.account.holidayCount.other': '{count} holidays',
            'admin.account.editHoliday': 'Edit {name}', 'admin.account.deleteHoliday': 'Delete {name}',
            'admin.account.type.holiday': 'Holiday', 'admin.account.type.weekend': 'Weekend', 'admin.account.type.closure': 'Closure', 'admin.account.type.custom': 'Custom',
            'admin.account.create': 'Create', 'admin.account.createUser': 'Create User', 'admin.account.addEditAdmin': 'Add / Edit Admin',
            'admin.account.addUserInstructor': 'Add User / Instructor', 'admin.account.editUserInstructor': 'Edit User / Instructor',
            'admin.account.temporaryPassword': 'Temporary password', 'admin.account.passwordForNew': 'Required for new users',
            'admin.account.createAccount': 'Create Account', 'admin.account.saveAccount': 'Save Account',
            'admin.account.filterRole': 'Filter {role} by number, name, email…', 'admin.account.roleAccounts': '{role} accounts',
            'admin.account.noRoleAccounts': 'No {role} accounts match this filter.',
            'admin.account.accountCount.one': '{count} account', 'admin.account.accountCount.other': '{count} accounts',
            'admin.account.saved': 'Account saved successfully', 'admin.account.saveError': 'Unable to save account',
            'admin.account.created': 'Account created successfully', 'admin.account.createError': 'Unable to create account',
            'admin.account.deleteConfirm': 'Delete this user account?', 'admin.account.deleted': 'User deleted successfully', 'admin.account.deleteError': 'Unable to delete user',
            'admin.profile.close': 'Close profile', 'admin.profile.pictureAlt': 'Profile picture', 'admin.profile.title': 'My profile',
            'admin.profile.description': 'Manage your administrator details.', 'admin.profile.firstName': 'First name', 'admin.profile.surname': 'Surname',
            'admin.profile.picture': 'Profile picture', 'admin.profile.imageRequirements': 'JPG, PNG, WebP, or GIF, up to 5 MB',
            'admin.profile.faculty': 'Faculty', 'admin.profile.department': 'Department', 'admin.profile.selectFaculty': 'Select a faculty',
            'admin.profile.selectDepartment': 'Select a department', 'admin.profile.selectFacultyFirst': 'Select a faculty first',
            'admin.profile.inactiveSuffix': '(inactive)', 'admin.profile.save': 'Save profile', 'admin.profile.changePassword': 'Change password',
            'admin.profile.currentPassword': 'Current password', 'admin.profile.newPassword': 'New password', 'admin.profile.confirmPassword': 'Confirm new password',
            'admin.profile.showPassword': 'Show {field}', 'admin.profile.hidePassword': 'Hide {field}',
            'admin.profile.loadError': 'Unable to load profile.', 'admin.profile.directoryLoadError': 'Unable to load the faculty directory.',
            'admin.profile.pictureUploadError': 'Unable to upload picture.', 'admin.profile.pictureUploaded': 'Profile picture uploaded.',
            'admin.profile.saved': 'Profile saved.', 'admin.profile.saveError': 'Unable to save profile.',
            'admin.profile.passwordMismatch': 'New passwords do not match.', 'admin.profile.passwordChanged': 'Password changed.', 'admin.profile.passwordChangeError': 'Unable to change password.',
            'admin.access.roleAccess': 'Role access', 'admin.access.intro': 'Control the common dashboard, platform services, and section parts for one account—or apply the same policy to all roles or all users.',
            'admin.access.addRole': 'Add role', 'admin.access.excelTemplate': 'Excel template', 'admin.access.importExcel': 'Import Excel',
            'admin.access.newRole': 'New role name', 'admin.access.roleExample': 'For example: faculty coordinator', 'admin.access.createRole': 'Create role',
            'admin.access.roleToAssign': 'Role to assign', 'admin.access.roleHelp': 'Choose a role or apply one policy to every role.',
            'admin.access.user': 'User', 'admin.access.userHelp': 'Choose a user or apply one policy to every user.',
            'admin.access.userPermissions': 'User permissions', 'admin.access.roleDefaults': 'Role section defaults',
            'admin.access.roleCreated': 'Role created. You can now assign it to any user.', 'admin.access.createRoleError': 'Unable to create role.',
            'admin.access.loadError': 'Unable to load role access data.', 'admin.access.allRoles': 'All roles', 'admin.access.allUsers': 'All users',
            'admin.access.noUsers': 'No users available.', 'admin.access.coreSummary': 'Core: Dashboard, Chat, and Profile',
            'admin.access.dashboardShows': 'Dashboard shows: {sections}', 'admin.access.dashboardCoreOnly': 'Dashboard core overview only',
            'admin.access.noOptionalSections': 'No optional sections yet', 'admin.access.selectedUser': 'Selected user',
            'admin.access.sharedDefaults': 'Shared defaults for every role in the portal.', 'admin.access.commonPolicy': 'A common access policy for every user account.',
            'admin.access.noStudentNumber': 'No student number', 'admin.access.currentRole': 'current role: {role}',
            'admin.access.bulk': 'Bulk access', 'admin.access.assignRole': 'Assign {role}', 'admin.access.coreAvailable': 'Core access is always available.',
            'admin.access.commonDashboard': 'Common dashboard', 'admin.access.shows': 'Shows: {sections}',
            'admin.access.defaultSections': 'Platforms, Announcements, and Dining menu by default',
            'admin.access.chatDetails': 'Chat: real-time people and conversations', 'admin.access.profileDetails': 'Profile: account details and password controls',
            'admin.access.saveUser': 'Save for this user', 'admin.access.applyAllRoles': 'Apply to all roles',
            'admin.access.applyRoleUsers': 'Apply to all {role} users', 'admin.access.applyAllUsers': 'Apply to all users',
            'admin.access.chooseAccess': 'Choose access', 'admin.access.chooseSectionParts': 'Select exactly which parts of this section the user may use.',
            'admin.access.diningIncluded': 'Dining menu viewing is included. Choose optional import or remove actions.',
            'admin.access.noParts': 'No parts are available for this section.', 'admin.access.applyAccess': 'Apply access',
            'admin.access.choosePartsError': 'Choose which parts of {section} to grant.', 'admin.access.viewDiningOnly': 'View dining menu only',
            'admin.access.chooseSectionAccess': 'Choose {section} access', 'admin.access.viewAnnouncements': 'View announcements',
            'admin.access.importDining': 'Import dining menu', 'admin.access.removeDining': 'Remove dining menu',
            'admin.access.viewNotifications': 'View notifications', 'admin.access.markNotificationsRead': 'Mark notifications as read', 'admin.access.view': 'View',
            'admin.access.platforms': 'Platforms', 'admin.access.announcements': 'Announcements', 'admin.access.diningMenu': 'Dining menu', 'admin.access.notifications': 'Notifications',
            'admin.access.chooseUserError': 'Choose a specific user before saving an individual policy.', 'admin.access.saved': 'Role and section access saved.',
            'admin.access.saveError': 'Unable to save role access.', 'admin.access.appliedRole': 'Access applied to all users with this role.',
            'admin.access.applyError': 'Unable to apply role access.', 'admin.access.confirmAllRoles': 'Apply this dashboard, section, and platform policy to every role?',
            'admin.access.appliedAllRoles': 'Access applied to all roles.', 'admin.access.confirmAllUsers': 'Apply this dashboard, section, and platform policy to every user account?',
            'admin.access.appliedAllUsers': 'Access applied to all users.', 'admin.access.importFailed': 'Import failed.', 'admin.access.importInvalid': 'Import failed. Please check the file format.'
        },
        tr: {
            'admin.action.cancel': 'İptal', 'admin.action.save': 'Kaydet', 'admin.action.edit': 'Düzenle', 'admin.action.delete': 'Sil',
            'admin.action.previous': 'Önceki', 'admin.action.next': 'Sonraki', 'admin.action.pageOf': 'Sayfa {current} / {total}',
            'admin.common.studentNumber': 'Öğrenci numarası', 'admin.common.name': 'Ad', 'admin.common.username': 'Kullanıcı adı',
            'admin.common.password': 'Şifre', 'admin.common.active': 'Etkin', 'admin.common.inactive': 'Etkin değil',
            'admin.role.student': 'Öğrenci', 'admin.role.instructor': 'Öğretim elemanı', 'admin.role.admin': 'Yönetici',
            'admin.account.searchHolidays': 'Tarih, gün, tatil, tür veya duruma göre ara…', 'admin.account.date': 'Tarih',
            'admin.account.day': 'Gün', 'admin.account.holiday': 'Tatil', 'admin.account.type': 'Tür', 'admin.account.status': 'Durum',
            'admin.account.actions': 'İşlemler', 'admin.account.noHolidays': 'Bu aramayla eşleşen tatil yok.',
            'admin.account.holidayCount.other': '{count} tatil', 'admin.account.editHoliday': '{name} tatilini düzenle', 'admin.account.deleteHoliday': '{name} tatilini sil',
            'admin.account.type.holiday': 'Tatil', 'admin.account.type.weekend': 'Hafta sonu', 'admin.account.type.closure': 'Kapanış', 'admin.account.type.custom': 'Özel',
            'admin.account.create': 'Oluştur', 'admin.account.createUser': 'Kullanıcı Oluştur', 'admin.account.addEditAdmin': 'Yönetici Ekle / Düzenle',
            'admin.account.addUserInstructor': 'Kullanıcı / Öğretim Elemanı Ekle', 'admin.account.editUserInstructor': 'Kullanıcı / Öğretim Elemanını Düzenle',
            'admin.account.temporaryPassword': 'Geçici şifre', 'admin.account.passwordForNew': 'Yeni kullanıcılar için zorunludur',
            'admin.account.createAccount': 'Hesap Oluştur', 'admin.account.saveAccount': 'Hesabı Kaydet',
            'admin.account.filterRole': '{role} için numara, ad veya e-postaya göre filtrele…', 'admin.account.roleAccounts': '{role} hesapları',
            'admin.account.noRoleAccounts': 'Bu filtreyle eşleşen {role} hesabı yok.', 'admin.account.accountCount.other': '{count} hesap',
            'admin.account.saved': 'Hesap başarıyla kaydedildi', 'admin.account.saveError': 'Hesap kaydedilemedi',
            'admin.account.created': 'Hesap başarıyla oluşturuldu', 'admin.account.createError': 'Hesap oluşturulamadı',
            'admin.account.deleteConfirm': 'Bu kullanıcı hesabı silinsin mi?', 'admin.account.deleted': 'Kullanıcı başarıyla silindi', 'admin.account.deleteError': 'Kullanıcı silinemedi',
            'admin.profile.close': 'Profili kapat', 'admin.profile.pictureAlt': 'Profil resmi', 'admin.profile.title': 'Profilim',
            'admin.profile.description': 'Yönetici bilgilerinizi yönetin.', 'admin.profile.firstName': 'Ad', 'admin.profile.surname': 'Soyad',
            'admin.profile.picture': 'Profil resmi', 'admin.profile.imageRequirements': 'JPG, PNG, WebP veya GIF; en fazla 5 MB',
            'admin.profile.faculty': 'Fakülte', 'admin.profile.department': 'Bölüm', 'admin.profile.selectFaculty': 'Bir fakülte seçin',
            'admin.profile.selectDepartment': 'Bir bölüm seçin', 'admin.profile.selectFacultyFirst': 'Önce bir fakülte seçin',
            'admin.profile.inactiveSuffix': '(etkin değil)', 'admin.profile.save': 'Profili kaydet', 'admin.profile.changePassword': 'Şifre değiştir',
            'admin.profile.currentPassword': 'Mevcut şifre', 'admin.profile.newPassword': 'Yeni şifre', 'admin.profile.confirmPassword': 'Yeni şifreyi onaylayın',
            'admin.profile.showPassword': '{field} alanını göster', 'admin.profile.hidePassword': '{field} alanını gizle',
            'admin.profile.loadError': 'Profil yüklenemedi.', 'admin.profile.directoryLoadError': 'Fakülte dizini yüklenemedi.',
            'admin.profile.pictureUploadError': 'Resim yüklenemedi.', 'admin.profile.pictureUploaded': 'Profil resmi yüklendi.',
            'admin.profile.saved': 'Profil kaydedildi.', 'admin.profile.saveError': 'Profil kaydedilemedi.',
            'admin.profile.passwordMismatch': 'Yeni şifreler eşleşmiyor.', 'admin.profile.passwordChanged': 'Şifre değiştirildi.', 'admin.profile.passwordChangeError': 'Şifre değiştirilemedi.',
            'admin.access.roleAccess': 'Rol erişimi', 'admin.access.intro': 'Bir hesap için ortak gösterge panelini, platform hizmetlerini ve bölüm parçalarını yönetin ya da aynı ilkeyi tüm rollere veya tüm kullanıcılara uygulayın.',
            'admin.access.addRole': 'Rol ekle', 'admin.access.excelTemplate': 'Excel şablonu', 'admin.access.importExcel': 'Excel içe aktar',
            'admin.access.newRole': 'Yeni rol adı', 'admin.access.roleExample': 'Örnek: fakülte koordinatörü', 'admin.access.createRole': 'Rol oluştur',
            'admin.access.roleToAssign': 'Atanacak rol', 'admin.access.roleHelp': 'Bir rol seçin veya tek ilkeden tüm rollere uygulayın.',
            'admin.access.user': 'Kullanıcı', 'admin.access.userHelp': 'Bir kullanıcı seçin veya tek ilkeden tüm kullanıcılara uygulayın.',
            'admin.access.userPermissions': 'Kullanıcı izinleri', 'admin.access.roleDefaults': 'Rol bölüm varsayılanları',
            'admin.access.roleCreated': 'Rol oluşturuldu. Artık herhangi bir kullanıcıya atayabilirsiniz.', 'admin.access.createRoleError': 'Rol oluşturulamadı.',
            'admin.access.loadError': 'Rol erişim verileri yüklenemedi.', 'admin.access.allRoles': 'Tüm roller', 'admin.access.allUsers': 'Tüm kullanıcılar',
            'admin.access.noUsers': 'Kullanıcı yok.', 'admin.access.coreSummary': 'Temel: Gösterge Paneli, Sohbet ve Profil',
            'admin.access.dashboardShows': 'Gösterge panelinde gösterilenler: {sections}', 'admin.access.dashboardCoreOnly': 'Yalnızca temel gösterge paneli özeti',
            'admin.access.noOptionalSections': 'Henüz isteğe bağlı bölüm yok', 'admin.access.selectedUser': 'Seçili kullanıcı',
            'admin.access.sharedDefaults': 'Portaldaki her rol için ortak varsayılanlar.', 'admin.access.commonPolicy': 'Her kullanıcı hesabı için ortak erişim ilkesi.',
            'admin.access.noStudentNumber': 'Öğrenci numarası yok', 'admin.access.currentRole': 'mevcut rol: {role}',
            'admin.access.bulk': 'Toplu erişim', 'admin.access.assignRole': '{role} rolünü ata', 'admin.access.coreAvailable': 'Temel erişim her zaman kullanılabilir.',
            'admin.access.commonDashboard': 'Ortak gösterge paneli', 'admin.access.shows': 'Gösterilenler: {sections}',
            'admin.access.defaultSections': 'Varsayılan olarak Platformlar, Duyurular ve Yemek menüsü',
            'admin.access.chatDetails': 'Sohbet: gerçek zamanlı kişiler ve konuşmalar', 'admin.access.profileDetails': 'Profil: hesap bilgileri ve şifre kontrolleri',
            'admin.access.saveUser': 'Bu kullanıcı için kaydet', 'admin.access.applyAllRoles': 'Tüm rollere uygula',
            'admin.access.applyRoleUsers': 'Tüm {role} kullanıcılarına uygula', 'admin.access.applyAllUsers': 'Tüm kullanıcılara uygula',
            'admin.access.chooseAccess': 'Erişimi seçin', 'admin.access.chooseSectionParts': 'Kullanıcının kullanabileceği bu bölümün parçalarını tam olarak seçin.',
            'admin.access.diningIncluded': 'Yemek menüsünü görüntüleme dahildir. İsteğe bağlı içe aktarma veya kaldırma eylemlerini seçin.',
            'admin.access.noParts': 'Bu bölüm için kullanılabilir parça yok.', 'admin.access.applyAccess': 'Erişimi uygula',
            'admin.access.choosePartsError': 'Verilecek {section} parçalarını seçin.', 'admin.access.viewDiningOnly': 'Yalnızca yemek menüsünü görüntüle',
            'admin.access.chooseSectionAccess': '{section} erişimini seçin', 'admin.access.viewAnnouncements': 'Duyuruları görüntüle',
            'admin.access.importDining': 'Yemek menüsünü içe aktar', 'admin.access.removeDining': 'Yemek menüsünü kaldır',
            'admin.access.viewNotifications': 'Bildirimleri görüntüle', 'admin.access.markNotificationsRead': 'Bildirimleri okundu işaretle', 'admin.access.view': 'Görüntüle',
            'admin.access.platforms': 'Platformlar', 'admin.access.announcements': 'Duyurular', 'admin.access.diningMenu': 'Yemek menüsü', 'admin.access.notifications': 'Bildirimler',
            'admin.access.chooseUserError': 'Tek tek ilke kaydetmeden önce belirli bir kullanıcı seçin.', 'admin.access.saved': 'Rol ve bölüm erişimi kaydedildi.',
            'admin.access.saveError': 'Rol erişimi kaydedilemedi.', 'admin.access.appliedRole': 'Erişim bu roldeki tüm kullanıcılara uygulandı.',
            'admin.access.applyError': 'Rol erişimi uygulanamadı.', 'admin.access.confirmAllRoles': 'Bu gösterge paneli, bölüm ve platform ilkesini her role uygulamak istiyor musunuz?',
            'admin.access.appliedAllRoles': 'Erişim tüm rollere uygulandı.', 'admin.access.confirmAllUsers': 'Bu gösterge paneli, bölüm ve platform ilkesini her kullanıcı hesabına uygulamak istiyor musunuz?',
            'admin.access.appliedAllUsers': 'Erişim tüm kullanıcılara uygulandı.', 'admin.access.importFailed': 'İçe aktarma başarısız oldu.', 'admin.access.importInvalid': 'İçe aktarma başarısız oldu. Lütfen dosya biçimini kontrol edin.'
        },
        fr: {
            'admin.action.cancel': 'Annuler', 'admin.action.save': 'Enregistrer', 'admin.action.edit': 'Modifier', 'admin.action.delete': 'Supprimer',
            'admin.action.previous': 'Précédent', 'admin.action.next': 'Suivant', 'admin.action.pageOf': 'Page {current} sur {total}',
            'admin.common.studentNumber': 'Numéro étudiant', 'admin.common.name': 'Nom', 'admin.common.username': 'Nom d’utilisateur',
            'admin.common.password': 'Mot de passe', 'admin.common.active': 'Actif', 'admin.common.inactive': 'Inactif',
            'admin.role.student': 'Étudiant', 'admin.role.instructor': 'Enseignant', 'admin.role.admin': 'Administrateur',
            'admin.account.searchHolidays': 'Rechercher une date, un jour, un congé, un type ou un statut…', 'admin.account.date': 'Date',
            'admin.account.day': 'Jour', 'admin.account.holiday': 'Jour férié', 'admin.account.type': 'Type', 'admin.account.status': 'Statut',
            'admin.account.actions': 'Actions', 'admin.account.noHolidays': 'Aucun jour férié ne correspond à cette recherche.',
            'admin.account.holidayCount.one': '{count} jour férié', 'admin.account.holidayCount.other': '{count} jours fériés',
            'admin.account.editHoliday': 'Modifier {name}', 'admin.account.deleteHoliday': 'Supprimer {name}',
            'admin.account.type.holiday': 'Jour férié', 'admin.account.type.weekend': 'Week-end', 'admin.account.type.closure': 'Fermeture', 'admin.account.type.custom': 'Personnalisé',
            'admin.account.create': 'Créer', 'admin.account.createUser': 'Créer un utilisateur', 'admin.account.addEditAdmin': 'Ajouter / modifier un administrateur',
            'admin.account.addUserInstructor': 'Ajouter un utilisateur / enseignant', 'admin.account.editUserInstructor': 'Modifier l’utilisateur / enseignant',
            'admin.account.temporaryPassword': 'Mot de passe temporaire', 'admin.account.passwordForNew': 'Obligatoire pour les nouveaux utilisateurs',
            'admin.account.createAccount': 'Créer le compte', 'admin.account.saveAccount': 'Enregistrer le compte',
            'admin.account.filterRole': 'Filtrer {role} par numéro, nom ou e-mail…', 'admin.account.roleAccounts': 'Comptes {role}',
            'admin.account.noRoleAccounts': 'Aucun compte {role} ne correspond à ce filtre.', 'admin.account.accountCount.one': '{count} compte', 'admin.account.accountCount.other': '{count} comptes',
            'admin.account.saved': 'Compte enregistré avec succès', 'admin.account.saveError': 'Impossible d’enregistrer le compte',
            'admin.account.created': 'Compte créé avec succès', 'admin.account.createError': 'Impossible de créer le compte',
            'admin.account.deleteConfirm': 'Supprimer ce compte utilisateur ?', 'admin.account.deleted': 'Utilisateur supprimé avec succès', 'admin.account.deleteError': 'Impossible de supprimer l’utilisateur',
            'admin.profile.close': 'Fermer le profil', 'admin.profile.pictureAlt': 'Photo de profil', 'admin.profile.title': 'Mon profil',
            'admin.profile.description': 'Gérez vos informations d’administrateur.', 'admin.profile.firstName': 'Prénom', 'admin.profile.surname': 'Nom de famille',
            'admin.profile.picture': 'Photo de profil', 'admin.profile.imageRequirements': 'JPG, PNG, WebP ou GIF, jusqu’à 5 Mo',
            'admin.profile.faculty': 'Faculté', 'admin.profile.department': 'Département', 'admin.profile.selectFaculty': 'Sélectionner une faculté',
            'admin.profile.selectDepartment': 'Sélectionner un département', 'admin.profile.selectFacultyFirst': 'Sélectionnez d’abord une faculté',
            'admin.profile.inactiveSuffix': '(inactif)', 'admin.profile.save': 'Enregistrer le profil', 'admin.profile.changePassword': 'Changer le mot de passe',
            'admin.profile.currentPassword': 'Mot de passe actuel', 'admin.profile.newPassword': 'Nouveau mot de passe', 'admin.profile.confirmPassword': 'Confirmer le nouveau mot de passe',
            'admin.profile.showPassword': 'Afficher {field}', 'admin.profile.hidePassword': 'Masquer {field}',
            'admin.profile.loadError': 'Impossible de charger le profil.', 'admin.profile.directoryLoadError': 'Impossible de charger l’annuaire des facultés.',
            'admin.profile.pictureUploadError': 'Impossible de téléverser la photo.', 'admin.profile.pictureUploaded': 'Photo de profil téléversée.',
            'admin.profile.saved': 'Profil enregistré.', 'admin.profile.saveError': 'Impossible d’enregistrer le profil.',
            'admin.profile.passwordMismatch': 'Les nouveaux mots de passe ne correspondent pas.', 'admin.profile.passwordChanged': 'Mot de passe modifié.', 'admin.profile.passwordChangeError': 'Impossible de modifier le mot de passe.',
            'admin.access.roleAccess': 'Accès par rôle', 'admin.access.intro': 'Contrôlez le tableau de bord commun, les services de plateforme et les parties de section pour un compte, ou appliquez la même règle à tous les rôles ou utilisateurs.',
            'admin.access.addRole': 'Ajouter un rôle', 'admin.access.excelTemplate': 'Modèle Excel', 'admin.access.importExcel': 'Importer Excel',
            'admin.access.newRole': 'Nom du nouveau rôle', 'admin.access.roleExample': 'Par exemple : coordinateur de faculté', 'admin.access.createRole': 'Créer le rôle',
            'admin.access.roleToAssign': 'Rôle à attribuer', 'admin.access.roleHelp': 'Choisissez un rôle ou appliquez une règle à tous les rôles.',
            'admin.access.user': 'Utilisateur', 'admin.access.userHelp': 'Choisissez un utilisateur ou appliquez une règle à tous les utilisateurs.',
            'admin.access.userPermissions': 'Autorisations utilisateur', 'admin.access.roleDefaults': 'Valeurs par défaut des sections du rôle',
            'admin.access.roleCreated': 'Rôle créé. Vous pouvez désormais l’attribuer à tout utilisateur.', 'admin.access.createRoleError': 'Impossible de créer le rôle.',
            'admin.access.loadError': 'Impossible de charger les données d’accès par rôle.', 'admin.access.allRoles': 'Tous les rôles', 'admin.access.allUsers': 'Tous les utilisateurs',
            'admin.access.noUsers': 'Aucun utilisateur disponible.', 'admin.access.coreSummary': 'Base : tableau de bord, discussion et profil',
            'admin.access.dashboardShows': 'Le tableau de bord affiche : {sections}', 'admin.access.dashboardCoreOnly': 'Aperçu principal du tableau de bord uniquement',
            'admin.access.noOptionalSections': 'Aucune section facultative pour le moment', 'admin.access.selectedUser': 'Utilisateur sélectionné',
            'admin.access.sharedDefaults': 'Valeurs par défaut partagées pour chaque rôle du portail.', 'admin.access.commonPolicy': 'Une règle d’accès commune pour chaque compte utilisateur.',
            'admin.access.noStudentNumber': 'Aucun numéro étudiant', 'admin.access.currentRole': 'rôle actuel : {role}',
            'admin.access.bulk': 'Accès groupé', 'admin.access.assignRole': 'Attribuer {role}', 'admin.access.coreAvailable': 'L’accès principal est toujours disponible.',
            'admin.access.commonDashboard': 'Tableau de bord commun', 'admin.access.shows': 'Affiche : {sections}',
            'admin.access.defaultSections': 'Plateformes, annonces et menu de restauration par défaut',
            'admin.access.chatDetails': 'Discussion : personnes et conversations en temps réel', 'admin.access.profileDetails': 'Profil : données du compte et contrôles de mot de passe',
            'admin.access.saveUser': 'Enregistrer pour cet utilisateur', 'admin.access.applyAllRoles': 'Appliquer à tous les rôles',
            'admin.access.applyRoleUsers': 'Appliquer à tous les utilisateurs {role}', 'admin.access.applyAllUsers': 'Appliquer à tous les utilisateurs',
            'admin.access.chooseAccess': 'Choisir l’accès', 'admin.access.chooseSectionParts': 'Sélectionnez exactement les parties de cette section que l’utilisateur peut utiliser.',
            'admin.access.diningIncluded': 'La consultation du menu est incluse. Choisissez les actions facultatives d’importation ou de suppression.',
            'admin.access.noParts': 'Aucune partie n’est disponible pour cette section.', 'admin.access.applyAccess': 'Appliquer l’accès',
            'admin.access.choosePartsError': 'Choisissez les parties de {section} à accorder.', 'admin.access.viewDiningOnly': 'Consulter le menu uniquement',
            'admin.access.chooseSectionAccess': 'Choisir l’accès à {section}', 'admin.access.viewAnnouncements': 'Voir les annonces',
            'admin.access.importDining': 'Importer le menu', 'admin.access.removeDining': 'Supprimer le menu',
            'admin.access.viewNotifications': 'Voir les notifications', 'admin.access.markNotificationsRead': 'Marquer les notifications comme lues', 'admin.access.view': 'Voir',
            'admin.access.platforms': 'Plateformes', 'admin.access.announcements': 'Annonces', 'admin.access.diningMenu': 'Menu de restauration', 'admin.access.notifications': 'Notifications',
            'admin.access.chooseUserError': 'Choisissez un utilisateur précis avant d’enregistrer une règle individuelle.', 'admin.access.saved': 'Accès au rôle et à la section enregistré.',
            'admin.access.saveError': 'Impossible d’enregistrer l’accès par rôle.', 'admin.access.appliedRole': 'Accès appliqué à tous les utilisateurs de ce rôle.',
            'admin.access.applyError': 'Impossible d’appliquer l’accès par rôle.', 'admin.access.confirmAllRoles': 'Appliquer cette règle de tableau de bord, section et plateforme à chaque rôle ?',
            'admin.access.appliedAllRoles': 'Accès appliqué à tous les rôles.', 'admin.access.confirmAllUsers': 'Appliquer cette règle de tableau de bord, section et plateforme à chaque compte utilisateur ?',
            'admin.access.appliedAllUsers': 'Accès appliqué à tous les utilisateurs.', 'admin.access.importFailed': 'Échec de l’importation.', 'admin.access.importInvalid': 'Échec de l’importation. Vérifiez le format du fichier.'
        },
        ru: {
            'admin.action.cancel': 'Отмена', 'admin.action.save': 'Сохранить', 'admin.action.edit': 'Изменить', 'admin.action.delete': 'Удалить',
            'admin.action.previous': 'Назад', 'admin.action.next': 'Далее', 'admin.action.pageOf': 'Страница {current} из {total}',
            'admin.common.studentNumber': 'Номер студента', 'admin.common.name': 'Имя', 'admin.common.username': 'Имя пользователя',
            'admin.common.password': 'Пароль', 'admin.common.active': 'Активен', 'admin.common.inactive': 'Неактивен',
            'admin.role.student': 'Студент', 'admin.role.instructor': 'Преподаватель', 'admin.role.admin': 'Администратор',
            'admin.account.searchHolidays': 'Поиск по дате, дню, празднику, типу или статусу…', 'admin.account.date': 'Дата',
            'admin.account.day': 'День', 'admin.account.holiday': 'Праздник', 'admin.account.type': 'Тип', 'admin.account.status': 'Статус',
            'admin.account.actions': 'Действия', 'admin.account.noHolidays': 'Нет праздников, соответствующих этому поиску.',
            'admin.account.holidayCount.one': '{count} праздник', 'admin.account.holidayCount.few': '{count} праздника', 'admin.account.holidayCount.many': '{count} праздников', 'admin.account.holidayCount.other': '{count} праздника',
            'admin.account.editHoliday': 'Изменить {name}', 'admin.account.deleteHoliday': 'Удалить {name}',
            'admin.account.type.holiday': 'Праздник', 'admin.account.type.weekend': 'Выходной', 'admin.account.type.closure': 'Закрытие', 'admin.account.type.custom': 'Особый',
            'admin.account.create': 'Создать', 'admin.account.createUser': 'Создать пользователя', 'admin.account.addEditAdmin': 'Добавить / изменить администратора',
            'admin.account.addUserInstructor': 'Добавить пользователя / преподавателя', 'admin.account.editUserInstructor': 'Изменить пользователя / преподавателя',
            'admin.account.temporaryPassword': 'Временный пароль', 'admin.account.passwordForNew': 'Обязательно для новых пользователей',
            'admin.account.createAccount': 'Создать учётную запись', 'admin.account.saveAccount': 'Сохранить учётную запись',
            'admin.account.filterRole': 'Фильтр {role} по номеру, имени или эл. почте…', 'admin.account.roleAccounts': 'Учётные записи: {role}',
            'admin.account.noRoleAccounts': 'Нет учётных записей {role}, соответствующих фильтру.', 'admin.account.accountCount.one': '{count} учётная запись', 'admin.account.accountCount.few': '{count} учётные записи', 'admin.account.accountCount.many': '{count} учётных записей', 'admin.account.accountCount.other': '{count} учётной записи',
            'admin.account.saved': 'Учётная запись сохранена', 'admin.account.saveError': 'Не удалось сохранить учётную запись',
            'admin.account.created': 'Учётная запись создана', 'admin.account.createError': 'Не удалось создать учётную запись',
            'admin.account.deleteConfirm': 'Удалить эту учётную запись пользователя?', 'admin.account.deleted': 'Пользователь удалён', 'admin.account.deleteError': 'Не удалось удалить пользователя',
            'admin.profile.close': 'Закрыть профиль', 'admin.profile.pictureAlt': 'Фото профиля', 'admin.profile.title': 'Мой профиль',
            'admin.profile.description': 'Управляйте сведениями администратора.', 'admin.profile.firstName': 'Имя', 'admin.profile.surname': 'Фамилия',
            'admin.profile.picture': 'Фото профиля', 'admin.profile.imageRequirements': 'JPG, PNG, WebP или GIF, до 5 МБ',
            'admin.profile.faculty': 'Факультет', 'admin.profile.department': 'Кафедра', 'admin.profile.selectFaculty': 'Выберите факультет',
            'admin.profile.selectDepartment': 'Выберите кафедру', 'admin.profile.selectFacultyFirst': 'Сначала выберите факультет',
            'admin.profile.inactiveSuffix': '(неактивен)', 'admin.profile.save': 'Сохранить профиль', 'admin.profile.changePassword': 'Изменить пароль',
            'admin.profile.currentPassword': 'Текущий пароль', 'admin.profile.newPassword': 'Новый пароль', 'admin.profile.confirmPassword': 'Подтвердите новый пароль',
            'admin.profile.showPassword': 'Показать: {field}', 'admin.profile.hidePassword': 'Скрыть: {field}',
            'admin.profile.loadError': 'Не удалось загрузить профиль.', 'admin.profile.directoryLoadError': 'Не удалось загрузить справочник факультетов.',
            'admin.profile.pictureUploadError': 'Не удалось загрузить фото.', 'admin.profile.pictureUploaded': 'Фото профиля загружено.',
            'admin.profile.saved': 'Профиль сохранён.', 'admin.profile.saveError': 'Не удалось сохранить профиль.',
            'admin.profile.passwordMismatch': 'Новые пароли не совпадают.', 'admin.profile.passwordChanged': 'Пароль изменён.', 'admin.profile.passwordChangeError': 'Не удалось изменить пароль.',
            'admin.access.roleAccess': 'Доступ по ролям', 'admin.access.intro': 'Настройте общий экран, сервисы платформы и части разделов для одной учётной записи или примените одну политику ко всем ролям либо пользователям.',
            'admin.access.addRole': 'Добавить роль', 'admin.access.excelTemplate': 'Шаблон Excel', 'admin.access.importExcel': 'Импорт Excel',
            'admin.access.newRole': 'Название новой роли', 'admin.access.roleExample': 'Например: координатор факультета', 'admin.access.createRole': 'Создать роль',
            'admin.access.roleToAssign': 'Назначаемая роль', 'admin.access.roleHelp': 'Выберите роль или примените одну политику ко всем ролям.',
            'admin.access.user': 'Пользователь', 'admin.access.userHelp': 'Выберите пользователя или примените одну политику ко всем пользователям.',
            'admin.access.userPermissions': 'Разрешения пользователя', 'admin.access.roleDefaults': 'Значения разделов по умолчанию',
            'admin.access.roleCreated': 'Роль создана. Теперь её можно назначить любому пользователю.', 'admin.access.createRoleError': 'Не удалось создать роль.',
            'admin.access.loadError': 'Не удалось загрузить данные доступа по ролям.', 'admin.access.allRoles': 'Все роли', 'admin.access.allUsers': 'Все пользователи',
            'admin.access.noUsers': 'Нет доступных пользователей.', 'admin.access.coreSummary': 'Основное: панель управления, чат и профиль',
            'admin.access.dashboardShows': 'На панели показано: {sections}', 'admin.access.dashboardCoreOnly': 'Только основной обзор панели',
            'admin.access.noOptionalSections': 'Дополнительных разделов пока нет', 'admin.access.selectedUser': 'Выбранный пользователь',
            'admin.access.sharedDefaults': 'Общие значения по умолчанию для каждой роли в портале.', 'admin.access.commonPolicy': 'Единая политика доступа для каждой учётной записи.',
            'admin.access.noStudentNumber': 'Нет номера студента', 'admin.access.currentRole': 'текущая роль: {role}',
            'admin.access.bulk': 'Групповой доступ', 'admin.access.assignRole': 'Назначить {role}', 'admin.access.coreAvailable': 'Основной доступ всегда доступен.',
            'admin.access.commonDashboard': 'Общая панель управления', 'admin.access.shows': 'Показано: {sections}',
            'admin.access.defaultSections': 'Платформы, объявления и меню столовой по умолчанию',
            'admin.access.chatDetails': 'Чат: люди и разговоры в реальном времени', 'admin.access.profileDetails': 'Профиль: сведения учётной записи и настройки пароля',
            'admin.access.saveUser': 'Сохранить для этого пользователя', 'admin.access.applyAllRoles': 'Применить ко всем ролям',
            'admin.access.applyRoleUsers': 'Применить ко всем пользователям роли {role}', 'admin.access.applyAllUsers': 'Применить ко всем пользователям',
            'admin.access.chooseAccess': 'Выберите доступ', 'admin.access.chooseSectionParts': 'Выберите точные части этого раздела, которые пользователь может использовать.',
            'admin.access.diningIncluded': 'Просмотр меню столовой уже включён. Выберите дополнительные действия импорта или удаления.',
            'admin.access.noParts': 'Для этого раздела нет доступных частей.', 'admin.access.applyAccess': 'Применить доступ',
            'admin.access.choosePartsError': 'Выберите части {section}, которые нужно предоставить.', 'admin.access.viewDiningOnly': 'Только просмотр меню',
            'admin.access.chooseSectionAccess': 'Выберите доступ к {section}', 'admin.access.viewAnnouncements': 'Просмотреть объявления',
            'admin.access.importDining': 'Импортировать меню', 'admin.access.removeDining': 'Удалить меню',
            'admin.access.viewNotifications': 'Просмотреть уведомления', 'admin.access.markNotificationsRead': 'Отметить уведомления прочитанными', 'admin.access.view': 'Просмотреть',
            'admin.access.platforms': 'Платформы', 'admin.access.announcements': 'Объявления', 'admin.access.diningMenu': 'Меню столовой', 'admin.access.notifications': 'Уведомления',
            'admin.access.chooseUserError': 'Выберите конкретного пользователя перед сохранением индивидуальной политики.', 'admin.access.saved': 'Доступ к роли и разделам сохранён.',
            'admin.access.saveError': 'Не удалось сохранить доступ по ролям.', 'admin.access.appliedRole': 'Доступ применён ко всем пользователям с этой ролью.',
            'admin.access.applyError': 'Не удалось применить доступ по ролям.', 'admin.access.confirmAllRoles': 'Применить эту политику панели, разделов и платформ ко всем ролям?',
            'admin.access.appliedAllRoles': 'Доступ применён ко всем ролям.', 'admin.access.confirmAllUsers': 'Применить эту политику панели, разделов и платформ ко всем учётным записям?',
            'admin.access.appliedAllUsers': 'Доступ применён ко всем пользователям.', 'admin.access.importFailed': 'Импорт не выполнен.', 'admin.access.importInvalid': 'Импорт не выполнен. Проверьте формат файла.'
        },
        ar: {
            'admin.action.cancel': 'إلغاء', 'admin.action.save': 'حفظ', 'admin.action.edit': 'تعديل', 'admin.action.delete': 'حذف',
            'admin.action.previous': 'السابق', 'admin.action.next': 'التالي', 'admin.action.pageOf': 'الصفحة {current} من {total}',
            'admin.common.studentNumber': 'رقم الطالب', 'admin.common.name': 'الاسم', 'admin.common.username': 'اسم المستخدم',
            'admin.common.password': 'كلمة المرور', 'admin.common.active': 'نشط', 'admin.common.inactive': 'غير نشط',
            'admin.role.student': 'طالب', 'admin.role.instructor': 'مدرس', 'admin.role.admin': 'مسؤول',
            'admin.account.searchHolidays': 'ابحث بالتاريخ أو اليوم أو العطلة أو النوع أو الحالة…', 'admin.account.date': 'التاريخ',
            'admin.account.day': 'اليوم', 'admin.account.holiday': 'العطلة', 'admin.account.type': 'النوع', 'admin.account.status': 'الحالة',
            'admin.account.actions': 'الإجراءات', 'admin.account.noHolidays': 'لا توجد عطلات تطابق هذا البحث.',
            'admin.account.holidayCount.zero': 'لا عطلات', 'admin.account.holidayCount.one': 'عطلة واحدة', 'admin.account.holidayCount.two': 'عطلتان', 'admin.account.holidayCount.few': '{count} عطلات', 'admin.account.holidayCount.many': '{count} عطلة', 'admin.account.holidayCount.other': '{count} عطلة',
            'admin.account.editHoliday': 'تعديل {name}', 'admin.account.deleteHoliday': 'حذف {name}',
            'admin.account.type.holiday': 'عطلة', 'admin.account.type.weekend': 'نهاية الأسبوع', 'admin.account.type.closure': 'إغلاق', 'admin.account.type.custom': 'مخصص',
            'admin.account.create': 'إنشاء', 'admin.account.createUser': 'إنشاء مستخدم', 'admin.account.addEditAdmin': 'إضافة / تعديل مسؤول',
            'admin.account.addUserInstructor': 'إضافة مستخدم / مدرس', 'admin.account.editUserInstructor': 'تعديل مستخدم / مدرس',
            'admin.account.temporaryPassword': 'كلمة مرور مؤقتة', 'admin.account.passwordForNew': 'مطلوبة للمستخدمين الجدد',
            'admin.account.createAccount': 'إنشاء الحساب', 'admin.account.saveAccount': 'حفظ الحساب',
            'admin.account.filterRole': 'تصفية {role} بالرقم أو الاسم أو البريد الإلكتروني…', 'admin.account.roleAccounts': 'حسابات {role}',
            'admin.account.noRoleAccounts': 'لا توجد حسابات {role} تطابق هذا المرشح.', 'admin.account.accountCount.zero': 'لا حسابات', 'admin.account.accountCount.one': 'حساب واحد', 'admin.account.accountCount.two': 'حسابان', 'admin.account.accountCount.few': '{count} حسابات', 'admin.account.accountCount.many': '{count} حسابًا', 'admin.account.accountCount.other': '{count} حساب',
            'admin.account.saved': 'تم حفظ الحساب بنجاح', 'admin.account.saveError': 'تعذر حفظ الحساب',
            'admin.account.created': 'تم إنشاء الحساب بنجاح', 'admin.account.createError': 'تعذر إنشاء الحساب',
            'admin.account.deleteConfirm': 'هل تريد حذف حساب المستخدم هذا؟', 'admin.account.deleted': 'تم حذف المستخدم بنجاح', 'admin.account.deleteError': 'تعذر حذف المستخدم',
            'admin.profile.close': 'إغلاق الملف الشخصي', 'admin.profile.pictureAlt': 'صورة الملف الشخصي', 'admin.profile.title': 'ملفي الشخصي',
            'admin.profile.description': 'إدارة تفاصيل المسؤول الخاصة بك.', 'admin.profile.firstName': 'الاسم الأول', 'admin.profile.surname': 'اسم العائلة',
            'admin.profile.picture': 'صورة الملف الشخصي', 'admin.profile.imageRequirements': 'JPG أو PNG أو WebP أو GIF، حتى 5 ميغابايت',
            'admin.profile.faculty': 'الكلية', 'admin.profile.department': 'القسم', 'admin.profile.selectFaculty': 'اختر كلية',
            'admin.profile.selectDepartment': 'اختر قسمًا', 'admin.profile.selectFacultyFirst': 'اختر كلية أولًا',
            'admin.profile.inactiveSuffix': '(غير نشط)', 'admin.profile.save': 'حفظ الملف الشخصي', 'admin.profile.changePassword': 'تغيير كلمة المرور',
            'admin.profile.currentPassword': 'كلمة المرور الحالية', 'admin.profile.newPassword': 'كلمة المرور الجديدة', 'admin.profile.confirmPassword': 'تأكيد كلمة المرور الجديدة',
            'admin.profile.showPassword': 'إظهار {field}', 'admin.profile.hidePassword': 'إخفاء {field}',
            'admin.profile.loadError': 'تعذر تحميل الملف الشخصي.', 'admin.profile.directoryLoadError': 'تعذر تحميل دليل الكليات.',
            'admin.profile.pictureUploadError': 'تعذر رفع الصورة.', 'admin.profile.pictureUploaded': 'تم رفع صورة الملف الشخصي.',
            'admin.profile.saved': 'تم حفظ الملف الشخصي.', 'admin.profile.saveError': 'تعذر حفظ الملف الشخصي.',
            'admin.profile.passwordMismatch': 'كلمتا المرور الجديدتان غير متطابقتين.', 'admin.profile.passwordChanged': 'تم تغيير كلمة المرور.', 'admin.profile.passwordChangeError': 'تعذر تغيير كلمة المرور.',
            'admin.access.roleAccess': 'الوصول حسب الدور', 'admin.access.intro': 'تحكم في لوحة التحكم المشتركة وخدمات المنصة وأجزاء الأقسام لحساب واحد، أو طبّق السياسة نفسها على جميع الأدوار أو المستخدمين.',
            'admin.access.addRole': 'إضافة دور', 'admin.access.excelTemplate': 'قالب Excel', 'admin.access.importExcel': 'استيراد Excel',
            'admin.access.newRole': 'اسم الدور الجديد', 'admin.access.roleExample': 'مثال: منسق الكلية', 'admin.access.createRole': 'إنشاء دور',
            'admin.access.roleToAssign': 'الدور المراد تعيينه', 'admin.access.roleHelp': 'اختر دورًا أو طبّق سياسة واحدة على جميع الأدوار.',
            'admin.access.user': 'المستخدم', 'admin.access.userHelp': 'اختر مستخدمًا أو طبّق سياسة واحدة على جميع المستخدمين.',
            'admin.access.userPermissions': 'أذونات المستخدم', 'admin.access.roleDefaults': 'إعدادات القسم الافتراضية للدور',
            'admin.access.roleCreated': 'تم إنشاء الدور. يمكنك الآن تعيينه لأي مستخدم.', 'admin.access.createRoleError': 'تعذر إنشاء الدور.',
            'admin.access.loadError': 'تعذر تحميل بيانات الوصول حسب الدور.', 'admin.access.allRoles': 'جميع الأدوار', 'admin.access.allUsers': 'جميع المستخدمين',
            'admin.access.noUsers': 'لا يوجد مستخدمون متاحون.', 'admin.access.coreSummary': 'الأساسيات: لوحة التحكم والدردشة والملف الشخصي',
            'admin.access.dashboardShows': 'تعرض لوحة التحكم: {sections}', 'admin.access.dashboardCoreOnly': 'نظرة عامة أساسية فقط على لوحة التحكم',
            'admin.access.noOptionalSections': 'لا توجد أقسام اختيارية بعد', 'admin.access.selectedUser': 'المستخدم المحدد',
            'admin.access.sharedDefaults': 'إعدادات مشتركة افتراضية لكل دور في البوابة.', 'admin.access.commonPolicy': 'سياسة وصول موحّدة لكل حساب مستخدم.',
            'admin.access.noStudentNumber': 'لا يوجد رقم طالب', 'admin.access.currentRole': 'الدور الحالي: {role}',
            'admin.access.bulk': 'وصول جماعي', 'admin.access.assignRole': 'تعيين {role}', 'admin.access.coreAvailable': 'الوصول الأساسي متاح دائمًا.',
            'admin.access.commonDashboard': 'لوحة التحكم المشتركة', 'admin.access.shows': 'يعرض: {sections}',
            'admin.access.defaultSections': 'المنصات والإعلانات وقائمة الطعام افتراضيًا',
            'admin.access.chatDetails': 'الدردشة: الأشخاص والمحادثات في الوقت الفعلي', 'admin.access.profileDetails': 'الملف الشخصي: تفاصيل الحساب وإعدادات كلمة المرور',
            'admin.access.saveUser': 'حفظ لهذا المستخدم', 'admin.access.applyAllRoles': 'تطبيق على جميع الأدوار',
            'admin.access.applyRoleUsers': 'تطبيق على جميع مستخدمي {role}', 'admin.access.applyAllUsers': 'تطبيق على جميع المستخدمين',
            'admin.access.chooseAccess': 'اختر الوصول', 'admin.access.chooseSectionParts': 'حدد بدقة أجزاء هذا القسم التي يمكن للمستخدم استخدامها.',
            'admin.access.diningIncluded': 'عرض قائمة الطعام مشمول. اختر إجراءات الاستيراد أو الإزالة الاختيارية.',
            'admin.access.noParts': 'لا توجد أجزاء متاحة لهذا القسم.', 'admin.access.applyAccess': 'تطبيق الوصول',
            'admin.access.choosePartsError': 'اختر أجزاء {section} التي تريد منحها.', 'admin.access.viewDiningOnly': 'عرض قائمة الطعام فقط',
            'admin.access.chooseSectionAccess': 'اختر الوصول إلى {section}', 'admin.access.viewAnnouncements': 'عرض الإعلانات',
            'admin.access.importDining': 'استيراد قائمة الطعام', 'admin.access.removeDining': 'إزالة قائمة الطعام',
            'admin.access.viewNotifications': 'عرض الإشعارات', 'admin.access.markNotificationsRead': 'وضع علامة مقروء على الإشعارات', 'admin.access.view': 'عرض',
            'admin.access.platforms': 'المنصات', 'admin.access.announcements': 'الإعلانات', 'admin.access.diningMenu': 'قائمة الطعام', 'admin.access.notifications': 'الإشعارات',
            'admin.access.chooseUserError': 'اختر مستخدمًا محددًا قبل حفظ سياسة فردية.', 'admin.access.saved': 'تم حفظ الوصول إلى الدور والقسم.',
            'admin.access.saveError': 'تعذر حفظ الوصول حسب الدور.', 'admin.access.appliedRole': 'تم تطبيق الوصول على جميع المستخدمين بهذا الدور.',
            'admin.access.applyError': 'تعذر تطبيق الوصول حسب الدور.', 'admin.access.confirmAllRoles': 'هل تريد تطبيق سياسة لوحة التحكم والقسم والمنصة هذه على كل دور؟',
            'admin.access.appliedAllRoles': 'تم تطبيق الوصول على جميع الأدوار.', 'admin.access.confirmAllUsers': 'هل تريد تطبيق سياسة لوحة التحكم والقسم والمنصة هذه على كل حساب مستخدم؟',
            'admin.access.appliedAllUsers': 'تم تطبيق الوصول على جميع المستخدمين.', 'admin.access.importFailed': 'فشل الاستيراد.', 'admin.access.importInvalid': 'فشل الاستيراد. يرجى التحقق من تنسيق الملف.'
        }
    };

    function registerAccountTranslations() {
        window.adminI18n?.registerTranslations?.(ACCOUNT_TRANSLATIONS);
    }

    function t(key, values = {}) {
        const translated = window.adminI18n?.translate?.(key, undefined, values);
        if (translated && translated !== key) return translated;
        const language = window.adminI18n?.getLanguage?.() || 'en';
        const template = ACCOUNT_TRANSLATIONS[language]?.[key] || ACCOUNT_TRANSLATIONS.en[key] || key;
        return String(template).replace(/\{([\w-]+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match);
    }

    function plural(key, count, values = {}) {
        const translated = window.adminI18n?.translatePlural?.(key, count, values);
        if (translated && translated !== `${key}.other`) return translated;
        return t(`${key}.other`, { count, ...values });
    }

    function formatLocalizedDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
        if (!value) return '';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return window.adminI18n?.formatDate?.(date, options) || date.toLocaleDateString(undefined, options);
    }

    registerAccountTranslations();

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAccountManagement, 0);
    });

    window.addEventListener('languageChanged', () => {
        registerAccountTranslations();
        window.applyAdminTranslations?.(document);
        const panel = window.adminPanel;
        if (panel?.holidayGridState && typeof panel.renderHolidays === 'function') panel.renderHolidays();
        if (Array.isArray(panel?.users) && typeof panel.renderUsers === 'function') panel.renderUsers(panel.users);
        if (roleAccessState) {
            renderRoleAccess(
                roleAccessState.panel,
                roleAccessState.users,
                roleAccessState.roleAccess,
                roleAccessState.roleParts,
                roleAccessState.platforms,
                roleAccessState.selectedRole
            );
        }
    });

    function initAccountManagement() {
        const panel = window.adminPanel;
        if (!panel || document.getElementById('user-manage-modal')) return;

        injectAccountStyles();
        injectCreateNavigation();
        injectRoleAccessNavigation(panel);
        injectCreateUserSection(panel);
        injectRoleAccessSection(panel);
        injectUserModal(panel);
        patchUserRenderer(panel);
        patchHolidayRenderer(panel);
        loadAvailableCreateUserRoles();
        panel.loadUsers();
        if (window.location.pathname.toLowerCase().endsWith('/role-access')) loadRoleAccess(panel);
    }

    function patchHolidayRenderer(panel) {
        const originalEditHoliday = panel.editHoliday?.bind(panel);
        if (originalEditHoliday) panel.editHoliday = id => { originalEditHoliday(id); const holiday = panel.holidays?.find(item => item.id == id); const active = document.getElementById('holiday-active'); if (active) active.checked = holiday?.is_active !== false; };
        panel.renderHolidays = function () {
            const container = document.getElementById('holidays-list');
            if (!container) return;
            this.holidayGridState = this.holidayGridState || { page: 1, filter: '', pageSize: 8 };
            container.innerHTML = `<div class="holiday-grid-toolbar"><label class="smart-filter"><i class="fas fa-search" aria-hidden="true"></i><input id="holiday-smart-filter" type="search" placeholder="${escapeHtml(t('admin.account.searchHolidays'))}" value="${escapeHtml(this.holidayGridState.filter)}"></label><span id="holiday-result-count" class="role-grid-count"></span></div><div class="table-responsive holiday-table-wrap"><table class="table holiday-table"><thead><tr><th>${escapeHtml(t('admin.account.date'))}</th><th>${escapeHtml(t('admin.account.day'))}</th><th>${escapeHtml(t('admin.account.holiday'))}</th><th>${escapeHtml(t('admin.account.type'))}</th><th>${escapeHtml(t('admin.account.status'))}</th><th>${escapeHtml(t('admin.account.actions'))}</th></tr></thead><tbody id="holiday-grid-body"></tbody></table></div><div id="holiday-grid-pages" class="pagination-controls"></div>`;
            document.getElementById('holiday-smart-filter')?.addEventListener('input', event => {
                this.holidayGridState.filter = event.target.value;
                this.holidayGridState.page = 1;
                renderHolidayGrid(this);
            });
            renderHolidayGrid(this);
        };
    }

    function renderHolidayGrid(panel) {
        const state = panel.holidayGridState || { page: 1, filter: '', pageSize: 8 };
        const term = String(state.filter || '').trim().toLowerCase();
        const rows = (panel.holidays || []).filter(holiday => !term || [
            holiday.date,
            holiday.day_of_week,
            holiday.holiday_name,
            holiday.description,
            holiday.type,
            displayHolidayType(holiday.type),
            holiday.is_active === false ? t('admin.common.inactive') : t('admin.common.active')
        ].some(value => String(value || '').toLocaleLowerCase().includes(term)));
        const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
        state.page = Math.min(Math.max(1, state.page), pages);
        const currentRows = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
        const body = document.getElementById('holiday-grid-body');
        if (body) body.innerHTML = currentRows.length ? currentRows.map(holiday => `<tr><td>${escapeHtml(formatHolidayDate(holiday.date))}</td><td>${escapeHtml(formatHolidayDay(holiday.date, holiday.day_of_week))}</td><td><strong>${escapeHtml(holiday.holiday_name || '')}</strong>${holiday.description ? `<small class="muted-block">${escapeHtml(holiday.description)}</small>` : ''}</td><td>${escapeHtml(displayHolidayType(holiday.type))}</td><td><span class="status-badge ${holiday.is_active === false ? 'status-inactive' : 'status-active'}">${escapeHtml(holiday.is_active === false ? t('admin.common.inactive') : t('admin.common.active'))}</span></td><td class="table-actions"><button class="btn btn-secondary btn-sm icon-action" title="${escapeAttribute(t('admin.account.editHoliday', { name: holiday.holiday_name || '' }))}" aria-label="${escapeAttribute(t('admin.account.editHoliday', { name: holiday.holiday_name || '' }))}" onclick="adminPanel.editHoliday(${holiday.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm icon-action" title="${escapeAttribute(t('admin.account.deleteHoliday', { name: holiday.holiday_name || '' }))}" aria-label="${escapeAttribute(t('admin.account.deleteHoliday', { name: holiday.holiday_name || '' }))}" onclick="adminPanel.deleteHoliday(${holiday.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="6" class="empty-state">${escapeHtml(t('admin.account.noHolidays'))}</td></tr>`;
        const count = document.getElementById('holiday-result-count');
        if (count) count.textContent = plural('admin.account.holidayCount', rows.length);
        const paging = document.getElementById('holiday-grid-pages');
        if (!paging) return;
        paging.innerHTML = `<button class="btn btn-secondary btn-sm" data-holiday-page="prev" ${state.page === 1 ? 'disabled' : ''}>${escapeHtml(t('admin.action.previous'))}</button><span>${escapeHtml(t('admin.action.pageOf', { current: state.page, total: pages }))}</span><button class="btn btn-secondary btn-sm" data-holiday-page="next" ${state.page === pages ? 'disabled' : ''}>${escapeHtml(t('admin.action.next'))}</button>`;
        paging.querySelector('[data-holiday-page="prev"]')?.addEventListener('click', () => { state.page--; renderHolidayGrid(panel); });
        paging.querySelector('[data-holiday-page="next"]')?.addEventListener('click', () => { state.page++; renderHolidayGrid(panel); });
    }

    function holidayDate(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`) : null;
    }

    function formatHolidayDate(value) {
        const date = holidayDate(value);
        return date ? formatLocalizedDate(date, { year: 'numeric', month: '2-digit', day: '2-digit' }) : String(value || '');
    }

    function formatHolidayDay(value, fallback) {
        const date = holidayDate(value);
        return date ? formatLocalizedDate(date, { weekday: 'long' }) : String(fallback || '');
    }

    function displayHolidayType(value) {
        const key = String(value || 'holiday').toLowerCase();
        return t(`admin.account.type.${key}`) === `admin.account.type.${key}` ? String(value || 'holiday') : t(`admin.account.type.${key}`);
    }

    function injectAdminProfile(panel) {
        const button = document.getElementById('admin-profile-btn');
        if (!button) { window.setTimeout(() => injectAdminProfile(panel), 60); return; }
        if (document.getElementById('admin-profile-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="admin-profile-modal" class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
                <div class="profile-dialog">
                    <button type="button" class="profile-close" id="admin-profile-close" data-i18n-aria-label="admin.profile.close" aria-label="${escapeAttribute(t('admin.profile.close'))}">&times;</button>
                    <div class="profile-heading">
                        <img id="admin-profile-picture-preview" src="/img/fiu9-mark2.png" data-i18n-alt="admin.profile.pictureAlt" alt="${escapeAttribute(t('admin.profile.pictureAlt'))}">
                        <div><h2 id="admin-profile-title" data-i18n="admin.profile.title">${escapeHtml(t('admin.profile.title'))}</h2><p data-i18n="admin.profile.description">${escapeHtml(t('admin.profile.description'))}</p></div>
                    </div>
                    <form id="admin-profile-form" class="profile-form">
                        <label><span data-i18n="admin.common.studentNumber">${escapeHtml(t('admin.common.studentNumber'))}</span><input name="student_number" id="admin-profile-student_number" autocomplete="off"></label>
                        <label><span data-i18n="admin.profile.firstName">${escapeHtml(t('admin.profile.firstName'))}</span><input name="first_name" id="admin-profile-first_name" autocomplete="given-name"></label>
                        <label><span data-i18n="admin.profile.surname">${escapeHtml(t('admin.profile.surname'))}</span><input name="last_name" id="admin-profile-last_name" autocomplete="family-name"></label>
                        <label class="profile-upload-field"><span data-i18n="admin.profile.picture">${escapeHtml(t('admin.profile.picture'))}</span><input name="file" id="admin-profile-picture-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small data-i18n="admin.profile.imageRequirements">${escapeHtml(t('admin.profile.imageRequirements'))}</small></label>
                        <label><span data-i18n="admin.profile.faculty">${escapeHtml(t('admin.profile.faculty'))}</span><select name="faculty_id" id="admin-profile-faculty"><option value="" data-i18n="admin.profile.selectFaculty">${escapeHtml(t('admin.profile.selectFaculty'))}</option></select></label>
                        <label><span data-i18n="admin.profile.department">${escapeHtml(t('admin.profile.department'))}</span><select name="department_id" id="admin-profile-department" disabled><option value="" data-i18n="admin.profile.selectFacultyFirst">${escapeHtml(t('admin.profile.selectFacultyFirst'))}</option></select></label>
                        <button class="btn" type="submit"><span data-i18n="admin.profile.save">${escapeHtml(t('admin.profile.save'))}</span></button>
                    </form>
                    <hr>
                    <form id="admin-profile-password-form" class="profile-form">
                        <h3 data-i18n="admin.profile.changePassword">${escapeHtml(t('admin.profile.changePassword'))}</h3>
                        <label><span data-i18n="admin.profile.currentPassword">${escapeHtml(t('admin.profile.currentPassword'))}</span><span class="admin-password-field"><input name="current_password" type="password" autocomplete="current-password" required><button type="button" class="admin-password-toggle" data-password-key="admin.profile.currentPassword" aria-label="${escapeAttribute(t('admin.profile.showPassword', { field: t('admin.profile.currentPassword') }))}" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button></span></label>
                        <label><span data-i18n="admin.profile.newPassword">${escapeHtml(t('admin.profile.newPassword'))}</span><span class="admin-password-field"><input name="new_password" type="password" minlength="8" autocomplete="new-password" required><button type="button" class="admin-password-toggle" data-password-key="admin.profile.newPassword" aria-label="${escapeAttribute(t('admin.profile.showPassword', { field: t('admin.profile.newPassword') }))}" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button></span></label>
                        <label><span data-i18n="admin.profile.confirmPassword">${escapeHtml(t('admin.profile.confirmPassword'))}</span><span class="admin-password-field"><input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required><button type="button" class="admin-password-toggle" data-password-key="admin.profile.confirmPassword" aria-label="${escapeAttribute(t('admin.profile.showPassword', { field: t('admin.profile.confirmPassword') }))}" aria-pressed="false"><i class="fas fa-eye" aria-hidden="true"></i></button></span></label>
                        <button class="btn" type="submit"><span data-i18n="admin.profile.changePassword">${escapeHtml(t('admin.profile.changePassword'))}</span></button>
                    </form>
                    <div id="admin-profile-feedback" aria-live="polite"></div>
                </div>
            </div>`);
        const modal = document.getElementById('admin-profile-modal');
        window.applyAdminTranslations?.(modal);
        let facultyDirectory = [];
        const facultySelect = document.getElementById('admin-profile-faculty');
        const departmentSelect = document.getElementById('admin-profile-department');
        const renderDepartments = (facultyId, selectedDepartmentId = '', selectedDepartmentName = '') => {
            const faculty = facultyDirectory.find(item => String(item.id) === String(facultyId));
            const departments = (faculty?.departments || []).filter(item => item.is_active !== false);
            departmentSelect.innerHTML = '<option value="">Select a department</option>' + departments.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
            const knownId = String(selectedDepartmentId || '');
            const byName = departments.find(item => String(item.name || '').toLowerCase() === String(selectedDepartmentName || '').toLowerCase());
            const value = knownId || (byName ? String(byName.id) : '');
            if (value && !departments.some(item => String(item.id) === value) && selectedDepartmentName) {
                departmentSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(value)}">${escapeHtml(selectedDepartmentName)} (inactive)</option>`);
            }
            departmentSelect.value = value;
            departmentSelect.disabled = !facultyId;
        };
        const renderAffiliations = profile => {
            const activeFaculties = facultyDirectory.filter(item => item.is_active !== false);
            facultySelect.innerHTML = '<option value="">Select a faculty</option>' + activeFaculties.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
            const savedId = String(profile.faculty_id || '');
            const byName = activeFaculties.find(item => String(item.name || '').toLowerCase() === String(profile.faculty || '').toLowerCase());
            const facultyId = savedId || (byName ? String(byName.id) : '');
            if (facultyId && !activeFaculties.some(item => String(item.id) === facultyId) && profile.faculty) {
                facultySelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(facultyId)}">${escapeHtml(profile.faculty)} (inactive)</option>`);
            }
            facultySelect.value = facultyId;
            renderDepartments(facultyId, profile.department_id, profile.department);
        };
        const openAdminProfile = async () => {
            modal.classList.add('show');
            showAdminProfileFeedback('', '');
            try {
                const [profileResponse, directoryResponse] = await Promise.all([
                    fetch(`${api()}?endpoint=profile`, { credentials: 'same-origin' }),
                    fetch(`${api()}?endpoint=faculty-departments-list`, { credentials: 'same-origin' })
                ]);
                const data = await profileResponse.json();
                const directory = await directoryResponse.json();
                if (!profileResponse.ok || !data.success) throw new Error(data.error || 'Unable to load profile.');
                if (!directoryResponse.ok || !directory.success) throw new Error(directory.error || 'Unable to load the faculty directory.');
                const p = data.profile || {};
                facultyDirectory = Array.isArray(directory.faculties) ? directory.faculties : [];
                ['student_number', 'first_name', 'last_name'].forEach(key => {
                    const input = document.getElementById(`admin-profile-${key}`);
                    if (input) input.value = p[key] || '';
                });
                renderAffiliations(p);
                document.getElementById('admin-profile-picture-preview').src = p.profile_picture || '/img/fiu9-mark2.png';
            } catch (error) {
                showAdminProfileFeedback(error.message || 'Unable to load profile.', 'error');
            }
        };
        document.addEventListener('click', event => { if (event.target.closest('#admin-profile-btn')) openAdminProfile(); }, true);
        document.getElementById('admin-profile-close').addEventListener('click', () => modal.classList.remove('show'));
        facultySelect.addEventListener('change', () => renderDepartments(facultySelect.value));
        modal.querySelectorAll('.admin-password-toggle').forEach(toggle => toggle.addEventListener('click', () => {
            const input = toggle.closest('.admin-password-field').querySelector('input');
            const isVisible = input.type === 'text';
            input.type = isVisible ? 'password' : 'text';
            toggle.setAttribute('aria-pressed', String(!isVisible));
            toggle.setAttribute('aria-label', `${isVisible ? 'Show' : 'Hide'} ${input.name.replace(/_/g, ' ')}`);
            toggle.querySelector('i').className = isVisible ? 'fas fa-eye' : 'fas fa-eye-slash';
        }));
        document.getElementById('admin-profile-picture-file').addEventListener('change', async event => { const file = event.target.files?.[0]; if (!file) return; const preview = document.getElementById('admin-profile-picture-preview'); preview.src = URL.createObjectURL(file); const upload = new FormData(); upload.append('action', 'admin-profile-picture-upload'); upload.append('current_admin_id', panel.currentAdmin.id); upload.append('file', file); try { const result = await (await fetch(api(), { method: 'POST', body: upload })).json(); if (!result.success) throw new Error(result.error || 'Unable to upload picture.'); preview.src = result.profile_picture; showAdminProfileFeedback('Profile picture uploaded.', 'success'); } catch (error) { showAdminProfileFeedback(error.message || 'Unable to upload picture.', 'error'); } });
        document.getElementById('admin-profile-form').addEventListener('submit', async event => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget).entries()); delete payload.file; payload.action = 'admin-profile-update'; payload.current_admin_id = panel.currentAdmin.id; const result = await postJson(payload); showAdminProfileFeedback(result.success ? 'Profile saved.' : (result.error || 'Unable to save profile.'), result.success ? 'success' : 'error'); });
        document.getElementById('admin-profile-password-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); if (data.new_password !== data.confirm_password) { showAdminProfileFeedback('New passwords do not match.', 'error'); return; } const result = await postJson({ action: 'admin-change-password-current', current_admin_id: panel.currentAdmin.id, ...data }); showAdminProfileFeedback(result.success ? 'Password changed.' : (result.error || 'Unable to change password.'), result.success ? 'success' : 'error'); if (result.success) event.currentTarget.reset(); });
        document.getElementById('admin-profile-modal').addEventListener('click', event => { if (event.target === modal) modal.classList.remove('show'); });
    }
    function showAdminProfileFeedback(message, type) { const target = document.getElementById('admin-profile-feedback'); if (target) { target.textContent = message; target.className = type; } }

    function injectRoleAccessNavigation(panel) {
        const nav = document.querySelector('.nav-menu');
        if (!nav || document.getElementById('role-access-nav-item')) return;
        const usersItem = document.querySelector('.nav-link[data-section="users"]')?.closest('.nav-item');
        const html = `<li class="nav-item" id="role-access-nav-item"><a href="/admin_dashboard/role-access" class="nav-link" data-section="role-access"><i class="fas fa-user-lock"></i><span>Role Access</span></a></li>`;
        (usersItem || nav.lastElementChild)?.insertAdjacentHTML('afterend', html);
        document.querySelector('#role-access-nav-item .nav-link')?.addEventListener('click', event => {
            event.preventDefault();
            document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active'));
            event.currentTarget.classList.add('active');
            panel.showSection('role-access');
            loadRoleAccess(panel);
        });
    }

    function injectRoleAccessSection(panel) {
        const main = document.querySelector('.main-content');
        if (!main || document.getElementById('role-access-section')) return;
        const section = document.createElement('div');
        section.id = 'role-access-section';
        section.className = 'section-content hidden';
        section.innerHTML = `<div class="content-section enhanced-panel role-access-panel">
            <div class="section-header"><div><h2 class="section-title">Role access</h2><p class="section-subtitle">Control the common dashboard, platform services, and section parts for one account—or apply the same policy to all roles or all users.</p></div><div class="role-access-actions"><button class="btn" id="role-access-add-role" type="button"><i class="fas fa-plus"></i> Add role</button><a class="btn btn-secondary" href="${api()}?endpoint=role-access-template"><i class="fas fa-download"></i> Excel template</a><label class="btn btn-secondary"><i class="fas fa-file-import"></i> Import Excel<input id="role-access-file" type="file" accept=".xlsx,.csv" hidden></label></div></div>
            <form id="role-access-add-form" class="role-add-form hidden"><label>New role name<input id="role-access-new-role" maxlength="40" placeholder="For example: faculty coordinator" required></label><button class="btn btn-sm" type="submit">Create role</button><button class="btn btn-secondary btn-sm" id="role-access-cancel-role" type="button">Cancel</button></form>
            <div id="role-access-feedback" class="role-access-feedback" aria-live="polite"></div>
            <div class="role-access-picker"><label>Role to assign<select id="role-access-role-select"></select><small>Choose a role or apply one policy to every role.</small></label><label>User<select id="role-access-user-select"></select><small>Choose a user or apply one policy to every user.</small></label></div>
            <div class="role-access-layout"><div><h3>User permissions</h3><div id="role-access-users" class="role-access-users"></div></div><div><h3>Role section defaults</h3><div id="role-access-roles" class="role-access-roles"></div></div></div>
        </div>`;
        main.appendChild(section);
        document.getElementById('role-access-file').addEventListener('change', event => uploadRoleAccess(panel, event.target.files[0]));
        const addForm = document.getElementById('role-access-add-form');
        document.getElementById('role-access-add-role').addEventListener('click', () => { addForm.classList.remove('hidden'); document.getElementById('role-access-new-role').focus(); });
        document.getElementById('role-access-cancel-role').addEventListener('click', () => addForm.classList.add('hidden'));
        addForm.addEventListener('submit', async event => { event.preventDefault(); const role = document.getElementById('role-access-new-role').value.trim(); const result = await postJson({ action: 'role-create', current_admin_id: panel.currentAdmin.id, role }); showRoleFeedback(result.success ? 'Role created. You can now assign it to any user.' : (result.error || 'Unable to create role.'), result.success ? 'success' : 'error'); if (result.success) { event.currentTarget.reset(); addForm.classList.add('hidden'); await loadAvailableCreateUserRoles(); await loadRoleAccess(panel, role); } });
        document.body.insertAdjacentHTML('beforeend', `<div id="section-parts-modal" class="profile-modal" role="dialog" aria-modal="true"><div class="profile-dialog section-parts-dialog"><button type="button" class="profile-close" id="section-parts-close">&times;</button><h2 id="section-parts-title">Choose access</h2><p>Select exactly which parts of this section the user may use.</p><div id="section-parts-options" class="section-parts-options"></div><div class="form-actions"><button type="button" class="btn btn-secondary" id="section-parts-cancel">Cancel</button><button type="button" class="btn" id="section-parts-save">Apply access</button></div></div></div>`);
    }

    function injectAccountStyles() {
        if (document.getElementById('account-management-styles')) return;
        const style = document.createElement('style');
        style.id = 'account-management-styles';
        style.textContent = `
            .create-toggle { width: 100%; border: 0; text-align: left; cursor: pointer; }
            .create-submenu { display: none; padding-left: 12px; }
            .create-dropdown.open .create-submenu { display: grid; gap: 6px; }
            .create-submenu .nav-link { font-size: 13px; padding: 10px 14px; }
            .archive-container, .platform-section-group { display: grid; gap: 16px; }
            .platform-section-title { margin: 8px 0 0; color: var(--primary-color, #142850); }
            .platform-section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; }
            .archive-block { display: grid; gap: 10px; }
            .archive-row { width: 100%; border: 1px solid rgba(20,40,80,.12); border-radius: 14px; background: rgba(255,255,255,.86); padding: 14px 16px; display: flex; justify-content: space-between; gap: 12px; text-align: left; color: inherit; }
            .profile-form select { width: 100%; min-height: 42px; }
            .admin-password-field { position: relative; display: block; width: 100%; }
            .admin-password-field input { width: 100%; padding-right: 44px; box-sizing: border-box; }
            .admin-password-toggle { position: absolute; top: 50%; right: 8px; width: 34px; height: 34px; transform: translateY(-50%); border: 0; border-radius: 9px; color: #31547d; background: transparent; cursor: pointer; }
            .admin-password-toggle:hover, .admin-password-toggle:focus-visible { background: #edf4fd; color: #123d72; outline: none; }
            .admin-password-toggle:focus-visible { box-shadow: 0 0 0 3px rgba(32,101,190,.3); }
        `;
        document.head.appendChild(style);
    }

    function injectCreateNavigation() {
        const nav = document.querySelector('.nav-menu');
        if (!nav || document.getElementById('create-menu-item')) return;

        nav.insertAdjacentHTML('beforeend', `
            <li class="nav-item create-dropdown" id="create-menu-item">
                <button class="nav-link create-toggle" type="button" data-section="create-user" aria-expanded="false"><i class="fas fa-plus-circle"></i> <span>Create</span> <i class="fas fa-chevron-down"></i></button>
                <div class="create-submenu">
                    <a href="/admin_dashboard/create-user" class="nav-link" data-section="create-user"><i class="fas fa-user-plus"></i> Create User</a>
                    <a href="/admin_dashboard/admins" class="nav-link" data-section="admins"><i class="fas fa-user-shield"></i> Add / Edit Admin</a>
                </div>
            </li>
        `);

        const toggle = document.querySelector('#create-menu-item .create-toggle');
        toggle.addEventListener('click', event => {
            event.preventDefault();
            const item = document.getElementById('create-menu-item');
            item.classList.toggle('open');
            toggle.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
            document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active'));
            toggle.classList.add('active');
            window.adminPanel.showSection('create-user');
        });
        document.querySelectorAll('#create-menu-item .create-submenu .nav-link').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active'));
                link.classList.add('active');
                window.adminPanel.showSection(link.dataset.section);
            });
        });
    }

    function injectCreateUserSection(panel) {
        const main = document.querySelector('.main-content');
        if (!main || document.getElementById('create-user-section')) return;

        const section = document.createElement('div');
        section.id = 'create-user-section';
        section.className = 'section-content hidden';
        section.innerHTML = `
            <div class="content-section enhanced-panel">
                <div class="section-header"><h2 class="section-title">Add User / Instructor</h2></div>
                <form id="create-user-form" class="enhanced-form">
                    <input name="username" placeholder="Username" required>
                    <input name="email" type="email" placeholder="name@final.edu.tr" required>
                    <select id="create-user-role" name="role" required>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                    </select>
                    <input name="password" type="password" placeholder="Temporary password" required>
                    <button class="btn" type="submit"><i class="fas fa-save"></i> Create Account</button>
                </form>
            </div>`;
        main.appendChild(section);
        document.getElementById('create-user-form').addEventListener('submit', event => saveCreatedUser(event, panel));

        const roleHeader = document.querySelector('#users-section thead tr th:nth-child(5)');
        if (roleHeader) roleHeader.textContent = 'Role';
    }

    function injectUserModal(panel) {
        const modal = document.createElement('div');
        modal.id = 'user-manage-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="user-modal-title">Add User / Instructor</h3>
                    <span class="close" id="close-user-modal">&times;</span>
                </div>
                <form id="user-manage-form">
                    <input type="hidden" name="id" id="user-id">
                    <div class="form-group">
                        <label for="user-username">Username</label>
                        <input type="text" id="user-username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="user-email">Email</label>
                        <input type="email" id="user-email" name="email" placeholder="name@final.edu.tr" required>
                    </div>
                    <div class="form-group">
                        <label for="user-role">Role</label>
                        <select id="user-role" name="role" required>
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="user-password">Password</label>
                        <input type="password" id="user-password" name="password" placeholder="Required for new users">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-user-modal">Cancel</button>
                        <button type="submit" class="btn">Save Account</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(modal);

        document.getElementById('close-user-modal').addEventListener('click', closeUserModal);
        document.getElementById('cancel-user-modal').addEventListener('click', closeUserModal);
        document.getElementById('user-manage-form').addEventListener('submit', event => saveUser(event, panel));
    }

    function patchUserRenderer(panel) {
        panel.renderUsers = function (users) {
            this.users = users || [];
            const host = document.getElementById('users-table-container');
            if (!host) return;
            const roles = [...new Set(['student', 'instructor', ...this.users.map(item => String(item.role || 'other').toLowerCase())])];
            this.userGridState = this.userGridState || {};
            host.innerHTML = roles.map(role => `<section class="role-user-grid" data-role-grid="${escapeHtml(role)}"><div class="role-grid-header"><div><h3>${escapeHtml(role.charAt(0).toUpperCase() + role.slice(1))} accounts</h3><span class="role-grid-count" id="role-count-${escapeHtml(role)}"></span></div><label class="smart-filter"><i class="fas fa-search"></i><input type="search" data-role-filter="${escapeHtml(role)}" placeholder="Filter ${escapeHtml(role)} by number, name, email…"></label></div><div class="table-responsive"><table class="table"><thead><tr><th>Student number</th><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody id="role-body-${escapeHtml(role)}"></tbody></table></div><div class="pagination-controls" id="role-pages-${escapeHtml(role)}"></div></section>`).join('');
            roles.forEach(role => {
                this.userGridState[role] = this.userGridState[role] || { page: 1, filter: '' };
                const input = host.querySelector(`[data-role-filter="${CSS.escape(role)}"]`);
                input?.addEventListener('input', event => { this.userGridState[role].filter = event.target.value; this.userGridState[role].page = 1; renderRoleGrid(this, role); });
                renderRoleGrid(this, role);
            });
        };
    }

    function renderRoleGrid(panel, role) {
        const state = panel.userGridState[role];
        const filter = String(state.filter || '').toLowerCase().trim();
        const rows = panel.users.filter(user => String(user.role || 'other').toLowerCase() === role && (!filter || [user.student_number, user.first_name, user.last_name, user.username, user.email, user.id].some(value => String(value || '').toLowerCase().includes(filter))));
        const pageSize = 8;
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        state.page = Math.min(Math.max(1, state.page), pages);
        const pageRows = rows.slice((state.page - 1) * pageSize, state.page * pageSize);
        const body = document.getElementById(`role-body-${role}`);
        if (body) body.innerHTML = pageRows.length ? pageRows.map(user => `<tr><td>${escapeHtml(user.student_number || '—')}</td><td><strong>${escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username)}</strong><small class="muted-block">${escapeHtml(user.username)}</small></td><td>${escapeHtml(user.email)}</td><td><span class="status-badge status-active">${escapeHtml(user.role)}</span></td><td>${formatDate(user.created_at)}</td><td class="table-actions"><button class="btn btn-secondary btn-sm" onclick="accountManagement.editUser(${user.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="accountManagement.deleteUser(${user.id})">Delete</button></td></tr>`).join('') : `<tr><td colspan="6" class="empty-state">No ${escapeHtml(role)} accounts match this filter.</td></tr>`;
        const count = document.getElementById(`role-count-${role}`); if (count) count.textContent = `${rows.length} account${rows.length === 1 ? '' : 's'}`;
        const pagination = document.getElementById(`role-pages-${role}`); if (!pagination) return;
        pagination.innerHTML = pages > 1 ? `<button class="btn btn-secondary btn-sm" ${state.page === 1 ? 'disabled' : ''} data-page-action="prev">Previous</button><span>Page ${state.page} of ${pages}</span><button class="btn btn-secondary btn-sm" ${state.page === pages ? 'disabled' : ''} data-page-action="next">Next</button>` : '';
        pagination.querySelector('[data-page-action="prev"]')?.addEventListener('click', () => { state.page--; renderRoleGrid(panel, role); });
        pagination.querySelector('[data-page-action="next"]')?.addEventListener('click', () => { state.page++; renderRoleGrid(panel, role); });
    }

    let roleAccessState = null;
    const SECTION_PARTS = {
        announcements: [{ value: 'view', label: 'View announcements' }],
        'dining-menu': [{ value: 'import', label: 'Import dining menu' }, { value: 'remove', label: 'Remove dining menu' }],
        notifications: [{ value: 'view', label: 'View notifications' }, { value: 'mark-read', label: 'Mark notifications as read' }]
    };
    const ALL_ROLES = '__all_roles__';
    const ALL_USERS = '__all_users__';

    async function loadAvailableCreateUserRoles() {
        const select = document.getElementById('create-user-role') || document.querySelector('#create-user-form select[name="role"]');
        if (!select) return;

        const previous = String(select.value || 'student').toLowerCase();
        try {
            const response = await fetch(`${api()}?endpoint=role-access`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok || data.success === false) return;
            const roles = [...new Set([
                'student',
                'instructor',
                ...Object.keys(data.access || {})
            ].map(role => String(role || '').trim().toLowerCase()).filter(Boolean))]
                .sort((left, right) => left.localeCompare(right));
            if (!roles.length) return;
            select.innerHTML = roles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(displayRole(role))}</option>`).join('');
            select.value = roles.includes(previous) ? previous : roles[0];
        } catch {
            // Keep the built-in options when the role endpoint is temporarily unavailable.
        }
    }

    async function loadRoleAccess(panel, preferredRole) {
        try {
            const [usersResponse, rolesResponse, platformsResponse] = await Promise.all([
                fetch(`${api()}?endpoint=user-role-access-list`),
                fetch(`${api()}?endpoint=role-access`),
                fetch(`${api()}?endpoint=platforms-list`)
            ]);
            const users = await usersResponse.json(); const roles = await rolesResponse.json(); const platforms = await platformsResponse.json();
            renderRoleAccess(panel, users.users || [], roles.access || {}, roles.parts || {}, platforms.platforms || [], preferredRole);
        } catch (error) { showRoleFeedback('Unable to load role access data.', 'error'); }
    }

    function renderRoleAccess(panel, users, roleAccess, roleParts, platforms, preferredRole) {
        const roleSelect = document.getElementById('role-access-role-select');
        const userSelect = document.getElementById('role-access-user-select');
        const host = document.getElementById('role-access-users');
        if (!roleSelect || !userSelect || !host) return;
        const roles = [...new Set([...Object.keys(roleAccess), ...users.map(user => user.role)].filter(Boolean))].sort();
        const previousUser = roleAccessState?.selectedUserId;
        const selectedRole = preferredRole === ALL_ROLES || roles.includes(preferredRole)
            ? preferredRole
            : (roleAccessState?.selectedRole === ALL_ROLES || roles.includes(roleAccessState?.selectedRole)
                ? roleAccessState.selectedRole
                : (roles[0] || 'student'));
        const eligibleUsers = usersForAssignedRole(users, selectedRole);
        const initialUser = selectedRole === ALL_ROLES
            ? ALL_USERS
            : (previousUser === ALL_USERS || eligibleUsers.some(user => user.id === previousUser) ? previousUser : eligibleUsers[0]?.id ?? users[0]?.id ?? ALL_USERS);
        roleAccessState = { panel, users, roleAccess, roleParts, platforms, roles, selectedRole, selectedUserId: initialUser, editPermissions: {} };
        roleSelect.innerHTML = [...roles, ALL_ROLES].map(role => `<option value="${escapeHtml(role)}" ${role === selectedRole ? 'selected' : ''}>${escapeHtml(role === ALL_ROLES ? 'All roles' : displayRole(role))}</option>`).join('');
        renderRoleAccessUserSelect();
        roleSelect.onchange = () => {
            roleAccessState.selectedRole = roleSelect.value;
            const eligible = usersForAssignedRole(roleAccessState.users, roleAccessState.selectedRole);
            roleAccessState.selectedUserId = roleAccessState.selectedRole === ALL_ROLES ? ALL_USERS : eligible[0]?.id ?? ALL_USERS;
            renderRoleAccessUserSelect();
            renderSelectedRoleUser();
        };
        userSelect.onchange = () => { roleAccessState.selectedUserId = userSelect.value === ALL_USERS ? ALL_USERS : Number(userSelect.value); renderSelectedRoleUser(); };
        renderSelectedRoleUser();
        const rolesHost = document.getElementById('role-access-roles');
        if (rolesHost) rolesHost.innerHTML = Object.entries(roleAccess).map(([role, sections]) => {
            const optional = (sections || []).map(displaySection).join(', ');
            return `<div class="role-default-row"><strong>${escapeHtml(displayRole(role))}</strong><span>Core: Dashboard, Chat and Profile${optional ? ` · Dashboard shows: ${escapeHtml(optional)}` : ' · Dashboard core overview only'}</span></div>`;
        }).join('');
    }

    function usersForAssignedRole(users, role) {
        const normalizedRole = String(role || '').trim().toLowerCase();
        if (normalizedRole === ALL_ROLES || normalizedRole === ALL_USERS) return users;
        const matching = users.filter(user => String(user.role || '').trim().toLowerCase() === normalizedRole);
        // A newly-created role may not have users yet. Keep all users available
        // in that case so the administrator can assign the new role immediately.
        return matching.length ? matching : users;
    }

    function renderRoleAccessUserSelect() {
        const state = roleAccessState;
        const userSelect = document.getElementById('role-access-user-select');
        if (!state || !userSelect) return;
        const users = usersForAssignedRole(state.users, state.selectedRole);
        if (state.selectedRole === ALL_ROLES) state.selectedUserId = ALL_USERS;
        else if (state.selectedUserId !== ALL_USERS && !users.some(user => user.id === state.selectedUserId)) state.selectedUserId = users[0]?.id ?? ALL_USERS;
        const allUsersOption = `<option value="${ALL_USERS}" ${state.selectedUserId === ALL_USERS ? 'selected' : ''}>All users</option>`;
        const userOptions = users.map(user => `<option value="${user.id}" ${user.id === state.selectedUserId ? 'selected' : ''}>${escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username)} · ${escapeHtml(displayRole(user.role))}</option>`).join('');
        userSelect.innerHTML = allUsersOption + userOptions;
    }

    function renderSelectedRoleUser() {
        const state = roleAccessState;
        const host = document.getElementById('role-access-users');
        if (!state || !host) return;
        const isAllRoles = state.selectedRole === ALL_ROLES;
        const isAllUsers = state.selectedUserId === ALL_USERS;
        const normalRoles = state.roles.filter(role => role !== ALL_ROLES);
        const sourceRole = isAllRoles ? (normalRoles[0] || 'student') : state.selectedRole;
        const user = state.users.find(item => item.id === state.selectedUserId);
        if (!user && !isAllUsers && !isAllRoles) { host.innerHTML = '<div class="empty-state">No users available.</div>'; return; }
        const usesCurrentAccess = Boolean(user) && String(user.role).toLowerCase() === String(sourceRole).toLowerCase() && !isAllRoles;
        const allowed = usesCurrentAccess ? (user.allowed_sections || []) : (state.roleAccess[sourceRole] || []);
        const permissions = usesCurrentAccess ? (user.section_permissions || {}) : (state.roleParts[sourceRole] || {});
        state.editPermissions = Object.fromEntries(Object.entries(permissions).map(([section, parts]) => [section, section === 'dining-menu' ? (parts || []).filter(part => !['breakfast', 'lunch'].includes(String(part).toLowerCase())) : [...(parts || [])]]));
        const sections = ['platforms', 'announcements', 'dining-menu', 'notifications'];
        const dashboardSections = allowed.filter(section => sections.includes(section)).map(displaySection);
        const dashboardSummary = dashboardSections.length ? dashboardSections.join(', ') : 'No optional sections yet';
        const targetTitle = isAllRoles ? 'All roles' : (isAllUsers ? 'All users' : ([user.first_name, user.last_name].filter(Boolean).join(' ') || user?.username || 'Selected user'));
        const targetDetail = isAllRoles
            ? 'Shared defaults for every role in the portal.'
            : (isAllUsers ? 'A common access policy for every user account.' : `${user.student_number || 'No student number'} · ${user.email} · current role: ${displayRole(user.role)}`);
        const saveButton = !isAllUsers && !isAllRoles ? '<button class="btn" data-save-role-access><i class="fas fa-save"></i> Save for this user</button>' : '';
        const roleButton = isAllRoles
            ? '<button class="btn" data-apply-all-roles><i class="fas fa-layer-group"></i> Apply to all roles</button>'
            : `<button class="btn btn-secondary" data-apply-role-access><i class="fas fa-users-cog"></i> Apply to all ${escapeHtml(displayRole(state.selectedRole))} users</button>`;
        const allUsersButton = isAllUsers ? '<button class="btn btn-secondary" data-apply-all-users><i class="fas fa-users"></i> Apply to all users</button>' : '';
        host.innerHTML = `<article class="role-access-user selected-user-access" data-user-id="${escapeHtml(isAllUsers ? ALL_USERS : (user?.id || ''))}"><div class="role-access-user-head"><div><strong>${escapeHtml(targetTitle)}</strong><small>${escapeHtml(targetDetail)}</small></div><span class="target-role-badge">${isAllRoles || isAllUsers ? 'Bulk access' : `Assign ${escapeHtml(displayRole(state.selectedRole))}`}</span></div><div class="core-access-note"><div><i class="fas fa-check-circle"></i> Core access is always available.</div></div><div class="dashboard-access-card"><div class="dashboard-access-card-heading"><i class="fas fa-gauge-high"></i><span><strong>Common dashboard</strong><small>Shows: ${escapeHtml(dashboardSummary || 'Platforms, Announcements and Dining menu by default')}</small></span></div><div class="dashboard-access-card-details"><span><i class="fas fa-comments"></i> Chat: realtime people and conversations</span><span><i class="fas fa-user-circle"></i> Profile: account details and password controls</span></div></div><div class="role-section-grid">${sections.map(section => `<label class="section-access-choice"><input type="checkbox" data-section="${section}" ${allowed.includes(section) ? 'checked' : ''}><span><strong>${escapeHtml(displaySection(section))}</strong><small data-parts-summary="${section}">${escapeHtml(partsSummary(section, state.editPermissions[section]))}</small></span><i class="fas fa-chevron-right"></i></label>`).join('')}</div><div class="role-access-save-actions">${saveButton}${roleButton}${allUsersButton}</div></article>`;
        host.querySelectorAll('[data-section]').forEach(checkbox => checkbox.addEventListener('change', event => {
            const section = event.currentTarget.dataset.section;
            if (!event.currentTarget.checked) { delete state.editPermissions[section]; updatePartsSummary(section); return; }
            openSectionParts(section, event.currentTarget);
        }));
        host.querySelectorAll('.section-access-choice span').forEach(label => label.addEventListener('click', event => { const checkbox = event.currentTarget.closest('label').querySelector('[data-section]'); if (checkbox.checked) { event.preventDefault(); openSectionParts(checkbox.dataset.section, checkbox); } }));
        host.querySelector('[data-save-role-access]')?.addEventListener('click', saveSelectedRoleAccess);
        host.querySelector('[data-apply-role-access]')?.addEventListener('click', applySelectedRoleAccessToRole);
        host.querySelector('[data-apply-all-roles]')?.addEventListener('click', applySelectedRoleAccessToAllRoles);
        host.querySelector('[data-apply-all-users]')?.addEventListener('click', applySelectedRoleAccessToAllUsers);
    }

    function openSectionParts(section, checkbox) {
        const state = roleAccessState;
        const modal = document.getElementById('section-parts-modal');
        const options = section === 'platforms' ? state.platforms.map(item => ({ value: item.name, label: item.name })) : SECTION_PARTS[section];
        const selected = new Set(state.editPermissions[section] || []);
        document.getElementById('section-parts-title').textContent = `${displaySection(section)} access`;
        document.querySelector('#section-parts-modal .profile-dialog > p').textContent = section === 'dining-menu'
            ? 'Dining menu viewing is included. Choose optional import or remove actions.'
            : 'Select exactly which parts of this section the user may use.';
        document.getElementById('section-parts-options').innerHTML = options.map(option => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.has(option.value) ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('') || '<p>No parts are available for this section.</p>';
        modal.classList.add('show');
        const cancel = () => { if (section !== 'dining-menu' && !(state.editPermissions[section] || []).length) checkbox.checked = false; modal.classList.remove('show'); updatePartsSummary(section); };
        document.getElementById('section-parts-close').onclick = cancel;
        document.getElementById('section-parts-cancel').onclick = cancel;
        document.getElementById('section-parts-save').onclick = () => { const parts = [...document.querySelectorAll('#section-parts-options input:checked')].map(input => input.value); if (!parts.length && section !== 'dining-menu') { showRoleFeedback(`Choose which parts of ${displaySection(section)} to grant.`, 'error'); return; } state.editPermissions[section] = parts; checkbox.checked = true; modal.classList.remove('show'); updatePartsSummary(section); };
    }

    function updatePartsSummary(section) { const target = document.querySelector(`[data-parts-summary="${section}"]`); if (target) target.textContent = partsSummary(section, roleAccessState.editPermissions[section]); }
    function partsSummary(section, parts) { return Array.isArray(parts) && parts.length ? parts.map(part => displayPart(section, part)).join(', ') : section === 'dining-menu' ? 'View dining menu only' : `Choose ${displaySection(section).toLowerCase()} access`; }
    function displayPart(section, value) { if (section === 'dining-menu') return value === 'import' ? 'Import dining menu' : value === 'remove' ? 'Remove dining menu' : value; if (section === 'notifications') return value === 'mark-read' ? 'Mark as read' : value === 'view' ? 'View' : value; if (section === 'announcements' && value === 'view') return 'View'; return value; }
    function displaySection(value) { return ({ platforms: 'Platforms', announcements: 'Announcements', 'dining-menu': 'Dining menu', notifications: 'Notifications' })[value] || value; }
    function displayRole(value) { return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }

    function collectSelectedRoleAccess() {
        const state = roleAccessState;
        const card = document.querySelector('.selected-user-access');
        const sections = [...card.querySelectorAll('[data-section]:checked')].map(input => input.dataset.section);
        const missing = sections.find(section => section !== 'dining-menu' && !(state.editPermissions[section] || []).length);
        if (missing) { showRoleFeedback(`Choose which parts of ${displaySection(missing)} to grant.`, 'error'); openSectionParts(missing, card.querySelector(`[data-section="${missing}"]`)); return null; }
        const selectedPlatforms = new Set(state.editPermissions.platforms || []);
        return { sections, sectionPermissions: Object.fromEntries(sections.map(section => [section, state.editPermissions[section] || []])), platformAccess: Object.fromEntries(state.platforms.map(item => [item.name, selectedPlatforms.has(item.name)])) };
    }

    async function saveSelectedRoleAccess() {
        const state = roleAccessState;
        const user = state.users.find(item => item.id === state.selectedUserId);
        if (!user) { showRoleFeedback('Choose a specific user before saving an individual policy.', 'error'); return; }
        const access = collectSelectedRoleAccess();
        if (!access) return;
        const payload = { action: 'user-role-access-update', current_admin_id: state.panel.currentAdmin.id, user_id: user.id, username: user.username, role: state.selectedRole, allowed_sections: access.sections, section_permissions: access.sectionPermissions, platform_access: access.platformAccess };
        const result = await postJson(payload);
        showRoleFeedback(result.success ? 'Role and section access saved.' : (result.error || 'Unable to save role access.'), result.success ? 'success' : 'error');
        if (result.success) { state.panel.loadUsers(); await loadRoleAccess(state.panel, state.selectedRole); }
    }

    async function applySelectedRoleAccessToRole() {
        const state = roleAccessState;
        if (state.selectedRole === ALL_ROLES) return applySelectedRoleAccessToAllRoles();
        const access = collectSelectedRoleAccess();
        if (!access) return;
        const payload = { action: 'role-access-apply-users', current_admin_id: state.panel.currentAdmin.id, role: state.selectedRole, allowed_sections: access.sections, section_permissions: access.sectionPermissions, platform_access: access.platformAccess };
        const result = await postJson(payload);
        showRoleFeedback(result.success ? (result.message || 'Access applied to all users with this role.') : (result.error || 'Unable to apply role access.'), result.success ? 'success' : 'error');
        if (result.success) { state.panel.loadUsers(); await loadRoleAccess(state.panel, state.selectedRole); }
    }

    async function applySelectedRoleAccessToAllRoles() {
        const state = roleAccessState;
        if (!window.confirm('Apply this dashboard, section, and platform policy to every role?')) return;
        const access = collectSelectedRoleAccess();
        if (!access) return;
        const payload = { action: 'role-access-apply-all-roles', current_admin_id: state.panel.currentAdmin.id, allowed_sections: access.sections, section_permissions: access.sectionPermissions, platform_access: access.platformAccess };
        const result = await postJson(payload);
        showRoleFeedback(result.success ? (result.message || 'Access applied to all roles.') : (result.error || 'Unable to apply access to all roles.'), result.success ? 'success' : 'error');
        if (result.success) { state.panel.loadUsers(); await loadRoleAccess(state.panel, ALL_ROLES); }
    }

    async function applySelectedRoleAccessToAllUsers() {
        const state = roleAccessState;
        if (!window.confirm('Apply this dashboard, section, and platform policy to every user account?')) return;
        const access = collectSelectedRoleAccess();
        if (!access) return;
        const payload = { action: 'user-role-access-apply-all-users', current_admin_id: state.panel.currentAdmin.id, allowed_sections: access.sections, section_permissions: access.sectionPermissions, platform_access: access.platformAccess };
        const result = await postJson(payload);
        showRoleFeedback(result.success ? (result.message || 'Access applied to all users.') : (result.error || 'Unable to apply access to all users.'), result.success ? 'success' : 'error');
        if (result.success) { state.panel.loadUsers(); await loadRoleAccess(state.panel, state.selectedRole); }
    }

    async function uploadRoleAccess(panel, file) {
        if (!file) return;
        const form = new FormData(); form.append('action', 'role-access-upload'); form.append('current_admin_id', panel.currentAdmin.id); form.append('file', file);
        try { const result = await (await fetch(api(), { method: 'POST', body: form })).json(); showRoleFeedback(result.success ? `${result.message}${result.errors?.length ? ` ${result.errors.join(' ')}` : ''}` : (result.error || 'Import failed.'), result.success ? 'success' : 'error'); if (result.success) loadRoleAccess(panel); }
        catch { showRoleFeedback('Import failed. Please check the file format.', 'error'); }
    }

    function showRoleFeedback(message, type) { const element = document.getElementById('role-access-feedback'); if (element) { element.textContent = message; element.className = `role-access-feedback ${type}`; } }

    function showUserModal(panel, user) {
        editingUserId = user ? user.id : null;
        document.getElementById('user-modal-title').textContent = editingUserId ? 'Edit User / Instructor' : 'Add User / Instructor';
        document.getElementById('user-id').value = user ? user.id : '';
        document.getElementById('user-username').value = user ? user.username : '';
        document.getElementById('user-email').value = user ? user.email : '';
        document.getElementById('user-role').value = user ? (user.role || 'student') : 'student';
        document.getElementById('user-password').value = '';
        document.getElementById('user-password').required = !editingUserId;
        document.getElementById('user-manage-modal').style.display = 'block';
    }

    function closeUserModal() {
        document.getElementById('user-manage-modal').style.display = 'none';
        editingUserId = null;
    }

    async function saveUser(event, panel) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        const basePayload = {
            current_admin_id: panel.currentAdmin.id,
            username: data.username,
            email: data.email,
            role: data.role
        };

        let result;
        if (editingUserId) {
            result = await postJson({ action: 'user-update', id: Number(data.id), ...basePayload });
            if (result.success && data.password) {
                result = await postJson({ action: 'user-change-password', current_admin_id: panel.currentAdmin.id, id: Number(data.id), new_password: data.password });
            }
        } else {
            result = await postJson({ action: 'user-create', password: data.password, ...basePayload });
        }

        if (result.success) {
            panel.showNotification(result.message || 'Account saved successfully', 'success');
            closeUserModal();
            panel.loadUsers();
            panel.loadDashboardStats();
            return;
        }

        panel.showNotification(result.error || 'Unable to save account', 'error');
    }

    async function saveCreatedUser(event, panel) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const result = await postJson({ action: 'user-create', current_admin_id: panel.currentAdmin.id, ...data });
        if (result.success) {
            panel.showNotification('Account created successfully', 'success');
            event.currentTarget.reset();
            panel.loadUsers();
            panel.loadDashboardStats();
        } else {
            panel.showNotification(result.error || 'Unable to create account', 'error');
        }
    }

    async function postJson(payload) {
        const response = await fetch(api(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    function formatDate(value) {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
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

    window.accountManagement = {
        editUser(id) {
            const panel = window.adminPanel;
            const user = panel && panel.users ? panel.users.find(item => item.id === id) : null;
            if (user) showUserModal(panel, user);
        },
        async deleteUser(id) {
            const panel = window.adminPanel;
            if (!panel || !confirm('Delete this user account?')) return;

            const result = await postJson({ action: 'user-delete', current_admin_id: panel.currentAdmin.id, id });
            if (result.success) {
                panel.showNotification('User deleted successfully', 'success');
                panel.loadUsers();
                panel.loadDashboardStats();
            } else {
                panel.showNotification(result.error || 'Unable to delete user', 'error');
            }
        }
    };
})();
