export function renderLayout(title: string, content: string, showLogout = true, isSuperAdmin = false): string {
  const homeHref = isSuperAdmin ? '/db-viewer' : '/tasks'
  const navLinks = isSuperAdmin
    ? '<a href="/db-viewer" data-nav="/db-viewer" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">DB Viewer</a>'
    : '<a href="/tasks" data-nav="/tasks" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">Tasks</a><a href="/db-viewer" data-nav="/db-viewer" class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">DB Viewer</a>'
  const mobileNavLinks = isSuperAdmin
    ? '<a href="/db-viewer" data-nav="/db-viewer" class="flex items-center min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">DB Viewer</a>'
    : '<a href="/tasks" data-nav="/tasks" class="flex items-center min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">Tasks</a><a href="/db-viewer" data-nav="/db-viewer" class="flex items-center min-h-[44px] rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">DB Viewer</a>'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SMS Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          boxShadow: {
            'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
            'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
          },
        },
      },
    };
  </script>
</head>
<body class="min-h-screen bg-[#fafafa] text-slate-900 antialiased font-sans">
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div class="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-100/50 blur-3xl"></div>
    <div class="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-fuchsia-50/60 blur-3xl"></div>
    <div class="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-slate-100/80 blur-3xl"></div>
  </div>

  <nav class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm" aria-label="Main">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <!-- Desktop: single row -->
        <div class="hidden md:flex h-14 items-center justify-between">
        <div class="flex items-center gap-6 min-w-0">
          <a href="${homeHref}" class="nav-logo flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-slate-900 transition-opacity hover:opacity-90" data-nav="${homeHref}" id="nav-logo">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3l8 4v5c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V7l8-4z"></path>
                <path d="M9.5 12l1.8 1.8L14.8 10.3"></path>
              </svg>
              <span class="sr-only">Home</span>
            </span>
            <span class="truncate text-slate-800">Proxy Dashboard</span>
          </a>
          <span class="h-4 w-px shrink-0 bg-slate-200" aria-hidden="true"></span>
          <div class="flex items-center gap-0.5">
            ${navLinks}
          </div>
        </div>
        ${showLogout ? `
        <form method="POST" action="/auth/logout" class="shrink-0" onsubmit="return confirm('Are you sure you want to logout?');">
          <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-red-600 hover:to-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">Logout <span aria-hidden="true">➜]</span></button>
        </form>
        ` : '<span class="shrink-0"></span>'}
      </div>

      <!-- Mobile: logo + hamburger -->
      <div class="flex md:hidden h-14 items-center justify-between gap-3">
        <a href="${homeHref}" class="nav-logo flex shrink-0 items-center gap-2 font-semibold text-slate-900 min-w-0" data-nav="${homeHref}">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V7l8-4z"/><path d="M9.5 12l1.8 1.8L14.8 10.3"/></svg>
            <span class="sr-only">Home</span>
          </span>
          <span class="text-sm text-slate-800 truncate">Proxy Dashboard</span>
        </a>
        <button type="button" id="nav-menu-btn" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu" class="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 touch-manipulation shrink-0">
          <svg id="nav-menu-icon-open" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          <svg id="nav-menu-icon-close" class="h-6 w-6 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- Mobile dropdown -->
    <div id="nav-menu" class="hidden md:hidden border-t border-slate-200/80 bg-white" aria-label="Main menu">
      <div class="mx-auto max-w-6xl px-4 py-2">
        ${mobileNavLinks}
        ${showLogout ? `
        <div class="border-t border-slate-100 mt-2 pt-2">
          <form method="POST" action="/auth/logout" onsubmit="return confirm('Are you sure you want to logout?');">
            <button type="submit" class="flex w-full items-center justify-center gap-2 min-h-[44px] rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-red-600 hover:to-rose-700">Logout <span aria-hidden="true">➜]</span></button>
          </form>
        </div>
        ` : ''}
      </div>
    </div>
  </nav>

  <main class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
    ${content}
  </main>

  <script>
    (function () {
      var path = window.location.pathname || '/';
      var links = document.querySelectorAll('[data-nav]');
      for (var i = 0; i < links.length; i++) {
        var el = links[i];
        if (el.id === 'nav-logo' || el.classList.contains('nav-logo')) continue;
        var base = el.getAttribute('data-nav') || '';
        var active = base && (path === base || path.indexOf(base + '/') === 0);
        if (active) {
          el.classList.add('bg-slate-100', 'text-slate-900', 'font-semibold');
          el.classList.remove('text-slate-600', 'font-medium');
        }
      }
      var btn = document.getElementById('nav-menu-btn');
      var menu = document.getElementById('nav-menu');
      var iconOpen = document.getElementById('nav-menu-icon-open');
      var iconClose = document.getElementById('nav-menu-icon-close');
      if (btn && menu) {
        btn.addEventListener('click', function () {
          var isHidden = menu.classList.toggle('hidden');
          btn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
          if (iconOpen) iconOpen.classList.toggle('hidden', !isHidden);
          if (iconClose) iconClose.classList.toggle('hidden', isHidden);
        });
        menu.querySelectorAll('a, button').forEach(function (el) {
          el.addEventListener('click', function () {
            menu.classList.add('hidden');
            btn.setAttribute('aria-expanded', 'false');
            if (iconOpen) iconOpen.classList.remove('hidden');
            if (iconClose) iconClose.classList.add('hidden');
          });
        });
      }
      var messages = document.querySelectorAll('.auto-hide-message');
      messages.forEach(function(msg) {
        setTimeout(function() {
          msg.style.opacity = '0';
          msg.style.transition = 'opacity 300ms';
          setTimeout(function() {
            msg.style.display = 'none';
            var url = new URL(window.location.href);
            var paramsToRemove = ['error', 'registerError', 'registerSuccess', 'added', 'skipped'];
            var hasChanges = false;
            paramsToRemove.forEach(function(param) {
              if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                hasChanges = true;
              }
            });
            if (hasChanges) window.history.replaceState({}, '', url.pathname + (url.search || ''));
          }, 300);
        }, 3000);
      });
    })();
  </script>
</body>
</html>`;
}

export function renderLoginPage(
  error?: string,
  registerError?: string,
  registerSuccess?: boolean,
): string {
  const errorMessage = error === 'invalid-credentials' 
    ? 'Invalid username or password'
    : error === 'missing-credentials'
    ? 'Please enter both username and password'
    : error === 'server-error'
    ? 'Server error. Please try again.'
    : '';

  const registerErrorMessage = registerError === 'username-exists'
    ? 'Username already exists'
    : registerError === 'company-exists'
    ? 'This company already has an account'
    : registerError === 'invalid-company-name'
    ? 'Company name must be 2-120 characters'
    : registerError === 'missing-fields'
    ? 'Please fill in all fields'
    : registerError === 'password-mismatch'
    ? 'Passwords do not match'
    : registerError === 'server-error'
    ? 'Registration failed. Please try again.'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - SMS Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } } };</script>
</head>
<body class="min-h-screen bg-[#fafafa] text-slate-900 antialiased font-sans flex items-center justify-center px-4 py-8">
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div class="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-100/50 blur-3xl"></div>
    <div class="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-fuchsia-50/60 blur-3xl"></div>
    <div class="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-slate-100/80 blur-3xl"></div>
  </div>

  <div class="max-w-md w-full">
    <div class="mb-8 text-center">
      <div class="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
        <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3l8 4v5c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V7l8-4z"></path>
          <path d="M9.5 12l1.8 1.8L14.8 10.3"></path>
        </svg>
        <span class="sr-only">Admin</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Message Proxy Console</h1>
      <p class="mt-2 text-sm text-slate-500">Sign in to manage and schedule tasks.</p>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div class="mb-6 flex rounded-lg bg-slate-50 p-1">
        <button
          type="button"
          onclick="showLogin()"
          id="loginTab"
          class="flex-1 rounded-md py-2 text-center text-sm font-medium text-violet-700 bg-white shadow-sm transition-all duration-200"
        >
          Login
        </button>
        <button
          type="button"
          onclick="showRegister()"
          id="registerTab"
          class="flex-1 rounded-md py-2 text-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-all duration-200"
        >
          Register
        </button>
      </div>

      <!-- Login Form -->
      <div id="loginForm">
        ${errorMessage ? `
        <div id="loginError" class="auto-hide-message mb-4 rounded-xl p-3 bg-rose-50/80 border border-rose-200/80 text-rose-800 text-sm transition-opacity duration-300">
          ${errorMessage}
        </div>
        ` : ''}
        <form method="POST" action="/auth/login" class="space-y-5">
          <div>
            <label for="username" class="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Enter password"
            />
          </div>
          <button
            type="submit"
            class="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Login
          </button>
        </form>
      </div>

      <!-- Register Form -->
      <div id="registerForm" class="hidden">
        ${registerSuccess ? `
        <div id="registerSuccess" class="auto-hide-message mb-4 rounded-xl p-3 bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 text-sm transition-opacity duration-300">
          Registration successful! You can now login.
        </div>
        ` : ''}
        ${registerErrorMessage ? `
        <div id="registerError" class="auto-hide-message mb-4 rounded-xl p-3 bg-rose-50/80 border border-rose-200/80 text-rose-800 text-sm transition-opacity duration-300">
          ${registerErrorMessage}
        </div>
        ` : ''}
        <div id="passwordMismatchError" class="hidden mb-4 rounded-xl p-3 bg-rose-50/80 border border-rose-200/80 text-rose-800 text-sm">
          Passwords do not match. Please correct the password to match.
        </div>
        <form method="POST" action="/auth/register" onsubmit="return validatePasswordMatch(event)" class="space-y-5">
          <div>
            <label for="reg_company_name" class="block text-sm font-medium text-slate-700 mb-1.5">Company *</label>
            <input
              type="text"
              id="reg_company_name"
              name="companyName"
              required
              minlength="2"
              maxlength="120"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Enter your company name"
            />
          </div>
          <div>
            <label for="reg_username" class="block text-sm font-medium text-slate-700 mb-1.5">Username *</label>
            <input
              type="text"
              id="reg_username"
              name="username"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Choose username"
            />
          </div>
          <div>
            <label for="reg_password" class="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
            <input
              type="password"
              id="reg_password"
              name="password"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Choose password"
            />
          </div>
          <div>
            <label for="reg_confirm_password" class="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
            <input
              type="password"
              id="reg_confirm_password"
              name="confirmPassword"
              required
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Confirm password"
            />
          </div>
          <button
            type="submit"
            class="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  </div>

  <script>
    function showLogin() {
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('loginTab').classList.add('text-violet-700', 'bg-white', 'shadow-sm');
      document.getElementById('loginTab').classList.remove('text-slate-600');
      document.getElementById('registerTab').classList.remove('text-violet-700', 'bg-white', 'shadow-sm');
      document.getElementById('registerTab').classList.add('text-slate-600');
    }
    function showRegister() {
      document.getElementById('registerForm').classList.remove('hidden');
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('registerTab').classList.add('text-violet-700', 'bg-white', 'shadow-sm');
      document.getElementById('registerTab').classList.remove('text-slate-600');
      document.getElementById('loginTab').classList.remove('text-violet-700', 'bg-white', 'shadow-sm');
      document.getElementById('loginTab').classList.add('text-slate-600');
    }
    
    function validatePasswordMatch(event) {
      const password = document.getElementById('reg_password').value;
      const confirmPassword = document.getElementById('reg_confirm_password').value;
      const errorDiv = document.getElementById('passwordMismatchError');
      
      if (password !== confirmPassword) {
        event.preventDefault();
        errorDiv.classList.remove('hidden');
        errorDiv.classList.add('auto-hide-message');
        document.getElementById('reg_confirm_password').focus();
        
        // Auto-hide after 3 seconds
        setTimeout(function() {
          errorDiv.style.opacity = '0';
          setTimeout(function() {
            errorDiv.style.display = 'none';
            errorDiv.classList.remove('auto-hide-message');
          }, 300);
        }, 3000);
        
        return false;
      }
      
      return true;
    }
    
    // Auto-hide messages after 3 seconds and clean URL
    (function() {
      const shouldShowRegister = ${registerSuccess || !!registerError ? 'true' : 'false'};
      if (shouldShowRegister) showRegister();
      const messages = document.querySelectorAll('.auto-hide-message');
      messages.forEach(function(msg) {
        setTimeout(function() {
          msg.style.opacity = '0';
          setTimeout(function() {
            msg.style.display = 'none';
            // Clean URL parameters after message disappears
            const url = new URL(window.location.href);
            const paramsToRemove = ['error', 'registerError', 'registerSuccess', 'added', 'skipped'];
            let hasChanges = false;
            paramsToRemove.forEach(function(param) {
              if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                hasChanges = true;
              }
            });
            if (hasChanges) {
              window.history.replaceState({}, '', url.pathname + (url.search || ''));
            }
          }, 300); // Wait for fade transition
        }, 3000); // 3 seconds
      });
    })();
  </script>
</body>
</html>`;
}
