/**
 * ============================================================
 * app.js — Application Entry Point
 * ============================================================
 *
 * Responsibilities:
 *   - Check authentication on load
 *   - Render sidebar navigation buttons + user info
 *   - Handle page routing
 *   - Mobile sidebar toggle
 */

const NAV_ITEMS = [
  { key: 'dashboard',    labelKey: 'dashboard',    icon: 'dashboard' },
  { key: 'parts',        labelKey: 'parts',        icon: 'parts' },
  { key: 'orders',       labelKey: 'orders',       icon: 'orders' },
  { key: 'customers',    labelKey: 'customers',    icon: 'customers' },
  { key: 'stockHistory', labelKey: 'stockHistory', icon: 'ledger' },
  { key: 'reports',      labelKey: 'reports',      icon: 'reports' },
];

const PAGE_RENDERERS = {
  dashboard:    renderDashboard,
  parts:        renderParts,
  orders:       renderOrders,
  customers:    renderCustomers,
  stockHistory: renderStockHistory,
  reports:      renderReports,
};

/**
 * navigateTo(pageKey)
 * Switches page, updates nav highlight, renders content.
 */
function navigateTo(pageKey) {
  State.page = pageKey;
  renderNav();
  const content = document.getElementById('main-content');
  const renderer = PAGE_RENDERERS[pageKey];
  if (renderer) renderer();
  closeSidebar();
}

/**
 * renderNav()
 * Builds sidebar nav buttons + user/logout section.
 */
function renderNav() {
  const lowCount = lowStockParts().length;
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = NAV_ITEMS.map(n => {
    const active = State.page === n.key ? 'active' : '';
    const badge  = n.key === 'parts' && lowCount > 0
      ? `<span class="nav-badge">${lowCount}</span>` : '';
    return `
      <button class="nav-btn ${active}" onclick="navigateTo('${n.key}')">
        ${icon(n.icon, 20)}
        <span>${t(n.labelKey)}</span>
        ${badge}
      </button>
    `;
  }).join('');

  // User info + logout in sidebar
  const userEl = document.getElementById('sidebar-user');
  if (userEl) {
    userEl.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${getCurrentUser().charAt(0).toUpperCase()}</div>
        <div class="user-details">
          <div class="user-name">${getCurrentUser()}</div>
          <button class="logout-link" onclick="logout()">${t('signOut')}</button>
        </div>
      </div>
    `;
  }
}

// ── Mobile sidebar helpers ──
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', sidebar.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ── Boot: check auth on page load ──
document.addEventListener('DOMContentLoaded', () => {
  updateLangUI();
  if (isLoggedIn()) {
    // Already authenticated this session — show app with a soft fade-in
    const shell = document.querySelector('.app-shell');
    shell.style.display = 'flex';
    shell.style.opacity = '0';
    shell.style.transition = 'opacity 0.35s ease';
    bootApp();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shell.style.opacity = '1';
      setTimeout(() => { shell.style.opacity = ''; shell.style.transition = ''; }, 400);
    }));
  } else {
    // Show login screen
    showLoginScreen();
  }
});
