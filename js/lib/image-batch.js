/**
 * Kerangka bersama untuk tool yang memproses banyak gambar sekaligus:
 * pengaturan, dropzone, antrean paralel (Web Worker), daftar file, dan ZIP.
 *
 *   HTImg.mountBatch(root, {
 *     settingsHtml,
 *     bindSettings($, changed),   // pasang event pada kontrol pengaturan
 *     getOptions(),               // opsi saat ini (harus bisa di-JSON-kan)
 *     encode(file, opts),         // -> { mime, quality, background, resize: { mode, value } }
 *     outputName(file, result),
 *     zipPrefix, warning,
 *   })
 */
window.HTImg = (function () {
  const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|webp|avif|svg|ico|tiff?)$/i;
  const { formatBytes, escapeHtml, icon } = HTUtil;

  const encodeSupport = {};
  function canEncode(mime) {
    if (!(mime in encodeSupport)) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      encodeSupport[mime] = c.toDataURL(mime).startsWith('data:' + mime);
    }
    return encodeSupport[mime];
  }

  // ---------- jalur main thread (cadangan) ----------
  async function decodeOnPage(file) {
    if (file.type !== 'image/svg+xml') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        /* lanjut ke <img> */
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

  async function processOnPage(file, options) {
    const src = await decodeOnPage(file);
    const sw = src.naturalWidth || src.width;
    const sh = src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error('Gambar tidak bisa dibaca.');
    try {
      return await HTImageCore.process(src, sw, sh, options);
    } finally {
      if (typeof src.close === 'function') src.close();
    }
  }

  // ---------- worker pool ----------
  // Beberapa gambar diproses bersamaan di thread terpisah supaya cepat dan halaman tetap responsif.
  const pool = (function () {
    const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    let broken = typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined';
    const idle = [];
    const all = [];
    const tasks = new Map();
    let seq = 0;

    function spawn() {
      const w = new Worker('js/lib/image-worker.js');
      w.onmessage = (e) => {
        const task = tasks.get(e.data.id);
        tasks.delete(e.data.id);
        w.task = null;
        idle.push(w);
        task?.resolve(e.data);
      };
      w.onerror = (e) => {
        e.preventDefault();
        broken = true; // mis. dibuka lewat file:// — pakai jalur halaman saja
        const task = w.task && tasks.get(w.task);
        tasks.delete(w.task);
        w.terminate();
        all.splice(all.indexOf(w), 1);
        task?.resolve({ fallback: true });
      };
      all.push(w);
      return w;
    }

    return {
      get concurrency() {
        return broken ? 1 : size;
      },
      run(file, options) {
        if (broken) return Promise.resolve({ fallback: true });
        let w;
        try {
          w = idle.pop() || spawn();
        } catch (_) {
          broken = true;
          return Promise.resolve({ fallback: true });
        }
        const id = ++seq;
        w.task = id;
        return new Promise((resolve) => {
          tasks.set(id, { resolve });
          w.postMessage({ id, file, options });
        });
      },
    };
  })();

  async function processImage(file, options) {
    const res = await pool.run(file, options);
    if (res.error) throw new Error(res.error);
    if (res.result) return res.result;
    return processOnPage(file, options);
  }

  // ---------- UI ----------
  function mountBatch(root, tool) {
    const state = { items: [], active: 0, nextId: 1 };

    root.innerHTML = `
      <div class="stack">
        ${tool.warning ? `<div class="notice notice-warn">${tool.warning}</div>` : ''}

        ${HTUtil.block({
          icon: 'sliders',
          title: 'Pengaturan',
          actions: `<button class="btn btn-primary btn-sm" data-ref="reconvert" hidden>${icon('retry', 16)} Terapkan ke semua</button>`,
          body: `<div class="fields">${tool.settingsHtml}</div>`,
        })}

        ${HTUtil.block({
          icon: 'upload',
          title: 'Upload',
          body: HTUtil.dropzone({
            accept: 'image/*,.svg,.avif',
            title: 'Tarik gambar ke sini atau pilih file',
            sub: 'Bisa juga tempel dengan Ctrl+V. Bebas berapa pun jumlah dan ukurannya.',
          }),
        })}

        ${HTUtil.block({
          icon: 'layers',
          title: 'File',
          ref: 'filesBlock',
          hidden: true,
          actions: `
            <button class="btn btn-ghost btn-sm" data-ref="clear">${icon('trash', 16)} Hapus semua</button>
            <button class="btn btn-primary btn-sm" data-ref="zip" disabled>${icon('download', 16)} Download ZIP</button>`,
          body: `
            <div class="stats">
              <div class="stat"><span class="stat-label">Gambar</span><span class="stat-val" data-ref="sCount">0</span></div>
              <div class="stat"><span class="stat-label">Ukuran awal</span><span class="stat-val" data-ref="sBefore">0</span></div>
              <div class="stat"><span class="stat-label">Ukuran hasil</span><span class="stat-val" data-ref="sAfter">0</span></div>
              <div class="stat"><span class="stat-label">Hemat</span><span class="stat-val" data-ref="sSaved">—</span></div>
            </div>
            <ul class="file-list" data-ref="list"></ul>`,
        })}
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
      pump();
    });

    // ---------- input file ----------
    function addFiles(list) {
      const files = list.filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
      if (!files.length) return;
      const frag = document.createDocumentFragment();
      for (const file of files) {
        const item = {
          id: state.nextId++,
          file,
          status: 'pending',
          result: null,
          error: null,
          outUrl: null,
          thumbUrl: null,
          outName: null,
          optionsKey: null,
          el: document.createElement('li'),
        };
        item.el.className = 'file';
        state.items.push(item);
        frag.appendChild(item.el);
        renderItem(item);
      }
      $.list.appendChild(frag);
      renderSummary();
      pump();
    }

    const unbindInput = HTUtil.bindFileInput($.dropzone, $.input, addFiles);

    // ---------- antrean ----------
    function pump() {
      while (state.active < pool.concurrency) {
        const item = state.items.find((it) => it.status === 'pending');
        if (!item) break;
        state.active++;
        run(item).finally(() => {
          state.active--;
          pump();
          renderSummary();
        });
      }
    }

    async function run(item) {
      const opts = tool.getOptions();
      item.status = 'working';
      renderItem(item);
      try {
        const res = await processImage(item.file, tool.encode(item.file, opts));
        if (item.status !== 'working') return; // dihapus saat diproses
        item.result = res;
        item.outUrl = URL.createObjectURL(res.blob);
        item.thumbUrl = res.thumb ? URL.createObjectURL(res.thumb) : item.outUrl;
        item.outName = tool.outputName(item.file, res);
        item.optionsKey = JSON.stringify(opts);
        item.status = 'done';
      } catch (err) {
        if (item.status !== 'working') return;
        item.status = 'error';
        item.error = err?.message || 'Gagal memproses gambar.';
      }
      renderItem(item);
      settingsChanged();
    }

    function revoke(item) {
      if (item.thumbUrl && item.thumbUrl !== item.outUrl) URL.revokeObjectURL(item.thumbUrl);
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      item.outUrl = item.thumbUrl = null;
    }

    function setPending(item) {
      revoke(item);
      item.result = null;
      item.error = null;
      item.status = 'pending';
      renderItem(item);
    }

    function removeItem(item) {
      item.status = 'removed';
      revoke(item);
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
        pump();
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
      $.zip.disabled = true;
      try {
        HTUtil.downloadBlob(await HTUtil.makeZip(entries), `${tool.zipPrefix}-${HTUtil.today()}.zip`);
      } finally {
        renderSummary();
      }
    });

    // ---------- render ----------
    function renderItem(item) {
      const { file, result } = item;
      item.el.dataset.id = item.id;
      item.el.dataset.status = item.status;

      let meta = `<span>${formatBytes(file.size)}</span>`;
      let badge = '';
      let actions = `<button class="icon-btn" data-action="remove" aria-label="Hapus ${escapeHtml(file.name)}" title="Hapus">${icon('x', 18)}</button>`;

      if (item.status === 'pending') {
        badge = '<span class="badge">Menunggu</span>';
      } else if (item.status === 'working') {
        badge = '<span class="badge badge-busy"><span class="spinner" aria-hidden="true"></span>Memproses</span>';
      } else if (item.status === 'error') {
        badge = '<span class="badge badge-error">Gagal</span>';
        meta += `<span class="err">${escapeHtml(item.error)}</span>`;
        actions = `<button class="icon-btn" data-action="retry" aria-label="Coba lagi" title="Coba lagi">${icon('retry', 18)}</button>` + actions;
      } else if (item.status === 'done') {
        const diff = 1 - result.blob.size / file.size;
        const pct = Math.round(Math.abs(diff) * 100);
        badge =
          diff >= 0
            ? `<span class="badge badge-good">−${pct}%</span>`
            : `<span class="badge badge-warn" title="Hasil lebih besar dari file asli.">+${pct}%</span>`;
        const resized = result.width !== result.srcWidth || result.height !== result.srcHeight;
        meta = `<span>${formatBytes(file.size)} → <strong>${formatBytes(result.blob.size)}</strong></span>
          <span class="dim">${resized ? `${result.srcWidth}×${result.srcHeight} → ` : ''}${result.width}×${result.height}</span>`;
        actions =
          `<a class="icon-btn" href="${item.outUrl}" download="${escapeHtml(item.outName)}" aria-label="Download ${escapeHtml(item.outName)}" title="Download">${icon('download', 18)}</a>` +
          actions;
      }

      const ext = (HTUtil.extName(file.name) || 'img').slice(0, 4).toUpperCase();
      const thumb = item.thumbUrl
        ? `<a class="thumb" href="${item.outUrl}" target="_blank" rel="noopener" title="Lihat hasil"><img src="${item.thumbUrl}" alt="" decoding="async"></a>`
        : `<span class="thumb thumb-empty" aria-hidden="true">${ext}</span>`;

      item.el.innerHTML = `
        ${thumb}
        <div class="file-info">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-meta">${meta}</div>
        </div>
        <div class="file-badge">${badge}</div>
        <div class="file-actions">${actions}</div>`;
    }

    function renderSummary() {
      const items = state.items;
      $.filesBlock.hidden = items.length === 0;
      let before = 0;
      let after = 0;
      let done = 0;
      let pending = 0;
      for (const it of items) {
        if (it.status === 'done') {
          done++;
          before += it.file.size;
          after += it.result.blob.size;
        } else if (it.status === 'pending' || it.status === 'working') pending++;
      }
      $.sCount.textContent = pending ? `${done}/${items.length}` : `${items.length}`;
      $.sBefore.textContent = formatBytes(before);
      $.sAfter.textContent = formatBytes(after);
      const saved = before - after;
      $.sSaved.textContent = before ? `${saved >= 0 ? '' : '−'}${formatBytes(Math.abs(saved))} (${Math.round((saved / before) * 100)}%)` : '—';
      $.zip.disabled = done === 0 || pending > 0;
    }

    return function cleanup() {
      unbindInput();
      state.items.forEach((it) => {
        it.status = 'removed';
        revoke(it);
      });
    };
  }

  return { canEncode, mountBatch };
})();
