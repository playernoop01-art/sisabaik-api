import assert from "node:assert/strict";

let jumlah = 0;

try {
  const asal = new URL(process.argv[2] ?? "http://127.0.0.1:3000");

  // Memastikan alamat dasar valid
  assert.equal(asal.pathname, "/", "Gunakan alamat dasar tanpa /api.");

  assert.ok(
    !asal.search && !asal.hash && !asal.username && !asal.password,
    "Alamat tidak boleh mengandung query, hash, atau kredensial.",
  );

  assert.ok(
    asal.protocol === "https:" ||
      (asal.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(asal.hostname)),
    "Alamat publik wajib HTTPS.",
  );

  async function baca(path) {
    return fetch(new URL(path, asal), {
      headers: {
        Accept: "application/json, text/html",
      },
      signal: AbortSignal.timeout(120000),
    });
  }

  function lulus(nama) {
    jumlah++;
    console.log(`PASS ${nama}`);
  }

  // 1. Pemeriksaan kesehatan server dan database
  for (const path of ["/healthz", "/api/health"]) {
    const r = await baca(path);

    assert.equal(r.status, 200, path);
    assert.match(r.headers.get("content-type") ?? "", /application\/json/);

    const json = await r.json();

    assert.equal(json.success, true);
    assert.equal(json.data.status, "ok");

    if (path === "/api/health") {
      assert.equal(json.data.database, "connected");
    }

    lulus(path);
  }

  // 2. Pemeriksaan HTML Vue
  const halaman = await baca("/");

  assert.equal(halaman.status, 200);

  assert.match(halaman.headers.get("content-type") ?? "", /text\/html/);

  const html = await halaman.text();

  assert.match(html, /id="app"/);

  lulus("HTML Vue");

  // 3. Mengambil daftar aset dari HTML
  const aset = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (x) => x[1],
  );

  assert.ok(
    aset.some((x) => x.endsWith(".js")),
    "Aset JavaScript tidak ditemukan.",
  );

  assert.ok(
    aset.some((x) => x.endsWith(".css")),
    "Aset CSS tidak ditemukan.",
  );

  // 4. Memeriksa aset JavaScript, CSS, dan SVG
  for (const path of aset) {
    const r = await baca(path);

    assert.equal(r.status, 200, path);

    let tipe;

    if (path.endsWith(".css")) {
      tipe = /text\/css/;
    } else if (path.endsWith(".js")) {
      tipe = /javascript/;
    } else if (path.endsWith(".svg")) {
      tipe = /image\/svg\+xml/;
    } else {
      throw new Error(`Jenis aset tidak didukung: ${path}`);
    }

    assert.match(
      r.headers.get("content-type") ?? "",
      tipe,
      `Content-Type tidak sesuai untuk ${path}`,
    );
  }

  lulus("aset JavaScript, CSS, dan SVG");

  // 5. Pemeriksaan endpoint yang harus ditolak
  for (const [path, status] of [
    ["/api/tidak-ada", 404],
    ["/api/auth/saya", 401],
    ["/api/dashboard", 401],
    ["/api/pesanan", 401],
    ["/.env", 404],
    ["/server.js", 404],
  ]) {
    const r = await baca(path);

    assert.equal(r.status, status, path);

    assert.match(r.headers.get("content-type") ?? "", /application\/json/);

    const json = await r.json();

    assert.equal(json.success, false);

    lulus(`${path} menolak dengan ${status}`);
  }

  console.log(`Selesai: ${jumlah} pemeriksaan lulus. Tidak ada data ditulis.`);
} catch (error) {
  console.error(`FAIL setelah ${jumlah} pemeriksaan: ${error.message}`);

  process.exitCode = 1;
}
