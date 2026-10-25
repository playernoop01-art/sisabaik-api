export async function verifikasiPenyedia(
  pool,
  email,
  status = "terverifikasi",
) {
  if (
    !["terverifikasi", "ditolak"].includes(status) ||
    typeof email !== "string" ||
    email.trim().length === 0 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new Error("Email atau status peninjauan tidak valid.");
  }

  const emailNormal = email.trim().toLowerCase();
  const c = await pool.connect();
  let mulai = false;
  let rusak;

  try {
    await c.query("BEGIN");
    mulai = true;

    await c.query("SET LOCAL lock_timeout = '2s'");

    const r = await c.query(
      `SELECT py.id, u.email
       FROM penyedia py
       JOIN pengguna u ON u.id = py.pengguna_id
       WHERE u.email = $1
         AND u.peran = 'penyedia'
         AND u.aktif = TRUE
       FOR UPDATE OF py, u`,
      [emailNormal],
    );

    if (r.rows.length !== 1) {
      throw new Error("Akun penyedia aktif tidak ditemukan.");
    }

    await c.query(
      `UPDATE penyedia
       SET status_verifikasi = $1
       WHERE id = $2`,
      [status, r.rows[0].id],
    );

    await c.query("COMMIT");
    mulai = false;

    return {
      email: r.rows[0].email,
      status,
    };
  } catch (e) {
    if (mulai) {
      try {
        await c.query("ROLLBACK");
      } catch (gagal) {
        rusak = gagal;
      }
    }

    throw e;
  } finally {
    c.release(rusak);
  }
}
