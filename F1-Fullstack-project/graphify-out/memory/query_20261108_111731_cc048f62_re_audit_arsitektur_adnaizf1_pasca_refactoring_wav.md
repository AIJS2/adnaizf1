---
type: "query"
date: "2026-11-08T11:17:31.411833+00:00"
question: "Re-audit arsitektur adnaizf1 pasca refactoring Wave 1 (signalr_parsers, fastf1_safe, dan unit tests baru)"
contributor: "graphify"
source_nodes: ["LiveTimingState", "_compute_race_details()", "process_telemetry_compare()", "clean_nans()", "safe_getattr()"]
---

# Q: Re-audit arsitektur adnaizf1 pasca refactoring Wave 1 (signalr_parsers, fastf1_safe, dan unit tests baru)

## Answer

1. Graph naik dari 1,587 nodes / 3,868 edges / 83 communities menjadi 1,631 nodes / 4,000 edges / 93 communities. 2. Direct Core Module Test Coverage meningkat dari 27/52 (51.9%) menjadi 33/53 (62.3%) setelah penambahan test_services_unit.py, api.test.ts, dan RaceDetailPage.test.tsx. 3. Community LiveTiming terpecah menjadi Community 2 (Livetiming / Test Live Timing, 22 code nodes) dan Community 8 (Livetiming Service / Signalr Parsers, 12 code nodes, cohesion=0.11). 4. Temuan baru Wave 2: masih ada 1 duplikat clean_nans() di Backend/services/race_details_service.py, serta 3 God Nodes backend yang belum punya unit test langsung: telemetry_service.py (process_telemetry_compare deg=23), race_details_service.py (_compute_race_details deg=24), dan openf1_telemetry.py (collect deg=19).

## Source Nodes

- LiveTimingState
- _compute_race_details()
- process_telemetry_compare()
- clean_nans()
- safe_getattr()