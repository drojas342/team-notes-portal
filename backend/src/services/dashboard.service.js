const Note = require('../models/Note');

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function toMetrics(data) {
  if (!data || typeof data !== 'object') return null;
  const { total, pending, in_progress, done } = data;
  if (
    typeof total !== 'number' ||
    typeof pending !== 'number' ||
    typeof in_progress !== 'number' ||
    typeof done !== 'number'
  ) {
    return null;
  }
  return { total, pending, in_progress, done };
}

async function getMetrics() {
  const url = process.env.LAMBDA_METRICS_URL;
  if (!url) {
    fail(500, 'LAMBDA_METRICS_URL no está configurada');
  }

  const notes = await Note.findAll({ attributes: ['status'] });
  const statuses = notes.map((note) => note.status);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statuses }),
    });
  } catch (error) {
    fail(502, 'No se pudieron obtener las métricas del dashboard');
  }

  // SAM Local vía HTTP (start-api) desenvuelve la respuesta proxy:
  // el body ya es directamente { total, pending, in_progress, done }.
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    fail(502, 'No se pudieron obtener las métricas del dashboard');
  }

  const metrics = toMetrics(data);
  if (!metrics) {
    fail(502, 'No se pudieron obtener las métricas del dashboard');
  }

  return metrics;
}

module.exports = {
  getMetrics,
};
