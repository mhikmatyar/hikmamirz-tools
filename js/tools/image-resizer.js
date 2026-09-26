(function () {
  const MODES = [
    { value: 'percent', label: 'Persentase' },
    { value: 'width', label: 'Lebar' },
    { value: 'height', label: 'Tinggi' },
    { value: 'long', label: 'Sisi terpanjang' },
  ];

  const FORMATS = [
    { value: 'original', label: 'Sama seperti asli' },
    { value: 'image/jpeg', label: 'JPG' },
    { value: 'image/png', label: 'PNG' },
    { value: 'image/webp', label: 'WebP' },
  ];

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  // Format asli dipertahankan kalau browser bisa membuatnya; selain itu (GIF, BMP, SVG, AVIF) jadi PNG.
  function outputMime(file, format) {
    if (format !== 'original') return format;
    return EXT[file.type] ? file.type : 'image/png';
  }

  function mount(root) {
    const s = { mode: 'percent', percent: 50, px: 1280, format: 'original', quality: 90 };
    const { icon } = HTUtil;

    let $s;
    function syncVisibility() {
      $s.percentField.hidden = s.mode !== 'percent';
      $s.pxField.hidden = s.mode === 'percent';
      $s.pxLabel.textContent = MODES.find((m) => m.value === s.mode).label + ' (px)';
      $s.qualityField.hidden = s.format === 'image/png';
    }

    return HTImg.mountBatch(root, {
      zipPrefix: 'resize',
      settingsHtml: `
        <div class="fieldbox">
          <label class="fieldbox-label" for="mode">Ubah berdasarkan</label>
          <div class="control control-select">
            ${icon('resize', 18)}
            <select id="mode" data-ref="mode">
              ${MODES.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
            </select>
          </div>
          <p class="help">Rasio selalu dikunci. Gambar yang sudah lebih kecil dari target tidak diperbesar.</p>
        </div>

        <div class="fieldbox" data-ref="percentField">
          <div class="fieldbox-head">
            <label for="percent">Skala</label>
            <output class="value" data-ref="percentOut" for="percent">${s.percent}%</output>
          </div>
          <input type="range" id="percent" min="1" max="100" step="1" value="${s.percent}" data-ref="percent">
          <div class="range-scale"><span>1%</span><span>100%</span></div>
        </div>

        <div class="fieldbox" data-ref="pxField" hidden>
          <label class="fieldbox-label" for="px" data-ref="pxLabel">Lebar (px)</label>
          <div class="control">
            ${icon('resize', 18)}
            <input type="number" id="px" min="1" max="32768" step="1" value="${s.px}" data-ref="px">
            <span class="suffix">px</span>
          </div>
          <p class="help">Sisi lainnya menyesuaikan otomatis mengikuti rasio.</p>
        </div>

        <div class="fieldbox">
          <label class="fieldbox-label" for="format">Format hasil</label>
          <div class="control control-select">
            ${icon('file', 18)}
            <select id="format" data-ref="format">
              ${FORMATS.map((f) => `<option value="${f.value}">${f.label}</option>`).join('')}
            </select>
          </div>
          <p class="help">GIF, BMP, SVG, dan AVIF disimpan sebagai PNG kalau memilih "Sama seperti asli".</p>
        </div>

        <div class="fieldbox" data-ref="qualityField">
          <div class="fieldbox-head">
            <label for="rq">Kualitas</label>
            <output class="value" data-ref="qualityOut" for="rq">${s.quality}</output>
          </div>
          <input type="range" id="rq" min="1" max="100" step="1" value="${s.quality}" data-ref="quality">
          <div class="range-scale"><span>File lebih kecil</span><span>Kualitas lebih baik</span></div>
          <p class="help">Berlaku untuk JPG dan WebP.</p>
        </div>`,

      bindSettings($, changed) {
        $s = $;
        $.mode.addEventListener('change', () => {
          s.mode = $.mode.value;
          syncVisibility();
          if (s.mode !== 'percent') $.px.focus();
          changed();
        });
        $.percent.addEventListener('input', () => {
          s.percent = +$.percent.value;
          $.percentOut.value = s.percent + '%';
          changed();
        });
        $.px.addEventListener('input', () => {
          s.px = +$.px.value || 0;
          changed();
        });
        $.format.addEventListener('change', () => {
          s.format = $.format.value;
          syncVisibility();
          changed();
        });
        $.quality.addEventListener('input', () => {
          s.quality = +$.quality.value;
          $.qualityOut.value = s.quality;
          changed();
        });
        syncVisibility();
      },

      getOptions() {
        const o = { mode: s.mode, format: s.format, quality: s.quality };
        o.value = s.mode === 'percent' ? s.percent : Math.max(1, s.px | 0);
        return o;
      },

      encode(file, o) {
        const mime = outputMime(file, o.format);
        return {
          mime,
          quality: o.quality,
          background: mime === 'image/jpeg' ? '#ffffff' : null, // JPG tidak punya transparansi
          resize: { mode: o.mode, value: o.value },
        };
      },

      outputName: (file, r) => `${HTUtil.baseName(file.name)}-${r.width}x${r.height}.${EXT[r.blob.type]}`,
    });
  }

  HT.register('image-resizer', { mount });
})();
