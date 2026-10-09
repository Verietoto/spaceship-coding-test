# Spaceship: AI-Powered Logistics Analytics Dashboard

Dashboard operasi dan procurement untuk melihat kesehatan pengiriman, menemukan penyebab masalah, dan mengambil tindakan, dengan filter manual atau bahasa natural (ID/EN). Dibangun dari desain v2 dan prototipe klik, memakai `data/mock_logistics_data.csv` (400 order, Jan–Des 2025).

## Fitur

| Area | Isi |
|---|---|
| 7 section | Ringkasan (6 KPI + pembanding, tren delay, histogram lead time), Performa pengiriman (ranking carrier, heatmap carrier × region, warehouse per region), Klien, Risiko & pengecualian (urut dampak bisnis), Prakiraan permintaan (order atau unit, per kategori, rekomendasi inventori), Kualitas data, Laporan |
| Filter | Periode (semua data, preset tahun/semester/kuartal/bulan dari tahun yang ada di data, atau rentang tanggal kustom), region, warehouse, carrier, klien, kategori produk, status, promo, kota asal, kota tujuan, SKU: **pilih beberapa nilai** atau **kecuali** nilai tertentu, dengan jumlah order per opsi; rentang angka (nilai order, jumlah barang, lead time, umur order) dan tanggal tiba. Pembanding (periode sebelumnya / semua data). Filter tersimpan di URL (bisa dibagikan), bisa disimpan sebagai preset, dan "Ekspor PDF" mencetak tampilan aktif |
| AI: Command bar + Copilot | Mengatur filter dan membuka section lewat kalimat, menjawab dengan angka hasil query, membuat chart dinamis, daftar "Yang saya ubah", tanda **AI** di filter, **Undo** |
| AI: transparansi | Setiap jawaban berangka punya "Cara AI menghitung": filter, baris dihitung, rumus, dan **SQL yang benar-benar dijalankan** |
| AI: Builder | Satu kalimat → rencana + draft dashboard (KPI + chart + filter yang bisa dicoba sebelum disimpan) → disimpan di sidebar; draft dan dashboard tersimpan bisa diubah lewat prompt (usulan AI diperiksa dulu, lalu "Simpan perubahan" atau "Buang") |
| AI: penjelasan | Per order bermasalah, per masalah kualitas data, dan ringkasan laporan dari filter aktif |
| Laporan | Ekspor CSV sesuai filter, cetak/simpan PDF, jadwal laporan (tersimpan, pengiriman email masih simulasi) |
| Global | ID/EN, terang/gelap, login admin dan visitor |

## Arsitektur

```
Browser (React + Vite, recharts)
   │  /api/* (cookie session)
   ▼
FastAPI  app/main.py: setiap modul fitur menyumbang satu router
   ├─► modules/analytics ──► PostgreSQL `orders` (user app)
   ├─► modules/ai ─► Jev (routing) ─► coordinator agent ─► subagents analyst · charter · builder (deepagents + OpenAI)
   │        └─► db/readonly.py ──► PostgreSQL `orders` (login `analytics_ro`: SELECT saja, read-only, timeout 5 s)
   ├─► modules/dashboards ──► PostgreSQL `dashboards` (widget di-render ulang lewat db/readonly.py)
   ├─► modules/schedules ──► PostgreSQL `schedules`
   └─► modules/auth (login simulasi)
```

Satu service: FastAPI menyajikan API sekaligus hasil build React. `docker compose up` menjalankan Postgres + app.

### Backend (`backend/app/`)

| Path | Peran |
|---|---|
| `main.py` | `create_app()`: memasang router dari daftar `MODULES`, menyajikan `frontend/dist` |
| `core/` | `config.py` (semua env + path), `security.py` (cookie sesi), `errors.py` (error AI → HTTP 503/502) |
| `db/` | `engine.py` (engine + session app, `query()`), `readonly.py` (eksekusi SQL dari LLM), `base.py` (model dasar ORM) |
| `modules/<fitur>/` | Satu modul per fitur: `router.py` (tipis, tanpa SQL), `schemas.py` (Pydantic), logika (`service.py` / file domain), `models.py` + `repository.py` bila menyimpan data |
| `modules/analytics/` | `filters.py` (filter tervalidasi), `metrics.py` (semua angka dalam SQL), `sections.py`, `forecast.py`, `seed.py` (CSV → `orders`) |
| `modules/ai/` | `llm.py`, `copilot.py`, `builder.py`, `reports.py`, `agents/` (tim agent, lihat bagian Agent AI) |
| `migrations/` | Alembic: `0001` orders (kolom turunan `month`, `lead_days`, `age_days` sebagai generated column), `0002` dashboards + schedules (JSONB), `0003` role `analytics_ro` |

Aturan dependensi: `core ← db ← analytics ← ai → dashboards`. Modul tidak mengimpor `router.py`/`repository.py` modul lain, dan `analytics` tidak mengimpor modul lain. Tambah fitur = folder baru di `modules/` + satu baris di `MODULES`.

### Frontend (`frontend/src/`)

| Path | Peran |
|---|---|
| `App.tsx` | Shell: sidebar, top bar, filter bar, konten + Copilot |
| `app/` | `AppProvider` + `useApp` (filter, undo, section, bahasa, tema, sesi), `useApi`, `useTheme` |
| `lib/` | Klien API, tipe bersama, periode, delta |
| `components/` | UI bersama tanpa logika fitur (Card, KpiCard, CalcTrace, FilterBar, DynamicChart, LanguageSwitch, ThemeToggle, …) |
| `features/<fitur>/` | Satu folder per section + `ai/` dan `builder/`. Feature tidak mengimpor feature lain |
| `i18n/` | **Semua teks UI**, satu file per page/komponen, setiap teks berisi semua bahasa: `title: { id: 'Ringkasan', en: 'Overview' }`. `format.ts` memformat angka/uang/tanggal dengan `Intl` sesuai bahasa |

Komponen tidak berisi teks UI. Mereka memanggil `useMessages(overview)` lalu `t('title')`. Bahasa yang terlewat atau key yang salah ketik membuat build gagal. Menambah bahasa: tambahkan ke `Lang` di `i18n/index.ts`, lalu compiler menunjukkan setiap teks yang belum diterjemahkan. Tema Light/Dark tersimpan di browser dan awalnya mengikuti setelan OS.

## Filter

Satu bentuk filter dipakai di UI, URL, API, Copilot, jadwal, dan preset (`Filters` di `analytics/filters.py`):
- **Periode** (tanggal order): `start`/`end` (ISO, inklusif).
- **Filter pilihan**: daftar nilai per dimensi, kosong = semua, dan `exclude` (dimensi yang daftarnya berarti "kecuali"). Dimensinya: `region`, `warehouse`, `carrier`, `client`, `category` (kategori produk), `status` (delivered, delayed, in_transit, exception, canceled), `promo` (`1` promo, `0` biasa), `origin` (kota asal), `destination` (kota tujuan), `sku`. Semuanya satu kolom `orders`; menambah dimensi = satu baris di `DIM_COLS`.
- **Rentang angka** (batas bawah dan/atau atas, inklusif): `value` (nilai order USD), `quantity`, `lead` (lead time, hari), `age` (umur order, hari), sebagai `value_min`/`value_max` dan seterusnya; di JSON: `"ranges": {"value": [10, 50]}`.
- **Tanggal tiba**: `arrived_start`/`arrived_end` (kolom `delivery_date`).
- Order yang belum tiba tidak punya lead time dan tanggal tiba, sehingga batas pada keduanya menyisihkan mereka.
- **Filter status mengubah dasar hitungan KPI**: dengan status = delayed, Terkirim 0% dan Delay rate 100%. Hitungannya benar; UI memberi catatan di judul filter, dan rumus tidak diubah.

```
GET /api/overview?start=2025-10-01&end=2025-12-31&carrier=UPS&carrier=FedEx&exclude=region&region=EU&category=PAPER&value_min=50&lead_max=7
```

- Parameter diulang (bukan dipisah koma) karena nilai bisa memuat koma. Bentuk lama `?period=Q4&carrier=UPS` tetap diterima.
- Semua nilai dicek terhadap data, tanggal di-parse, dan angka harus berhingga (batas bawah ≤ batas atas) sebelum masuk SQL; nilai tak dikenal → 422. Nilai pilihan juga di-escape kutipnya.
- `GET /api/facets` mengembalikan tiap opsi beserta jumlah order di bawah **filter lain** (filter dimensinya sendiri diabaikan), plus rentang tanggal data dan batas nyata tiap rentang angka (untuk placeholder).
- **UI:** lima kontrol utama (periode, region, warehouse, carrier, klien) tetap di bar; tombol "Filter lainnya (n)" membuka panel untuk 11 filter lainnya, dan semua filter aktif tampil sebagai chip yang bisa dihapus. Tautan yang memuat filter lanjutan membuka panelnya otomatis.
- Pembanding "periode sebelumnya": kelipatan bulan kalender (bulan, kuartal, semester, tahun) mundur sebanyak itu; rentang lain mundur sepanjang jumlah harinya; kosong bila jatuh sebelum data.
- Preset (`/api/presets`) dibagikan ke semua pengguna selama login masih simulasi.

## Agent AI

Copilot dan Builder berjalan di atas [deepagents](https://docs.langchain.com/oss/python/deepagents/overview). Satu **coordinator** (agent utama) mengatur tampilan dan mendelegasikan ke **subagent**; subagent hanya melihat instruksi dari coordinator, bukan riwayat chat.

```
pesan ─► Jev (TypeSafe): tool & subagent mana yang perlu? ─► coordinator ──task──► analyst | charter | builder
```

| Agent | Tools | Tugas |
|---|---|---|
| coordinator | `get_view`, `remember`, `set_filters`, `open_section`, `search_kb`, `task` | memahami permintaan, mengubah filter/section, mengingat catatan user, mencari knowledge base, mendelegasikan |
| analyst | `get_view`, `get_kpis`, `get_facets`, `run_sql` | pertanyaan berangka |
| charter | `get_view`, `get_facets`, `run_sql`, `make_chart` | grafik |
| forecaster | `get_view`, `forecast_demand` | prakiraan permintaan order atau unit (semua produk, satu kategori, atau satu SKU), 1–6 bulan, dengan rekomendasi inventori untuk unit |
| builder | `get_view`, `get_facets`, `run_sql`, `create_dashboard` | draft dashboard; menguji SQL tiap widget sebelum menyerahkan (juga dipakai sendiri oleh `/api/builder`) |

- **Routing Jev:** model keputusan yang menjawab pertanyaan bertipe (perlu analyst? chart? builder? mengubah tampilan? maksud utama?) dengan probabilitas, dalam puluhan hingga ratusan ms. Hanya tool dan subagent yang dipilih yang dimuat ke LLM. Bila Jev ragu (di bawah `JEV_THRESHOLD`), lambat, error, atau kunci kosong, **semua dimuat**: routing tidak pernah membuat permintaan gagal. Keputusannya ikut di respons (`route`).
- **Batas:** tidak ada shell, tidak ada akses file (tool file bawaan deepagents dimatikan dan semua operasi file ditolak), tidak ada subagent umum. Semua SQL lewat `db/readonly.py`. Satu-satunya tool yang "menulis" adalah `create_dashboard`, yang hanya membuat draft di memori; menyimpan tetap tombol pengguna.
- **Jejak hitungan:** setiap query tool dicatat per request, jadi "Cara AI menghitung" tetap lengkap walaupun coordinator hanya menerima teks akhir subagent.
- **Menambah subagent:** satu file seperti `agents/analyst.py` (`NAME`, `INTENT`, `DESCRIPTION`, `TOOLS`, `prompt`) dan satu baris di `agents/router.py: REGISTRY`. Pertanyaan routing dibentuk otomatis dari registry.
- `/api/explain` dan `/api/summary` tetap satu panggilan LLM (tidak butuh tool).
- **Progres langsung:** `POST /api/copilot/stream` mengirim satu JSON per baris (NDJSON) selama agent bekerja: `route` (pilihan Jev), `guard` (penolakan), `agent` (subagent yang dikerahkan), `tool` / `tool_done` (nama, beberapa argumen aman, jumlah baris; tidak pernah SQL atau isi data), `agent_done`, lalu `done` dengan respons yang sama seperti `/api/copilot` (yang tetap ada, tanpa progres). Panel Copilot menampilkannya sebagai garis waktu beranimasi dan melipatnya di bawah jawaban. Bila server di belakang proxy, matikan buffering untuk jalur ini (`X-Accel-Buffering: no` sudah dikirim).
- **Builder yang bertanya:** `POST /api/builder/clarify` memutuskan apakah permintaan sudah cukup jelas. Jev jadi gerbang cepat (dua pertanyaan: menyebut ukuran? spesifik?), permintaan spesifik langsung `ready` tanpa LLM; yang samar memicu satu panggilan LLM yang menulis satu pertanyaan dengan 2–4 pilihan dari data nyata (user juga bisa mengetik jawaban sendiri), maksimal 3 putaran, dan di luar topik ditolak. Tanpa state di server: klien mengirim ulang prompt dan semua jawaban. `POST /api/builder/stream` membangunnya sambil mengirim progres (NDJSON: agent Builder, tool, judul widget, hasil) lalu `done` dengan draft; `/api/builder` lama tetap ada.
- **"Cara AI menghitung" menampilkan rumus, bukan SQL.** Backend mengirim angka di balik tiap metrik (`calc.terms`, dari `stats()` yang sama dengan halaman) dan UI menyusunnya jadi rumus berangka yang bisa dicek ("55 delayed ÷ 400 order = 13,8%"). Rumus untuk query buatan agent hanya berupa definisi tanpa angka (agent menulisnya sebelum melihat hasil, jadi angka darinya tidak dipercaya). SQL tetap ada di payload API untuk audit, tidak ditampilkan.
- **Layout dashboard dari agent:** widget boleh membawa `span` (1–12 kolom dari grid 12 kolom: 12 satu baris penuh, 6 setengah, 4 sepertiga, 3 seperempat); widget mengisi baris dari kiri ke kanan sesuai urutan daftar, jadi "tiga chart dalam satu baris" = tiga chart berturut-turut dengan `span: 4`. Tanpa `span`, KPI memakai 4 dan chart 12 (satu baris). Chart minimal 4 dan KPI minimal 2 (dirapikan diam-diam). Satu dashboard memuat paling banyak 24 widget; melebihi itu, agent diberi tahu (tidak dipotong diam-diam) dan diminta menyebut apa yang dikorbankan. Layout bisa diminta di prompt awal, atau diubah lewat "Ubah dashboard ini" pada draft maupun dashboard tersimpan. Lebar diukur dari wadah dashboard: ≤ 900 px span di bawah 6 jadi 6, ≤ 620 px semua satu kolom.
- **Dashboard dengan filter dari agent:** `create_dashboard` menerima `filters` (periode, tanggal tiba, semua filter pilihan, dan rentang angka dengan `min`/`max`, masing-masing dengan default bila permintaan menyebut cakupan). Widget mengikuti filter dengan menaruh penanda `{{WHERE}}` di klausa WHERE; saat dirender, penanda diganti klausa dari generator filter yang sama dengan dashboard utama (nilainya divalidasi terhadap data, dan hasilnya tetap lewat login baca-saja). `GET /api/dashboards/{id}` membuka dashboard pada default-nya; dengan `custom=true` query string menjadi seluruh kebenaran (kosong = semua), dan hanya filter yang dideklarasikan dashboard yang bisa mempersempitnya. Agent mendapat error bila filternya tak dikenal, defaultnya tak valid, atau tak ada widget yang memakai `{{WHERE}}`.
- **Glosarium dashboard** (`agents/glossary.py`): arti tiap kartu, grafik, dan section (rumus, target usulan, arti perubahan/pembanding). Ada di prompt coordinator, jadi "apa arti P90?" dijawab langsung tanpa tool (intent Jev `explain`); bila user juga minta nilainya, coordinator mendelegasikan ke analyst. Ubah bersamaan dengan teks UI dan `analytics/metrics.py`.

### Bahasa jawaban (Jev)
Langkah Jev ketiga, paralel dengan guard input dan routing, membaca bahasa **pesan** (`ai/language.py`): Indonesia (termasuk campuran dengan istilah teknis Inggris), Inggris, atau bahasa lain. Agent hanya menjawab Indonesia atau Inggris: pesan Indonesia dijawab Indonesia, pesan Inggris dijawab Inggris, **bahasa lain dijawab Inggris** (pesan itu diberi pengingat singkat di ujungnya, karena model cenderung meniru bahasa pengguna). Kalau Jev tidak yakin (di bawah `JEV_THRESHOLD`), gagal, atau pesannya hanya satu kata Latin atau kode ("UPS"), bahasa tombol UI yang dipakai. Berlaku juga untuk pesan penolakan guard dan pertanyaan serta judul Builder. Hasilnya tercatat di `route.language`. Label dan tombol UI tetap mengikuti tombol bahasa.

### Guardrail (Jev)
Dua pemeriksaan Jev di sekitar Copilot (`modules/ai/guard.py`), semuanya pertanyaan bertipe dengan probabilitas:
- **Input**, paralel dengan routing: hanya topik dashboard (data, filter, grafik, laporan, knowledge base, catatan user) atau **pembuatnya** yang dijawab. `off_topic` (kode, pengetahuan umum, tokoh negara lain, dst.), `prompt_injection`, dan `sensitive_data` ditolak dengan pesan tetap **tanpa memanggil LLM**. Ambang `GUARD_OFFTOPIC_THRESHOLD` lebih rendah dari `GUARD_THRESHOLD` supaya pertanyaan dashboard yang ambigu tetap lolos. Jawaban soal pembuat diambil dari dokumen KB (mis. judul "Tentang pembuat dashboard") yang diisi admin; tidak ada isinya berarti "belum ada informasinya".
- **Tool**: sebelum `run_sql`, `make_chart`, `create_dashboard`, apakah query cocok dengan permintaan. Bila Jev yakin tidak cocok, query tidak dijalankan dan agent diberi tahu alasannya.
- **Hanya lapisan kedua.** Login baca-saja, satu statement, batas baris, timeout, dan validasi nilai filter tidak bergantung pada Jev, dan prompt agent memuat aturan cakupan yang sama. Tanpa key, timeout, atau error, pemeriksaan **dilewati** (`skipped`) dan permintaan tetap jalan: guard bisa menolak, tidak pernah membuat permintaan gagal.
- Yang diblokir atau ditandai dicatat di `guard_events` (untuk halaman admin nanti); respons membawa `guard` dan UI menampilkan badge "Diperiksa guardrail".

### Backoffice
Menu **Backoffice** (hanya admin; server menolak akun lain dengan 403) berisi dua tab:
- **Dokumen knowledge**: tambah, ubah, hapus dokumen tim.
- **AI**: penyedia (OpenAI atau OpenRouter, URL-nya preset tetap), API key, model, dan model subagent. Berlaku untuk permintaan AI berikutnya tanpa restart. Pengaturan di database mengalahkan `.env` per kolom; `.env` tetap jadi cadangan. Key hanya bisa ditulis: disimpan terenkripsi (Fernet, `SETTINGS_KEY`), tidak pernah dikembalikan oleh API atau dicatat di log, UI hanya menampilkan empat karakter terakhir. Tombol **Uji koneksi** mencoba nilai yang sedang diisi sebelum disimpan. Kunci Jev (TypeSafe) tetap di `.env`. Cache pengaturan ada di memori proses (TTL 5 detik, dibersihkan saat simpan).

### Knowledge
- **Tentang saya** (`user_facts`): catatan pribadi per akun, mis. "saya memegang klien CL-1004". Dikelola di section Knowledge (semua akun) atau lewat chat ("ingat bahwa …", tool `remember`). Masuk ke prompt semua agent sebagai konteks, bukan instruksi.
- **Dokumen tim** (`kb_docs`): kontrak SLA, aturan bisnis, definisi KPI. Dikelola di **Backoffice** (hanya `admin`, di UI dan API); Copilot tetap membacanya untuk semua akun. Dicari dengan full-text search Postgres (tool `search_kb`, hanya dimuat bila Jev memilih intent `knowledge` atau `needs_kb`), dan jawabannya disampaikan seolah Copilot sudah tahu (tanpa menyebut "knowledge base" atau judul dokumen).

## Pendekatan

**Angka dihitung di satu tempat, dalam SQL.** Dashboard, Copilot, dan laporan memakai definisi yang sama (`modules/analytics/metrics.py`), sehingga panel "Cara menghitung" menampilkan query yang benar-benar menghasilkan angka di layar, bukan teks ilustrasi. Definisi:

- **Macet**: `in_transit` dan umur > 30 hari (per 30 Des 2025).
- **Order bermasalah berjalan**: exception + macet.
- **Nilai terdampak**: nilai order delayed + exception + macet.
- **Lead time**: hari dari order sampai tiba, hanya order yang punya tanggal tiba. P90 memakai interpolasi linear (`percentile_cont`).
- **Prakiraan** (`analytics/forecast.py`): bisa untuk **order** (jumlah baris) atau **unit** (`SUM(quantity)`) per bulan, untuk semua produk, satu kategori, atau satu SKU; filter periode diabaikan (butuh seluruh deret), filter carrier, region, warehouse, dan klien dipakai.
  - **Metode dipilih lewat backtest:** tiga metode sederhana bersaing: rata-rata bergerak 3 bulan, simple exponential smoothing (alpha dicari), dan tren linear (OLS, tidak pernah negatif). Masing-masing menebak satu bulan ke depan untuk tiap bulan dari 6 bulan terakhir, lalu dibandingkan dengan yang sebenarnya. Yang **WAPE**-nya (Σ|galat| ÷ Σ aktual) terkecil dipakai; kalau seri, yang lebih sederhana. WAPE dipilih karena MAPE meledak pada bulan sepi dengan angka sekecil ini. "Sama dengan bulan lalu" hanya pembanding.
  - **Halaman Prakiraan:** grafik garis (aktual, prakiraan putus-putus, pita rentang 80%) dengan pemilih metode; metode terbaik dipilih lebih dulu dan ditandai, tetapi pengguna bisa melihat prakiraan metode lain (API mengirim prakiraan, rentang, dan inventori tiap metode). Tabel metode menampilkan WAPE dan MAE ketiganya.
  - **Rentang 80%:** sebaran galat backtest metode terpilih, melebar sebanding √bulan, batas bawah 0.
  - **SKU:** hampir semua SKU hanya punya 1 order setahun, jadi tidak diprakirakan sendiri: prakiraan kategorinya dikali pangsa SKU di kategori itu (`basis` memuat pangsanya), dan jawabannya menyebut bahwa ini perkiraan kasar.
  - **Rekomendasi inventori** (hanya unit): `Σ prakiraan + z × galat × √bulan`, dengan z = 0,84 / 1,28 / 1,64 untuk tingkat layanan 80 / 90 / 95% (default 90%). Data tidak punya stok di tangan atau lead time pemasok, jadi hasilnya "unit yang perlu tersedia selama horizon", bukan jumlah pesanan.
  - **Copilot:** subagent `forecaster` memanggil `forecast_demand` (dipilih Jev lewat intent `forecast`); carrier, region, warehouse, atau klien yang disebut pengguna dipakai hanya untuk prakiraan itu dan tidak mengubah dashboard. Grafik garis (aktual, prakiraan, batas bawah dan atas) dan rumus berangka ikut di "Cara AI menghitung".

**AI tidak boleh mengarang angka.** Model hanya bisa membaca data lewat `run_sql`/`make_chart`, dan setiap jawaban mengembalikan SQL yang dijalankan beserta rumusnya. Mengubah dashboard dilakukan lewat tool `set_filters` yang divalidasi server (filter menumpuk untuk dimensi berbeda, menggantikan untuk dimensi yang sama; warehouse otomatis memilih region-nya).

**SQL dari LLM (dan widget dashboard) dijaga berlapis** (`db/readonly.py`, migrasi `0003`):

1. Dijalankan sebagai login terpisah `analytics_ro`: hanya `SELECT` pada `orders` (tidak bisa membaca `dashboards`/`schedules`), bukan superuser, transaksi read-only.
2. Dibungkus `SELECT * FROM (...) LIMIT %(row_cap)s`, sehingga selain query SELECT jadi syntax error. Batas baris dikirim sebagai parameter, sehingga Postgres menolak lebih dari satu statement.
3. Setiap query berjalan di koneksi baru dengan `SET LOCAL statement_timeout` 5 detik, sehingga `set_config(...)` di satu query tidak bisa melonggarkan query berikutnya.

Diuji di `backend/tests/db/test_readonly.py`: `DROP`, `COPY ... PROGRAM`, `pg_read_file`, keluar dari pembungkus subquery, membaca `dashboards`, `pg_sleep`, dll.

## Menjalankan secara lokal

**Paling cepat:** buat `.env` di root repo berisi `POSTGRES_PASSWORD`, `ANALYTICS_RO_PASSWORD`, `SESSION_SECRET`, dan akun `ADMIN_*`/`VISITOR_*` (tanpa nilai bawaan; `docker compose` menolak jalan tanpa tiga yang pertama), lalu `docker compose up --build` dan buka http://localhost:8010. Migrasi dan seed berjalan otomatis.

**Mode dev:** prasyarat Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22 + pnpm, dan PostgreSQL (database `spaceship` + `spaceship_test`, user pemilik dengan `CREATEROLE`).

```bash
cp backend/.env.example backend/.env      # isi URL database, OPENAI_API_KEY, ADMIN_/VISITOR_ email+password, SESSION_SECRET

# backend (port 8010)
cd backend && uv sync
uv run --env-file .env alembic upgrade head
uv run --env-file .env python -m app.modules.analytics.seed      # idempoten
uv run --env-file .env uvicorn app.main:app --port 8010 --reload

# frontend (port 5173, /api di-proxy ke 8010)
cd frontend && pnpm install && pnpm dev
```

Perubahan skema: ubah `models.py` modul terkait, lalu `uv run --env-file .env alembic revision --autogenerate -m "..."`, periksa file di `migrations/versions/`, lalu jalankan `alembic upgrade head`.

Tanpa `OPENAI_API_KEY`, seluruh dashboard tetap jalan. Hanya fitur AI yang membalas "AI is not configured".

| Env | Fungsi |
|---|---|
| `DATABASE_URL` | Postgres untuk app (pemilik skema, menjalankan migrasi) |
| `DATABASE_URL_READONLY` | Login `analytics_ro` untuk SQL dari LLM/widget |
| `ANALYTICS_RO_PASSWORD` | Password yang dipasang migrasi `0003` untuk `analytics_ro` |
| `TEST_DATABASE_URL`, `TEST_DATABASE_URL_READONLY` | Database khusus test (wajib saat `pytest`) |
| `OPENAI_API_KEY` | Kunci AI (OpenAI, atau OpenRouter bila `OPENAI_BASE_URL` diisi). Cadangan: **Backoffice > AI** bisa menimpa penyedia, key, dan model tanpa restart |
| `OPENAI_MODEL` | Default `gpt-6-luna` (model hemat untuk tool calling) |
| `OPENAI_MODEL_SUBAGENT` | Model lain untuk subagent (opsional; kosong = sama dengan `OPENAI_MODEL`) |
| `TYPESAFE_API_KEY` | Kunci Jev (TypeSafe) untuk routing. Kosong = tanpa routing, semua tool dimuat |
| `JEV_THRESHOLD`, `JEV_TIMEOUT_MS` | Batas keyakinan (default 0.6) dan batas waktu (default 1000 ms) sebelum routing diabaikan |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`, `VISITOR_EMAIL` / `VISITOR_PASSWORD` | Dua akun login, dibuat dengan `uv run --env-file .env python -m app.modules.auth.seed` (role `admin` dan `visitor`) |
| `SETTINGS_KEY` | Opsional. Kunci Fernet yang mengenkripsi API key AI yang disimpan lewat Backoffice (tanpa ini, key hanya bisa dari `OPENAI_API_KEY`). Buat: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Jangan diganti setelah key tersimpan, atau key itu harus diisi ulang |
| `SESSION_SECRET` | **Wajib**, acak minimal 32 karakter (tanpa nilai bawaan; aplikasi menolak start kalau kosong, pendek, atau masih `change-me…`). Kunci HMAC cookie sesi |
| `SESSION_HOURS` | Lama satu login berlaku (default 8 jam). Logout mencabut token sendiri, bukan hanya cookie |
| `SECURE_COOKIES` | `1` di belakang HTTPS (default di Docker image) |
| `LOGIN_IP_PER_MINUTE`, `LOGIN_MAX_FAILURES` | Batas login: percobaan per IP per menit (20) dan salah kata sandi per email sebelum dikunci 15 menit (5). Lewat batas = HTTP 429 + `Retry-After` |
| `AI_PER_MINUTE`, `AI_PER_HOUR`, `AI_CONCURRENT` | Jatah endpoint AI per pengguna (10/menit, 100/jam) dan jumlah permintaan yang boleh berjalan bersamaan (2) |
| `DASH_SAVES_PER_HOUR`, `DASH_OPENS_PER_MINUTE` | Simpan dashboard per jam (20) dan buka dashboard per menit (60) per pengguna |
| `SCRYPT_LOG_N` | Biaya hash kata sandi (default 15 = N 2^15, r 8, p 3; biayanya disimpan bersama hash, hash lama otomatis dinaikkan saat login) |
| `ENABLE_DOCS` | `1` menyalakan `/docs` dan `/openapi.json` (default mati) |
| `DATA_CSV` | Lokasi CSV untuk seed (opsional) |

## Test

```bash
cd backend && uv run --env-file .env pytest        # migrasi + seed ke TEST_DATABASE_URL otomatis
cd frontend && pnpm build && pnpm lint && pnpm test   # tsc + vite, oxlint (react, hooks, a11y), vitest
```

- `tests/analytics/` mengunci angka ke temuan dokumen desain (delay 13.8%, P90 6 hari, 26 macet, 37 bermasalah, top-5 klien 47.1%, MAPE 28% vs 34%, dll).
- `tests/db/` menguji guard SQL dari LLM terhadap vektor serangan Postgres.
- `tests/ai/` menguji penumpukan filter dan loop tool Copilot dengan model palsu (tanpa API key).
- `frontend/tests/` (vitest, terpisah dari kode) menguji logika langkah agent (`agentSteps`), renderer Markdown (termasuk link aman dan key unik), rumus yang digambar, dan batas lebar Copilot. `.oxlintrc.json` mengaktifkan aturan React, hooks, dan aksesibilitas untuk `pnpm lint`.
- `tests/dashboards/`, `tests/schedules/`, `tests/auth/` menguji Builder (widget berbahaya ditolak), dashboard tersimpan, jadwal, dan login.

## Deploy

```bash
docker compose up --build -d                  # Postgres + app, data di volume `pgdata`
# atau image saja, dengan Postgres terkelola:
docker build -t spaceship-dashboard .
docker run -p 8000:8000 -e DATABASE_URL=... -e DATABASE_URL_READONLY=... -e ANALYTICS_RO_PASSWORD=... \
  -e OPENAI_API_KEY=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e SESSION_SECRET=... spaceship-dashboard
```

Container menjalankan `alembic upgrade head` dan seed saat start. User `DATABASE_URL` perlu hak `CREATEROLE` sekali untuk migrasi `0003`.

## Batasan saat ini

- Datanya satu berkas CSV (400 order, Jan–Des 2025) yang dimuat sekali lewat seed; belum ada impor rutin dari sistem sumber. Target KPI dan SLA 7 hari masih usulan.
- Dua akun tetap (admin dan visitor) dari `.env`; belum ada pendaftaran, ganti kata sandi, atau 2FA. Baris yang disimpan (dashboard, preset) milik pembuatnya; visitor hanya mengubah dan menghapus miliknya, admin semuanya. Jadwal laporan hanya untuk admin.
- Jadwal laporan hanya disimpan; email belum dikirim (perlu cron + penyedia email).
- Prakiraan dari 12 bulan data tanpa musiman: baca sebagai kisaran. Metode paling banyak memilih rata-rata bergerak, karena deretnya hampir datar setelah lonjakan Januari. Prakiraan SKU hanyalah pangsa dari kategorinya. Tanpa data stok dan lead time pemasok, rekomendasi inventori adalah jumlah yang perlu tersedia, bukan kuantitas pesanan.
- Rate limit disimpan di memori proses (satu proses); kalau aplikasi jalan sebagai beberapa proses atau replika, pindahkan ke Redis. Di belakang reverse proxy, jalankan uvicorn dengan `--proxy-headers` agar batas per IP membaca alamat klien sebenarnya.
