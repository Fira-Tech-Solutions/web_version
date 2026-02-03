import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  isBlocked: boolean("is_blocked").default(false),
  shopId: integer("shop_id").references(() => shops.id),
  supervisorId: integer("supervisor_id").references(() => users.id),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 2 }).default("0.00"),
  accountNumber: text("account_number").unique(),
  referredBy: integer("referred_by").references(() => users.id),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("25.00"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminId: integer("admin_id").references(() => users.id),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("20.00"),
  superAdminCommission: decimal("super_admin_commission", { precision: 5, scale: 2 }).default("25.00"),
  referralCommission: decimal("referral_commission", { precision: 5, scale: 2 }).default("3.00"),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  status: text("status").notNull(),
  prizePool: decimal("prize_pool", { precision: 10, scale: 2 }).default("0.00"),
  entryFee: decimal("entry_fee", { precision: 10, scale: 2 }).notNull(),
  calledNumbers: jsonb("called_numbers").$type<string[]>().default([]),
  winnerId: integer("winner_id").references(() => gamePlayers.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gamePlayers = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  playerName: text("player_name").notNull(),
  cartelaNumbers: jsonb("cartela_numbers").$type<number[]>().notNull(),
  entryFee: decimal("entry_fee", { precision: 10, scale: 2 }).notNull(),
  registeredAt: timestamp("registered_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id),
  shopId: integer("shop_id").references(() => shops.id),
  employeeId: integer("employee_id").references(() => users.id),
  adminId: integer("admin_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  description: text("description"),
  referenceId: text("reference_id"),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Basic insert schemas without complex omit clauses
export const insertUserSchema = createInsertSchema(users);
export const insertShopSchema = createInsertSchema(shops);
export const insertGameSchema = createInsertSchema(games);
export const insertGamePlayerSchema = createInsertSchema(gamePlayers);
export const insertTransactionSchema = createInsertSchema(transactions);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;