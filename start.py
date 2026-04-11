"""
AutoFix Pro — Local Server Launcher
====================================
Run this file (or double-click  AutoFix Pro.bat) to start the app.

WHY use this instead of double-clicking index.html?
  Browsers give every origin its own private storage bucket.
  file:// and http://localhost are different origins, so they
  have completely separate data.  Running through this server
  means the app always uses http://localhost:8000 as its origin,
  keeping your data consistent every time.
"""

import http.server
import socketserver
import threading
import webbrowser
import time
import os
import sys

PORT = 8000

# Serve files from the folder this script lives in
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Standard file server — request logs suppressed."""
    def log_message(self, *args):
        pass


def _open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")


socketserver.TCPServer.allow_reuse_address = True

print("=" * 48)
print("  AutoFix Pro")
print(f"  Opening  http://localhost:{PORT}")
print("  Close this window to shut down the server.")
print("=" * 48)

try:
    threading.Thread(target=_open_browser, daemon=True).start()
    with socketserver.TCPServer(("", PORT), _QuietHandler) as httpd:
        httpd.serve_forever()

except OSError:
    # Port already occupied — another instance is likely running
    print(f"\n  Port {PORT} is already in use.")
    print("  Opening browser to the existing server...")
    webbrowser.open(f"http://localhost:{PORT}")
    input("\n  Press Enter to exit...")

except KeyboardInterrupt:
    print("\n  Server stopped.")
