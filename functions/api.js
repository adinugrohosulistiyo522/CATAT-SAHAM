/** Cloudflare Pages Function: /api -> Google Apps Script Web App. */
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method === 'GET') {
    return Response.json({ ok: true, service: 'CatatSaham API proxy', message: 'Gunakan POST untuk login dan operasi aplikasi.' }, { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method tidak didukung.' }, { status: 405, headers: corsHeaders(request) });
  }
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_URL.startsWith('https://script.google.com/macros/s/')) {
    return Response.json({ ok: false, error: 'Environment APPS_SCRIPT_URL belum diisi atau bukan URL Web App Apps Script.' }, { status: 500, headers: corsHeaders(request) });
  }
  if (!env.CATATSAHAM_API_KEY) {
    return Response.json({ ok: false, error: 'Environment CATATSAHAM_API_KEY belum diisi.' }, { status: 500, headers: corsHeaders(request) });
  }
  let incoming;
  try { incoming = await request.json(); }
  catch { return Response.json({ ok: false, error: 'Body harus berupa JSON.' }, { status: 400, headers: corsHeaders(request) }); }
  try {
    const upstream = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ ...incoming, apiKey: env.CATATSAHAM_API_KEY }),
      redirect: 'follow',
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    const text = await upstream.text();
    let body;
    try { body = JSON.parse(text); }
    catch { return Response.json({ ok: false, error: 'Respons Apps Script bukan JSON. Pastikan deployment menjalankan versi terbaru dan akses Web App diset Anyone.' }, { status: 502, headers: corsHeaders(request) }); }
    return Response.json(body, { status: upstream.ok ? 200 : upstream.status, headers: corsHeaders(request) });
  } catch (error) {
    return Response.json({ ok: false, error: 'Gagal menghubungi Apps Script. Periksa URL deploy dan status layanan.', detail: String(error?.message || error) }, { status: 502, headers: corsHeaders(request) });
  }
}
function corsHeaders(request) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff'
  };
}
