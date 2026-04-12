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

      <!-- Car animation scene -->
      <div class="login-car-scene">
        <div class="login-car-wrap" id="login-car">
          <svg class="car-svg" viewBox="0 0 240 92" xmlns="http://www.w3.org/2000/svg">
            <!-- Exhaust puffs (behind rear of car, painted first) -->
            <ellipse class="exhaust e1" cx="20" cy="66" rx="6"  ry="5"/>
            <ellipse class="exhaust e2" cx="10" cy="61" rx="5"  ry="4"/>
            <ellipse class="exhaust e3" cx="3"  cy="56" rx="3"  ry="3"/>
            <!-- Wheels (painted before body so body covers wheel tops) -->
            <g class="wheel">
              <circle cx="64"  cy="75" r="16" fill="#1a1a2e"/>
              <circle cx="64"  cy="75" r="13" fill="none" stroke="#374151" stroke-width="2"/>
              <circle cx="64"  cy="75" r="5"  fill="#4b5563"/>
              <line x1="64"  y1="59" x2="64"  y2="91" stroke="#4b5563" stroke-width="2"/>
              <line x1="48"  y1="75" x2="80"  y2="75" stroke="#4b5563" stroke-width="2"/>
              <line x1="53"  y1="64" x2="75"  y2="86" stroke="#4b5563" stroke-width="1.5"/>
              <line x1="53"  y1="86" x2="75"  y2="64" stroke="#4b5563" stroke-width="1.5"/>
            </g>
            <g class="wheel">
              <circle cx="173" cy="75" r="16" fill="#1a1a2e"/>
              <circle cx="173" cy="75" r="13" fill="none" stroke="#374151" stroke-width="2"/>
              <circle cx="173" cy="75" r="5"  fill="#4b5563"/>
              <line x1="173" y1="59" x2="173" y2="91" stroke="#4b5563" stroke-width="2"/>
              <line x1="157" y1="75" x2="189" y2="75" stroke="#4b5563" stroke-width="2"/>
              <line x1="162" y1="64" x2="184" y2="86" stroke="#4b5563" stroke-width="1.5"/>
              <line x1="162" y1="86" x2="184" y2="64" stroke="#4b5563" stroke-width="1.5"/>
            </g>
            <!-- Car body (covers wheel tops) -->
            <rect x="25" y="43" width="188" height="28" rx="8" fill="#f59e0b"/>
            <!-- Body highlight -->
            <rect x="65" y="44" width="110" height="5" rx="2.5" fill="white" opacity="0.08"/>
            <!-- Cabin -->
            <path d="M65 43 L87 17 L158 17 L178 43 Z" fill="#f59e0b"/>
            <!-- Windows -->
            <rect x="90"  y="20" width="32" height="21" rx="3" fill="#0f1117" opacity="0.88"/>
            <rect x="127" y="20" width="27" height="21" rx="3" fill="#0f1117" opacity="0.88"/>
            <!-- Window highlights -->
            <rect x="92"  y="22" width="9" height="4" rx="1.5" fill="white" opacity="0.14"/>
            <rect x="129" y="22" width="8" height="4" rx="1.5" fill="white" opacity="0.14"/>
            <!-- Door seam -->
            <line x1="124" y1="43" x2="124" y2="69" stroke="#d97706" stroke-width="1.5" opacity="0.5"/>
            <!-- Tail light -->
            <rect x="25"  y="50" width="6"  height="11" rx="2" fill="#ef4444" opacity="0.9"/>
            <!-- Rear bumper -->
            <rect x="23"  y="66" width="12" height="4"  rx="2" fill="#d97706"/>
            <!-- Exhaust pipe -->
            <rect x="28"  y="67" width="14" height="4"  rx="2" fill="#6b7280"/>
            <!-- Headlight -->
            <rect x="208" y="48" width="9"  height="12" rx="3" fill="#fef08a" opacity="0.9"/>
            <rect x="209" y="50" width="6"  height="8"  rx="2" fill="white"/>
            <!-- Front bumper -->
            <rect x="206" y="66" width="12" height="4"  rx="2" fill="#d97706"/>
          </svg>
        </div>
        <div class="login-road"><div class="road-dashes"></div></div>
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
    // Phase 1: car drives off to the right
    const carEl = document.getElementById('login-car');
    if (carEl) carEl.classList.add('driving');

    // Phase 2 (after drive-off): crossfade login → app
    setTimeout(() => {
      const loginScreen = document.getElementById('login-screen');
      const shell = document.querySelector('.app-shell');

      // Fade out login screen
      if (loginScreen) {
        loginScreen.style.transition = 'opacity 0.4s ease';
        loginScreen.style.opacity = '0';
      }

      // Reveal and fade in app shell
      shell.style.display = 'flex';
      shell.style.opacity = '0';
      shell.style.transition = 'opacity 0.4s ease';
      bootApp();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        shell.style.opacity = '1';
      }));

      // Cleanup after fade completes
      setTimeout(() => {
        if (loginScreen) loginScreen.remove();
        shell.style.opacity = '';
        shell.style.transition = '';
      }, 450);
    }, 650);
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
