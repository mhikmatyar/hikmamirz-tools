/**
 * Vercel Function: data post Instagram untuk dashboard Pulse (Instagram API with Instagram Login).
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   IG_ACCESS_TOKEN  wajib. Token long-lived akun Instagram Profesional
 *                    (izin instagram_business_basic dan instagram_business_manage_insights).
 *   PULSE_KEY        wajib. Kunci akses buatan sendiri; Pulse mengirimnya di header x-pulse-key.
 *   CRON_SECRET      opsional. Dipakai Vercel Cron saat memperpanjang token tiap minggu.
 *   IG_GRAPH_VERSION opsional. Versi Graph API, bawaan v23.0.
 *
 * GET /api/instagram                → { fetchedAt, cached, account, posts }
 * GET /api/instagram?refresh_token  → perpanjang masa berlaku token (hanya dari Vercel Cron)
 */
const crypto = require('crypto');

const VERSION = process.env.IG_GRAPH_VERSION || 'v23.0';
const BASE = process.env.IG_GRAPH_BASE || `https://graph.instagram.com/${VERSION}`;
const TTL = 10 * 60 * 1000; // hasil disimpan 10 menit supaya tidak menabrak batas ±200 panggilan/jam
const MIN_FORCE = 60 * 1000;
const LIMIT = 30; // insight diambil untuk 30 post terbaru
const METRICS = ['views', 'reach', 'saved', 'shares'];

const TYPES = { IMAGE: 'Foto', VIDEO: 'Video', CAROUSEL_ALBUM: 'Carousel' };

let cache = null; // { at, data } — bertahan selama instance function masih hangat

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
}

async function graph(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', process.env.IG_ACCESS_TOKEN);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = new Error(body.error?.message || `Instagram API ${res.status}`);
    err.code = body.error?.code;
    throw err;
  }
  return body;
}

const valuesOf = (r) => Object.fromEntries((r.data || []).map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? null]));

// Tidak semua jenis post punya semua metrik. Kalau satu ditolak, ambil per metrik supaya yang lain tetap dapat.
async function insightsFor(id) {
  try {
    return valuesOf(await graph(`/${id}/insights`, { metric: METRICS.join(',') }));
  } catch (err) {
    if (err.code === 190) throw err;
  }
  const out = {};
  for (const metric of METRICS) {
    try {
      Object.assign(out, valuesOf(await graph(`/${id}/insights`, { metric })));
    } catch (err) {
      if (err.code === 190) throw err;
    }
  }
  return out;
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

async function load() {
  const [me, media] = await Promise.all([
    graph('/me', { fields: 'username,followers_count,media_count' }),
    graph('/me/media', {
      fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
      limit: String(LIMIT),
    }),
  ]);
  const list = media.data || [];
  const insights = await mapLimit(list, 5, (m) => insightsFor(m.id));
  return {
    fetchedAt: new Date().toISOString(),
    account: { username: me.username, followers: me.followers_count ?? null, mediaCount: me.media_count ?? null },
    posts: list.map((m, i) => ({
      platform: 'instagram',
      url: m.permalink || '',
      date: m.timestamp ? new Date(m.timestamp).toISOString() : '',
      caption: (m.caption || '').replace(/\s+/g, ' ').trim(),
      type: m.media_product_type === 'REELS' ? 'Reel' : TYPES[m.media_type] || '',
      views: insights[i].views ?? null,
      reach: insights[i].reach ?? null,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      shares: insights[i].shares ?? null,
      saves: insights[i].saved ?? null,
    })),
  };
}

async function refreshToken(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.authorization || '', `Bearer ${secret}`)) return send(res, 401, { error: 'unauthorized' });
  const url = new URL('/refresh_access_token', new URL(BASE).origin);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', process.env.IG_ACCESS_TOKEN || '');
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) return send(res, 502, { error: 'refresh_failed', message: body.error?.message || `HTTP ${r.status}` });
  if (body.access_token && body.access_token !== process.env.IG_ACCESS_TOKEN) {
    console.warn('Instagram mengembalikan token baru; perbarui IG_ACCESS_TOKEN di Vercel.');
  }
  return send(res, 200, { ok: true, expiresInDays: Math.round((body.expires_in || 0) / 86400) });
}

module.exports = async function handler(req, res) {
  const q = new URL(req.url, 'http://localhost').searchParams;
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (q.has('refresh_token')) return refreshToken(req, res);

  if (!process.env.IG_ACCESS_TOKEN || !process.env.PULSE_KEY) {
    return send(res, 503, { error: 'not_configured', message: 'IG_ACCESS_TOKEN dan PULSE_KEY belum diisi di Environment Variables Vercel.' });
  }
  if (!safeEqual(req.headers['x-pulse-key'] || '', process.env.PULSE_KEY)) {
    return send(res, 401, { error: 'bad_key', message: 'Kunci akses salah.' });
  }

  const age = cache ? Date.now() - cache.at : Infinity;
  const force = q.get('force') === '1' && age > MIN_FORCE;
  if (age < TTL && !force) return send(res, 200, { ...cache.data, cached: true });

  try {
    const data = await load();
    cache = { at: Date.now(), data };
    return send(res, 200, { ...data, cached: false });
  } catch (err) {
    if (err.code === 190) {
      return send(res, 502, { error: 'token_expired', message: 'Token Instagram kedaluwarsa atau tidak valid. Buat token baru lalu perbarui IG_ACCESS_TOKEN di Vercel.' });
    }
    if (err.code === 4 || err.code === 17 || err.code === 32) {
      if (cache) return send(res, 200, { ...cache.data, cached: true, stale: true });
      return send(res, 429, { error: 'rate_limited', message: 'Batas panggilan Instagram tercapai. Coba lagi dalam beberapa menit.' });
    }
    return send(res, 502, { error: 'instagram_error', message: err.message });
  }
};
