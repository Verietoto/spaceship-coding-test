// Demand forecast section
import { defineMessages } from '.'

export const forecast = defineMessages({
  question: { id: 'Berapa permintaan yang diperkirakan, dan berapa yang perlu disiapkan?', en: 'How much demand should we expect, and how much should we plan for?' },
  metric_label: { id: 'Yang diprakirakan', en: 'What to forecast' },
  metric_orders: { id: 'Order', en: 'Orders' },
  metric_units: { id: 'Unit', en: 'Units' },
  category_label: { id: 'Kategori produk', en: 'Product category' },
  all_categories: { id: 'Semua kategori', en: 'All categories' },
  horizon_label: { id: 'Prakiraan ke depan', en: 'Months ahead' },
  horizon: { id: '{n} bulan', en: '{n} months' },
  service_label: { id: 'Tingkat layanan', en: 'Service level' },
  title_orders: { id: 'Order per bulan dan prakiraan', en: 'Orders per month and forecast' },
  title_units: { id: 'Unit per bulan dan prakiraan', en: 'Units per month and forecast' },
  actual: { id: 'Aktual', en: 'Actual' },
  forecast: { id: 'Titik prakiraan', en: 'Forecast point' },
  range: { id: 'Rentang 80%', en: '80% range' },
  lbl_next: { id: 'Prakiraan {n} bulan ke depan', en: 'Next {n} months' },
  next_orders: { id: '{v} order/bulan', en: '{v} orders/month' },
  next_units: { id: '{v} unit/bulan', en: '{v} units/month' },
  range_value: { id: 'rentang 80%: {lo}–{hi}', en: '80% range: {lo}–{hi}' },
  lbl_wape: { id: 'Akurasi backtest (WAPE)', en: 'Backtest accuracy (WAPE)' },
  wape_value: { id: '{m} vs bulan lalu {n}', en: '{m} vs same as last month {n}' },
  // method card
  method_title: { id: 'Metode', en: 'Method' },
  n_moving_average: { id: 'Rata-rata bergerak', en: 'Moving average' },
  n_ses: { id: 'Exponential smoothing', en: 'Exponential smoothing' },
  n_linear_trend: { id: 'Tren linear', en: 'Linear trend' },
  p_moving_average: { id: 'rata-rata {w} bulan terakhir', en: 'mean of the last {w} months' },
  p_ses: { id: 'alpha {a}', en: 'alpha {a}' },
  p_linear_trend: { id: 'kemiringan {s} per bulan', en: 'slope {s} per month' },
  m_naive: { id: 'Sama dengan bulan lalu (hanya pembanding)', en: 'Same as last month (yardstick only)' },
  col_method: { id: 'Metode', en: 'Method' },
  col_wape: { id: 'WAPE', en: 'WAPE' },
  col_mae: { id: 'MAE', en: 'MAE' },
  best: { id: 'terbaik', en: 'best' },
  // inventory card
  inv_title: { id: 'Rekomendasi inventori', en: 'Inventory recommendation' },
  inv_planned: { id: 'Kebutuhan prakiraan ({n} bulan)', en: 'Forecast demand ({n} months)' },
  inv_safety: { id: 'Stok pengaman', en: 'Safety stock' },
  inv_total: { id: 'Disarankan tersedia', en: 'Recommended to have available' },
  inv_unit: { id: '{v} unit', en: '{v} units' },
  // shown only as the hover text of a title
  inv_formula: { id: 'Σ prakiraan + z × galat × √bulan, z = {z} untuk tingkat layanan {s}%', en: 'Σ forecast + z × error × √months, z = {z} for a {s}% service level' },
  inv_note: {
    id: 'Data tidak memuat stok di tangan maupun lead time pemasok, jadi ini jumlah unit yang perlu tersedia selama {n} bulan, bukan jumlah yang harus dipesan.',
    en: 'The data has no stock on hand and no supplier lead time, so this is the units that should be available over {n} months, not an order quantity.',
  },
  limit: {
    id: 'Data hanya 12 bulan tanpa pola musiman yang jelas, jadi prakiraan datar dan rentangnya lebar. Baca sebagai kisaran; butuh minimal dua siklus tahunan untuk akurasi lebih baik.',
    en: 'Only 12 months without clear seasonality, so the forecast is flat with a wide range. Read it as a range; at least two yearly cycles are needed for better accuracy.',
  },
})
