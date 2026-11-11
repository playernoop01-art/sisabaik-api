import * as service from "../services/pesanan.js";
import {
  idValid,
  halamanValid,
  objekValid,
  teksValid,
  salah,
} from "../lib/api.js";
import { pesananSesiValid } from "../lib/input-auth.js";

export async function daftar(req, res) {
  const hasil = await service.daftarPesanan(
    halamanValid(req.query),
    req.pengguna,
  );

  return res.json({ success: true, ...hasil });
}

export async function detail(req, res) {
  const hasil = await service.detailPesanan(
    idValid(req.params.id),
    req.pengguna,
  );

  return res.json({ success: true, data: hasil });
}

export async function buat(req, res) {
  const hasil = await service.buatPesanan(
    pesananSesiValid(req.body, req.pengguna),
    req.pengguna,
  );

  return res
    .status(201)
    .location(`/api/pesanan/${hasil.id}`)
    .json({ success: true, data: hasil });
}

export async function aksi(req, res) {
  objekValid(req.body, [
    "aksi",
    "alasan",
    "makananDiserahkan",
    "pembayaranDiterima",
  ]);

  const aksiDiizinkan = ["konfirmasi", "siap", "selesai", "batal", "tolak"];

  if (
    typeof req.body.aksi !== "string" ||
    !aksiDiizinkan.includes(req.body.aksi)
  ) {
    salah("Aksi pesanan tidak dikenal.");
  }

  const data = { aksi: req.body.aksi };

  if (["batal", "tolak"].includes(data.aksi)) {
    data.alasan = teksValid(req.body.alasan, "alasan", 3, 500);
  }

  if (data.aksi === "selesai") {
    if (typeof req.body.makananDiserahkan !== "boolean") {
      salah("makananDiserahkan wajib berupa boolean.");
    }

    if (typeof req.body.pembayaranDiterima !== "boolean") {
      salah("pembayaranDiterima wajib berupa boolean.");
    }

    data.makananDiserahkan = req.body.makananDiserahkan;
    data.pembayaranDiterima = req.body.pembayaranDiterima;
  }

  const hasil = await service.aksiPesanan(
    idValid(req.params.id),
    data,
    req.pengguna,
  );

  return res.json({ success: true, data: hasil });
}
