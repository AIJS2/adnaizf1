// src/config.ts
// ---------------------------------------------------------------------------
// Konfigurasi global aplikasi.
// Gunakan environment variable VITE_API_URL kalau ada. Di development,
// fallback-nya 127.0.0.1 — bukan "localhost" — karena Windows me-resolve
// "localhost" ke IPv6 ::1 lebih dulu, sementara uvicorn bind ke IPv4. Selisih
// itu membuat fetch pertama terasa seperti "Failed to fetch" (beberapa detik
// menunggu koneksi yang ditolak sebelum mencoba alamat IPv4).
// ---------------------------------------------------------------------------

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

function normalizeApiUrl(url: string): string {
	const trimmed = url.trim().replace(/\/+$/, '');
	// Only rewrite the loopback name; a real production domain is untouched.
	return trimmed.replace(
		/^(https?:\/\/)localhost(?=[:/]|$)/i,
		(_match, scheme: string) => `${scheme}127.0.0.1`,
	);
}

export const API_URL = normalizeApiUrl(
	rawApiUrl ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : ''),
);

/** WebSocket origin for the live-timing feed (empty API_URL = same origin). */
export function webSocketUrl(path: string): string {
	const base = API_URL || window.location.origin;
	const url = new URL(path, base);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
}
