# Graph Report - F1-Fullstack-project  (2026-11-08)

## Corpus Check
- 269 files · ~299,305 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .example 2, .conf 1)

## Summary
- 1657 nodes · 4150 edges · 94 communities (76 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 142 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- F1 / Racetables
- Bingo / Bingopage
- Fastf1 Safe / Dashboard Service
- Openf1 Telemetry / Spline Smooth
- Api / Driverprofilepage
- Abu Dhabi / Australia
- Main / Driverstandingslist
- Cache / Dashboard
- Openf1 Service
- Signalr Parsers / Test Services Unit
- Telemetry Service / Test Telemetry And Det
- Package
- Comparepage / Simulatorpage.Test
- Statspage / Statspage.Test
- Raceminicomponents / Teamdata
- Openf1 Lap Fallback / Test Telemetry And D
- Data / Gapchart
- Livetiming Service
- Profiles Service / Championship Service
- Track3D / Cornerdetails
- Telemetrytab / Telemetrychart
- Main / Tests Chaos Probe
- Scraper / Test Live Timing
- Sidebar / Layout
- Circuitpaths / Ghostracedata
- Driverradarchart / Commandpalette
- Team Radio / Openf1 Service
- Standings / Standings Db
- Race Details Service / Test Telemetry And 
- Cornerlayout / Circuitcornermarkers
- Tsconfig
- Profiles / Championship
- Teamradiosection / Teamradiosection.Test
- Test Live Timing / Openf1 Service
- Circuitcornermarkers.Test / Circuitcorners
- Landingpage / Countdowntimer
- Livetimingpage / Livetimingpage.Test
- Overlaylivepage / Overlaylivepage.Test
- Livetiming
- Package
- Racespage / Trackdata
- Nextrace / Nextrace.Test
- Generate Circuit Corners / Warm Cache
- Cache / System
- Circuit Map Service / Test Live Timing
- Test Live Timing / Livetiming Service
- Telemetrytab.Test / Package
- Livecircuitmap.Test / Livecircuitmap
- Test Security
- Warm Cache
- Test Api Contract
- Trackmap / Countryflag
- Requirements / Limiter
- Observability / Test Telemetry And Details
- Livetiming
- Seed Standings
- Docker Compose
- Docker Compose
- Docker Compose
- Manifest
- Livetiming / Test Live Timing
- Race Details / Race Details Service
- Docker Compose
- Package / Eslint.Config
- Landingpage.Test
- Racespage.Test
- Test Live Timing / Livetiming Service
- Signalr Parsers / Livetiming Service
- Test Coalescing
- Errorboundary
- Tsconfig.Node
- Livetiming
- Test Cache Headers
- Docker Compose
- Package
- Uselivetimingfeed / Config
- App / React
- Test Live Timing / Livetiming
- Package / Vite.Config
- Trackdominationmap.Test / F1
- Livetimingpage.Test
- Overlaylivepage.Test
- Livetimingcopy / Livecircuitandcopy.Test
- Herocountdown
- Trackdata / Trackdata.Test
- Livetiming
- Openf1 Service / Race Details Service
- Docker Compose
- Openf1 Service
- Openf1 Service
- Package

## God Nodes (most connected - your core abstractions)
1. `react` - 58 edges
2. `getDriverColor()` - 48 edges
3. `LiveTimingState` - 46 edges
4. `lucide-react` - 46 edges
5. `react-router-dom` - 42 edges
6. `vitest` - 42 edges
7. `@testing-library/react` - 31 edges
8. `@tanstack/react-query` - 29 edges
9. `_compute_race_details()` - 26 edges
10. `process_telemetry_compare()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Wave 1 Re-Audit Architectural Report` --references--> `clean_nans()`  [EXTRACTED]
  graphify-out/memory/query_20261108_111731_cc048f62_re_audit_arsitektur_adnaizf1_pasca_refactoring_wav.md → Backend/services/fastf1_safe.py
- `_fetch()` --indirect_call--> `compute_fastf1_championship()`  [INFERRED]
  Backend/warm_cache.py → Backend/services/championship_service.py
- `Analyziz SPA Entry HTML & Dev Error Overlay` --references_asset--> `Vite Favicon Asset (vite.svg)`  [INFERRED]
  frontend/index.html → frontend/public/vite.svg
- `get_championship_standings()` --indirect_call--> `_read_cache()`  [INFERRED]
  Backend/routers/championship.py → Backend/config/cache.py
- `get_championship_standings()` --indirect_call--> `get_advanced_cache()`  [INFERRED]
  Backend/routers/championship.py → Backend/config/cache.py

## Import Cycles
- None detected.

## Communities (94 total, 18 thin omitted)

### Community 0 - "F1 / Racetables"
Cohesion: 0.07
Nodes (48): DriverCell(), GridTable(), isPendingClassification(), PendingAwareCells(), PendingResultsBadge(), PositionCell(), PracticeResultTable(), QualifyingResultTable() (+40 more)

### Community 1 - "Bingo / Bingopage"
Cohesion: 0.07
Nodes (46): BingoCircuitBadge(), BingoCircuitBadgeProps, BINGO_CELLS, BINGO_EVENTS, BINGO_FREE_CELL, BINGO_FREE_INDEX, BINGO_SIZE, BingoEvent (+38 more)

### Community 2 - "Fastf1 Safe / Dashboard Service"
Cohesion: 0.09
Nodes (19): _compute_races(), _collect_results(), _empty_championship_season(), _build_driver_standings(), _build_race_analytics(), compute_fastf1_dashboard(), _empty_dashboard_season(), _find_next_session() (+11 more)

### Community 3 - "Openf1 Telemetry / Spline Smooth"
Cohesion: 0.08
Nodes (17): get_canonical_circuit(), interpolate_canonical_coords(), _circuit_for_round(), collect(), _compound_for(), driver_options(), _format_lap_time(), _frame_from_rows() (+9 more)

### Community 4 - "Api / Driverprofilepage"
Cohesion: 0.09
Nodes (40): IncidentBreakdownModal(), IncidentBreakdownModalProps, incidents, renderModal(), DriverProfilePage, TeamProfilePage, DriverProfilePage(), h2hTotal() (+32 more)

### Community 5 - "Abu Dhabi / Australia"
Cohesion: 0.04
Nodes (24): F1 Circuit Layout Asset (Abu-Dhabi), F1 Circuit Layout Asset (Australia), F1 Circuit Layout Asset (Austria), F1 Circuit Layout Asset (Azerbaijan), F1 Circuit Layout Asset (Bahrain), F1 Circuit Layout Asset (Belgium), F1 Circuit Layout Asset (Brazil), F1 Circuit Layout Asset (Canada) (+16 more)

### Community 6 - "Main / Driverstandingslist"
Cohesion: 0.09
Nodes (35): Vite Favicon Asset (vite.svg), Analyziz SPA Entry HTML & Dev Error Overlay, DriverStanding, DriverStandingsList(), DriverStandingsListProps, RaceAnalyticsCard(), RaceAnalyticsCardProps, TeamCard() (+27 more)

### Community 7 - "Cache / Dashboard"
Cohesion: 0.10
Nodes (19): _background_refresh(), _build_client(), fetch_with_coalescing(), get_advanced_cache(), get_advanced_cache_swr(), get_advanced_cache_with_meta(), _get_cache_lock(), _get_file_cache_path() (+11 more)

### Community 8 - "Openf1 Service"
Cohesion: 0.10
Nodes (18): _classify_position(), fetch_classification(), _format_gap(), _get(), get_car_data(), get_drivers(), get_laps(), get_latest_session() (+10 more)

### Community 9 - "Signalr Parsers / Test Services Unit"
Cohesion: 0.12
Nodes (10): build_radio_entries(), classify_rc_msg(), deep_merge(), extract_driver_sectors(), extract_driver_stints(), format_weather(), parse_compound(), parse_gap_seconds() (+2 more)

### Community 10 - "Telemetry Service / Test Telemetry And Det"
Cohesion: 0.10
Nodes (17): _assemble_payload(), _attach_position_data(), _build_empty_payload(), _clear_fastf1_gap(), _extract_lap_telemetry(), _fastf1_gap_path(), _get_session_lock(), _ingest_openf1_frames() (+9 more)

### Community 11 - "Package"
Cohesion: 0.08
Nodes (33): devDependencies, baseline-browser-mapping@^2.9.17, @eslint/js@^9.36.0, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.22, jsdom@^29.1.1, postcss@^8.5.6, tailwindcss@^4.3.3 (+25 more)

### Community 12 - "Comparepage / Simulatorpage.Test"
Cohesion: 0.08
Nodes (27): MOCK_STANDINGS, renderComparePage(), API_ERROR, PRE_SEASON, renderDashboard(), ComparativeMetricBar(), ComparativeMetricBarProps, CompareDriver (+19 more)

### Community 13 - "Statspage / Statspage.Test"
Cohesion: 0.12
Nodes (30): ChampionshipLine, ChampionshipPoint, ChampionshipWorm(), ChampionshipWormProps, SpeedSectorsTable(), WeatherChart(), CommandPalette(), getDriverColor() (+22 more)

### Community 14 - "Raceminicomponents / Teamdata"
Cohesion: 0.06
Nodes (17): F1 Constructor Logo SVG (alpine), F1 Constructor Logo SVG (aston-martin), F1 Constructor Logo SVG (audif1), F1 Constructor Logo SVG (cadillac), F1 Constructor Logo SVG (ferrari), F1 Constructor Logo SVG (haas), F1 Constructor Logo SVG (mclaren), F1 Constructor Logo SVG (mercedes-star) (+9 more)

### Community 15 - "Openf1 Lap Fallback / Test Telemetry And D"
Cohesion: 0.19
Nodes (16): _as_float(), _as_int(), build_fastest_lap_rows(), build_race_blocks(), _build_roster(), build_starting_grid(), _fastest_lap(), _fmt_lap_time() (+8 more)

### Community 16 - "Data / Gapchart"
Cohesion: 0.18
Nodes (21): DriverMeta, GapChartComponent(), GapChartProps, DriverMeta, LapChartComponent(), LapChartProps, DriverMeta, LapTimesChartComponent() (+13 more)

### Community 18 - "Profiles Service / Championship Service"
Cohesion: 0.17
Nodes (14): is_dnf_classified(), is_dns_status(), clean_nans(), _grid_position(), _incident_detail(), _normalize_slug(), process_driver_profile(), _teammate_position() (+6 more)

### Community 19 - "Track3D / Cornerdetails"
Cohesion: 0.18
Nodes (21): CircuitCornerMarkers(), CircuitVectorView(), CircuitVectorViewProps, CornerDetailCard(), CornerDetailCardProps, SPEED_STYLES, TONE_GLOW, Track3D() (+13 more)

### Community 20 - "Telemetrytab / Telemetrychart"
Cohesion: 0.16
Nodes (19): SpeedChart(), SpeedChartProps, CustomTooltip(), CustomTooltipProps, TelemetryChart(), TelemetryChartProps, ThrottleChart(), ThrottleChartProps (+11 more)

### Community 21 - "Main / Tests Chaos Probe"
Cohesion: 0.10
Nodes (8): Workspace Operating Policy (AGENTS.md), add_cache_control_headers(), add_security_headers(), health(), _http_exception_handler(), root(), _unhandled_exception_handler(), probe()

### Community 22 - "Scraper / Test Live Timing"
Cohesion: 0.15
Nodes (5): apply_f1_official_standings(), _fallback_candidates(), _load_fallback(), strip_driver_abbreviation(), _write_fallback()

### Community 23 - "Sidebar / Layout"
Cohesion: 0.13
Nodes (20): F1AmbientBackground(), Layout(), PageFallback(), pageVariants, reducedPageVariants, TopRacingLine(), MobileHeader(), MobileHeaderProps (+12 more)

### Community 24 - "Circuitpaths / Ghostracedata"
Cohesion: 0.15
Nodes (17): Circuit Curvature Window Probe Output, Ghost Race Braking Probe (Autodromo Hermanos Rodriguez), Realistic Telemetry Lap Synthesis Output (5300m), CANONICAL_CIRCUITS, CircuitGeometry, CircuitPoint, CIRCUIT_SPECS, CircuitSpec (+9 more)

### Community 25 - "Driverradarchart / Commandpalette"
Cohesion: 0.12
Nodes (18): html2canvas@^1.4.1, DriverRadarChart(), DriverRadarChartProps, RadarChartPoint, RadarDriverProfile, RadarTeammate, CATEGORIES, CommandPaletteProps (+10 more)

### Community 26 - "Team Radio / Openf1 Service"
Cohesion: 0.16
Nodes (10): _cached_radio_response(), _empty_response(), _fetch_openf1(), get_team_radio(), _is_paywall(), _latest_session_has_ended(), _resolve_previous_session(), _unavailable_response() (+2 more)

### Community 27 - "Standings / Standings Db"
Cohesion: 0.19
Nodes (10): _compute_championship(), _cacheable(), get_all_standings(), get_constructor_standings(), get_driver_standings(), compute_fastf1_championship(), get_championship_from_db(), get_constructor_standings_from_db() (+2 more)

### Community 28 - "Race Details Service / Test Telemetry And "
Cohesion: 0.14
Nodes (10): _classified_status_label(), _compute_race_details(), format_lap_time(), process_practice_session(), results_are_finalised(), _empty_race_payload(), _extract_race_metadata(), _get_fallback_upcoming_race() (+2 more)

### Community 29 - "Cornerlayout / Circuitcornermarkers"
Cohesion: 0.14
Nodes (17): CircuitCornerMarkersProps, FALLBACK_VIEWBOX, PALETTES, parseViewBox(), ViewBox, CircuitCorner, CandidateSlot, computeCornerLayout() (+9 more)

### Community 30 - "Tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+11 more)

### Community 31 - "Profiles / Championship"
Cohesion: 0.22
Nodes (8): get_championship_cache_filename(), get_championship_standings(), get_driver_profile(), get_team_profile(), _season_has_no_standings(), get_telemetry_compare(), get_telemetry_drivers(), get()

### Community 32 - "Teamradiosection / Teamradiosection.Test"
Cohesion: 0.16
Nodes (16): AudioPlayer(), driverNames, driverRadioData, DriverRadioInfo, EmptyState(), formatAudioTime(), InlineErrorState(), RadioList() (+8 more)

### Community 33 - "Test Live Timing / Openf1 Service"
Cohesion: 0.15
Nodes (5): clear_radio_cache(), clear_paywall(), paywall_active(), paywall_detail(), OpenF1PaywallTests

### Community 34 - "Circuitcornermarkers.Test / Circuitcorners"
Cohesion: 0.17
Nodes (12): vitest@^5.0.3, descriptorPoint, descriptorTotal, installPathMock(), monacoCorners, squarePoint(), CIRCUIT_CORNERS, CircuitCornerSet (+4 more)

### Community 35 - "Landingpage / Countdowntimer"
Cohesion: 0.17
Nodes (11): CountdownTimer(), CountdownTimerProps, TimeLeft, UNIT_LABEL, renderLanding(), LandingPage(), NextRacePanel(), StartLights() (+3 more)

### Community 36 - "Livetimingpage / Livetimingpage.Test"
Cohesion: 0.21
Nodes (12): TyreStrategy(), TyreStrategyProps, futureDate, MOCK_DASHBOARD, renderLiveTiming(), LiveTimingPage(), SectorTime(), TimingRow (+4 more)

### Community 37 - "Overlaylivepage / Overlaylivepage.Test"
Cohesion: 0.22
Nodes (13): futureDate, MOCK_DASHBOARD, renderOverlay(), DriverRow(), OverlayLivePage(), sortLines(), trackStatusLabel(), trackStatusTone() (+5 more)

### Community 38 - "Livetiming"
Cohesion: 0.18
Nodes (5): _consume_signalr(), _handle_signalr_record(), _negotiate_headers(), _note_signalr_failure(), _start_signalr()

### Community 39 - "Package"
Cohesion: 0.13
Nodes (15): dependencies, @fontsource/titillium-web@5.3.0, framer-motion@^12.43.0, lucide-react@^0.544.0, react@^19.1.1, react-dom@^19.1.1, react-intersection-observer@^9.16.0, react-router-dom@^7.18.4 (+7 more)

### Community 40 - "Racespage / Trackdata"
Cohesion: 0.25
Nodes (14): getTrackMap(), calcCountdownTime(), CURRENT_YEAR, FilterTabs(), LoadingSkeleton(), MiniCountdown(), MONTH_NAMES, MonthDivider() (+6 more)

### Community 41 - "Nextrace / Nextrace.Test"
Cohesion: 0.25
Nodes (13): dayKey(), isFinished(), isOngoing(), NextRaceCandidate, RacePhase, ResolvedNextRace, resolveNextRace(), resolveNextRaceFromSources() (+5 more)

### Community 42 - "Generate Circuit Corners / Warm Cache"
Cohesion: 0.24
Nodes (7): build_entry(), fetch_circuit(), main(), path_length(), render(), _request_json(), build_parser()

### Community 43 - "Cache / System"
Cohesion: 0.22
Nodes (6): clear_advanced_cache(), clear_cache_by_prefix(), clear_cache(), get_championship_cache_filename(), get_dashboard_cache_filename(), require_api_key()

### Community 44 - "Circuit Map Service / Test Live Timing"
Cohesion: 0.23
Nodes (5): _candidates(), _load(), _normalize(), resolve_circuit(), CircuitMapTests

### Community 46 - "Telemetrytab.Test / Package"
Cohesion: 0.14
Nodes (9): @testing-library/jest-dom@^7.0.1, @testing-library/react@^16.3.3, DNS_UNAVAILABLE, DRIVERS_WITH_STATUS, FULL_PAYLOAD, NO_DRIVERS_SELECTED, UNAVAILABLE_ONLY, @testing-library/jest-dom (+1 more)

### Community 47 - "Livecircuitmap.Test / Livecircuitmap"
Cohesion: 0.20
Nodes (10): LiveCircuitMap, LiveCircuitMapProps, padViewBox(), TrackMapPoint, circuit, descriptorPoint, descriptorTotal, installPathMock() (+2 more)

### Community 49 - "Warm Cache"
Cohesion: 0.22
Nodes (6): _fetch_races(), _fetch(), _fetch_standings(), _fetch(), main(), _warm_top_telemetry()

### Community 51 - "Trackmap / Countryflag"
Cohesion: 0.24
Nodes (9): CircuitVectorMode, CountryFlag(), CountryFlagProps, FLAGS, calculateAverageSpeed(), TrackMap(), TrackMapMode, TrackMapProps (+1 more)

### Community 52 - "Requirements / Limiter"
Cohesion: 0.18
Nodes (6): get_real_client_ip(), Backend Python Dependencies (requirements.txt), FastAPI + Uvicorn + Starlette Web Stack, FastF1 3.7.0 Telemetry & SignalR Stack, Redis + Requests-Cache + SlowAPI Rate Limiting, Sentry SDK & OpenTelemetry Observability

### Community 54 - "Livetiming"
Cohesion: 0.24
Nodes (6): _cancel_signalr_stop(), _get_allowed_ws_origins(), _is_allowed_ws_origin(), _schedule_signalr_stop(), _stop_signalr(), websocket_livetiming()

### Community 55 - "Seed Standings"
Cohesion: 0.29
Nodes (4): get_db_path(), init_schema(), main(), seed_data()

### Community 56 - "Docker Compose"
Cohesion: 0.20
Nodes (9): args, container_name, depends_on, ports, restart, volumes, services, frontend (+1 more)

### Community 57 - "Docker Compose"
Cohesion: 0.20
Nodes (10): container_name, depends_on, env_file, environment, expose, restart, volumes, redis (+2 more)

### Community 58 - "Docker Compose"
Cohesion: 0.20
Nodes (10): interval, retries, test, timeout, container_name, healthcheck, image, restart (+2 more)

### Community 59 - "Manifest"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 60 - "Livetiming / Test Live Timing"
Cohesion: 0.22
Nodes (4): _broadcast_loop(), _check_live_session(), _live_payload(), ScheduleGateTests

### Community 61 - "Race Details / Race Details Service"
Cohesion: 0.39
Nodes (3): get_race_details(), _run_background_revalidation(), compute_fastf1_race_details()

### Community 63 - "Docker Compose"
Cohesion: 0.22
Nodes (9): name, name, name, name, volumes, backend_cache, backend_logs, nginx_cache (+1 more)

### Community 64 - "Package / Eslint.Config"
Cohesion: 0.22
Nodes (8): eslint@^9.36.0, eslint-plugin-react@^7.37.5, globals@^16.4.0, typescript-eslint@^8.71.1, eslint, eslint-plugin-react, globals, typescript-eslint

### Community 65 - "Landingpage.Test"
Cohesion: 0.22
Nodes (7): endOfToday, NEXT_WEEKEND, now, startOfToday, TODAY, TODAY_BEFORE_START, TODAY_STARTED

### Community 66 - "Racespage.Test"
Cohesion: 0.22
Nodes (6): IN_THREE_WEEKS, LAST_WEEK, NEXT_WEEKEND, now, RACE_DAY_CALENDAR, TODAY

### Community 70 - "Errorboundary"
Cohesion: 0.25
Nodes (3): ErrorBoundaryProps, ErrorBoundaryState, GlobalErrorBoundary

### Community 71 - "Tsconfig.Node"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 74 - "Docker Compose"
Cohesion: 0.38
Nodes (7): logging, logging, driver, options, max-file, max-size, logging

### Community 75 - "Package"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, typecheck

### Community 76 - "Uselivetimingfeed / Config"
Cohesion: 0.38
Nodes (6): webSocketUrl(), EMPTY_DATA, LiveTimingConnectionStatus, LiveTimingFeed, useLiveTimingFeed(), LiveTimingData

### Community 77 - "App / React"
Cohesion: 0.40
Nodes (4): Frontend SVG Asset (react.svg), ANALYZIZ Frontend Documentation (README.md), App(), App

### Community 78 - "Test Live Timing / Livetiming"
Cohesion: 0.40
Nodes (3): _empty_snapshot(), LiveTimingStatusTests, one_shot_broadcast()

### Community 79 - "Package / Vite.Config"
Cohesion: 0.33
Nodes (4): vite@^7.1.7, @vitejs/plugin-react@^5.0.4, vite, @vitejs/plugin-react

### Community 80 - "Trackdominationmap.Test / F1"
Cohesion: 0.40
Nodes (4): driverInfo, TrackDominationMapProps, TeamDriverInfo, TelemetryDataPoint

### Community 83 - "Livetimingcopy / Livecircuitandcopy.Test"
Cohesion: 0.53
Nodes (4): LIVE_TIMING_UNAVAILABLE_MESSAGE, LIVE_TIMING_UNAVAILABLE_TITLE, REAL_DATA_ONLY_NOTE, verifyTeamColorLookup()

### Community 84 - "Herocountdown"
Cohesion: 0.50
Nodes (4): computeTimeLeft(), HeroCountdown(), HeroCountdownProps, TimeLeft

### Community 85 - "Trackdata / Trackdata.Test"
Cohesion: 0.40
Nodes (3): countryCodes, TrackMapLookup, trackMaps

### Community 87 - "Openf1 Service / Race Details Service"
Cohesion: 0.50
Nodes (3): session_key_for(), openf1_rows_for(), openf1_session_key()

### Community 88 - "Docker Compose"
Cohesion: 0.67
Nodes (4): build, context, dockerfile, build

### Community 91 - "Package"
Cohesion: 0.67
Nodes (3): overrides, source-map-js, svgo

## Knowledge Gaps
- **43 isolated node(s):** `Workspace Operating Policy (AGENTS.md)`, `Circuit Curvature Window Probe Output`, `Ghost Race Braking Probe (Autodromo Hermanos Rodriguez)`, `Realistic Telemetry Lap Synthesis Output (5300m)`, `Wave 1 Re-Audit Architectural Report` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 664 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Main / Driverstandingslist` to `F1 / Racetables`, `Bingo / Bingopage`, `Api / Driverprofilepage`, `Package`, `Comparepage / Simulatorpage.Test`, `Statspage / Statspage.Test`, `Raceminicomponents / Teamdata`, `Data / Gapchart`, `Track3D / Cornerdetails`, `Telemetrytab / Telemetrychart`, `Sidebar / Layout`, `Circuitpaths / Ghostracedata`, `Driverradarchart / Commandpalette`, `Cornerlayout / Circuitcornermarkers`, `Teamradiosection / Teamradiosection.Test`, `Landingpage / Countdowntimer`, `Livetimingpage / Livetimingpage.Test`, `Overlaylivepage / Overlaylivepage.Test`, `Package`, `Racespage / Trackdata`, `Telemetrytab.Test / Package`, `Livecircuitmap.Test / Livecircuitmap`, `Trackmap / Countryflag`, `Errorboundary`, `Uselivetimingfeed / Config`, `Herocountdown`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `LiveTimingState` (e.g. with `FinishedSessionTests` and `LiveTimingStateTests`) actually correct?**
  _`LiveTimingState` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Workspace Operating Policy (AGENTS.md)`, `Circuit Curvature Window Probe Output`, `Ghost Race Braking Probe (Autodromo Hermanos Rodriguez)` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `F1 / Racetables` be split into smaller, more focused modules?**
  _Cohesion score 0.06821787414066631 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Circuitcornermarkers.Test / Circuitcorners` to `F1 / Racetables`, `Bingo / Bingopage`, `Api / Driverprofilepage`, `Main / Driverstandingslist`, `Package`, `Comparepage / Simulatorpage.Test`, `Statspage / Statspage.Test`, `Data / Gapchart`, `Track3D / Cornerdetails`, `Telemetrytab / Telemetrychart`, `Sidebar / Layout`, `Circuitpaths / Ghostracedata`, `Teamradiosection / Teamradiosection.Test`, `Landingpage / Countdowntimer`, `Livetimingpage / Livetimingpage.Test`, `Overlaylivepage / Overlaylivepage.Test`, `Nextrace / Nextrace.Test`, `Telemetrytab.Test / Package`, `Livecircuitmap.Test / Livecircuitmap`, `Trackmap / Countryflag`, `Landingpage.Test`, `Racespage.Test`, `Trackdominationmap.Test / F1`, `Livetimingcopy / Livecircuitandcopy.Test`, `Trackdata / Trackdata.Test`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Bingo / Bingopage` be split into smaller, more focused modules?**
  _Cohesion score 0.07441016333938294 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Comparepage / Simulatorpage.Test` to `F1 / Racetables`, `Landingpage.Test`, `Bingo / Bingopage`, `Landingpage / Countdowntimer`, `Api / Driverprofilepage`, `Livetimingpage / Livetimingpage.Test`, `Main / Driverstandingslist`, `Package`, `Overlaylivepage / Overlaylivepage.Test`, `Racespage / Trackdata`, `Racespage.Test`, `Package`, `App / React`, `Raceminicomponents / Teamdata`, `Statspage / Statspage.Test`, `Sidebar / Layout`, `Driverradarchart / Commandpalette`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._