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

  // Library pihak ketiga dimuat saat tool dibuka saja, dan hanya sekali.
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => {
          delete loaded[src];
          s.remove();
          reject(new Error('Gagal memuat library. Periksa koneksi internet lalu coba lagi.'));
        };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
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

  const ICON_REMOVE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const ICON_UPLOAD =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

  return { formatBytes, escapeHtml, baseName, extName, downloadBlob, today, loadScript, bindFileInput, ICON_REMOVE, ICON_UPLOAD };
})();
