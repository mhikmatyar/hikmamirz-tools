(function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const LIB = {
    mammoth: CDN + 'mammoth@1.12.3/mammoth.browser.min.js',
    turndown: CDN + 'turndown@7.2.4/dist/turndown.js',
    gfm: CDN + 'turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js',
    pdfjs: CDN + 'pdfjs-dist@6.3.289/build/pdf.min.mjs',
    pdfWorker: CDN + 'pdfjs-dist@6.3.289/build/pdf.worker.min.mjs',
  };

  const FORMATS = {
    docx: 'DOCX',
    pdf: 'PDF',
    html: 'HTML',
    htm: 'HTML',
    txt: 'TXT',
    md: 'MD',
    markdown: 'MD',
    csv: 'CSV',
    tsv: 'TSV',
  };
  const LEGACY = { doc: '.docx', rtf: '.docx', odt: '.docx', xls: '.csv', xlsx: '.csv', ppt: '.pdf', pptx: '.pdf' };

  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 17v-4l1.75 2 1.75-2v4"/><path d="M15.5 13v4m0 0-1.5-1.5m1.5 1.5 1.5-1.5"/></svg>';

  // ---------- HTML → Markdown ----------
  let turndown = null;
  async function getTurndown() {
    if (!turndown) {
      await HTUtil.loadScript(LIB.turndown);
      await HTUtil.loadScript(LIB.gfm);
      turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '*',
        hr: '---',
      });
      turndown.use(turndownPluginGfm.gfm);
      turndown.remove(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form', 'button', 'select', 'textarea', 'template']);
    }
    return turndown;
  }

  // Tabel Markdown butuh baris judul dan sel satu baris, jadi rapikan dulu sebelum dikonversi.
  function normalizeTables(root) {
    root.querySelectorAll('table').forEach((table) => {
      table.querySelectorAll('td, th').forEach((cell) => {
        cell.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
        cell.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, ul, ol').forEach((el) => {
          el.after(' ');
          el.replaceWith(...el.childNodes);
        });
      });
      const first = table.rows[0];
      if (first && !first.querySelector('th')) {
        [...first.cells].forEach((td) => {
          const th = document.createElement('th');
          th.innerHTML = td.innerHTML;
          td.replaceWith(th);
        });
      }
    });
  }

  async function htmlToMarkdown(root) {
    normalizeTables(root);
    const td = await getTurndown();
    return tidyListMarkers(td.turndown(root));
  }

  // Turndown menulis "-   item"; rapikan jadi "- item" tanpa menyentuh isi blok kode.
  function tidyListMarkers(md) {
    let inFence = false;
    return md
      .split('\n')
      .map((line) => {
        if (/^\s*```/.test(line)) inFence = !inFence;
        return inFence ? line : line.replace(/^(\s*)([-*+]|\d+\.) {2,}/, '$1$2 ');
      })
      .join('\n');
  }

  // ---------- DOCX ----------
  async function docxToMd(file, o) {
    await HTUtil.loadScript(LIB.mammoth);
    const options = {
      styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
    };
    if (!o.embedImages) {
      options.convertImage = mammoth.images.imgElement(() => Promise.resolve({ src: '' }));
    }
    let html;
    try {
      ({ value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, options));
    } catch (_) {
      throw new Error('File DOCX rusak atau tidak bisa dibaca.');
    }
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    return htmlToMarkdown(doc.body);
  }

  // ---------- HTML ----------
  async function htmlFileToMd(file, o) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    if (!o.embedImages) doc.querySelectorAll('img[src^="data:"]').forEach((img) => img.remove());
    let md = await htmlToMarkdown(doc.body);
    const title = doc.title.trim();
    if (title && !doc.querySelector('h1')) md = `# ${title}\n\n${md}`;
    return md;
  }

  // ---------- CSV / TSV ----------
  function parseDelimited(text, delim) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === delim) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  async function delimitedToMd(file) {
    const text = (await file.text()).replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delim =
      HTUtil.extName(file.name) === 'tsv'
        ? '\t'
        : [',', ';', '\t', '|'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
    const rows = parseDelimited(text, delim);
    if (!rows.length) throw new Error('File kosong.');

    const cols = Math.max(...rows.map((r) => r.length));
    const fmt = (r) =>
      '| ' +
      Array.from({ length: cols }, (_, i) => (r[i] ?? '').trim().replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ') +
      ' |';
    return [fmt(rows[0]), '| ' + Array(cols).fill('---').join(' | ') + ' |', ...rows.slice(1).map(fmt)].join('\n');
  }

  // ---------- PDF ----------
  let pdfjs = null;
  async function getPdfjs() {
    if (!pdfjs) {
      try {
        pdfjs = await import(LIB.pdfjs);
      } catch (_) {
        throw new Error('Gagal memuat pembaca PDF. Periksa koneksi internet lalu coba lagi.');
      }
      pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
    }
    return pdfjs;
  }

  const PAGE_NUMBER = /^(\d{1,4}|[-–]\s*\d{1,4}\s*[-–]|(page|halaman|hal\.?)\s*\d+(\s*(of|dari|\/)\s*\d+)?)$/i;
  const BULLET = /^([•●▪◦‣∙·■□➢►✓✔\-–*])\s*(.+)/;
  const ORDERED = /^(\d{1,3}|[a-zA-Z])[.)]\s+(.+)/;

  // Ambil baris teks beserta ukuran huruf dan posisi vertikalnya.
  async function pdfLines(pdf) {
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const { items } = await page.getTextContent();
      const lines = [];
      let cur = null;
      const flush = () => {
        if (!cur) return;
        const text = cur.text.replace(/\s+/g, ' ').trim();
        if (text) lines.push({ text, size: Math.round(cur.size * 2) / 2, y: cur.y, page: p });
        cur = null;
      };
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 0;
        const x = it.transform[4];
        const y = it.transform[5];
        if (it.str !== '') {
          if (cur && Math.abs(y - cur.y) <= Math.max(cur.size, size) * 0.5) {
            if (x - cur.xEnd > size * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += ' ';
            cur.text += it.str;
            cur.xEnd = x + it.width;
            if (it.str.trim()) cur.size = Math.max(cur.size, size);
          } else {
            flush();
            cur = { text: it.str, y, xEnd: x + it.width, size: it.str.trim() ? size : 0 };
          }
        }
        if (it.hasEOL) flush();
      }
      flush();
      page.cleanup();
      pages.push(lines);
    }
    return pages;
  }

  // Header/footer yang berulang di banyak halaman dan nomor halaman dibuang.
  function dropPageFurniture(pages) {
    const edgeCount = new Map();
    if (pages.length >= 3) {
      pages.forEach((lines) => {
        new Set([lines[0]?.text, lines[lines.length - 1]?.text].filter(Boolean)).forEach((t) => {
          const key = t.replace(/\d+/g, '#');
          edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        });
      });
    }
    return pages.map((lines) =>
      lines.filter((l, i) => {
        if (PAGE_NUMBER.test(l.text)) return false;
        const atEdge = i === 0 || i === lines.length - 1;
        return !(atEdge && (edgeCount.get(l.text.replace(/\d+/g, '#')) || 0) > pages.length / 2);
      })
    );
  }

  function escapeLineStart(text) {
    return text.replace(/^(#{1,6}\s|>|\d+[.)]\s|[-+*]\s)/, '\\$1');
  }

  function joinText(a, b) {
    if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b; // kata terpotong tanda hubung
    return a + ' ' + b;
  }

  async function pdfToMd(file, o) {
    const lib = await getPdfjs();
    const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    let pdf;
    try {
      pdf = await task.promise;
    } catch (err) {
      task.destroy();
      if (err?.name === 'PasswordException') throw new Error('PDF ini dikunci password.');
      throw new Error('File PDF rusak atau tidak bisa dibaca.');
    }

    try {
      const pages = dropPageFurniture(await pdfLines(pdf));
      const all = pages.flat();
      if (!all.length) throw new Error('PDF ini tidak berisi teks, kemungkinan hasil scan. Butuh OCR, yang belum didukung.');

      // Ukuran huruf badan teks = ukuran yang paling banyak dipakai.
      const chars = new Map();
      all.forEach((l) => chars.set(l.size, (chars.get(l.size) || 0) + l.text.length));
      const body = [...chars.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const headingSizes = o.detectHeadings
        ? [...chars.keys()].filter((s) => s >= body * 1.15).sort((a, b) => b - a).slice(0, 4)
        : [];

      const blocks = [];
      let prev = null;
      for (const line of all) {
        const last = blocks[blocks.length - 1];
        const newPage = prev && prev.page !== line.page;
        if (newPage && o.pageBreaks) blocks.push({ type: 'hr' });

        const gap = prev && !newPage ? prev.y - line.y : 0;
        const tight = prev && !newPage && gap > 0 && gap <= Math.max(line.size, prev.size) * 1.8;
        const level = line.text.length <= 200 ? headingSizes.indexOf(line.size) + 1 : 0;

        let m;
        if (level) {
          if (last?.type === 'h' && last.level === level && tight) last.text = joinText(last.text, line.text);
          else blocks.push({ type: 'h', level, text: line.text });
        } else if ((m = BULLET.exec(line.text)) && !/^[-–]\s*\d/.test(line.text)) {
          blocks.push({ type: 'li', text: m[2] });
        } else if ((m = ORDERED.exec(line.text))) {
          blocks.push({ type: 'ol', n: m[1], text: m[2] });
        } else {
          // Paragraf boleh bersambung ke halaman berikutnya kalau kalimatnya belum selesai; item list tidak.
          const continues =
            ((last?.type === 'li' || last?.type === 'ol') && tight) ||
            (last?.type === 'p' && (tight || (newPage && !o.pageBreaks && !/[.!?:]["')\]]?$/.test(last.text))));
          if (continues) last.text = joinText(last.text, line.text);
          else blocks.push({ type: 'p', text: line.text });
        }
        prev = line;
      }

      let md = '';
      blocks.forEach((b, i) => {
        const sameList = (b.type === 'li' || b.type === 'ol') && blocks[i - 1]?.type === b.type;
        const sep = i === 0 ? '' : sameList ? '\n' : '\n\n';
        const line =
          b.type === 'h' ? '#'.repeat(b.level) + ' ' + b.text :
          b.type === 'li' ? '- ' + b.text :
          b.type === 'ol' ? `${/\d/.test(b.n) ? b.n : '1'}. ${b.text}` :
          b.type === 'hr' ? '---' :
          escapeLineStart(b.text);
        md += sep + line;
      });
      return md;
    } finally {
      task.destroy();
    }
  }

  // ---------- konversi per format ----------
  async function convert(file, o) {
    const ext = HTUtil.extName(file.name);
    let md;
    if (ext === 'docx') md = await docxToMd(file, o);
    else if (ext === 'pdf') md = await pdfToMd(file, o);
    else if (ext === 'html' || ext === 'htm') md = await htmlFileToMd(file, o);
    else if (ext === 'csv' || ext === 'tsv') md = await delimitedToMd(file);
    else md = (await file.text()).replace(/^﻿/, '');

    md = md.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    if (!md.trim()) throw new Error('Tidak ada teks yang bisa diambil dari file ini.');
    return md;
  }

  // ---------- tool ----------
  function mount(root) {
    const s = { embedImages: false, detectHeadings: true, pageBreaks: false };
    const state = { items: [], busy: false, nextId: 1, selected: null };
    const { escapeHtml, formatBytes } = HTUtil;

    root.innerHTML = `
      <div class="tool">
        <header class="tool-head">
          <h1>Document to Markdown</h1>
          <p>Ubah dokumen Word (DOCX), PDF, HTML, CSV, dan TXT ke Markdown. Bisa banyak file sekaligus, tanpa batas jumlah atau ukuran.</p>
        </header>

        <div class="tool-grid">
          <section class="panel settings" aria-labelledby="settings-title">
            <h2 id="settings-title" class="panel-title">Pengaturan</h2>

            <div class="field">
              <label for="images">Gambar di DOCX dan HTML</label>
              <select id="images" data-ref="images">
                <option value="skip">Lewati gambar</option>
                <option value="embed">Sematkan di dalam file (base64)</option>
              </select>
              <p class="help">Menyematkan gambar membuat file .md jauh lebih besar.</p>
            </div>

            <div class="field">
              <span class="field-title">PDF</span>
              <label class="check"><input type="checkbox" data-ref="headings" checked> Deteksi judul dari ukuran huruf</label>
              <label class="check"><input type="checkbox" data-ref="pageBreaks"> Beri garis pemisah antar halaman</label>
              <p class="help">PDF hasil scan (berupa gambar) tidak bisa dibaca karena belum ada OCR. Tabel di PDF dikeluarkan sebagai teks biasa.</p>
            </div>

            <button class="btn btn-secondary" data-ref="reconvert" hidden>Terapkan ke semua dokumen</button>
          </section>

          <section class="workspace">
            <label class="dropzone" data-ref="dropzone">
              <input type="file" multiple accept=".docx,.pdf,.html,.htm,.txt,.md,.markdown,.csv,.tsv" data-ref="input" hidden>
              ${HTUtil.ICON_UPLOAD}
              <span class="dz-title">Tarik dokumen ke sini atau <u>pilih file</u></span>
              <span class="dz-sub">DOCX, PDF, HTML, CSV, TSV, TXT</span>
            </label>

            <div class="summary" data-ref="summary" hidden>
              <div class="stats">
                <div><span class="stat-label">Dokumen</span><span class="stat-val mono" data-ref="sCount">0</span></div>
                <div><span class="stat-label">Selesai</span><span class="stat-val mono" data-ref="sDone">0</span></div>
                <div><span class="stat-label">Gagal</span><span class="stat-val mono" data-ref="sFailed">0</span></div>
              </div>
              <div class="summary-actions">
                <button class="btn btn-ghost" data-ref="clear">Hapus semua</button>
                <button class="btn btn-primary" data-ref="zip" disabled>Download semua (ZIP)</button>
              </div>
            </div>

            <ul class="file-list" data-ref="list"></ul>

            <section class="panel preview" data-ref="preview" hidden aria-label="Hasil Markdown">
              <div class="preview-head">
                <span class="preview-name mono" data-ref="previewName"></span>
                <div class="preview-actions">
                  <button class="btn btn-ghost btn-sm" data-ref="copy">Salin</button>
                  <button class="btn btn-secondary btn-sm" data-ref="download">Download .md</button>
                </div>
              </div>
              <textarea class="md-output" data-ref="output" readonly spellcheck="false" aria-label="Isi Markdown"></textarea>
            </section>
          </section>
        </div>
      </div>`;

    const $ = {};
    root.querySelectorAll('[data-ref]').forEach((el) => ($[el.dataset.ref] = el));

    // ---------- pengaturan ----------
    const optionsKey = () => JSON.stringify(s);
    function settingsChanged() {
      const key = optionsKey();
      $.reconvert.hidden = !state.items.some((it) => it.status === 'done' && it.optionsKey !== key);
    }
    $.images.addEventListener('change', () => {
      s.embedImages = $.images.value === 'embed';
      settingsChanged();
    });
    $.headings.addEventListener('change', () => {
      s.detectHeadings = $.headings.checked;
      settingsChanged();
    });
    $.pageBreaks.addEventListener('change', () => {
      s.pageBreaks = $.pageBreaks.checked;
      settingsChanged();
    });
    $.reconvert.addEventListener('click', () => {
      state.items.forEach((it) => {
        if (it.status === 'done' || (it.status === 'error' && !it.unsupported)) setPending(it);
      });
      $.reconvert.hidden = true;
      processQueue();
    });

    // ---------- input ----------
    function addFiles(files) {
      for (const file of files) {
        const ext = HTUtil.extName(file.name);
        const item = { id: state.nextId++, file, ext, status: 'pending', md: null, error: null, optionsKey: null, el: document.createElement('li') };
        if (!FORMATS[ext]) {
          item.status = 'error';
          item.unsupported = true;
          item.error = LEGACY[ext]
            ? `Format .${ext} belum didukung. Simpan ulang sebagai ${LEGACY[ext]} dulu.`
            : `Format ${ext ? '.' + ext : 'ini'} belum didukung.`;
        }
        item.el.className = 'file';
        state.items.push(item);
        $.list.appendChild(item.el);
        renderItem(item);
      }
      renderSummary();
      processQueue();
    }
    const unbindInput = HTUtil.bindFileInput($.dropzone, $.input, addFiles);

    // ---------- antrean ----------
    async function processQueue() {
      if (state.busy) return;
      state.busy = true;
      let item;
      while ((item = state.items.find((it) => it.status === 'pending'))) {
        const key = optionsKey();
        item.status = 'working';
        renderItem(item);
        try {
          const md = await convert(item.file, { ...s });
          if (item.status !== 'working') continue; // sudah dihapus
          item.md = md;
          item.optionsKey = key;
          item.status = 'done';
          if (!state.selected || state.selected === item) select(item);
        } catch (err) {
          if (item.status !== 'working') continue;
          item.status = 'error';
          item.error = err?.message || 'Gagal mengonversi dokumen.';
        }
        renderItem(item);
        renderSummary();
        settingsChanged();
      }
      state.busy = false;
      renderSummary();
    }

    function setPending(item) {
      item.md = null;
      item.error = null;
      item.status = 'pending';
      renderItem(item);
    }

    function removeItem(item) {
      item.status = 'removed';
      item.el.remove();
      state.items = state.items.filter((it) => it !== item);
      if (state.selected === item) select(state.items.find((it) => it.status === 'done') || null);
      renderSummary();
      settingsChanged();
    }

    const mdName = (item) => HTUtil.baseName(item.file.name) + '.md';
    const mdBlob = (item) => new Blob([item.md], { type: 'text/markdown;charset=utf-8' });

    function select(item) {
      const old = state.selected;
      state.selected = item;
      if (old && old !== item) renderItem(old);
      $.preview.hidden = !item;
      if (!item) return;
      renderItem(item);
      $.previewName.textContent = mdName(item);
      $.output.value = item.md;
      $.output.scrollTop = 0;
    }

    $.list.addEventListener('click', (e) => {
      const li = e.target.closest('.file');
      const item = li && state.items.find((it) => it.id === +li.dataset.id);
      if (!item) return;
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'remove') removeItem(item);
      else if (action === 'retry') {
        setPending(item);
        processQueue();
      } else if (action === 'download') HTUtil.downloadBlob(mdBlob(item), mdName(item));
      else if (item.status === 'done') {
        select(item);
        if (action === 'view') $.preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    $.copy.addEventListener('click', async () => {
      if (!state.selected) return;
      try {
        await navigator.clipboard.writeText(state.selected.md);
      } catch (_) {
        $.output.select();
        document.execCommand('copy');
      }
      $.copy.textContent = 'Tersalin';
      setTimeout(() => ($.copy.textContent = 'Salin'), 1500);
    });

    $.download.addEventListener('click', () => state.selected && HTUtil.downloadBlob(mdBlob(state.selected), mdName(state.selected)));

    $.clear.addEventListener('click', () => [...state.items].forEach(removeItem));

    $.zip.addEventListener('click', async () => {
      const done = state.items.filter((it) => it.status === 'done');
      if (!done.length) return;
      const used = new Map();
      const entries = done.map((it) => {
        let name = mdName(it);
        const n = used.get(name.toLowerCase()) || 0;
        used.set(name.toLowerCase(), n + 1);
        if (n) name = name.replace(/\.md$/, ` (${n}).md`);
        return { name, blob: mdBlob(it) };
      });
      $.zip.disabled = true;
      try {
        HTUtil.downloadBlob(await HTZip.create(entries), `markdown-${HTUtil.today()}.zip`);
      } finally {
        renderSummary();
      }
    });

    // ---------- render ----------
    function renderItem(item) {
      const { file } = item;
      item.el.dataset.id = item.id;
      item.el.dataset.status = item.status;
      item.el.classList.toggle('is-selected', state.selected === item);

      let meta = `<span class="mono">${formatBytes(file.size)}</span>`;
      let badge = '';
      let actions = `<button class="icon-btn" data-action="remove" aria-label="Hapus ${escapeHtml(file.name)}" title="Hapus">${HTUtil.ICON_REMOVE}</button>`;

      if (item.status === 'pending') badge = '<span class="badge">Menunggu</span>';
      else if (item.status === 'working') badge = '<span class="badge badge-busy"><span class="spinner" aria-hidden="true"></span>Memproses</span>';
      else if (item.status === 'error') {
        badge = '<span class="badge badge-error">Gagal</span>';
        meta += `<span class="err">${escapeHtml(item.error)}</span>`;
        if (!item.unsupported) actions = `<button class="btn btn-ghost btn-sm" data-action="retry">Coba lagi</button>` + actions;
      } else if (item.status === 'done') {
        const words = (item.md.match(/[\p{L}\p{N}]+/gu) || []).length;
        const lines = item.md.split('\n').length;
        badge = '<span class="badge badge-good">Selesai</span>';
        meta = `<span class="mono">${formatBytes(file.size)} → <strong>${formatBytes(new Blob([item.md]).size)}</strong></span>
          <span class="mono dim">${words.toLocaleString('id-ID')} kata · ${lines.toLocaleString('id-ID')} baris</span>`;
        actions =
          `<button class="btn btn-ghost btn-sm" data-action="view">Lihat</button>` +
          `<button class="btn btn-secondary btn-sm" data-action="download">Download</button>` +
          actions;
      }

      item.el.innerHTML = `
        <span class="thumb doc-thumb" aria-hidden="true">${FORMATS[item.ext] || (item.ext || '?').toUpperCase().slice(0, 4)}</span>
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
      const done = items.filter((it) => it.status === 'done').length;
      const pending = items.filter((it) => it.status === 'pending' || it.status === 'working').length;
      $.sCount.textContent = items.length;
      $.sDone.textContent = done;
      $.sFailed.textContent = items.filter((it) => it.status === 'error').length;
      $.zip.disabled = done === 0 || pending > 0;
    }

    return function cleanup() {
      unbindInput();
      state.items.forEach((it) => (it.status = 'removed'));
    };
  }

  HT.register({
    id: 'doc-to-markdown',
    name: 'Document to Markdown',
    description: 'Konversi DOCX, PDF, HTML, CSV, dan TXT ke Markdown.',
    icon: ICON,
    mount,
  });
})();
