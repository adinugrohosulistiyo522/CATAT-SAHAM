/**
 * CatatSaham Cloudflare Worker entrypoint.
 * Environment secrets are configured in Cloudflare Dashboard:
 *   APPS_SCRIPT_URL
 *   CATATSAHAM_API_KEY
 * The Google API key is injected here and never sent by the browser.
 */
const API_PATH = '/api';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === API_PATH || url.pathname === `${API_PATH}/`) {
      return handleApi(request, env);
    }

    // Other requests are static assets. The assets binding is configured in wrangler.jsonc.
    if (!env.ASSETS) {
      return new Response('Static asset binding ASSETS belum tersedia.', {
        status: 500,
        headers: secureHeaders()
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

async function handleApi(request, env) {
  if (request.method === 'GET') {
    return json({ ok: true, service: 'CatatSaham API proxy', message: 'Proxy aktif. Gunakan POST untuk login dan operasi aplikasi.' }, 200);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: secureHeaders() });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method tidak didukung.' }, 405);

  // Same-origin only when a browser supplies the Origin header.
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
    return json({ ok: false, error: 'Environment APPS_SCRIPT_URL belum diisi atau bukan URL Web App /exec yang valid.' }, 500);
  }
  if (!apiKey) return json({ ok: false, error: 'Environment CATATSAHAM_API_KEY belum diisi.' }, 500);

  let incoming;
  try {
    incoming = await request.json();
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('Body JSON harus berupa object.');
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Body harus berupa JSON.' }, 400);
  }

  try {
    const upstream = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ ...incoming, apiKey }),
      redirect: 'follow'
    });
    const raw = await upstream.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: 'Respons Apps Script bukan JSON. Periksa deployment Web App dan izin aksesnya.' }, 502);
    }
    // Apps Script often returns HTTP 200 even for application-level errors; preserve its JSON body.
    return json(body, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json({ ok: false, error: 'Gagal menghubungi Apps Script. Periksa URL deploy dan status layanan.', detail: String(error?.message || error) }, 502);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: secureHeaders() });
}
function secureHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}
