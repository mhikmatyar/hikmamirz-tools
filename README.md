# Hikmamirz Tools

Kumpulan tools yang berjalan langsung di browser. Tidak perlu build, dan file tidak di-upload ke server.

## Tools

- **Image to WebP**: ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP. Pilih tingkat kompresi (preset atau kualitas 1–100) dan batas ukuran. Proses massal tanpa batas jumlah, lalu download per file atau sekaligus dalam ZIP.

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
