// Report schedules (in the Reports section)
import { defineMessages } from '.'

export const schedules = defineMessages({
  title: { id: 'Jadwal laporan', en: 'Report schedule' },
  sub: { id: 'Simulasi: jadwal tersimpan, tetapi email belum benar-benar dikirim.', en: 'Simulated: schedules are saved, but no email is actually sent.' },
  frequency: { id: 'Frekuensi', en: 'Frequency' },
  weekly: { id: 'Mingguan, Senin 08:00', en: 'Weekly, Monday 08:00' },
  monthly: { id: 'Bulanan, tanggal 1 08:00', en: 'Monthly, 1st at 08:00' },
  contents: { id: 'Isi laporan', en: 'Contents' },
  c_summary: { id: 'Ringkasan AI', en: 'AI summary' },
  c_kpis: { id: 'KPI', en: 'KPIs' },
  c_risk: { id: 'Order bermasalah', en: 'Problem orders' },
  c_csv: { id: 'Lampiran CSV', en: 'CSV attachment' },
  recipients: { id: 'Penerima (pisahkan dengan koma)', en: 'Recipients (comma-separated)' },
  recipients_example: { id: 'ops@spaceship.test, procurement@spaceship.test', en: 'ops@spaceship.test, procurement@spaceship.test' },
  uses_filters: { id: 'Memakai filter aktif: {v}', en: 'Uses the active filters: {v}' },
  save: { id: 'Simpan jadwal', en: 'Save schedule' },
  list: { id: 'Jadwal tersimpan', en: 'Saved schedules' },
  none: { id: 'Belum ada jadwal.', en: 'No schedules yet.' },
  delete: { id: 'Hapus jadwal', en: 'Delete schedule' },
})
