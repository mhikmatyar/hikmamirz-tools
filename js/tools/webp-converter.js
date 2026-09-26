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

  function mount(root) {
    const s = { quality: 80, sizeChoice: 0, customSide: 1600 };
    const { icon } = HTUtil;

    return HTImg.mountBatch(root, {
      warning: HTImg.canEncode('image/webp') ? '' : 'Browser ini tidak bisa membuat file WebP. Buka tool ini di Chrome, Edge, atau Firefox.',
      zipPrefix: 'webp',
      selectable: true,
      settingsHtml: `
        <div class="fieldbox">
          <div class="fieldbox-head">
            <label for="quality">Kualitas</label>
            <output class="value" data-ref="qualityOut" for="quality">${s.quality}</output>
          </div>
          <input type="range" id="quality" min="1" max="100" step="1" value="${s.quality}" data-ref="quality">
          <div class="range-scale"><span>File lebih kecil</span><span>Kualitas lebih baik</span></div>
          <p class="help">75–85 biasanya pas untuk web: file kecil tanpa penurunan kualitas yang terlihat.</p>
        </div>

        <div class="fieldbox">
          <label class="fieldbox-label" for="size">Ukuran gambar</label>
          <div class="control control-select">
            ${icon('resize', 18)}
            <select id="size" data-ref="size">
              ${SIZES.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          </div>
          <div class="control" data-ref="customWrap" hidden>
            ${icon('resize', 18)}
            <input type="number" min="16" max="32768" step="1" value="${s.customSide}" data-ref="customSide" aria-label="Sisi terpanjang dalam piksel">
            <span class="suffix">px</span>
          </div>
          <p class="help">Batas sisi terpanjang. Gambar yang lebih kecil tidak diperbesar. Metadata EXIF seperti lokasi GPS otomatis dihapus.</p>
          <p class="help">Butuh resolusi berbeda? Centang gambar di atas, atur di sini, lalu klik Terapkan.</p>
        </div>`,

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

      encode: (file, { quality, maxSide }) => ({
        mime: 'image/webp',
        quality,
        resize: { mode: 'long', value: maxSide },
      }),

      describe: ({ quality, maxSide }) => `Kualitas ${quality} · ${maxSide > 0 ? `Maks ${maxSide} px` : 'Ukuran asli'}`,

      outputName: (file) => HTUtil.baseName(file.name) + '.webp',
    });
  }

  HT.register('image-to-webp', { mount });
})();
