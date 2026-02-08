import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketMessage {
  type: string;
  [key: string]: any;
}

export function useSocket(
  onMessage: (message: SocketMessage) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const socket = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);

  // Update ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (socket.current?.connected) return;

    const socketUrl = window.location.protocol === "https:" ? "https://" + window.location.host : "http://" + window.location.host;
    
    socket.current = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    socket.current.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.io connected');
    });

    socket.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket.io disconnected');
    });

    // Listen for all game-related events
    socket.current.on('global_balance_update', (data) => {
      onMessageRef.current({ type: 'global_balance_update', ...data });
    });

    socket.current.on('number_called', (data) => {
      onMessageRef.current({ type: 'number_called', ...data });
    });

    socket.current.on('game_completed', (data) => {
      onMessageRef.current({ type: 'game_completed', ...data });
    });

    socket.current.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });
  }, []);

  const sendMessage = useCallback((event: string, data: any) => {
    if (socket.current?.connected) {
      socket.current.emit(event, data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { isConnected, sendMessage, disconnect };
}

// Legacy export for backward compatibility
export function useWebSocket(
  gameId: number,
  onMessage: (message: SocketMessage) => void
) {
  return useSocket(onMessage);
}
