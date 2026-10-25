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
