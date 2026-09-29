(function () {
  const { icon, escapeHtml } = HTUtil;
  const STORE_KEY = 'kf-pulse-posts';
  const LIVE_KEY = 'kf-pulse-live';
  const HIST_KEY = 'kf-pulse-history';
  const TOPIC_KEY = 'kf-pulse-topics';
  const LIVE_EVERY = 15 * 60 * 1000; // data live diperbarui tiap 15 menit selama halaman terbuka
  const HOUR = 36e5;
  const TRACK_HOURS = 72; // riwayat views per post direkam selama 72 jam pertama
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const OUTLIER = 2; // post dianggap menonjol kalau views-nya >= 2x median
  const METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'];

  // Satu baris per topik: "Nama: kata kunci, kata kunci". Dicocokkan ke caption dan hashtag.
  const DEFAULT_TOPICS = [
    'Liverpool: liverpool, anfield, lfc, ynwa, arne slot, salah, jota',
    'Timnas Indonesia: indonesia, timnas, garuda, 🇮🇩, pssi, paes, ragnar',
    'Antar-negara: world cup, piala dunia, england, germany, japan, uruguay, netherlands, brazil, argentina, france, spain, portugal',
    'Real Madrid & Barcelona: real madrid, madrid, mourinho, barcelona, barca, raphinha',
    'Komedi: 😂, 🤣, lol, funny, meme, found their true calling',
    'Sponsor Syntx: syntx, mirza15',
  ].join('\n');

  // ---------- hitung ----------
  function median(nums) {
    const a = nums.filter((n) => n != null && Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  const ratio = (a, b) => (a != null && b ? a / b : null);
  const interactions = (p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
  const RATES = {
    er: { label: 'Engagement', hint: '(likes + komentar + shares + saves) ÷ views', fn: (p) => (p.views ? interactions(p) / p.views : null), pct: true },
    share: { label: 'Share rate', hint: 'shares ÷ views, sinyal konten menyebar', fn: (p) => ratio(p.shares, p.views), pct: true },
    save: { label: 'Save rate', hint: 'saves ÷ views, sinyal konten layak ditonton ulang', fn: (p) => ratio(p.saves, p.views), pct: true },
    rewatch: { label: 'Rewatch', hint: 'views ÷ reach, rata-rata ditonton berapa kali per akun', fn: (p) => ratio(p.views, p.reach), pct: false },
  };
  const engagement = RATES.er.fn;
  const score = (p) => (p.views != null ? p.views : p.likes); // ukuran utama kalau views kosong

  const nf = new Intl.NumberFormat('id-ID');
  const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => (n == null ? '–' : Math.abs(n) >= 10000 ? cf.format(n) : nf.format(Math.round(n)));
  const times = (n) => (n == null ? '–' : n.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '×');
  const pct = (n) => (n == null ? '–' : (n * 100).toLocaleString('id-ID', { maximumFractionDigits: n < 0.01 ? 2 : 1 }) + '%');
  const rateText = (key, v) => (RATES[key].pct ? pct(v) : times(v));
  const fdate = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');
  const fdatetime = (iso) =>
    iso ? new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

  function shortCaption(p, n = 90) {
    const c = (p.caption || p.url || 'Tanpa keterangan').replace(/\s+/g, ' ').trim();
    return c.length > n ? c.slice(0, n - 1).trimEnd() + '…' : c;
  }

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

  // ---------- topik ----------
  function parseTopics(text) {
    return String(text || '')
      .split('\n')
      .map((line) => {
        const i = line.indexOf(':');
        if (i < 1) return null;
        const words = line
          .slice(i + 1)
          .split(',')
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean);
        return words.length ? { name: line.slice(0, i).trim(), words } : null;
      })
      .filter(Boolean);
  }

  // Kata harus diawali batas kata ("slot" cocok dengan "#slot" dan "slots", tapi tidak dengan "timeslot").
  function hasWord(text, word) {
    if (!/[\p{L}\p{N}]/u.test(word)) return text.includes(word);
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}`, 'u').test(text);
  }

  function topicsOf(p, rules) {
    const text = (p.caption || '').toLowerCase();
    const hit = rules.filter((r) => r.words.some((w) => hasWord(text, w))).map((r) => r.name);
    return hit.length ? hit : ['Lainnya'];
  }

  function topicStats(list, rules, med) {
    const groups = new Map();
    for (const p of list) {
      for (const t of topicsOf(p, rules)) {
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(p);
      }
    }
    const shareMed = median(list.map(RATES.share.fn));
    return [...groups.entries()]
      .map(([name, ps]) => {
        const m = median(ps.map(score));
        const lift = med ? m / med : null;
        const share = median(ps.map(RATES.share.fn));
        let verdict;
        if (ps.length < 2) verdict = { label: 'Butuh data', cls: '' };
        else if (lift >= 1.3 || (lift >= 1 && shareMed && share >= shareMed * 1.5)) verdict = { label: 'Lanjutkan', cls: 'badge-good' };
        else if (lift <= 0.7) verdict = { label: 'Kurangi', cls: 'badge-warn' };
        else verdict = { label: 'Uji lagi', cls: '' };
        return { name, n: ps.length, median: m, lift, share, save: median(ps.map(RATES.save.fn)), er: median(ps.map(engagement)), verdict };
      })
      .sort((a, b) => (a.name === 'Lainnya') - (b.name === 'Lainnya') || b.median - a.median);
  }

  // ---------- riwayat (followers dan views per jam) ----------
  function recordHistory(hist, incoming, account, at) {
    const now = Date.parse(at);
    if (account?.followers != null) {
      const f = hist.followers;
      const last = f[f.length - 1];
      if (!last || last[1] !== account.followers || now - Date.parse(last[0]) > 6 * HOUR) f.push([at, account.followers]);
      if (f.length > 1500) f.splice(0, f.length - 1500);
    }
    for (const p of incoming) {
      if (p.views == null || !p.date) continue;
      const age = now - Date.parse(p.date);
      if (age < 0 || age > TRACK_HOURS * HOUR) continue;
      const s = (hist.snaps[postKey(p)] ||= []);
      const last = s[s.length - 1];
      const gap = age < 6 * HOUR ? 10 * 60e3 : 55 * 60e3; // rapat di jam-jam awal, lalu per jam
      if (last && now - Date.parse(last[0]) < gap) continue;
      s.push([at, p.views, p.likes ?? null]);
    }
  }

  // Views sebuah post pada umur tertentu (jam), diinterpolasi dari snapshot. Saat diunggah views = 0.
  function viewsAt(snaps, p, ageH) {
    if (!snaps?.length || !p.date) return null;
    const t0 = Date.parse(p.date);
    const target = t0 + ageH * HOUR;
    let prev = [t0, 0];
    for (const s of snaps) {
      const t = Date.parse(s[0]);
      if (t >= target) {
        if (t - prev[0] > Math.max(HOUR, ageH * HOUR * 0.5)) return null; // celah terlalu lebar, tidak bisa ditaksir
        const f = t === prev[0] ? 1 : (target - prev[0]) / (t - prev[0]);
        return prev[1] + (s[1] - prev[1]) * f;
      }
      prev = [t, s[1]];
    }
    return null;
  }

  function typicalAt(hist, posts, ageH, exclude) {
    const vals = posts.filter((q) => q !== exclude).map((q) => viewsAt(hist.snaps[postKey(q)], q, ageH));
    return vals.filter((v) => v != null).length >= 2 ? median(vals) : null;
  }

  // Post termuda yang masih direkam, dibandingkan dengan post lain di umur yang sama.
  function velocity(hist, posts, p) {
    if (!p?.date || p.views == null) return null;
    const ageH = (Date.now() - Date.parse(p.date)) / HOUR;
    if (ageH <= 0 || ageH > TRACK_HOURS) return null;
    const snaps = hist.snaps[postKey(p)];
    const last = snaps?.[snaps.length - 1];
    if (!last) return null;
    const at = (Date.parse(last[0]) - Date.parse(p.date)) / HOUR;
    const typical = typicalAt(hist, posts, at, p);
    return typical ? { ageH: at, views: last[1], typical, lift: last[1] / typical } : null;
  }

  // ---------- indikator "dibanding biasanya" (seperti Instagram Insights) ----------
  function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // Kisaran biasanya = kuartil 25%–75% dari post pembanding. Butuh minimal 4 post.
  function typicalBand(values) {
    const a = values.filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y);
    return a.length >= 4 ? { lo: quantile(a, 0.25), hi: quantile(a, 0.75), n: a.length } : null;
  }

  const LEVELS = {
    up: { label: 'Lebih tinggi dari biasanya', short: 'Di atas biasanya', cls: 'is-up', icon: 'arrowUp' },
    normal: { label: 'Normal', short: 'Sesuai biasanya', cls: 'is-normal', icon: 'minus' },
    down: { label: 'Lebih rendah dari biasanya', short: 'Di bawah biasanya', cls: 'is-down', icon: 'arrowDown' },
  };
  const levelOf = (v, band) => (v == null || !band ? null : v > band.hi ? 'up' : v < band.lo ? 'down' : 'normal');

  // Post pembanding: 30 post terbaru lain dengan jenis yang sama (kalau cukup), selain post itu sendiri.
  function peersOf(posts, p) {
    const others = posts.filter((q) => q !== p && q.date).sort((a, b) => b.date.localeCompare(a.date));
    const same = others.filter((q) => q.type && q.type === p.type);
    return (same.length >= 4 ? same : others).slice(0, 30);
  }

  // ---------- insight ----------
  function insights(ctx) {
    const { list, med, followers, hist, all } = ctx;
    const out = [];
    const metric = list.some((p) => p.views != null) ? 'views' : 'likes';
    const link = (p, n = 60) => `<button class="linkish" data-detail="${escapeHtml(postKey(p))}">“${escapeHtml(shortCaption(p, n))}”</button>`;

    const newest = [...all].filter((p) => p.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    const v = velocity(hist, all, newest);
    if (v) {
      const h = v.ageH < 1 ? `${Math.round(v.ageH * 60)} menit` : `${Math.round(v.ageH)} jam`;
      const pace = v.lift >= 1.2 ? 'lebih cepat' : v.lift <= 0.8 ? 'lebih lambat' : 'setara';
      out.push(
        `Kecepatan awal ${link(newest, 40)}: <strong>${fmt(v.views)} views di ${h} pertama</strong>, ${pace} dari biasanya (${times(v.lift)}, rata-rata ${fmt(v.typical)}).`
      );
    }

    const top = list.filter((p) => score(p) >= med * OUTLIER);
    if (top.length) {
      out.push(`<strong>${top.length} dari ${list.length} post</strong> menembus ${OUTLIER}× median. Pelajari pola judul, hook, dan waktu unggahnya.`);
    }

    const best = (key) => list.filter((p) => RATES[key].fn(p) != null).sort((a, b) => RATES[key].fn(b) - RATES[key].fn(a))[0];
    const byShare = best('share');
    const shareMed = median(list.map(RATES.share.fn));
    if (byShare && list.filter((p) => RATES.share.fn(p) != null).length >= 3) {
      out.push(
        `Paling banyak dibagikan: ${link(byShare)} dengan share rate <strong>${pct(RATES.share.fn(byShare))}</strong> (${times(RATES.share.fn(byShare) / shareMed)} median). Share adalah sinyal terkuat supaya Reels didorong ke non-follower.`
      );
    }
    const bySave = best('save');
    if (bySave && bySave !== byShare && list.filter((p) => RATES.save.fn(p) != null).length >= 3) {
      out.push(`Paling banyak disimpan: ${link(bySave)} dengan save rate <strong>${pct(RATES.save.fn(bySave))}</strong>.`);
    }

    if (followers) {
      const beyond = list.filter((p) => p.reach > followers);
      if (beyond.length) {
        const b = beyond.sort((a, c) => c.reach - a.reach)[0];
        out.push(
          `<strong>${beyond.length} post</strong> menjangkau lebih banyak akun dari jumlah followers (${fmt(followers)}), artinya Instagram mendorongnya ke non-follower. Tertinggi: ${link(b, 40)} dengan ${times(b.reach / followers)} jumlah followers.`
        );
      } else if (list.some((p) => p.reach != null)) {
        out.push(`Belum ada post yang reach-nya melebihi jumlah followers (${fmt(followers)}). Jangkauan masih sebatas audiens sendiri.`);
      }
    }

    const rw = median(list.map(RATES.rewatch.fn));
    if (rw) {
      const byRw = best('rewatch');
      out.push(`Rewatch median <strong>${times(rw)}</strong> views per akun. Tertinggi ${times(RATES.rewatch.fn(byRw))} di ${link(byRw, 40)}; loop dan hook di video ini layak ditiru.`);
    }

    const days = groupMedian(list, (p) => (p.date ? new Date(p.date).getDay() : null), med);
    if (days.length >= 2) {
      const d = days[0];
      out.push(`Hari terbaik: <strong>${DAYS[d.key]}</strong>, median ${fmt(d.median)} ${metric} (${d.n} post, ${times(d.lift)} median keseluruhan).`);
    }

    const hours = groupMedian(list, (p) => (p.date ? Math.floor(new Date(p.date).getHours() / 3) : null), med);
    if (hours.length >= 2) {
      const h = hours[0].key * 3;
      out.push(`Jam unggah terbaik: <strong>${String(h).padStart(2, '0')}.00–${String(h + 3).padStart(2, '0')}.00</strong> (median ${fmt(hours[0].median)}, ${hours[0].n} post).`);
    }
    return out;
  }

  // ---------- grafik ----------
  function niceTicks(min, max, count = 4) {
    const span = max - min || Math.abs(max) || 1;
    const step0 = span / count;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 0.001; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  function drawBars(host, posts, med, log) {
    const W = Math.max(280, host.clientWidth);
    const H = 260;
    const pad = { t: 14, r: 12, b: 28, l: 52 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const max = Math.max(1, ...posts.map(score));
    const tf = log ? (v) => Math.log10(Math.max(1, v)) : (v) => v;
    let ticks;
    if (log) {
      ticks = [];
      for (let e = 0; 10 ** e <= max * 1.05; e++) ticks.push(10 ** e);
      if (ticks.length > 5) ticks = ticks.filter((_, i) => i % 2 === ticks.length % 2 || i === ticks.length - 1);
    } else {
      ticks = niceTicks(0, max);
    }
    const top = tf(log ? max * 1.05 : ticks[ticks.length - 1]) || 1;
    const y = (v) => pad.t + ih - (tf(v) / top) * ih;

    const slot = iw / posts.length;
    const bw = Math.max(1, Math.min(28, slot - 2));
    const bars = posts
      .map((p, i) => {
        const v = score(p) || 0;
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
    const axis = posts[0].date
      ? `<text class="tick" x="${pad.l}" y="${H - 8}">${fdate(posts[0].date)}</text><text class="tick" x="${W - pad.r}" y="${H - 8}" text-anchor="end">${fdate(posts[posts.length - 1].date)}</text>`
      : '';
    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik ${posts.length} post, diurutkan dari yang terlama">${grid}${bars}${medLine}${axis}</svg><div class="pulse-tip" hidden></div>`;
  }

  // Grafik garis sederhana: points = [{x: angka, y: angka}], dengan garis pembanding opsional (putus-putus).
  function drawLine(host, points, { height = 180, xLabel, yLabel = fmt, compare = null, compareLabel = '' } = {}) {
    const W = Math.max(260, host.clientWidth);
    const H = height;
    const pad = { t: 12, r: 12, b: 26, l: 52 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const all = [...points, ...(compare || [])];
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const X = (v) => pad.l + (x1 === x0 ? iw / 2 : ((v - x0) / (x1 - x0)) * iw);
    const Y = (v) => pad.t + ih - (y1 === y0 ? ih / 2 : ((v - y0) / (y1 - y0)) * ih);
    const path = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    const grid = ticks
      .map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${pad.l - 8}" y="${Y(t) + 4}" text-anchor="end">${yLabel(t)}</text>`)
      .join('');
    const axis = `<text class="tick" x="${pad.l}" y="${H - 6}">${xLabel(x0)}</text><text class="tick" x="${W - pad.r}" y="${H - 6}" text-anchor="end">${xLabel(x1)}</text>`;
    const cmp = compare?.length > 1 ? `<path class="line-compare" d="${path(compare)}"/>` : '';
    const lastP = points[points.length - 1];
    const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(compareLabel || 'Grafik garis')}">${grid}${cmp}<path class="line" d="${path(points)}"/><circle class="line-end" cx="${X(lastP.x)}" cy="${Y(lastP.y)}" r="4"/><line class="cross" y1="${pad.t}" y2="${pad.t + ih}" hidden/><circle class="line-dot" r="5" hidden/>${axis}</svg><div class="pulse-tip" hidden></div>`;
    host.innerHTML = svg;
    return { X, Y, points, pad, W };
  }

  function bindLineHover(host, geo, tipHtml) {
    const svg = host.querySelector('svg');
    const tip = host.querySelector('.pulse-tip');
    const cross = svg.querySelector('.cross');
    const dot = svg.querySelector('.line-dot');
    svg.addEventListener('pointermove', (e) => {
      const box = svg.getBoundingClientRect();
      const mx = e.clientX - box.left;
      let best = geo.points[0];
      for (const p of geo.points) if (Math.abs(geo.X(p.x) - mx) < Math.abs(geo.X(best.x) - mx)) best = p;
      const cx = geo.X(best.x);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.hidden = false;
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', geo.Y(best.y));
      dot.hidden = false;
      tip.innerHTML = tipHtml(best);
      tip.hidden = false;
      tip.style.left = Math.min(Math.max(8, cx - tip.offsetWidth / 2), box.width - tip.offsetWidth - 8) + 'px';
      tip.style.top = Math.max(0, geo.Y(best.y) - tip.offsetHeight - 14) + 'px';
    });
    svg.addEventListener('pointerleave', () => {
      cross.hidden = dot.hidden = tip.hidden = true;
    });
  }

  // Post yang sama dikenali dari shortcode Instagram (/p/ dan /reel/ bisa berbeda), atau dari link-nya.
  function postKey(p) {
    const ig = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i.exec(p.url || '');
    return ig ? 'ig:' + ig[1] : p.url || `${p.date}|${(p.caption || '').slice(0, 40)}`;
  }

  // Nilai kosong di data baru tidak menimpa data lama.
  function mergePosts(posts, incoming) {
    const index = new Map(posts.map((p, i) => [postKey(p), i]));
    let added = 0;
    let updated = 0;
    for (const p of incoming) {
      const k = postKey(p);
      if (index.has(k)) {
        const next = { ...posts[index.get(k)] };
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

  const load = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (_) {
      return fallback;
    }
  };
  const store = (key, value) => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (_) {
      /* penyimpanan penuh atau mode privat: data tetap ada selama halaman terbuka */
    }
  };

  // ---------- tampilan ----------
  HT.register('post-analytics', {
    mount(el) {
      // Semua data dari Instagram live; sisa impor file lama dibuang.
      let posts = load(STORE_KEY, []).filter((p) => p.source === 'live');
      let hist = load(HIST_KEY, null) || { followers: [], snaps: {} };
      let topicText = (() => {
        try {
          return localStorage.getItem(TOPIC_KEY) ?? DEFAULT_TOPICS;
        } catch (_) {
          return DEFAULT_TOPICS;
        }
      })();
      let live = load(LIVE_KEY, null); // { key, lastAt, account }
      if (live && !posts.length) live.lastAt = null; // ambil ulang segera kalau riwayat kosong
      let liveBusy = false;
      const state = { range: 'all', sort: 'date', dir: -1, log: false, topic: null, rulesOpen: false };
      const charts = [];

      el.innerHTML = `
        <div class="stack">
          ${HTUtil.block({
            icon: 'chart',
            title: 'Instagram',
            actions: `<button class="btn btn-ghost btn-sm" data-ref="export" hidden>${icon('download', 16)} Unduh CSV</button>
                      <button class="btn btn-ghost btn-sm" data-ref="clear" hidden>${icon('trash', 16)} Hapus data</button>`,
            body: `<div data-ref="live"></div>
            <div data-ref="msg"></div>`,
          })}
          <div data-ref="dash"></div>
        </div>
        <dialog class="pulse-dialog" data-ref="dialog" aria-labelledby="pulse-dialog-title"></dialog>`;

      const $ = (r) => el.querySelector(`[data-ref="${r}"]`);
      const dash = $('dash');
      const dialog = $('dialog');

      const save = () => {
        store(STORE_KEY, posts);
        store(HIST_KEY, hist);
      };
      const saveLive = () => store(LIVE_KEY, live);

      function message(html, warn) {
        $('msg').innerHTML = html ? `<div class="notice ${warn ? 'notice-warn' : 'notice-ok'}">${html}</div>` : '';
      }

      // ---------- live ----------
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
            const incoming = (body.posts || []).map((p) => ({ ...p, source: 'live' }));
            const { added, updated } = mergePosts(posts, incoming);
            recordHistory(hist, incoming, body.account, body.fetchedAt);
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

      $('clear').addEventListener('click', () => {
        if (!confirm('Hapus semua data post dan riwayat yang tersimpan di browser ini?')) return;
        posts = [];
        hist = { followers: [], snaps: {} };
        save();
        message('');
        render();
      });

      $('export').addEventListener('click', () => {
        const rules = parseTopics(topicText);
        const cols = ['date', 'caption', 'url', 'type', ...METRICS, 'share_rate', 'save_rate', 'rewatch', 'topics'];
        const row = (p) => ({ ...p, share_rate: RATES.share.fn(p), save_rate: RATES.save.fn(p), rewatch: RATES.rewatch.fn(p), topics: topicsOf(p, rules).join('; ') });
        const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : v ?? '');
        const csv = [cols.join(','), ...posts.map(row).map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
        HTUtil.downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), `performa-post-${HTUtil.today()}.csv`);
      });

      // ---------- detail post ----------
      function openDetail(key) {
        const p = posts.find((q) => postKey(q) === key);
        if (!p) return;
        const list = visible();
        const med = median(list.map(score));
        const followers = live?.account?.followers;
        const rules = parseTopics(topicText);
        const snaps = hist.snaps[key];
        const peers = peersOf(posts, p);
        const ageH = p.date ? (Date.now() - Date.parse(p.date)) / HOUR : Infinity;
        const young = ageH < 48; // angka post baru masih bertambah

        // Post baru: views dibandingkan dengan post lain di umur yang sama (dari rekaman per jam), kalau ada.
        const lastSnap = snaps?.[snaps.length - 1];
        const snapAge = lastSnap && (Date.parse(lastSnap[0]) - Date.parse(p.date)) / HOUR;
        const viewsBandAtAge = young && lastSnap ? typicalBand(peers.map((q) => viewsAt(hist.snaps[postKey(q)], q, snapAge))) : null;

        const indicator = (v, band, show, note = '') => {
          const l = levelOf(v, band);
          if (!l) return { cls: '', html: `<span class="dim">${v == null ? '&nbsp;' : 'Belum cukup post pembanding'}</span>` };
          const L = LEVELS[l];
          return {
            l,
            cls: L.cls,
            html: `<span class="pd-level ${L.cls}">${icon(L.icon, 14)} ${L.label}</span><span class="dim">Biasanya ${show(band.lo)}–${show(band.hi)}${note}</span>`,
          };
        };
        const card = (label, value, ind, title = '') =>
          `<div class="stat pd-stat ${ind.cls}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="stat-label">${label}</span><span class="stat-val">${value}</span>${ind.html}</div>`;

        const levels = {};
        const metric = (label, f) => {
          const useAge = f === 'views' && viewsBandAtAge;
          const band = typicalBand(peers.map((q) => q[f]));
          let ind;
          if (useAge) ind = indicator(lastSnap[1], viewsBandAtAge, fmt, ` di umur ${Math.round(snapAge)} jam`);
          else if (young) ind = { cls: '', html: `<span class="dim">Masih bertambah${band ? ` · post lain ${fmt(band.lo)}–${fmt(band.hi)}` : ''}</span>` };
          else ind = indicator(p[f], band, fmt);
          levels[f] = ind.l;
          return card(label, fmt(p[f]), ind);
        };
        const rate = (key) => {
          const show = (v) => rateText(key, v);
          const ind = indicator(RATES[key].fn(p), typicalBand(peers.map(RATES[key].fn)), show);
          levels[key] = ind.l;
          return card(RATES[key].label, show(RATES[key].fn(p)), ind, RATES[key].hint);
        };
        const reachF = p.reach != null && followers ? p.reach / followers : null;
        const reachFInd = indicator(reachF, typicalBand(peers.map((q) => (q.reach != null && followers ? q.reach / followers : null))), times);
        const metricCards = ['Views:views', 'Reach:reach', 'Likes:likes', 'Komentar:comments', 'Shares:shares', 'Saves:saves'].map((s) => metric(...s.split(':'))).join('');
        const rateCards = ['er', 'share', 'save', 'rewatch'].map(rate).join('');
        const head = levels.views || levels.reach;
        const peerType = peers.length && peers.every((q) => q.type === p.type) && p.type ? `${p.type} ` : 'post ';
        const milestones = [1, 3, 24]
          .map((h) => ({ h, v: viewsAt(snaps, p, h), t: typicalAt(hist, posts, h, p) }))
          .filter((m) => m.v != null);

        dialog.innerHTML = `
          <div class="pd-head">
            <div>
              <p class="pd-kicker">${escapeHtml(p.type || 'Post')} · ${fdatetime(p.date)}</p>
              <h2 id="pulse-dialog-title">${escapeHtml(shortCaption(p, 80))}</h2>
            </div>
            <button class="icon-btn" data-close aria-label="Tutup">${icon('x', 20)}</button>
          </div>
          <div class="pd-body">
            <div class="pd-top">
              ${p.thumb ? `<img class="pd-thumb" src="${escapeHtml(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
              <div class="pd-caption">
                <p>${escapeHtml(p.caption || 'Tanpa caption')}</p>
                <div class="pd-tags">${topicsOf(p, rules).map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>
                ${p.url ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${icon('external', 16)} Buka di Instagram</a>` : ''}
              </div>
            </div>
            ${
              head
                ? `<div class="pd-summary ${LEVELS[head].cls}">${icon(LEVELS[head].icon, 18)}<div><strong>${LEVELS[head].short}</strong><span>${
                    levels.views ? 'Views' : 'Reach'
                  } dibanding ${peers.length} ${escapeHtml(peerType)}terakhir. "Biasanya" = kisaran tengah (25%–75%) post pembanding.</span></div></div>`
                : ''
            }
            ${
              young
                ? `<p class="notice notice-warn pd-note">Post ini baru berumur ${ageH < 1 ? `${Math.round(ageH * 60)} menit` : `${Math.round(ageH)} jam`}, jadi jumlahnya masih bertambah dan belum diberi label. Rasio (share rate, save rate, dll.) sudah bisa dibandingkan${
                    viewsBandAtAge ? ', dan views dibandingkan dengan post lain di umur yang sama' : ''
                  }.</p>`
                : ''
            }
            <h3>Angka</h3>
            <div class="stats pd-stats">${metricCards}</div>
            <h3>Rasio</h3>
            <div class="stats pd-stats">
              ${rateCards}
              ${card('Reach vs followers', times(reachF), reachFInd.cls ? reachFInd : { cls: '', html: `<span class="dim">${reachF == null ? '&nbsp;' : reachF > 1 ? 'menembus non-follower' : 'sebatas followers'}</span>` }, 'reach ÷ followers; di atas 1× berarti menjangkau non-follower')}
              ${card('vs median views', times(med ? score(p) / med : null), { cls: '', html: `<span class="dim">median ${fmt(med)}</span>` })}
            </div>
            <h3>Kecepatan awal</h3>
            ${
              snaps?.length >= 2
                ? `<div class="pulse-chart" data-ref="pd-chart"></div>
                   ${milestones.length ? `<div class="pd-milestones">${milestones.map((m) => `<span><strong>${m.h} jam:</strong> ${fmt(m.v)} views${m.t ? ` (${times(m.v / m.t)} biasanya)` : ''}</span>`).join('')}</div>` : ''}`
                : `<p class="help">Riwayat views per jam direkam untuk post yang diunggah setelah Pulse tersambung, selama ${TRACK_HOURS} jam pertama. Post ini belum punya cukup rekaman.</p>`
            }
          </div>`;
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.showModal();

        const host = dialog.querySelector('[data-ref="pd-chart"]');
        if (host) {
          const t0 = Date.parse(p.date);
          const pts = [{ x: 0, y: 0 }, ...snaps.map((s) => ({ x: (Date.parse(s[0]) - t0) / HOUR, y: s[1] }))].filter((q) => q.x >= 0);
          const maxH = pts[pts.length - 1].x;
          const cmp = [0, 0.5, 1, 2, 3, 6, 12, 24, 48, 72]
            .filter((h) => h <= maxH)
            .map((h) => ({ x: h, y: h === 0 ? 0 : typicalAt(hist, posts, h, p) }))
            .filter((q) => q.y != null);
          const hLabel = (h) => (h < 1 ? `${Math.round(h * 60)} mnt` : `${Math.round(h)} jam`);
          const geo = drawLine(host, pts, { height: 170, xLabel: hLabel, compare: cmp.length > 1 ? cmp : null, compareLabel: 'Views sejak diunggah' });
          bindLineHover(host, geo, (q) => `<strong>${fmt(q.y)} views</strong><span>${hLabel(q.x)} setelah diunggah</span>`);
          if (cmp.length > 1) host.insertAdjacentHTML('beforebegin', `<div class="pulse-legend"><span><i class="sw sw-line"></i>Post ini</span><span><i class="sw sw-med"></i>Biasanya (median post lain)</span></div>`);
        }
      }

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close(); // klik di luar panel
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest?.('[data-detail]');
        if (b) openDetail(b.dataset.detail);
      });

      // ---------- dashboard ----------
      function visible() {
        const since = state.range === 'all' ? 0 : Date.now() - Number(state.range) * 864e5;
        return posts.filter((p) => !since || (p.date && Date.parse(p.date) >= since)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }

      function sorted(list) {
        const val = {
          date: (p) => p.date || '',
          views: score,
          likes: (p) => p.likes ?? -1,
          comments: (p) => p.comments ?? -1,
          shares: (p) => p.shares ?? -1,
          saves: (p) => p.saves ?? -1,
          er: (p) => engagement(p) ?? -1,
        }[state.sort];
        return [...list].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * state.dir);
      }

      function render() {
        $('clear').hidden = $('export').hidden = !posts.length;
        charts.length = 0;
        if (!posts.length) {
          dash.innerHTML = '';
          return;
        }

        const list = visible();
        const med = median(list.map(score));
        const hasViews = list.some((p) => p.views != null);
        const best = list.reduce((b, p) => (!b || score(p) > score(b) ? p : b), null);
        const ers = list.map(engagement).filter((n) => n != null);
        const sum = (f) => list.reduce((t, p) => t + (p[f] || 0), 0);
        const followers = live?.account?.followers ?? hist.followers[hist.followers.length - 1]?.[1];
        const f7 = (() => {
          const since = Date.now() - 7 * 864e5;
          const first = hist.followers.find((f) => Date.parse(f[0]) >= since);
          return first && followers != null ? followers - first[1] : null;
        })();
        const rules = parseTopics(topicText);
        const topics = topicStats(list, rules, med);
        const tableList = state.topic ? list.filter((p) => topicsOf(p, rules).includes(state.topic)) : list;
        const shareMed = median(list.map(RATES.share.fn));

        const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
        const th = (key, label, num) =>
          `<th${num ? ' class="num"' : ''}><button data-sort="${key}" aria-sort="${state.sort === key ? (state.dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${
            state.sort === key ? (state.dir > 0 ? ' ↑' : ' ↓') : ''
          }</button></th>`;
        const followerChart = hist.followers.length >= 2 && Date.parse(hist.followers.at(-1)[0]) - Date.parse(hist.followers[0][0]) >= HOUR;
        const insightItems = list.length ? insights({ list, med, followers, hist, all: posts }) : [];

        dash.innerHTML = `
          <div class="stack">
            <div class="pulse-filters">
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
              <div class="stat"><span class="stat-label">Followers</span><span class="stat-val">${fmt(followers)}</span>${
                f7 != null && hist.followers.length > 1 ? `<span class="dim">${signed(f7)} dalam 7 hari</span>` : ''
              }</div>
              <div class="stat"><span class="stat-label">Post</span><span class="stat-val">${nf.format(list.length)}</span></div>
              <div class="stat"><span class="stat-label">Total ${hasViews ? 'views' : 'likes'}</span><span class="stat-val">${fmt(sum(hasViews ? 'views' : 'likes'))}</span></div>
              <div class="stat"><span class="stat-label">Median per post</span><span class="stat-val">${fmt(med)}</span></div>
              <div class="stat"><span class="stat-label">Rata-rata engagement</span><span class="stat-val">${pct(ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null)}</span></div>
              <div class="stat"><span class="stat-label">Median share rate</span><span class="stat-val">${pct(shareMed)}</span></div>
            </div>
            ${HTUtil.block({
              icon: 'gauge',
              title: `${hasViews ? 'Views' : 'Likes'} per post`,
              actions: `<label class="check pulse-log"><input type="checkbox" data-ref="log"${state.log ? ' checked' : ''}> Skala log</label>`,
              body: `<div class="pulse-legend"><span><i class="sw sw-top"></i>≥ ${OUTLIER}× median</span><span><i class="sw"></i>Post lain</span><span><i class="sw sw-med"></i>Median</span><span class="dim">Klik batang untuk detail</span></div>
                     <div class="pulse-chart" data-ref="chart"></div>`,
            })}
            ${HTUtil.block({
              icon: 'eye',
              title: 'Insight',
              body: insightItems.length
                ? `<ul class="pulse-insights">${insightItems.map((t) => `<li>${t}</li>`).join('')}</ul>`
                : '<p class="help">Insight muncul setelah ada cukup post untuk dibandingkan.</p>',
            })}
            ${HTUtil.block({
              icon: 'tag',
              title: 'Topik',
              actions: `<button class="btn btn-ghost btn-sm" data-ref="rules-toggle" aria-expanded="${state.rulesOpen}">${icon('sliders', 16)} Atur topik</button>`,
              body: `
                <div class="pulse-rules" data-ref="rules"${state.rulesOpen ? '' : ' hidden'}>
                  <label class="help" for="pulse-rules-text">Satu topik per baris: <code>Nama: kata kunci, kata kunci</code>. Dicocokkan ke caption dan hashtag; satu post bisa masuk beberapa topik.</label>
                  <textarea id="pulse-rules-text" data-ref="rules-text" rows="7" spellcheck="false">${escapeHtml(topicText)}</textarea>
                  <div class="action-group">
                    <button class="btn btn-primary btn-sm" data-ref="rules-save">Simpan</button>
                    <button class="btn btn-ghost btn-sm" data-ref="rules-reset">Kembalikan bawaan</button>
                  </div>
                </div>
                <div class="pulse-table-wrap"><table class="pulse-table pulse-topics">
                  <thead><tr><th>Topik</th><th class="num">Post</th><th class="num">Median views</th><th class="num">vs median</th><th class="num">Share rate</th><th class="num">Save rate</th><th>Saran</th></tr></thead>
                  <tbody>${topics
                    .map(
                      (t) => `<tr class="${state.topic === t.name ? 'is-active' : ''}">
                        <td><button class="linkish" data-topic="${escapeHtml(t.name)}" title="Tampilkan post di topik ini">${escapeHtml(t.name)}</button></td>
                        <td class="num">${t.n}</td>
                        <td class="num">${fmt(t.median)}</td>
                        <td class="num">${times(t.lift)}</td>
                        <td class="num">${pct(t.share)}</td>
                        <td class="num">${pct(t.save)}</td>
                        <td><span class="badge ${t.verdict.cls}">${t.verdict.label}</span></td>
                      </tr>`
                    )
                    .join('')}</tbody>
                </table></div>
                <p class="help pulse-note"><strong>Lanjutkan</strong>: median views ≥ 1,3× keseluruhan, atau setara tapi share rate ≥ 1,5× median. <strong>Kurangi</strong>: ≤ 0,7×. <strong>Uji lagi</strong>: di antaranya. Butuh minimal 2 post per topik.</p>`,
            })}
            ${
              followerChart
                ? HTUtil.block({
                    icon: 'users',
                    title: 'Pertumbuhan followers',
                    body: `<div class="pulse-chart" data-ref="followers-chart"></div>
                           <p class="help pulse-note">Direkam setiap kali Pulse mengambil data (maks. tiap 15 menit selama halaman terbuka).</p>`,
                  })
                : ''
            }
            ${HTUtil.block({
              icon: 'fileText',
              title: 'Semua post',
              ref: 'posts-block',
              actions: state.topic
                ? `<button class="btn btn-secondary btn-sm" data-topic="">${icon('x', 16)} Topik: ${escapeHtml(state.topic)}</button>`
                : '',
              body: `<div class="pulse-table-wrap"><table class="pulse-table">
                <thead><tr>${th('date', 'Tanggal')}<th>Post</th>${th('views', hasViews ? 'Views' : 'Likes', true)}${th('likes', 'Likes', true)}${th(
                  'comments',
                  'Komentar',
                  true
                )}${th('shares', 'Shares', true)}${th('saves', 'Saves', true)}${th('er', 'Engagement', true)}<th class="num">vs median</th><th><span class="sr-only">Detail</span></th></tr></thead>
                <tbody>${sorted(tableList)
                  .map((p) => {
                    const lift = med ? score(p) / med : null;
                    const badge = lift == null ? '–' : `<span class="badge${lift >= OUTLIER ? ' badge-good' : ''}">${times(lift)}</span>`;
                    const cap = escapeHtml(shortCaption(p));
                    const key = escapeHtml(postKey(p));
                    return `<tr>
                      <td class="nowrap">${fdate(p.date)}</td>
                      <td class="cap">${p.type ? `<span class="plat">${escapeHtml(p.type)}</span>` : ''}${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${cap}</a>` : cap}</td>
                      <td class="num">${fmt(score(p))}</td>
                      <td class="num">${fmt(p.likes)}</td>
                      <td class="num">${fmt(p.comments)}</td>
                      <td class="num">${fmt(p.shares)}</td>
                      <td class="num">${fmt(p.saves)}</td>
                      <td class="num">${pct(engagement(p))}</td>
                      <td class="num">${badge}</td>
                      <td><button class="icon-btn" data-detail="${key}" aria-label="Detail post" title="Detail">${icon('eye', 18)}</button></td>
                    </tr>`;
                  })
                  .join('')}</tbody></table></div>`,
            })}`
            }
          </div>`;

        dash.querySelector('[data-ref="range"]').addEventListener('change', (e) => {
          state.range = e.target.value;
          render();
        });
        if (!list.length) return;

        dash.querySelector('[data-ref="log"]').addEventListener('change', (e) => {
          state.log = e.target.checked;
          barChart();
        });
        dash.querySelectorAll('[data-sort]').forEach((b) =>
          b.addEventListener('click', () => {
            const k = b.dataset.sort;
            state.dir = state.sort === k ? -state.dir : -1;
            state.sort = k;
            render();
          })
        );
        dash.querySelectorAll('[data-topic]').forEach((b) =>
          b.addEventListener('click', () => {
            state.topic = b.dataset.topic && state.topic !== b.dataset.topic ? b.dataset.topic : null;
            render();
            if (state.topic) $('posts-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          })
        );
        $('rules-toggle').addEventListener('click', () => {
          state.rulesOpen = !state.rulesOpen;
          $('rules').hidden = !state.rulesOpen;
          $('rules-toggle').setAttribute('aria-expanded', state.rulesOpen);
        });
        $('rules-save').addEventListener('click', () => {
          topicText = $('rules-text').value.trim() || DEFAULT_TOPICS;
          store(TOPIC_KEY, topicText);
          state.topic = null;
          render();
        });
        $('rules-reset').addEventListener('click', () => {
          topicText = DEFAULT_TOPICS;
          store(TOPIC_KEY, null);
          state.topic = null;
          render();
        });

        // Grafik views per post, dengan tooltip dan klik untuk detail.
        const host = $('chart');
        function barChart() {
          drawBars(host, list, med, state.log);
        }
        charts.push(barChart);
        barChart();
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
          tip.innerHTML = `<strong>${fmt(score(p))} ${hasViews ? 'views' : 'likes'}</strong><span>${fdate(p.date)}${p.type ? ` · ${escapeHtml(p.type)}` : ''}</span><span>${escapeHtml(
            shortCaption(p, 70)
          )}</span><span>${fmt(p.likes)} likes · ${fmt(p.shares)} shares · ${fmt(p.saves)} saves</span>`;
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
          if (hit) openDetail(postKey(list[+hit.dataset.i]));
        });

        const fHost = $('followers-chart');
        if (fHost) {
          const pts = hist.followers.map(([t, n]) => ({ x: Date.parse(t), y: n }));
          const fChart = () => {
            const geo = drawLine(fHost, pts, { xLabel: (t) => fdate(new Date(t).toISOString()), compareLabel: 'Pertumbuhan followers' });
            bindLineHover(fHost, geo, (q) => `<strong>${nf.format(q.y)} followers</strong><span>${fdatetime(new Date(q.x).toISOString())}</span>`);
          };
          charts.push(fChart);
          fChart();
        }
      }

      // Gambar ulang grafik saat lebar berubah.
      let width = dash.clientWidth;
      const resize = new ResizeObserver(() => {
        if (Math.abs(dash.clientWidth - width) > 4) {
          width = dash.clientWidth;
          charts.forEach((c) => c());
        }
      });
      resize.observe(dash);

      render();
      renderLive();
      tick();

      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', tick);
        resize.disconnect();
        if (dialog.open) dialog.close();
      };
    },
  });
})();
