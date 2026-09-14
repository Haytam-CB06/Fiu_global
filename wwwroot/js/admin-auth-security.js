(function() {
  if (typeof AdminPanel === 'undefined') {
    return;
  }

  AdminPanel.prototype.init = async function() {
    console.log('AdminPanel secure init called');
    const ok = await this.checkAuth();
    if (!ok) return;

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
  };

  AdminPanel.prototype.checkAuth = async function() {
    console.log('secure checkAuth called');
    try {
      const response = await fetch('/auth/session', { credentials: 'same-origin' });
      if (!response.ok) {
        localStorage.removeItem('adminSession');
        window.location.replace('/login.html');
        return false;
      }

      const data = await response.json();
      if (!data.session || !data.session.is_admin || !data.admin) {
        localStorage.removeItem('adminSession');
        window.location.replace('/login.html');
        return false;
      }

      this.currentAdmin = data.admin;
      localStorage.setItem('adminSession', JSON.stringify(data.admin));
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      this.updateAdminInfo();
      return true;
    } catch (error) {
      console.error('Error validating admin session:', error);
      localStorage.removeItem('adminSession');
      window.location.replace('/login.html');
      return false;
    }
  };

  AdminPanel.prototype.logout = async function() {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {}

    localStorage.removeItem('adminSession');
    localStorage.removeItem('user');
    window.location.replace('/login.html');
  };
})();
