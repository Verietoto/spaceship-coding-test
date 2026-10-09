// Risk & exceptions section
import { defineMessages } from '.'

export const risk = defineMessages({
  question: { id: 'Order mana yang perlu ditindak lebih dulu?', en: 'Which orders need action first?' },
  list: { id: 'Order bermasalah berjalan', en: 'Open problem orders' },
  include_delayed: { id: 'Sertakan order delayed yang sudah sampai', en: 'Include delayed orders that arrived' },
  showing: { id: 'Menampilkan {a} dari {b} order.', en: 'Showing {a} of {b} orders.' },
  impact_note: { id: 'Dampak bisnis: nilai total klien, lalu nilai order, tanpa bobot tambahan.', en: 'Business impact: client’s total value, then order value, no extra weighting.' },
  by_impact: { id: 'Dampak bisnis', en: 'Business impact' },
  by_age: { id: 'Umur order', en: 'Order age' },
  by_order_value: { id: 'Nilai order', en: 'Order value' },
  show_all: { id: 'Tampilkan semua', en: 'Show all' },
  show_less: { id: 'Tampilkan lebih sedikit', en: 'Show fewer' },
  none: { id: 'Tidak ada order bermasalah pada filter ini.', en: 'No problem orders in this filter.' },
  pick: { id: 'Pilih order untuk melihat penjelasannya.', en: 'Pick an order to see its explanation.' },
  basis: { id: 'Dasar angka', en: 'Basis' },
  explain_title: { id: 'Penjelasan', en: 'Explanation' },
  th_order: { id: 'Order', en: 'Order' },
  th_status: { id: 'Status', en: 'Status' },
  th_days: { id: 'Hari', en: 'Days' },
  th_value: { id: 'Nilai order', en: 'Order value' },
  client_share: { id: '{p} dari nilai', en: '{p} of value' },
  st_in_transit: { id: 'Macet (in transit)', en: 'Stuck (in transit)' },
  st_exception: { id: 'Exception', en: 'Exception' },
  st_delayed: { id: 'Delayed', en: 'Delayed' },
  draft: { id: 'Draft pesan', en: 'Draft message' },
  draft_subject: { id: 'Order {id} perlu ditindak', en: 'Order {id} needs action' },
  see_client: { id: 'Fokus ke klien {k}', en: 'Focus on client {k}' },
  age: { id: '{d} hari', en: '{d} days' },
  explain_stuck: {
    id: 'Order ini sudah {d} hari berstatus in transit, jauh di atas lead time rata-rata {m} untuk {c}. Kemungkinan paket hilang atau statusnya tidak pernah diperbarui. Minta konfirmasi ke {c}.',
    en: 'This order has been in transit for {d} days, far above {c}’s {m} average lead time. The parcel is probably lost or its status was never updated. Ask {c} to confirm.',
  },
  explain_exc: {
    id: 'Order ini berstatus exception dan butuh tindakan. Hubungi {c} untuk menanyakan penyebabnya pada rute {r}.',
    en: 'This order is in exception and needs action. Contact {c} about the cause on route {r}.',
  },
  explain_delayed: {
    id: 'Order ini sampai dalam {d} hari dan dilabeli delayed, dibanding rata-rata {m} untuk {c}.',
    en: 'This order arrived in {d} days and was labeled delayed, versus {c}’s {m} average.',
  },
  basis_text: {
    id: 'Status {s}, {d} hari, lead time rata-rata {c} {m} ({n} order), klien {k} = {p} dari nilai order, nilai order ini {v}.',
    en: 'Status {s}, {d} days, {c} average lead time {m} ({n} orders), client {k} = {p} of order value, this order {v}.',
  },
})
