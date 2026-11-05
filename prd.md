# Product Requirements Document (PRD)
## Fitur: Invoice Generator (Flowly)

- **Nama Tool**: Flowly
- **Tagline**: Professional Invoice & Business Document Generator
- **Grup**: Business Lab
- **Platform**: Kitforge (Browser-native toolkit with Vercel KV Sync)
- **Versi**: 1.3.0 (Modular & Optional Features)
- **Status**: Updated & Implemented
- **Tanggal Dibuat**: 2026-11-05

---

## 1. Latar Belakang & Rasional

Flowly dirancang untuk memberikan kebebasan dan fleksibilitas penuh kepada pemilik usaha kecil, freelancer, dan agensi dalam membuat dokumen transaksi bisnis yang profesional. Setiap bisnis memiliki kebutuhan yang berbeda: ada yang membutuhkan invoice dengan termin (DP), ada penawaran harga awal (quotation), kuitansi pelunasan lunas (receipt), tanda tangan resmi, terbilang otomatis, maupun QRIS pembayaran.

Pada versi 1.3.0 ini, Flowly menambahkan fitur-fitur tersebut dengan prinsip **100% Opsional / Modular**:
Pengguna dapat memilih secara bebas fitur mana saja yang ingin diaktifkan atau dinonaktifkan tanpa membebani dokumen sederhana yang tidak memerlukannya.

---

## 2. Kebutuhan Fungsional Fitur Opsional

### FR-1: Multi-Tipe Dokumen
- Pilihan tipe: `Invoice / Faktur`, `Quotation / Penawaran`, `Receipt / Kuitansi`.
- Penyesuaian otomatis kop surat, penomoran prefix (`INV`, `QUO`, `REC`), label tanggal, dan watermark stempel "LUNAS / PAID".

### FR-2: Pilihan Bahasa (Dwibahasa ID & EN)
- Pengguna dapat memilih antara `🇮🇩 Bahasa Indonesia` dan `🇬🇧 English`.
- Mengubah seluruh label dokumen pratinjau dan hasil cetak PDF.

### FR-3: Sakelar Termin / Uang Muka (DP)
- Sakelar toggle ON / OFF.
- Pilihan persentase (%) atau nominal tetap.
- Menghitung live nilai DP dan Sisa Tagihan (Balance Due).

### FR-4: Sakelar Teks Terbilang Otomatis
- Sakelar toggle ON / OFF.
- Mengonversi nominal grand total / DP ke kata-kata dalam Bahasa Indonesia atau English secara otomatis.

### FR-5: Sakelar QRIS Pembayaran
- Sakelar toggle ON / OFF.
- Unggah gambar QRIS dengan kompresi lokal ringan.
- Tampil berdampingan dengan rekening transfer bank.

### FR-6: Sakelar Tanda Tangan & Stempel Resmi
- Sakelar toggle ON / OFF.
- Mendukung unggah gambar tanda tangan dan stempel perusahaan transparan.
- Dilengkapi **Signature Pad canvas interaktif** untuk menggambar tanda tangan langsung menggunakan mouse atau layar sentuh.
- Pengaturan kota penerbitan, nama penandatangan, dan jabatan.

### FR-7: 1-Click WhatsApp Tagihan (WA Billing)
- Tombol WhatsApp di toolbar atas, pratinjau, dan riwayat invoice.
- Otomatis merangkum teks penagihan yang ramah, sopan, dan terformat rapi untuk dikirimkan langsung ke nomor WhatsApp klien.
