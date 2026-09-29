(function () {
  const { icon, escapeHtml } = HTUtil;
  const STORE_KEY = 'kf-pulse-posts';
  const LIVE_KEY = 'kf-pulse-live';
  const LIVE_EVERY = 15 * 60 * 1000; // data live diperbarui tiap 15 menit selama halaman terbuka
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const PLATFORMS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', x: 'X', lainnya: 'Lainnya' };
  const OUTLIER = 2; // post dianggap menonjol kalau views-nya >= 2x median

  // Nama kolom dari ekspor Meta Business Suite, Instagram, TikTok Studio, YouTube Studio, atau spreadsheet sendiri.
  // Urutan penting: alias pertama yang cocok persis menang, lalu baru dicari yang mengandung alias.
  const FIELDS = {
    date: ['publishtime', 'posttime', 'publishedat', 'published', 'createtime', 'createdat', 'timestamp', 'date', 'tanggal', 'waktu', 'waktupublikasi', 'videopublishtime'],
    caption: ['description', 'caption', 'videotitle', 'title', 'judul', 'keterangan', 'text', 'content'],
    url: ['permalink', 'url', 'link', 'videolink', 'postlink', 'tautan', 'shortcode'],
    type: ['posttype', 'mediatype', 'type', 'jenis', 'format'],
    platform: ['platform', 'network', 'channel'],
    views: ['views', 'plays', 'totalviews', 'videoviews', 'playcount', 'viewcount', 'tayangan', 'dilihat', 'impressions', 'tayanganvideo'],
    reach: ['reach', 'accountsreached', 'jangkauan'],
    likes: ['likes', 'totallikes', 'likecount', 'suka', 'reactions', 'reaksi'],
    comments: ['comments', 'totalcomments', 'commentcount', 'komentar'],
    shares: ['shares', 'totalshares', 'sharecount', 'dibagikan', 'bagikan'],
    saves: ['saves', 'saved', 'disimpan', 'favorites', 'addtofavorites'],
    duration: ['durationsec', 'duration', 'durasi', 'videoduration', 'length', 'panjang'],
  };
  const METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'];

  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  function mapColumns(headers) {
    const keys = headers.map(norm);
    const map = {};
    const used = new Set();
    for (const [field, aliases] of Object.entries(FIELDS)) {
      let idx = -1;
      for (const a of aliases) {
        idx = keys.findIndex((k, i) => !used.has(i) && k === a);
        if (idx >= 0) break;
      }
      if (idx < 0) {
        for (const a of aliases) {
          if (a.length < 4) continue;
          idx = keys.findIndex((k, i) => !used.has(i) && k.includes(a));
          if (idx >= 0) break;
        }
      }
      if (idx >= 0) {
        map[field] = idx;
        used.add(idx);
      }
    }
    return map;
  }

  // "1,234" "1.234" "148.5K" "12,8 rb" "1,2 jt" "3.4M" → angka.
  function parseNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s || s === '-' || s === '--') return null;
    let mult = 1;
    const suf = /(k|rb|ribu|m|jt|juta|b|mn)$/.exec(s);
    if (suf) {
      mult = { k: 1e3, rb: 1e3, ribu: 1e3, m: 1e6, jt: 1e6, juta: 1e6, mn: 1e6, b: 1e9 }[suf[1]];
      s = s.slice(0, -suf[1].length);
    }
    s = s.replace(/%$/, '');
    if (/^-?\d{1,3}([.,]\d{3})+$/.test(s) && mult === 1) s = s.replace(/[.,]/g, '');
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n * mult : null;
  }

  // Durasi: "58", "0:58", "1:05:00".
  function parseDuration(v) {
    const s = String(v ?? '').trim();
    if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(':').reduce((t, p) => t * 60 + Number(p), 0);
    return parseNum(s);
  }

  // Tanggal dengan garis miring bisa DD/MM atau MM/DD; urutannya ditebak dari seluruh kolom.
  const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2})[:.](\d{2}))?/;
  function dateOrder(values) {
    for (const v of values) {
      const m = SLASH.exec(String(v).trim());
      if (m && +m[1] > 12) return 'dmy';
      if (m && +m[2] > 12) return 'mdy';
    }
    return 'mdy'; // bawaan ekspor Meta dan TikTok
  }

  function parseDate(v, order) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (/^\d{10}$/.test(s)) return new Date(+s * 1000);
    if (/^\d{13}$/.test(s)) return new Date(+s);
    const m = SLASH.exec(s);
    if (m) {
      const [a, b] = order === 'dmy' ? [+m[2], +m[1]] : [+m[1], +m[2]];
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      const d = new Date(y, a - 1, b, +(m[4] || 0), +(m[5] || 0));
      return isNaN(d) ? null : d;
    }
    const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
    return isNaN(d) ? null : d;
  }

  function platformOf(url, raw, fileName) {
    const hay = `${url} ${raw} ${fileName}`.toLowerCase();
    if (/instagram|\binsta|\big\b|reels?\b/.test(hay)) return 'instagram';
    if (/tiktok/.test(hay)) return 'tiktok';
    if (/youtu/.test(hay)) return 'youtube';
    if (/facebook|fb\.watch|\bfb\b/.test(hay)) return 'facebook';
    if (/twitter|\bx\.com/.test(hay)) return 'x';
    return 'lainnya';
  }

  // ---------- baca file ----------
  function parseDelimited(text, delim) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === delim) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  async function readTable(file) {
    const text = (await file.text()).replace(/^﻿/, '');
    const ext = HTUtil.extName(file.name);
    if (ext === 'json' || /^\s*[[{]/.test(text)) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        throw new Error('JSON tidak valid.');
      }
      const list = Array.isArray(data) ? data : data.posts || data.data || data.reels || data.videos || [];
      if (!Array.isArray(list) || !list.length) throw new Error('JSON tidak berisi daftar post.');
      const headers = [...new Set(list.flatMap((o) => Object.keys(o || {})))];
      return [headers, ...list.map((o) => headers.map((h) => o?.[h] ?? ''))];
    }
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delim = ext === 'tsv' ? '\t' : [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
    return parseDelimited(text, delim);
  }

  async function readPosts(file) {
    const rows = await readTable(file);
    if (rows.length < 2) throw new Error('File tidak berisi data.');
    const map = mapColumns(rows[0]);
    if (map.views == null && map.likes == null) {
      throw new Error('Kolom views/plays atau likes tidak ditemukan. Pastikan baris pertama berisi nama kolom.');
    }
    const body = rows.slice(1);
    const cell = (r, f) => (map[f] == null ? '' : r[map[f]] ?? '');
    const order = dateOrder(body.map((r) => cell(r, 'date')));

    const posts = [];
    for (const r of body) {
      const p = {};
      for (const m of METRICS) p[m] = parseNum(cell(r, m));
      if (p.views == null && p.likes == null) continue; // baris keterangan di ekspor Meta
      const d = parseDate(cell(r, 'date'), order);
      let url = String(cell(r, 'url')).trim();
      if (url && !/^https?:/i.test(url) && /^[\w-]{8,}$/.test(url)) url = `https://www.instagram.com/reel/${url}/`;
      p.url = /^https?:\/\//i.test(url) ? url : '';
      p.date = d ? d.toISOString() : '';
      p.hasTime = !!d && (d.getHours() !== 0 || d.getMinutes() !== 0);
      p.caption = String(cell(r, 'caption')).replace(/\s+/g, ' ').trim();
      p.type = String(cell(r, 'type')).trim();
      p.duration = parseDuration(cell(r, 'duration'));
      p.platform = platformOf(p.url, cell(r, 'platform'), file.name);
      posts.push(p);
    }
    if (!posts.length) throw new Error('Tidak ada baris post yang bisa dibaca.');
    return posts;
  }

  // ---------- hitung ----------
  function median(nums) {
    const a = nums.filter((n) => n != null).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  const interactions = (p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
  const engagement = (p) => (p.views ? interactions(p) / p.views : null);
  const score = (p) => (p.views != null ? p.views : p.likes); // ukuran utama kalau views kosong

  const nf = new Intl.NumberFormat('id-ID');
  const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => (n == null ? '–' : n >= 10000 ? cf.format(n) : nf.format(Math.round(n)));
  const times = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '×';
  const pct = (n) => (n == null ? '–' : (n * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%');
  const fdate = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');

  function groupMedian(posts, keyFn, med) {
    const groups = new Map();
    for (const p of posts) {
      const k = keyFn(p);
      if (k == null) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(score(p));
    }
    return [...groups.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([k, v]) => ({ key: k, n: v.length, median: median(v), lift: med ? median(v) / med : null }))
      .sort((a, b) => b.median - a.median);
  }

  function insights(posts, med) {
    const out = [];
    const metric = posts.some((p) => p.views != null) ? 'views' : 'likes';
    const top = posts.filter((p) => score(p) >= med * OUTLIER);
    if (top.length) {
      out.push(`<strong>${top.length} dari ${posts.length} post</strong> menembus ${OUTLIER}× median. Pelajari pola judul, hook, dan waktu unggahnya.`);
    }

    const days = groupMedian(posts, (p) => (p.date ? new Date(p.date).getDay() : null), med);
    if (days.length >= 2) {
      const best = days[0];
      out.push(`Hari terbaik: <strong>${DAYS[best.key]}</strong>, median ${fmt(best.median)} ${metric} (${best.n} post, ${times(best.lift)} median keseluruhan).`);
    }

    const hours = groupMedian(posts, (p) => (p.hasTime ? Math.floor(new Date(p.date).getHours() / 3) : null), med);
    if (hours.length >= 2) {
      const h = hours[0].key * 3;
      out.push(`Jam unggah terbaik: <strong>${String(h).padStart(2, '0')}.00–${String(h + 3).padStart(2, '0')}.00</strong> (median ${fmt(hours[0].median)}, ${hours[0].n} post).`);
    }

    const LEN = [[0, 30, '< 30 detik'], [30, 45, '30–45 detik'], [45, 61, '45–60 detik'], [61, Infinity, '> 60 detik']];
    const lens = groupMedian(posts, (p) => (p.duration ? LEN.findIndex(([a, b]) => p.duration >= a && p.duration < b) : null), med);
    if (lens.length >= 2) {
      out.push(`Durasi terbaik: <strong>${LEN[lens[0].key][2]}</strong>, median ${fmt(lens[0].median)} ${metric} (${lens[0].n} post).`);
    }

    const ers = posts.map(engagement).filter((n) => n != null);
    if (ers.length >= 3) {
      const byEr = posts.filter((p) => engagement(p) != null).sort((a, b) => engagement(b) - engagement(a))[0];
      out.push(`Engagement tertinggi: <strong>${pct(engagement(byEr))}</strong> di “${escapeHtml(shortCaption(byEr, 60))}”.`);
    }

    const plats = groupMedian(posts, (p) => p.platform, med);
    if (plats.length >= 2) {
      out.push(`Platform terkuat: <strong>${PLATFORMS[plats[0].key]}</strong>, median ${fmt(plats[0].median)} ${metric} per post.`);
    }
    return out;
  }

  function shortCaption(p, n = 90) {
    const c = p.caption || p.url || 'Tanpa keterangan';
    return c.length > n ? c.slice(0, n - 1).trimEnd() + '…' : c;
  }

  // ---------- grafik ----------
  function drawChart(host, posts, med, log) {
    const W = Math.max(280, host.clientWidth);
    const H = 260;
    const pad = { t: 14, r: 12, b: 28, l: 52 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const vals = posts.map(score);
    const max = Math.max(1, ...vals);
    const tf = log ? (v) => Math.log10(Math.max(1, v)) : (v) => v;
    const top = tf(max) * 1.05 || 1;
    const y = (v) => pad.t + ih - (tf(v) / top) * ih;

    let ticks;
    if (log) {
      ticks = [];
      for (let e = 0; 10 ** e <= max * 1.05; e++) ticks.push(10 ** e);
      if (ticks.length > 5) ticks = ticks.filter((_, i) => i % 2 === ticks.length % 2 || i === ticks.length - 1);
    } else {
      const step = 10 ** Math.floor(Math.log10(max / 3));
      const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= 5);
      ticks = [];
      for (let v = 0; v <= max * 1.05; v += nice) ticks.push(v);
    }

    const slot = iw / posts.length;
    const bw = Math.max(1, Math.min(28, slot - 2));
    const bars = posts
      .map((p, i) => {
        const v = score(p);
        const x = pad.l + i * slot + (slot - bw) / 2;
        const yy = y(v);
        const h = Math.max(0, pad.t + ih - yy);
        const r = Math.min(4, bw / 2, h);
        const cls = med && v >= med * OUTLIER ? 'bar is-top' : 'bar';
        const path = `M${x},${pad.t + ih}V${yy + r}q0,-${r} ${r},-${r}H${x + bw - r}q${r},0 ${r},${r}V${pad.t + ih}Z`;
        return `<path class="${cls}" d="${path}"/><rect class="hit" data-i="${i}" x="${pad.l + i * slot}" y="${pad.t}" width="${slot}" height="${ih}"/>`;
      })
      .join('');

    const grid = ticks
      .map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`)
      .join('');
    const medLine = med
      ? `<line class="median" x1="${pad.l}" x2="${W - pad.r}" y1="${y(med)}" y2="${y(med)}"/><text class="median-label" x="${W - pad.r}" y="${y(med) - 6}" text-anchor="end">median ${fmt(med)}</text>`
      : '';
    const dated = posts.filter((p) => p.date);
    const axis = dated.length
      ? `<text class="tick" x="${pad.l}" y="${H - 8}">${fdate(posts[0].date)}</text><text class="tick" x="${W - pad.r}" y="${H - 8}" text-anchor="end">${fdate(posts[posts.length - 1].date)}</text>`
      : '';

    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik ${posts.length} post, diurutkan dari yang terlama">${grid}${bars}${medLine}${axis}</svg><div class="pulse-tip" hidden></div>`;
  }

  // Post yang sama dikenali dari shortcode Instagram (/p/ dan /reel/ bisa berbeda), atau dari link-nya.
  function postKey(p) {
    const ig = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i.exec(p.url || '');
    return ig ? 'ig:' + ig[1] : p.url || `${p.date}|${(p.caption || '').slice(0, 40)}`;
  }

  // Nilai kosong di data baru tidak menimpa data lama (mis. durasi dari file tetap ada setelah update live).
  function mergePosts(posts, incoming) {
    const index = new Map(posts.map((p, i) => [postKey(p), i]));
    let added = 0;
    let updated = 0;
    for (const p of incoming) {
      const k = postKey(p);
      if (index.has(k)) {
        const old = posts[index.get(k)];
        const next = { ...old };
        for (const [f, v] of Object.entries(p)) if (v != null && v !== '') next[f] = v;
        posts[index.get(k)] = next;
        updated++;
      } else {
        index.set(k, posts.length);
        posts.push(p);
        added++;
      }
    }
    return { added, updated };
  }

  function ago(iso) {
    const min = Math.floor((Date.now() - Date.parse(iso)) / 60000);
    if (min < 1) return 'baru saja';
    if (min < 60) return `${min} menit lalu`;
    const h = Math.floor(min / 60);
    return h < 24 ? `${h} jam lalu` : new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // ---------- tampilan ----------
  HT.register('post-analytics', {
    mount(el) {
      let posts = [];
      try {
        posts = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
      } catch (_) {
        posts = [];
      }
      const state = { platform: 'all', range: 'all', sort: 'date', dir: -1, log: false };
      let live = null; // { key, lastAt, account }
      try {
        live = JSON.parse(localStorage.getItem(LIVE_KEY));
      } catch (_) {
        live = null;
      }
      let liveBusy = false;

      el.innerHTML = `
        <div class="stack">
          ${HTUtil.block({
            icon: 'upload',
            title: 'Data post',
            actions: `<button class="btn btn-ghost btn-sm" data-ref="export" hidden>${icon('download', 16)} CSV gabungan</button>
                      <button class="btn btn-ghost btn-sm" data-ref="clear" hidden>${icon('trash', 16)} Hapus data</button>`,
            body: `${HTUtil.dropzone({
              accept: '.csv,.tsv,.json,.txt',
              title: 'Tarik file ekspor ke sini',
              sub: 'CSV/JSON dari Meta Business Suite, TikTok Studio, YouTube Studio, atau spreadsheet sendiri',
            })}
            <p class="help pulse-help">Kolom dikenali otomatis: tanggal, caption, link, views/plays, likes, comments, shares, saves, durasi. File baru digabung dengan data lama, dan post yang sama (link sama) diperbarui.</p>
            <div data-ref="live"></div>
            <div data-ref="msg"></div>`,
          })}
          <div data-ref="dash"></div>
        </div>`;

      const $ = (r) => el.querySelector(`[data-ref="${r}"]`);
      const dash = $('dash');

      function save() {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(posts));
        } catch (_) {
          /* penyimpanan penuh atau mode privat: data tetap ada selama halaman terbuka */
        }
      }

      function saveLive() {
        try {
          if (live) localStorage.setItem(LIVE_KEY, JSON.stringify(live));
          else localStorage.removeItem(LIVE_KEY);
        } catch (_) {
          /* abaikan */
        }
      }

      function renderLive() {
        const box = $('live');
        if (!live) {
          box.innerHTML = `
            <div class="pulse-live">
              <div class="pulse-live-text">
                <strong>Instagram live</strong>
                <span>Ambil data langsung dari akun Instagram dan perbarui otomatis tiap 15 menit.</span>
              </div>
              <form class="pulse-live-form" data-ref="live-form">
                <label class="control">${icon('shield', 18)}<input type="password" data-ref="live-key" placeholder="Kunci akses (PULSE_KEY)" autocomplete="current-password" required aria-label="Kunci akses"></label>
                <button class="btn btn-primary" type="submit">Sambungkan</button>
              </form>
            </div>`;
          box.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            live = { key: $('live-key').value.trim(), lastAt: null, account: null };
            fetchLive(false, true);
          });
          return;
        }
        const acc = live.account;
        const status = liveBusy ? 'Mengambil data…' : live.lastAt ? `Diperbarui ${ago(live.lastAt)}` : 'Belum ada data';
        box.innerHTML = `
          <div class="pulse-live is-on">
            <span class="live-dot${liveBusy ? ' is-busy' : ''}" aria-hidden="true"></span>
            <div class="pulse-live-text">
              <strong>Live${acc?.username ? ` · @${escapeHtml(acc.username)}` : ''}</strong>
              <span>${acc?.followers != null ? `${fmt(acc.followers)} followers · ` : ''}${status}</span>
            </div>
            <div class="action-group">
              <button class="btn btn-secondary btn-sm" data-ref="live-refresh"${liveBusy ? ' disabled' : ''}>${icon('retry', 16)} Perbarui</button>
              <button class="btn btn-ghost btn-sm" data-ref="live-off">Putuskan</button>
            </div>
          </div>`;
        $('live-refresh').addEventListener('click', () => fetchLive(true));
        $('live-off').addEventListener('click', () => {
          live = null;
          saveLive();
          renderLive();
        });
      }

      async function fetchLive(force, connecting) {
        if (!live || liveBusy) return;
        liveBusy = true;
        renderLive();
        let fail = '';
        try {
          const res = await fetch('/api/instagram' + (force ? '?force=1' : ''), { headers: { 'x-pulse-key': live.key }, cache: 'no-store' });
          const body = await res.json().catch(() => null);
          if (!body || (res.status === 404 && !body.error)) {
            fail = 'Endpoint live belum tersedia. Fitur ini hanya jalan setelah di-deploy ke Vercel.';
          } else if (!res.ok) {
            fail = body.message || `Gagal mengambil data (HTTP ${res.status}).`;
            if (res.status === 401) live = null;
          } else {
            const { added, updated } = mergePosts(posts, body.posts || []);
            live.lastAt = body.fetchedAt;
            live.account = body.account;
            save();
            if (connecting || added) message(`Live tersambung: ${added} post baru, ${updated} diperbarui.`);
            else if (body.stale) message('Batas panggilan Instagram tercapai, jadi yang tampil data terakhir.', true);
            render();
          }
        } catch (_) {
          fail = 'Tidak bisa menghubungi server. Periksa koneksi internet.';
        }
        if (fail) {
          message(escapeHtml(fail), true);
          if (connecting) live = null;
        }
        liveBusy = false;
        saveLive();
        renderLive();
      }

      // Perbarui label "x menit lalu" tiap menit, dan ambil data baru kalau sudah lewat 15 menit.
      function tick() {
        if (!live || document.hidden) return;
        if (!live.lastAt || Date.now() - Date.parse(live.lastAt) >= LIVE_EVERY) fetchLive(false);
        else if (!liveBusy) renderLive();
      }
      const timer = setInterval(tick, 60 * 1000);
      document.addEventListener('visibilitychange', tick);

      function message(html, warn) {
        $('msg').innerHTML = html ? `<div class="notice ${warn ? 'notice-warn' : 'notice-ok'}">${html}</div>` : '';
      }

      async function onFiles(files) {
        const notes = [];
        let added = 0;
        let updated = 0;
        for (const f of files) {
          try {
            const r = mergePosts(posts, await readPosts(f));
            added += r.added;
            updated += r.updated;
          } catch (err) {
            notes.push(`${escapeHtml(f.name)}: ${escapeHtml(err.message)}`);
          }
        }
        save();
        const ok = added || updated ? `${added} post baru${updated ? `, ${updated} diperbarui` : ''}.` : '';
        message([ok, ...notes].filter(Boolean).join('<br>'), notes.length > 0);
        render();
      }

      const unbind = HTUtil.bindFileInput($('dropzone'), $('input'), onFiles);

      $('clear').addEventListener('click', () => {
        if (!confirm('Hapus semua data post yang tersimpan di browser ini?')) return;
        posts = [];
        save();
        message('');
        render();
      });

      $('export').addEventListener('click', () => {
        const cols = ['platform', 'date', 'caption', 'url', 'type', 'duration', ...METRICS];
        const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : v ?? '');
        const csv = [cols.join(','), ...posts.map((p) => cols.map((c) => esc(p[c])).join(','))].join('\n');
        HTUtil.downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), `performa-post-${HTUtil.today()}.csv`);
      });

      function visible() {
        const since = state.range === 'all' ? 0 : Date.now() - Number(state.range) * 864e5;
        return posts
          .filter((p) => state.platform === 'all' || p.platform === state.platform)
          .filter((p) => !since || (p.date && Date.parse(p.date) >= since))
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }

      function sorted(list) {
        const val = {
          date: (p) => p.date || '',
          views: score,
          likes: (p) => p.likes ?? -1,
          comments: (p) => p.comments ?? -1,
          er: (p) => engagement(p) ?? -1,
        }[state.sort];
        return [...list].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * state.dir);
      }

      function render() {
        $('clear').hidden = $('export').hidden = !posts.length;
        if (!posts.length) {
          dash.innerHTML = '';
          return;
        }

        const plats = [...new Set(posts.map((p) => p.platform))];
        if (state.platform !== 'all' && !plats.includes(state.platform)) state.platform = 'all';
        const list = visible();
        const med = median(list.map(score));
        const hasViews = list.some((p) => p.views != null);
        const best = list.reduce((b, p) => (!b || score(p) > score(b) ? p : b), null);
        const ers = list.map(engagement).filter((n) => n != null);
        const sum = (f) => list.reduce((t, p) => t + (p[f] || 0), 0);

        const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
        const th = (key, label, num) =>
          `<th${num ? ' class="num"' : ''}><button data-sort="${key}" aria-sort="${state.sort === key ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${
            state.sort === key ? (state.dir > 0 ? ' ↑' : ' ↓') : ''
          }</button></th>`;

        dash.innerHTML = `
          <div class="stack">
            <div class="pulse-filters">
              <label class="control control-select">${icon('layers', 18)}
                <select data-ref="platform" aria-label="Platform">
                  ${opt('all', 'Semua platform', state.platform)}${plats.map((p) => opt(p, PLATFORMS[p], state.platform)).join('')}
                </select>
              </label>
              <label class="control control-select">${icon('gauge', 18)}
                <select data-ref="range" aria-label="Periode">
                  ${opt('all', 'Semua waktu', state.range)}${opt('7', '7 hari terakhir', state.range)}${opt('30', '30 hari terakhir', state.range)}${opt('90', '90 hari terakhir', state.range)}
                </select>
              </label>
            </div>
            ${
              !list.length
                ? '<div class="notice notice-warn">Tidak ada post di filter ini.</div>'
                : `
            <div class="stats pulse-kpis">
              <div class="stat"><span class="stat-label">Post</span><span class="stat-val">${nf.format(list.length)}</span></div>
              <div class="stat"><span class="stat-label">Total ${hasViews ? 'views' : 'likes'}</span><span class="stat-val">${fmt(sum(hasViews ? 'views' : 'likes'))}</span></div>
              <div class="stat"><span class="stat-label">Median per post</span><span class="stat-val">${fmt(med)}</span></div>
              <div class="stat"><span class="stat-label">Total likes</span><span class="stat-val">${fmt(sum('likes'))}</span></div>
              <div class="stat"><span class="stat-label">Rata-rata engagement</span><span class="stat-val">${pct(ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null)}</span></div>
              <div class="stat"><span class="stat-label">Post terbaik</span><span class="stat-val">${fmt(score(best))}</span></div>
            </div>
            ${HTUtil.block({
              icon: 'gauge',
              title: `${hasViews ? 'Views' : 'Likes'} per post`,
              actions: `<label class="check pulse-log"><input type="checkbox" data-ref="log"${state.log ? ' checked' : ''}> Skala log</label>`,
              body: `<div class="pulse-legend"><span><i class="sw sw-top"></i>≥ ${OUTLIER}× median</span><span><i class="sw"></i>Post lain</span><span><i class="sw sw-med"></i>Median</span></div>
                     <div class="pulse-chart" data-ref="chart"></div>`,
            })}
            ${HTUtil.block({
              icon: 'eye',
              title: 'Insight',
              body: (() => {
                const items = insights(list, med);
                return items.length
                  ? `<ul class="pulse-insights">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`
                  : '<p class="help">Tambahkan lebih banyak post (minimal 2 per kelompok) supaya pola hari, jam, dan durasi bisa dibandingkan.</p>';
              })(),
            })}
            ${HTUtil.block({
              icon: 'fileText',
              title: 'Semua post',
              body: `<div class="pulse-table-wrap"><table class="pulse-table">
                <thead><tr>${th('date', 'Tanggal')}<th>Post</th>${th('views', hasViews ? 'Views' : 'Likes', true)}${th('likes', 'Likes', true)}${th('comments', 'Komentar', true)}${th('er', 'Engagement', true)}<th class="num">vs median</th></tr></thead>
                <tbody>${sorted(list)
                  .map((p) => {
                    const lift = med ? score(p) / med : null;
                    const badge = lift == null ? '–' : `<span class="badge${lift >= OUTLIER ? ' badge-good' : ''}">${times(lift)}</span>`;
                    const cap = escapeHtml(shortCaption(p));
                    return `<tr>
                      <td class="nowrap">${fdate(p.date)}</td>
                      <td class="cap"><span class="plat">${PLATFORMS[p.platform]}</span>${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${cap}</a>` : cap}</td>
                      <td class="num">${fmt(score(p))}</td>
                      <td class="num">${fmt(p.likes)}</td>
                      <td class="num">${fmt(p.comments)}</td>
                      <td class="num">${pct(engagement(p))}</td>
                      <td class="num">${badge}</td>
                    </tr>`;
                  })
                  .join('')}</tbody></table></div>`,
            })}`
            }
          </div>`;

        dash.querySelector('[data-ref="platform"]').addEventListener('change', (e) => {
          state.platform = e.target.value;
          render();
        });
        dash.querySelector('[data-ref="range"]').addEventListener('change', (e) => {
          state.range = e.target.value;
          render();
        });
        if (!list.length) return;

        dash.querySelector('[data-ref="log"]').addEventListener('change', (e) => {
          state.log = e.target.checked;
          chart();
        });
        dash.querySelectorAll('[data-sort]').forEach((b) =>
          b.addEventListener('click', () => {
            const k = b.dataset.sort;
            state.dir = state.sort === k ? -state.dir : -1;
            state.sort = k;
            render();
          })
        );

        const host = dash.querySelector('[data-ref="chart"]');
        function chart() {
          drawChart(host, list, med, state.log);
        }
        chart();

        // Tooltip per batang.
        host.addEventListener('pointermove', (e) => {
          const tip = host.querySelector('.pulse-tip');
          const hit = e.target.closest?.('.hit');
          host.querySelectorAll('.bar.is-hover').forEach((b) => b.classList.remove('is-hover'));
          if (!hit) {
            tip.hidden = true;
            return;
          }
          const p = list[+hit.dataset.i];
          hit.previousElementSibling.classList.add('is-hover');
          tip.innerHTML = `<strong>${fmt(score(p))} ${hasViews ? 'views' : 'likes'}</strong><span>${fdate(p.date)} · ${PLATFORMS[p.platform]}</span><span>${escapeHtml(shortCaption(p, 70))}</span><span>${fmt(p.likes)} likes · ${fmt(p.comments)} komentar · ${pct(engagement(p))}</span>`;
          tip.hidden = false;
          const box = host.getBoundingClientRect();
          const x = e.clientX - box.left;
          tip.style.left = Math.min(Math.max(8, x - tip.offsetWidth / 2), box.width - tip.offsetWidth - 8) + 'px';
          tip.style.top = Math.max(0, e.clientY - box.top - tip.offsetHeight - 14) + 'px';
        });
        host.addEventListener('pointerleave', () => {
          const tip = host.querySelector('.pulse-tip');
          if (tip) tip.hidden = true;
          host.querySelectorAll('.bar.is-hover').forEach((b) => b.classList.remove('is-hover'));
        });
        host.addEventListener('click', (e) => {
          const hit = e.target.closest?.('.hit');
          const p = hit && list[+hit.dataset.i];
          if (p?.url && !matchMedia('(pointer: coarse)').matches) window.open(p.url, '_blank', 'noopener');
        });

        resize?.disconnect();
        let w = host.clientWidth;
        resize = new ResizeObserver(() => {
          if (Math.abs(host.clientWidth - w) > 4) {
            w = host.clientWidth;
            chart();
          }
        });
        resize.observe(host);
      }

      let resize = null;
      render();
      renderLive();
      tick();

      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', tick);
        unbind();
        resize?.disconnect();
      };
    },
  });
})();
