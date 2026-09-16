// Lógica de autenticación compartida entre index.html y dashboard.html.
// Se ejecuta según los elementos presentes en cada página.

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    initLoginPage(loginForm);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    initDashboardGuard(logoutBtn);
  }
});

// ---- index.html ----
async function initLoginPage(form) {
  const errorBox = document.getElementById('loginError');

  // Si ya hay token, validar contra /auth/me antes de mostrar el login.
  const existingToken = getToken();
  if (existingToken) {
    try {
      await fetchMe(existingToken);
      window.location.href = 'dashboard.html';
      return;
    } catch (error) {
      clearSession();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError(errorBox);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError(errorBox, 'El email y la contraseña son obligatorios');
      return;
    }

    setLoading(form, true);
    try {
      const data = await loginRequest(email, password);
      setSession(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (error) {
      showError(errorBox, error.message);
      setLoading(form, false);
    }
  });
}

// ---- dashboard.html ----
async function initDashboardGuard(logoutBtn) {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const data = await fetchMe(token);
    const userInfo = document.getElementById('userInfo');
    if (userInfo && data.user) {
      userInfo.textContent = `${data.user.name} (${data.user.email})`;
    }
  } catch (error) {
    clearSession();
    window.location.href = 'index.html';
    return;
  }

  logoutBtn.addEventListener('click', async () => {
    const currentToken = getToken();
    if (currentToken) {
      try {
        await logoutRequest(currentToken);
      } catch (error) {
        // Aunque falle el aviso al servidor, se cierra la sesión local.
      }
    }
    clearSession();
    window.location.href = 'index.html';
  });
}

// ---- helpers UI ----
function showError(box, message) {
  if (!box) return;
  box.textContent = message;
  box.classList.remove('d-none');
}

function hideError(box) {
  if (!box) return;
  box.textContent = '';
  box.classList.add('d-none');
}

function setLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Iniciando sesión...' : 'Iniciar sesión';
  }
}
