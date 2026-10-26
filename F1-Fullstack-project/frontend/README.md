# ANALYZIZ Frontend — React 18 + Vite + TypeScript 🏎️

Frontend user interface and data visualization layer for **ANALYZIZ (`adnaizf1`)** — Formula 1 2026 Telemetry, Analytics & Live Pit-Wall.

For the comprehensive project documentation, architecture overview, security specifications, and full-stack setup guides, please refer to the primary root documentation:
👉 [**Root Portfolio README.md**](../../README.md)

---

## 💻 Tech Stack & Tooling

- **Core Framework:** React 18.3 + TypeScript 5.5 (Strict Mode)
- **Build Tool:** Vite 5.4 with HMR and multi-stage Nginx Alpine containerization
- **Styling:** Tailwind CSS 3.4 with custom F1 motorsport dark theme
- **Visualization:** Recharts & native SVG track coordinate calculations (`getPointAtLength`)
- **State & Caching:** TanStack React Query v5
- **Icons:** Lucide React
- **Testing:** Vitest + React Testing Library + jsdom
- **Linting & Quality:** ESLint with TypeScript rules, `tsc --noEmit`

---

## 🚀 Quick Start (Frontend Only)

### 1. Install Dependencies
```bash
npm ci --ignore-scripts
```

### 2. Configure Environment
Create a `.env` file in this directory (or use `.env.example`):
```env
VITE_API_URL=http://localhost:8000
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

```bash
npm run lint        # Run ESLint static analysis
npm run typecheck   # Validate TypeScript types (tsc --noEmit)
npm run test        # Run Vitest unit tests
npm run build       # Compile production distribution into dist/
```
