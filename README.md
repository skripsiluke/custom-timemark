# LA Timemark v1.2

Aplikasi web untuk menempelkan timestamp lokasi/kegiatan pada foto, berjalan di browser.

## Fitur
- Upload foto portrait maupun landscape; orientasi dan resolusi asli foto dipertahankan saat ekspor.
- Peta mini otomatis dari koordinat dengan pin lokasi dan kerucut arah jika sensor kompas tersedia.
- Elevasi otomatis berdasarkan latitude/longitude melalui Open-Meteo Elevation API.
- Sensor kompas perangkat jika browser dan perangkat mendukungnya.
- Logo instansi, judul kegiatan, tanggal, waktu, alamat, watermark dan warna dapat diatur.
- Ekspor JPEG dilakukan di browser.

## Deploy GitHub Pages
1. Buat repository GitHub bernama `custom-timemark` (atau nama pilihan).
2. Upload `index.html` ke root repository.
3. Buka Settings -> Pages.
4. Pilih Deploy from a branch, branch `main`, folder `/ (root)`, lalu Save.
5. Buka URL GitHub Pages yang ditampilkan GitHub.

## Catatan teknis
- Peta menggunakan tile OpenStreetMap. Perlu koneksi internet; atribusi © OpenStreetMap ditampilkan pada peta.
- Peta dibuat otomatis dari koordinat dan dimuat dari tile OpenStreetMap. Jika tile server tidak tersedia atau offline, peta tidak muncul.
- Elevasi adalah estimasi elevasi medan dari layanan Open-Meteo, bukan pembacaan altimeter langsung.
- Kompas hanya tersedia pada perangkat/browser yang menyediakan sensor orientasi; izin dan HTTPS mungkin diperlukan.
- Arah tidak bisa dihitung dari satu titik koordinat saja.
- Data lokasi/waktu adalah data input/perangkat dan bukan sertifikat autentikasi foto.
- Foto diproses lokal di browser; koordinat elevasi dan permintaan tile peta dikirim ke layanan pihak ketiga sesuai kebutuhan pemetaan.
