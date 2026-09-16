const dashboardService = require('../services/dashboard.service');

function handleError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Error interno del servidor' : error.message,
  });
}

async function getMetrics(req, res) {
  try {
    const data = await dashboardService.getMetrics();
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getMetrics,
};
