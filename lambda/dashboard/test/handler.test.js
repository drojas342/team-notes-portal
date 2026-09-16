'use strict';

// Pruebas locales de la Lambda (solo módulos nativos de Node, sin dependencias).
// Ejecutar desde lambda/dashboard:  npm test

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../src/handler');

describe('DashboardMetricsFunction', () => {
  it('caso normal: cuenta cada estado', async () => {
    const res = await handler({
      statuses: ['PENDING', 'DONE', 'DONE', 'IN_PROGRESS'],
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      total: 4,
      pending: 1,
      in_progress: 1,
      done: 2,
    });
  });

  it('array vacio: todo en cero', async () => {
    const res = await handler({ statuses: [] });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      total: 0,
      pending: 0,
      in_progress: 0,
      done: 0,
    });
  });

  it('estados desconocidos: se ignoran en contadores, suman al total', async () => {
    const res = await handler({ statuses: ['PENDING', 'INVALID', 'DONE'] });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      total: 3,
      pending: 1,
      in_progress: 0,
      done: 1,
    });
  });

  it('evento API Gateway (body como string)', async () => {
    const res = await handler({
      body: JSON.stringify({ statuses: ['PENDING', 'DONE'] }),
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      total: 2,
      pending: 1,
      in_progress: 0,
      done: 1,
    });
  });

  it('sin statuses o evento invalido: ceros de forma segura', async () => {
    for (const event of [{}, { statuses: 'PENDING' }, { statuses: null }, null]) {
      const res = await handler(event);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), {
        total: 0,
        pending: 0,
        in_progress: 0,
        done: 0,
      });
    }
  });
});
