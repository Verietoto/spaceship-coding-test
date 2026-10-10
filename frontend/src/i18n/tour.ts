// The onboarding tour: the welcome card, one explanation per step, and the last card
import { defineMessages } from '.'

export const tour = defineMessages({
  dialog_label: { id: 'Tur pengenalan', en: 'Product tour' },
  // welcome
  welcome_title: { id: 'Selamat datang di Spaceship', en: 'Welcome to Spaceship' },
  welcome_lead: {
    id: 'Dashboard logistik yang menjawab pertanyaan operasi Anda: seberapa sehat pengirimannya, di mana masalahnya, dan apa yang harus dilakukan.',
    en: 'A logistics dashboard that answers your operations questions: how healthy deliveries are, where the problems are, and what to do about them.',
  },
  welcome_p1: { id: 'Filter dan bandingkan data dalam hitungan detik', en: 'Filter and compare data in seconds' },
  welcome_p2: { id: 'Tanya AI dalam bahasa sehari-hari; setiap jawaban bisa diperiksa', en: 'Ask the AI in plain language; every answer can be checked' },
  welcome_p3: { id: 'Buat dashboard sendiri dari satu kalimat', en: 'Build your own dashboard from one sentence' },
  welcome_time: { id: 'Sekitar 4 menit, dibagi per bab. Bab mana pun bisa dilewati.', en: 'About 4 minutes, split into chapters. You can skip any chapter.' },
  news_title: { id: 'Ada yang baru', en: 'What’s new' },
  news_lead: { id: 'Sejak kunjungan terakhir Anda ada fitur baru. Kami hanya menunjukkan yang baru.', en: 'There are new features since your last visit. We only show what is new.' },
  start: { id: 'Mulai tur', en: 'Start the tour' },
  start_news: { id: 'Lihat yang baru', en: 'Show me' },
  // buttons and progress
  skip: { id: 'Lewati', en: 'Skip' },
  skip_tour: { id: 'Lewati tur', en: 'Skip the tour' },
  skip_chapter: { id: 'Lewati bab ini', en: 'Skip this chapter' },
  next: { id: 'Lanjut', en: 'Next' },
  back: { id: 'Kembali', en: 'Back' },
  done: { id: 'Selesai', en: 'Done' },
  close: { id: 'Tutup tur', en: 'Close the tour' },
  progress: { id: '{n} dari {total}', en: '{n} of {total}' },
  chapter_of: { id: 'Bab {n} dari {total}', en: 'Chapter {n} of {total}' },
  announce: { id: 'Langkah {n} dari {total}: {title}', en: 'Step {n} of {total}: {title}' },
  // chapters
  ch_layout: { id: 'Mengenal layout', en: 'Getting around' },
  ch_sections: { id: 'Bagian dashboard', en: 'The sections' },
  ch_data: { id: 'Membaca data', en: 'Reading the data' },
  ch_case: { id: 'Kasus: membandingkan data', en: 'Case: comparing data' },
  ch_ai: { id: 'Bekerja dengan AI', en: 'Working with AI' },
  ch_build: { id: 'Membuat dashboard sendiri', en: 'Building your own dashboard' },
  ch_admin: { id: 'Admin', en: 'Admin' },
  // steps
  s_sidebar_t: { id: 'Navigasi', en: 'Navigation' },
  s_sidebar_b: {
    id: 'Pindah antar bagian: ringkasan, performa pengiriman, klien, risiko, prakiraan, kualitas data, dan laporan.',
    en: 'Switch between sections: overview, delivery performance, clients, risk, forecast, data quality and reports.',
  },
  s_header_t: { id: 'Bahasa, tema, dan akun', en: 'Language, theme and account' },
  s_header_b: {
    id: 'Ganti Indonesia/Inggris dan terang/gelap di sini, atau keluar dari akun. Tombol (?) memutar ulang tur ini.',
    en: 'Switch between Indonesian/English and light/dark here, or sign out. The (?) button replays this tour.',
  },
  s_filters_t: { id: 'Filter', en: 'Filters' },
  s_filters_b: {
    id: 'Persempit data berdasarkan periode, region, warehouse, carrier, atau klien. “Filter lainnya” membuka lebih banyak. Semuanya tersimpan di URL, jadi tampilan bisa dibagikan.',
    en: 'Narrow the data by period, region, warehouse, carrier or client. “More filters” opens more. Everything is kept in the URL, so a view can be shared.',
  },
  s_compare_t: { id: 'Bandingkan', en: 'Compare' },
  s_compare_b: {
    id: 'Lihat perubahan dibanding periode sebelumnya, periode lain pilihan Anda (mis. H2 vs H1), atau semua data.',
    en: 'See the change against the previous period, any other period you choose (e.g. H2 vs H1), or all data.',
  },
  s_kpis_t: { id: 'Kartu KPI', en: 'KPI cards' },
  s_kpis_b: {
    id: 'Enam angka utama beserta perubahannya. Arahkan kursor ke judul kartu untuk melihat arti tiap angka.',
    en: 'Six headline numbers with their change. Hover a card title to see what each number means.',
  },
  s_calc_t: { id: 'Cara menghitung', en: 'How it is calculated' },
  s_calc_b: {
    id: 'Buka ini untuk melihat filter, jumlah baris, dan rumus di balik angka. Tidak ada angka yang dikarang.',
    en: 'Open this to see the filters, row count and formula behind the numbers. Nothing is made up.',
  },
  s_ask_t: { id: 'Tanya atau beri perintah ke AI', en: 'Ask or tell the AI' },
  s_ask_b: {
    id: 'Ketik dalam bahasa sehari-hari: “tampilkan Q4 untuk UPS” mengatur filter, “berapa delay rate FedEx?” menjawab dengan angka.',
    en: 'Type in plain language: “show Q4 for UPS” sets the filters, “what is FedEx’s delay rate?” answers with numbers.',
  },
  s_copilot_t: { id: 'Copilot', en: 'Copilot' },
  s_copilot_b: {
    id: 'Jawaban, grafik, dan langkah kerja AI muncul di sini. Setiap jawaban punya panel “Cara AI menghitung”, dan perubahan filter bisa di-Undo.',
    en: 'Answers, charts and the AI’s steps appear here. Every answer has a “How the AI calculated this” panel, and filter changes can be undone.',
  },
  s_build_t: { id: 'Buat dashboard dengan AI', en: 'Build with AI' },
  s_build_b: {
    id: 'Jelaskan dashboard yang Anda mau dalam satu kalimat. AI menyusun draf, Anda mencobanya, lalu menyimpannya di sidebar.',
    en: 'Describe the dashboard you want in one sentence. The AI drafts it, you try it, then you save it in the sidebar.',
  },
  s_reports_t: { id: 'Laporan', en: 'Reports' },
  s_reports_b: {
    id: 'Ekspor CSV sesuai filter, cetak atau simpan PDF, dan atur jadwal laporan.',
    en: 'Export a CSV that matches your filters, print or save a PDF, and schedule reports.',
  },
  s_backoffice_t: { id: 'Backoffice (admin)', en: 'Backoffice (admin)' },
  s_backoffice_b: {
    id: 'Kelola dokumen yang dipakai AI, penyedia dan model AI, serta status tur pengguna. Hanya admin yang melihat ini.',
    en: 'Manage the documents the AI uses, the AI provider and model, and users’ tour status. Only admins see this.',
  },
  // sections of the sidebar
  s_sec_overview_t: { id: 'Ringkasan', en: 'Overview' },
  s_sec_overview_b: {
    id: 'Apakah operasi sehat dan membaik? Enam KPI dengan perbandingan, tren delay per bulan, dan sebaran lead time.',
    en: 'Is the operation healthy and improving? Six KPIs with comparisons, the monthly delay trend, and the lead-time spread.',
  },
  s_sec_delivery_t: { id: 'Performa pengiriman', en: 'Delivery performance' },
  s_sec_delivery_b: {
    id: 'Carrier dan region mana yang lambat? Ranking carrier dengan garis target, heatmap carrier × region, dan warehouse per region.',
    en: 'Which carriers and regions are slow? A carrier ranking with a target line, a carrier × region heatmap, and warehouses by region.',
  },
  s_sec_clients_t: { id: 'Klien', en: 'Clients' },
  s_sec_clients_b: {
    id: 'Siapa klien terbesar dan mana yang paling terdampak keterlambatan? Pangsa nilai order, klien dengan delay tinggi, dan nilai yang berisiko.',
    en: 'Who are the biggest clients and which are hit hardest by delays? Share of order value, clients with high delay rates, and the value at risk.',
  },
  s_sec_risk_t: { id: 'Risiko dan pengecualian', en: 'Risk & exceptions' },
  s_sec_risk_b: {
    id: 'Order mana yang perlu ditangani lebih dulu? Order bermasalah diurut menurut dampak bisnis, dengan penjelasan AI untuk tiap order.',
    en: 'Which orders need attention first? Problem orders sorted by business impact, with an AI explanation for each one.',
  },
  s_sec_forecast_t: { id: 'Prakiraan permintaan', en: 'Demand forecast' },
  s_sec_forecast_b: {
    id: 'Berapa permintaan beberapa bulan ke depan? Prakiraan order atau unit 1–6 bulan per kategori, metode dipilih lewat backtest, plus rekomendasi inventori.',
    en: 'How much demand is coming? 1–6 month forecasts of orders or units by category, the method chosen by backtest, plus an inventory recommendation.',
  },
  s_sec_quality_t: { id: 'Kualitas data', en: 'Data quality' },
  s_sec_quality_b: {
    id: 'Seberapa bisa angkanya dipercaya? Masalah data (mis. order in transit yang macet) dan keterbatasannya, supaya Anda tahu kapan harus berhati-hati.',
    en: 'How far can the numbers be trusted? Data issues (such as stuck in-transit orders) and known limits, so you know when to be careful.',
  },
  // a worked case
  s_case_setup_t: { id: 'Kasus: apakah H2 lebih baik dari H1?', en: 'Case: is H2 better than H1?' },
  s_case_setup_b: {
    id: 'Untuk contoh ini kami memilih periode H2 di filter dan menyetel pembanding ke H1. Tampilan Anda dikembalikan setelah bab ini.',
    en: 'For this example we picked H2 in the filters and set the comparison to H1. Your own view is put back after this chapter.',
  },
  s_case_read_t: { id: 'Membaca perbandingannya', en: 'Reading the comparison' },
  s_case_read_b: { id: 'Angka besar di tiap kartu adalah H2. Perhatikan tiga hal:', en: 'The big number on each card is H2. Look at three things:' },
  s_case_read_i1: { id: 'Panah ↑/↓ menunjukkan arah dan besar perubahan terhadap H1', en: 'The arrow ↑/↓ shows the direction and size of the change against H1' },
  s_case_read_i2: { id: 'Baris di bawahnya memuat nilai H1 sebagai pembanding', en: 'The line under it shows the H1 value it is compared with' },
  s_case_read_i3: { id: 'Hijau berarti membaik, merah memburuk (delay yang turun hijau)', en: 'Green means better, red worse (a falling delay rate is green)' },
  s_case_trend_t: { id: 'Lihat polanya per bulan', en: 'See the pattern by month' },
  s_case_trend_b: {
    id: 'Arahkan kursor ke batang tren untuk melihat nilai, jumlah order, dan nilai pembanding. Batang yang dipudarkan ada di luar periode terpilih.',
    en: 'Hover a bar in the trend to see its value, order count and comparison value. Faded bars are outside the selected period.',
  },
  // how to ask the agent
  s_ask_howto_t: { id: 'Ubah filter dan tanya dengan kalimat', en: 'Change filters and ask with a sentence' },
  s_ask_howto_b: { id: 'Command bar mengubah tampilan dan menjawab angka. Coba kalimat seperti:', en: 'The command bar changes the view and answers with numbers. Try sentences like:' },
  s_ask_howto_i1: { id: '“Tampilkan Q4 untuk UPS”: mengatur periode dan carrier', en: '“Show Q4 for UPS”: sets the period and the carrier' },
  s_ask_howto_i2: { id: '“Bandingkan dengan periode sebelumnya”: mengubah pembanding', en: '“Compare with the previous period”: changes the comparison' },
  s_ask_howto_i3: { id: '“Berapa delay rate FedEx di EU?”: menjawab dengan angka dan rumus', en: '“What is FedEx’s delay rate in EU?”: answers with numbers and the formula' },
  s_ask_howto_i4: { id: 'Perubahan tercatat di “Yang saya ubah”, dan Undo membatalkannya', en: 'Changes are listed under “What I changed”, and Undo reverts them' },
  // building a dashboard
  s_build_prompt_t: { id: 'Tulis dashboard yang Anda mau', en: 'Describe the dashboard you want' },
  s_build_prompt_b: { id: 'Satu kalimat cukup. AI menyusun rencana dan draf dashboard: KPI, chart, dan filter.', en: 'One sentence is enough. The AI drafts a plan and a dashboard: KPIs, charts and filters.' },
  s_build_prompt_i1: { id: 'Bila permintaan samar, AI bertanya (maksimal 3 kali) dengan pilihan dari data nyata', en: 'If the request is vague, the AI asks (up to 3 questions) with options taken from the real data' },
  s_build_prompt_i2: { id: 'Draf bisa dicoba dengan filternya sebelum disimpan', en: 'Try the draft with its filters before saving it' },
  s_build_prompt_i3: { id: 'Ubah lewat prompt: “jadikan pie jadi bar”, “tiga chart dalam satu baris”', en: 'Change it with a prompt: “turn the pie into a bar”, “three charts in one row”' },
  s_build_prompt_i4: { id: 'Simpan: dashboard muncul di sidebar dan bisa diubah lagi kapan saja', en: 'Save it: the dashboard appears in the sidebar and can be changed again any time' },
  s_build_example_t: { id: 'Belum tahu mulai dari mana?', en: 'Not sure where to start?' },
  s_build_example_b: {
    id: 'Klik contoh untuk mengisi kolom, lalu tekan Buat. Hasilnya muncul di bawah sebagai draf yang bisa Anda coba.',
    en: 'Click the example to fill the box, then press Build. The result appears below as a draft you can try.',
  },
  // last card
  finish_title: { id: 'Siap!', en: 'You’re all set!' },
  finish_body: { id: 'Anda sudah mengenal bagian utamanya. Coba tanyakan sesuatu ke Copilot:', en: 'You know the main parts now. Try asking the Copilot something:' },
  finish_body_news: { id: 'Itu semua yang baru.', en: 'That’s everything new.' },
  finish_q1: { id: 'Berapa delay rate tiap carrier?', en: 'What is the delay rate of each carrier?' },
  finish_q2: { id: 'Buat heatmap delay rate carrier × region', en: 'Make a heatmap of delay rate by carrier × region' },
  finish_hint: { id: 'Tur bisa diulang kapan saja dari tombol bantuan (?) di pojok kanan atas.', en: 'You can replay the tour any time from the help button (?) at the top right.' },
  // help menu
  help_label: { id: 'Bantuan', en: 'Help' },
  help_restart: { id: 'Mulai tur lagi', en: 'Restart the tour' },
  help_news: { id: 'Lihat yang baru', en: 'See what’s new' },
})
