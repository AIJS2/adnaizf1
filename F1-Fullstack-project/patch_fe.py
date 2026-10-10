import sys

with open('frontend/src/pages/LiveTimingPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {"""

replacement = """  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {"""

content = content.replace(target, replacement)

target2 = """      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('lost');
        reconnectTimer = setTimeout(connect, 3000); // Auto reconnect
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };"""

replacement2 = """      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        setConnectionStatus('lost');
        reconnectTimer = setTimeout(connect, 3000); // Auto reconnect
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    };

    connect();
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };"""

content = content.replace(target2, replacement2)

with open('frontend/src/pages/LiveTimingPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
