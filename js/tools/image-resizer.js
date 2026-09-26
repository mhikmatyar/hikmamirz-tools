(function () {
  const MODES = [
    { value: 'percent', label: 'Persentase' },
    { value: 'width', label: 'Lebar (px)' },
    { value: 'height', label: 'Tinggi (px)' },
    { value: 'long', label: 'Sisi terpanjang (px)' },
  ];

  const FORMATS = [
    { value: 'original', label: 'Sama seperti asli' },
    { value: 'image/jpeg', label: 'JPG' },
    { value: 'image/png', label: 'PNG' },
    { value: 'image/webp', label: 'WebP' },
  ];

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

  // Format asli dipertahankan kalau browser bisa membuatnya; selain itu (GIF, BMP, SVG, AVIF) jadi PNG.
  function outputMime(file, format) {
    if (format !== 'original') return format;
    return EXT[file.type] ? file.type : 'image/png';
  }

  function mount(root) {
    const s = { mode: 'percent', percent: 50, px: 1280, format: 'original', quality: 90 };

    let $s;
    function syncVisibility() {
      $s.percentField.hidden = s.mode !== 'percent';
      $s.pxField.hidden = s.mode === 'percent';
      $s.pxLabel.textContent = MODES.find((m) => m.value === s.mode).label.replace(' (px)', '');
      $s.qualityField.hidden = s.format === 'image/png';
    }

    return HTImg.mountBatch(root, {
      title: 'Resize Image',
      intro: 'Kecilkan resolusi gambar dengan rasio yang tetap terjaga. Proses massal, tanpa batas jumlah atau ukuran file.',
      zipPrefix: 'resize',
      settingsHtml: `
        <div class="field">
          <label for="mode">Ubah berdasarkan</label>
          <select id="mode" data-ref="mode">
            ${MODES.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
          </select>
        </div>

        <div class="field" data-ref="percentField">
          <div class="field-row">
            <label for="percent">Skala</label>
            <output data-ref="percentOut" for="percent" class="mono">${s.percent}%</output>
          </div>
          <input type="range" id="percent" min="1" max="100" step="1" value="${s.percent}" data-ref="percent">
          <div class="range-scale"><span>1%</span><span>100%</span></div>
        </div>

        <div class="field" data-ref="pxField" hidden>
          <label for="px" data-ref="pxLabel">Lebar</label>
          <div class="custom-size">
            <input type="number" id="px" min="1" max="32768" step="1" value="${s.px}" data-ref="px">
            <span>px</span>
          </div>
        </div>

        <p class="help">Rasio selalu dikunci, jadi sisi lainnya menyesuaikan otomatis. Gambar yang sudah lebih kecil dari target tidak diperbesar.</p>

        <div class="field">
          <label for="format">Format hasil</label>
          <select id="format" data-ref="format">
            ${FORMATS.map((f) => `<option value="${f.value}">${f.label}</option>`).join('')}
          </select>
          <p class="help">GIF, BMP, SVG, dan AVIF disimpan sebagai PNG kalau memilih "Sama seperti asli".</p>
        </div>

        <div class="field" data-ref="qualityField">
          <div class="field-row">
            <label for="rq">Kualitas</label>
            <output data-ref="qualityOut" for="rq" class="mono">${s.quality}</output>
          </div>
          <input type="range" id="rq" min="1" max="100" step="1" value="${s.quality}" data-ref="quality">
          <div class="range-scale"><span>File lebih kecil</span><span>Kualitas lebih baik</span></div>
          <p class="help">Berlaku untuk JPG dan WebP. PNG selalu tanpa kompresi kualitas.</p>
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
        if (s.mode === 'percent') o.percent = s.percent;
        else o.px = Math.max(1, s.px | 0);
        return o;
      },

      process(file, o) {
        const mime = outputMime(file, o.format);
        return HTImg.render(file, {
          mime,
          quality: o.quality,
          background: mime === 'image/jpeg' ? '#ffffff' : null, // JPG tidak punya transparansi
          targetSize(w, h) {
            const scale =
              o.mode === 'percent' ? o.percent / 100 :
              o.mode === 'width' ? o.px / w :
              o.mode === 'height' ? o.px / h :
              o.px / Math.max(w, h);
            return HTImg.fit(w, h, scale);
          },
        });
      },

      outputName(file, r) {
        const mime = r.blob.type;
        return `${HTUtil.baseName(file.name)}-${r.width}x${r.height}.${EXT[mime]}`;
      },
    });
  }

  HT.register({
    id: 'image-resizer',
    name: 'Resize Image',
    description: 'Kecilkan resolusi gambar dengan rasio tetap.',
    icon: ICON,
    mount,
  });
})();
