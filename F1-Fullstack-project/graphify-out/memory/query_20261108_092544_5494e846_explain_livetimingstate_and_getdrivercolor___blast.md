---
type: "explain"
date: "2026-11-08T09:25:44.067668+00:00"
question: "Explain LiveTimingState and getDriverColor() blast radius"
contributor: "graphify"
outcome: "useful"
source_nodes: ["LiveTimingState", "getDriverColor()"]
---

# Q: Explain LiveTimingState and getDriverColor() blast radius

## Answer

LiveTimingState (Backend/services/livetiming_service.py:L90, degree 46) accumulates incremental SignalR updates into snapshots via 29 internal methods, is imported by Backend/routers/livetiming.py:L64 to serve websocket_livetiming(), and is tested by 11 test cases/classes in Backend/tests/test_live_timing.py. getDriverColor() (frontend/src/data/teamData.ts:L188, degree 46) calls getTeamColor() (L200) and is imported/called across 19 frontend pages and components.

## Outcome

- Signal: useful

## Source Nodes

- LiveTimingState
- getDriverColor()