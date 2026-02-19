import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

interface AdminUserEvent {
  type: 'user_created';
  user: {
    username: string;
    name: string;
    accountNumber: string;
    adminGeneratedBalance: string;
    employeePaidAmount: string;
    shopId?: string;
    isBlocked: boolean;
    role: string;
    createdAt: string;
  };
  timestamp: string;
}

export function useAdminRealtime() {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect to Socket.io for real-time updates
    const socket = io(`http://${window.location.hostname}:5000`, {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('📡 Connected to admin real-time updates');
      setIsConnected(true);
    });

    socket.on('adminUserCreated', (data) => {
      console.log('👥 New user created:', data.user);
      
      // Invalidate and refetch admin tracking data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tracking-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/employees'] });
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Employee Created', {
          body: `${data.user.name} (${data.user.username}) has been added to the system`,
          icon: '/favicon.ico'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('📡 Disconnected from admin real-time updates');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      setIsConnected(false);
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return { isConnected };
}
