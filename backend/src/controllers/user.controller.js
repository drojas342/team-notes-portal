const userService = require('../services/user.service');

function handleError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Error interno del servidor' : error.message,
  });
}

async function list(req, res) {
  try {
    const users = await userService.listUsers();
    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function create(req, res) {
  try {
    const { name, email, password, role } = req.body;
    const user = await userService.createUser({ name, email, password, role });
    return res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      user,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function update(req, res) {
  try {
    const { name, email, role } = req.body;
    const user = await userService.updateUser(req.params.id, { name, email, role });
    return res.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function setStatus(req, res) {
  try {
    const { is_active } = req.body;
    const user = await userService.setUserStatus(req.params.id, is_active);
    return res.json({
      success: true,
      message: 'Estado del usuario actualizado correctamente',
      user,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  list,
  create,
  update,
  setStatus,
};
