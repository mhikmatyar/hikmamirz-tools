/**
 * Daftar tools. Metadata ada di sini supaya sidebar bisa tampil tanpa memuat kode tool;
 * kode tool (scripts) baru dimuat saat tool dibuka.
 *
 * File tool memanggil HT.register('<id>', { mount(el) { ...; return cleanup } }).
 */
window.HT = {
  groups: ['Image Lab', 'Doc Lab', 'Content Lab'],

  // name: nama produk di sidebar; tagline: fungsi singkatnya (tampil di breadcrumb dan ikut dicari).
  tools: [
    {
      id: 'image-to-webp',
      name: 'PixelPress',
      tagline: 'Image → WebP',
      group: 'Image Lab',
      icon: 'image',
      description: 'Ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP dan kompres ukurannya. Tidak ada batas jumlah atau ukuran file.',
      scripts: ['js/lib/image-core.js', 'js/lib/image-batch.js', 'js/tools/webp-converter.js'],
    },
    {
      id: 'image-resizer',
      name: 'ScaleShift',
      tagline: 'Image Resizer',
      group: 'Image Lab',
      icon: 'resize',
      description: 'Kecilkan resolusi gambar dengan rasio yang tetap terjaga. Proses massal, tanpa batas jumlah atau ukuran file.',
      scripts: ['js/lib/image-core.js', 'js/lib/image-batch.js', 'js/tools/image-resizer.js'],
    },
    {
      id: 'doc-to-markdown',
      name: 'Markflow',
      tagline: 'Document → Markdown',
      group: 'Doc Lab',
      icon: 'fileText',
      description: 'Ubah dokumen Word (DOCX), PDF, HTML, CSV, dan TXT ke Markdown. Bisa banyak file sekaligus, tanpa batas jumlah atau ukuran.',
      scripts: ['js/tools/doc-to-markdown.js'],
    },
    {
      id: 'post-analytics',
      name: 'Pulse',
      tagline: 'Post Analytics',
      group: 'Content Lab',
      icon: 'chart',
      description: 'Dashboard performa post Instagram yang diambil langsung dari akun kamu dan diperbarui tiap 15 menit. Lihat views per post, post yang menonjol, serta hari dan jam unggah terbaik.',
      scripts: ['js/tools/post-analytics.js'],
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
