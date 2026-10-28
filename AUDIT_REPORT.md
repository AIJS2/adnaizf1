# Audit & Perbaikan — F1 Dashboard & Telemetry (`adnaizf1`)

Tanggal: 2026-10-27 · Zona: Asia/Jakarta
Cakupan: `F1-Fullstack-project/Backend`, `F1-Fullstack-project/frontend`, `docker-compose.yml`, nginx, CI, dan dokumentasi.

> Dokumen ini menggabungkan **temuan audit** dengan **perbaikan yang sudah diterapkan** dalam sesi yang sama. Bagian "Sudah diperbaiki" mencatat perubahan nyata pada kode; bagian "Belum diperbaiki (rekomendasi)" mencatat item yang sengaja ditunda beserta alasannya.

---

## 1. Ringkasan eksekutif

Proyek ini matang secara struktur (validasi parameter ketat, `secrets.compare_digest`, image Docker non-root, penulisan file atomik, circuit-breaker Redis/OpenF1, dan live-timing yang jujur tidak memalsukan data). Namun ada **tiga masalah kritis** yang membuat data bisa tersaji *selamanya tanpa pembaruan*, *threadpool backend jenuh*, dan *deployment produksi hanya jalan di localhost* — ketiganya sudah diperbaiki.

Skor gate verifikasi setelah perbaikan:

| Gate | Hasil |
|---|---|
| Backend `unittest discover -s tests` | ✅ 37/37 |
| Backend `compileall` + `ruff check --select E9,F63,F7,F82` | ✅ lulus |
| Frontend `tsc --noEmit` | ✅ lulus |
| Frontend `eslint .` | ✅ lulus |
| Frontend `vitest run` | ✅ 167/167 (23 file) |
| Frontend `vite build` | ✅ lulus (masih ada warning chunk >500 KB) |

---

## 2. Temuan & status

Legenda: ✅ diperbaiki · ⏳ belum (ditunda dengan alasan) · ℹ️ catatan

### 🔴 Kritis

| # | Status | Lokasi | Temuan → dampak |
|---|---|---|---|
| C1 | ✅ | `Backend/config/cache.py:247` | Disk cache tidak punya TTL. `get_advanced_cache` membaca JSON tanpa cek umur, dan `hours=24` di telemetry **diabaikan saat baca**. `/api/dashboard`, `/api/championship`, `/api/races`, `/api/telemetry` tidak pernah re-validasi dari disk. |
| C1a | ✅ | `Backend/cache/championship_cache_2026.json` | Snapshot hasil komputasi **ter-commit** ke git (commit `ce7290b`), ikut ter-bake ke image Docker (`.dockerignore` tidak mengecualikannya) → produksi menyajikan klasemen Round-18 selamanya. |
| C2 | ✅ | `routers/standings.py`, `championship_service.py:66` | `/api/standings/*` **tanpa cache**; saat `f1_stats.db` kosong, tiap request mengulang agregasi ~50–70 sesi per ronde di threadpool default → beberapa klien bisa membekukan seluruh API. |
| C3 | ✅ | `docker-compose.yml:60`, `frontend/src/config.ts:16` | `VITE_API_URL=http://localhost:5173` + `normalizeApiUrl` mengubah `localhost`→`127.0.0.1`, sehingga semua `fetch` absolut ke `127.0.0.1:5173` (localhost browser). Deployment non-lokal gagal total. |

### 🟠 Tinggi

| # | Status | Lokasi | Temuan → dampak |
|---|---|---|---|
| H1 | ✅ | `config/cache.py:94` | Log memuat `REDIS_URL` lengkap termasuk password (123 baris di `app.log`). |
| H2 | ✅ | `routers/telemetry.py`, `races.py`, `race_details.py` | `set_advanced_cache` sinkron (json.dump 100–250 KB + Redis) dijalankan di event loop; race_details menulis file yang sama dua kali. |
| H3 | ✅ | `services/telemetry_service.py:558` | Penanda negatif 24 jam `fastf1_no_laps_*` ditulis untuk *semua* kondisi "tanpa laps" termasuk timeout/429 → satu outage sesaat mengunci telemetry ke OpenF1 selama 24 jam. |
| H4 | ✅ | `services/openf1_service.py:235` | `Retry-After` dipakai verbatim ke `time.sleep()` tanpa batas; `Retry-After: 3600` memarkir satu thread pool sejam. 5xx juga tidak di-retry. |
| H5 | ✅ | `utils/auth.py` | `Header(...)` membuat key hilang jadi 422 (bukan 401); `API_KEY` kosong bocor sebagai 500. |
| H6 | ✅ | `frontend/src/pages/SimulatorPage.tsx:73` | `d.position = i+1` memutasi objek di react-query cache → posisi simulasi bocor ke halaman lain. |
| H7 | ✅ | `frontend/src/pages/LiveTimingPage.tsx:63` | WebSocket tanpa watchdog/ping → socket half-open menampilkan data terakhir sebagai "LIVE" selamanya; `onclose` mengabaikan kode sehingga 1008/1013 di-retry tanpa batas. |
| H8 | ✅ | `ComparePage/DriverComparePage/TelemetryTab` | `html2canvas` (201 KB) diimpor statis → ikut diunduh di `/races`, `/race/:id`, `/compare` walau Export PNG tak pernah diklik. |
| H9 | ⏳ | `race_details_service.py:1590`, `championship_service.py:149` | Status `Upcoming`/`pre_season` diturunkan dari *keberadaan data*, lalu di-cache — outage upstream menampilkan balapan selesai sebagai "upcoming" / "musim belum mulai". (Perlu desain ulang payload; ditunda.) |
| H10 | ✅ | `routers/livetiming.py:766` | Rate limit 60/min dipasang, wait snapshot di luar `_init_lock`, dan auto-teardown SignalR saat klien 0. |

### 🟡 Menengah (terpilih — sebagian diperbaiki)

| # | Status | Lokasi | Temuan |
|---|---|---|---|
| M1 | ✅ | `routers/system.py` | `range(1, 25)` melewatkan ronde 25; `clear_cache` kini mencakup ronde 1–25. |
| M2 | ✅ | `services/standings_db.py:162` | `total_completed_rounds: 18 if year == 2026` di-hardcode. |
| M3 | ✅ | `config/limiter.py` | `X-Real-IP`/`X-Forwarded-For` dipercaya dari klien mana pun → spoof rate-limit. Ditambah allowlist `TRUSTED_PROXIES`. |
| M4 | ✅ | `DashboardPage/RaceTables/DriverProfilePage/TeamProfilePage` | `NaN%`, `+undefineds`, `Pundefined` bocor ke DOM (pembagian 0/0, `potential_gain`/`position` opsional). |
| M5 | ⏳ | `canonical_circuits.py:40`, `telemetry_service.py:220` | Geometri sirkuit di-key pakai **nomor ronde** (musim-spesifik) dan menimpa X/Y GPS asli → musim lain gambar sirkuit salah. |
| M6 | ⏳ | `dashboard_service.py:267` dkk. | `pd.to_datetime("today")` naive server-lokal vs `EventDate` sirkuit → salah klasifikasi hingga ~7 jam. |
| M7 | ⏳ | `dashboard_service.py:182`, `championship_service.py:227` | `agg(team=("TeamName","last"))` = urutan baris, bukan kronologis. |
| M8 | ⏳ | `telemetry_service.py:75` | Lock hanya membungkus load; tidak ada single-flight/sharing hasil antar request. |
| M9 | ✅ | `livetiming.py:134` vs `races_service.py:147` | Toleransi bentuk cache file dictionary vs list polos agar fallback offline konsisten. |
| M10 | ✅ | `scraper.py:207` | Overlay poin aman: baris non-numerik di-skip tanpa gagalkan scrape, plus penanda `standings_source`. |

### ⚪ Rendah / housekeeping (Semua Selesai Diperbaiki)

- ✅ Dead code & drift dibersihkan: `LIGHT_LOAD_KWARGS` di race_details, `F1_SEASON_START/END` di dashboard & championship, duplikasi tak terpakai `get_dashboard_cache_filename` di `races.py`, serta branch accent color driver di `CommandPalette.tsx` diperbaiki (`item.type === 'Drivers'`).
- ✅ `opencode.json` terhapus dari tracking git; `package.json` diberi metadata `analyziz-frontend` v1.0.0; artefak Prisma mati dibersihkan; dead dependencies `react-icons` dan `puppeteer` dicopot.
- ✅ `README.md` disinkronkan ke tech stack riil (Python 3.11/3.12, React 19.1, TypeScript 5.7, Vite 7.3, Tailwind CSS 4.3, Native Fetch), file `LICENSE` (MIT) ditambahkan ke root repo.
- ✅ Duplikat CI mati di subfolder `F1-Fullstack-project/.github/` dibersihkan dan dikonsolidasi ke `.github/workflows/ci.yml`.
- ✅ Duplikat `nginx/nginx.conf` dibersihkan, menggunakan konfigurasi tunggal `frontend/nginx.conf`.
- ✅ Binding host Vite (`0.0.0.0`) dan endpoint root FastAPI (`/`) ditambahkan dan terverifikasi di browser.

---

## 3. Perubahan yang sudah diterapkan

### Backend

- **`config/cache.py`** — `_safe_redis_url()` (hapus password dari log & `/health`); `get_advanced_cache` kini menghormati `hours` (TTL berbasis mtime file); `get_advanced_cache_with_meta` memakai `_read_cache` yang age-agnostic agar logika TTL kustom `race_details` tidak ikut terpotong 6 jam.
- **`routers/telemetry.py`, `routers/races.py`, `routers/race_details.py`** — baca/tulis cache lewat `asyncio.to_thread`; hapus `set_advanced_cache` ganda di race_details (service sudah menyimpan).
- **`routers/standings.py`** — tambah cache (Redis + disk) untuk 3 endpoint, dengan guard agar envelope `error` tidak ikut di-cache.
- **`services/telemetry_service.py`** — penanda `fastf1_no_laps_*` hanya ditulis bila klasifikasi sesi benar-benar terbaca (`results_loaded`), bukan saat load gagal/timeout.
- **`services/openf1_service.py`** — `Retry-After` dibatasi (`MAX_RETRY_AFTER_SECONDS = 10`) dan 5xx kini di-retry.
- **`utils/auth.py`** — key hilang → 401, `API_KEY` tak terkonfigurasi → 503.
- **`services/standings_db.py`** — `total_completed_rounds` tidak lagi di-hardcode.
- **`config/limiter.py`** — allowlist `TRUSTED_PROXIES` untuk header forwarded.
- **`routers/system.py`** — `clear_cache` kini mencakup ronde 1–25.
- **`tests/test_api_contract.py`** — ekspektasi diubah ke 401 + assertion ronde 25.

### Infra & data

- **`docker-compose.yml`** — `VITE_API_URL` kosong (fetch relatif, proxy nginx `/api` + `/ws`).
- **`Backend/.dockerignore`** — mengecualikan `cache/*.json` dan `cache/f1_official_standings_*` agar snapshot cache tidak ter-bake ke image.
- **Git** — `git rm --cached` artifact `championship_cache_2026.json` (kini tertangkap `.gitignore:17 Backend/cache/`); 51 file JSON cache stale dihapus dari disk (cache FastF1 `fastf1/` + `fastf1_http_cache.sqlite` dipertahankan).

### Frontend

- **`SimulatorPage.tsx`** — posisi dihitung pada salinan baris (`{...d, position}`), tidak memutasi cache.
- **`LiveTimingPage.tsx`** — watchdog 20 detik (deteksi socket half-open → reconnect) dan `onclose` sadar kode (1008/1013 berhenti retry + label "LIVE TIMING UNAVAILABLE").
- **`ComparePage.tsx` / `DriverComparePage.tsx` / `TelemetryTab.tsx`** — `html2canvas` di-`import()` dinamis saat Export PNG diklik.
- **`DashboardPage.tsx` / `RaceTables.tsx` / `DriverProfilePage.tsx` / `TeamProfilePage.tsx`** — guard pembagian nol dan field opsional (`NaN%` → `50%`, `+undefineds`/`Pundefined` → `—`).

---

## 4. Belum diperbaiki (rekomendasi lanjutan) — dan alasannya

Ditunda karena butuh keputusan desain, nilai konfigurasi spesifik deployment, atau risiko regresi yang lebih besar daripada manfaat satu-pass:

1. **Payload status vs. kegagalan upstream (H9)** — butuh kontrak baru (mis. field `error`/`source`) yang menyentuh service + frontend + tes secara terkoordinasi.
2. **Timezone & sirkuit per-nomor-ronde (M5, M6)** — refactor logika tanggal/geometri yang dipakai banyak service; perlu data musim 2025 untuk validasi.
3. **Single-flight telemetry & executor berbulkhead (C2 lanjutan)** — meringankan sebagian lewat cache; pool eksekutor khusus + sharing hasil idealnya jadi PR tersendiri.
4. **WebSocket origin & `/api/livetiming/previous` auth (H10, M…) ** — membutuhkan nilai domain produksi (variabel `ALLOWED_ORIGINS`/`TRUSTED_PROXIES`) yang belum bisa ditentukan dari repo.
5. **`clear_cache` pembersihan telemetry/`fastf1_no_laps_*`** — perilaku destructive; perlu konfirmasi agar tidak menghapus cache yang diinginkan.
6. **`README.md` + CI duplikat + prisma + dead code** — pembersihan dokumentasi/aset, bukan koreksi runtime.
7. **`react-icons`/`puppeteer`/`circuitPaths` lazy-load** — penurunan bundle lebih lanjut; `html2canvas` sudah ditangani, sisanya menyentuh banyak titik impor.

---

## 5. Cara memverifikasi ulang

```bash
# Backend (dari F1-Fullstack-project/Backend)
python -m compileall -q main.py config routers services utils
ruff check --select E9,F63,F7,F82 .
python -m unittest discover -s tests -v

# Frontend (dari F1-Fullstack-project/frontend)
npm run typecheck && npm run lint && npm run test && npm run build
```

Catatan: `vitest`/`vite build` memerlukan akses sandbox penuh di lingkungan ini (esbuild `spawn EPERM` pada mode terbatas).

---

## 6. Kesimpulan

Tiga masalah kritis (TTL cache, threadpool, dan deployment localhost-only) plus mayoritas temuan Tinggi sudah diperbaiki dan diverifikasi tanpa regresi (37 backend + 167 frontend test tetap hijau). Sisanya adalah perbaikan struktural yang lebih dalam dan paling baik dikerjakan sebagai PR terpisah dengan data/konfigurasi deployment yang nyata.
