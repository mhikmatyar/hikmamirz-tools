# Hikmamirz Tools

Kumpulan tools yang berjalan langsung di browser. Tidak perlu build, dan file tidak di-upload ke server.

## Tools

**Image Lab**

- **PixelPress** (Image → WebP): ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP. Atur kualitas (1–100) dan batas ukuran.
- **ScaleShift** (Image Resizer): kecilkan resolusi dengan rasio terkunci, berdasarkan persentase, lebar, tinggi, atau sisi terpanjang. Format hasil bisa sama seperti asli, JPG, PNG, atau WebP.

**Doc Lab**

- **Markflow** (Document → Markdown): ubah DOCX, PDF, HTML, CSV/TSV, dan TXT ke Markdown. Judul, list, tabel, bold/italic, dan link ikut terbawa. Hasil bisa dilihat, disalin, atau di-download.

Semua tool memproses banyak file sekaligus tanpa batas jumlah, lalu hasilnya bisa di-download per file atau dalam satu ZIP.

Markflow memuat library dari CDN jsDelivr saat pertama dipakai (Mammoth untuk DOCX, pdf.js untuk PDF, Turndown untuk HTML), jadi butuh koneksi internet. Isi file tetap diproses di browser dan tidak dikirim ke mana pun.

## Menjalankan

```bash
node scripts/serve.js
```

lalu buka http://localhost:5173.

`index.html` juga bisa dibuka langsung, tapi tanpa server gambar diproses satu per satu karena Web Worker tidak jalan di `file://`.

## Performa

- Halaman awal hanya memuat `util.js`, `registry.js`, dan `app.js`. Kode tiap tool dimuat saat tool dibuka, dan sudah mulai dimuat saat kursor mengarah ke menunya.
- Gambar diproses paralel di Web Worker (maks. 4 sekaligus, menyesuaikan jumlah core CPU), jadi halaman tetap responsif. Kalau worker tidak tersedia, proses otomatis pindah ke halaman.
- Daftar file memakai thumbnail kecil (112 px) dan `content-visibility`, jadi ribuan file tetap ringan.
- `zip.js` dan library dokumen baru dimuat saat dibutuhkan.
- `sw.js` menyimpan file aplikasi (stale-while-revalidate) dan library CDN (cache-first), jadi kunjungan berikutnya instan dan library tidak diunduh ulang. Service worker tidak aktif di `localhost` supaya tidak mengganggu saat development.

## Menambah tool baru

1. Tambahkan metadata tool di `js/registry.js`: `id`, `name`, `tagline`, `group`, `icon` (nama ikon dari `HTUtil.icon`), `description`, dan `scripts` yang perlu dimuat.
2. Buat `js/tools/<nama-tool>.js` yang memanggil `HT.register('<id>', { mount(el) { ... } })`.
   `mount` merender isi tool ke dalam `el` dan boleh mengembalikan fungsi cleanup.

Tool otomatis muncul di sidebar dan bisa dibuka lewat `#/<id>`. Judul, breadcrumb, dan deskripsi halaman diambil dari metadata.

Untuk tampilan yang seragam, pakai `HTUtil.block()` (section), `HTUtil.dropzone()`, dan kelas `.fields` / `.fieldbox` / `.control` untuk pengaturan.

Untuk tool yang memproses banyak gambar, pakai `HTImg.mountBatch()` dari `js/lib/image-batch.js`. Modul ini sudah menangani pengaturan, dropzone, antrean paralel, daftar file, dan ZIP. Tool cukup menyediakan field pengaturan dan fungsi `encode()`. Contohnya ada di `js/tools/image-resizer.js`.
