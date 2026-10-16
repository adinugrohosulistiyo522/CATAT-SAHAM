import assert from 'node:assert/strict';
import worker from '../worker.js';

const assetCalls = [];
const env = {
  ASSETS: {
    async fetch(request) {
      assetCalls.push(new URL(request.url).pathname);
      return new Response('<!doctype html><title>CatatSaham test</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }
};

async function get(path, e = env) {
  return worker.fetch(new Request(`https://catat-saham.test${path}`), e);
}

const health = await get('/healthz');
assert.equal(health.status, 200, 'health endpoint returns HTTP 200');
const healthBody = await health.json();
assert.equal(healthBody.ok, true);
assert.equal(healthBody.workerVersion, '3.0.0');

const api = await get('/api');
assert.equal(api.status, 200, 'GET /api responds without environment variables');
const apiBody = await api.json();
assert.equal(apiBody.ok, true);
assert.equal(apiBody.service, 'CatatSaham API proxy');

const home = await get('/');
assert.equal(home.status, 200, 'root request is served by ASSETS binding');
assert.match(await home.text(), /CatatSaham test/);
assert.deepEqual(assetCalls, ['/']);

const noEnvPost = await worker.fetch(new Request('https://catat-saham.test/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://catat-saham.test' },
  body: JSON.stringify({ action: 'login' })
}), env);
assert.equal(noEnvPost.status, 500, 'POST reports a clear missing-environment error instead of hanging');
assert.match((await noEnvPost.json()).error, /APPS_SCRIPT_URL/);

const foreignOrigin = await worker.fetch(new Request('https://catat-saham.test/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://evil.example' },
  body: JSON.stringify({ action: 'login' })
}), env);
assert.equal(foreignOrigin.status, 403, 'cross-origin API writes are rejected');

// Simulate the Apps Script upstream to verify proxy forwarding and API-key injection.
const originalFetch = globalThis.fetch;
let upstreamRequest = null;
try {
  globalThis.fetch = async (url, options) => {
    upstreamRequest = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ ok: true, token: 'test-session', user: { username: 'tester' }, state: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const configuredEnv = {
    ...env,
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/Abc123_fake_ID/exec',
    CATATSAHAM_API_KEY: 'TEST_SECRET_NOT_FOR_BROWSER'
  };
  const proxyResponse = await worker.fetch(new Request('https://catat-saham.test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://catat-saham.test' },
    body: JSON.stringify({ action: 'login', username: 'tester', password: 'example' })
  }), configuredEnv);
  assert.equal(proxyResponse.status, 200, 'configured API proxy returns successful upstream status');
  const proxyBody = await proxyResponse.json();
  assert.equal(proxyBody.token, 'test-session');
  assert.equal(upstreamRequest.url, configuredEnv.APPS_SCRIPT_URL);
  assert.equal(upstreamRequest.body.apiKey, configuredEnv.CATATSAHAM_API_KEY, 'secret is inserted only at server-side upstream');
  assert.equal(upstreamRequest.body.action, 'login');
  assert.equal(JSON.stringify(proxyBody).includes(configuredEnv.CATATSAHAM_API_KEY), false, 'API key is not returned to browser');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('PASS: healthz, GET /api, static asset serving, missing-env diagnostics, same-origin guard, and secret-safe upstream proxy.');
