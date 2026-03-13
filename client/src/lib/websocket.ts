import { useEffect, useRef, useState, useCallback } from 'react';

interface SocketMessage {
  type: string;
  [key: string]: any;
}

export function useSocket(
  onMessage: (message: SocketMessage) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  // Update ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Disable WebSocket connections for serverless deployment
    console.log('WebSocket connections disabled in serverless deployment');
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((event: string, data: any) => {
    // Disable WebSocket messages for serverless deployment
    console.log('WebSocket messages disabled in serverless deployment');
  }, []);

  const disconnect = useCallback(() => {
    // Disable WebSocket disconnect for serverless deployment
    console.log('WebSocket disconnect disabled in serverless deployment');
  }, []);

  useEffect(() => {
    // Don't connect automatically in serverless deployment
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, sendMessage, disconnect };
}

// Legacy export for backward compatibility
export function useWebSocket(
  gameId: number,
  onMessage: (message: SocketMessage) => void
) {
  return useSocket(onMessage);
}
