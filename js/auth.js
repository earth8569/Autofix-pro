/**
 * ============================================================
 * auth.js — Simple Login Gate
 * ============================================================
 *
 * Provides a login screen before the app is accessible.
 * Credentials are stored here (client-side only).
 *
 * Developer: This is NOT secure authentication — it's a
 * basic access gate for home/small shop use. For real
 * security, use a backend with hashed passwords.
 *
 * To add more users, add entries to the USERS array below.
 * Session persists until browser tab is closed (sessionStorage).
 */

// ── Authorized users ──
// Developer: add/remove users here
const USERS = [
  { id: 'admin', password: '1111', name: 'Admin' },
  // { id: 'staff1', password: '2222', name: 'Staff 1' },
];

// ── Session key ──
const AUTH_KEY = 'ars_logged_in';

/**
 * isLoggedIn()
 * Returns true if user has already authenticated this session.
 */
function isLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

/**
 * getCurrentUser()
 * Returns the logged-in user's display name.
 */
function getCurrentUser() {
  return sessionStorage.getItem('ars_user_name') || 'User';
}

/**
 * attemptLogin(id, password)
 * Validates credentials. Returns true if successful.
 */
function attemptLogin(id, password) {
  const user = USERS.find(u => u.id === id && u.password === password);
  if (user) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem('ars_user_name', user.name);
    return true;
  }
  return false;
}

/**
 * logout()
 * Clears the session and shows the login screen.
 */
function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem('ars_user_name');
  showLoginScreen();
}

/**
 * showLoginScreen()
 * Renders the full-page login form and hides the app shell.
 */
function showLoginScreen() {
  // Hide app shell
  document.querySelector('.app-shell').style.display = 'none';

  // Remove existing login screen if any
  const existing = document.getElementById('login-screen');
  if (existing) existing.remove();

  const lang = getLang();
  const loginHTML = document.createElement('div');
  loginHTML.id = 'login-screen';
  loginHTML.innerHTML = `
    <div class="login-container">
      <div class="login-card">

        <div class="login-lang">
          <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="setLang('en')">EN</button>
          <button class="lang-btn ${lang === 'th' ? 'active' : ''}" onclick="setLang('th')">ภาษาไทย</button>
        </div>

        <div class="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
          </svg>
          <h1>AutoFix Pro</h1>
          <p>${t('appTagline')}</p>
        </div>

        <div class="login-form">
          <div class="login-field">
            <label for="login-id">${t('userId')}</label>
            <input id="login-id" type="text" placeholder="${t('enterUserId')}" autocomplete="username" />
          </div>
          <div class="login-field">
            <label for="login-pw">${t('password')}</label>
            <input id="login-pw" type="password" placeholder="${t('enterPassword')}" autocomplete="current-password" />
          </div>
          <div id="login-error" class="login-error"></div>
          <button id="login-btn" class="login-btn" onclick="handleLogin()">
            ${t('signIn')}
          </button>
        </div>

        <div class="login-footer">
          <small>© ${new Date().getFullYear()} AutoFix Pro — Home Edition</small>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(loginHTML);

  // Focus the ID field
  setTimeout(() => document.getElementById('login-id')?.focus(), 100);

  // Enter key to submit
  document.getElementById('login-id').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pw').focus(); });
  document.getElementById('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
}

/**
 * handleLogin()
 * Called when user clicks Sign In or presses Enter.
 */
function handleLogin() {
  const id = document.getElementById('login-id').value.trim();
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');

  if (!id || !pw) {
    errEl.textContent = t('errBothRequired');
    return;
  }

  if (attemptLogin(id, pw)) {
    // Remove login screen, show app
    document.getElementById('login-screen').remove();
    document.querySelector('.app-shell').style.display = 'flex';
    bootApp();
  } else {
    errEl.textContent = t('errInvalidCreds');
    document.getElementById('login-pw').value = '';
    document.getElementById('login-pw').focus();
    // Shake animation
    document.querySelector('.login-card').classList.add('shake');
    setTimeout(() => document.querySelector('.login-card').classList.remove('shake'), 500);
  }
}

/**
 * bootApp()
 * Initializes the app after successful login.
 * Called from the auth flow or directly if already logged in.
 */
function bootApp() {
  navigateTo('dashboard');
}
