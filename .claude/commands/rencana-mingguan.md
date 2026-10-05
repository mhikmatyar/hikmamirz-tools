---
description: Rencana konten 7 hari untuk @hikmamirz dari jadwal laga, performa minggu lalu, dan kotak ide
argument-hint: "[arahan khusus minggu ini (opsional)]"
---

Susun **rencana mingguan** @hikmamirz untuk Senin–Minggu berikutnya.

Arahan dari pengguna: $ARGUMENTS

Baca dulu `.claude/profil/strategi-konten.md` dan `.claude/profil/hikmamirz.md`. Perintah ini bisa berjalan terjadwal tanpa pengguna: jangan bertanya, jangan melakukan tindakan keluar, hasilnya hanya file.

1. **Riset** (agent `riset-konten`):
   - Jadwal laga 7 hari ke depan dengan jam kickoff WIB: Liverpool, laga besar liga top Eropa, kompetisi Eropa, timnas. Pakai WebSearch dan cantumkan sumbernya.
   - Performa reel minggu lalu dan outlier baru di niche lewat vidIQ. Kalau kredit vidIQ habis, tulis itu di rencana dan lanjutkan tanpa datanya.
   - Tambahkan pelajaran baru ke bagian "Pelajaran" di `.claude/profil/hikmamirz.md`, dengan tanggal dan angka.
2. **Kotak ide**: baca `kantor/konten/kotak-ide.md` (buat dari `.claude/templat/kotak-ide.md` kalau belum ada). Pindahkan tiap ide di "Baru" ke "Masuk rencana" atau "Ditolak atau ditunda", dengan alasan satu kalimat.
3. **Stok evergreen**: hitung dari `kantor/konten/weekend/` dan `riwayat.md` berapa brief evergreen yang belum dipakai. Kalau tidak bisa dipastikan, tulis `[ISI: jumlah video evergreen siap tayang]`.
4. **Rencana**: tabel 7 hari berisi tanggal, jalur, pilar, kandidat cerita, dan laga pemicunya. Hari tanpa laga kuat diisi evergreen. Sisakan tepat 1 slot eksperimen. Jangan mengulang ide yang ada di `kantor/konten/riwayat.md`.

Simpan ke `kantor/konten/rencana/<YYYY-MM-DD>.md` (tanggal hari Senin). Akhiri dengan ringkasan 5 baris dalam Bahasa Indonesia: laga kunci pekan ini, jumlah slot per jalur, ide kotak yang masuk, kondisi stok evergreen, dan hal yang perlu diputuskan pengguna.
