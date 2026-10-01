// WebSocket client with auto-reconnect. on[msg.t](msg) handles each server message.
// OFFICE_WS_URL is baked in by build.ts for static hosting (Vercel) where the WebSocket server lives elsewhere.
// eslint-disable-next-line no-undef
const WS_BASE = (typeof OFFICE_WS_URL !== "undefined" && OFFICE_WS_URL) || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

export function connect(session, on) {
  let ws;
  const open = () => {
    ws = new WebSocket(`${WS_BASE}/ws?s=${encodeURIComponent(session)}`);
    ws.onopen = () => on.open?.();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      on[m.t]?.(m);
    };
    ws.onclose = () => {
      on.close?.();
      setTimeout(open, 1500);
    };
  };
  open();
  return {
    send(m) {
      if (ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(m));
      return true;
    },
  };
}
