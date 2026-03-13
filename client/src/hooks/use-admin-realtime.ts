import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
    // Disable WebSocket connections for serverless deployment
    console.log('📡 Admin real-time updates disabled in serverless deployment');
    setIsConnected(false);

    // Request notification permission (still works without WebSocket)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      // No cleanup needed for disabled WebSocket
    };
  }, [queryClient]);

  return { isConnected };
}
