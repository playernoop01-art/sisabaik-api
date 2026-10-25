# Dokumentasi Autentikasi SisaBaik

## Registrasi
Pengguna dapat mendaftar sebagai pembeli atau penyedia makanan.

## Login
Pengguna masuk menggunakan email dan kata sandi yang telah didaftarkan.

## Role-Based Access Control (RBAC)
Akses fitur dibatasi berdasarkan peran pengguna.

- pembeli: dapat melihat dan memesan penawaran makanan.
- penyedia: dapat mengelola penawaran sesuai status akun dan aturan aplikasi.

## Verifikasi Penyedia
Status verifikasi penyedia meliputi:

- menunggu
- terverifikasi
- ditolak

Penyedia yang belum terverifikasi hanya dapat menggunakan fitur yang diizinkan oleh aturan aplikasi.
