# SisaBaik API

SisaBaik adalah aplikasi untuk membantu penyaluran makanan berlebih agar dapat dimanfaatkan dan mengurangi pemborosan makanan.

## Teknologi

- Node.js
- Express.js
- PostgreSQL
- HTML, CSS, dan JavaScript

## Fitur

- Registrasi dan login pengguna
- Autentikasi dan otorisasi berdasarkan peran (RBAC)
- Registrasi penyedia makanan
- Verifikasi akun penyedia
- Pengelolaan penawaran makanan
- Pemesanan makanan

## Persyaratan

- Node.js
- PostgreSQL
- Database sisabaik_dev

## Cara Menjalankan

1. Instal dependensi:

   npm install

2. Siapkan konfigurasi database pada file .env.

3. Jalankan server:

   npm run dev

4. Buka aplikasi melalui:

   http://127.0.0.1:3000

## Pengujian Autentikasi

Jalankan server terlebih dahulu, kemudian buka terminal lain:

node --env-file=.env scripts/uji-auth.js

## Struktur Proyek

- database/ : skema dan data database
- public/ : antarmuka web
- scripts/ : skrip pengujian
- src/ : kode backend
- server.js : titik masuk server

## Modul 9 – Frontend Vue

### Persyaratan

- Node.js v24.21.0 (minimal >=22).
- npm.
- Browser modern.

### Instalasi

Dari root repositori:

```bash
cd frontend
npm install
```

Alternatif menggunakan lockfile:

```bash
npm ci
```

### Menjalankan Aplikasi

```bash
npm run dev
npm run build
npm run preview
```

Alamat development: `http://127.0.0.1:5173/`

Alamat preview: `http://127.0.0.1:4173/`

### Aset SVG

Aset visual berada di `frontend/src/assets/`:

- brand-mark.svg
- food-bowl.svg
- food-bread.svg
- food-produce.svg

### Data Fixture

Frontend menggunakan fixture di memori melalui `penawaran-latihan.js`. Perubahan data hanya berlaku selama sesi berjalan dan kembali ke kondisi awal setelah halaman dimuat ulang.

### Integrasi Backend

Pada Modul 9, browser belum melakukan pemanggilan API backend.

Backend Modul 8 tetap memiliki pendaftaran mandiri, verifikasi penyedia, autentikasi, dan otorisasi berdasarkan peran pengguna (RBAC).

Integrasi frontend dengan backend Modul 8 dilaksanakan pada pertemuan 11.

### Hasil Pengujian

Dokumentasi hasil pengujian dan screenshot tersedia di `docs/hasil-uji-chapter9.md`.
