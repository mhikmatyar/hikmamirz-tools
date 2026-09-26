/**
 * Kerangka bersama untuk tool yang memproses banyak gambar sekaligus:
 * dropzone, antrean, daftar file, ringkasan, dan download ZIP.
 * Tool cukup menyediakan panel pengaturan dan fungsi process().
 *
 *   HTImg.mountBatch(root, {
 *     title, intro, settingsHtml,
 *     bindSettings($, changed),   // pasang event pada kontrol pengaturan
 *     getOptions(),               // opsi saat ini, dipakai untuk process()
 *     process(file, opts),        // -> { blob, width, height, srcWidth, srcHeight }
 *     outputName(file, result),
 *     zipPrefix, warning,
 *   })
 */
window.HTImg = (function () {
  const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|webp|avif|svg|ico|tiff?)$/i;

  const { formatBytes, escapeHtml } = HTUtil;

  const encodeSupport = {};
  function canEncode(mime) {
    if (!(mime in encodeSupport)) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      encodeSupport[mime] = c.toDataURL(mime).startsWith('data:' + mime);
    }
    return encodeSupport[mime];
  }

  async function decode(file) {
    // createImageBitmap cepat dan menghormati orientasi EXIF; SVG perlu jalur <img>.
    if (file.type !== 'image/svg+xml') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        /* lanjut ke fallback */
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode().catch(() => {
        throw new Error('File tidak bisa dibaca sebagai gambar.');
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const TOO_BIG = 'Resolusi terlalu besar untuk diproses browser. Coba perkecil ukuran.';

  /**
   * Decode file, skala ke ukuran yang dihitung targetSize(sw, sh), lalu encode.
   * targetSize mengembalikan { width, height }.
   */
  async function render(file, { targetSize, mime, quality, background }) {
    const src = await decode(file);
    const sw = src.naturalWidth || src.width;
    const sh = src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error('Gambar tidak bisa dibaca.');

    const { width: w, height: h } = targetSize(sw, sh);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(TOO_BIG);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    if (typeof src.close === 'function') src.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality / 100));
    canvas.width = canvas.height = 0; // bebaskan memori canvas lebih cepat

    if (!blob) throw new Error(TOO_BIG);
    if (blob.type !== mime) throw new Error('Browser ini tidak bisa membuat format ' + mime.split('/')[1].toUpperCase() + '.');
    return { blob, width: w, height: h, srcWidth: sw, srcHeight: sh };
  }

  /** Skala proporsional yang tidak pernah memperbesar gambar. */
  function fit(sw, sh, scale) {
    const s = Math.min(1, scale);
    return { width: Math.max(1, Math.round(sw * s)), height: Math.max(1, Math.round(sh * s)) };
  }

  function mountBatch(root, tool) {
    const state = { items: [], busy: false, nextId: 1 };

    root.innerHTML = `
      <div class="tool">
        <header class="tool-head">
          <h1>${tool.title}</h1>
          <p>${tool.intro}</p>
        </header>

        ${tool.warning ? `<div class="notice notice-warn">${tool.warning}</div>` : ''}

        <div class="tool-grid">
          <section class="panel settings" aria-labelledby="settings-title">
            <h2 id="settings-title" class="panel-title">Pengaturan</h2>
            ${tool.settingsHtml}
            <button class="btn btn-secondary" data-ref="reconvert" hidden>Terapkan ke semua gambar</button>
          </section>

          <section class="workspace">
            <label class="dropzone" data-ref="dropzone">
              <input type="file" accept="image/*,.svg,.avif" multiple data-ref="input" hidden>
              ${HTUtil.ICON_UPLOAD}
              <span class="dz-title">Tarik gambar ke sini atau <u>pilih file</u></span>
              <span class="dz-sub">Bisa juga tempel dengan Ctrl+V. Bebas berapa pun jumlahnya.</span>
            </label>

            <div class="summary" data-ref="summary" hidden>
              <div class="stats">
                <div><span class="stat-label">Gambar</span><span class="stat-val mono" data-ref="sCount">0</span></div>
                <div><span class="stat-label">Ukuran awal</span><span class="stat-val mono" data-ref="sBefore">0</span></div>
                <div><span class="stat-label">Ukuran hasil</span><span class="stat-val mono" data-ref="sAfter">0</span></div>
                <div><span class="stat-label">Hemat</span><span class="stat-val mono" data-ref="sSaved">0</span></div>
              </div>
              <div class="summary-actions">
                <button class="btn btn-ghost" data-ref="clear">Hapus semua</button>
                <button class="btn btn-primary" data-ref="zip" disabled>Download semua (ZIP)</button>
              </div>
            </div>

            <ul class="file-list" data-ref="list"></ul>
          </section>
        </div>
      </div>`;

    const $ = {};
    root.querySelectorAll('[data-ref]').forEach((el) => ($[el.dataset.ref] = el));

    const optionsKey = () => JSON.stringify(tool.getOptions());

    function settingsChanged() {
      const key = optionsKey();
      $.reconvert.hidden = !state.items.some((it) => it.status === 'done' && it.optionsKey !== key);
    }
    tool.bindSettings($, settingsChanged);

    $.reconvert.addEventListener('click', () => {
      state.items.forEach((it) => {
        if (it.status === 'done' || it.status === 'error') setPending(it);
      });
      $.reconvert.hidden = true;
      processQueue();
    });

    // ---------- input file ----------
    function addFiles(fileList) {
      const files = fileList.filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
      for (const file of files) {
        const item = {
          id: state.nextId++,
          file,
          status: 'pending',
          result: null,
          error: null,
          srcUrl: URL.createObjectURL(file),
          outUrl: null,
          outName: null,
          optionsKey: null,
          el: document.createElement('li'),
        };
        item.el.className = 'file';
        state.items.push(item);
        $.list.appendChild(item.el);
        renderItem(item);
      }
      if (!files.length) return;
      renderSummary();
      processQueue();
    }

    const unbindInput = HTUtil.bindFileInput($.dropzone, $.input, addFiles);

    // ---------- antrean ----------
    // Diproses satu per satu supaya memori tetap aman walau ribuan file.
    async function processQueue() {
      if (state.busy) return;
      state.busy = true;
      let item;
      while ((item = state.items.find((it) => it.status === 'pending'))) {
        const opts = tool.getOptions();
        const key = JSON.stringify(opts);
        item.status = 'working';
        renderItem(item);
        try {
          const res = await tool.process(item.file, opts);
          if (item.status !== 'working') continue; // sudah dihapus
          item.result = res;
          item.outUrl = URL.createObjectURL(res.blob);
          item.outName = tool.outputName(item.file, res);
          item.optionsKey = key;
          item.status = 'done';
        } catch (err) {
          if (item.status !== 'working') continue;
          item.status = 'error';
          item.error = err?.message || 'Gagal memproses gambar.';
        }
        renderItem(item);
        renderSummary();
        settingsChanged();
      }
      state.busy = false;
      renderSummary();
    }

    function setPending(item) {
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      item.outUrl = null;
      item.result = null;
      item.error = null;
      item.status = 'pending';
      renderItem(item);
    }

    function removeItem(item) {
      item.status = 'removed';
      URL.revokeObjectURL(item.srcUrl);
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      item.el.remove();
      state.items = state.items.filter((it) => it !== item);
      renderSummary();
      settingsChanged();
    }

    $.clear.addEventListener('click', () => [...state.items].forEach(removeItem));

    $.list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const item = state.items.find((it) => it.id === +btn.closest('.file').dataset.id);
      if (!item) return;
      if (btn.dataset.action === 'remove') removeItem(item);
      if (btn.dataset.action === 'retry') {
        setPending(item);
        processQueue();
      }
    });

    $.zip.addEventListener('click', async () => {
      const done = state.items.filter((it) => it.status === 'done');
      if (!done.length) return;
      const used = new Map();
      const entries = done.map((it) => {
        let name = it.outName;
        const lower = name.toLowerCase();
        const n = used.get(lower) || 0;
        used.set(lower, n + 1);
        if (n) name = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
        return { name, blob: it.result.blob };
      });
      const label = $.zip.textContent;
      $.zip.disabled = true;
      $.zip.textContent = 'Menyiapkan ZIP…';
      try {
        HTUtil.downloadBlob(await HTZip.create(entries), `${tool.zipPrefix}-${HTUtil.today()}.zip`);
      } finally {
        $.zip.textContent = label;
        renderSummary();
      }
    });

    // ---------- render ----------
    function renderItem(item) {
      const { file, result } = item;
      item.el.dataset.id = item.id;
      item.el.dataset.status = item.status;

      let meta = `<span class="mono">${formatBytes(file.size)}</span>`;
      let badge = '';
      let actions = `<button class="icon-btn" data-action="remove" aria-label="Hapus ${escapeHtml(file.name)}" title="Hapus">${HTUtil.ICON_REMOVE}</button>`;

      if (item.status === 'pending') {
        badge = '<span class="badge">Menunggu</span>';
      } else if (item.status === 'working') {
        badge = '<span class="badge badge-busy"><span class="spinner" aria-hidden="true"></span>Memproses</span>';
      } else if (item.status === 'error') {
        badge = '<span class="badge badge-error">Gagal</span>';
        meta += `<span class="err">${escapeHtml(item.error)}</span>`;
        actions = `<button class="btn btn-ghost btn-sm" data-action="retry">Coba lagi</button>` + actions;
      } else if (item.status === 'done') {
        const diff = 1 - result.blob.size / file.size;
        const pct = Math.round(Math.abs(diff) * 100);
        badge =
          diff >= 0
            ? `<span class="badge badge-good">−${pct}%</span>`
            : `<span class="badge badge-warn" title="Hasil lebih besar dari file asli.">+${pct}%</span>`;
        const resized = result.width !== result.srcWidth || result.height !== result.srcHeight;
        meta = `<span class="mono">${formatBytes(file.size)} → <strong>${formatBytes(result.blob.size)}</strong></span>
          <span class="mono dim">${resized ? `${result.srcWidth}×${result.srcHeight} → ` : ''}${result.width}×${result.height}</span>`;
        actions =
          `<a class="btn btn-secondary btn-sm" href="${item.outUrl}" download="${escapeHtml(item.outName)}">Download</a>` + actions;
      }

      item.el.innerHTML = `
        <a class="thumb"${item.outUrl ? ` href="${item.outUrl}" target="_blank" rel="noopener" title="Lihat hasil"` : ''}>
          <img src="${item.outUrl || item.srcUrl}" alt="" loading="lazy" decoding="async">
        </a>
        <div class="file-info">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-meta">${meta}</div>
        </div>
        <div class="file-badge">${badge}</div>
        <div class="file-actions">${actions}</div>`;
    }

    function renderSummary() {
      const items = state.items;
      $.summary.hidden = items.length === 0;
      const done = items.filter((it) => it.status === 'done');
      const before = done.reduce((s, it) => s + it.file.size, 0);
      const after = done.reduce((s, it) => s + it.result.blob.size, 0);
      const pending = items.filter((it) => it.status === 'pending' || it.status === 'working').length;

      $.sCount.textContent = pending ? `${done.length}/${items.length}` : `${items.length}`;
      $.sBefore.textContent = formatBytes(before);
      $.sAfter.textContent = formatBytes(after);
      const saved = before - after;
      $.sSaved.textContent = before ? `${saved >= 0 ? '' : '−'}${formatBytes(Math.abs(saved))} (${Math.round((saved / before) * 100)}%)` : '—';
      $.zip.disabled = done.length === 0 || pending > 0;
    }

    return function cleanup() {
      unbindInput();
      state.items.forEach((it) => {
        it.status = 'removed';
        URL.revokeObjectURL(it.srcUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      });
    };
  }

  return { canEncode, decode, render, fit, mountBatch };
})();
