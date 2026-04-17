"""
AutoFix Pro — Local Server Launcher
====================================
Run this file (or double-click  AutoFix Pro.bat) to start the app.

WHY use this instead of double-clicking index.html?
  Browsers give every origin its own private storage bucket.
  file:// and http://localhost are different origins, so they
  have completely separate data.  Running through this server
  means the app always uses http://localhost:8080 as its origin,
  keeping your data consistent every time.
"""

import http.server
import socketserver
import threading
import webbrowser
import time
import os
import sys
import json
import glob
import shutil
import datetime

PORT = 8080
DATA_FILE  = 'autofix_data.json'          # live data — always current
BACKUP_DIR = 'autofix_backups'             # daily snapshot folder

# Serve files from the folder this script lives in
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(BACKUP_DIR, exist_ok=True)


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    """File server with /api/data persistence endpoints."""

    def log_message(self, *args):
        pass

    # ── Route GET ──
    def do_GET(self):
        if self.path == '/api/data':
            self._get_data()
            return
        super().do_GET()

    # ── Route POST ──
    def do_POST(self):
        if self.path == '/api/data':
            self._post_data()
            return
        self.send_response(405)
        self.end_headers()

    def _get_data(self):
        """Return the saved data file, or 404 if none yet."""
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
            body = content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error":"no data file"}')

    def _post_data(self):
        """Save data sent from the browser; create a daily backup if needed."""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            json.loads(body)   # validate — reject corrupt JSON

            # Daily backup: copy current file before overwriting it
            today       = datetime.date.today().isoformat()
            backup_file = os.path.join(BACKUP_DIR, f'autofix_backup_{today}.json')
            if not os.path.exists(backup_file) and os.path.exists(DATA_FILE):
                shutil.copy2(DATA_FILE, backup_file)
                # Keep only the 7 most-recent daily backups
                old_backups = sorted(glob.glob(os.path.join(BACKUP_DIR, 'autofix_backup_*.json')))
                for old in old_backups[:-7]:
                    os.remove(old)

            # Write live data
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                f.write(body.decode('utf-8'))

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())


def _open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")


def _shutdown_backup():
    """Create a timestamped shutdown backup of the live data file."""
    if not os.path.exists(DATA_FILE):
        return
    ts   = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    dest = os.path.join(BACKUP_DIR, f'autofix_backup_{ts}_shutdown.json')
    try:
        shutil.copy2(DATA_FILE, dest)
        # Keep only the 10 most-recent backup files
        all_backups = sorted(glob.glob(os.path.join(BACKUP_DIR, 'autofix_backup_*.json')))
        for old in all_backups[:-10]:
            os.remove(old)
        print(f"  Backup saved → {dest}")
    except Exception as e:
        print(f"  Warning: shutdown backup failed: {e}")


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
