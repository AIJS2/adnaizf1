import { useEffect, useState } from 'react';
import { webSocketUrl } from '../config';
import type { LiveTimingData } from '../types/f1';

export type LiveTimingConnectionStatus = 'connecting' | 'connected' | 'lost';

export interface LiveTimingFeed {
  data: LiveTimingData;
  connectionStatus: LiveTimingConnectionStatus;
  /** True when the server rejected the connection for a non-transient reason. */
  gaveUp: boolean;
}

const EMPTY_DATA: LiveTimingData = {
  lines: [],
  trackStatus: 'GREEN',
  weather: { air: '--', track: '--', humidity: '--', rain: '--' },
  messages: [],
  radio: [],
  status: 'no_session',
  isLiveSession: false,
  session_state: 'no_session',
  session_title: '',
  circuit: null,
  lap: null,
  total_laps: null,
  last_session: null,
};

/**
 * Owns the `/ws/livetiming` connection for both the Pit Wall page and the
 * stream overlay.  Keeping the batching + watchdog logic here means the two
 * surfaces cannot drift apart, and the overlay can be mounted on its own
 * without pulling in the whole dashboard.
 */
export function useLiveTimingFeed(): LiveTimingFeed {
  const [data, setData] = useState<LiveTimingData>(EMPTY_DATA);
  const [connectionStatus, setConnectionStatus] =
    useState<LiveTimingConnectionStatus>('connecting');
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;
    let lastMessageAt = Date.now();

    // A half-open socket (sleep, Wi-Fi switch, proxy idle timeout) emits no
    // close event, so without a watchdog the page would keep showing the last
    // snapshot as "LIVE" indefinitely. If no frame arrives in this window we
    // force a close so the reconnect backoff runs.
    const STALL_TIMEOUT_MS = 20000;

    const connect = () => {
      if (disposed) return;
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }

      setConnectionStatus((prev) => (prev === 'connected' ? 'lost' : 'connecting'));
      const wsUrl = webSocketUrl('/ws/livetiming');

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        attempt = 0;
        lastMessageAt = Date.now();
        setConnectionStatus('connected');
      };

      let lastRenderTime = 0;
      let pendingBatch: Record<string, unknown> | null = null;

      const applyDataUpdate = (msg: Record<string, unknown>) => {
        setData((prev) => ({
          lines: (msg.lines as typeof prev.lines) ?? prev.lines,
          trackStatus: (msg.trackStatus as typeof prev.trackStatus) ?? prev.trackStatus,
          weather: (msg.weather as typeof prev.weather) ?? prev.weather,
          messages: (msg.messages as typeof prev.messages) ?? prev.messages,
          radio: (msg.radio as typeof prev.radio) ?? prev.radio,
          status: (msg.status as typeof prev.status) ?? prev.status,
          reason: (msg.reason as typeof prev.reason) ?? prev.reason,
          isLiveSession: (msg.is_live_session as typeof prev.isLiveSession) ?? prev.isLiveSession,
          session_state:
            'session_state' in msg
              ? (msg.session_state as typeof prev.session_state)
              : prev.session_state,
          session_title:
            'session_title' in msg
              ? (msg.session_title as typeof prev.session_title)
              : prev.session_title,
          session_status:
            'session_status' in msg
              ? (msg.session_status as typeof prev.session_status)
              : prev.session_status,
          archive_status:
            'archive_status' in msg
              ? (msg.archive_status as typeof prev.archive_status)
              : prev.archive_status,
          circuit: 'circuit' in msg ? (msg.circuit as typeof prev.circuit) : prev.circuit,
          lap: 'lap' in msg ? (msg.lap as typeof prev.lap) : prev.lap,
          total_laps:
            'total_laps' in msg ? (msg.total_laps as typeof prev.total_laps) : prev.total_laps,
          last_session:
            'last_session' in msg ? (msg.last_session as typeof prev.last_session) : prev.last_session,
        }));
        lastRenderTime = Date.now();
      };

      ws.onmessage = (event: MessageEvent) => {
        lastMessageAt = Date.now();
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.type === 'TimingData') {
            const now = Date.now();
            const isCriticalState = msg.status && msg.status !== 'live';
            if (isCriticalState || now - lastRenderTime >= 80) {
              if (batchTimer) {
                clearTimeout(batchTimer);
                batchTimer = undefined;
              }
              pendingBatch = null;
              applyDataUpdate(msg);
            } else {
              pendingBatch = msg;
              if (!batchTimer) {
                batchTimer = setTimeout(() => {
                  batchTimer = undefined;
                  if (!disposed && pendingBatch) {
                    applyDataUpdate(pendingBatch);
                    pendingBatch = null;
                  }
                }, 80);
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse Live Timing WebSocket payload:', err);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (disposed) return;
        // 1008 = origin rejected, 1013 = server at capacity. Neither is
        // transient; retrying with unbounded backoff only hammers the server.
        if (event.code === 1008 || event.code === 1013) {
          setConnectionStatus('lost');
          setGaveUp(true);
          return;
        }
        setConnectionStatus('lost');
        const delay = Math.min(3000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    const watchdog = setInterval(() => {
      if (disposed || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastMessageAt > STALL_TIMEOUT_MS) {
        ws.close(); // triggers onclose -> reconnect
      }
    }, 5000);

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (batchTimer) clearTimeout(batchTimer);
      clearInterval(watchdog);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return { data, connectionStatus, gaveUp };
}
