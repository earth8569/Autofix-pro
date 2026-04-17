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

// ── Theme ──
const MOON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
const SUN_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function setTheme(theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem('afp-theme', theme);
  updateThemeUI(theme);
}

function toggleTheme() {
  setTheme(document.documentElement.classList.contains('light-theme') ? 'dark' : 'light');
}

function initTheme() {
  setTheme(localStorage.getItem('afp-theme') || 'dark');
  const btn = document.getElementById('theme-switch-btn');
  if (btn) btn.addEventListener('click', toggleTheme);
}

function updateThemeUI(theme) {
  const topBtn = document.getElementById('topbar-theme-btn');
  if (topBtn) {
    if (theme === 'light') {
      topBtn.title     = 'Switch to Dark';
      topBtn.innerHTML = MOON_SVG;
    } else {
      topBtn.title     = 'Switch to Light';
      topBtn.innerHTML = SUN_SVG;
    }
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
  initTheme();
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
    _maybeShowRecoveryModal();
  } else {
    // Show login screen
    showLoginScreen();
    // Still surface data corruption even when the login screen is showing,
    // so the user can recover without having to log in first.
    _maybeShowRecoveryModal();
  }
});

// If data.js detected a corrupt server data file during boot, pop the
// recovery modal so the user can pick a snapshot before using the app.
function _maybeShowRecoveryModal() {
  if (window.__corruptOnBoot && typeof showCorruptRecoveryModal === 'function') {
    showCorruptRecoveryModal(window.__corruptBackups || []);
  }
}
