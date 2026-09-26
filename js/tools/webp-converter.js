(function () {
  const SIZES = [
    { value: 0, label: 'Ukuran asli' },
    { value: 3840, label: 'Maks 3840 px (4K)' },
    { value: 2560, label: 'Maks 2560 px' },
    { value: 1920, label: 'Maks 1920 px (Full HD)' },
    { value: 1280, label: 'Maks 1280 px' },
    { value: 800, label: 'Maks 800 px' },
    { value: -1, label: 'Kustom…' },
  ];

  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-4.5-4.5L7 20"/></svg>';

  function mount(root) {
    const s = { quality: 80, sizeChoice: 0, customSide: 1600 };

    return HTImg.mountBatch(root, {
      title: 'Image to WebP',
      intro: 'Ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP dan kompres ukurannya. Tidak ada batas jumlah atau ukuran file.',
      warning: HTImg.canEncode('image/webp') ? '' : 'Browser ini tidak bisa membuat file WebP. Buka tool ini di Chrome, Edge, atau Firefox.',
      zipPrefix: 'webp',
      settingsHtml: `
        <div class="field">
          <div class="field-row">
            <label for="quality">Kualitas</label>
            <output data-ref="qualityOut" for="quality" class="mono">${s.quality}</output>
          </div>
          <input type="range" id="quality" min="1" max="100" step="1" value="${s.quality}" data-ref="quality">
          <div class="range-scale"><span>File lebih kecil</span><span>Kualitas lebih baik</span></div>
          <p class="help">75–85 biasanya pas untuk web: file kecil tanpa penurunan kualitas yang terlihat.</p>
        </div>

        <div class="field">
          <label for="size">Ukuran gambar</label>
          <select id="size" data-ref="size">
            ${SIZES.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
          <div class="custom-size" data-ref="customWrap" hidden>
            <input type="number" min="16" max="32768" step="1" value="${s.customSide}" data-ref="customSide" aria-label="Sisi terpanjang dalam piksel">
            <span>px, sisi terpanjang</span>
          </div>
          <p class="help">Gambar yang lebih kecil dari batas ini tidak diperbesar.</p>
        </div>

        <p class="help">Metadata EXIF, seperti lokasi GPS dan info kamera, otomatis dihapus dari hasil.</p>`,

      bindSettings($, changed) {
        $.quality.addEventListener('input', () => {
          s.quality = +$.quality.value;
          $.qualityOut.value = s.quality;
          changed();
        });
        $.size.addEventListener('change', () => {
          s.sizeChoice = +$.size.value;
          $.customWrap.hidden = s.sizeChoice !== -1;
          if (s.sizeChoice === -1) $.customSide.focus();
          changed();
        });
        $.customSide.addEventListener('input', () => {
          s.customSide = +$.customSide.value || 0;
          changed();
        });
      },

      getOptions() {
        const maxSide = s.sizeChoice === -1 ? Math.max(16, s.customSide | 0) : s.sizeChoice;
        return { quality: s.quality, maxSide };
      },

      process(file, { quality, maxSide }) {
        return HTImg.render(file, {
          mime: 'image/webp',
          quality,
          targetSize: (w, h) => HTImg.fit(w, h, maxSide > 0 ? maxSide / Math.max(w, h) : 1),
        });
      },

      outputName: (file) => HTImg.baseName(file.name) + '.webp',
    });
  }

  HT.register({
    id: 'image-to-webp',
    name: 'Image to WebP',
    description: 'Konversi gambar ke WebP dengan pilihan kompresi.',
    icon: ICON,
    mount,
  });
})();
