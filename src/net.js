// WebSocket client with auto-reconnect. on[msg.t](msg) handles each server message.
export function connect(session, on) {
  let ws;
  const open = () => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?s=${encodeURIComponent(session)}`);
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
