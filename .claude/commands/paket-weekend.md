---
description: Paket 3–4 brief evergreen untuk produksi borongan di akhir pekan
argument-hint: "[jumlah brief atau tema (opsional)]"
---

Siapkan **paket weekend** @hikmamirz untuk produksi Sabtu–Minggu.

Arahan dari pengguna: $ARGUMENTS
(Kalau kosong, buat 3 brief; buat 4 kalau stok evergreen di bawah 3.)

Baca dulu `.claude/profil/strategi-konten.md` dan `.claude/profil/hikmamirz.md`. Perintah ini bisa berjalan terjadwal tanpa pengguna: jangan bertanya, jangan melakukan tindakan keluar, jangan memanggil vidIQ, hasilnya hanya file.

1. **Kumpulkan kandidat**: slot evergreen di rencana minggu ini, ide di "Masuk rencana" dan "Baru" pada kotak ide, dan seri bernama yang sudah berjalan. Buang yang sudah ada di `kantor/konten/riwayat.md`.
2. **Pilih**: utamakan cerita dengan pemain atau pelatih yang dikenal global dan busur emosional yang jelas. Kalau satu seri sudah punya episode, lanjutkan serinya. Paling banyak 1 brief eksperimen.
3. **Tulis brief** (agent `penulis-skrip`): satu brief per ide memakai `.claude/templat/brief-harian.md`, tanpa bagian cadangan. Fakta sejarah (tahun, skor, nama) diverifikasi lewat WebSearch dengan sumber; yang belum pasti ditandai `[CEK: ...]`.
4. **Usulan jadwal tayang**: cocokkan tiap video dengan hari kosong di rencana minggu depan. Ini usulan saja; penjadwalan posting dilakukan setelah pengguna setuju.

Simpan ke `kantor/konten/weekend/<YYYY-MM-DD>.md` (tanggal hari Sabtu), lalu tambahkan satu baris per brief ke `kantor/konten/riwayat.md`. Kalau folder Drive di strategi sudah diisi, salin paketnya ke sana. Akhiri dengan daftar judul kerja dan usulan hari tayangnya.
