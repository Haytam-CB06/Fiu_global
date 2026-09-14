// Admin Panel JavaScript Functions
console.log('admin.js script loaded');
// Read admin API endpoint from global config (set in config.js)
const ADMIN_API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_API_BASE_URL) || window.ADMIN_API_BASE_URL;

// Dynamic administration views are rendered by JavaScript, so they cannot use
// the static data-i18n attributes used by the shell. Keep their language copy
// in the same runtime catalog and expose small helpers to the enhancement file.
(function registerAdminDynamicTranslations() {
    const catalog = {
        en: {
            'admin.dynamic.ui.close': 'Close', 'admin.dynamic.ui.edit': 'Edit', 'admin.dynamic.ui.delete': 'Delete', 'admin.dynamic.ui.save': 'Save', 'admin.dynamic.ui.add': 'Add', 'admin.dynamic.ui.cancel': 'Cancel', 'admin.dynamic.ui.previous': 'Previous', 'admin.dynamic.ui.next': 'Next', 'admin.dynamic.ui.refresh': 'Refresh', 'admin.dynamic.ui.import': 'Import', 'admin.dynamic.ui.upload': 'Upload', 'admin.dynamic.ui.loading': 'Loading…', 'admin.dynamic.ui.unavailable': 'Unavailable', 'admin.dynamic.ui.notAvailable': 'Not available', 'admin.dynamic.ui.noEmail': 'No email', 'admin.dynamic.ui.unnamedUser': 'Unnamed user', 'admin.dynamic.ui.defaultCampus': 'Campus', 'admin.dynamic.ui.defaultAdmin': 'admin', 'admin.dynamic.ui.active': 'Active', 'admin.dynamic.ui.inactive': 'Inactive', 'admin.dynamic.ui.online': 'Online', 'admin.dynamic.ui.offline': 'Offline', 'admin.dynamic.ui.disabled': 'Disabled', 'admin.dynamic.ui.notAdmin': 'Not an admin', 'admin.dynamic.ui.created': 'Created', 'admin.dynamic.ui.by': 'By', 'admin.dynamic.ui.type': 'Type', 'admin.dynamic.ui.day': 'Day', 'admin.dynamic.ui.recurring': 'Recurring', 'admin.dynamic.ui.dailyMenu': 'Daily menu', 'admin.dynamic.ui.breakfast': 'Breakfast', 'admin.dynamic.ui.lunch': 'Lunch', 'admin.dynamic.ui.notSet': 'Not set', 'admin.dynamic.ui.noMenu': 'No menu', 'admin.dynamic.ui.student': 'Student', 'admin.dynamic.ui.instructor': 'Instructor', 'admin.dynamic.ui.user': 'User', 'admin.dynamic.ui.other': 'Other', 'admin.dynamic.ui.all': 'All',
            'admin.dynamic.count.admin.one': '{count} admin', 'admin.dynamic.count.admin.other': '{count} admins', 'admin.dynamic.count.user.one': '{count} user', 'admin.dynamic.count.user.other': '{count} users', 'admin.dynamic.count.menu.one': '{count} menu', 'admin.dynamic.count.menu.other': '{count} menus', 'admin.dynamic.count.row.one': '{count} row', 'admin.dynamic.count.row.other': '{count} rows', 'admin.dynamic.count.total': '{count} total', 'admin.dynamic.count.today': '{count} today', 'admin.dynamic.count.opens': '{count} opens', 'admin.dynamic.page.summary': 'Showing {shown} of {total} · Page {page} of {pages}',
            'admin.dynamic.message.accessDenied': 'Access denied. Admin management is restricted to administrators only.', 'admin.dynamic.message.noRecentLogins': 'No recent logins', 'admin.dynamic.message.noUsers': 'No users found.', 'admin.dynamic.message.noPlatforms': 'No platforms found.', 'admin.dynamic.message.noAnnouncements': 'No announcements found.', 'admin.dynamic.message.noDining': 'No dining menus found.', 'admin.dynamic.message.noHolidays': 'No holidays found for this year.', 'admin.dynamic.message.saved': 'Saved successfully.', 'admin.dynamic.message.created': 'Created successfully.', 'admin.dynamic.message.updated': 'Updated successfully.', 'admin.dynamic.message.deleted': 'Deleted successfully.', 'admin.dynamic.message.operationFailed': 'The action could not be completed. Please try again.', 'admin.dynamic.message.failedDetail': 'The action could not be completed: {detail}', 'admin.dynamic.message.dateUnavailable': 'This date is not available: {detail}', 'admin.dynamic.message.userPromoted': 'User promoted to admin.', 'admin.dynamic.message.adminDemoted': 'Admin demoted to user.', 'admin.dynamic.message.addAdmin': 'Add Admin', 'admin.dynamic.message.editAdmin': 'Edit Admin', 'admin.dynamic.message.addAnnouncement': 'Add Announcement', 'admin.dynamic.message.editAnnouncement': 'Edit Announcement', 'admin.dynamic.message.addDiningMenu': 'Add Dining Menu', 'admin.dynamic.message.editDiningMenu': 'Edit Dining Menu', 'admin.dynamic.message.addHoliday': 'Add Holiday', 'admin.dynamic.message.editHoliday': 'Edit Holiday', 'admin.dynamic.message.deleteConfirm': 'Are you sure you want to delete this item?', 'admin.dynamic.message.promoteConfirm': 'Promote {username} to admin?', 'admin.dynamic.message.demoteConfirm': 'Demote {username} to a regular user?', 'admin.dynamic.message.deleteAllHolidaysConfirm': 'Delete all holidays for {year}? This action cannot be undone.', 'admin.dynamic.message.fixRows': 'Please fix these rows:', 'admin.dynamic.message.filePreviewError': 'The file could not be previewed. Check that it is a valid CSV or Excel file.', 'admin.dynamic.message.importFailed': 'The holiday schedule could not be imported. Please try again.', 'admin.dynamic.message.importNothing': 'Nothing was imported. Fix the errors shown in the table.', 'admin.dynamic.message.importSuccess': 'Holiday schedule imported successfully. {rows}', 'admin.dynamic.message.exportFailed': 'Unable to export holidays.', 'admin.dynamic.message.templateFailed': 'Unable to download the template.', 'admin.dynamic.message.selectDay': 'Select day', 'admin.dynamic.message.datePlaceholder': 'MM/DD/YYYY', 'admin.dynamic.message.holidayNamePlaceholder': 'Holiday name', 'admin.dynamic.message.dateRow': 'Date for row {row}', 'admin.dynamic.message.dayRow': 'Day of week for row {row}', 'admin.dynamic.message.holidayNameRow': 'Holiday name for row {row}', 'admin.dynamic.message.removeRow': 'Remove row {row}'
        },
        tr: {
            'admin.dynamic.ui.close': 'Kapat', 'admin.dynamic.ui.edit': 'Düzenle', 'admin.dynamic.ui.delete': 'Sil', 'admin.dynamic.ui.save': 'Kaydet', 'admin.dynamic.ui.add': 'Ekle', 'admin.dynamic.ui.cancel': 'İptal', 'admin.dynamic.ui.previous': 'Önceki', 'admin.dynamic.ui.next': 'Sonraki', 'admin.dynamic.ui.refresh': 'Yenile', 'admin.dynamic.ui.import': 'İçe aktar', 'admin.dynamic.ui.upload': 'Yükle', 'admin.dynamic.ui.loading': 'Yükleniyor…', 'admin.dynamic.ui.unavailable': 'Kullanılamıyor', 'admin.dynamic.ui.notAvailable': 'Mevcut değil', 'admin.dynamic.ui.noEmail': 'E-posta yok', 'admin.dynamic.ui.unnamedUser': 'Adsız kullanıcı', 'admin.dynamic.ui.defaultCampus': 'Kampüs', 'admin.dynamic.ui.defaultAdmin': 'yönetici', 'admin.dynamic.ui.active': 'Etkin', 'admin.dynamic.ui.inactive': 'Pasif', 'admin.dynamic.ui.online': 'Çevrimiçi', 'admin.dynamic.ui.offline': 'Çevrimdışı', 'admin.dynamic.ui.disabled': 'Devre dışı', 'admin.dynamic.ui.notAdmin': 'Yönetici değil', 'admin.dynamic.ui.created': 'Oluşturuldu', 'admin.dynamic.ui.by': 'Oluşturan', 'admin.dynamic.ui.type': 'Tür', 'admin.dynamic.ui.day': 'Gün', 'admin.dynamic.ui.recurring': 'Tekrarlanan', 'admin.dynamic.ui.dailyMenu': 'Günlük menü', 'admin.dynamic.ui.breakfast': 'Kahvaltı', 'admin.dynamic.ui.lunch': 'Öğle yemeği', 'admin.dynamic.ui.notSet': 'Ayarlanmadı', 'admin.dynamic.ui.noMenu': 'Menü yok', 'admin.dynamic.ui.student': 'Öğrenci', 'admin.dynamic.ui.instructor': 'Eğitmen', 'admin.dynamic.ui.user': 'Kullanıcı', 'admin.dynamic.ui.other': 'Diğer', 'admin.dynamic.ui.all': 'Tümü',
            'admin.dynamic.count.admin.other': '{count} yönetici', 'admin.dynamic.count.user.other': '{count} kullanıcı', 'admin.dynamic.count.menu.other': '{count} menü', 'admin.dynamic.count.row.other': '{count} satır', 'admin.dynamic.count.total': 'Toplam {count}', 'admin.dynamic.count.today': 'Bugün {count}', 'admin.dynamic.count.opens': '{count} açılış', 'admin.dynamic.page.summary': '{total} kaydın {shown} adedi gösteriliyor · Sayfa {page}/{pages}',
            'admin.dynamic.message.accessDenied': 'Erişim reddedildi. Yönetici yönetimi yalnızca yöneticilerle sınırlıdır.', 'admin.dynamic.message.noRecentLogins': 'Yakın zamanda oturum açma yok', 'admin.dynamic.message.noUsers': 'Kullanıcı bulunamadı.', 'admin.dynamic.message.noPlatforms': 'Platform bulunamadı.', 'admin.dynamic.message.noAnnouncements': 'Duyuru bulunamadı.', 'admin.dynamic.message.noDining': 'Yemek menüsü bulunamadı.', 'admin.dynamic.message.noHolidays': 'Bu yıl için tatil bulunamadı.', 'admin.dynamic.message.saved': 'Başarıyla kaydedildi.', 'admin.dynamic.message.created': 'Başarıyla oluşturuldu.', 'admin.dynamic.message.updated': 'Başarıyla güncellendi.', 'admin.dynamic.message.deleted': 'Başarıyla silindi.', 'admin.dynamic.message.operationFailed': 'İşlem tamamlanamadı. Lütfen tekrar deneyin.', 'admin.dynamic.message.failedDetail': 'İşlem tamamlanamadı: {detail}', 'admin.dynamic.message.dateUnavailable': 'Bu tarih uygun değil: {detail}', 'admin.dynamic.message.userPromoted': 'Kullanıcı yönetici yapıldı.', 'admin.dynamic.message.adminDemoted': 'Yönetici normal kullanıcı yapıldı.', 'admin.dynamic.message.addAdmin': 'Yönetici Ekle', 'admin.dynamic.message.editAdmin': 'Yöneticiyi Düzenle', 'admin.dynamic.message.addAnnouncement': 'Duyuru Ekle', 'admin.dynamic.message.editAnnouncement': 'Duyuruyu Düzenle', 'admin.dynamic.message.addDiningMenu': 'Yemek Menüsü Ekle', 'admin.dynamic.message.editDiningMenu': 'Yemek Menüsünü Düzenle', 'admin.dynamic.message.addHoliday': 'Tatil Ekle', 'admin.dynamic.message.editHoliday': 'Tatili Düzenle', 'admin.dynamic.message.deleteConfirm': 'Bu öğeyi silmek istediğinizden emin misiniz?', 'admin.dynamic.message.promoteConfirm': '{username} kullanıcısı yönetici yapılsın mı?', 'admin.dynamic.message.demoteConfirm': '{username} kullanıcısı normal kullanıcı yapılsın mı?', 'admin.dynamic.message.deleteAllHolidaysConfirm': '{year} yılı için tüm tatiller silinsin mi? Bu işlem geri alınamaz.', 'admin.dynamic.message.fixRows': 'Lütfen şu satırları düzeltin:', 'admin.dynamic.message.filePreviewError': 'Dosya önizlenemedi. Geçerli bir CSV veya Excel dosyası olduğunu kontrol edin.', 'admin.dynamic.message.importFailed': 'Tatil takvimi içe aktarılamadı. Lütfen tekrar deneyin.', 'admin.dynamic.message.importNothing': 'Hiçbir şey içe aktarılmadı. Tabloda gösterilen hataları düzeltin.', 'admin.dynamic.message.importSuccess': 'Tatil takvimi başarıyla içe aktarıldı. {rows}', 'admin.dynamic.message.exportFailed': 'Tatiller dışa aktarılamadı.', 'admin.dynamic.message.templateFailed': 'Şablon indirilemedi.', 'admin.dynamic.message.selectDay': 'Gün seçin', 'admin.dynamic.message.datePlaceholder': 'AA/GG/YYYY', 'admin.dynamic.message.holidayNamePlaceholder': 'Tatil adı', 'admin.dynamic.message.dateRow': '{row}. satır tarihi', 'admin.dynamic.message.dayRow': '{row}. satırın günü', 'admin.dynamic.message.holidayNameRow': '{row}. satır için tatil adı', 'admin.dynamic.message.removeRow': '{row}. satırı kaldır'
        },
        fr: {
            'admin.dynamic.ui.close': 'Fermer', 'admin.dynamic.ui.edit': 'Modifier', 'admin.dynamic.ui.delete': 'Supprimer', 'admin.dynamic.ui.save': 'Enregistrer', 'admin.dynamic.ui.add': 'Ajouter', 'admin.dynamic.ui.cancel': 'Annuler', 'admin.dynamic.ui.previous': 'Précédent', 'admin.dynamic.ui.next': 'Suivant', 'admin.dynamic.ui.refresh': 'Actualiser', 'admin.dynamic.ui.import': 'Importer', 'admin.dynamic.ui.upload': 'Téléverser', 'admin.dynamic.ui.loading': 'Chargement…', 'admin.dynamic.ui.unavailable': 'Indisponible', 'admin.dynamic.ui.notAvailable': 'Non disponible', 'admin.dynamic.ui.noEmail': 'Aucun e-mail', 'admin.dynamic.ui.unnamedUser': 'Utilisateur sans nom', 'admin.dynamic.ui.defaultCampus': 'Campus', 'admin.dynamic.ui.defaultAdmin': 'administrateur', 'admin.dynamic.ui.active': 'Actif', 'admin.dynamic.ui.inactive': 'Inactif', 'admin.dynamic.ui.online': 'En ligne', 'admin.dynamic.ui.offline': 'Hors ligne', 'admin.dynamic.ui.disabled': 'Désactivé', 'admin.dynamic.ui.notAdmin': 'Pas administrateur', 'admin.dynamic.ui.created': 'Créé', 'admin.dynamic.ui.by': 'Par', 'admin.dynamic.ui.type': 'Type', 'admin.dynamic.ui.day': 'Jour', 'admin.dynamic.ui.recurring': 'Récurrent', 'admin.dynamic.ui.dailyMenu': 'Menu quotidien', 'admin.dynamic.ui.breakfast': 'Petit-déjeuner', 'admin.dynamic.ui.lunch': 'Déjeuner', 'admin.dynamic.ui.notSet': 'Non défini', 'admin.dynamic.ui.noMenu': 'Aucun menu', 'admin.dynamic.ui.student': 'Étudiant', 'admin.dynamic.ui.instructor': 'Enseignant', 'admin.dynamic.ui.user': 'Utilisateur', 'admin.dynamic.ui.other': 'Autre', 'admin.dynamic.ui.all': 'Tous',
            'admin.dynamic.count.admin.one': '{count} administrateur', 'admin.dynamic.count.admin.other': '{count} administrateurs', 'admin.dynamic.count.user.one': '{count} utilisateur', 'admin.dynamic.count.user.other': '{count} utilisateurs', 'admin.dynamic.count.menu.one': '{count} menu', 'admin.dynamic.count.menu.other': '{count} menus', 'admin.dynamic.count.row.one': '{count} ligne', 'admin.dynamic.count.row.other': '{count} lignes', 'admin.dynamic.count.total': '{count} au total', 'admin.dynamic.count.today': '{count} aujourd’hui', 'admin.dynamic.count.opens': '{count} ouvertures', 'admin.dynamic.page.summary': '{shown} sur {total} affichés · Page {page} sur {pages}',
            'admin.dynamic.message.accessDenied': 'Accès refusé. La gestion des administrateurs est réservée aux administrateurs.', 'admin.dynamic.message.noRecentLogins': 'Aucune connexion récente', 'admin.dynamic.message.noUsers': 'Aucun utilisateur trouvé.', 'admin.dynamic.message.noPlatforms': 'Aucune plateforme trouvée.', 'admin.dynamic.message.noAnnouncements': 'Aucune annonce trouvée.', 'admin.dynamic.message.noDining': 'Aucun menu trouvé.', 'admin.dynamic.message.noHolidays': 'Aucun jour férié trouvé pour cette année.', 'admin.dynamic.message.saved': 'Enregistré avec succès.', 'admin.dynamic.message.created': 'Créé avec succès.', 'admin.dynamic.message.updated': 'Mis à jour avec succès.', 'admin.dynamic.message.deleted': 'Supprimé avec succès.', 'admin.dynamic.message.operationFailed': 'L’action n’a pas pu être effectuée. Réessayez.', 'admin.dynamic.message.failedDetail': 'L’action n’a pas pu être effectuée : {detail}', 'admin.dynamic.message.dateUnavailable': 'Cette date n’est pas disponible : {detail}', 'admin.dynamic.message.userPromoted': 'Utilisateur promu administrateur.', 'admin.dynamic.message.adminDemoted': 'Administrateur rétrogradé en utilisateur.', 'admin.dynamic.message.addAdmin': 'Ajouter un administrateur', 'admin.dynamic.message.editAdmin': 'Modifier l’administrateur', 'admin.dynamic.message.addAnnouncement': 'Ajouter une annonce', 'admin.dynamic.message.editAnnouncement': 'Modifier l’annonce', 'admin.dynamic.message.addDiningMenu': 'Ajouter un menu', 'admin.dynamic.message.editDiningMenu': 'Modifier le menu', 'admin.dynamic.message.addHoliday': 'Ajouter un jour férié', 'admin.dynamic.message.editHoliday': 'Modifier le jour férié', 'admin.dynamic.message.deleteConfirm': 'Voulez-vous vraiment supprimer cet élément ?', 'admin.dynamic.message.promoteConfirm': 'Promouvoir {username} administrateur ?', 'admin.dynamic.message.demoteConfirm': 'Rétrograder {username} en utilisateur standard ?', 'admin.dynamic.message.deleteAllHolidaysConfirm': 'Supprimer tous les jours fériés de {year} ? Cette action est irréversible.', 'admin.dynamic.message.fixRows': 'Corrigez ces lignes :', 'admin.dynamic.message.filePreviewError': 'Le fichier ne peut pas être prévisualisé. Vérifiez qu’il s’agit d’un fichier CSV ou Excel valide.', 'admin.dynamic.message.importFailed': 'Le calendrier des jours fériés n’a pas pu être importé. Réessayez.', 'admin.dynamic.message.importNothing': 'Aucune donnée n’a été importée. Corrigez les erreurs affichées dans le tableau.', 'admin.dynamic.message.importSuccess': 'Calendrier des jours fériés importé. {rows}', 'admin.dynamic.message.exportFailed': 'Impossible d’exporter les jours fériés.', 'admin.dynamic.message.templateFailed': 'Impossible de télécharger le modèle.', 'admin.dynamic.message.selectDay': 'Sélectionner un jour', 'admin.dynamic.message.datePlaceholder': 'JJ/MM/AAAA', 'admin.dynamic.message.holidayNamePlaceholder': 'Nom du jour férié', 'admin.dynamic.message.dateRow': 'Date de la ligne {row}', 'admin.dynamic.message.dayRow': 'Jour de la semaine de la ligne {row}', 'admin.dynamic.message.holidayNameRow': 'Nom du jour férié de la ligne {row}', 'admin.dynamic.message.removeRow': 'Supprimer la ligne {row}'
        },
        ru: {
            'admin.dynamic.ui.close': 'Закрыть', 'admin.dynamic.ui.edit': 'Изменить', 'admin.dynamic.ui.delete': 'Удалить', 'admin.dynamic.ui.save': 'Сохранить', 'admin.dynamic.ui.add': 'Добавить', 'admin.dynamic.ui.cancel': 'Отмена', 'admin.dynamic.ui.previous': 'Назад', 'admin.dynamic.ui.next': 'Далее', 'admin.dynamic.ui.refresh': 'Обновить', 'admin.dynamic.ui.import': 'Импортировать', 'admin.dynamic.ui.upload': 'Загрузить', 'admin.dynamic.ui.loading': 'Загрузка…', 'admin.dynamic.ui.unavailable': 'Недоступно', 'admin.dynamic.ui.notAvailable': 'Нет данных', 'admin.dynamic.ui.noEmail': 'Нет эл. почты', 'admin.dynamic.ui.unnamedUser': 'Пользователь без имени', 'admin.dynamic.ui.defaultCampus': 'Кампус', 'admin.dynamic.ui.defaultAdmin': 'администратор', 'admin.dynamic.ui.active': 'Активно', 'admin.dynamic.ui.inactive': 'Неактивно', 'admin.dynamic.ui.online': 'В сети', 'admin.dynamic.ui.offline': 'Не в сети', 'admin.dynamic.ui.disabled': 'Отключено', 'admin.dynamic.ui.notAdmin': 'Не администратор', 'admin.dynamic.ui.created': 'Создано', 'admin.dynamic.ui.by': 'Автор', 'admin.dynamic.ui.type': 'Тип', 'admin.dynamic.ui.day': 'День', 'admin.dynamic.ui.recurring': 'Повторяется', 'admin.dynamic.ui.dailyMenu': 'Ежедневное меню', 'admin.dynamic.ui.breakfast': 'Завтрак', 'admin.dynamic.ui.lunch': 'Обед', 'admin.dynamic.ui.notSet': 'Не задано', 'admin.dynamic.ui.noMenu': 'Нет меню', 'admin.dynamic.ui.student': 'Студент', 'admin.dynamic.ui.instructor': 'Преподаватель', 'admin.dynamic.ui.user': 'Пользователь', 'admin.dynamic.ui.other': 'Другое', 'admin.dynamic.ui.all': 'Все',
            'admin.dynamic.count.admin.one': '{count} администратор', 'admin.dynamic.count.admin.few': '{count} администратора', 'admin.dynamic.count.admin.many': '{count} администраторов', 'admin.dynamic.count.admin.other': '{count} администратора', 'admin.dynamic.count.user.one': '{count} пользователь', 'admin.dynamic.count.user.few': '{count} пользователя', 'admin.dynamic.count.user.many': '{count} пользователей', 'admin.dynamic.count.user.other': '{count} пользователя', 'admin.dynamic.count.menu.one': '{count} меню', 'admin.dynamic.count.menu.few': '{count} меню', 'admin.dynamic.count.menu.many': '{count} меню', 'admin.dynamic.count.menu.other': '{count} меню', 'admin.dynamic.count.row.one': '{count} строка', 'admin.dynamic.count.row.few': '{count} строки', 'admin.dynamic.count.row.many': '{count} строк', 'admin.dynamic.count.row.other': '{count} строки', 'admin.dynamic.count.total': 'Всего: {count}', 'admin.dynamic.count.today': 'Сегодня: {count}', 'admin.dynamic.count.opens': 'Открытий: {count}', 'admin.dynamic.page.summary': 'Показано {shown} из {total} · Страница {page} из {pages}',
            'admin.dynamic.message.accessDenied': 'Доступ запрещён. Управление администраторами доступно только администраторам.', 'admin.dynamic.message.noRecentLogins': 'Нет недавних входов', 'admin.dynamic.message.noUsers': 'Пользователи не найдены.', 'admin.dynamic.message.noPlatforms': 'Платформы не найдены.', 'admin.dynamic.message.noAnnouncements': 'Объявления не найдены.', 'admin.dynamic.message.noDining': 'Меню не найдены.', 'admin.dynamic.message.noHolidays': 'Для этого года праздники не найдены.', 'admin.dynamic.message.saved': 'Успешно сохранено.', 'admin.dynamic.message.created': 'Успешно создано.', 'admin.dynamic.message.updated': 'Успешно обновлено.', 'admin.dynamic.message.deleted': 'Успешно удалено.', 'admin.dynamic.message.operationFailed': 'Не удалось выполнить действие. Попробуйте ещё раз.', 'admin.dynamic.message.failedDetail': 'Не удалось выполнить действие: {detail}', 'admin.dynamic.message.dateUnavailable': 'Эта дата недоступна: {detail}', 'admin.dynamic.message.userPromoted': 'Пользователь назначен администратором.', 'admin.dynamic.message.adminDemoted': 'Администратор переведён в обычные пользователи.', 'admin.dynamic.message.addAdmin': 'Добавить администратора', 'admin.dynamic.message.editAdmin': 'Изменить администратора', 'admin.dynamic.message.addAnnouncement': 'Добавить объявление', 'admin.dynamic.message.editAnnouncement': 'Изменить объявление', 'admin.dynamic.message.addDiningMenu': 'Добавить меню', 'admin.dynamic.message.editDiningMenu': 'Изменить меню', 'admin.dynamic.message.addHoliday': 'Добавить праздник', 'admin.dynamic.message.editHoliday': 'Изменить праздник', 'admin.dynamic.message.deleteConfirm': 'Удалить этот элемент?', 'admin.dynamic.message.promoteConfirm': 'Назначить {username} администратором?', 'admin.dynamic.message.demoteConfirm': 'Понизить {username} до обычного пользователя?', 'admin.dynamic.message.deleteAllHolidaysConfirm': 'Удалить все праздники за {year} год? Это действие нельзя отменить.', 'admin.dynamic.message.fixRows': 'Исправьте эти строки:', 'admin.dynamic.message.filePreviewError': 'Не удалось предварительно просмотреть файл. Убедитесь, что это допустимый CSV или Excel-файл.', 'admin.dynamic.message.importFailed': 'Не удалось импортировать календарь праздников. Попробуйте ещё раз.', 'admin.dynamic.message.importNothing': 'Ничего не импортировано. Исправьте ошибки, указанные в таблице.', 'admin.dynamic.message.importSuccess': 'Календарь праздников импортирован. {rows}', 'admin.dynamic.message.exportFailed': 'Не удалось экспортировать праздники.', 'admin.dynamic.message.templateFailed': 'Не удалось скачать шаблон.', 'admin.dynamic.message.selectDay': 'Выберите день', 'admin.dynamic.message.datePlaceholder': 'ДД.ММ.ГГГГ', 'admin.dynamic.message.holidayNamePlaceholder': 'Название праздника', 'admin.dynamic.message.dateRow': 'Дата в строке {row}', 'admin.dynamic.message.dayRow': 'День недели в строке {row}', 'admin.dynamic.message.holidayNameRow': 'Название праздника в строке {row}', 'admin.dynamic.message.removeRow': 'Удалить строку {row}'
        },
        ar: {
            'admin.dynamic.ui.close': 'إغلاق', 'admin.dynamic.ui.edit': 'تعديل', 'admin.dynamic.ui.delete': 'حذف', 'admin.dynamic.ui.save': 'حفظ', 'admin.dynamic.ui.add': 'إضافة', 'admin.dynamic.ui.cancel': 'إلغاء', 'admin.dynamic.ui.previous': 'السابق', 'admin.dynamic.ui.next': 'التالي', 'admin.dynamic.ui.refresh': 'تحديث', 'admin.dynamic.ui.import': 'استيراد', 'admin.dynamic.ui.upload': 'رفع', 'admin.dynamic.ui.loading': 'جارٍ التحميل…', 'admin.dynamic.ui.unavailable': 'غير متاح', 'admin.dynamic.ui.notAvailable': 'لا توجد بيانات', 'admin.dynamic.ui.noEmail': 'لا يوجد بريد إلكتروني', 'admin.dynamic.ui.unnamedUser': 'مستخدم بلا اسم', 'admin.dynamic.ui.defaultCampus': 'الحرم الجامعي', 'admin.dynamic.ui.defaultAdmin': 'المسؤول', 'admin.dynamic.ui.active': 'نشط', 'admin.dynamic.ui.inactive': 'غير نشط', 'admin.dynamic.ui.online': 'متصل', 'admin.dynamic.ui.offline': 'غير متصل', 'admin.dynamic.ui.disabled': 'معطّل', 'admin.dynamic.ui.notAdmin': 'ليس مسؤولاً', 'admin.dynamic.ui.created': 'تم الإنشاء', 'admin.dynamic.ui.by': 'بواسطة', 'admin.dynamic.ui.type': 'النوع', 'admin.dynamic.ui.day': 'اليوم', 'admin.dynamic.ui.recurring': 'متكرر', 'admin.dynamic.ui.dailyMenu': 'قائمة يومية', 'admin.dynamic.ui.breakfast': 'الإفطار', 'admin.dynamic.ui.lunch': 'الغداء', 'admin.dynamic.ui.notSet': 'غير محدد', 'admin.dynamic.ui.noMenu': 'لا توجد قائمة', 'admin.dynamic.ui.student': 'طالب', 'admin.dynamic.ui.instructor': 'مدرّس', 'admin.dynamic.ui.user': 'مستخدم', 'admin.dynamic.ui.other': 'أخرى', 'admin.dynamic.ui.all': 'الكل',
            'admin.dynamic.count.admin.zero': 'لا يوجد مسؤولون', 'admin.dynamic.count.admin.one': 'مسؤول واحد', 'admin.dynamic.count.admin.two': 'مسؤولان', 'admin.dynamic.count.admin.few': '{count} مسؤولين', 'admin.dynamic.count.admin.many': '{count} مسؤولاً', 'admin.dynamic.count.admin.other': '{count} مسؤول', 'admin.dynamic.count.user.zero': 'لا يوجد مستخدمون', 'admin.dynamic.count.user.one': 'مستخدم واحد', 'admin.dynamic.count.user.two': 'مستخدمان', 'admin.dynamic.count.user.few': '{count} مستخدمين', 'admin.dynamic.count.user.many': '{count} مستخدماً', 'admin.dynamic.count.user.other': '{count} مستخدم', 'admin.dynamic.count.menu.zero': 'لا توجد قوائم', 'admin.dynamic.count.menu.one': 'قائمة واحدة', 'admin.dynamic.count.menu.two': 'قائمتان', 'admin.dynamic.count.menu.few': '{count} قوائم', 'admin.dynamic.count.menu.many': '{count} قائمة', 'admin.dynamic.count.menu.other': '{count} قائمة', 'admin.dynamic.count.row.zero': 'لا توجد صفوف', 'admin.dynamic.count.row.one': 'صف واحد', 'admin.dynamic.count.row.two': 'صفان', 'admin.dynamic.count.row.few': '{count} صفوف', 'admin.dynamic.count.row.many': '{count} صفاً', 'admin.dynamic.count.row.other': '{count} صف', 'admin.dynamic.count.total': 'الإجمالي {count}', 'admin.dynamic.count.today': 'اليوم {count}', 'admin.dynamic.count.opens': '{count} فتح', 'admin.dynamic.page.summary': 'عرض {shown} من {total} · الصفحة {page} من {pages}',
            'admin.dynamic.message.accessDenied': 'تم رفض الوصول. إدارة المسؤولين متاحة للمسؤولين فقط.', 'admin.dynamic.message.noRecentLogins': 'لا توجد عمليات تسجيل دخول حديثة', 'admin.dynamic.message.noUsers': 'لم يتم العثور على مستخدمين.', 'admin.dynamic.message.noPlatforms': 'لم يتم العثور على منصات.', 'admin.dynamic.message.noAnnouncements': 'لم يتم العثور على إعلانات.', 'admin.dynamic.message.noDining': 'لم يتم العثور على قوائم طعام.', 'admin.dynamic.message.noHolidays': 'لم يتم العثور على عطلات لهذه السنة.', 'admin.dynamic.message.saved': 'تم الحفظ بنجاح.', 'admin.dynamic.message.created': 'تم الإنشاء بنجاح.', 'admin.dynamic.message.updated': 'تم التحديث بنجاح.', 'admin.dynamic.message.deleted': 'تم الحذف بنجاح.', 'admin.dynamic.message.operationFailed': 'تعذّر إكمال الإجراء. حاول مرة أخرى.', 'admin.dynamic.message.failedDetail': 'تعذّر إكمال الإجراء: {detail}', 'admin.dynamic.message.dateUnavailable': 'هذا التاريخ غير متاح: {detail}', 'admin.dynamic.message.userPromoted': 'تمت ترقية المستخدم إلى مسؤول.', 'admin.dynamic.message.adminDemoted': 'تم تحويل المسؤول إلى مستخدم عادي.', 'admin.dynamic.message.addAdmin': 'إضافة مسؤول', 'admin.dynamic.message.editAdmin': 'تعديل المسؤول', 'admin.dynamic.message.addAnnouncement': 'إضافة إعلان', 'admin.dynamic.message.editAnnouncement': 'تعديل الإعلان', 'admin.dynamic.message.addDiningMenu': 'إضافة قائمة طعام', 'admin.dynamic.message.editDiningMenu': 'تعديل قائمة الطعام', 'admin.dynamic.message.addHoliday': 'إضافة عطلة', 'admin.dynamic.message.editHoliday': 'تعديل العطلة', 'admin.dynamic.message.deleteConfirm': 'هل تريد حذف هذا العنصر؟', 'admin.dynamic.message.promoteConfirm': 'هل تريد ترقية {username} إلى مسؤول؟', 'admin.dynamic.message.demoteConfirm': 'هل تريد تحويل {username} إلى مستخدم عادي؟', 'admin.dynamic.message.deleteAllHolidaysConfirm': 'هل تريد حذف جميع عطلات سنة {year}؟ لا يمكن التراجع عن هذا الإجراء.', 'admin.dynamic.message.fixRows': 'يرجى إصلاح هذه الصفوف:', 'admin.dynamic.message.filePreviewError': 'تعذّرت معاينة الملف. تأكد من أنه ملف CSV أو Excel صالح.', 'admin.dynamic.message.importFailed': 'تعذّر استيراد جدول العطلات. حاول مرة أخرى.', 'admin.dynamic.message.importNothing': 'لم يتم استيراد أي شيء. أصلح الأخطاء المعروضة في الجدول.', 'admin.dynamic.message.importSuccess': 'تم استيراد جدول العطلات بنجاح. {rows}', 'admin.dynamic.message.exportFailed': 'تعذّر تصدير العطلات.', 'admin.dynamic.message.templateFailed': 'تعذّر تنزيل القالب.', 'admin.dynamic.message.selectDay': 'اختر يوماً', 'admin.dynamic.message.datePlaceholder': 'يوم/شهر/سنة', 'admin.dynamic.message.holidayNamePlaceholder': 'اسم العطلة', 'admin.dynamic.message.dateRow': 'تاريخ الصف {row}', 'admin.dynamic.message.dayRow': 'يوم الأسبوع للصف {row}', 'admin.dynamic.message.holidayNameRow': 'اسم العطلة للصف {row}', 'admin.dynamic.message.removeRow': 'إزالة الصف {row}'
        }
    };

    window.adminI18n?.registerTranslations(catalog);

    const interpolate = (template, values = {}) => String(template).replace(/\{([\w-]+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
    ));
    const text = (key, values = {}, fallback = key) => {
        const fullKey = key.startsWith('admin.dynamic.') ? key : `admin.dynamic.${key}`;
        const translated = window.adminI18n?.translate(fullKey, undefined, values);
        return translated && translated !== fullKey ? translated : interpolate(fallback, values);
    };
    const plural = (key, count, values = {}) => {
        const fullKey = key.startsWith('admin.dynamic.') ? key : `admin.dynamic.${key}`;
        const translated = window.adminI18n?.translatePlural(fullKey, count, values);
        return translated && translated !== `${fullKey}.other` ? translated : `${count}`;
    };
    const date = (value, options) => window.adminI18n?.formatDate(value, options) || new Date(value).toLocaleDateString();
    const number = (value, options) => window.adminI18n?.formatNumber(value, options) || new Intl.NumberFormat().format(value);
    const role = value => text(`ui.${String(value || 'other').trim().toLowerCase().replace(/[\s_-]+/g, '')}`, {}, String(value || ''));
    window.adminDynamicI18n = Object.freeze({ text, plural, date, number, role });
})();

const adminText = (key, values, fallback) => window.adminDynamicI18n?.text(key, values, fallback) || fallback || key;
const adminPlural = (key, count, values) => window.adminDynamicI18n?.plural(key, count, values) || String(count);
const adminDate = (value, options) => window.adminDynamicI18n?.date(value, options) || new Date(value).toLocaleDateString();
const adminRoleLabel = value => window.adminDynamicI18n?.role(value) || String(value || '');
const adminFailure = detail => detail
    ? adminText('message.failedDetail', { detail }, `The action could not be completed: ${detail}`)
    : adminText('message.operationFailed', {}, 'The action could not be completed. Please try again.');

class AdminPanel {
    constructor() {
        console.log('AdminPanel constructor called');
        this.currentAdmin = null;
        this.admins = [];
        this.users = [];
        this.announcements = [];
        this.diningMenus = [];
        this.holidays = [];
        this.editingAnnouncementId = null;
        this.editingDiningMenuId = null;
        this.editingHolidayId = null;
        this.init();
    }

    init() {
        console.log('AdminPanel init called');
        this.checkAuth();
        this.setupEventListeners();
        this.setupBackButtonHandler();
        this.loadDashboardStats();
        this.populateYearOptions();
        this.loadAdmins();
        this.loadAnnouncements();
        this.loadDiningMenus();
        this.loadHolidays();
        this.loadUsers();
        this.loadPlatforms();
    }

    checkAuth() {
        console.log('checkAuth called');
        const adminSession = localStorage.getItem('adminSession');
        console.log('adminSession from localStorage:', adminSession);
        if (!adminSession) {
            console.log('No admin session found, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        try {
            this.currentAdmin = JSON.parse(adminSession);
            console.log('Current admin parsed:', this.currentAdmin);
            this.updateAdminInfo();
        } catch (error) {
            console.error('Error parsing admin session:', error);
            window.location.href = '/login.html';
        }
    }

    getUserDashboardPath(userSession) {
        try {
            const user = typeof userSession === 'string' ? JSON.parse(userSession) : userSession;
            return String(user?.role || '').toLowerCase() === 'instructor'
                ? '/instructor_dashboard'
                : '/student_dashboard';
        } catch (_) {
            return '/student_dashboard';
        }
    }

    updateAdminInfo() {
        if (this.currentAdmin) {
            const adminName = document.getElementById('admin-name');
            const adminRole = document.getElementById('admin-role');
            const adminAvatar = document.getElementById('admin-avatar');
            const adminManagementNav = document.getElementById('admin-management-nav');
            
            if (adminName) adminName.textContent = this.currentAdmin.username;
            if (adminRole) adminRole.textContent = this.currentAdmin.role.replace('_', ' ').toUpperCase();
            if (adminAvatar) adminAvatar.textContent = this.currentAdmin.username.charAt(0).toUpperCase();
            
            // Show admin management nav only for admin role
            if (adminManagementNav) {
                if (this.currentAdmin.role === 'admin') {
                    adminManagementNav.style.display = 'block';
                } else {
                    adminManagementNav.style.display = 'none';
                }
            }

            // Check if this is an admin-only account and show notification
            const userSession = localStorage.getItem('user');
            const adminSession = localStorage.getItem('adminSession');
            
            // Show/hide "Go to User Panel" button based on user session
            const userPanelBtn = document.getElementById('user-panel-btn');
            if (userPanelBtn) {
                if (adminSession && userSession) {
                    // User-admin account - show the button
                    userPanelBtn.style.display = 'block';
                } else {
                    // Admin-only account - hide the button
                    userPanelBtn.style.display = 'none';
                }
            }
            
           /* if (adminSession && !userSession) {
                // Admin-only account - show notification about back button behavior
                setTimeout(() => {
                    this.showNotification('⚠️ Admin-only account: Pressing the back button will log you out. Use the logout button to safely exit.', 'warning');
                }, 1000);
            }*/
        }
    }

    setupEventListeners() {
        console.log('setupEventListeners called');
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                const section = link.getAttribute('data-section');
                console.log('Navigation clicked, section:', section);
                this.showSection(section);
            });
        });

        // Logout
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // User Panel button (for user-admin accounts)
        const userPanelBtn = document.getElementById('user-panel-btn');
        if (userPanelBtn) {
            userPanelBtn.addEventListener('click', () => {
                window.location.href = this.getUserDashboardPath(userSession);
            });
        }

        const createUserForm = document.getElementById('create-user-form');
        if (createUserForm) {
            createUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(createUserForm);
                await this.createUser(Object.fromEntries(formData.entries()));
            });
        }

        const cancelCreateUser = document.getElementById('cancel-create-user');
        if (cancelCreateUser) {
            cancelCreateUser.addEventListener('click', () => this.showSection('users'));
        }

        // Announcement form submission
            const announcementForm = document.getElementById('announcement-form');
        if (announcementForm) {
            announcementForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(announcementForm);
                const data = Object.fromEntries(formData.entries());
                    // Normalize target_audience; default to 'all'
                    data.target_audience = (data.target_audience || 'all').toLowerCase();
                this.saveAnnouncement(data);
            });
        }

        // Admin create/update form submission
        const adminManageForm = document.getElementById('admin-manage-form');
        if (adminManageForm) {
            adminManageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(adminManageForm);
                const payload = Object.fromEntries(formData.entries());

                if (this.editingAdminId) {
                    // Update username and email. Administrator accounts are always active.
                    const updateOk = await this.updateAdmin({
                        action: 'admin-update',
                        id: parseInt(payload.id, 10),
                        username: payload.username,
                        email: payload.email
                    });
                    // If new password provided, call change-password
                    if (updateOk && payload.new_password) {
                        await this.updateAdmin({
                            action: 'admin-change-password',
                            id: parseInt(payload.id, 10),
                            new_password: payload.new_password
                        });
                    }
                    this.closeAdminModal();
                } else {
                    // Create admin (role forced to admin on backend)
                    await this.createAdmin({
                        action: 'admin-create',
                        username: payload.username,
                        password: payload.password,
                        email: payload.email,
                        role: 'admin'
                    });
                    this.closeAdminModal();
                }
            });
        }

        // Dining menu form submission
        const diningMenuForm = document.getElementById('dining-menu-form');
        if (diningMenuForm) {
            diningMenuForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(diningMenuForm);
                const data = Object.fromEntries(formData.entries());
                
                // Handle checkbox value
                data.is_recurring = document.getElementById('dining-menu-recurring').checked;
                
                this.saveDiningMenu(data);
            });
        }
        
        // Show/hide recurring options based on checkbox
        const diningMenuRecurringCheckbox = document.getElementById('dining-menu-recurring');
        if (diningMenuRecurringCheckbox) {
            diningMenuRecurringCheckbox.addEventListener('change', (e) => {
                const recurringOptions = document.getElementById('recurring-options');
                if (recurringOptions) {
                    if (e.target.checked) {
                        recurringOptions.style.display = 'block';
                    } else {
                        recurringOptions.style.display = 'none';
                    }
                }
            });
        }

        // Holiday form submission
        const holidayForm = document.getElementById('holiday-form');
        if (holidayForm) {
            holidayForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(holidayForm);
                const data = Object.fromEntries(formData.entries());
                this.saveHoliday(data);
            });
        }

        // Upload holiday file form submission
        const uploadHolidayForm = document.getElementById('upload-holiday-form');
        if (uploadHolidayForm) {
            uploadHolidayForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(uploadHolidayForm);
                this.uploadHolidayFile(formData);
            });
        }

        // Holiday button event listeners
        console.log('Setting up holiday button event listeners');
        console.log('All elements with id containing "holiday":', document.querySelectorAll('[id*="holiday"]'));
        const addHolidayBtn = document.getElementById('add-holiday-btn');
        if (addHolidayBtn) {
            console.log('Add holiday button found, adding event listener');
            addHolidayBtn.addEventListener('click', () => {
                console.log('Add holiday button clicked');
                this.showAddHolidayModal();
            });
        } else {
            console.log('Add holiday button not found');
        }

        const uploadHolidayBtn = document.getElementById('upload-holiday-btn');
        if (uploadHolidayBtn) {
            console.log('Upload holiday button found, adding event listener');
            uploadHolidayBtn.addEventListener('click', () => {
                console.log('Upload holiday button clicked');
                this.showUploadHolidayModal();
            });
        } else {
            console.log('Upload holiday button not found');
        }

        const exportHolidaysBtn = document.getElementById('export-holidays-btn');
        if (exportHolidaysBtn) {
            exportHolidaysBtn.addEventListener('click', () => this.exportHolidays());
        }

        const exportHolidaysXlsxBtn = document.getElementById('export-holidays-xlsx-btn');
        if (exportHolidaysXlsxBtn) {
            exportHolidaysXlsxBtn.addEventListener('click', () => this.exportHolidays('xlsx'));
        }

        const downloadTemplateBtn = document.getElementById('download-template-btn');
        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener('click', () => this.downloadTemplate());
        }

        const downloadTemplateXlsxBtn = document.getElementById('download-template-xlsx-btn');
        if (downloadTemplateXlsxBtn) {
            downloadTemplateXlsxBtn.addEventListener('click', () => this.downloadTemplate('xlsx'));
        }

        const holidayImportFile = document.getElementById('upload-file');
        if (holidayImportFile) {
            holidayImportFile.addEventListener('change', event => this.previewHolidayFile(event.target.files[0]));
        }

        const holidayImportAddRow = document.getElementById('holiday-import-add-row');
        if (holidayImportAddRow) {
            holidayImportAddRow.addEventListener('click', () => this.addHolidayImportRow());
        }

        const deleteAllHolidaysBtn = document.getElementById('delete-all-holidays-btn');
        if (deleteAllHolidaysBtn) {
            deleteAllHolidaysBtn.addEventListener('click', () => this.deleteAllHolidays());
        }

        // Year selector is now static (disabled), so no change event needed
        // const holidayYearSelect = document.getElementById('holiday-year');
        // if (holidayYearSelect) {
        //     holidayYearSelect.addEventListener('change', () => this.loadHolidays());
        // }

        // Prevent changes to upload year selector (readonly)
        const uploadYearSelect = document.getElementById('upload-year');
        if (uploadYearSelect) {
            uploadYearSelect.addEventListener('change', (e) => {
                e.preventDefault();
                // Reset to current year if somehow changed
                const currentYear = new Date().getFullYear();
                uploadYearSelect.value = currentYear;
            });
        }

        // Holiday modal close buttons
        const closeHolidayModal = document.getElementById('close-holiday-modal');
        if (closeHolidayModal) {
            closeHolidayModal.addEventListener('click', () => this.closeHolidayModal());
        }

        const cancelHolidayModal = document.getElementById('cancel-holiday-modal');
        if (cancelHolidayModal) {
            cancelHolidayModal.addEventListener('click', () => this.closeHolidayModal());
        }

        const closeUploadHolidayModal = document.getElementById('close-upload-holiday-modal');
        if (closeUploadHolidayModal) {
            closeUploadHolidayModal.addEventListener('click', () => this.closeUploadHolidayModal());
        }

        const cancelUploadHolidayModal = document.getElementById('cancel-upload-holiday-modal');
        if (cancelUploadHolidayModal) {
            cancelUploadHolidayModal.addEventListener('click', () => this.closeUploadHolidayModal());
        }

        // Admin modal event listeners
        console.log('Setting up admin modal event listeners');
        const addAdminBtn = document.getElementById('add-admin-btn');
        if (addAdminBtn) {
            console.log('Add admin button found, adding event listener');
            addAdminBtn.addEventListener('click', () => this.showAddAdminModal());
        } else {
            console.log('Add admin button not found');
        }

        const closeAdminModal = document.getElementById('close-admin-modal');
        if (closeAdminModal) {
            closeAdminModal.addEventListener('click', () => this.closeAdminModal());
        }

        const cancelAdminModal = document.getElementById('cancel-admin-modal');
        if (cancelAdminModal) {
            cancelAdminModal.addEventListener('click', () => this.closeAdminModal());
        }

        // Announcement modal event listeners
        const addAnnouncementBtn = document.getElementById('add-announcement-btn');
        if (addAnnouncementBtn) {
            addAnnouncementBtn.addEventListener('click', () => this.showAddAnnouncementModal());
        }

        const closeAnnouncementModal = document.getElementById('close-announcement-modal');
        if (closeAnnouncementModal) {
            closeAnnouncementModal.addEventListener('click', () => this.closeAnnouncementModal());
        }

        const cancelAnnouncementModal = document.getElementById('cancel-announcement-modal');
        if (cancelAnnouncementModal) {
            cancelAnnouncementModal.addEventListener('click', () => this.closeAnnouncementModal());
        }

        // Dining menu modal event listeners
        const addDiningMenuBtn = document.getElementById('add-dining-menu-btn');
        if (addDiningMenuBtn) {
            addDiningMenuBtn.addEventListener('click', () => this.showAddDiningMenuModal());
        }

        const closeDiningMenuModal = document.getElementById('close-dining-menu-modal');
        if (closeDiningMenuModal) {
            closeDiningMenuModal.addEventListener('click', () => this.closeDiningMenuModal());
        }

        const cancelDiningMenuModal = document.getElementById('cancel-dining-menu-modal');
        if (cancelDiningMenuModal) {
            cancelDiningMenuModal.addEventListener('click', () => this.closeDiningMenuModal());
        }

        // Dashboard card clicks
        const totalUsersCard = document.getElementById('total-users');
        if (totalUsersCard) {
            totalUsersCard.addEventListener('click', () => {
                this.showSection('users');
                this.loadUsers();
            });
            totalUsersCard.style.cursor = 'pointer';
        }

        const activeAdminsCard = document.getElementById('active-admins');
        if (activeAdminsCard) {
            activeAdminsCard.addEventListener('click', () => {
                this.showSection('admins');
                this.loadAdmins();
            });
            activeAdminsCard.style.cursor = 'pointer';
        }

        const totalPlatformsCard = document.getElementById('total-platforms');
        if (totalPlatformsCard) {
            totalPlatformsCard.addEventListener('click', () => {
                this.showSection('platforms');
                this.loadPlatforms();
            });
            totalPlatformsCard.style.cursor = 'pointer';
        }
    }

    showSection(sectionName) {
        console.log('showSection called with:', sectionName);
        const sectionAliases = {
            'manage-platforms': 'manage-platforms',
            'create-user': 'create-user',
            'platforms-management': 'manage-platforms'
        };
        const resolvedSectionName = sectionAliases[sectionName] || sectionName;
        // Check if user is trying to access admin management without admin role
        if (resolvedSectionName === 'admins' && this.currentAdmin && this.currentAdmin.role !== 'admin') {
            this.showNotification(adminText('message.accessDenied', {}, 'Access denied. Admin management is restricted to administrators only.'), 'error');
            return;
        }
        
        document.querySelectorAll('.section-content').forEach(section => {
            section.classList.add('hidden');
        });
        
        const targetSection = document.getElementById(resolvedSectionName + '-section');
        console.log('Looking for section with id:', resolvedSectionName + '-section');
        if (targetSection) {
            console.log('Found target section, removing hidden class');
            targetSection.classList.remove('hidden');

            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-section') === resolvedSectionName);
            });
            
            // Load section-specific data
            if (resolvedSectionName === 'holidays') {
                console.log('Loading holidays section data');
                this.loadHolidays();
            }
        } else {
            console.log('Target section not found');
        }
        
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = resolvedSectionName.charAt(0).toUpperCase() + resolvedSectionName.slice(1);
        }
    }

    async createUser(formData) {
        try {
            const response = await fetch(ADMIN_API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'user-create',
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    current_admin_id: this.currentAdmin.id
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showNotification(adminText('message.created', {}, 'Created successfully.'), 'success');
                document.getElementById('create-user-form')?.reset();
                await this.loadUsers();
                this.showSection('users');
            } else {
                this.showNotification(data.error ? adminFailure(data.error) : adminFailure(), 'error');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            this.showNotification(adminFailure(), 'error');
        }
    }

    logout() {
        localStorage.removeItem('adminSession');
        // Prevent navigating forward back into the panel
        window.location.replace('/login.html');
    }

    /**
     * Sets up back button handler for admin logout functionality
     * Admin-only accounts will be logged out when back button is pressed
     * User-admin accounts will be redirected to user panel
     */
    setupBackButtonHandler() {
        // Back/forward navigation is handled below; native leave prompts are disabled.
        // Avoid native browser leave prompts; errors are shown with app notifications.
        window.addEventListener('app-page-leaving', (event) => {
            // Check if this is an admin-only account (no user session)
            const userSession = localStorage.getItem('user');
            const adminSession = localStorage.getItem('adminSession');
            
            if (adminSession && !userSession) {
                // Admin-only account - show confirmation dialog
                event.preventDefault();
                event.appMessage = 'You will be logged out. Use the logout button to safely exit.';
                return event.appMessage;
            }
        });

        // Listen for popstate event (back/forward button navigation)
        window.addEventListener('popstate', (event) => {
            if (window.location.pathname.startsWith('/admin_dashboard')) {
                const section = window.location.pathname.split('/').filter(Boolean)[1] || 'dashboard';
                this.showSection(section);
                return;
            }
            // Check if this is an admin-only account (no user session)
            const userSession = localStorage.getItem('user');
            const adminSession = localStorage.getItem('adminSession');
            
            if (adminSession && !userSession) {
                // Admin-only account - logout immediately
                this.logout();
            } else if (adminSession && userSession) {
                // User-admin account - redirect to user panel
                window.location.href = this.getUserDashboardPath(userSession);
            }
        });

        // Prevent bfcache forward access: on page restore, enforce auth
        window.addEventListener('pageshow', (evt) => {
            const userSession = localStorage.getItem('user');
            const adminSession = localStorage.getItem('adminSession');
            if (evt.persisted && adminSession && !userSession) {
                this.logout();
            }
        });
    }

    async loadDashboardStats() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=dashboard-stats`);
            const data = await response.json();
            
            if (data.success) {
                const stats = data.stats;
                                    this.updateStat('total-users', stats.total_users);
                    this.updateStat('active-admins', stats.active_admins);
                    this.updateStat('total-platforms', stats.total_platforms);
                
                // Update system health
                this.updateSystemHealth(stats.system_health);
                this.updateRecentLogins(stats.recent_logins);
            } else {
                console.error('Error loading dashboard stats:', data.error);
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    updateStat(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateSystemHealth(healthData) {
        const dbStatus = document.getElementById('db-status');
        const tablesStatus = document.getElementById('tables-status');
        
        if (dbStatus) {
            dbStatus.textContent = healthData.database;
            dbStatus.className = `health-indicator ${healthData.database}`;
        }
        
        if (tablesStatus) {
            tablesStatus.textContent = healthData.tables;
            tablesStatus.className = `health-indicator ${healthData.tables}`;
        }
    }

    updateRecentLogins(logins) {
        const container = document.getElementById('recent-logins-list');
        if (!container) return;

        if (logins.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">No recent logins</p>';
            return;
        }

        container.innerHTML = '';
        logins.forEach(login => {
            const loginItem = document.createElement('div');
            loginItem.className = 'login-item';
            
            const loginTime = new Date(login.last_login).toLocaleString();
            
            loginItem.innerHTML = `
                <span class="login-username">${login.username}</span>
                <span class="login-time">${loginTime}</span>
            `;
            container.appendChild(loginItem);
        });
    }

    async loadAdmins() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=admin-list&current_admin_id=${this.currentAdmin.id}`);
            const data = await response.json();
            
            if (data.success) {
                this.admins = data.admins;
                this.renderAdminsTable();
            } else {
                console.error('Error loading admins:', data.error);
            }
        } catch (error) {
            console.error('Error loading admins:', error);
        }
    }

    renderAdminsTable() {
        const tbody = document.getElementById('admins-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.admins.forEach(admin => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${admin.id}</td>
                <td>${admin.username}</td>
                <td>${admin.email || 'N/A'}</td>
                <td>${admin.role.replace('_', ' ').toUpperCase()}</td>
                <td>${admin.is_active == 0 ? 'Disabled' : (admin.is_online ? 'Online' : 'Offline')}</td>
                <td>${new Date(admin.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn" onclick="adminPanel.editAdmin(${admin.id})" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn" onclick="adminPanel.deleteAdmin(${admin.id})" style="padding: 5px 10px; font-size: 12px; background: #e74c3c;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async createAdmin(formData) {
        try {
            // Add current admin ID to the request
            formData.current_admin_id = this.currentAdmin.id;
            
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Admin created successfully', 'success');
                this.loadAdmins();
                this.loadDashboardStats();
                return true;
            } else {
                this.showNotification('Error creating admin: ' + data.error, 'error');
                return false;
            }
        } catch (error) {
            console.error('Error creating admin:', error);
            this.showNotification('Error creating admin', 'error');
            return false;
        }
    }

    async updateAdmin(formData) {
        try {
            // Add current admin ID to the request
            formData.current_admin_id = this.currentAdmin.id;
            
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Admin updated successfully', 'success');
                this.loadAdmins();
                return true;
            } else {
                this.showNotification('Error updating admin: ' + data.error, 'error');
                return false;
            }
        } catch (error) {
            console.error('Error updating admin:', error);
            this.showNotification('Error updating admin', 'error');
            return false;
        }
    }

    async deleteAdmin(adminId) {
        if (confirm('Are you sure you want to delete this admin?')) {
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'admin-delete',
                        id: adminId,
                        current_admin_id: this.currentAdmin.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Admin deleted successfully', 'success');
                    this.loadAdmins();
                    this.loadDashboardStats();
                } else {
                    this.showNotification('Error deleting admin: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting admin:', error);
                this.showNotification('Error deleting admin', 'error');
            }
        }
    }

    editAdmin(adminId) {
        const admin = this.admins.find(a => a.id == adminId);
        if (!admin) return;
        // Prepare modal for editing
        this.editingAdminId = admin.id;
        document.getElementById('admin-modal-title').textContent = 'Edit Admin';
        document.getElementById('admin-id').value = admin.id;
        document.getElementById('admin-username').value = admin.username;
        document.getElementById('admin-email').value = admin.email || '';
        
        // Show username field for editing, hide password field
        document.getElementById('admin-username-group').style.display = 'block';
        document.getElementById('admin-password-group').style.display = 'none';
        document.getElementById('admin-new-password-group').style.display = 'block';
        
        document.getElementById('admin-manage-modal').classList.remove('hidden');
    }

    showAddAdminModal() {
        this.editingAdminId = null;
        document.getElementById('admin-modal-title').textContent = 'Add Admin';
        document.getElementById('admin-manage-form').reset();
        document.getElementById('admin-id').value = '';
        
        // Show username and password fields for create
        document.getElementById('admin-username-group').style.display = 'block';
        document.getElementById('admin-password-group').style.display = 'block';
        document.getElementById('admin-new-password-group').style.display = 'none';
        
        document.getElementById('admin-manage-modal').classList.remove('hidden');
    }

    closeAdminModal() {
        document.getElementById('admin-manage-modal').classList.add('hidden');
        this.editingAdminId = null;
    }

    // =============================================================================
    // ANNOUNCEMENTS METHODS
    // =============================================================================

    async loadAnnouncements() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=announcement-list`);
            const data = await response.json();
            
            if (data.success) {
                this.announcements = data.announcements;
                this.renderAnnouncements();
            } else {
                console.error('Error loading announcements:', data.error);
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
        }
    }

    // =============================================================================
    // USERS AND PLATFORMS METHODS
    // =============================================================================

    async loadUsers() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=users-list`);
            const data = await response.json();
            if (data.success) {
                this.users = Array.isArray(data.users) ? data.users : [];
                this.renderUsers(data.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666;">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => {
            const isAdmin = !!u.admin_id;
            const role = u.admin_role || '-';
            const canManage = this.currentAdmin && this.currentAdmin.role === 'admin';
            const actionBtn = !canManage
                ? '-'
                : (isAdmin
                    ? `<button class="btn btn-secondary" onclick="adminPanel.demoteToUser('${u.username}')">Demote</button>`
                    : `<button class="btn" onclick="adminPanel.promoteToAdmin('${u.username}')">Promote</button>`);
            const statusBadge = isAdmin
                ? `<span class="announcement-status status-active">${role}</span>`
                : `<span class="announcement-status status-inactive">not admin</span>`;
            return `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.email || ''}</td>
                <td>${new Date(u.created_at).toLocaleString()}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>`;
        }).join('');
    }

    async promoteToAdmin(username) {
        if (!confirm(`Promote ${username} to admin?`)) return;
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'user-promote-to-admin',
                    username: username,
                    role: 'admin',
                    current_admin_id: this.currentAdmin.id
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showNotification('User promoted to admin', 'success');
                this.loadUsers();
                this.loadDashboardStats();
            } else {
                this.showNotification('Failed: ' + data.error, 'error');
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Error promoting user', 'error');
        }
    }

    async demoteToUser(username) {
        if (!confirm(`Demote ${username} to normal user?`)) return;
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'admin-demote-to-user',
                    username: username,
                    current_admin_id: this.currentAdmin.id
                })
            });
            const data = await response.json();
            if (data.success) {
                this.showNotification('Admin demoted to user', 'success');
                this.loadUsers();
                this.loadDashboardStats();
            } else {
                this.showNotification('Failed: ' + data.error, 'error');
            }
        } catch (e) {
            console.error(e);
            this.showNotification('Error demoting admin', 'error');
        }
    }

    async loadPlatforms() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=platforms-list`);
            const data = await response.json();
            if (data.success) {
                this.platforms = data.platforms || [];
                this.renderPlatforms(data.platforms);
            }
        } catch (error) {
            console.error('Error loading platforms:', error);
        }
    }

    renderPlatforms(platforms) {
        const tbody = document.getElementById('platforms-table-body');
        if (!tbody) return;
        if (!platforms || platforms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666;">No platforms found</td></tr>';
            return;
        }
        tbody.innerHTML = platforms.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.section || 'Campus'} / ${p.name}</td>
                <td>${p.description || ''}</td>
                <td><a href="${p.url}" target="_blank">${p.url}</a></td>
                <td>${new Date(p.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    renderAnnouncements() {
        const container = document.getElementById('announcements-list');
        if (!container) return;

        if (this.announcements.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No announcements found.</p>';
            return;
        }

        container.innerHTML = this.announcements.map(announcement => `
            <div class="announcement-card">
                <div class="announcement-header">
                    <h3 class="announcement-title">${announcement.title}</h3>
                    <div class="announcement-actions">
                        <button class="btn" onclick="adminPanel.editAnnouncement(${announcement.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn" style="background: #e74c3c;" onclick="adminPanel.deleteAnnouncement(${announcement.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
                <div class="announcement-meta">
                    <span class="announcement-priority priority-${announcement.priority}">${announcement.priority}</span>
                    <span class="announcement-status status-${announcement.is_active == 1 ? 'active' : 'inactive'}">${announcement.is_active == 1 ? 'Active' : 'Inactive'}</span>
                    <span>By: ${announcement.author_name}</span>
                    <span>Created: ${new Date(announcement.created_at).toLocaleDateString()}</span>
                </div>
                <div class="announcement-content">${announcement.content}</div>
            </div>
        `).join('');
    }

    showAddAnnouncementModal() {
        this.editingAnnouncementId = null;
        document.getElementById('modal-title').textContent = 'Add Announcement';
        document.getElementById('announcement-form').reset();
        document.getElementById('announcement-status-group').style.display = 'none';
        document.getElementById('announcement-modal').classList.remove('hidden');
    }

    showEditAnnouncementModal(announcementId) {
        const announcement = this.announcements.find(a => a.id == announcementId);
        if (!announcement) return;

        this.editingAnnouncementId = announcementId;
        document.getElementById('modal-title').textContent = 'Edit Announcement';
        
        // Fill form with announcement data
        document.getElementById('announcement-title').value = announcement.title;
        document.getElementById('announcement-content').value = announcement.content;
        document.getElementById('announcement-priority').value = announcement.priority;
        if (document.getElementById('announcement-target')) {
            document.getElementById('announcement-target').value = (announcement.target_audience || 'all');
        }
        document.getElementById('announcement-status').value = announcement.is_active;
        
        // Show status field for editing
        document.getElementById('announcement-status-group').style.display = 'block';
        
        document.getElementById('announcement-modal').classList.remove('hidden');
    }

    closeAnnouncementModal() {
        document.getElementById('announcement-modal').classList.add('hidden');
        this.editingAnnouncementId = null;
    }

    editAnnouncement(announcementId) {
        this.showEditAnnouncementModal(announcementId);
    }

    async deleteAnnouncement(announcementId) {
        if (confirm('Are you sure you want to delete this announcement?')) {
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'announcement-delete',
                        id: announcementId,
                        current_admin_id: this.currentAdmin.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Announcement deleted successfully', 'success');
                    this.loadAnnouncements();
                } else {
                    this.showNotification('Error deleting announcement: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting announcement:', error);
                this.showNotification('Error deleting announcement', 'error');
            }
        }
    }

    async saveAnnouncement(formData) {
        try {
            formData.current_admin_id = this.currentAdmin.id;
            
            const action = this.editingAnnouncementId ? 'announcement-update' : 'announcement-create';
            if (this.editingAnnouncementId) {
                formData.id = this.editingAnnouncementId;
            }
            
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...formData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(this.editingAnnouncementId ? 'Announcement updated successfully' : 'Announcement created successfully', 'success');
                this.closeAnnouncementModal();
                this.loadAnnouncements();
            } else {
                this.showNotification('Error saving announcement: ' + data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving announcement:', error);
            this.showNotification('Error saving announcement', 'error');
        }
    }

    // =============================================================================
    // DINING MENU FUNCTIONS
    // =============================================================================

    async loadDiningMenus() {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=dining-menu-list`);
            const data = await response.json();
            
            if (data.success) {
                this.diningMenus = data.dining_menus || data.menus || [];
                this.renderDiningMenus();
            } else {
                console.error('Error loading dining menus:', data.error);
            }
        } catch (error) {
            console.error('Error loading dining menus:', error);
        }
    }

    renderDiningMenus() {
        const container = document.getElementById('dining-menu-list');
        if (!container) return;

        if (!this.diningMenus || this.diningMenus.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No dining menus found</div>';
            return;
        }

        const sortedMenus = [...this.diningMenus].sort((a, b) => new Date(a.date) - new Date(b.date));
        container.innerHTML = `<div class="dining-admin-grid">${sortedMenus.map(menu => {
            const date = new Date(menu.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            return `
                <div class="dining-admin-card">
                    <div class="dining-menu-header">
                        <div>
                            <span class="menu-pill">${menu.is_recurring ? 'Recurring' : 'Daily menu'}</span>
                            <h3 class="dining-menu-date">${date}</h3>
                        </div>
                        <div class="dining-menu-actions">
                            <button class="btn" onclick="adminPanel.editDiningMenu(${menu.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn" style="background: #e74c3c;" onclick="adminPanel.deleteDiningMenu(${menu.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                    <div class="dining-menu-meta">
                        <span><i class="fas fa-user"></i> ${menu.created_by_name || 'admin'}</span>
                        <span><i class="fas fa-calendar-check"></i> ${new Date(menu.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div class="dining-meal-grid">
                    <div class="dining-menu-section">
                        <div class="dining-menu-section-title">
                            <i class="fas fa-sun"></i> Breakfast
                        </div>
                        <div class="dining-menu-content">${menu.breakfast_menu || 'No breakfast menu set'}</div>
                        <div class="dining-menu-timing">
                            <span><i class="fas fa-clock"></i> ${menu.breakfast_start_time} - ${menu.breakfast_end_time}</span>
                        </div>
                    </div>
                    
                    <div class="dining-menu-section">
                        <div class="dining-menu-section-title">
                            <i class="fas fa-cloud-sun"></i> Lunch
                        </div>
                        <div class="dining-menu-content">${menu.lunch_menu || 'No lunch menu set'}</div>
                        <div class="dining-menu-timing">
                            <span><i class="fas fa-clock"></i> ${menu.lunch_start_time} - ${menu.lunch_end_time}</span>
                        </div>
                    </div>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    }

    showAddDiningMenuModal() {
        this.editingDiningMenuId = null;
        document.getElementById('dining-menu-modal-title').textContent = 'Add Dining Menu';
        
        // Reset form
        document.getElementById('dining-menu-form').reset();
        
        // Set default date to today
        document.getElementById('dining-menu-date').value = new Date().toISOString().split('T')[0];
        
        // Hide recurring options by default
        const recurringOptions = document.getElementById('recurring-options');
        if (recurringOptions) {
            recurringOptions.style.display = 'none';
        }
        
        // Add date validation
        this.setupDiningMenuDateValidation();
        
        document.getElementById('dining-menu-modal').classList.remove('hidden');
    }

    setupDiningMenuDateValidation() {
        const dateInput = document.getElementById('dining-menu-date');
        if (dateInput) {
            dateInput.addEventListener('change', async () => {
                const selectedDate = dateInput.value;
                if (selectedDate) {
                    try {
                        const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=check-date-availability&date=${selectedDate}`);
                        const data = await response.json();
                        
                        if (!data.available) {
                            this.showNotification(`⚠️ This date is not available: ${data.message}`, 'error');
                            dateInput.style.borderColor = '#dc3545';
                        } else {
                            dateInput.style.borderColor = '#28a745';
                        }
                    } catch (error) {
                        console.error('Error checking date availability:', error);
                    }
                }
            });
        }
    }

    closeDiningMenuModal() {
        document.getElementById('dining-menu-modal').classList.add('hidden');
        this.editingDiningMenuId = null;
    }

    editDiningMenu(menuId) {
        const menu = this.diningMenus.find(m => m.id == menuId);
        if (!menu) return;

        this.editingDiningMenuId = menuId;
        document.getElementById('dining-menu-modal-title').textContent = 'Edit Dining Menu';
        
        // Fill form with menu data
        document.getElementById('dining-menu-date').value = menu.date;
        document.getElementById('dining-menu-breakfast').value = menu.breakfast_menu || '';
        document.getElementById('dining-menu-breakfast-start').value = menu.breakfast_start_time;
        document.getElementById('dining-menu-breakfast-end').value = menu.breakfast_end_time;
        document.getElementById('dining-menu-lunch').value = menu.lunch_menu || '';
        document.getElementById('dining-menu-lunch-start').value = menu.lunch_start_time;
        document.getElementById('dining-menu-lunch-end').value = menu.lunch_end_time;
        
        document.getElementById('dining-menu-modal').classList.remove('hidden');
    }

    async deleteDiningMenu(menuId) {
        if (confirm('Are you sure you want to delete this dining menu?')) {
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'dining-menu-delete',
                        id: menuId,
                        current_admin_id: this.currentAdmin.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Dining menu deleted successfully', 'success');
                    this.loadDiningMenus();
                } else {
                    this.showNotification('Error deleting dining menu: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting dining menu:', error);
                this.showNotification('Error deleting dining menu', 'error');
            }
        }
    }

    showNotification(message, type = 'success') {
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
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
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

    async saveDiningMenu(formData) {
        try {
            formData.current_admin_id = this.currentAdmin.id;
            
            const action = this.editingDiningMenuId ? 'dining-menu-update' : 'dining-menu-create';
            if (this.editingDiningMenuId) {
                formData.id = this.editingDiningMenuId;
            }
            
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...formData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                let message = this.editingDiningMenuId ? 'Dining menu updated successfully' : 'Dining menu created successfully';
                
                // Add recurring menu information if available
                if (data.recurring_menus_created && data.recurring_menus_created > 0) {
                    message += ` (${data.recurring_menus_created} recurring menus created)`;
                }
                
                this.showNotification(message, 'success');
                this.closeDiningMenuModal();
                this.loadDiningMenus();
            } else {
                this.showNotification('Error saving dining menu: ' + data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving dining menu:', error);
            this.showNotification('Error saving dining menu', 'error');
        }
    }

    // =============================================================================
    // HOLIDAYS AND DAYS OFF MANAGEMENT
    // =============================================================================

    populateYearOptions() {
        const yearSelect = document.getElementById('holiday-year');
        const uploadYearSelect = document.getElementById('upload-year');

        // Auto-update to current year - static within session but updates yearly
        const currentYear = new Date().getFullYear();
        
        console.log('Populating year options with year:', currentYear);
        console.log('Year select found:', yearSelect);
        console.log('Upload year select found:', uploadYearSelect);

        // Populate main year selector
        if (yearSelect) {
        yearSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = currentYear;
            option.textContent = currentYear;
                option.selected = true;
            yearSelect.appendChild(option);
            console.log('Main year selector populated');
        }

        // Populate upload year selector
        if (uploadYearSelect) {
            uploadYearSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = currentYear;
            option.textContent = currentYear;
            option.selected = true;
            uploadYearSelect.appendChild(option);
            console.log('Upload year selector populated');
        } else {
            console.error('Upload year selector not found!');
        }
        
        // Update fallback hidden input
        const yearFallbackInput = document.getElementById('year-fallback-input');
        if (yearFallbackInput) {
            yearFallbackInput.value = currentYear;
            console.log('Fallback year input updated to:', currentYear);
        }
    }

    async loadHolidays() {
        console.log('loadHolidays called');
        try {
            // Auto-update to current year - static within session but updates yearly
            const year = new Date().getFullYear();
            console.log('Loading holidays for year:', year);
            const response = await fetch(`${ADMIN_API_BASE_URL}?endpoint=holiday-list&year=${year}`);
            const data = await response.json();
            
            if (data.success) {
                this.holidays = data.holidays;
                console.log('Holidays loaded:', this.holidays.length);
                this.renderHolidays();
            } else {
                console.error('Error loading holidays:', data.error);
            }
        } catch (error) {
            console.error('Error loading holidays:', error);
        }
    }

    renderHolidays() {
        console.log('renderHolidays called');
        const container = document.getElementById('holidays-list');
        if (!container) {
            console.log('Holidays list container not found');
            return;
        }

        if (!this.holidays || this.holidays.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">No holidays found for this year</div>';
            return;
        }

        container.innerHTML = this.holidays.map(holiday => {
            const date = new Date(holiday.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            return `
                <div class="holiday-card">
                    <div class="holiday-header">
                        <h3 class="holiday-date">${date}</h3>
                        <div class="holiday-actions">
                            <button class="btn" onclick="adminPanel.editHoliday(${holiday.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn" style="background: #e74c3c;" onclick="adminPanel.deleteHoliday(${holiday.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                    <div class="holiday-meta">
                        <span>Type: ${holiday.type}</span>
                        <span>Day: ${holiday.day_of_week}</span>
                        ${holiday.is_recurring ? '<span style="color: #e67e22;">🔄 Recurring</span>' : ''}
                    </div>
                    <div class="holiday-content">
                        <h4>${holiday.holiday_name}</h4>
                        ${holiday.description ? `<p>${holiday.description}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    showAddHolidayModal() {
        console.log('showAddHolidayModal called');
        this.editingHolidayId = null;
        document.getElementById('holiday-modal-title').textContent = 'Add Holiday';
        
        // Reset form
        document.getElementById('holiday-form').reset();
        
        // Set default date to current year (auto-updates yearly)
        const today = new Date();
        const currentYear = today.getFullYear();
        const defaultDate = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        document.getElementById('holiday-date').value = defaultDate;
        
        document.getElementById('holiday-modal').classList.remove('hidden');
        console.log('Holiday modal should now be visible');
    }

    closeHolidayModal() {
        document.getElementById('holiday-modal').classList.add('hidden');
        this.editingHolidayId = null;
    }

    editHoliday(holidayId) {
        const holiday = this.holidays.find(h => h.id == holidayId);
        if (!holiday) return;

        this.editingHolidayId = holidayId;
        document.getElementById('holiday-modal-title').textContent = 'Edit Holiday';
        
        // Fill form with holiday data
        document.getElementById('holiday-date').value = holiday.date;
        document.getElementById('holiday-name').value = holiday.holiday_name;
        document.getElementById('holiday-type').value = holiday.type;
        document.getElementById('holiday-description').value = holiday.description || '';
        document.getElementById('holiday-recurring').checked = holiday.is_recurring == 1;
        
        document.getElementById('holiday-modal').classList.remove('hidden');
    }

    async deleteHoliday(holidayId) {
        if (confirm('Are you sure you want to delete this holiday?')) {
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'holiday-delete',
                        id: holidayId,
                        current_admin_id: this.currentAdmin.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Holiday deleted successfully', 'success');
                    this.loadHolidays();
                } else {
                    this.showNotification('Error deleting holiday: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting holiday:', error);
                this.showNotification('Error deleting holiday', 'error');
            }
        }
    }

    async saveHoliday(formData) {
        try {
            formData.current_admin_id = this.currentAdmin.id;
            
            const action = this.editingHolidayId ? 'holiday-update' : 'holiday-create';
            if (this.editingHolidayId) {
                formData.id = this.editingHolidayId;
            }
            
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...formData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(this.editingHolidayId ? 'Holiday updated successfully' : 'Holiday created successfully', 'success');
                this.closeHolidayModal();
                this.loadHolidays();
            } else {
                this.showNotification('Error saving holiday: ' + data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving holiday:', error);
            this.showNotification('Error saving holiday', 'error');
        }
    }

    showUploadHolidayModal() {
        document.getElementById('upload-holiday-form').reset();
        const year = new Date().getFullYear();
        const firstDate = new Date(year, 0, 1);
        this.renderHolidayImportRows([{
            date: `${String(firstDate.getMonth() + 1).padStart(2, '0')}/${String(firstDate.getDate()).padStart(2, '0')}/${year}`,
            day_of_week: firstDate.toLocaleDateString('en-US', { weekday: 'long' }),
            holiday_name: ''
        }]);
        this.showHolidayImportErrors([]);
        document.getElementById('upload-holiday-modal').classList.remove('hidden');
    }

    closeUploadHolidayModal() {
        document.getElementById('upload-holiday-modal').classList.add('hidden');
    }

    renderHolidayImportRows(rows) {
        const body = document.getElementById('holiday-import-table-body');
        if (!body) return;
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const values = Array.isArray(rows) && rows.length ? rows : [{ date: '', day_of_week: '', holiday_name: '' }];
        body.innerHTML = values.map((row, index) => `
            <tr data-holiday-import-row>
                <td><input type="text" data-holiday-date inputmode="numeric" placeholder="MM/DD/YYYY" value="${this.escapeHtml(row.date || '')}" aria-label="Date for row ${index + 1}"></td>
                <td><select data-holiday-day aria-label="Day of week for row ${index + 1}"><option value="">Select day</option>${weekdays.map(day => `<option value="${day}" ${String(row.day_of_week || '').toLowerCase() === day.toLowerCase() ? 'selected' : ''}>${day}</option>`).join('')}</select></td>
                <td><input type="text" data-holiday-name placeholder="Holiday name" value="${this.escapeHtml(row.holiday_name || '')}" aria-label="Holiday name for row ${index + 1}"></td>
                <td><button type="button" class="holiday-row-remove" data-remove-holiday-row aria-label="Remove row ${index + 1}"><i class="fas fa-times"></i></button></td>
            </tr>`).join('');
        body.querySelectorAll('[data-remove-holiday-row]').forEach(button => button.addEventListener('click', event => {
            event.currentTarget.closest('tr')?.remove();
            if (!body.querySelector('tr')) this.addHolidayImportRow();
        }));
        body.querySelectorAll('[data-holiday-date]').forEach(input => input.addEventListener('change', event => {
            const value = String(event.currentTarget.value || '').trim();
            const parsed = /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? new Date(`${value.substring(6)}-${value.substring(0, 2)}-${value.substring(3, 5)}T12:00:00`) : null;
            if (parsed && !Number.isNaN(parsed.getTime())) event.currentTarget.closest('tr').querySelector('[data-holiday-day]').value = parsed.toLocaleDateString('en-US', { weekday: 'long' });
        }));
    }

    addHolidayImportRow() {
        const rows = this.getHolidayImportRows();
        rows.push({ date: '', day_of_week: '', holiday_name: '' });
        this.renderHolidayImportRows(rows);
        document.querySelector('#holiday-import-table-body tr:last-child [data-holiday-date]')?.focus();
    }

    getHolidayImportRows() {
        return Array.from(document.querySelectorAll('#holiday-import-table-body [data-holiday-import-row]')).map(row => ({
            date: row.querySelector('[data-holiday-date]')?.value.trim() || '',
            day_of_week: row.querySelector('[data-holiday-day]')?.value || '',
            holiday_name: row.querySelector('[data-holiday-name]')?.value.trim() || ''
        }));
    }

    showHolidayImportErrors(errors) {
        const target = document.getElementById('holiday-import-errors');
        if (!target) return;
        const messages = Array.isArray(errors) ? errors.filter(Boolean) : [];
        target.innerHTML = messages.length ? `<strong>Please fix these rows:</strong><ul>${messages.map(message => `<li>${this.escapeHtml(message)}</li>`).join('')}</ul>` : '';
        target.classList.toggle('show', messages.length > 0);
    }

    async previewHolidayFile(file) {
        if (!file) return;
        const formData = new FormData();
        formData.append('action', 'holiday-preview');
        formData.append('current_admin_id', this.currentAdmin.id);
        formData.append('year', String(new Date().getFullYear()));
        formData.append('file', file);
        try {
            const response = await fetch(ADMIN_API_BASE_URL, { method: 'POST', body: formData });
            const data = await response.json();
            if (Array.isArray(data.rows) && data.rows.length) this.renderHolidayImportRows(data.rows);
            this.showHolidayImportErrors(data.errors || (data.error ? [data.error] : []));
        } catch (error) {
            this.showHolidayImportErrors(['The file could not be previewed. Check that it is a valid CSV or Excel file.']);
        }
    }

    async uploadHolidayFile(formData) {
        try {
            const currentYear = new Date().getFullYear();
            const rows = this.getHolidayImportRows();
            formData.delete('file');
            formData.set('year', currentYear.toString());
            formData.set('action', 'holiday-upload');
            formData.set('current_admin_id', this.currentAdmin.id);
            formData.set('rows_json', JSON.stringify(rows.map(row => ({ date: row.date, dayOfWeek: row.day_of_week, holidayName: row.holiday_name }))));
            const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                const message = `Holiday schedule imported successfully. ${data.imported} row${data.imported === 1 ? '' : 's'} saved.`;
                this.showNotification(message, 'success');
                this.closeUploadHolidayModal();
                this.loadHolidays();
            } else {
                const errors = data.errors || [data.error || 'The holiday schedule could not be imported.'];
                this.showHolidayImportErrors(errors);
                this.showNotification('Nothing was imported. Fix the errors shown in the table.', 'error');
            }
        } catch (error) {
            this.showHolidayImportErrors(['The holiday schedule could not be imported. Please try again.']);
            this.showNotification('Error importing holidays', 'error');
        }
    }

    async exportHolidays(format = 'csv') {
        try {
            // Auto-update to current year - static within session but updates yearly
            const year = new Date().getFullYear();
            window.open(`${ADMIN_API_BASE_URL}?endpoint=holiday-export&year=${year}&format=${encodeURIComponent(format)}`, '_blank');
        } catch (error) {
            console.error('Error exporting holidays:', error);
            this.showNotification('Error exporting holidays', 'error');
        }
    }

    async downloadTemplate(format = 'csv') {
        try {
            // Auto-update to current year - static within session but updates yearly
            const year = new Date().getFullYear();
            window.open(`${ADMIN_API_BASE_URL}?endpoint=holiday-template&year=${year}&format=${encodeURIComponent(format)}`, '_blank');
        } catch (error) {
            console.error('Error downloading template:', error);
            this.showNotification('Error downloading template', 'error');
        }
    }

    escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[character]);
    }

    async deleteAllHolidays() {
        // Auto-update to current year - static within session but updates yearly
        const year = new Date().getFullYear();
        if (confirm(`Are you sure you want to delete ALL holidays for ${year}? This action cannot be undone.`)) {
            try {
                const response = await fetch(`${ADMIN_API_BASE_URL}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'holiday-delete-by-year',
                        year: year,
                        current_admin_id: this.currentAdmin.id
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('All holidays deleted successfully', 'success');
                    this.loadHolidays();
                } else {
                    this.showNotification('Error deleting holidays: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting holidays:', error);
                this.showNotification('Error deleting holidays', 'error');
            }
        }
    }
}

// Initialize admin panel when DOM is loaded
let adminPanel;
console.log('About to add DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    adminPanel = new AdminPanel();
    // Make adminPanel available globally for any remaining onclick handlers
    window.adminPanel = adminPanel;
    console.log('AdminPanel initialized and made global');
});
console.log('DOMContentLoaded listener added');
