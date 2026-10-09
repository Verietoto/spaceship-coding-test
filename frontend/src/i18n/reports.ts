// Reports section (export); the AI summary and schedules have their own files
import { defineMessages } from '.'

export const reports = defineMessages({
  question: { id: 'Bagaimana membagikan hasilnya?', en: 'How do we share the results?' },
  export: { id: 'Ekspor data', en: 'Export data' },
  export_sub: { id: 'File berisi order sesuai filter aktif ({n} baris).', en: 'The file contains the orders in the active filter ({n} rows).' },
  csv: { id: 'Unduh CSV', en: 'Download CSV' },
  pdf: { id: 'Cetak / simpan PDF', en: 'Print / save PDF' },
  fmt_label: { id: 'Format', en: 'Format' },
  fmt_csv: { id: 'CSV', en: 'CSV' },
  fmt_pdf: { id: 'PDF', en: 'PDF' },
  preview: { id: 'Pratinjau 5 baris pertama', en: 'Preview of the first 5 rows' },
  filename: { id: 'orders_{f}.{ext}', en: 'orders_{f}.{ext}' },
})
