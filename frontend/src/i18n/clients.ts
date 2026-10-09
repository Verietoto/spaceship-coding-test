// Clients section
import { defineMessages } from '.'

export const clients = defineMessages({
  question: { id: 'Klien mana yang paling terdampak?', en: 'Which clients are hit hardest?' },
  top5: { id: '5 klien teratas', en: 'Top 5 clients' },
  top5_sub: { id: 'dari nilai order · {v}', en: 'of order value · {v}' },
  flagged: { id: 'Klien delay > 20%', en: 'Clients with delay > 20%' },
  flagged_sub: { id: 'minimal 8 order', en: 'at least 8 orders' },
  risk: { id: 'Nilai terdampak', en: 'Value at risk' },
  risk_sub: { id: '{p} dari nilai order (delayed + exception + macet)', en: '{p} of order value (delayed + exception + stuck)' },
  click: { id: 'Klik klien untuk melihat order bermasalahnya di Risiko.', en: 'Click a client to see its problem orders in Risk.' },
  by_value: { id: 'Nilai', en: 'Value' },
  by_risk: { id: 'Nilai terdampak', en: 'Value at risk' },
  col_open: { id: 'Berjalan bermasalah', en: 'Open problems' },
  col_risk: { id: 'Nilai terdampak', en: 'Value at risk' },
  table: { id: 'Semua klien', en: 'All clients' },
  show_all: { id: 'Tampilkan semua ({n})', en: 'Show all ({n})' },
  show_top: { id: 'Tampilkan 10 teratas', en: 'Show top 10' },
})
