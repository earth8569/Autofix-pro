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
 * All UI strings go through t() from i18n.js.
 */


// Pending admin-protected part edit (set before admin modal opens)
let _pendingPartEdit = null;

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
        <td><span class="badge badge-danger">${t('badgeReorder')}</span></td>
      </tr>
    `).join('');
    alertHTML = `
      <div class="alert-section">
        <h3>${icon('alert', 18, 'var(--danger)')} ${t('lowStockAlerts')}</h3>
        <table class="data-table">
          <thead><tr>
            <th>${t('skuCol')}</th><th>${t('partNameCol')}</th>
            <th>${t('onHandCol')}</th><th>${t('reorderLvlCol')}</th>
            <th>${t('colStatus')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('dashboard', 24)} ${t('dashboard')}</h2>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">${t('totalRevenue')}</div>
          <div class="kpi-value accent">${fmtCurrency(rev)}</div>
          ${renderSparkline(spark)}
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('completedJobs')}</div>
          <div class="kpi-value">${completed}</div>
          <div class="kpi-sub">${pending} ${t('pendingCount')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('inventoryValue')}</div>
          <div class="kpi-value">${fmtCurrency(invValue)}</div>
          <div class="kpi-sub">${parts.length} ${t('itemsTracked')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">${t('lowStockAlerts')}</div>
          <div class="kpi-value ${lowStock.length ? 'danger' : ''}">${lowStock.length}</div>
          <div class="kpi-sub">${t('itemsBelow')}</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">${renderBarChart(revByDay, { label: t('revenueLastDays') })}</div>
        <div class="chart-card">${renderDonutChart(byCategory, { label: t('stockByCategory') })}</div>
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
        <h2 class="page-title">${icon('parts', 24)} ${t('spareParts')}</h2>
        <button class="btn btn-primary" onclick="openPartForm()">${icon('plus', 16)} ${t('addPart')}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="part-search" placeholder="${t('searchParts')}" oninput="filterPartsTable()"/></div>
        <select id="part-cat-filter" onchange="filterPartsTable()">
          ${cats.map(c => `<option>${c === 'All' ? t('all') : c}</option>`).join('')}
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>${t('colSku')}</th><th>${t('colPartName')}</th>
            <th>${t('colCategory')}</th><th>${t('colUnit')}</th>
            <th>${t('colCost')}</th><th>${t('colPrice')}</th>
            <th>${t('colMargin')}</th><th>${t('colQty')}</th>
            <th>${t('colStatus')}</th><th style="width:120px">${t('colActions')}</th>
          </tr></thead>
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
  const catRaw = document.getElementById('part-cat-filter')?.value || '';
  // Map translated "ทั้งหมด" back to 'All' for filtering
  const cat = (catRaw === t('all') || catRaw === 'All') ? 'All' : catRaw;
  const filtered = State.parts.filter(p => {
    if (cat !== 'All' && p.category !== cat) return false;
    if (search && !(p.name + ' ' + p.sku).toLowerCase().includes(search)) return false;
    return true;
  });
  const tbody = document.getElementById('parts-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">${t('noPartsFound')}</td></tr>`;
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
      <td>${p.qty <= p.reorder
        ? `<span class="badge badge-danger">${t('badgeLow')}</span>`
        : `<span class="badge badge-ok">${t('badgeOk')}</span>`}</td>
      <td class="actions">
        <button class="btn-icon" title="${t('stockLog')}" onclick="openStockLog('${p.id}')">${icon('history', 16)}</button>
        <button class="btn-icon" title="${t('colActions')}" onclick="openPartForm('${p.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" title="${t('colActions')}" onclick="deletePart('${p.id}')">${icon('trash', 16)}</button>
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

  openModal(isNew ? t('addNewPart') : t('editPart'), `
    <div class="form-grid">
      <label>${t('skuLabel')}<input id="pf-sku" value="${p.sku}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('partNameLabel')}<input id="pf-name" value="${p.name}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('categoryLabel')}<input id="pf-cat" value="${p.category}" placeholder="${t('catPlaceholder')}"/></label>
      <label>${t('unitLabel')}<input id="pf-unit" value="${p.unit}" placeholder="${t('unitPlaceholder')}"/></label>
      <label>${t('costLabel')}<input id="pf-cost" type="number" value="${p.cost}"/></label>
      <label>${t('priceLabel')}<input id="pf-price" type="number" value="${p.price}"/></label>
      <label>${t('qtyLabel')}<input id="pf-qty" type="number" value="${p.qty}"/></label>
      <label>${t('reorderLevelLabel')}<input id="pf-reorder" type="number" value="${p.reorder}"/></label>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="savePart('${id || ''}')">${icon('check', 16)} ${t('save')}</button>
    </div>
  `);
}

function savePart(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const skuEl  = document.getElementById('pf-sku');
  const nameEl = document.getElementById('pf-name');
  let valid = true;
  if (!skuEl.value.trim())  { skuEl.classList.add('input-error');  skuEl.focus();  valid = false; }
  if (!nameEl.value.trim()) { nameEl.classList.add('input-error'); if (valid) nameEl.focus(); valid = false; }
  if (!valid) return;

  const sku = g('#pf-sku'), name = g('#pf-name');

  const data = { sku, name, category: g('#pf-cat'), unit: g('#pf-unit'), cost: n('#pf-cost'), price: n('#pf-price'), qty: n('#pf-qty'), reorder: n('#pf-reorder') };

  if (id) {
    const idx = State.parts.findIndex(p => p.id === id);
    if (idx !== -1) {
      const oldQty = State.parts[idx].qty;
      if (data.qty !== oldQty) {
        // Qty changed — require admin confirmation before applying
        _pendingPartEdit = { id, data, oldQty };
        openAdminPartSaveModal(id, data, oldQty);
        return;
      }
      // No qty change — save other fields freely
      State.parts[idx] = { ...State.parts[idx], ...data };
    }
    showToast(t('partUpdated'));
    State.save();
    closeModal();
    renderParts();
  } else {
    const newId = uid();
    State.parts.push({ id: newId, ...data });
    if (data.qty > 0) {
      logStockMove(newId, 'in', data.qty, 0, data.qty, t('logReasonInitial'));
    }
    showToast(t('partAdded'));
    State.save();
    closeModal();
    renderParts();
  }
}

function deletePart(id) {
  if (!confirm(t('confirmDeletePart'))) return;
  State.parts = State.parts.filter(p => p.id !== id);
  State.save();
  showToast(t('partDeleted'), 'warn');
  renderParts();
}

/** Opens admin-credentials modal before applying a qty change to a part. */
function openAdminPartSaveModal(id, data, oldQty) {
  const p = State.parts.find(x => x.id === id);
  const diff    = data.qty - oldQty;
  const diffStr = (diff > 0 ? '+' : '') + diff;
  const diffClr = diff > 0 ? 'var(--success)' : 'var(--danger)';

  openModal(t('adminConfirmTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('adminStockEditDesc')}</p>
    <div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span><strong>${p?.name || ''}</strong> &nbsp;<span class="mono" style="font-size:12px;color:var(--text-muted)">${p?.sku || ''}</span></span>
      <span style="white-space:nowrap">${t('colQty')}: <strong>${oldQty}</strong> → <strong style="color:${diffClr}">${data.qty}</strong> <span style="color:${diffClr};font-size:12px">(${diffStr})</span></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:13px;font-weight:500">${t('userId')}
        <input id="ac-id" type="text" placeholder="${t('enterUserId')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')">
      </label>
      <label style="font-size:13px;font-weight:500">${t('password')}
        <input id="ac-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')"
          onkeydown="if(event.key==='Enter')confirmAdminPartSave()">
      </label>
    </div>
    <div id="ac-err" style="color:var(--danger);font-size:12px;margin-top:8px;min-height:16px"></div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-primary" onclick="confirmAdminPartSave()">${icon('check',16)} ${t('save')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 440);
  setTimeout(() => document.getElementById('ac-id')?.focus(), 100);
}

/** Validates admin credentials then applies the pending qty change. */
function confirmAdminPartSave() {
  const adminId = document.getElementById('ac-id').value.trim();
  const adminPw = document.getElementById('ac-pw').value;
  const errEl   = document.getElementById('ac-err');
  const idEl    = document.getElementById('ac-id');
  const pwEl    = document.getElementById('ac-pw');

  if (!adminId) { idEl.classList.add('input-error'); idEl.focus(); errEl.textContent = t('errBothRequired'); return; }
  if (!adminPw) { pwEl.classList.add('input-error'); pwEl.focus(); errEl.textContent = t('errBothRequired'); return; }

  const valid = USERS.find(u => u.id === adminId && u.password === adminPw);
  if (!valid) {
    pwEl.value = '';
    pwEl.classList.add('input-error');
    pwEl.focus();
    errEl.textContent = t('errInvalidCreds');
    return;
  }

  if (!_pendingPartEdit) { closeModal(); return; }
  const { id, data, oldQty } = _pendingPartEdit;
  _pendingPartEdit = null;

  const idx = State.parts.findIndex(p => p.id === id);
  if (idx !== -1) {
    State.parts[idx] = { ...State.parts[idx], ...data };
    const diff = data.qty - oldQty;
    logStockMove(id, diff > 0 ? 'in' : 'out', Math.abs(diff), oldQty, data.qty, t('logReasonAdjusted'));
  }
  State.save();
  closeModal();
  showToast(t('partUpdated'));
  renderParts();
}

/** Opens a modal showing the full stock in/out log for a part. */
function openStockLog(partId) {
  const p = State.parts.find(x => x.id === partId);
  if (!p) return;
  const log = State.stockLog.filter(e => e.partId === partId);

  const rows = log.length
    ? log.map(e => {
        const isIn  = e.type === 'in';
        const badge = isIn
          ? `<span class="badge badge-ok">${t('logIn')}</span>`
          : `<span class="badge badge-danger">${t('logOut')}</span>`;
        const change = isIn
          ? `<span style="color:var(--success);font-weight:600">+${e.qty}</span>`
          : `<span style="color:var(--danger);font-weight:600">−${e.qty}</span>`;
        return `<tr>
          <td class="mono" style="white-space:nowrap;font-size:12px">${e.date} ${e.time}</td>
          <td>${badge}</td>
          <td style="text-align:center">${change}</td>
          <td style="text-align:center">${e.balanceBefore}</td>
          <td style="text-align:center;font-weight:600">${e.balanceAfter}</td>
          <td style="font-size:12px;color:var(--text-muted)">${e.reason}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="empty">${t('noLogEntries')}</td></tr>`;

  openModal(
    `${icon('history', 18)} ${p.name} — ${t('stockLogTitle')}`,
    `<div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">
       <span class="mono">${p.sku}</span> &nbsp;|&nbsp; ${t('colQty')}: <strong>${p.qty}</strong> ${p.unit}
     </div>
     <div class="table-scroll" style="max-height:380px">
       <table class="data-table">
         <thead><tr>
           <th>${t('logColDate')}</th>
           <th>${t('logColType')}</th>
           <th style="text-align:center">${t('logColQty')}</th>
           <th style="text-align:center">${t('logColBefore')}</th>
           <th style="text-align:center">${t('logColAfter')}</th>
           <th>${t('logColReason')}</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>
     <div class="form-actions" style="margin-top:14px">
       <button class="btn btn-ghost" onclick="closeModal()">${t('close')}</button>
     </div>`,
    660
  );
}


/* ═══════════════════════════════════════════════
 *  SERVICE ORDERS PAGE
 * ═══════════════════════════════════════════════ */
function renderOrders() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('orders', 24)} ${t('serviceOrders')}</h2>
        <button class="btn btn-primary" onclick="openOrderForm()">${icon('plus', 16)} ${t('newOrder')}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="order-search" placeholder="${t('searchOrders')}" oninput="filterOrdersTable()"/></div>
        <select id="order-status-filter" onchange="filterOrdersTable()">
          <option value="All">${t('filterAll')}</option>
          <option value="pending">${t('filterPending')}</option>
          <option value="in-progress">${t('filterInProgress')}</option>
          <option value="completed">${t('filterCompleted')}</option>
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>${t('colDate')}</th><th>${t('colCustomer')}</th>
            <th>${t('colVehicle')}</th><th>${t('colService')}</th>
            <th>${t('colParts')}</th><th>${t('colLabor')}</th>
            <th>${t('colTotal')}</th><th>${t('colStatus')}</th>
            <th style="width:120px">${t('colActions')}</th>
          </tr></thead>
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
    tbody.innerHTML = `<tr><td colspan="9" class="empty">${t('noOrdersFound')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(o => {
    const pc = o.partsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
    // fulfilled === undefined → legacy order (inventory already adjusted before this feature)
    const isFulfilled = o.fulfilled !== false;
    const fulfillBtn = isFulfilled
      ? `<button class="btn-icon fulfilled" title="${t('alreadyFulfilled')}" disabled>${icon('fulfill', 16)}</button>`
      : `<button class="btn-icon" title="${t('fulfillParts')}" style="color:var(--warn)" onclick="fulfillOrderParts('${o.id}')">${icon('fulfill', 16)}</button>`;
    return `<tr>
      <td>${fmtDate(o.date)}</td><td>${o.customerName}</td>
      <td>${o.vehicle}<br><small class="mono">${o.plate}</small></td>
      <td>${o.service}</td>
      <td>${fmtCurrency(pc)}</td><td>${fmtCurrency(o.laborCost)}</td>
      <td class="accent-text bold">${fmtCurrency(orderTotal(o))}</td>
      <td><span class="badge ${statusColors[o.status]}">${tStatus(o.status)}</span></td>
      <td class="actions">
        ${fulfillBtn}
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

  const custOpts = State.customers.map(c => {
    const firstV = (c.vehicles || [])[0] || {};
    const hint = firstV.plate ? ` (${firstV.plate})` : '';
    return `<option value="${c.id}" ${c.id === o.customerId ? 'selected' : ''}>${c.name}${hint}</option>`;
  }).join('');

  openModal(isNew ? t('newServiceOrder') : t('editOrder'), `
    <div class="form-grid">
      <label>${t('dateLabel')}<input id="of-date" type="date" value="${o.date}"/></label>
      <label>${t('customerLabel')}
        <select id="of-customer" onchange="pickOrderCustomer(); this.classList.remove('input-error')">
          <option value="">${t('selectCustomer')}</option>${custOpts}
        </select>
      </label>
    </div>
    <div id="of-vehicle-selector" style="display:none;margin:8px 0 12px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)">
      <label style="font-size:12px;color:var(--text-muted);font-weight:500;display:block">
        ${icon('car', 13)} ${t('selectVehicle')}
        <select id="of-vehicle-pick" onchange="applyVehiclePick()" style="display:block;width:100%;margin-top:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:7px 10px;"></select>
      </label>
    </div>
    <div class="form-grid">
      <label>${t('vehicleLabel')}<input id="of-vehicle" value="${o.vehicle}"/></label>
      <label>${t('plateLabel')}<input id="of-plate" value="${o.plate}"/></label>
      <label class="span-2">${t('serviceDescLabel')}<input id="of-service" value="${o.service}" placeholder="${t('serviceDescPlaceholder')}" oninput="this.classList.remove('input-error')"/></label>
    </div>
    <div class="section-label">${t('partsUsedSection')}</div>
    <div id="of-parts-lines"></div>
    <button class="btn btn-sm" onclick="addOrderPartLine()">${icon('plus', 14)} ${t('addPartLine')}</button>
    <div class="form-grid" style="margin-top:16px">
      <label>${t('laborLabel')}<input id="of-labor" type="number" value="${o.laborCost}" oninput="recalcOrderTotal()"/></label>
      <label>${t('discountLabel')}<input id="of-discount" type="number" value="${o.discount}" oninput="recalcOrderTotal()"/></label>
      <label>${t('statusLabel')}
        <select id="of-status">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>${t('statusPending')}</option>
          <option value="in-progress" ${o.status === 'in-progress' ? 'selected' : ''}>${t('statusInProgress')}</option>
          <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>${t('statusCompleted')}</option>
        </select>
      </label>
      <label>${t('notesLabel')}<input id="of-notes" value="${o.notes || ''}"/></label>
    </div>
    <div class="order-total" id="of-total">${t('orderTotalLabel')}: <strong>${fmtCurrency(0)}</strong></div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveOrder('${id || ''}')">${icon('check', 16)} ${t('saveOrder')}</button>
    </div>
  `, 640);

  renderOrderPartLines();
}

function renderOrderPartLines() {
  const container = document.getElementById('of-parts-lines');
  if (!container) return;
  container.innerHTML = _orderPartsUsed.map((pl, i) => `
    <div class="part-line">
      <select onchange="updateOrderPartLine(${i}, this.value)">
        <option value="">${t('selectPart')}</option>
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
  const pc    = _orderPartsUsed.reduce((s, p) => s + p.unitPrice * p.qty, 0);
  const labor = Number(document.getElementById('of-labor')?.value) || 0;
  const disc  = Number(document.getElementById('of-discount')?.value) || 0;
  const el = document.getElementById('of-total');
  if (el) el.innerHTML = `${t('orderTotalLabel')}: <strong>${fmtCurrency(pc + labor - disc)}</strong>`;
}

function pickOrderCustomer() {
  const cid = document.getElementById('of-customer').value;
  const c = State.customers.find(x => x.id === cid);
  const selector   = document.getElementById('of-vehicle-selector');
  const vehiclePick = document.getElementById('of-vehicle-pick');

  if (!c) {
    if (selector) selector.style.display = 'none';
    return;
  }

  const vehicles = c.vehicles || [];

  if (vehicles.length > 1) {
    // Show vehicle picker dropdown
    if (vehiclePick) {
      vehiclePick.innerHTML = `<option value="">${t('selectVehicle')}</option>` +
        vehicles.map((v, i) => `<option value="${i}">${v.vehicle} — ${v.plate}</option>`).join('');
    }
    if (selector) selector.style.display = 'block';
    document.getElementById('of-vehicle').value = '';
    document.getElementById('of-plate').value   = '';
  } else {
    // Single vehicle — auto-fill
    const v = vehicles[0] || {};
    document.getElementById('of-vehicle').value = v.vehicle || '';
    document.getElementById('of-plate').value   = v.plate   || '';
    if (selector) selector.style.display = 'none';
  }
}

function applyVehiclePick() {
  const cid = document.getElementById('of-customer').value;
  const c = State.customers.find(x => x.id === cid);
  if (!c) return;
  const idx = Number(document.getElementById('of-vehicle-pick').value);
  const v = (c.vehicles || [])[idx];
  if (v) {
    document.getElementById('of-vehicle').value = v.vehicle;
    document.getElementById('of-plate').value   = v.plate;
  }
}

function saveOrder(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const n = (sel) => Number(document.querySelector(sel)?.value) || 0;

  const custEl    = document.getElementById('of-customer');
  const serviceEl = document.getElementById('of-service');
  const cid = g('#of-customer');
  const c = State.customers.find(x => x.id === cid);
  const customerName = c ? c.name : '';

  let valid = true;
  if (!customerName) { custEl?.classList.add('input-error'); valid = false; }
  if (!g('#of-service')) { serviceEl?.classList.add('input-error'); if (valid) serviceEl?.focus(); valid = false; }
  if (!valid) return;

  const data = {
    date: g('#of-date'), customerId: cid, customerName,
    vehicle: g('#of-vehicle'), plate: g('#of-plate'), service: g('#of-service'),
    partsUsed: _orderPartsUsed, laborCost: n('#of-labor'), discount: n('#of-discount'),
    status: g('#of-status'), notes: g('#of-notes'),
  };

  if (id) {
    const idx = State.orders.findIndex(o => o.id === id);
    if (idx !== -1) State.orders[idx] = { ...State.orders[idx], ...data };
    showToast(t('orderUpdated'));
  } else {
    // Parts are NOT auto-deducted — use the Fulfill Parts button to deduct inventory
    State.orders.unshift({ id: uid(), ...data, fulfilled: false });
    showToast(t('orderCreated'));
  }
  State.save();
  closeModal();
  renderOrders();
}

/** Deducts parts used in an order from inventory and marks it fulfilled. */
function fulfillOrderParts(id) {
  const o = State.orders.find(x => x.id === id);
  if (!o || o.fulfilled === true) return;
  if (!confirm(t('fulfillConfirm'))) return;
  o.partsUsed.forEach(pu => {
    const pt = State.parts.find(p => p.id === pu.partId);
    if (pt) {
      const oldQty = pt.qty;
      pt.qty = Math.max(0, pt.qty - pu.qty);
      logStockMove(pt.id, 'out', pu.qty, oldQty, pt.qty, `${t('logReasonOrder')}: ${o.service}`);
    }
  });
  o.fulfilled = true;
  State.save();
  showToast(t('fulfillSuccess'));
  renderOrders();
}

function deleteOrder(id) {
  if (!confirm(t('confirmDeleteOrder'))) return;
  State.orders = State.orders.filter(o => o.id !== id);
  State.save();
  showToast(t('orderDeleted'), 'warn');
  renderOrders();
}


/* ═══════════════════════════════════════════════
 *  CUSTOMERS PAGE
 * ═══════════════════════════════════════════════ */
function renderCustomers() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <div class="page-header">
        <h2 class="page-title">${icon('customers', 24)} ${t('customersTitle')}</h2>
        <button class="btn btn-primary" onclick="openCustomerForm()">${icon('plus', 16)} ${t('addCustomer')}</button>
      </div>
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<input id="cust-search" placeholder="${t('searchCustomers')}" oninput="filterCustomersTable()"/></div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>${t('colName')}</th><th>${t('colPhone')}</th>
            <th>${t('colVehicle')}</th><th>${t('colPlate')}</th>
            <th>${t('colOrders')}</th><th>${t('colTotalSpent')}</th>
            <th>${t('colNotes')}</th><th style="width:90px">${t('colActions')}</th>
          </tr></thead>
          <tbody id="cust-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterCustomersTable();
}

function filterCustomersTable() {
  const search = (document.getElementById('cust-search')?.value || '').toLowerCase();
  const filtered = State.customers.filter(c => {
    if (!search) return true;
    const vehicleText = (c.vehicles || []).map(v => v.vehicle + ' ' + v.plate).join(' ');
    return (c.name + ' ' + c.phone + ' ' + vehicleText).toLowerCase().includes(search);
  });
  const tbody = document.getElementById('cust-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">${t('noCustomersFound')}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(c => {
    const oc = State.orders.filter(o => o.customerId === c.id).length;
    const ts = State.orders.filter(o => o.customerId === c.id).reduce((s, o) => s + orderTotal(o), 0);
    const vehicles = c.vehicles || [];
    const firstV   = vehicles[0] || { vehicle: c.vehicle || '', plate: c.plate || '' };
    const extraBadge = vehicles.length > 1
      ? ` <span class="badge" title="${vehicles.slice(1).map(v=>v.plate).join(', ')}">+${vehicles.length - 1}</span>` : '';
    return `<tr>
      <td class="bold">${c.name}</td><td>${c.phone}</td>
      <td>${firstV.vehicle}${extraBadge}</td>
      <td class="mono">${firstV.plate}</td>
      <td>${oc}</td><td class="accent-text">${fmtCurrency(ts)}</td><td>${c.notes}</td>
      <td class="actions">
        <button class="btn-icon" onclick="openCustomerForm('${c.id}')">${icon('edit', 16)}</button>
        <button class="btn-icon danger" onclick="deleteCustomer('${c.id}')">${icon('trash', 16)}</button>
      </td>
    </tr>`;
  }).join('');
}

// Temporary vehicle array for the customer form (like _orderPartsUsed)
let _customerVehicles = [];

function openCustomerForm(id) {
  const isNew = !id;
  const c = isNew
    ? { name: '', phone: '', vehicles: [{ id: uid(), vehicle: '', plate: '' }], notes: '' }
    : State.customers.find(x => x.id === id);

  _customerVehicles = JSON.parse(JSON.stringify(
    c.vehicles || [{ id: uid(), vehicle: c.vehicle || '', plate: c.plate || '' }]
  ));

  openModal(isNew ? t('addCustomerTitle') : t('editCustomerTitle'), `
    <div class="form-grid">
      <label>${t('fullNameLabel')}<input id="cf-name" value="${c.name}" oninput="this.classList.remove('input-error')"/></label>
      <label>${t('phoneLabel')}<input id="cf-phone" value="${c.phone}"/></label>
      <label class="span-2">${t('colNotes')}<input id="cf-notes" value="${c.notes}"/></label>
    </div>
    <div class="section-label">${icon('car', 14)} ${t('vehicles')}</div>
    <div id="cf-vehicles-lines"></div>
    <button class="btn btn-sm" style="margin-bottom:12px" onclick="addCustomerVehicle()">${icon('plus', 14)} ${t('addVehicle')}</button>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveCustomer('${id || ''}')">${icon('check', 16)} ${t('save')}</button>
    </div>
  `);
  renderCustomerVehicleLines();
}

function renderCustomerVehicleLines() {
  const container = document.getElementById('cf-vehicles-lines');
  if (!container) return;
  container.innerHTML = _customerVehicles.map((v, i) => `
    <div class="vehicle-line">
      <input class="vi-model" placeholder="${t('vehicleModelLabel')}" value="${v.vehicle}"
        oninput="updateCustomerVehicle(${i},'vehicle',this.value); this.classList.remove('input-error')"/>
      <input class="vi-plate" placeholder="${t('licensePlateLabel')}" value="${v.plate}"
        oninput="updateCustomerVehicle(${i},'plate',this.value)"/>
      ${_customerVehicles.length > 1
        ? `<button class="btn-icon danger" onclick="removeCustomerVehicle(${i})">${icon('x', 14)}</button>`
        : ''}
    </div>
  `).join('');
}

function addCustomerVehicle() {
  _customerVehicles.push({ id: uid(), vehicle: '', plate: '' });
  renderCustomerVehicleLines();
}
function removeCustomerVehicle(i) {
  if (_customerVehicles.length <= 1) return;
  _customerVehicles.splice(i, 1);
  renderCustomerVehicleLines();
}
function updateCustomerVehicle(i, field, value) {
  if (_customerVehicles[i]) _customerVehicles[i][field] = value;
}

function saveCustomer(id) {
  const g = (sel) => document.querySelector(sel)?.value?.trim() || '';
  const nameEl = document.getElementById('cf-name');
  let valid = true;

  if (!nameEl.value.trim()) {
    nameEl.classList.add('input-error');
    nameEl.focus();
    valid = false;
  }
  // Ensure at least one vehicle with a model name
  const firstModelEl = document.querySelector('#cf-vehicles-lines .vi-model');
  if (!_customerVehicles.length || !_customerVehicles[0].vehicle.trim()) {
    if (firstModelEl) {
      firstModelEl.classList.add('input-error');
      if (valid) firstModelEl.focus();
    }
    valid = false;
  }
  if (!valid) return;

  const data = {
    name: nameEl.value.trim(),
    phone: g('#cf-phone'),
    vehicles: _customerVehicles.filter(v => v.vehicle.trim() || v.plate.trim()),
    notes: g('#cf-notes'),
  };
  if (!data.vehicles.length) data.vehicles = [{ id: uid(), vehicle: '', plate: '' }];

  if (id) {
    const idx = State.customers.findIndex(c => c.id === id);
    if (idx !== -1) State.customers[idx] = { ...State.customers[idx], ...data };
    showToast(t('customerUpdated'));
  } else {
    State.customers.push({ id: uid(), ...data });
    showToast(t('customerAdded'));
  }
  State.save();
  closeModal();
  renderCustomers();
}

function deleteCustomer(id) {
  const c = State.customers.find(x => x.id === id);
  if (!c) return;
  openModal(t('adminConfirmTitle'), `
    <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px;line-height:1.5">${t('adminConfirmDesc')}</p>
    <div style="background:var(--danger-bg,rgba(239,68,68,.08));border:1px solid rgba(239,68,68,.25);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:13px">
      ${icon('trash',14)} <strong>${c.name}</strong>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label style="font-size:13px;font-weight:500">${t('userId')}
        <input id="ac-id" type="text" placeholder="${t('enterUserId')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')">
      </label>
      <label style="font-size:13px;font-weight:500">${t('password')}
        <input id="ac-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="off"
          style="display:block;width:100%;margin-top:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font);font-size:13px;padding:8px 10px;box-sizing:border-box"
          oninput="document.getElementById('ac-err').textContent='';this.classList.remove('input-error')"
          onkeydown="if(event.key==='Enter')confirmAdminDelete('${id}')">
      </label>
    </div>
    <div id="ac-err" style="color:var(--danger);font-size:12px;margin-top:8px;min-height:16px"></div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-danger" onclick="confirmAdminDelete('${id}')">${icon('trash',16)} ${t('confirmDeleteCustomer')}</button>
      <button class="btn btn-ghost" onclick="closeModal()">${t('cancel')}</button>
    </div>
  `, 400);
  setTimeout(() => document.getElementById('ac-id')?.focus(), 100);
}

function confirmAdminDelete(id) {
  const adminId = document.getElementById('ac-id').value.trim();
  const adminPw = document.getElementById('ac-pw').value;
  const errEl   = document.getElementById('ac-err');
  const idEl    = document.getElementById('ac-id');
  const pwEl    = document.getElementById('ac-pw');

  if (!adminId) { idEl.classList.add('input-error'); idEl.focus(); errEl.textContent = t('errBothRequired'); return; }
  if (!adminPw) { pwEl.classList.add('input-error'); pwEl.focus(); errEl.textContent = t('errBothRequired'); return; }

  const valid = USERS.find(u => u.id === adminId && u.password === adminPw);
  if (!valid) {
    pwEl.value = '';
    pwEl.classList.add('input-error');
    pwEl.focus();
    errEl.textContent = t('errInvalidCreds');
    return;
  }

  State.customers = State.customers.filter(c => c.id !== id);
  State.save();
  closeModal();
  showToast(t('customerDeleted'), 'warn');
  renderCustomers();
}


/* ═══════════════════════════════════════════════
 *  REPORTS & EXPORT PAGE
 * ═══════════════════════════════════════════════ */
function renderReports() {
  document.getElementById('main-content').innerHTML = `
    <div class="page fade-in">
      <h2 class="page-title">${icon('reports', 24)} ${t('reportsTitle')}</h2>

      <div class="export-settings">
        <h3>${icon('settings', 18)} ${t('exportSettings')}</h3>
        <div class="radio-group">
          <label class="radio-label"><input type="radio" name="export-mode" value="all" checked onchange="toggleDateRange()"/> ${t('exportAll')}</label>
          <label class="radio-label"><input type="radio" name="export-mode" value="range" onchange="toggleDateRange()"/> ${t('customRange')}</label>
        </div>
        <div class="date-range" id="date-range-fields" style="display:none">
          <label>${t('fromLabel')} <input type="date" id="exp-from"/></label>
          <label>${t('toLabel')}   <input type="date" id="exp-to"/></label>
        </div>
        <button class="btn btn-primary btn-lg" onclick="handleExport()">${icon('download', 18)} ${t('exportExcel')}</button>
        <p class="hint">${t('exportHint')}</p>
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
    { label: t('statusCompleted'),   value: filtered.filter(o => o.status === 'completed').reduce((s, o) => s + orderTotal(o), 0),    color: '#10b981' },
    { label: t('statusInProgress'),  value: filtered.filter(o => o.status === 'in-progress').reduce((s, o) => s + orderTotal(o), 0), color: '#3b82f6' },
    { label: t('statusPending'),     value: filtered.filter(o => o.status === 'pending').reduce((s, o) => s + orderTotal(o), 0),     color: '#f97316' },
  ];

  const previewTitle = mode === 'all' ? t('previewAllTime') : `${fmtDate(from)} — ${fmtDate(to)}`;

  document.getElementById('report-preview').innerHTML = `
    <h3>Preview — ${previewTitle}</h3>
    <div class="kpi-grid small">
      <div class="kpi-card"><div class="kpi-label">${t('previewOrders')}</div><div class="kpi-value">${filtered.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewRevenue')}</div><div class="kpi-value accent">${fmtCurrency(rev)}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewParts')}</div><div class="kpi-value">${fmtCurrency(parts)}</div></div>
      <div class="kpi-card"><div class="kpi-label">${t('previewLabor')}</div><div class="kpi-value">${fmtCurrency(labor)}</div></div>
    </div>
    <div class="chart-card" style="margin-top:20px">
      ${renderBarChart(revByStatus, { label: t('revenueByStatus'), width: 420, height: 200 })}
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
