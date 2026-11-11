
BEGIN;

ALTER TABLE penawaran
  DROP CONSTRAINT IF EXISTS penawaran_foto_tipe_check;

ALTER TABLE penawaran
  ADD CONSTRAINT penawaran_foto_tipe_check
  CHECK (
    foto_tipe IS NULL
    OR foto_tipe IN ('image/jpeg', 'image/png', 'image/webp')
  );

COMMIT;
