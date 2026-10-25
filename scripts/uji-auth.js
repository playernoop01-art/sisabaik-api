import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { verifikasiPenyedia } from "./verifikasi-penyedia.js";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const tujuan = new URL(base);

if (
  tujuan.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(tujuan.hostname) ||
  !["localhost", "127.0.0.1"].includes(process.env.PGHOST) ||
  process.env.PGDATABASE !== "sisabaik_dev"
) {
  throw new Error("Uji ini hanya untuk HTTP dan database praktikum lokal.");
}

const password = randomBytes(18).toString("hex");
const marker = `Uji Auth ${Date.now()}-${randomBytes(3).toString("hex")}`;
const suffix = marker.replace(/[^a-z0-9-]/gi, "").toLowerCase();

const emailRina = `rina.${suffix}@example.test`;
const emailBudi = `budi.${suffix}@example.test`;
const emailSiti = `siti.${suffix}@example.test`;
const emailAndi = `andi.${suffix}@example.test`;

let checks = 0;

async function api(path, method = "GET", body, token) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(new URL(path, base), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = response.status === 204 ? "" : await response.text();

  let hasil = null;

  if (text) {
    try {
      hasil = JSON.parse(text);
    } catch {
      throw new Error(`Respons bukan JSON: HTTP ${response.status}, ${path}`);
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body: hasil,
  };
}

function status(response, expected) {
  assert.equal(
    response.status,
    expected,
    `HTTP ${response.status}, diharapkan ${expected}; ` +
      `code=${response.body?.error?.code ?? "-"}`,
  );

  checks++;
}

function sama(actual, expected, message) {
  assert.equal(actual, expected, message);
  checks++;
}

function benar(value, message) {
  assert.ok(value, message);
  checks++;
}

function samaDalam(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
}

async function login(email) {
  const response = await api("/api/auth/login", "POST", {
    email,
    kataSandi: password,
  });

  status(response, 200);

  benar(
    Boolean(response.body?.data?.accessToken),
    "Respons login harus berisi accessToken.",
  );

  benar(
    Boolean(response.body?.data?.pengguna),
    "Respons login harus berisi data pengguna.",
  );

  return response.body.data;
}

try {
  // 1. Pemeriksaan autentikasi.
  status(await api("/api/pesanan"), 401);

  status(await api("/api/auth/saya", "GET", undefined, "token-rusak"), 401);

  const db = await pool.query("SELECT current_database() AS nama");

  sama(
    db.rows[0].nama,
    "sisabaik_dev",
    "Script harus menggunakan database praktikum.",
  );

  // 2. Registrasi dan verifikasi dua penyedia.
  for (const [email, nama] of [
    [emailRina, "Rina Uji"],
    [emailBudi, "Budi Uji"],
  ]) {
    const registrasi = await api("/api/auth/registrasi-penyedia", "POST", {
      namaLengkap: nama,
      email,
      kataSandi: password,
      namaUsaha: `Dapur ${nama}`,
      alamat: "Jl. Kampus No. 8, Padang",
      nomorTelepon: "+6281234567890",
    });

    status(registrasi, 201);

    sama(registrasi.body.data.peran, "penyedia", "Peran akun harus penyedia.");

    sama(
      registrasi.body.data.statusVerifikasi,
      "menunggu",
      "Penyedia baru harus menunggu verifikasi.",
    );

    sama(
      registrasi.body.data.namaUsaha,
      `Dapur ${nama}`,
      "Nama usaha harus sesuai.",
    );

    const sesi = await login(email);

    const pending = await api(
      "/api/penawaran/milik-saya",
      "GET",
      undefined,
      sesi.accessToken,
    );

    status(pending, 403);

    sama(
      pending.body.error.code,
      "PROVIDER_NOT_VERIFIED",
      "Penyedia yang belum terverifikasi tidak boleh mengelola penawaran.",
    );

    const dbAkun = (
      await pool.query(
        `SELECT id, kata_sandi_hash
         FROM pengguna
         WHERE email = $1`,
        [email],
      )
    ).rows[0];

    benar(
      Boolean(dbAkun),
      "Akun hasil registrasi harus tersimpan di database.",
    );

    sama(
      String(dbAkun.id),
      String(registrasi.body.data.id),
      "Server HTTP dan script harus menggunakan database yang sama.",
    );

    benar(
      Boolean(dbAkun.kata_sandi_hash) && dbAkun.kata_sandi_hash !== password,
      "Kata sandi harus disimpan sebagai hash, bukan teks biasa.",
    );

    await verifikasiPenyedia(pool, email);

    const fresh = await api(
      "/api/auth/saya",
      "GET",
      undefined,
      sesi.accessToken,
    );

    status(fresh, 200);

    sama(
      fresh.body.data.statusVerifikasi,
      "terverifikasi",
      "Status verifikasi harus diperbarui.",
    );
  }

  const rina = await login(emailRina);
  const budi = await login(emailBudi);

  // 3. Registrasi pembeli dan validasi registrasi.
  const dataSiti = {
    namaLengkap: "Pembeli Uji",
    email: emailSiti,
    kataSandi: password,
  };

  const regSiti = await api("/api/auth/registrasi", "POST", dataSiti);

  status(regSiti, 201);

  sama(
    regSiti.body.data.peran,
    "pembeli",
    "Registrasi biasa harus menghasilkan akun pembeli.",
  );

  benar(
    !("kata_sandi_hash" in regSiti.body.data),
    "Hash kata sandi tidak boleh dikembalikan oleh API.",
  );

  status(
    await api("/api/auth/registrasi", "POST", {
      ...dataSiti,
      peran: "penyedia",
    }),
    400,
  );

  status(await api("/api/auth/registrasi", "POST", dataSiti), 409);

  const regAndi = await api("/api/auth/registrasi", "POST", {
    namaLengkap: "Andi Uji",
    email: emailAndi,
    kataSandi: password,
  });

  status(regAndi, 201);

  const siti = await login(emailSiti);
  const siti2 = await login(emailSiti);
  const andi = await login(emailAndi);

  // 4. Isolasi daftar pesanan.
  const pesananAndi = await api(
    "/api/pesanan",
    "GET",
    undefined,
    andi.accessToken,
  );

  status(pesananAndi, 200);

  sama(
    pesananAndi.body.meta.jumlah,
    0,
    "Pembeli baru tidak boleh melihat pesanan pengguna lain.",
  );

  // 5. Pesan kesalahan login tidak membocorkan keberadaan akun.
  const salah = await api("/api/auth/login", "POST", {
    email: emailSiti,
    kataSandi: "ini kata sandi yang salah",
  });

  const asing = await api("/api/auth/login", "POST", {
    email: `tidak.ada.${suffix}@example.test`,
    kataSandi: password,
  });

  status(salah, 401);
  status(asing, 401);

  samaDalam(
    salah.body,
    asing.body,
    "Respons login gagal harus sama untuk akun yang ada dan tidak ada.",
  );

  // 6. Uji kontrol akses penawaran.
  const payload = {
    nama: marker,
    kategori: "roti",
    hargaNormal: 10000,
    hargaPenawaran: 5000,
    stok: 5,
    satuan: "paket",
    status: "aktif",
    berakhirPada: new Date(Date.now() + 86400000).toISOString(),
  };

  status(await api("/api/penawaran", "POST", payload, siti.accessToken), 403);

  status(
    await api(
      "/api/penawaran",
      "POST",
      {
        ...payload,
        penyediaId: budi.pengguna.penyediaId,
      },
      rina.accessToken,
    ),
    400,
  );

  const buat = await api("/api/penawaran", "POST", payload, rina.accessToken);

  status(buat, 201);

  const id = buat.body.data.id;

  sama(
    String(buat.body.data.penyediaId),
    String(rina.pengguna.penyediaId),
    "Penawaran harus dimiliki penyedia yang membuatnya.",
  );

  status(
    await api(`/api/penawaran/${id}`, "PUT", payload, budi.accessToken),
    404,
  );

  status(
    await api(`/api/penawaran/${id}`, "DELETE", undefined, budi.accessToken),
    404,
  );

  // 7. Uji kontrol akses dan pembuatan pesanan.
  const orderBody = {
    items: [{ penawaranId: id, kuantitas: 1 }],
  };

  status(await api("/api/pesanan", "POST", orderBody, rina.accessToken), 403);

  status(
    await api(
      "/api/pesanan",
      "POST",
      {
        ...orderBody,
        emailPembeli: emailSiti,
      },
      siti.accessToken,
    ),
    400,
  );

  const order = await api("/api/pesanan", "POST", orderBody, siti.accessToken);

  status(order, 201);

  const orderId = order.body.data.id;

  sama(
    String(order.body.data.pembeliId),
    String(siti.pengguna.id),
    "Pesanan harus terkait dengan pembeli yang login.",
  );

  sama(
    Number(order.body.data.total),
    5000,
    "Total pesanan harus sesuai harga penawaran.",
  );

  status(
    await api(`/api/pesanan/${orderId}`, "GET", undefined, andi.accessToken),
    404,
  );

  status(
    await api(`/api/pesanan/${orderId}`, "GET", undefined, budi.accessToken),
    404,
  );

  status(
    await api(`/api/pesanan/${orderId}`, "GET", undefined, rina.accessToken),
    200,
  );

  const daftarPesanan = await api(
    "/api/pesanan?limit=50",
    "GET",
    undefined,
    siti.accessToken,
  );

  status(daftarPesanan, 200);

  benar(
    daftarPesanan.body.data.every(
      (p) => String(p.pembeliId) === String(siti.pengguna.id),
    ),
    "Pembeli hanya boleh melihat pesanan miliknya.",
  );

  const milikBudi = await api(
    "/api/penawaran/milik-saya?limit=50",
    "GET",
    undefined,
    budi.accessToken,
  );

  status(milikBudi, 200);

  benar(
    milikBudi.body.data.every(
      (p) => String(p.penyediaId) === String(budi.pengguna.penyediaId),
    ),
    "Penyedia hanya boleh melihat penawarannya sendiri.",
  );

  // 8. Uji pembaruan penawaran dan snapshot harga.
  status(
    await api(
      `/api/penawaran/${id}`,
      "PUT",
      {
        ...payload,
        stok: 4,
        hargaPenawaran: 6000,
      },
      rina.accessToken,
    ),
    200,
  );

  const snapshot = await api(
    `/api/pesanan/${orderId}`,
    "GET",
    undefined,
    siti.accessToken,
  );

  status(snapshot, 200);

  sama(
    Number(snapshot.body.data.items[0].hargaSatuan),
    5000,
    "Harga pada pesanan lama harus tetap sama setelah harga penawaran berubah.",
  );

  status(
    await api(`/api/penawaran/${id}`, "DELETE", undefined, rina.accessToken),
    409,
  );

  // 9. Uji penawaran draft.
  const draft = await api(
    "/api/penawaran",
    "POST",
    {
      ...payload,
      nama: `${marker} draft`,
      status: "draft",
    },
    rina.accessToken,
  );

  status(draft, 201);

  status(await api(`/api/penawaran/${draft.body.data.id}`), 404);

  status(
    await api(
      `/api/penawaran/${draft.body.data.id}`,
      "DELETE",
      undefined,
      rina.accessToken,
    ),
    204,
  );

  // 10. Uji logout seluruh sesi.
  status(await api("/api/auth/logout", "POST", {}, siti.accessToken), 204);

  status(await api("/api/auth/saya", "GET", undefined, siti.accessToken), 401);

  status(await api("/api/auth/saya", "GET", undefined, siti2.accessToken), 401);

  console.log(`PASS: ${checks} pemeriksaan HTTP dan assertion.`);

  console.log(`Bukti: penawaran ${id}, pesanan ${orderId}.`);

  console.log(
    "Empat akun uji dibuat dengan kata sandi acak yang tidak dicetak.",
  );

  console.log("Fixture dipertahankan untuk pemeriksaan lanjutan.");
} catch (error) {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
