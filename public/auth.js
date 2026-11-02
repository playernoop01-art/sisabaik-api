"use strict";

const el = (id) => document.getElementById(id);

let token = null;
let pengguna = null;
let sibuk = false;

function tampilSesi() {
  const penyedia = pengguna?.peran === "penyedia";
  const siapJual = penyedia && pengguna.statusVerifikasi === "terverifikasi";

  el("identitas").textContent = pengguna
    ? `${pengguna.namaLengkap} (${pengguna.peran})`
    : "Belum login.";

  el("login").hidden = Boolean(pengguna);
  el("registrasi").hidden = Boolean(pengguna);
  el("logout").hidden = !pengguna;
  el("area-profil").hidden = !penyedia;
  el("area-penyedia").hidden = !siapJual;
  el("area-pesanan").hidden = !(pengguna?.peran === "pembeli" || siapJual);

  el("profil-usaha").textContent = penyedia
    ? `${pengguna.namaUsaha} — ${pengguna.alamatUsaha}`
    : "";

  el("status-usaha").textContent = penyedia
    ? `Status peninjauan: ${pengguna.statusVerifikasi}.`
    : "";
}

function tampilFormUsaha() {
  const perlu = el("jenis-akun").value === "penyedia";
  const profil = el("profil-daftar");

  profil.hidden = !perlu;

  profil.querySelectorAll("input").forEach((input) => {
    input.disabled = !perlu;
    input.required = perlu;
  });
}

function hapusSesi() {
  token = null;
  pengguna = null;

  el("pesanan").textContent = "";
  el("milik").textContent = "";

  tampilSesi();
}

async function api(path, method = "GET", body, privat = true) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (privat && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const hasil = await response.json();

  if (!response.ok) {
    if (response.status === 401 && privat) {
      hapusSesi();
    }

    const error = hasil.error ?? {};
    throw new Error(
      `${response.status} ${error.code ?? "ERROR"}: ${
        error.message ?? "Permintaan gagal."
      }`,
    );
  }

  return hasil;
}

async function kerjakan(aksi) {
  if (sibuk) return;

  sibuk = true;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  try {
    await aksi();
  } catch (error) {
    el("pesan").textContent = error.message;
  } finally {
    sibuk = false;

    document.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
  }
}

function buatSel(nilai) {
  const td = document.createElement("td");
  td.textContent = String(nilai ?? "");
  return td;
}

function buatTombolPesan(penawaranId) {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = "Pesan 1 unit";
  button.dataset.penawaranId = String(penawaranId);

  return button;
}

function buatBarisKatalog(penawaran) {
  const tr = document.createElement("tr");

  [
    penawaran.id,
    penawaran.nama,
    penawaran.hargaPenawaran,
    `${penawaran.stok} ${penawaran.satuan}`,
  ].forEach((nilai) => {
    tr.append(buatSel(nilai));
  });

  const tdAksi = document.createElement("td");

  if (pengguna?.peran === "pembeli") {
    tdAksi.append(buatTombolPesan(penawaran.id));
  } else {
    tdAksi.textContent = "Login sebagai pembeli untuk memesan.";
  }

  tr.append(tdAksi);
  return tr;
}

async function katalog() {
  const hasil = await api("/api/penawaran?limit=50", "GET", undefined, false);

  const fragment = document.createDocumentFragment();

  hasil.data.forEach((penawaran) => {
    fragment.append(buatBarisKatalog(penawaran));
  });

  el("katalog").replaceChildren(fragment);
}

async function pesanPenawaran(penawaranId) {
  const hasil = await api("/api/pesanan", "POST", {
    items: [{ penawaranId, kuantitas: 1 }],
  });

  el("pesan").textContent =
    `Pesanan ${hasil.data.id} dibuat. Ini masih reservasi.`;

  await katalog();
}

async function prosesLogin() {
  const hasil = await api(
    "/api/auth/login",
    "POST",
    {
      email: el("email-login").value,
      kataSandi: el("sandi-login").value,
    },
    false,
  );

  token = hasil.data.accessToken;

  try {
    pengguna = (await api("/api/auth/saya")).data;
    el("sandi-login").value = "";

    tampilSesi();
    await katalog();

    el("pesan").textContent =
      "Login berhasil. Token hanya disimpan di memori halaman.";
  } catch (error) {
    hapusSesi();
    throw error;
  }
}

function validasiKataSandi(kataSandi) {
  const panjang = [...kataSandi].length;
  const jumlahByte = new TextEncoder().encode(kataSandi).length;

  if (panjang < 15 || jumlahByte > 72) {
    throw new Error(
      "Kata sandi minimal 15 karakter dan maksimal 72 byte UTF-8.",
    );
  }

  if (kataSandi !== el("sandi-ulang").value) {
    throw new Error("Kedua kata sandi harus sama.");
  }
}

function buatDataRegistrasi(kataSandi) {
  const data = {
    namaLengkap: el("nama-daftar").value,
    email: el("email-daftar").value,
    kataSandi,
  };

  if (el("jenis-akun").value === "penyedia") {
    Object.assign(data, {
      namaUsaha: el("usaha-daftar").value,
      alamat: el("alamat-daftar").value,
      nomorTelepon: el("telepon-daftar").value,
    });
  }

  return data;
}

async function prosesRegistrasi() {
  const kataSandi = el("sandi-daftar").value;
  validasiKataSandi(kataSandi);

  const penyedia = el("jenis-akun").value === "penyedia";
  const data = buatDataRegistrasi(kataSandi);

  const endpoint = penyedia
    ? "/api/auth/registrasi-penyedia"
    : "/api/auth/registrasi";

  await api(endpoint, "POST", data, false);

  el("email-login").value = data.email;
  el("registrasi").reset();

  tampilFormUsaha();

  el("pesan").textContent = penyedia
    ? "Akun berhasil dibuat. Silakan login; izin jual menunggu peninjauan."
    : "Pendaftaran berhasil. Silakan login dengan kata sandi Anda.";
}

async function perbaruiStatus() {
  pengguna = (await api("/api/auth/saya")).data;

  tampilSesi();
  await katalog();

  el("pesan").textContent = "Status akun diperbarui dari server.";
}

async function prosesLogout() {
  await api("/api/auth/logout", "POST", {});

  hapusSesi();
  await katalog();

  el("pesan").textContent = "Semua sesi akun telah dicabut.";
}

async function buatPenawaran() {
  const hasil = await api("/api/penawaran", "POST", {
    nama: el("nama-produk").value,
    kategori: el("kategori").value,
    hargaNormal: Number(el("normal").value),
    hargaPenawaran: Number(el("hemat").value),
    stok: Number(el("stok").value),
    satuan: el("satuan").value,
    status: el("status").value,
    berakhirPada: new Date(el("berakhir").value).toISOString(),
  });

  el("pesan").textContent =
    `Penawaran ${hasil.data.id} dibuat untuk profil penyedia Anda.`;

  el("penawaran").reset();
  await katalog();
}

async function muatMilikSaya() {
  const hasil = await api("/api/penawaran/milik-saya?limit=50");

  el("milik").textContent = JSON.stringify(hasil, null, 2);
}

async function muatPesanan() {
  const hasil = await api("/api/pesanan?limit=50");

  el("pesanan").textContent = JSON.stringify(hasil, null, 2);
}

// Event listener

el("jenis-akun").addEventListener("change", tampilFormUsaha);

el("login").addEventListener("submit", (event) => {
  event.preventDefault();
  kerjakan(prosesLogin);
});

el("registrasi").addEventListener("submit", (event) => {
  event.preventDefault();
  kerjakan(prosesRegistrasi);
});

el("periksa-status").addEventListener("click", () => {
  kerjakan(perbaruiStatus);
});

el("logout").addEventListener("click", () => {
  kerjakan(prosesLogout);
});

el("penawaran").addEventListener("submit", (event) => {
  event.preventDefault();
  kerjakan(buatPenawaran);
});

el("muat-katalog").addEventListener("click", () => {
  kerjakan(katalog);
});

el("muat-milik").addEventListener("click", () => {
  kerjakan(muatMilikSaya);
});

el("muat-pesanan").addEventListener("click", () => {
  kerjakan(muatPesanan);
});

// Satu listener untuk seluruh tombol pemesanan di katalog.
el("katalog").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-penawaran-id]");

  if (!button || !el("katalog").contains(button)) return;

  const penawaranId = Number(button.dataset.penawaranId);

  if (!Number.isSafeInteger(penawaranId) || penawaranId <= 0) {
    el("pesan").textContent = "ID penawaran tidak valid.";
    return;
  }

  kerjakan(() => pesanPenawaran(penawaranId));
});

// Inisialisasi halaman
tampilSesi();
tampilFormUsaha();
kerjakan(katalog);
