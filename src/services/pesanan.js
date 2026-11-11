import { transaksi } from "../db/transaksi.js";
import { HttpError, metaHalaman } from "../lib/api.js";

// ======================================================
// HEADER PESANAN
// ======================================================

const headerSql = `
  SELECT
    ps.*,
    u.nama_lengkap AS nama_pemesan,
    py.nama_usaha AS penyedia
  FROM pesanan ps
  JOIN pengguna u
    ON u.id = ps.pembeli_id
  JOIN penyedia py
    ON py.id = ps.penyedia_id
`;

// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatTanggal(nilai) {
  return nilai ? new Date(nilai).toISOString() : null;
}

// ======================================================
// FORMAT DATA HEADER PESANAN
// ======================================================

function keHeader(row) {
  return {
    id: String(row.id),
    pembeliId: String(row.pembeli_id),
    penyediaId: String(row.penyedia_id),

    namaPemesan: row.nama_pemesan,
    penyedia: row.penyedia,

    status: row.status,

    metodePembayaran: row.metode_pembayaran,
    statusPembayaran: row.status_pembayaran,

    dibayarPada: formatTanggal(row.dibayar_pada),
    dikonfirmasiPada: formatTanggal(row.dikonfirmasi_pada),
    siapPada: formatTanggal(row.siap_pada),
    selesaiPada: formatTanggal(row.selesai_pada),
    dibatalkanPada: formatTanggal(row.dibatalkan_pada),

    jenisPembatalan: row.jenis_pembatalan,
    alasanPembatalan: row.alasan_pembatalan,

    total: Number(row.total_transaksi),
    nilaiStokTerselamatkan: Number(row.nilai_stok_terselamatkan),

    dibuatPada: formatTanggal(row.dibuat_pada),
  };
}

// ======================================================
// PEMBATASAN AKSES BERDASARKAN PERAN
// ======================================================

function cakupan(pengguna) {
  if (pengguna.peran === "pembeli") {
    return {
      kolom: "ps.pembeli_id",
      id: pengguna.id,
    };
  }

  if (pengguna.peran === "penyedia" && pengguna.penyediaId) {
    return {
      kolom: "ps.penyedia_id",
      id: pengguna.penyediaId,
    };
  }

  throw new HttpError(
    403,
    "ROLE_FORBIDDEN",
    "Profil atau peran tidak diizinkan.",
  );
}

// ======================================================
// MEMBACA DETAIL PESANAN
// ======================================================

async function bacaDetail(id, client, pengguna) {
  const scope = cakupan(pengguna);

  const header = await client.query(
    `
      ${headerSql}
      WHERE ps.id = $1
        AND ${scope.kolom} = $2
    `,
    [id, scope.id],
  );

  if (!header.rowCount) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }

  const detail = await client.query(
    `
      SELECT
        dp.*
      FROM detail_pesanan dp
      WHERE dp.pesanan_id = $1
      ORDER BY dp.penawaran_id
    `,
    [id],
  );

  return {
    ...keHeader(header.rows[0]),

    items: detail.rows.map((row) => ({
      penawaranId: String(row.penawaran_id),
      nama: row.nama_penawaran,
      satuan: row.satuan,
      kuantitas: Number(row.kuantitas),
      hargaSatuan: Number(row.harga_penawaran_satuan),
      subtotal: Number(row.subtotal),
      nilaiStokTerselamatkan: Number(row.nilai_stok),
    })),
  };
}

// ======================================================
// DETAIL PESANAN
// ======================================================

export function detailPesanan(id, pengguna) {
  return transaksi((client) => bacaDetail(id, client, pengguna), true);
}

// ======================================================
// DAFTAR PESANAN
// ======================================================

export function daftarPesanan(paging, pengguna) {
  const scope = cakupan(pengguna);

  return transaksi(async (client) => {
    const count = await client.query(
      `
        SELECT COUNT(*)::int AS jumlah
        FROM pesanan ps
        WHERE ${scope.kolom} = $1
      `,
      [scope.id],
    );

    const hasil = await client.query(
      `
        ${headerSql}
        WHERE ${scope.kolom} = $1
        ORDER BY ps.id DESC
        LIMIT $2
        OFFSET $3
      `,
      [scope.id, paging.limit, paging.offset],
    );

    return {
      data: hasil.rows.map(keHeader),
      meta: metaHalaman(count.rows[0].jumlah, paging),
    };
  }, true);
}

// ======================================================
// MEMBUAT PESANAN
// ======================================================

export function buatPesanan(data, pengguna) {
  return transaksi(async (client) => {
    // 1. MEMERIKSA AKUN PEMBELI

    const pembeli = await client.query(
      `
        SELECT id
        FROM pengguna
        WHERE id = $1
          AND peran = 'pembeli'
          AND aktif = TRUE
      `,
      [data.pembeliId],
    );

    if (!pembeli.rowCount) {
      throw new HttpError(
        404,
        "BUYER_NOT_FOUND",
        "Pembeli aktif tidak ditemukan.",
      );
    }

    if (
      pengguna.peran !== "pembeli" ||
      String(pengguna.id) !== String(data.pembeliId)
    ) {
      throw new HttpError(
        403,
        "ROLE_FORBIDDEN",
        "Pembeli tidak diizinkan membuat pesanan ini.",
      );
    }

    // 2. MEMERIKSA PENAWARAN DAN STOK

    const detail = [];
    let penyediaId = null;

    for (const baris of data.items) {
      const hasil = await client.query(
        `
          SELECT
            p.*
          FROM penawaran p
          JOIN penyedia py
            ON py.id = p.penyedia_id
          JOIN pengguna u
            ON u.id = py.pengguna_id
          WHERE p.id = $1
            AND u.peran = 'penyedia'
            AND u.aktif = TRUE
            AND py.status_verifikasi = 'terverifikasi'
          FOR UPDATE OF p
        `,
        [baris.penawaranId],
      );

      if (!hasil.rowCount) {
        throw new HttpError(
          404,
          "OFFER_NOT_FOUND",
          "Penawaran tidak ditemukan.",
        );
      }

      const item = hasil.rows[0];

      // 3. MEMERIKSA STATUS DAN MASA BERLAKU

      const waktu = await client.query(
        `
          SELECT
            $1::timestamptz > clock_timestamp()
            AS belum_berakhir
        `,
        [item.berakhir_pada],
      );

      if (item.status !== "aktif" || !waktu.rows[0].belum_berakhir) {
        throw new HttpError(
          409,
          "OFFER_UNAVAILABLE",
          "Penawaran tidak tersedia atau sudah berakhir.",
        );
      }

      // 4. MEMERIKSA STOK

      if (item.stok < baris.kuantitas) {
        throw new HttpError(
          409,
          "INSUFFICIENT_STOCK",
          `Stok ${item.nama} tidak mencukupi.`,
        );
      }

      // 5. MEMASTIKAN SATU PENYEDIA

      penyediaId ??= String(item.penyedia_id);

      if (penyediaId !== String(item.penyedia_id)) {
        throw new HttpError(
          409,
          "MIXED_PROVIDER",
          "Satu pesanan harus berasal dari satu penyedia.",
        );
      }

      detail.push({
        item,
        kuantitas: baris.kuantitas,
      });
    }

    // 6. MEMBUAT HEADER PESANAN

    const pesanan = await client.query(
      `
        INSERT INTO pesanan (
          pembeli_id,
          penyedia_id
        )
        VALUES ($1, $2)
        RETURNING id
      `,
      [pembeli.rows[0].id, penyediaId],
    );

    const id = pesanan.rows[0].id;

    // 7. MENYIMPAN DETAIL DAN SNAPSHOT

    for (const { item, kuantitas } of detail) {
      await client.query(
        `
          INSERT INTO detail_pesanan (
            pesanan_id,
            penawaran_id,
            penyedia_id,
            kuantitas,
            harga_normal_satuan,
            harga_penawaran_satuan,
            nama_penawaran,
            satuan
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          id,
          item.id,
          penyediaId,
          kuantitas,
          item.harga_normal,
          item.harga_penawaran,
          item.nama,
          item.satuan,
        ],
      );

      // 8. MENGURANGI STOK

      await client.query(
        `
    UPDATE penawaran
    SET
      stok = stok - $1,
      versi = versi + 1,
      status = CASE
        WHEN stok - $1 = 0 THEN 'habis'
        ELSE status
      END
    WHERE id = $2
  `,
        [kuantitas, item.id],
      );
    }

    // 9. MENGHITUNG TOTAL TRANSAKSI

    const total = await client.query(
      `
        SELECT
          COALESCE(SUM(subtotal), 0) AS total,
          COALESCE(SUM(nilai_stok), 0) AS nilai_stok
        FROM detail_pesanan
        WHERE pesanan_id = $1
      `,
      [id],
    );

    const totalTransaksi = BigInt(total.rows[0].total);
    const nilaiStok = BigInt(total.rows[0].nilai_stok);

    if (totalTransaksi > 999999999999n || nilaiStok > 999999999999n) {
      throw new HttpError(
        409,
        "ORDER_TOTAL_LIMIT",
        "Total transaksi melampaui kapasitas database.",
      );
    }

    // 10. MENENTUKAN STATUS PEMBAYARAN

    const statusPembayaran = totalTransaksi === 0n ? "gratis" : "belum-dibayar";

    await client.query(
      `
        UPDATE pesanan
        SET
          total_transaksi = $1,
          nilai_stok_terselamatkan = $2,
          status_pembayaran = $3
        WHERE id = $4
      `,
      [totalTransaksi.toString(), nilaiStok.toString(), statusPembayaran, id],
    );

    // 11. MENGEMBALIKAN DETAIL PESANAN

    return bacaDetail(id, client, pengguna);
  });
}

export async function aksiPesanan(id, data, pengguna) {
  return transaksi(async (client) => {
    const { kolom, id: pemilikId } = cakupan(pengguna);

    // Kunci pesanan agar dua aksi bersamaan tidak mengubah statusnya.
    const hasilPesanan = await client.query(
      `
        SELECT ps.*
        FROM pesanan ps
        WHERE ps.id = $1
          AND ${kolom} = $2
        FOR UPDATE
      `,
      [id, pemilikId],
    );

    const pesanan = hasilPesanan.rows[0];

    if (!pesanan) {
      throw new HttpError(404, "PESANAN_NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    const aksi = data.aksi;
    const pembeli = pengguna.peran === "pembeli";
    const penyedia = pengguna.peran === "penyedia";

    if (!pembeli && !penyedia) {
      throw new HttpError(403, "FORBIDDEN", "Peran tidak diizinkan.");
    }

    // Pembeli membatalkan pesanan atau penyedia menolak pesanan.
    if (aksi === "batal" || aksi === "tolak") {
      if (aksi === "batal" && !pembeli) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Hanya pembeli yang dapat membatalkan pesanan.",
        );
      }

      if (aksi === "tolak" && !penyedia) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Hanya penyedia yang dapat menolak pesanan.",
        );
      }

      if (pesanan.status !== "menunggu-konfirmasi") {
        throw new HttpError(
          409,
          "STATUS_CONFLICT",
          "Pesanan tidak lagi dapat dibatalkan atau ditolak.",
        );
      }

      // Kunci penawaran dalam urutan ID agar mengurangi risiko deadlock.
      const hasilDetail = await client.query(
        `
          SELECT
            p.id,
            dp.kuantitas
          FROM detail_pesanan dp
          JOIN penawaran p ON p.id = dp.penawaran_id
          WHERE dp.pesanan_id = $1
          ORDER BY p.id
          FOR UPDATE OF p
        `,
        [id],
      );

      for (const item of hasilDetail.rows) {
        await client.query(
          `
    UPDATE penawaran
    SET
      stok = stok + $2,
      versi = versi + 1,
      status = CASE
        WHEN status = 'habis' AND berakhir_pada > CURRENT_TIMESTAMP
          THEN 'aktif'
        WHEN status = 'habis' AND berakhir_pada <= CURRENT_TIMESTAMP
          THEN 'kedaluwarsa'
        ELSE status
      END
    WHERE id = $1
  `,
          [item.id, item.kuantitas],
        );
      }

      await client.query(
        `
          UPDATE pesanan
          SET
            status = 'dibatalkan',
            dibatalkan_pada = CURRENT_TIMESTAMP,
            jenis_pembatalan = $2,
            alasan_pembatalan = $3
          WHERE id = $1
        `,
        [id, aksi === "batal" ? "pembeli" : "ditolak-penyedia", data.alasan],
      );
    } else if (aksi === "konfirmasi") {
      if (!penyedia || pesanan.status !== "menunggu-konfirmasi") {
        throw new HttpError(
          409,
          "STATUS_CONFLICT",
          "Pesanan tidak dapat dikonfirmasi.",
        );
      }

      await client.query(
        `
          UPDATE pesanan
          SET status = 'dikonfirmasi',
              dikonfirmasi_pada = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [id],
      );
    } else if (aksi === "siap") {
      if (!penyedia || pesanan.status !== "dikonfirmasi") {
        throw new HttpError(
          409,
          "STATUS_CONFLICT",
          "Pesanan belum dapat disiapkan.",
        );
      }

      await client.query(
        `
          UPDATE pesanan
          SET status = 'siap-diambil',
              siap_pada = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [id],
      );
    } else if (aksi === "selesai") {
      if (!penyedia || pesanan.status !== "siap-diambil") {
        throw new HttpError(
          409,
          "STATUS_CONFLICT",
          "Pesanan belum siap diselesaikan.",
        );
      }

      if (data.makananDiserahkan !== true) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Konfirmasi penyerahan makanan wajib dilakukan.",
        );
      }

      const total = Number(pesanan.total_transaksi);

      if (total > 0 && data.pembayaranDiterima !== true) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Pembayaran belum dikonfirmasi.",
        );
      }

      await client.query(
        `
          UPDATE pesanan
          SET
            status = 'selesai',
            selesai_pada = CURRENT_TIMESTAMP,
            status_pembayaran = CASE
              WHEN total_transaksi = 0 THEN 'gratis'
              ELSE 'dibayar'
            END,
            dibayar_pada = CASE
              WHEN total_transaksi = 0 THEN dibayar_pada
              ELSE CURRENT_TIMESTAMP
            END
          WHERE id = $1
        `,
        [id],
      );
    } else {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Aksi pesanan tidak dikenal.",
      );
    }

    return bacaDetail(id, client, pengguna);
  });
}
