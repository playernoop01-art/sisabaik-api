import { readFile } from "node:fs/promises";
import { pool } from "../src/db/pool.js";
import { transaksi } from "../src/db/transaksi.js";

const daftarMigrasi = [
  "07_auth.sql",
  "12_alur_transaksi.sql",
  "13_foto_mime.sql",
];

let migrasiAktif = "Pemeriksaan konfigurasi";

try {
  const cloud = process.argv.includes("--cloud");

  if (cloud) {
    if (
      !(process.env.PGHOST ?? "").endsWith(".neon.tech") ||
      process.env.PGSSL !== "require" ||
      !(process.env.CLOUD_CONFIRM_DATABASE ?? process.env.DEMO_CONFIRM_DATABASE)
    ) {
      throw new Error(
        "Migrasi cloud memerlukan konfigurasi Neon dan CLOUD_CONFIRM_DATABASE.",
      );
    }
  } else if (
    !["localhost", "127.0.0.1"].includes(process.env.PGHOST) ||
    process.env.PGDATABASE !== "sisabaik_dev" ||
    (process.env.PGSSL ?? "disable") !== "disable"
  ) {
    throw new Error(
      "Gunakan sisabaik_dev lokal. Untuk Neon demo gunakan db:migrate:cloud.",
    );
  }

  const sql = [];

  for (const nama of daftarMigrasi) {
    migrasiAktif = nama;

    const teks = await readFile(
      new URL("../database/" + nama, import.meta.url),
      "utf8",
    );

    if (!/^\s*BEGIN\s*;/i.test(teks) || !/COMMIT\s*;\s*$/i.test(teks)) {
      throw new Error("Batas transaksi migrasi tidak sesuai: " + nama);
    }

    const isiSQL = teks
      .replace(/^\s*BEGIN\s*;/i, "")
      .replace(/COMMIT\s*;\s*$/i, "");

    if (!isiSQL.trim()) {
      throw new Error("File migrasi kosong: " + nama);
    }

    sql.push(isiSQL);
  }

  migrasiAktif = "Pemeriksaan database";

  await transaksi(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(74091211)");

    const cek = await client.query(`
      SELECT
        current_database() AS nama,
        to_regclass('public.pengguna') AS pengguna,
        to_regclass('public.penawaran') AS penawaran,
        to_regclass('public.pesanan') AS pesanan,
        (
          SELECT ssl
          FROM pg_stat_ssl
          WHERE pid = pg_backend_pid()
        ) AS tls
    `);

    const db = cek.rows[0];

    const tujuan = cloud
      ? (process.env.CLOUD_CONFIRM_DATABASE ??
        process.env.DEMO_CONFIRM_DATABASE)
      : "sisabaik_dev";

    if (
      db.nama !== tujuan ||
      !db.pengguna ||
      !db.penawaran ||
      !db.pesanan ||
      (cloud && !db.tls)
    ) {
      throw new Error(
        "Database tujuan atau schema dasar belum sesuai. Data tidak direset.",
      );
    }

    for (let i = 0; i < sql.length; i++) {
      migrasiAktif = daftarMigrasi[i];

      console.log("Menjalankan migrasi:", migrasiAktif);

      try {
        await client.query(sql[i]);
      } catch (error) {
        error.migrationFile = migrasiAktif;
        throw error;
      }
    }
  });

  console.log("Migrasi autentikasi dan alur transaksi selesai.");

  console.log("Data serta password lama dipertahankan.");

  console.log(
    "Untuk akun lokal yang belum memiliki password: jalankan npm run db:auth.",
  );
} catch (error) {
  console.error("\nMigrasi gagal!");
  console.error("File:", error.migrationFile ?? migrasiAktif);
  console.error("Kode:", error.code ?? "-");
  console.error("Pesan:", error.message ?? "-");

  if (error.detail) {
    console.error("Detail:", error.detail);
  }

  if (error.hint) {
    console.error("Petunjuk:", error.hint);
  }

  if (error.position) {
    console.error("Posisi SQL:", error.position);
  }

  if (error.where) {
    console.error("Lokasi SQL:", error.where);
  }

  if (error.table) {
    console.error("Tabel:", error.table);
  }

  if (error.column) {
    console.error("Kolom:", error.column);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}
