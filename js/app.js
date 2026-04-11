/**
 * ============================================================
 * app.js — Application Entry Point
 * ============================================================
 *
 * Responsibilities:
 *   - Render sidebar navigation buttons
 *   - Handle page routing (click nav → render page)
 *   - Mobile sidebar toggle
 *
 * Developer: this file should stay small. All page rendering
 * logic lives in pages.js; data in data.js; utils in utils.js.
 */

// ── Navigation definition ──
const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',       icon: 'dashboard' },
  { key: 'parts',      label: 'Spare Parts',     icon: 'parts' },
  { key: 'orders',     label: 'Service Orders',  icon: 'orders' },
  { key: 'customers',  label: 'Customers',       icon: 'customers' },
  { key: 'reports',    label: 'Reports',          icon: 'reports' },
];

// ── Page router map ──
const PAGE_RENDERERS = {
  dashboard:  renderDashboard,
  parts:      renderParts,
  orders:     renderOrders,
  customers:  renderCustomers,
  reports:    renderReports,
};

/**
 * navigateTo(pageKey)
 * Switches the active page, updates nav highlight,
 * and calls the appropriate render function.
 */
function navigateTo(pageKey) {
  State.page = pageKey;
  renderNav();
  const renderer = PAGE_RENDERERS[pageKey];
  if (renderer) renderer();
  closeSidebar();
}

/**
 * renderNav()
 * Builds the sidebar navigation buttons with
 * active state and low-stock badge.
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
        <span>${n.label}</span>
        ${badge}
      </button>
    `;
  }).join('');
}

// ── Mobile sidebar helpers ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  navigateTo('dashboard');
});
