/** Helper umum yang dipakai lintas tool. */
window.HTUtil = (function () {
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
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function baseName(name) {
    return name.replace(/\.[^./\\]+$/, '');
  }

  function extName(name) {
    const m = /\.([^./\\]+)$/.exec(name);
    return m ? m[1].toLowerCase() : '';
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  // Script dimuat saat dibutuhkan saja, dan hanya sekali.
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        if (/^https?:/.test(src)) s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => {
          delete loaded[src];
          s.remove();
          reject(new Error('Gagal memuat file yang dibutuhkan. Periksa koneksi internet lalu coba lagi.'));
        };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  async function makeZip(entries) {
    await loadScript('js/lib/zip.js');
    return HTZip.create(entries);
  }

  /**
   * Pasang drag & drop pada dropzone, pilih file lewat input, dan tempel (Ctrl+V).
   * Return fungsi untuk melepas listener paste global.
   */
  function bindFileInput(dropzone, input, onFiles) {
    input.addEventListener('change', () => {
      onFiles([...input.files]);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('is-over');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-over');
      })
    );
    dropzone.addEventListener('drop', (e) => onFiles([...e.dataTransfer.files]));

    function onPaste(e) {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        onFiles(files);
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }

  // ---------- ikon (garis 1.6, gaya Lucide) ----------
  const ICONS = {
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    resize: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    retry: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };

  function icon(name, size = 20) {
    return `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  /** Section abu-abu dengan judul dan kartu putih di dalamnya. */
  function block({ icon: ic, title, body, actions = '', ref = '', hidden = false }) {
    return `
      <section class="block"${ref ? ` data-ref="${ref}"` : ''}${hidden ? ' hidden' : ''}>
        <header class="block-head">
          ${icon(ic, 18)}
          <h2>${title}</h2>
          <div class="block-actions">${actions}</div>
        </header>
        <div class="block-body">${body}</div>
      </section>`;
  }

  function dropzone({ accept, title, sub }) {
    return `
      <label class="dropzone" data-ref="dropzone">
        <input type="file" multiple accept="${accept}" data-ref="input" hidden>
        <span class="dz-icon">${icon('upload', 22)}</span>
        <span class="dz-text">
          <span class="dz-title">${title}</span>
          <span class="dz-sub">${sub}</span>
        </span>
        <span class="btn btn-secondary dz-btn">${icon('upload', 18)} Pilih file</span>
      </label>`;
  }

  // Isi bagian kiri slider (dipakai CSS untuk warna track).
  function syncRange(el) {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  return {
    formatBytes,
    escapeHtml,
    baseName,
    extName,
    downloadBlob,
    today,
    loadScript,
    makeZip,
    bindFileInput,
    icon,
    block,
    dropzone,
    syncRange,
  };
})();
