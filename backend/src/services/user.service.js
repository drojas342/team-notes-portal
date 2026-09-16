const User = require('../models/User');
const { hashPassword } = require('./auth.service');

const VALID_ROLES = ['ADMIN', 'USER'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    fail(400, 'El nombre es obligatorio');
  }
}

function validateEmail(email) {
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    fail(400, 'El email es obligatorio y debe ser válido');
  }
}

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    fail(400, 'El rol debe ser ADMIN o USER');
  }
}

function validatePassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    fail(400, 'La contraseña es obligatoria y debe tener al menos 8 caracteres');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail(400, 'La contraseña debe incluir al menos una letra y un número');
  }
}

async function countActiveAdmins() {
  return User.count({ where: { role: 'ADMIN', is_active: true } });
}

async function assertNotLastActiveAdmin(user) {
  if (user.role === 'ADMIN' && user.is_active) {
    const total = await countActiveAdmins();
    if (total <= 1) {
      fail(400, 'No se puede realizar la operación: el sistema debe conservar al menos un ADMIN activo');
    }
  }
}

async function listUsers() {
  const users = await User.findAll({
    attributes: ['id', 'name', 'email', 'role', 'is_active', 'createdAt', 'updatedAt'],
    order: [['id', 'ASC']],
  });
  return users;
}

async function createUser({ name, email, password, role }) {
  validateName(name);
  validateEmail(email);
  validatePassword(password);

  const safeRole = role === undefined ? 'USER' : role;
  validateRole(safeRole);

  const normalizedEmail = email.trim();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    fail(409, 'El email ya está registrado');
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashed,
    role: safeRole,
    is_active: true,
  });

  return toSafeUser(user);
}

async function updateUser(id, { name, email, role }) {
  const user = await User.findByPk(id);
  if (!user) {
    fail(404, 'Usuario no encontrado');
  }

  const changes = {};

  if (name !== undefined) {
    validateName(name);
    changes.name = name.trim();
  }

  if (email !== undefined) {
    validateEmail(email);
    const normalizedEmail = email.trim();
    if (normalizedEmail !== user.email) {
      const existing = await User.findOne({ where: { email: normalizedEmail } });
      if (existing) {
        fail(409, 'El email ya está registrado');
      }
      changes.email = normalizedEmail;
    }
  }

  if (role !== undefined && role !== user.role) {
    validateRole(role);
    if (user.role === 'ADMIN' && role === 'USER') {
      await assertNotLastActiveAdmin(user);
    }
    changes.role = role;
  }

  if (Object.keys(changes).length === 0) {
    return toSafeUser(user);
  }

  await user.update(changes);
  return toSafeUser(user);
}

async function setUserStatus(id, isActive) {
  if (typeof isActive !== 'boolean') {
    fail(400, 'is_active debe ser un valor booleano');
  }

  const user = await User.findByPk(id);
  if (!user) {
    fail(404, 'Usuario no encontrado');
  }

  if (isActive === false) {
    await assertNotLastActiveAdmin(user);
  }

  await user.update({ is_active: isActive });
  return toSafeUser(user);
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
};
