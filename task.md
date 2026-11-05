# Task List: Invoice Generator (Flowly)

- **Dokumen Terkait**: [prd.md](file:///e:/PROJECT/TOOLS%20AI/prd.md), [design.md](file:///e:/PROJECT/TOOLS%20AI/design.md), [progress.md](file:///e:/PROJECT/TOOLS%20AI/progress.md)
- **Status Proyek**: Selesai (Completed & Verified v1.3.0 - Modular & Optional Features)

---

## Fase 1: Perencanaan & Spesifikasi
- [x] Analisis struktur proyek Kitforge dan kebutuhan profil bisnis NuhaWeb/Freelance
- [x] Buat dokumen `prd.md` (Product Requirements Document)
- [x] Buat dokumen `design.md` (Spesifikasi Teknis & Desain UI/UX)
- [x] Buat dokumen `task.md` (Daftar Tugas & Rincian Pekerjaan)
- [x] Buat dokumen `progress.md` (Pelacak Kemajuan Proyek)

---

## Fase 2: Pendaftaran Alat & Utilitas Inti
- [x] Tambahkan ikon pendukung di `js/lib/util.js` (`whatsapp`, `pen`, `qr`, `globe`, dll)
- [x] Daftarkan metadata tool `invoice-generator` (`Flowly`) di `js/registry.js`
- [x] Buat modul `js/tools/invoice-generator.js` dengan fungsi `mount(el)`

---

## Fase 3: Struktur Formulir & Antarmuka Pengguna
- [x] Buat layout 2 kolom (Editor di kiri, Live Preview sticky di kanan)
- [x] Buat tab navigasi utama (`Buat Invoice`, `Riwayat`, `Pelanggan`, `Profil Bisnis`)
- [x] Buat form Invoice Information (Nomor otomatis, kombinasi format Romawi/MM/SEQ, tanggal terbit & tempo)
- [x] Buat selector Billed To dengan modal Tambah Pelanggan Baru cepat
- [x] Buat tabel item dinamis (Tambah item, Hapus baris, Qty, Unit Price)
- [x] Buat kalkulasi Pajak % dan Diskon

---

## Fase 4: Logika Reaktif, Kalkulasi & Format
- [x] Implementasikan fungsi kalkulasi keuangan lengkap (`computeTotals`)
- [x] Implementasikan multi-kurs: `IDR` (Rp), `MYR` (RM), `USD` ($), `SGD` (S$)
- [x] Implementasikan generator nomor urut tahunan berbasis bulan Romawi (`toRoman`, `generateInvoiceNumber`)

---

## Fase 5: Tampilan Lembar Faktur (Live Preview) & Cetak PDF
- [x] Buat komponen lembar kertas faktur A4 (`#invoice-printable-paper`)
- [x] Implementasikan aturan CSS `@media print` presisi tanpa halaman kedua kosong
- [x] Isolasi breakpoint layar kecil ke `@media screen and (...)` agar tidak mengganggu layout cetak A4

---

## Fase 6: Penyimpanan & Sinkronisasi
- [x] Implementasikan penyimpanan otomatis ke browser `localStorage`
- [x] Implementasikan backend Vercel KV / lokal file (`/api/invoices`)
- [x] Sinkronisasi data klien, profil usaha, dan riwayat invoice

---

## Fase 7: Fitur Tambahan Opsional & Fleksibel (v1.3.0)
- [x] **Multi-Tipe Dokumen**: Pilihan antara `Invoice` (Faktur), `Quotation` (Penawaran), dan `Receipt` (Kuitansi dengan watermark stempel LUNAS).
- [x] **Dwibahasa (Bilingual)**: Pilihan antara `Bahasa Indonesia` dan `English` untuk pratinjau dan cetak PDF.
- [x] **Termin / Uang Muka (DP)**: Sakelar opsional untuk memasukkan DP (% atau fixed) dan menampilkan Sisa Tagihan (Balance Due).
- [x] **Teks Terbilang Otomatis**: Sakelar opsional untuk mengonversi angka ke kata secara otomatis.
- [x] **QRIS Pembayaran**: Sakelar opsional untuk mengunggah gambar QRIS dan menampilkannya di samping info transfer bank.
- [x] **Tanda Tangan & Stempel**: Sakelar opsional dengan dukungan upload file gambar dan **Signature Pad canvas interaktif** untuk menggambar tanda tangan langsung.
- [x] **1-Click WhatsApp Tagihan**: Tombol tindakan untuk membuka WhatsApp Web/App dengan teks tagihan siap kirim.
