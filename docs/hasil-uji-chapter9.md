# Hasil Pengujian Chapter 9 – Frontend Vue SisaBaik

## 1. Identitas Pengujian

| Keterangan    | Informasi                                    |
| ------------- | -------------------------------------------- |
| Penguji       | Kamal Abdullah                               |
| NIM           | 23367070                                     |
| Program Studi | Bisnis Digital                               |
| Universitas   | Universitas Negeri Padang                    |
| Modul         | Chapter 9 – Frontend Vue                     |
| Versi Node.js | v24.21.0                                     |
| Commit        | Isi berdasarkan `git rev-parse --short HEAD` |
| Branch        | Isi berdasarkan `git branch --show-current`  |

## 2. Lingkungan Pengujian

Pengujian dilakukan menggunakan:

- Node.js v24.21.0.
- npm sesuai instalasi Node.js.
- Vue dan Vite.
- Browser Google Chrome.
- Resolusi pengujian desktop, tablet, dan mobile.

Perintah instalasi dan pengujian:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run preview
```

## 3. Hasil Pengujian Aktual

### A. Tampilan Katalog Pembeli

Hasil pengujian:

- Katalog menampilkan 3 kartu penawaran.
- Total tersedia sebanyak 15 unit.
- Terdapat 2 penyedia.
- Informasi penawaran ditampilkan melalui komponen kartu.

Status: Berhasil.

### B. Tampilan Penyedia

Pengujian menggunakan fixture penyedia Rina.

Hasil pengujian:

- Terdapat 3 kartu penawaran.
- Termasuk 1 penawaran draft.
- Terdapat 2 penawaran tersedia.
- Total stok tersedia sebanyak 9 unit.

Status: Berhasil.

### C. Pengujian Formulir Invalid

Formulir diuji menggunakan input yang tidak memenuhi validasi, termasuk harga gratis sebesar Rp0.

Hasil pengujian: input yang tidak memenuhi ketentuan validasi tidak langsung diproses sebagai penawaran valid.

Status: Berhasil.

### D. Pengujian Formulir Valid

Formulir diuji menggunakan penawaran gratis dengan harga Rp0.

Hasil pengujian:

- Jumlah penawaran bertambah menjadi 4.
- Penawaran tersedia menjadi 3.
- Total stok tersedia menjadi 14 unit.

Status: Berhasil.

### E. Ringkasan Setelah Penambahan Penawaran

Hasil pengujian pada sisi pembeli:

- Jumlah kartu penawaran: 4.
- Total unit tersedia: 17.
- Data berasal dari perubahan fixture selama sesi berjalan.

Status: Berhasil.

### F. Pengujian Refresh

Setelah halaman dimuat ulang, data kembali ke kondisi awal karena penyimpanan masih menggunakan fixture di memori dan belum menggunakan database atau API backend.

Status: Berhasil sesuai rancangan Modul 9.

## 4. Aliran Props dan Emits

Komunikasi antarkomponen frontend menggunakan mekanisme props dan emits Vue.

Aliran komponen:

1. `App.vue` menjadi komponen utama yang mengatur tampilan dan data aplikasi.
2. `FilterPenawaran.vue` menerima data atau konfigurasi filter melalui props dan mengirim perubahan filter melalui emits.
3. `KartuPenawaran.vue` menerima informasi penawaran melalui props untuk menampilkan kartu katalog.
4. `FormPenawaran.vue` menerima kebutuhan tampilan formulir melalui props dan mengirimkan data formulir melalui emits.
5. `App.vue` memproses perubahan data dan memperbarui ringkasan tampilan.

Catatan: nama event dan props aktual mengikuti implementasi komponen pada source code.

## 5. Pengujian Responsivitas

Pengujian dilakukan pada tiga ukuran layar:

| Perangkat | Resolusi | Hasil    |
| --------- | -------: | -------- |
| Mobile    |   375 px | Berhasil |
| Tablet    |   768 px | Berhasil |
| Desktop   |  1280 px | Berhasil |

Tampilan diuji untuk memastikan katalog, formulir, navigasi, dan komponen lainnya dapat menyesuaikan ukuran layar.

## 6. Pengujian Build

Perintah:

```bash
npm run build
```

Hasil: build frontend berhasil setelah dependensi Vite terpasang pada direktori frontend.

Perintah preview:

```bash
npm run preview
```

Hasil: aplikasi hasil build dapat dijalankan melalui server preview pada port 4173.

## 7. Dokumentasi Screenshot

Screenshot berikut menjadi bukti pelaksanaan pengujian:

1. **Screenshot 1 – Katalog:** tampilan katalog penawaran pembeli.
2. **Screenshot 2 – Empty State:** tampilan ketika tidak ada penawaran yang ditampilkan.
3. **Screenshot 3 – Form Invalid:** tampilan formulir ketika input tidak valid.
4. **Screenshot 4 – Form Valid:** tampilan formulir setelah input valid.
5. **Screenshot 5 – Mobile:** tampilan aplikasi pada resolusi 375 px.
6. **Screenshot 6 – Terminal Build:** bukti keberhasilan perintah `npm run build`.

Simpan screenshot pada folder:

`docs/screenshots/`

## 8. Kesimpulan

Berdasarkan hasil pengujian, frontend Vue SisaBaik pada Chapter 9 telah berhasil menjalankan komponen katalog, formulir penawaran, filter, ringkasan pembeli dan penyedia, serta tampilan responsif.

Pengujian juga menunjukkan bahwa perubahan data masih bersifat sementara karena aplikasi menggunakan fixture di memori. Browser belum melakukan pemanggilan API backend.

Backend Modul 8 tetap memiliki fitur pendaftaran mandiri, verifikasi penyedia, autentikasi, dan otorisasi. Integrasi frontend dan backend akan dilakukan pada pertemuan 11.

Dengan demikian, implementasi frontend Chapter 9 telah memenuhi skenario pengujian yang direncanakan.
