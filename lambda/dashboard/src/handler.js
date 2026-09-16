'use strict';

// Lambda de métricas del dashboard (Bloque 5A).
// Independiente: no accede a MySQL, no usa variables de entorno ni dependencias.
//
// DECISIÓN DOCUMENTADA: `total` = cantidad de elementos recibidos en
// `statuses` (incluye estados desconocidos). Los contadores
// (pending/in_progress/done) solo incluyen estados conocidos; los
// desconocidos se ignoran de forma segura.

function parseStatuses(event) {
  if (!event || typeof event !== 'object') return [];

  // Invocación vía API Gateway (proxy): el payload viene como string en body.
  let payload = event;
  if (typeof event.body === 'string') {
    try {
      payload = JSON.parse(event.body);
    } catch (error) {
      return [];
    }
    if (!payload || typeof payload !== 'object') return [];
  }

  if (!Array.isArray(payload.statuses)) return [];
  return payload.statuses;
}

function calculateMetrics(statuses) {
  const metrics = {
    total: statuses.length,
    pending: 0,
    in_progress: 0,
    done: 0,
  };

  for (const status of statuses) {
    if (status === 'PENDING') {
      metrics.pending += 1;
    } else if (status === 'IN_PROGRESS') {
      metrics.in_progress += 1;
    } else if (status === 'DONE') {
      metrics.done += 1;
    }
    // Estados desconocidos: no se cuentan (pero sí suman al total).
  }

  return metrics;
}

async function handler(event) {
  const statuses = parseStatuses(event);
  return {
    statusCode: 200,
    body: JSON.stringify(calculateMetrics(statuses)),
  };
}

module.exports = { handler, calculateMetrics };
