export interface Game {
  id: number;
  shopId: number;
  employeeId: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  prizePool: string;
  entryFee: string;
  calledNumbers: string[];
  winnerId?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface GamePlayer {
  id: number;
  gameId: number;
  playerName: string;
  cartelaNumbers: number[];
  entryFee: string;
  registeredAt: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'employee';
  shopId?: number;
  isBlocked: boolean;
  createdAt: string;
}

export interface Shop {
  id: number;
  name: string;
  adminId: number;
  profitMargin: string;
  commissionRate: string;
  isBlocked: boolean;
  createdAt: string;
}

export interface Transaction {
  id: number;
  gameId?: number;
  shopId: number;
  employeeId: number;
  amount: string;
  type: 'entry_fee' | 'prize_payout' | 'commission';
  description?: string;
  createdAt: string;
}
