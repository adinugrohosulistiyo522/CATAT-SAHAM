/**
 * CatatSaham Cloudflare Worker — single deployment model.
 * This file is the actual Worker entrypoint referenced by wrangler.jsonc.
 * Browser code never receives CATATSAHAM_API_KEY.
 */
const VERSION = '3.0.0';
const API_PATH = '/api';
const HEALTH_PATHS = new Set(['/healthz', '/_health']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (HEALTH_PATHS.has(path) && request.method === 'GET') {
      return json({
        ok: true,
        service: 'CatatSaham',
        workerVersion: VERSION,
        runtime: 'cloudflare-worker-with-assets',
        apiConfigured: Boolean(String(env.APPS_SCRIPT_URL || '').trim()),
        apiKeyConfigured: Boolean(String(env.CATATSAHAM_API_KEY || '').trim())
      }, 200);
    }

    if (path === API_PATH || path === `${API_PATH}/` || path.startsWith(`${API_PATH}/`)) {
      if (path !== API_PATH && path !== `${API_PATH}/`) {
        return json({ ok: false, error: 'Endpoint API tidak dikenal.', workerVersion: VERSION }, 404);
      }
      return handleApi(request, env);
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Konfigurasi aset CatatSaham tidak tersedia. Pastikan wrangler.jsonc dipakai saat deploy.', {
        status: 503,
        headers: securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }

    try {
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      // Avoid stale HTML during iterative deployment; immutable assets may still use Cloudflare cache internally.
      if (path === '/' || path.endsWith('.html') || path.startsWith('/api')) {
        headers.set('Cache-Control', 'no-store, max-age=0');
      }
      headers.set('X-CatatSaham-Worker', VERSION);
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers
      });
    } catch (error) {
      return new Response('Gagal menyajikan aset CatatSaham.', {
        status: 500,
        headers: securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
  }
};

async function handleApi(request, env) {
  if (request.method === 'GET') {
    return json({
      ok: true,
      service: 'CatatSaham API proxy',
      workerVersion: VERSION,
      message: 'Worker aktif. Gunakan POST untuk login dan operasi aplikasi.',
      apiConfigured: Boolean(String(env.APPS_SCRIPT_URL || '').trim()),
      apiKeyConfigured: Boolean(String(env.CATATSAHAM_API_KEY || '').trim())
    }, 200);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: securityHeaders() });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method tidak didukung.' }, 405, { Allow: 'GET, POST, OPTIONS' });
  }

  // Browser API is same-origin only. Requests without Origin are allowed for health/diagnostic clients;
  // application POST requests from browsers always include Origin.
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ ok: false, error: 'Origin tidak diizinkan.' }, 403);
      }
    } catch {
      return json({ ok: false, error: 'Origin tidak valid.' }, 403);
    }
  }

  const appsScriptUrl = String(env.APPS_SCRIPT_URL || '').trim();
  const apiKey = String(env.CATATSAHAM_API_KEY || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(appsScriptUrl)) {
    return json({ ok: false, error: 'Environment APPS_SCRIPT_URL belum diisi atau bukan URL Web App /exec yang valid.', workerVersion: VERSION }, 500);
  }
  if (!apiKey) {
    return json({ ok: false, error: 'Environment CATATSAHAM_API_KEY belum diisi.', workerVersion: VERSION }, 500);
  }

  let incoming;
  try {
    incoming = await request.json();
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw new Error('Body JSON harus berupa object.');
    }
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Body harus berupa JSON.' }, 400);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('Apps Script request timeout'), 25000);
    let upstream;
    try {
      upstream = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({ ...incoming, apiKey }),
        redirect: 'follow',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await upstream.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: 'Respons Apps Script bukan JSON. Periksa deploy Web App dan izinnya.', workerVersion: VERSION }, 502);
    }
    // Apps Script may return HTTP 200 for application-level errors; preserve its JSON response.
    return json(body, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    const timedOut = error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('timeout');
    return json({
      ok: false,
      error: timedOut ? 'Apps Script tidak merespons dalam 25 detik.' : 'Gagal menghubungi Apps Script. Periksa URL deploy dan status layanan.',
      detail: String(error?.message || error || 'Unknown upstream error'),
      workerVersion: VERSION
    }, 502);
  }
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders })
  });
}
function securityHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'X-CatatSaham-Worker': VERSION,
    ...extra
  };
}
