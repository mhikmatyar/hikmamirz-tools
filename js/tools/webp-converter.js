(function () {
  const PRESETS = [
    { id: 'high', label: 'Tinggi', hint: 'Kualitas 90', quality: 90 },
    { id: 'balanced', label: 'Seimbang', hint: 'Kualitas 80', quality: 80 },
    { id: 'small', label: 'Kecil', hint: 'Kualitas 65', quality: 65 },
    { id: 'tiny', label: 'Sangat kecil', hint: 'Kualitas 45', quality: 45 },
    { id: 'custom', label: 'Kustom', hint: 'Atur sendiri', quality: null },
  ];

  const SIZES = [
    { value: 0, label: 'Ukuran asli' },
    { value: 3840, label: 'Maks 3840 px (4K)' },
    { value: 2560, label: 'Maks 2560 px' },
    { value: 1920, label: 'Maks 1920 px (Full HD)' },
    { value: 1280, label: 'Maks 1280 px' },
    { value: 800, label: 'Maks 800 px' },
    { value: -1, label: 'Kustom…' },
  ];

  const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|webp|avif|svg|ico|tiff?)$/i;

  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-4.5-4.5L7 20"/></svg>';

  // ---------- util ----------
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do {
      n /= 1024;
      i++;
    } while (n >= 1024 && i < units.length - 1);
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + ' ' + units[i];
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function toWebpName(name) {
    return name.replace(/\.[^./\\]+$/, '') + '.webp';
  }

  function supportsWebpEncode() {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
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

  async function convert(file, { quality, maxSide }) {
    const src = await decode(file);
    const sw = src.naturalWidth || src.width;
    const sh = src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error('Gambar tidak bisa dibaca.');

    const scale = maxSide > 0 ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Resolusi terlalu besar untuk diproses browser. Coba perkecil ukuran.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    if (typeof src.close === 'function') src.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality / 100));
    canvas.width = canvas.height = 0; // bebaskan memori canvas lebih cepat

    if (!blob) throw new Error('Resolusi terlalu besar untuk diproses browser. Coba perkecil ukuran.');
    if (blob.type !== 'image/webp') throw new Error('Browser ini tidak bisa membuat WebP.');
    return { blob, width: w, height: h, srcWidth: sw, srcHeight: sh };
  }

  // ---------- tool ----------
  function mount(root) {
    const state = {
      items: [],
      preset: 'balanced',
      quality: 80,
      sizeChoice: 0,
      customSide: 1600,
      busy: false,
      nextId: 1,
    };

    root.innerHTML = `
      <div class="tool">
        <header class="tool-head">
          <h1>Image to WebP</h1>
          <p>Ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP dan kompres ukurannya. Tidak ada batas jumlah atau ukuran file.</p>
        </header>

        <div class="notice notice-warn" data-ref="unsupported" hidden>
          Browser ini tidak bisa membuat file WebP. Buka tool ini di Chrome, Edge, atau Firefox.
        </div>

        <div class="tool-grid">
          <section class="panel settings" aria-labelledby="settings-title">
            <h2 id="settings-title" class="panel-title">Pengaturan</h2>

            <fieldset class="field">
              <legend>Tingkat kompresi</legend>
              <div class="segmented" role="radiogroup" data-ref="presets">
                ${PRESETS.map(
                  (p) => `
                  <label class="seg">
                    <input type="radio" name="preset" value="${p.id}"${p.id === state.preset ? ' checked' : ''}>
                    <span><strong>${p.label}</strong><small>${p.hint}</small></span>
                  </label>`
                ).join('')}
              </div>
            </fieldset>

            <div class="field">
              <div class="field-row">
                <label for="quality">Kualitas</label>
                <output data-ref="qualityOut" for="quality" class="mono">${state.quality}</output>
              </div>
              <input type="range" id="quality" min="1" max="100" step="1" value="${state.quality}" data-ref="quality">
              <div class="range-scale"><span>File lebih kecil</span><span>Kualitas lebih baik</span></div>
            </div>

            <div class="field">
              <label for="size">Ukuran gambar</label>
              <select id="size" data-ref="size">
                ${SIZES.map((s) => `<option value="${s.value}">${s.label}</option>`).join('')}
              </select>
              <div class="custom-size" data-ref="customWrap" hidden>
                <input type="number" id="custom-side" min="16" max="32768" step="1" value="${state.customSide}" data-ref="customSide" aria-label="Sisi terpanjang dalam piksel">
                <span>px, sisi terpanjang</span>
              </div>
              <p class="help">Gambar yang lebih kecil dari batas ini tidak diperbesar.</p>
            </div>

            <p class="help">Metadata EXIF, seperti lokasi GPS dan info kamera, otomatis dihapus dari hasil.</p>

            <button class="btn btn-secondary" data-ref="reconvert" hidden>Terapkan ke semua gambar</button>
          </section>

          <section class="workspace">
            <label class="dropzone" data-ref="dropzone">
              <input type="file" accept="image/*,.svg,.avif" multiple data-ref="input" hidden>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
              <span class="dz-title">Tarik gambar ke sini atau <u>pilih file</u></span>
              <span class="dz-sub">Bisa juga tempel dengan Ctrl+V. Bebas berapa pun jumlahnya.</span>
            </label>

            <div class="summary" data-ref="summary" hidden>
              <div class="stats">
                <div><span class="stat-label">Gambar</span><span class="stat-val mono" data-ref="sCount">0</span></div>
                <div><span class="stat-label">Ukuran awal</span><span class="stat-val mono" data-ref="sBefore">0</span></div>
                <div><span class="stat-label">Ukuran WebP</span><span class="stat-val mono" data-ref="sAfter">0</span></div>
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

    if (!supportsWebpEncode()) {
      $.unsupported.hidden = false;
    }

    // ---------- settings ----------
    function currentOptions() {
      const maxSide = state.sizeChoice === -1 ? Math.max(16, state.customSide | 0) : state.sizeChoice;
      return { quality: state.quality, maxSide };
    }
    const optionsKey = (o) => `${o.quality}|${o.maxSide}`;

    function onSettingsChange() {
      const key = optionsKey(currentOptions());
      const stale = state.items.some((it) => it.status === 'done' && it.optionsKey !== key);
      $.reconvert.hidden = !stale;
    }

    $.presets.addEventListener('change', (e) => {
      state.preset = e.target.value;
      const p = PRESETS.find((x) => x.id === state.preset);
      if (p.quality != null) {
        state.quality = p.quality;
        $.quality.value = p.quality;
        $.qualityOut.value = p.quality;
      }
      onSettingsChange();
    });

    $.quality.addEventListener('input', () => {
      state.quality = +$.quality.value;
      $.qualityOut.value = state.quality;
      const match = PRESETS.find((p) => p.quality === state.quality);
      state.preset = match ? match.id : 'custom';
      $.presets.querySelector(`input[value="${state.preset}"]`).checked = true;
      onSettingsChange();
    });

    $.size.addEventListener('change', () => {
      state.sizeChoice = +$.size.value;
      $.customWrap.hidden = state.sizeChoice !== -1;
      if (state.sizeChoice === -1) $.customSide.focus();
      onSettingsChange();
    });

    $.customSide.addEventListener('input', () => {
      state.customSide = +$.customSide.value || 0;
      onSettingsChange();
    });

    $.reconvert.addEventListener('click', () => {
      state.items.forEach((it) => {
        if (it.status === 'done' || it.status === 'error') setPending(it);
      });
      $.reconvert.hidden = true;
      processQueue();
    });

    // ---------- input file ----------
    function addFiles(fileList) {
      const files = [...fileList].filter((f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
      if (!files.length) return;
      for (const file of files) {
        const item = {
          id: state.nextId++,
          file,
          status: 'pending',
          result: null,
          error: null,
          srcUrl: URL.createObjectURL(file),
          outUrl: null,
          optionsKey: null,
          el: null,
        };
        item.el = document.createElement('li');
        item.el.className = 'file';
        state.items.push(item);
        $.list.appendChild(item.el);
        renderItem(item);
      }
      renderSummary();
      processQueue();
    }

    $.input.addEventListener('change', () => {
      addFiles($.input.files);
      $.input.value = '';
    });

    ['dragenter', 'dragover'].forEach((ev) =>
      $.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        $.dropzone.classList.add('is-over');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      $.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        $.dropzone.classList.remove('is-over');
      })
    );
    $.dropzone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

    function onPaste(e) {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    }
    document.addEventListener('paste', onPaste);

    // ---------- antrean ----------
    // Diproses satu per satu supaya memori tetap aman walau ribuan file.
    async function processQueue() {
      if (state.busy) return;
      state.busy = true;
      let item;
      while ((item = state.items.find((it) => it.status === 'pending'))) {
        const opts = currentOptions();
        item.status = 'working';
        renderItem(item);
        try {
          const res = await convert(item.file, opts);
          if (item.status !== 'working') continue; // sudah dihapus
          item.result = res;
          item.outUrl = URL.createObjectURL(res.blob);
          item.optionsKey = optionsKey(opts);
          item.status = 'done';
        } catch (err) {
          if (item.status !== 'working') continue;
          item.status = 'error';
          item.error = err?.message || 'Gagal mengonversi gambar.';
        }
        renderItem(item);
        renderSummary();
        onSettingsChange();
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
      onSettingsChange();
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
        let name = toWebpName(it.file.name);
        const n = used.get(name.toLowerCase()) || 0;
        used.set(name.toLowerCase(), n + 1);
        if (n) name = name.replace(/\.webp$/, ` (${n}).webp`);
        return { name, blob: it.result.blob };
      });
      const label = $.zip.textContent;
      $.zip.disabled = true;
      $.zip.textContent = 'Menyiapkan ZIP…';
      try {
        const zip = await HTZip.create(entries);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zip);
        a.download = `webp-${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
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
      let actions = `<button class="icon-btn" data-action="remove" aria-label="Hapus ${escapeHtml(file.name)}" title="Hapus">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;

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
            : `<span class="badge badge-warn" title="Hasil lebih besar dari file asli. Coba turunkan kualitas.">+${pct}%</span>`;
        const resized = result.width !== result.srcWidth;
        meta = `<span class="mono">${formatBytes(file.size)} → <strong>${formatBytes(result.blob.size)}</strong></span>
          <span class="mono dim">${resized ? `${result.srcWidth}×${result.srcHeight} → ` : ''}${result.width}×${result.height}</span>`;
        actions =
          `<a class="btn btn-secondary btn-sm" href="${item.outUrl}" download="${escapeHtml(toWebpName(file.name))}">Download</a>` + actions;
      }

      const thumb = item.outUrl || item.srcUrl;
      item.el.innerHTML = `
        <a class="thumb"${item.outUrl ? ` href="${item.outUrl}" target="_blank" rel="noopener" title="Lihat hasil"` : ''}>
          <img src="${thumb}" alt="" loading="lazy" decoding="async">
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
      document.removeEventListener('paste', onPaste);
      state.items.forEach((it) => {
        it.status = 'removed';
        URL.revokeObjectURL(it.srcUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      });
    };
  }

  HT.register({
    id: 'image-to-webp',
    name: 'Image to WebP',
    description: 'Konversi gambar ke WebP dengan pilihan kompresi.',
    icon: ICON,
    mount,
  });
})();
