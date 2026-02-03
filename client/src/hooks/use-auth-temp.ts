import { useState } from "react";

interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'employee';
  shopId?: number;
  isBlocked: boolean;
}

export function useAuth() {
  const [user] = useState<User | null>(null);
  const [isLoading] = useState(false);

  const login = async (username: string, password: string): Promise<User> => {
    // Temporary implementation
    return { id: 1, username, name: username, role: 'admin' as const, isBlocked: false };
  };

  const logout = async (): Promise<void> => {
    // Temporary implementation
  };

  return { user, login, logout, isLoading };
}

export function AuthProvider({ children }: { children: any }) {
  return children;
}