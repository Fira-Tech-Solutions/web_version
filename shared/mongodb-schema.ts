import mongoose, { Schema, Document } from 'mongoose';

// User Schema
export interface IUser extends Document {
  username: string;
  password: string;
  role: 'super_admin' | 'admin' | 'employee' | 'collector';
  name: string;
  email?: string;
  isBlocked: boolean;
  shopId?: mongoose.Types.ObjectId;
  supervisorId?: mongoose.Types.ObjectId;
  creditBalance: number;
  accountNumber?: string;
  referredBy?: mongoose.Types.ObjectId;
  commissionRate: number;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['super_admin', 'admin', 'employee', 'collector'] },
  name: { type: String, required: true },
  email: { type: String },
  isBlocked: { type: Boolean, default: false },
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
  supervisorId: { type: Schema.Types.ObjectId, ref: 'User' },
  creditBalance: { type: Number, default: 0 },
  accountNumber: { type: String, unique: true, sparse: true },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  commissionRate: { type: Number, default: 25 },
  createdAt: { type: Date, default: Date.now }
});

// Shop Schema
export interface IShop extends Document {
  name: string;
  adminId: mongoose.Types.ObjectId;
  profitMargin: number;
  superAdminCommission: number;
  referralCommission: number;
  isBlocked: boolean;
  totalRevenue: number;
  createdAt: Date;
}

const shopSchema = new Schema<IShop>({
  name: { type: String, required: true },
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profitMargin: { type: Number, default: 20 },
  superAdminCommission: { type: Number, default: 25 },
  referralCommission: { type: Number, default: 3 },
  isBlocked: { type: Boolean, default: false },
  totalRevenue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Game Schema
export interface IGamePlayer {
  playerName: string;
  cartelaNumbers: number[];
  entryFee: number;
  registeredAt: Date;
}

export interface IGame extends Document {
  shopId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  prizePool: number;
  entryFee: number;
  calledNumbers: string[];
  players: IGamePlayer[];
  winnerId?: string;
  winnerName?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const gamePlayerSchema = new Schema<IGamePlayer>({
  playerName: { type: String, required: true },
  cartelaNumbers: [{ type: Number, required: true }],
  entryFee: { type: Number, required: true },
  registeredAt: { type: Date, default: Date.now }
});

const gameSchema = new Schema<IGame>({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, required: true, enum: ['waiting', 'active', 'completed', 'cancelled'] },
  prizePool: { type: Number, default: 0 },
  entryFee: { type: Number, required: true },
  calledNumbers: [{ type: String }],
  players: [gamePlayerSchema],
  winnerId: { type: String },
  winnerName: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Transaction Schema
export interface ITransaction extends Document {
  gameId?: mongoose.Types.ObjectId;
  shopId?: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId;
  adminId?: mongoose.Types.ObjectId;
  amount: number;
  type: string;
  description?: string;
  referenceId?: string;
  fromUserId?: mongoose.Types.ObjectId;
  toUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
  employeeId: { type: Schema.Types.ObjectId, ref: 'User' },
  adminId: { type: Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  description: { type: String },
  referenceId: { type: String },
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Cartela Schema
export interface ICartela extends Document {
  shopId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  cartelaNumber: number;
  name: string;
  pattern: number[][];
  isHardcoded: boolean;
  isActive: boolean;
  isBooked: boolean;
  bookedBy?: mongoose.Types.ObjectId;
  collectorId?: mongoose.Types.ObjectId;
  markedAt?: Date;
  gameId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cartelaSchema = new Schema<ICartela>({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  cartelaNumber: { type: Number, required: true },
  name: { type: String, required: true },
  pattern: [[{ type: Number }]],
  isHardcoded: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBooked: { type: Boolean, default: false },
  bookedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  collectorId: { type: Schema.Types.ObjectId, ref: 'User' },
  markedAt: { type: Date },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Credit Load Schema
export interface ICreditLoad extends Document {
  adminId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  transferScreenshot?: string;
  adminAccountNumber?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  notes?: string;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
}

const creditLoadSchema = new Schema<ICreditLoad>({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  referenceNumber: { type: String },
  transferScreenshot: { type: String },
  adminAccountNumber: { type: String },
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'rejected'] },
  notes: { type: String },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  processedBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

// Create indexes for better performance
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ shopId: 1 });
shopSchema.index({ adminId: 1 });
gameSchema.index({ shopId: 1, status: 1 });
gameSchema.index({ employeeId: 1 });
transactionSchema.index({ gameId: 1 });
transactionSchema.index({ shopId: 1 });
cartelaSchema.index({ shopId: 1, cartelaNumber: 1 }, { unique: true });
creditLoadSchema.index({ adminId: 1, status: 1 });

// Export models
export const User = mongoose.model<IUser>('User', userSchema);
export const Shop = mongoose.model<IShop>('Shop', shopSchema);
export const Game = mongoose.model<IGame>('Game', gameSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
export const Cartela = mongoose.model<ICartela>('Cartela', cartelaSchema);
export const CreditLoad = mongoose.model<ICreditLoad>('CreditLoad', creditLoadSchema);