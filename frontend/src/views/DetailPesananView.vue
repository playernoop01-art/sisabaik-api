<script setup>
import { watch } from "vue";
import { useRoute } from "vue-router";

import Ikon from "../components/Ikon.vue";
import AksiPesanan from "../components/AksiPesanan.vue";
import StatusBaca from "../components/StatusBaca.vue";

import { useBaca } from "../composables/useBaca.js";
import { api } from "../lib/api.js";
import { formatRupiah, formatWaktu } from "../lib/tampilan.js";
import { labelPesanan, labelPembayaran } from "../lib/visual.js";

const route = useRoute();

const { data, sibuk, error, muat, batalkan } = useBaca((signal) =>
  api(`/api/pesanan/${encodeURIComponent(route.params.id)}`, {
    auth: true,
    signal,
  }),
);

watch(() => route.params.id, muat, { immediate: true });

function terubah(p) {
  if (String(route.params.id) !== String(p.id)) return;

  batalkan();
  data.value = {
    success: true,
    data: p,
  };
}
</script>

<template>
  <section class="container workspace section" aria-labelledby="judul-detail">
    <RouterLink class="back-link" to="/pesanan">
      <Ikon nama="kiri" />
      Kembali ke daftar pesanan
    </RouterLink>

    <div class="page-heading">
      <div>
        <p class="eyebrow">Semua rincian dalam satu tempat</p>

        <h1 id="judul-detail">Detail pesanan</h1>

        <p class="muted">
          Periksa pilihan dan nilai yang tercatat pada saat pemesanan.
        </p>
      </div>

      <button
        type="button"
        class="button-secondary"
        :disabled="sibuk"
        @click="muat"
      >
        <Ikon nama="ulang" />
        Perbarui status
      </button>
    </div>

    <StatusBaca :sibuk="sibuk" :error="error" @ulang="muat" />

    <article v-if="data" class="order-detail">
      <div class="order-detail-main">
        <div class="order-detail-header">
          <div>
            <span class="icon-tile">
              <Ikon nama="tas" />
            </span>

            <h2>Pesanan #{{ data.data.id }}</h2>
          </div>

          <span class="status-badge" :class="`status-${data.data.status}`">
            {{ labelPesanan(data.data.status) }}
          </span>
        </div>

        <dl class="order-identities">
          <div>
            <dt>ID pesanan</dt>
            <dd>#{{ data.data.id }}</dd>
          </div>

          <div>
            <dt>Status pesanan</dt>
            <dd>{{ labelPesanan(data.data.status) }}</dd>
          </div>

          <div>
            <dt>Penyedia</dt>
            <dd>{{ data.data.penyedia }}</dd>
          </div>

          <div>
            <dt>Pemesan</dt>
            <dd>{{ data.data.namaPemesan }}</dd>
          </div>

          <div>
            <dt>Tanggal pemesanan</dt>
            <dd>{{ formatWaktu(data.data.dibuatPada) }}</dd>
          </div>
        </dl>

        <ol class="order-progress" aria-label="Tahap pesanan">
          <li
            :class="{
              done:
                data.data.status !== 'menunggu-konfirmasi' &&
                data.data.status !== 'dibatalkan' &&
                data.data.status !== 'ditolak',
            }"
          >
            Menunggu konfirmasi
          </li>

          <li
            :class="{
              done: ['dikonfirmasi', 'siap-diambil', 'selesai'].includes(
                data.data.status,
              ),
            }"
          >
            Diterima penyedia
          </li>

          <li
            :class="{
              done: ['siap-diambil', 'selesai'].includes(data.data.status),
            }"
          >
            Siap diambil
          </li>

          <li :class="{ done: data.data.status === 'selesai' }">Selesai</li>
        </ol>

        <h3>Rincian makanan</h3>

        <ul class="order-items">
          <li v-for="item in data.data.items" :key="item.penawaranId">
            <span class="icon-tile small-tile">
              <Ikon nama="paket" />
            </span>

            <div>
              <strong>{{ item.nama }}</strong>

              <span>
                {{ item.kuantitas }} {{ item.satuan }} ×
                {{ formatRupiah(item.hargaSatuan) }}
              </span>

              <span class="field-hint"> Harga snapshot server per satuan </span>
            </div>

            <div class="order-item-subtotal">
              <strong>{{ formatRupiah(item.subtotal) }}</strong>

              <span class="field-hint">Subtotal</span>
            </div>
          </li>
        </ul>

        <div v-if="data.data.alasanPembatalan" class="notice notice-error">
          <div>
            <strong>{{ labelPesanan(data.data.status) }}</strong>
            <p>{{ data.data.alasanPembatalan }}</p>
          </div>
        </div>

        <AksiPesanan
          :key="data.data.id"
          :pesanan="data.data"
          @terubah="terubah"
          @perbarui="muat"
        />
      </div>

      <aside class="order-total-panel">
        <p class="eyebrow">Ringkasan pemesanan</p>

        <p class="total-label">Total pesanan</p>

        <p class="total-price">
          {{ formatRupiah(data.data.total) }}
        </p>

        <hr />

        <p class="payment-label">
          <Ikon nama="aman" />
          {{ labelPembayaran(data.data.statusPembayaran) }}
        </p>

        <p class="field-hint">
          Metode pembayaran:
          {{
            data.data.metodePembayaran === "di-tempat"
              ? "Di tempat saat pengambilan makanan"
              : data.data.metodePembayaran
          }}
        </p>

        <div v-if="data.data.dikonfirmasiPada" class="pickup-code">
          <span>Waktu konfirmasi</span>

          <strong>
            {{ formatWaktu(data.data.dikonfirmasiPada) }}
          </strong>
        </div>

        <div v-if="data.data.dibayarPada" class="pickup-code">
          <span>Waktu pembayaran</span>

          <strong>
            {{ formatWaktu(data.data.dibayarPada) }}
          </strong>
        </div>

        <div v-if="data.data.pengambilan" class="pickup-code">
          <span>Kode pengambilan</span>

          <strong>{{ data.data.pengambilan.kode }}</strong>

          <p v-if="data.data.pengambilan.diambilPada">
            Diambil
            {{ formatWaktu(data.data.pengambilan.diambilPada) }}
          </p>
        </div>

        <div class="notice">
          <Ikon nama="info" />

          <p>
            Bayar setelah makanan siap diambil. Penyedia mencatat serah terima
            dan pembayaran setelah makanan diterima pembeli.
          </p>
        </div>

        <RouterLink class="button button-wide" to="/pesanan">
          Lihat semua pesanan
          <Ikon nama="panah" />
        </RouterLink>
      </aside>
    </article>
  </section>
</template>
