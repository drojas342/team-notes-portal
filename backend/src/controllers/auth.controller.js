const authService = require('../services/auth.service');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? 'Error interno del servidor' : error.message,
    });
  }
}

async function me(req, res) {
  return res.json({
    success: true,
    user: req.user,
  });
}

async function logout(req, res) {
  return res.json({
    success: true,
    message: 'Sesión cerrada correctamente',
  });
}

module.exports = {
  login,
  me,
  logout,
};
