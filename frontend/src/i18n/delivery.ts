// Delivery performance section
import { defineMessages } from '.'

export const delivery = defineMessages({
  question: { id: 'Carrier dan warehouse mana yang bermasalah?', en: 'Which carriers and warehouses are struggling?' },
  carrier_rank: { id: 'Ranking carrier', en: 'Carrier ranking' },
  click_focus: { id: 'Klik baris untuk memfokuskan dashboard.', en: 'Click a row to focus the dashboard.' },
  rank_note: { id: 'Garis putus-putus = target delay 10%. Skala bar 0–25%.', en: 'Dashed line = 10% delay target. Bar scale 0–25%.' },
  th_mean: { id: 'Rata-rata', en: 'Mean' },
  by_p90: { id: 'P90', en: 'P90' },
  heat_title: { id: 'Delay rate carrier × region', en: 'Carrier × region delay rate' },
  heat_note: { id: 'Garis putus-putus: kurang dari 5 order, jangan disimpulkan.', en: 'Dashed outline: fewer than 5 orders, don’t draw conclusions.' },
  heat_cell: { id: '{c} · {r}: {v} ({n} order)', en: '{c} · {r}: {v} ({n} orders)' },
  wh_title: { id: 'Warehouse per region', en: 'Warehouses by region' },
  wh_note: {
    id: 'Setiap warehouse hanya melayani satu region, jadi bandingkan di dalam region yang sama.',
    en: 'Each warehouse serves one region only, so compare within a region.',
  },
})
