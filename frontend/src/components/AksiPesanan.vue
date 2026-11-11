<script setup>
import { ref, watch, onUnmounted, nextTick, computed } from "vue";
import { api, pesanError } from "../lib/api.js";
import { formatRupiah } from "../lib/tampilan.js";
import { sesi } from "../lib/sesi.js";
import Ikon from "./Ikon.vue";

const props = defineProps({
  pesanan: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["terubah", "perbarui"]);

const pilihan = ref("");
const alasan = ref("");
const pembayaranDiterima = ref(false);
const makananDiserahkan = ref(false);
const sibuk = ref(false);
const error = ref("");
const pesan = ref("");
const areaKonfirmasi = ref(null);

const controller = new AbortController();

onUnmounted(() => controller.abort());

// ======================================================
// MENENTUKAN TINDAKAN BERDASARKAN PERAN DAN STATUS
// ======================================================

const bolehAksi = computed(() => {
  const status = props.pesanan.status;
  const peran = sesi.pengguna?.peran;

  // Tindakan penyedia
  if (peran === "penyedia") {
    if (status === "menunggu-konfirmasi") {
      return ["konfirmasi", "tolak"];
    }

    if (status === "dikonfirmasi") {
      return ["siap"];
    }

    if (status === "siap-diambil") {
      return ["selesai"];
    }

    return [];
  }

  // Tindakan pembeli
  if (peran === "pembeli") {
    if (status === "menunggu-konfirmasi") {
      return ["batal"];
    }

    return [];
  }

  return [];
});

// ======================================================
// KETERANGAN STATUS
// ======================================================

const keteranganStatus = computed(() => {
  const status = props.pesanan.status;
  const peran = sesi.pengguna?.peran;

  if (status === "selesai") {
    return "Pesanan sudah selesai.";
  }

  if (status === "dibatalkan") {
    return "Pesanan telah dibatalkan dan stok reservasi dikembalikan.";
  }

  if (status === "ditolak") {
    return "Pesanan telah ditolak oleh penyedia.";
  }

  if (status === "menunggu-konfirmasi") {
    return peran === "pembeli"
      ? "Pesanan sedang menunggu konfirmasi penyedia. Anda masih dapat membatalkan pesanan."
      : "Pesanan menunggu tindakan dari penyedia.";
  }

  if (status === "dikonfirmasi") {
    return "Pesanan sudah diterima penyedia. Pantau status dan tunggu makanan siap diambil.";
  }

  if (status === "siap-diambil") {
    return "Makanan sudah siap. Silakan lakukan pengambilan sesuai kesepakatan.";
  }

  return "Tidak ada tindakan yang tersedia untuk pesanan ini.";
});

// ======================================================
// RESET FORM KETIKA STATUS BERUBAH
// ======================================================

watch(
  () => props.pesanan.status,
  () => {
    pilihan.value = "";
    alasan.value = "";
    error.value = "";
    pesan.value = "";
  },
);

// ======================================================
// MEMBUKA FORM TINDAKAN
// ======================================================

async function buka(aksi) {
  pilihan.value = aksi;
  alasan.value = "";
  pembayaranDiterima.value = false;
  makananDiserahkan.value = false;
  error.value = "";
  pesan.value = "";

  await nextTick();

  areaKonfirmasi.value?.querySelector("textarea, input")?.focus();

  areaKonfirmasi.value?.scrollIntoView({
    behavior: "auto",
    block: "nearest",
  });
}

// ======================================================
// MENGIRIM TINDAKAN KE BACKEND
// ======================================================

async function kirim(aksi) {
  if (sibuk.value || sesi.keluar) return;

  // Pastikan tindakan memang diizinkan oleh kondisi UI.
  if (!bolehAksi.value.includes(aksi)) {
    error.value = "Tindakan tidak tersedia untuk status pesanan ini.";
    return;
  }

  error.value = "";
  pesan.value = "";

  const body = { aksi };

  // Validasi alasan pembatalan atau penolakan.
  if (["batal", "tolak"].includes(aksi)) {
    if (alasan.value.trim().length < 3) {
      error.value = "Tuliskan alasan minimal 3 karakter.";
      return;
    }

    body.alasan = alasan.value.trim();
  }

  // Validasi serah terima dan pembayaran.
  if (aksi === "selesai") {
    if (
      !makananDiserahkan.value ||
      (props.pesanan.total > 0 && !pembayaranDiterima.value)
    ) {
      error.value =
        "Pastikan makanan sudah diserahkan dan pembayaran diterima jika berbayar.";
      return;
    }

    body.makananDiserahkan = makananDiserahkan.value;
    body.pembayaranDiterima = pembayaranDiterima.value;
  }

  sibuk.value = true;

  try {
    const hasil = await api(
      "/api/pesanan/" + encodeURIComponent(props.pesanan.id) + "/aksi",
      {
        method: "POST",
        auth: true,
        body,
        signal: controller.signal,
      },
    );

    emit("terubah", hasil.data);

    pesan.value = {
      konfirmasi: "Pesanan diterima. Stok tetap terreservasi.",
      siap: "Pembeli dapat mengambil makanan.",
      selesai: "Serah terima selesai dan tercatat pada dashboard.",
      batal: "Pesanan dibatalkan. Stok reservasi telah dikembalikan.",
      tolak: "Pesanan ditolak. Stok reservasi telah dikembalikan.",
    }[aksi];

    pilihan.value = "";
  } catch (e) {
    if (e.name !== "AbortError") {
      error.value = pesanError(e);

      if (e.status === 409) {
        emit("perbarui");
      }
    }
  } finally {
    sibuk.value = false;
  }
}
</script>

<template>
  <section class="order-actions" aria-labelledby="judul-aksi">
    <h3 id="judul-aksi">
      {{
        sesi.pengguna?.peran === "penyedia"
          ? "Kelola pesanan masuk"
          : "Tindakan pesanan saya"
      }}
    </h3>

    <p v-if="pesan" class="notice notice-success" role="status">
      {{ pesan }}
    </p>

    <p v-if="error" class="notice notice-error" role="alert">
      {{ error }}
    </p>

    <!-- TOMBOL TINDAKAN -->
    <div v-if="bolehAksi.length" class="button-group">
      <button
        v-if="bolehAksi.includes('konfirmasi')"
        type="button"
        :disabled="sibuk || sesi.keluar"
        @click="kirim('konfirmasi')"
      >
        <Ikon nama="cek" />
        Terima pesanan
      </button>

      <button
        v-if="bolehAksi.includes('siap')"
        type="button"
        :disabled="sibuk || sesi.keluar"
        @click="kirim('siap')"
      >
        Tandai siap diambil
      </button>

      <button
        v-if="bolehAksi.includes('selesai')"
        type="button"
        :disabled="sibuk || sesi.keluar"
        @click="buka('selesai')"
      >
        Catat pengambilan &amp; pembayaran
      </button>

      <button
        v-if="bolehAksi.includes('tolak')"
        type="button"
        class="button-danger-outline"
        :disabled="sibuk || sesi.keluar"
        @click="buka('tolak')"
      >
        Tolak pesanan
      </button>

      <button
        v-if="bolehAksi.includes('batal')"
        type="button"
        class="button-danger-outline"
        :disabled="sibuk || sesi.keluar"
        @click="buka('batal')"
      >
        <Ikon nama="info" />
        Batalkan pesanan
      </button>
    </div>

    <!-- KETERANGAN JIKA TIDAK ADA TINDAKAN -->
    <p v-else class="muted">
      {{ keteranganStatus }}
    </p>

    <!-- FORM KONFIRMASI -->
    <form
      v-if="pilihan"
      ref="areaKonfirmasi"
      class="action-confirmation"
      @submit.prevent="kirim(pilihan)"
      novalidate
    >
      <fieldset :disabled="sibuk || sesi.keluar">
        <legend>
          {{
            pilihan === "selesai"
              ? "Konfirmasi serah terima"
              : pilihan === "tolak"
                ? "Konfirmasi penolakan"
                : "Konfirmasi pembatalan"
          }}
        </legend>

        <template v-if="pilihan === 'selesai'">
          <p>Catat setelah pembeli benar-benar menerima makanan.</p>

          <label class="check-row">
            <input
              id="makanan-diserahkan"
              type="checkbox"
              v-model="makananDiserahkan"
            />
            <span>Makanan sudah diserahkan kepada pembeli.</span>
          </label>

          <label v-if="props.pesanan.total > 0" class="check-row">
            <input
              id="pembayaran-diterima"
              type="checkbox"
              v-model="pembayaranDiterima"
            />
            <span>
              Pembayaran di tempat sebesar
              {{ formatRupiah(props.pesanan.total) }}
              sudah diterima.
            </span>
          </label>

          <p v-else class="field-hint">
            Pesanan gratis. Tidak ada pembayaran yang perlu diterima.
          </p>
        </template>

        <template v-else>
          <label for="alasan-aksi">
            Alasan
            {{ pilihan === "tolak" ? "penolakan" : "pembatalan" }}
          </label>

          <textarea
            id="alasan-aksi"
            v-model.trim="alasan"
            rows="3"
            minlength="3"
            maxlength="500"
            required
            placeholder="Tuliskan alasan tindakan..."
          ></textarea>

          <p class="field-hint">
            Stok dikembalikan sekali setelah tindakan berhasil. Alasan dapat
            dilihat oleh kedua pihak.
          </p>
        </template>

        <div class="button-group">
          <button
            type="submit"
            :disabled="sibuk || sesi.keluar"
            :class="pilihan === 'selesai' ? '' : 'button-danger'"
          >
            {{
              sibuk
                ? "Memproses…"
                : pilihan === "selesai"
                  ? "Selesaikan serah terima"
                  : pilihan === "tolak"
                    ? "Konfirmasi penolakan"
                    : "Konfirmasi pembatalan"
            }}
          </button>

          <button
            type="button"
            class="button-secondary"
            :disabled="sibuk"
            @click="pilihan = ''"
          >
            Kembali
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
