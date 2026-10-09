// Data quality section
import { defineMessages } from '.'

export const quality = defineMessages({
  question: { id: 'Seberapa bisa angka dipercaya?', en: 'How far can the numbers be trusted?' },
  go_risk: { id: 'Lihat di Risiko', en: 'See in Risk' },
  dq1_title: { id: '{n} order in transit lebih dari 30 hari', en: '{n} orders in transit for over 30 days' },
  dq1_text: {
    id: 'Dari {t} order in transit, {n} sudah lebih dari 30 hari tanpa tiba ({c} klien, {v}). Kemungkinan hilang atau status tidak diperbarui. Order ini dihitung sebagai "macet".',
    en: 'Of {t} in-transit orders, {n} are over 30 days old ({c} clients, {v}). Probably lost or never updated. They count as "stuck".',
  },
  dq2_title: { id: '{n} order promo belum dipotong diskon', en: '{n} promo orders not net of discount' },
  dq2_text: {
    id: 'order_value_usd = quantity × harga satuan, padahal ada promo_discount_pct. Nilai promo {v}, diskon yang belum dipotong sekitar {d}. Semua nilai di dashboard memakai angka kotor.',
    en: 'order_value_usd = quantity × unit price despite promo_discount_pct. Promo value {v}, undeducted discount about {d}. All dashboard values are gross.',
  },
  dq3_title: { id: 'Tidak ada kolom ETA/SLA dan biaya kirim', en: 'No ETA/SLA or shipping cost columns' },
  dq3_text: {
    id: 'Status "delayed" tidak bisa diverifikasi terhadap janji pengiriman, dan biaya antar carrier tidak bisa dibandingkan. SLA 7 hari di dashboard masih usulan.',
    en: 'The "delayed" status can’t be checked against a delivery promise, and carrier costs can’t be compared. The 7-day SLA is a proposal.',
  },
})
