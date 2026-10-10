// Per-metric formula shown in KPI tooltips and the calc trace (keys match backend METRIC_SQL).
import { defineMessages } from '.'

export const formulas = defineMessages({
  orders: { id: 'orders = jumlah baris order pada filter', en: 'orders = number of order rows in the filter' },
  value: { id: 'order_value = jumlah order_value_usd (belum dipotong diskon promo)', en: 'order_value = sum of order_value_usd (not net of promo discounts)' },
  delivered: { id: 'delivered_rate = order berstatus delivered ÷ semua order', en: 'delivered_rate = orders with status delivered ÷ all orders' },
  delay: { id: 'delay_rate = order berstatus delayed ÷ semua order', en: 'delay_rate = orders with status delayed ÷ all orders' },
  ontime: { id: 'on_time_rate = order delivered ÷ (delivered + delayed)', en: 'on_time_rate = orders delivered ÷ (delivered + delayed)' },
  mean: { id: 'lead_mean = rata-rata lead time (hari order sampai tiba), hanya order yang punya tanggal tiba', en: 'lead_mean = average lead time (days from order to arrival), only orders with an arrival date' },
  p90: {
    id: 'lead_p90 = persentil ke-90 lead time (hari order sampai tiba), interpolasi linear, hanya order yang punya tanggal tiba',
    en: 'lead_p90 = 90th percentile of lead time (days from order to arrival), linear interpolation, only orders with an arrival date',
  },
  over7: { id: 'share_over_7d = order dengan lead time > 7 hari ÷ order yang punya tanggal tiba', en: 'share_over_7d = orders with lead time > 7 days ÷ orders with an arrival date' },
  stuck: { id: 'stuck_orders = order in transit dengan usia lebih dari 30 hari (per 30 Des 2025)', en: 'stuck_orders = in-transit orders older than 30 days (as of 30 Dec 2025)' },
  exc: { id: 'exception_orders = order berstatus exception', en: 'exception_orders = orders with status exception' },
  atrisk: { id: 'value_at_risk = jumlah nilai order delayed + exception + macet', en: 'value_at_risk = sum of value of delayed + exception + stuck orders' },
  // the labels and captions of the formulas drawn with this view's numbers (components/Formula.tsx)
  l_orders: { id: 'Order', en: 'Orders' },
  l_value: { id: 'Nilai order', en: 'Order value' },
  l_aov: { id: 'AOV', en: 'AOV' },
  l_delivered: { id: 'Terkirim', en: 'Delivered' },
  l_delay: { id: 'Delay rate', en: 'Delay rate' },
  l_ontime: { id: 'On-time rate', en: 'On-time rate' },
  l_mean: { id: 'Rata-rata waktu kirim', en: 'Average delivery time' },
  l_p90: { id: 'Lead time P90', en: 'Lead time P90' },
  l_over7: { id: 'Order > 7 hari', en: 'Orders > 7 days' },
  l_stuck: { id: 'Order macet', en: 'Stuck orders' },
  l_exc: { id: 'Order exception', en: 'Exception orders' },
  l_atrisk: { id: 'Nilai terdampak', en: 'Value at risk' },
  c_orders: { id: 'order', en: 'orders' },
  c_rows: { id: 'baris order', en: 'order rows' },
  c_delivered: { id: 'delivered', en: 'delivered' },
  c_final: { id: 'delivered + delayed', en: 'delivered + delayed' },
  c_delayed: { id: 'delayed', en: 'delayed' },
  c_arrived: { id: 'order tiba', en: 'arrived orders' },
  c_over7: { id: 'lebih dari 7 hari', en: 'over 7 days' },
  c_pctl: { id: 'persentil ke-90 dari lead time', en: '90th percentile of lead time' },
  c_median: { id: 'median', en: 'median' },
  c_mean: { id: 'rata-rata', en: 'mean' },
  c_stuck: { id: 'in transit lebih dari 30 hari', en: 'in transit for over 30 days' },
  c_exc: { id: 'berstatus exception', en: 'with status exception' },
  c_problem: { id: 'order delayed + exception + macet', en: 'delayed + exception + stuck orders' },
})

export type FormulaKey = keyof typeof formulas
export const isFormulaKey = (k: string): k is FormulaKey => k in formulas
