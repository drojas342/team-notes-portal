// Administración de usuarios (solo ADMIN).
// No modifica auth.js, dashboard.js ni el tablero: defensa en profundidad,
// cada acción vuelve a comprobar el rol antes de llamar al backend.

let adminUser = null;
let editingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('usersSection')) return;
  initUsersAdmin();
});

async function initUsersAdmin() {
  const token = getToken();
  if (!token) return; // auth.js redirige al login.

  let me;
  try {
    me = await fetchMe(token);
  } catch (error) {
    return; // auth.js gestiona la sesión inválida.
  }

  if (!me.user || me.user.role !== 'ADMIN') return; // USER: sin botón, sin llamadas.

  adminUser = me.user;

  const adminBtn = document.getElementById('adminUsersBtn');
  adminBtn.classList.remove('d-none');
  adminBtn.addEventListener('click', toggleUsersSection);

  document.getElementById('createUserBtn').addEventListener('click', () => openUserModal(null));
  document.getElementById('userForm').addEventListener('submit', handleUserFormSubmit);
}

function isAdmin() {
  return !!adminUser && adminUser.role === 'ADMIN';
}

function handleAdminError(error, fallbackMessage) {
  if (error.status === 401) {
    clearSession();
    window.location.href = 'index.html';
    return;
  }
  if (error.status === 403) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }
  showUsersMessage(error.message || fallbackMessage, 'danger');
}

function toggleUsersSection() {
  if (!isAdmin()) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }
  const section = document.getElementById('usersSection');
  const nowHidden = section.classList.toggle('d-none');
  document.getElementById('adminUsersBtn').textContent = nowHidden
    ? 'Administrar usuarios'
    : 'Ocultar administración';
  if (!nowHidden) loadUsers();
}

async function loadUsers() {
  if (!isAdmin()) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }
  hideUsersMessage();
  try {
    const res = await getUsers();
    renderUsers(res.users || []);
  } catch (error) {
    handleAdminError(error, 'No se pudieron cargar los usuarios.');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';
  users.forEach((user) => {
    tbody.appendChild(buildUserRow(user));
  });
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function buildUserRow(user) {
  const tr = document.createElement('tr');

  tr.appendChild(cell(user.name));
  tr.appendChild(cell(user.email));

  const roleTd = document.createElement('td');
  const roleBadge = document.createElement('span');
  roleBadge.className = `badge ${user.role === 'ADMIN' ? 'text-bg-dark' : 'text-bg-secondary'}`;
  roleBadge.textContent = user.role;
  roleTd.appendChild(roleBadge);
  tr.appendChild(roleTd);

  const statusTd = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = `badge ${user.is_active ? 'text-bg-success' : 'text-bg-warning'}`;
  statusBadge.textContent = user.is_active ? 'Activo' : 'Inactivo';
  statusTd.appendChild(statusBadge);
  tr.appendChild(statusTd);

  const actionsTd = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'd-flex gap-2';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn-sm btn-outline-primary';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', () => openUserModal(user));

  const statusBtn = document.createElement('button');
  statusBtn.type = 'button';
  statusBtn.className = `btn btn-sm ${user.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`;
  statusBtn.textContent = user.is_active ? 'Desactivar' : 'Activar';
  statusBtn.addEventListener('click', () => handleToggleUserStatus(user));

  actions.appendChild(editBtn);
  actions.appendChild(statusBtn);
  actionsTd.appendChild(actions);
  tr.appendChild(actionsTd);

  return tr;
}

function openUserModal(user) {
  if (!isAdmin()) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }
  hideUserFormError();

  const form = document.getElementById('userForm');
  form.reset();

  editingUserId = user ? user.id : null;
  document.getElementById('userModalLabel').textContent = user ? 'Editar usuario' : 'Crear usuario';
  document.getElementById('userName').value = user ? user.name : '';
  document.getElementById('userEmail').value = user ? user.email : '';
  document.getElementById('userRole').value = user ? user.role : 'USER';
  // La contraseña solo existe al crear; nunca se edita desde aquí.
  document.getElementById('userPasswordWrap').classList.toggle('d-none', !!user);

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal'));
  modal.show();
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  if (!isAdmin()) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }
  hideUserFormError();

  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;

  if (!name || !email) {
    showUserFormError('El nombre y el correo son obligatorios');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    if (editingUserId) {
      // PUT: nombre/correo/rol. Nunca password ni is_active.
      await updateUser(editingUserId, { name, email, role });
    } else {
      const password = document.getElementById('userPassword').value;
      if (!password) {
        showUserFormError('La contraseña es obligatoria');
        return;
      }
      await createUser({ name, email, password, role });
    }

    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    await loadUsers();
    showUsersMessage('Usuario guardado correctamente.', 'success');
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    if (error.status === 403) {
      bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
      showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
      return;
    }
    // El modal queda abierto con el mensaje (p. ej. último ADMIN activo).
    showUserFormError(error.message);
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleToggleUserStatus(user) {
  if (!isAdmin()) {
    showUsersMessage('Acceso denegado: se requiere rol ADMIN.', 'danger');
    return;
  }

  const action = user.is_active ? 'desactivar' : 'activar';
  if (!window.confirm(`¿Está seguro de ${action} a ${user.email}?`)) return;

  try {
    await updateUserStatus(user.id, !user.is_active);
    await loadUsers();
    showUsersMessage(`Usuario ${action}do correctamente.`, 'success');
  } catch (error) {
    handleAdminError(error, 'No se pudo cambiar el estado del usuario.');
  }
}

function showUsersMessage(message, type) {
  const box = document.getElementById('usersMessage');
  if (!box) return;
  box.textContent = message;
  box.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
}

function hideUsersMessage() {
  const box = document.getElementById('usersMessage');
  if (!box) return;
  box.textContent = '';
  box.className = 'alert d-none';
}

function showUserFormError(message) {
  const box = document.getElementById('userFormError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('d-none');
}

function hideUserFormError() {
  const box = document.getElementById('userFormError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('d-none');
}
