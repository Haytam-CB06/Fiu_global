(function() {
  document.addEventListener('DOMContentLoaded', async function() {
    const adminBtn = document.getElementById('admin-panel-btn');
    if (!adminBtn) return;

    const adminRoles = new Set(['admin', 'super_admin']);
    const hide = () => {
      adminBtn.hidden = true;
      adminBtn.classList.add('hidden');
      adminBtn.setAttribute('aria-hidden', 'true');
    };
    const show = () => {
      adminBtn.hidden = false;
      adminBtn.classList.remove('hidden');
      adminBtn.style.display = 'inline-flex';
      adminBtn.removeAttribute('aria-hidden');
    };

    try {
      const response = await fetch('/auth/session', { credentials: 'same-origin' });
      if (!response.ok) {
        hide();
        return;
      }

      const data = await response.json();
      const activeUserRole = String(data.user?.role || data.session?.user_role || '').toLowerCase();
      const isUserDashboardAdmin = adminRoles.has(activeUserRole);

      if (data.admin && isUserDashboardAdmin) {
        localStorage.setItem('adminSession', JSON.stringify(data.admin));
      } else {
        localStorage.removeItem('adminSession');
      }

      if (data.session?.is_admin && isUserDashboardAdmin) {
        show();
      } else {
        hide();
      }
    } catch (_) {
      hide();
    }

    adminBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = '/admin_dashboard';
    });
  });
})();
