/**
 * ============================================================
 * pages.js — Page Renderers
 * ============================================================
 *
 * Each function renders a full page into #main-content.
 *
 *   renderDashboard()   — KPIs, charts, low-stock alerts
 *   renderParts()       — Spare parts inventory CRUD
 *   renderOrders()      — Service orders CRUD
 *   renderCustomers()   — Customer database CRUD
 *   renderReports()     — Date-range selector + Excel export
 *
 * Developer: every page follows the same pattern:
 *   1. Build an HTML string
 *   2. Inject into #main-content
 *   3. Attach event listeners via inline onclick or
 *      post-render querySelector
 *
 * All state mutations go through the State object (data.js)
 * and call State.save() + re-render.
 */


/* ═══════════════════════════════════════════════
 *  DASHBOARD PAGE
 * ═══════════════════════════════════════════════ */
function renderDashboard() {
  const { parts, orders } = State;
  const rev       = totalRevenue(orders);
  const completed = orders.filter(o => o.status === 'completed').length;
  const pending   = orders.filter(o => o.status !== 'completed').length;
  const lowStock  = lowStockParts();
  const invValue  = parts.reduce((s, p) => s + p.cost * p.qty, 0);

  // Revenue last 7 days
  const revByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dayRev = orders.filter(o => o.date === d).reduce((s, o) => s + orderTotal(o), 0);
    revByDay.push({ label: d.slice(5), value: dayRev });
  }

  // Parts by category
  const catMap = {};
  parts.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + p.qty; });
  const byCategory = Object.entries(catMap).map(([label, value]) => ({ label, value }));

  // Sparkline: daily orders last 14 days
  const spark = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    spark.push(orders.filter(o => o.date === d).length);
  }

  // Low stock table rows
  let alertHTML = '';
  if (lowStock.length) {
    const rows = lowStock.map(p => `
      <tr>
        <td class="mono">${p.sku}</td><td>${p.name}</td>
        <td class="danger-text">${p.qty}</td><td>${p.reorder}</td>
        <td><span class="badge badge-danger">REORDER</span></td>
      </tr>
    `).join('');
    alertHTML = `
      <div class="alert-section">
        <h3>${icon('alert', 18, 'var(--danger)')} Low Stock Alerts</h3>
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Part Name</th><th>On Hand</th><th>Reorder Lvl</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('dashboard', 24)} Dashboard</h2>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Revenue</div>
          <div class="kpi-value accent">${fmtCurrency(rev)}</div>
          ${renderSparkline(spark)}
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Completed Jobs</div>
          <div class="kpi-value">${completed}</div>
          <div class="kpi-sub">${pending} pending</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inventory Value</div>
          <div class="kpi-value">${fmtCurrency(invValue)}</div>
          <div class="kpi-sub">${parts.length} items tracked</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Low Stock Alerts</div>
          <div class="kpi-value ${lowStock.length ? 'danger' : ''}">${lowStock.length}</div>
          <div class="kpi-sub">items below reorder</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">${renderBarChart(revByDay, { label: 'Revenue — Last 7 Days (฿)' })}</div>
        <div class="chart-card">${renderDonutChart(byCategory, { label: 'Stock by Category' })}</div>
      </div>

      ${alertHTML}
    </div>
  `;
}


/* ═══════════════════════════════════════════════
 *  SPARE PARTS PAGE
 * ═══════════════════════════════════════════════ */
function renderParts() {
  const cats = partCategories();

  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('parts', 24)} Spare Parts Inventory</h2>
        <button class="btn btn-primary" onclick="openPartForm()">${icon('plus', 16)} Add Part</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="part-search" placeholder="Search parts..." oninput="filterPartsTable()"/></div>
        <select id="part-cat-filter" onchange="filterPartsTable()">
          ${cats.map(c => `<option>${c}</option>`).join('')}
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Part Name</th><th>Category</th><th>Unit</th><th>Cost</th><th>Price</th><th>Margin</th><th>Qty</th><th>Status</th><th style="width:90px">Actions</th></tr></thead>
          <tbody id="parts-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterPartsTable();
}

/** Filters and re-renders parts table body */
function filterPartsTable() {
  const search = (document.getElementById('part-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('part-cat-filter')?.value || 'All';
  const filtered = State.parts.filter(p => {
    if (cat !== 'All' && p.category !== cat) return false;
    if (search && !(p.name + ' ' + p.sku).toLowerCase().includes(search)) return false;
    return true;
  });
  const tbody = document.getElementById('parts-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">No parts found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(p => `
    <tr class="${p.qty <= p.reorder ? 'row-warn' : ''}">
      <td class="mono">${p.sku}</td>
      <td>${p.name}</td>
      <td><span class="badge">${p.category}</span></td>
      <td>${p.unit}</td>
      <td>${fmtCurrency(p.cost)}</td>
      <td>${fmtCurrency(p.price)}</td>
      <td class="accent-text">${fmtCurrency(p.price - p.cost)}</td>
      <td>${p.qty}</td>
      <td>${p.qty <= p.reorder ? '<span class="badge badge-danger">LOW</span>' : '<span class="badge badge-ok">OK</span>'}</td>
      <td class="actions">
        <button class="btn-icon" title="Edit" onclick="openPartForm('${p.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" title="Delete" onclick="deletePart('${p.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>
  `).join('');
}

/** Opens the add/edit modal for a part */
function openPartForm(id) {
  const isNew = !id;
  const p = isNew
    ? { name: '', sku: '', category: '', cost: 0, price: 0, qty: 0, reorder: 5, unit: 'pc' }
    : State.parts.find(x => x.id === id);

  openModal(isNew ? 'Add New Part' : 'Edit Part', `
    <div class="form-grid">
      <label>SKU *<input id="pf-sku" value="${p.sku}"/></label>
      <label>Part Name *<input id="pf-name" value="${p.name}"/></label>
      <label>Category<input id="pf-cat" value="${p.category}" placeholder="e.g. Filters"/></label>
      <label>Unit<input id="pf-unit" value="${p.unit}" placeholder="pc, set, bottle"/></label>
      <label>Cost (฿)<input id="pf-cost" type="number" value="${p.cost}"/></label>
      <label>Sell Price (฿)<input id="pf-price" type="number" value="${p.price}"/></label>
      <label>Quantity<input id="pf-qty" type="number" value="${p.qty}"/></label>
      <label>Reorder Level<input id="pf-reorder" type="number" value="${p.reorder}"/></label>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePart('${id || ''}')">${icon('check', 16)} Save</button>
    </div>
  `);
}

function savePart(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const sku = g('#pf-sku'), name = g('#pf-name');
  if (!sku || !name) return alert('SKU and Name are required.');

  const data = { sku, name, category: g('#pf-cat'), unit: g('#pf-unit'), cost: n('#pf-cost'), price: n('#pf-price'), qty: n('#pf-qty'), reorder: n('#pf-reorder') };

  if (id) {
    const idx = State.parts.findIndex(p => p.id === id);
    if (idx !== -1) State.parts[idx] = { ...State.parts[idx], ...data };
    showToast('Part updated');
  } else {
    State.parts.push({ id: uid(), ...data });
    showToast('Part added successfully');
  }
  State.save();
  closeModal();
  renderParts();
}

function deletePart(id) {
  if (!confirm('Delete this part? This cannot be undone.')) return;
  State.parts = State.parts.filter(p => p.id !== id);
  State.save();
  showToast('Part deleted', 'warn');
  renderParts();
}


/* ═══════════════════════════════════════════════
 *  SERVICE ORDERS PAGE
 * ═══════════════════════════════════════════════ */
function renderOrders() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('orders', 24)} Service Orders</h2>
        <button class="btn btn-primary" onclick="openOrderForm()">${icon('plus', 16)} New Order</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="order-search" placeholder="Search orders..." oninput="filterOrdersTable()"/></div>
        <select id="order-status-filter" onchange="filterOrdersTable()">
          <option>All</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option>
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Service</th><th>Parts</th><th>Labor</th><th>Total</th><th>Status</th><th style="width:90px">Actions</th></tr></thead>
          <tbody id="orders-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterOrdersTable();
}

function filterOrdersTable() {
  const search = (document.getElementById('order-search')?.value || '').toLowerCase();
  const status = document.getElementById('order-status-filter')?.value || 'All';
  const statusColors = { pending: 'badge-warn', 'in-progress': 'badge-info', completed: 'badge-ok' };

  const filtered = State.orders.filter(o => {
    if (status !== 'All' && o.status !== status) return false;
    if (search && !(o.customerName + ' ' + o.service + ' ' + o.plate).toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.getElementById('orders-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">No orders found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(o => {
    const pc = o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
    return `<tr>
      <td>${fmtDate(o.date)}</td><td>${o.customerName}</td>
      <td>${o.vehicle}<br><small class="mono">${o.plate}</small></td>
      <td>${o.service}</td>
      <td>${fmtCurrency(pc)}</td><td>${fmtCurrency(o.laborCost)}</td>
      <td class="accent-text bold">${fmtCurrency(orderTotal(o))}</td>
      <td><span class="badge ${statusColors[o.status]}">${o.status}</span></td>
      <td class="actions">
        <button class="btn-icon" onclick="openOrderForm('${o.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" onclick="deleteOrder('${o.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * openOrderForm — renders the order creation/edit modal.
 * Parts line items are managed via a global _orderPartsUsed array.
 */
let _orderPartsUsed = [];

function openOrderForm(id) {
  const isNew = !id;
  const o = isNew
    ? { date: today(), customerId: '', customerName: '', vehicle: '', plate: '', service: '', partsUsed: [], laborCost: 0, discount: 0, status: 'pending', notes: '' }
    : State.orders.find(x => x.id === id);

  _orderPartsUsed = JSON.parse(JSON.stringify(o.partsUsed));

  const custOpts = State.customers.map(c => `<option value="${c.id}" ${c.id === o.customerId ? 'selected' : ''}>${c.name} (${c.plate})</option>`).join('');
  const partOpts = State.parts.map(p => `<option value="${p.id}">${p.name} (${p.qty} avail)</option>`).join('');

  const body = openModal(isNew ? 'New Service Order' : 'Edit Order', `
    <div class="form-grid">
      <label>Date<input id="of-date" type="date" value="${o.date}"/></label>
      <label>Customer
        <select id="of-customer" onchange="pickOrderCustomer()">
          <option value="">— select —</option>${custOpts}
        </select>
      </label>
      <label>Vehicle<input id="of-vehicle" value="${o.vehicle}"/></label>
      <label>Plate<input id="of-plate" value="${o.plate}"/></label>
      <label class="span-2">Service Description<input id="of-service" value="${o.service}" placeholder="e.g. Oil Change, Brake Repair"/></label>
    </div>
    <div class="section-label">Parts Used</div>
    <div id="of-parts-lines"></div>
    <button class="btn btn-sm" onclick="addOrderPartLine()">${icon('plus', 14)} Add Part</button>
    <div class="form-grid" style="margin-top:16px">
      <label>Labor Cost (฿)<input id="of-labor" type="number" value="${o.laborCost}"/></label>
      <label>Discount (฿)<input id="of-discount" type="number" value="${o.discount}"/></label>
      <label>Status
        <select id="of-status">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="in-progress" ${o.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </label>
      <label>Notes<input id="of-notes" value="${o.notes || ''}"/></label>
    </div>
    <div class="order-total" id="of-total">Order Total: <strong>${fmtCurrency(0)}</strong></div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveOrder('${id || ''}')">${icon('check', 16)} Save Order</button>
    </div>
  `, 640);

  renderOrderPartLines();
}

function renderOrderPartLines() {
  const container = document.getElementById('of-parts-lines');
  if (!container) return;
  const partOpts = State.parts.map(p => `<option value="${p.id}">${p.name} (${p.qty})</option>`).join('');
  container.innerHTML = _orderPartsUsed.map((pl, i) => `
    <div class="part-line">
      <select onchange="updateOrderPartLine(${i}, this.value)">
        <option value="">— pick part —</option>
        ${State.parts.map(p => `<option value="${p.id}" ${p.id === pl.partId ? 'selected' : ''}>${p.name} (${p.qty})</option>`).join('')}
      </select>
      <input type="number" min="1" value="${pl.qty}" style="width:60px" onchange="updateOrderPartQty(${i}, this.value)"/>
      <span class="part-price">${fmtCurrency(pl.unitPrice * pl.qty)}</span>
      <button class="btn-icon danger" onclick="removeOrderPartLine(${i})">${icon('x', 14)}</button>
    </div>
  `).join('');
  recalcOrderTotal();
}

function addOrderPartLine() {
  _orderPartsUsed.push({ partId: '', partName: '', qty: 1, unitPrice: 0 });
  renderOrderPartLines();
}
function removeOrderPartLine(i) {
  _orderPartsUsed.splice(i, 1);
  renderOrderPartLines();
}
function updateOrderPartLine(i, partId) {
  const pt = State.parts.find(p => p.id === partId);
  if (pt) { _orderPartsUsed[i].partId = pt.id; _orderPartsUsed[i].partName = pt.name; _orderPartsUsed[i].unitPrice = pt.price; }
  renderOrderPartLines();
}
function updateOrderPartQty(i, qty) {
  _orderPartsUsed[i].qty = Math.max(1, Number(qty));
  renderOrderPartLines();
}
function recalcOrderTotal() {
  const pc = _orderPartsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
  const labor = Number(document.getElementById('of-labor')?.value) || 0;
  const disc  = Number(document.getElementById('of-discount')?.value) || 0;
  const el = document.getElementById('of-total');
  if (el) el.innerHTML = `Order Total: <strong>${fmtCurrency(pc + labor - disc)}</strong>`;
}

function pickOrderCustomer() {
  const cid = document.getElementById('of-customer').value;
  const c = State.customers.find(x => x.id === cid);
  if (c) {
    document.getElementById('of-vehicle').value = c.vehicle;
    document.getElementById('of-plate').value   = c.plate;
  }
}

function saveOrder(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const customerName = (() => {
    const cid = g('#of-customer');
    const c = State.customers.find(x => x.id === cid);
    return c ? c.name : '';
  })();

  if (!customerName) return alert('Please select a customer.');
  if (!g('#of-service')) return alert('Service description is required.');

  const data = {
    date: g('#of-date'), customerId: g('#of-customer'), customerName,
    vehicle: g('#of-vehicle'), plate: g('#of-plate'), service: g('#of-service'),
    partsUsed: _orderPartsUsed, laborCost: n('#of-labor'), discount: n('#of-discount'),
    status: g('#of-status'), notes: g('#of-notes'),
  };

  if (id) {
    const idx = State.orders.findIndex(o => o.id === id);
    if (idx !== -1) State.orders[idx] = { ...State.orders[idx], ...data };
    showToast('Order updated');
  } else {
    // Deduct stock for parts used in a new order
    data.partsUsed.forEach(pu => {
      const pt = State.parts.find(p => p.id === pu.partId);
      if (pt) pt.qty = Math.max(0, pt.qty - pu.qty);
    });
    State.orders.unshift({ id: uid(), ...data });
    showToast('Service order created');
  }
  State.save();
  closeModal();
  renderOrders();
}

function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  State.orders = State.orders.filter(o => o.id !== id);
  State.save();
  showToast('Order deleted', 'warn');
  renderOrders();
}


/* ═══════════════════════════════════════════════
 *  CUSTOMERS PAGE
 * ═══════════════════════════════════════════════ */
function renderCustomers() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('customers', 24)} Customers</h2>
        <button class="btn btn-primary" onclick="openCustomerForm()">${icon('plus', 16)} Add Customer</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="cust-search" placeholder="Search customers..." oninput="filterCustomersTable()"/></div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Plate</th><th>Orders</th><th>Total Spent</th><th>Notes</th><th style="width:90px">Actions</th></tr></thead>
          <tbody id="cust-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterCustomersTable();
}

function filterCustomersTable() {
  const search = (document.getElementById('cust-search')?.value || '').toLowerCase();
  const filtered = State.customers.filter(c =>
    !search || (c.name + ' ' + c.phone + ' ' + c.plate).toLowerCase().includes(search)
  );
  const tbody = document.getElementById('cust-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">No customers found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(c => {
    const oc = State.orders.filter(o => o.customerId === c.id).length;
    const ts = State.orders.filter(o => o.customerId === c.id).reduce((s, o) => s + orderTotal(o), 0);
    return `<tr>
      <td class="bold">${c.name}</td><td>${c.phone}</td><td>${c.vehicle}</td><td class="mono">${c.plate}</td>
      <td>${oc}</td><td class="accent-text">${fmtCurrency(ts)}</td><td>${c.notes}</td>
      <td class="actions">
        <button class="btn-icon" onclick="openCustomerForm('${c.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" onclick="deleteCustomer('${c.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>`;
  }).join('');
}

function openCustomerForm(id) {
  const isNew = !id;
  const c = isNew ? { name: '', phone: '', vehicle: '', plate: '', notes: '' } : State.customers.find(x => x.id === id);
  openModal(isNew ? 'Add Customer' : 'Edit Customer', `
    <div class="form-grid">
      <label>Full Name *<input id="cf-name" value="${c.name}"/></label>
      <label>Phone<input id="cf-phone" value="${c.phone}"/></label>
      <label>Vehicle<input id="cf-vehicle" value="${c.vehicle}" placeholder="e.g. Honda Civic 2022"/></label>
      <label>License Plate<input id="cf-plate" value="${c.plate}"/></label>
      <label class="span-2">Notes<input id="cf-notes" value="${c.notes}"/></label>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer('${id || ''}')">${icon('check', 16)} Save</button>
    </div>
  `);
}

function saveCustomer(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const name = g('#cf-name');
  if (!name) return alert('Name is required.');
  const data = { name, phone: g('#cf-phone'), vehicle: g('#cf-vehicle'), plate: g('#cf-plate'), notes: g('#cf-notes') };
  if (id) {
    const idx = State.customers.findIndex(c => c.id === id);
    if (idx !== -1) State.customers[idx] = { ...State.customers[idx], ...data };
    showToast('Customer updated');
  } else {
    State.customers.push({ id: uid(), ...data });
    showToast('Customer added');
  }
  State.save();
  closeModal();
  renderCustomers();
}

function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  State.customers = State.customers.filter(c => c.id !== id);
  State.save();
  showToast('Customer removed', 'warn');
  renderCustomers();
}


/* ═══════════════════════════════════════════════
 *  REPORTS & EXPORT PAGE
 * ═══════════════════════════════════════════════ */
function renderReports() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('reports', 24)} Reports & Export</h2>

      <div class="export-settings">
        <h3>${icon('settings', 18)} Export Settings</h3>
        <div class="radio-group">
          <label class="radio-label"><input type="radio" name="export-mode" value="all" checked onchange="toggleDateRange()"/> Export All Data</label>
          <label class="radio-label"><input type="radio" name="export-mode" value="range" onchange="toggleDateRange()"/> Custom Date Range</label>
        </div>
        <div class="date-range" id="date-range-fields" style="display:none">
          <label>From <input type="date" id="exp-from"/></label>
          <label>To   <input type="date" id="exp-to"/></label>
        </div>
        <button class="btn btn-primary btn-lg" onclick="handleExport()">${icon('download', 18)} Export to Excel (.xlsx)</button>
        <p class="hint">The Excel file includes 4 sheets: Spare Parts, Service Orders, Customers, and a Summary page.</p>
      </div>

      <div class="report-preview" id="report-preview"></div>
    </div>
  `;
  updateReportPreview();
}

function toggleDateRange() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value;
  document.getElementById('date-range-fields').style.display = mode === 'range' ? 'flex' : 'none';
  updateReportPreview();
}

function updateReportPreview() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value || 'all';
  const from = document.getElementById('exp-from')?.value || '';
  const to   = document.getElementById('exp-to')?.value   || '';

  const filtered = State.orders.filter(o => {
    if (mode === 'all') return true;
    if (from && o.date < from) return false;
    if (to   && o.date > to)   return false;
    return true;
  });

  const rev   = totalRevenue(filtered);
  const parts = filtered.reduce((s, o) => s + o.partsUsed.reduce((ps, p) => ps + p.unitPrice * p.qty, 0), 0);
  const labor = filtered.reduce((s, o) => s + o.laborCost, 0);

  const revByStatus = [
    { label: 'Completed',   value: filtered.filter(o => o.status === 'completed').reduce((s, o) => s + orderTotal(o), 0),    color: '#10b981' },
    { label: 'In Progress', value: filtered.filter(o => o.status === 'in-progress').reduce((s, o) => s + orderTotal(o), 0), color: '#3b82f6' },
    { label: 'Pending',     value: filtered.filter(o => o.status === 'pending').reduce((s, o) => s + orderTotal(o), 0),     color: '#f97316' },
  ];

  document.getElementById('report-preview').innerHTML = `
    <h3>Preview — ${mode === 'all' ? 'All Time' : `${fmtDate(from)} to ${fmtDate(to)}`}</h3>
    <div class="kpi-grid small">
      <div class="kpi-card"><div class="kpi-label">Orders</div><div class="kpi-value">${filtered.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Revenue</div><div class="kpi-value accent">${fmtCurrency(rev)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Parts Revenue</div><div class="kpi-value">${fmtCurrency(parts)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Labor Revenue</div><div class="kpi-value">${fmtCurrency(labor)}</div></div>
    </div>
    <div class="chart-card" style="margin-top:20px">
      ${renderBarChart(revByStatus, { label: 'Revenue by Order Status (฿)', width: 420, height: 200 })}
    </div>
  `;
}

function handleExport() {
  const mode = document.querySelector('input[name="export-mode"]:checked')?.value || 'all';
  exportToExcel({
    parts:     State.parts,
    orders:    State.orders,
    customers: State.customers,
    dateFrom:  mode === 'range' ? document.getElementById('exp-from')?.value : null,
    dateTo:    mode === 'range' ? document.getElementById('exp-to')?.value   : null,
  });
}
