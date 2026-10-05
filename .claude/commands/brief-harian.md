---
description: Satu brief video siap eksekusi untuk hari ini, plus dua cadangan
argument-hint: "[topik atau cadangan yang mau dipakai (opsional)]"
---

Tulis **brief harian** @hikmamirz untuk hari ini.

Arahan dari pengguna: $ARGUMENTS
(Kalau diisi, pakai topik itu sebagai pilihan utama dan lewati langkah 2.)

Baca dulu `.claude/profil/strategi-konten.md` dan `.claude/profil/hikmamirz.md`. Perintah ini bisa berjalan terjadwal tanpa pengguna: jangan bertanya, jangan melakukan tindakan keluar, jangan memanggil vidIQ, hasilnya hanya file.

1. **Konteks**: baca rencana minggu ini di `kantor/konten/rencana/`, `kantor/konten/riwayat.md`, bagian "Baru" di kotak ide, dan catatan "kandidat besok" di brief kemarin. Kalau rencana minggu ini belum ada, lanjutkan tanpa rencana dan sebut itu di catatan brief.
2. **Pilih cerita**: cari hasil laga 24 jam terakhir lewat WebSearch, lalu terapkan "Memilih cerita reaktif" di strategi. Hanya pakai laga yang sudah selesai dan skornya terkonfirmasi dari sumber. Ide kotak yang terkait laga 48 jam terakhir boleh menyalip. Kalau tidak ada kandidat reaktif yang kuat, ambil slot evergreen atau eksperimen dari rencana. Tentukan 1 pilihan utama dan 2 cadangan.
3. **Tulis brief** (agent `penulis-skrip`): isi `.claude/templat/brief-harian.md` untuk pilihan utama. Skor, pencetak gol, dan kutipan harus dari sumber; yang belum pasti ditandai `[CEK: ...]`. Jangan mengarang.

Simpan ke `kantor/konten/brief/<YYYY-MM-DD>.md`, lalu tambahkan satu baris ke `kantor/konten/riwayat.md`. Kalau folder Drive di strategi sudah diisi, salin brief ke sana. Akhiri dengan tiga baris: judul kerja pilihan utama, hook terbaik, dan dua cadangan.
