/**
 * ============================================================
 * backup.js — Backup & Recovery UI
 * ============================================================
 *
 * Three layers of recovery the user can reach from this module:
 *   1. Export / Import JSON  — manual file the user owns outright
 *   2. Server-side backups   — rolling + daily + shutdown snapshots
 *   3. Browser localStorage  — mirror (handled in data.js, shown here)
 *
 * Exposed to the rest of the app:
 *   openBackupModal()           — main UI (triggered from the topbar ⛭ button)
 *   showCorruptRecoveryModal(b) — blocking recovery modal on boot
 *   exportDataAsJSON()
 *   importDataFromJSON(file)
 */

const BACKUP_KIND_LABEL = {
  save:     'Auto-save',
  daily:    'Daily',
  shutdown: 'Shutdown',
  legacy:   'Legacy',
};

/* ── Main entry: Backup & Recovery modal ────────────────────── */

function openBackupModal() {
  const body = openModal(t('backupTitle') || 'Backup & Recovery', `
    <div class="backup-modal">
      <section class="backup-section">
        <h4>${t('backupExportTitle') || 'Export'}</h4>
        <p class="muted">${t('backupExportDesc') || 'Download every record as a single JSON file. Keep it on OneDrive, a USB stick, or email to yourself.'}</p>
        <button class="btn btn-primary" onclick="exportDataAsJSON()">
          ${icon('download', 16)} ${t('backupExportBtn') || 'Download backup (.json)'}
        </button>
      </section>

      <section class="backup-section">
        <h4>${t('backupImportTitle') || 'Import'}</h4>
        <p class="muted warn-text">${t('backupImportDesc') || 'Replaces ALL current data with the contents of the file. A safety snapshot is saved first so you can undo.'}</p>
        <input type="file" id="backup-import-file" accept="application/json,.json" style="display:none" onchange="_onImportFileChosen(event)" />
        <button class="btn" onclick="document.getElementById('backup-import-file').click()">
          ${t('backupImportBtn') || 'Choose file to restore…'}
        </button>
      </section>

      <section class="backup-section">
        <h4>${t('backupServerTitle') || 'Server snapshots'}</h4>
        <p class="muted">${t('backupServerDesc') || 'Automatic backups stored next to your data file. Restoring snapshots your current file first.'}</p>
        <div id="backup-server-list" class="backup-list">${t('loading') || 'Loading…'}</div>
      </section>

      <section class="backup-section">
        <h4>${t('backupHealthTitle') || 'Status'}</h4>
        <div id="backup-health" class="muted">${t('loading') || 'Loading…'}</div>
      </section>
    </div>
  `, 620);

  _refreshBackupList();
  _refreshHealth();
}


/* ── Export current State as a JSON file ────────────────────── */

function exportDataAsJSON() {
  const payload = {
    _meta: {
      app:        'AutoFix Pro',
      exportedAt: new Date().toISOString(),
      version:    1,
    },
    parts:     State.parts,
    orders:    State.orders,
    customers: State.customers,
    stockLog:  State.stockLog,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href     = url;
  a.download = `autofix_export_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(t('backupExportDone') || 'Backup downloaded');
}


/* ── Import JSON file ───────────────────────────────────────── */

function _onImportFileChosen(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';            // allow re-selecting the same file later
  if (!file) return;
  importDataFromJSON(file);
}

function importDataFromJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      showToast(t('backupImportBadJson') || 'File is not valid JSON', 'warn');
      return;
    }
    if (!_looksLikePayload(data)) {
      showToast(t('backupImportBadShape') || 'File does not look like an AutoFix Pro export', 'warn');
      return;
    }
    _confirmDestructive(
      t('backupImportConfirm') || 'Replace all current data with this file? A safety snapshot is taken first.',
      () => _applyPayload(data, t('backupImportDone') || 'Data restored from file')
    );
  };
  reader.onerror = () => showToast(t('backupImportReadFail') || 'Could not read file', 'warn');
  reader.readAsText(file);
}


/* ── Server-backup list + restore ───────────────────────────── */

function _refreshBackupList() {
  const target = document.getElementById('backup-server-list');
  if (!target) return;
  fetch('/api/backups')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(({ backups }) => {
      if (!backups || !backups.length) {
        target.innerHTML = `<div class="muted">${t('backupNone') || 'No server backups yet. They appear after your first save.'}</div>`;
        return;
      }
      target.innerHTML = backups.map(b => `
        <div class="backup-row">
          <div class="backup-row-main">
            <div class="backup-row-name">${_fmtBackupWhen(b.modified)}</div>
            <div class="backup-row-meta">
              <span class="badge badge-${b.kind}">${BACKUP_KIND_LABEL[b.kind] || b.kind}</span>
              <span class="muted">${_fmtSize(b.size)}</span>
            </div>
          </div>
          <button class="btn btn-sm" onclick="_restoreServerBackup('${b.name.replace(/'/g, "\\'")}')">
            ${t('backupRestoreBtn') || 'Restore'}
          </button>
        </div>
      `).join('');
    })
    .catch(() => {
      target.innerHTML = `<div class="muted warn-text">${t('backupServerOffline') || 'Server not reachable — start.py may not be running.'}</div>`;
    });
}

function _restoreServerBackup(name) {
  _confirmDestructive(
    (t('backupRestoreConfirm') || 'Restore from {name}? Your current data will be snapshotted first.').replace('{name}', name),
    () => {
      fetch('/api/restore/' + encodeURIComponent(name), { method: 'POST' })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(() => {
          showToast(t('backupRestoreDone') || 'Restored — reloading…');
          setTimeout(() => location.reload(), 600);
        })
        .catch(() => showToast(t('backupRestoreFail') || 'Restore failed', 'warn'));
    }
  );
}


/* ── Health panel ───────────────────────────────────────────── */

function _refreshHealth() {
  const target = document.getElementById('backup-health');
  if (!target) return;
  fetch('/api/health')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(info => {
      const parts = [];
      if (info.dataFile) {
        parts.push(`${t('backupHealthFile') || 'Data file'}: ${_fmtSize(info.dataFile.size)} · ${_fmtBackupWhen(info.dataFile.modified)}`);
      } else {
        parts.push(t('backupHealthNoFile') || 'No data file yet — a save will create one.');
      }
      parts.push(`${t('backupHealthCount') || 'Snapshots kept'}: ${info.backupCount}`);
      parts.push(`${t('backupHealthLocal') || 'Browser mirror'}: ${_localStorageSummary()}`);
      target.innerHTML = parts.map(p => `<div>${p}</div>`).join('');
    })
    .catch(() => {
      target.innerHTML = `<div class="warn-text">${t('backupServerOffline') || 'Server not reachable — start.py may not be running.'}</div>`;
    });
}


/* ── Corrupt-data recovery modal (shown on boot) ────────────── */

function showCorruptRecoveryModal(backups) {
  const list = (backups || []).slice(0, 10).map(b => `
    <div class="backup-row">
      <div class="backup-row-main">
        <div class="backup-row-name">${_fmtBackupWhen(b.modified)}</div>
        <div class="backup-row-meta">
          <span class="badge badge-${b.kind}">${BACKUP_KIND_LABEL[b.kind] || b.kind}</span>
          <span class="muted">${_fmtSize(b.size)}</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="_restoreServerBackup('${b.name.replace(/'/g, "\\'")}')">
        ${t('backupRestoreBtn') || 'Restore this'}
      </button>
    </div>
  `).join('');

  const hasLocal = _localStorageSummary() !== (t('backupHealthLocalEmpty') || 'empty');

  openModal(t('recoveryTitle') || 'Data file unreadable', `
    <div class="backup-modal">
      <p class="warn-text"><strong>${t('recoveryHeadline') || 'Your live data file could not be read.'}</strong></p>
      <p class="muted">${t('recoveryExplain') || 'Nothing was lost — recent saves are kept as snapshots. Pick one below to restore. The current (corrupt) file will be archived first.'}</p>

      <section class="backup-section">
        <h4>${t('backupServerTitle') || 'Server snapshots'}</h4>
        ${list || `<div class="muted">${t('backupNone') || 'No snapshots available.'}</div>`}
      </section>

      ${hasLocal ? `
        <section class="backup-section">
          <h4>${t('recoveryLocalTitle') || 'Browser copy'}</h4>
          <p class="muted">${t('recoveryLocalDesc') || 'This browser has its own mirror of your data. If the server snapshots above look too old, restore from here.'}</p>
          <button class="btn" onclick="_restoreFromLocalStorage()">${t('recoveryLocalBtn') || 'Restore from browser mirror'}</button>
        </section>` : ''}

      <section class="backup-section">
        <h4>${t('recoveryImportTitle') || 'Have your own backup?'}</h4>
        <input type="file" id="recovery-import-file" accept="application/json,.json" style="display:none" onchange="_onImportFileChosen(event)" />
        <button class="btn" onclick="document.getElementById('recovery-import-file').click()">
          ${t('backupImportBtn') || 'Choose file to restore…'}
        </button>
      </section>
    </div>
  `, 640);
}


/* ── Internals ──────────────────────────────────────────────── */

function _looksLikePayload(data) {
  return data && typeof data === 'object'
      && Array.isArray(data.parts)
      && Array.isArray(data.orders)
      && Array.isArray(data.customers);
}

function _applyPayload(data, doneMsg) {
  State.parts     = data.parts     || [];
  State.orders    = data.orders    || [];
  State.customers = migrateCustomers(data.customers || []);
  State.stockLog  = data.stockLog  || [];
  State.save();                                      // writes localStorage + server
  showToast(doneMsg);
  setTimeout(() => location.reload(), 600);
}

function _restoreFromLocalStorage() {
  const parts     = load('ars_parts',     null);
  const orders    = load('ars_orders',    null);
  const customers = load('ars_customers', null);
  if (!parts || !orders || !customers) {
    showToast(t('recoveryLocalEmpty') || 'Browser mirror is empty', 'warn');
    return;
  }
  _confirmDestructive(
    t('recoveryLocalConfirm') || 'Restore from this browser\'s mirror?',
    () => _applyPayload(
      { parts, orders, customers, stockLog: load('ars_stock_log', []) },
      t('backupRestoreDone') || 'Restored — reloading…'
    )
  );
}

function _confirmDestructive(message, onYes) {
  const body = openModal(t('confirm') || 'Confirm', `
    <p>${message}</p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">${t('cancel') || 'Cancel'}</button>
      <button class="btn btn-primary" id="confirm-destructive-yes">${t('continue') || 'Continue'}</button>
    </div>
  `, 440);
  body.querySelector('#confirm-destructive-yes').addEventListener('click', () => {
    closeModal();
    onYes();
  });
}

function _localStorageSummary() {
  const parts     = load('ars_parts',     null);
  const orders    = load('ars_orders',    null);
  const customers = load('ars_customers', null);
  if (!parts && !orders && !customers) return t('backupHealthLocalEmpty') || 'empty';
  const pN = parts?.length     || 0;
  const oN = orders?.length    || 0;
  const cN = customers?.length || 0;
  return `${pN} parts, ${oN} orders, ${cN} customers`;
}

function _fmtSize(bytes) {
  if (bytes < 1024)         return bytes + ' B';
  if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fmtBackupWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(getLang() === 'th' ? 'th-TH' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
