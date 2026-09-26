/**
 * Daftar tools. Metadata ada di sini supaya sidebar bisa tampil tanpa memuat kode tool;
 * kode tool (scripts) baru dimuat saat tool dibuka.
 *
 * File tool memanggil HT.register('<id>', { mount(el) { ...; return cleanup } }).
 */
window.HT = {
  groups: ['Gambar', 'Dokumen'],

  tools: [
    {
      id: 'image-to-webp',
      name: 'Image to WebP',
      group: 'Gambar',
      icon: 'image',
      description: 'Ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP dan kompres ukurannya. Tidak ada batas jumlah atau ukuran file.',
      scripts: ['js/lib/image-core.js', 'js/lib/image-batch.js', 'js/tools/webp-converter.js'],
    },
    {
      id: 'image-resizer',
      name: 'Resize Image',
      group: 'Gambar',
      icon: 'resize',
      description: 'Kecilkan resolusi gambar dengan rasio yang tetap terjaga. Proses massal, tanpa batas jumlah atau ukuran file.',
      scripts: ['js/lib/image-core.js', 'js/lib/image-batch.js', 'js/tools/image-resizer.js'],
    },
    {
      id: 'doc-to-markdown',
      name: 'Document to Markdown',
      group: 'Dokumen',
      icon: 'fileText',
      description: 'Ubah dokumen Word (DOCX), PDF, HTML, CSV, dan TXT ke Markdown. Bisa banyak file sekaligus, tanpa batas jumlah atau ukuran.',
      scripts: ['js/tools/doc-to-markdown.js'],
    },
  ],

  register(id, impl) {
    Object.assign(this.find(id), impl);
  },

  find(id) {
    return this.tools.find((t) => t.id === id);
  },

  async load(tool) {
    for (const src of tool.scripts) await HTUtil.loadScript(src);
    if (typeof tool.mount !== 'function') throw new Error(`Tool "${tool.name}" gagal dimuat.`);
  },
};
