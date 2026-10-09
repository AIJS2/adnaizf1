// src/config.js
// ─────────────────────────────────────────────────────────────
// Konfigurasi global aplikasi.
// Gunakan environment variable VITE_API_URL kalau ada,
// fallback ke localhost untuk development.
// ─────────────────────────────────────────────────────────────

export const API_URL = import.meta.env.VITE_API_URL ?? (
	import.meta.env.DEV ? 'http://127.0.0.1:8000' : ''
);
