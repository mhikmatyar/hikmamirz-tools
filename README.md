# Hikmamirz Tools

Kumpulan tools yang berjalan langsung di browser. Tidak perlu build, dan file tidak di-upload ke server.

## Tools

- **Image to WebP**: ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP. Atur kualitas (1–100) dan batas ukuran.
- **Resize Image**: kecilkan resolusi dengan rasio terkunci, berdasarkan persentase, lebar, tinggi, atau sisi terpanjang. Format hasil bisa sama seperti asli, JPG, PNG, atau WebP.

- **Document to Markdown**: ubah DOCX, PDF, HTML, CSV/TSV, dan TXT ke Markdown. Judul, list, tabel, bold/italic, dan link ikut terbawa. Hasil bisa dilihat, disalin, atau di-download.

Semua tool memproses banyak file sekaligus tanpa batas jumlah, lalu hasilnya bisa di-download per file atau dalam satu ZIP.

Document to Markdown memuat library dari CDN jsDelivr saat pertama dipakai (Mammoth untuk DOCX, pdf.js untuk PDF, Turndown untuk HTML), jadi butuh koneksi internet. Isi file tetap diproses di browser dan tidak dikirim ke mana pun.

## Menjalankan

Buka `index.html` langsung di browser, atau jalankan server lokal:

```bash
node scripts/serve.js
```

lalu buka http://localhost:5173.

## Menambah tool baru

1. Buat file `js/tools/<nama-tool>.js` yang memanggil `HT.register({ id, name, description, icon, mount })`.
   `mount(el)` merender UI tool ke dalam `el` dan boleh mengembalikan fungsi cleanup.
2. Tambahkan `<script src="js/tools/<nama-tool>.js"></script>` di `index.html`, sebelum `js/app.js`.

Tool akan otomatis muncul di sidebar dan bisa dibuka lewat `#/<id>`.

Untuk tool yang memproses banyak gambar, pakai `HTImg.mountBatch()` dari `js/lib/image-batch.js`. Modul ini sudah menangani dropzone, antrean, daftar file, dan ZIP, jadi tool cukup menyediakan panel pengaturan dan fungsi `process()`. Lihat `js/tools/image-resizer.js` sebagai contoh.
