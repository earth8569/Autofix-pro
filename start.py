import http.server
import socketserver
import threading
import webbrowser
import time
import os
import re
import sys
import json
import glob
import shutil
import datetime

PORT = 8080
DATA_FILE  = 'autofix_data.json'          # live data — always current
BACKUP_DIR = 'autofix_backups'            # snapshots live here

# Retention limits (how many of each backup type to keep)
KEEP_SAVES    = 20   # per-save rolling snapshots
KEEP_DAILY    = 14   # first save of each day
KEEP_SHUTDOWN = 5    # clean-shutdown snapshots

# Filename prefixes — also used to validate /api/backups/<name> requests
SAVE_PREFIX     = 'autofix_save_'
DAILY_PREFIX    = 'autofix_daily_'
SHUTDOWN_PREFIX = 'autofix_shutdown_'
LEGACY_PREFIX   = 'autofix_backup_'        # files written by older versions

# Any JSON in BACKUP_DIR matching this pattern may be listed / restored.
# Path traversal is blocked by requiring a plain filename with no separators.
VALID_BACKUP_RE = re.compile(
    r'^autofix_(save|daily|shutdown|backup)_[\w\-.]+\.json$'
)

# Serve files from the folder this script lives in
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(BACKUP_DIR, exist_ok=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _atomic_write(path, body_bytes):
    """Write body_bytes to path via a .tmp sibling + os.replace — never leaves
    a half-written file on disk even if the process dies mid-write."""
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(body_bytes)
        f.flush()
        try:
            os.fsync(f.fileno())   # force bytes to disk
        except OSError:
            pass                    # fsync not supported on some filesystems
    os.replace(tmp, path)           # atomic on POSIX & Windows


def _prune(prefix, keep):
    """Keep only the `keep` newest files with the given prefix."""
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, prefix + '*.json')))
    for old in files[:-keep]:
        try:
            os.remove(old)
        except OSError:
            pass


def _snapshot(prefix, keep):
    """Copy the current DATA_FILE into BACKUP_DIR with a timestamped name."""
    if not os.path.exists(DATA_FILE):
        return None
    ts   = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    dest = os.path.join(BACKUP_DIR, f'{prefix}{ts}.json')
    # If two saves happen in the same second, append a counter so we don't
    # overwrite the earlier snapshot.
    n = 1
    while os.path.exists(dest):
        dest = os.path.join(BACKUP_DIR, f'{prefix}{ts}_{n}.json')
        n += 1
    shutil.copy2(DATA_FILE, dest)
    _prune(prefix, keep)
    return dest


# ── HTTP handler ─────────────────────────────────────────────────────────────

class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    """File server with /api/* persistence endpoints."""

    def log_message(self, *args):
        pass

    # ── JSON response helper ──
    def _json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── Route GET ──
    def do_GET(self):
        if self.path == '/api/data':
            return self._get_data()
        if self.path == '/api/health':
            return self._get_health()
        if self.path == '/api/backups':
            return self._list_backups()
        if self.path.startswith('/api/backups/'):
            return self._get_backup(self.path[len('/api/backups/'):])
        return super().do_GET()

    # ── Route POST ──
    def do_POST(self):
        if self.path == '/api/data':
            return self._post_data()
        if self.path.startswith('/api/restore/'):
            return self._restore_backup(self.path[len('/api/restore/'):])
        self.send_response(405)
        self.end_headers()

    # ── /api/data GET ──
    # Returns the live data file. If the file exists but is corrupt, returns
    # HTTP 500 with { corrupt: true, backups: [...] } so the client can offer
    # a recovery UI instead of silently falling back to seed data.
    def _get_data(self):
        if not os.path.exists(DATA_FILE):
            return self._json(404, {'error': 'no data file'})
        try:
            with open(DATA_FILE, 'rb') as f:
                body = f.read()
            json.loads(body)   # validate
        except (OSError, ValueError):
            return self._json(500, {
                'error':   'data file unreadable or corrupt',
                'corrupt': True,
                'backups': _backup_entries(),
            })
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── /api/data POST ──
    # Saves incoming JSON atomically. Before overwriting the live file, copies
    # the previous good version into BACKUP_DIR as a rolling per-save snapshot
    # (plus one daily snapshot on the first save of each day).
    def _post_data(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            json.loads(body)   # reject corrupt JSON before it touches disk

            # Per-save rolling snapshot of the previous good file
            _snapshot(SAVE_PREFIX, KEEP_SAVES)

            # Daily snapshot (once per calendar day)
            today = datetime.date.today().isoformat()
            daily_file = os.path.join(BACKUP_DIR, f'{DAILY_PREFIX}{today}.json')
            if not os.path.exists(daily_file) and os.path.exists(DATA_FILE):
                shutil.copy2(DATA_FILE, daily_file)
                _prune(DAILY_PREFIX, KEEP_DAILY)

            # Atomically replace the live data file
            _atomic_write(DATA_FILE, body)

            self._json(200, {'ok': True})
        except Exception as e:
            self._json(500, {'error': str(e)})

    # ── /api/health ──
    def _get_health(self):
        info = {'ok': True, 'port': PORT}
        if os.path.exists(DATA_FILE):
            st = os.stat(DATA_FILE)
            info['dataFile'] = {
                'size':     st.st_size,
                'modified': datetime.datetime.fromtimestamp(st.st_mtime).isoformat(timespec='seconds'),
            }
        else:
            info['dataFile'] = None
        info['backupCount'] = len(_backup_entries())
        self._json(200, info)

    # ── /api/backups ──
    def _list_backups(self):
        self._json(200, {'backups': _backup_entries()})

    # ── /api/backups/<name> ──
    def _get_backup(self, name):
        path = _safe_backup_path(name)
        if not path:
            return self._json(400, {'error': 'invalid backup name'})
        if not os.path.exists(path):
            return self._json(404, {'error': 'backup not found'})
        try:
            with open(path, 'rb') as f:
                body = f.read()
        except OSError as e:
            return self._json(500, {'error': str(e)})
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── /api/restore/<name> ──
    # Snapshots the current file first (so the restore itself is undoable),
    # then atomically replaces the live file with the chosen backup.
    def _restore_backup(self, name):
        path = _safe_backup_path(name)
        if not path:
            return self._json(400, {'error': 'invalid backup name'})
        if not os.path.exists(path):
            return self._json(404, {'error': 'backup not found'})
        try:
            with open(path, 'rb') as f:
                body = f.read()
            json.loads(body)   # validate before clobbering live data

            # Snapshot whatever's live right now — restore is undoable
            _snapshot(SAVE_PREFIX, KEEP_SAVES)
            _atomic_write(DATA_FILE, body)

            self._json(200, {'ok': True, 'restored': os.path.basename(path)})
        except Exception as e:
            self._json(500, {'error': str(e)})


def _safe_backup_path(name):
    """Resolve a user-supplied backup filename to an absolute path inside
    BACKUP_DIR, or return None if the name is unsafe or malformed.
    Blocks path traversal (../), absolute paths, and unexpected prefixes."""
    if not name or '/' in name or '\\' in name or '..' in name:
        return None
    if not VALID_BACKUP_RE.match(name):
        return None
    return os.path.join(BACKUP_DIR, name)


def _backup_entries():
    """Return a sorted list of available backups as dicts.
    Newest first. Includes per-save, daily, shutdown, and legacy files."""
    out = []
    for path in glob.glob(os.path.join(BACKUP_DIR, '*.json')):
        base = os.path.basename(path)
        if not VALID_BACKUP_RE.match(base):
            continue
        try:
            st = os.stat(path)
        except OSError:
            continue
        if base.startswith(SAVE_PREFIX):       kind = 'save'
        elif base.startswith(DAILY_PREFIX):    kind = 'daily'
        elif base.startswith(SHUTDOWN_PREFIX): kind = 'shutdown'
        else:                                  kind = 'legacy'
        out.append({
            'name':     base,
            'kind':     kind,
            'size':     st.st_size,
            'modified': datetime.datetime.fromtimestamp(st.st_mtime).isoformat(timespec='seconds'),
        })
    out.sort(key=lambda e: e['modified'], reverse=True)
    return out


# ── Lifecycle ────────────────────────────────────────────────────────────────

def _open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")


def _shutdown_backup():
    """Create a timestamped snapshot on clean shutdown."""
    dest = _snapshot(SHUTDOWN_PREFIX, KEEP_SHUTDOWN)
    if dest:
        print(f"  Backup saved → {dest}")


socketserver.TCPServer.allow_reuse_address = True

print("=" * 48)
print("  AutoFix Pro")
print(f"  Opening  http://localhost:{PORT}")
print("  Close this window to shut down the server.")
print("=" * 48)

try:
    threading.Thread(target=_open_browser, daemon=True).start()
    with socketserver.TCPServer(("", PORT), _QuietHandler) as httpd:
        try:
            httpd.serve_forever()
        finally:
            # Always backup on the way out (Ctrl+C, window close, etc.)
            _shutdown_backup()

except OSError:
    # Port already occupied — another AutoFix Pro instance is likely running.
    # IMPORTANT: Do NOT switch to a different port — that would create a
    # separate data bucket and your saved data would not be visible.
    print(f"\n  Port {PORT} is already in use.")
    print("  If AutoFix Pro is already open, just use that browser tab.")
    print("  If another program is using port 8000, close it first,")
    print(f"  then re-run this launcher so data always stays on port {PORT}.")
    print("\n  Opening browser anyway...")
    webbrowser.open(f"http://localhost:{PORT}")
    input("\n  Press Enter to exit...")

except KeyboardInterrupt:
    print("\n  Server stopped.")
