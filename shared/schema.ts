import { pgTable, text, serial, integer, boolean, decimal, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('employee'), // 'admin', 'employee'
  name: text("name").notNull(),
  email: text("email"),
  accountNumber: text("account_number").unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00"),
  isBlocked: boolean("is_blocked").default(false),
  shopId: integer("shop_id").references(() => shops.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employee profit margins per shop - allows admins to set different margins for employees in different shops
export const employeeProfitMargins = pgTable("employee_profit_margins", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("20.00"), // Employee's profit margin for this shop
  createdAt: timestamp("created_at").defaultNow(),
});

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminId: integer("admin_id").references(() => users.id),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("20.00"), // Admin cut
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00"), // Shop operational balance
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
});

export const balanceRedemptions = pgTable("balance_redemptions", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  signature: text("signature").notNull().unique(),
  redeemedBy: integer("redeemed_by").references(() => users.id),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  status: text("status").notNull(), // 'waiting', 'active', 'completed', 'cancelled'
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
  type: text("type").notNull(), // 'entry_fee', 'prize_payout', 'admin_profit', 'credit_load'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameHistory = pgTable("game_history", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  totalCollected: decimal("total_collected", { precision: 10, scale: 2 }).notNull(),
  prizeAmount: decimal("prize_amount", { precision: 10, scale: 2 }).notNull(),
  adminProfit: decimal("admin_profit", { precision: 10, scale: 2 }).notNull(),
  playerCount: integer("player_count").notNull(),
  winnerName: text("winner_name"),
  winningCartela: text("winning_cartela"),
  completedAt: timestamp("completed_at").defaultNow(),
});



// Unified cartelas table for both hardcoded and dynamic cartelas
export const cartelas = pgTable("cartelas", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  adminId: integer("admin_id").notNull().references(() => users.id),
  cartelaNumber: integer("cartela_number").notNull(),
  name: text("name").notNull(),
  pattern: jsonb("pattern").$type<number[][]>().notNull(), // 5x5 grid of numbers
  isHardcoded: boolean("is_hardcoded").default(false).notNull(), // Track original hardcoded status
  isActive: boolean("is_active").default(true).notNull(),
  isBooked: boolean("is_booked").default(false).notNull(), // Cartela booking status
  bookedBy: integer("booked_by").references(() => users.id), // Employee who booked it
  gameId: integer("game_id").references(() => games.id), // Associated game if booked
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  shopCartelaUnique: unique().on(table.shopId, table.cartelaNumber),
}));

// Keep old table for backward compatibility during migration
export const customCartelas = pgTable("custom_cartelas", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  cartelaNumber: integer("cartela_number").notNull(),
  name: text("name").notNull(), // Custom name for the cartela
  pattern: jsonb("pattern").$type<number[][]>().notNull(), // 5x5 grid of numbers
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily revenue summary for performance tracking
export const dailyRevenueSummary = pgTable("daily_revenue_summary", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // YYYY-MM-DD format in EAT
  totalAdminRevenue: decimal("total_admin_revenue", { precision: 12, scale: 2 }).default("0.00"),
  totalGamesPlayed: integer("total_games_played").default(0),
  totalPlayersRegistered: integer("total_players_registered").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  shop: one(shops, {
    fields: [users.shopId],
    references: [shops.id],
  }),
  managedShop: one(shops, {
    fields: [users.id],
    references: [shops.adminId],
  }),
  games: many(games),
  transactions: many(transactions),
  employeeProfitMargins: many(employeeProfitMargins),
  balanceRedemptions: many(balanceRedemptions),
}));

export const employeeProfitMarginsRelations = relations(employeeProfitMargins, ({ one }) => ({
  employee: one(users, {
    fields: [employeeProfitMargins.employeeId],
    references: [users.id],
  }),
  shop: one(shops, {
    fields: [employeeProfitMargins.shopId],
    references: [shops.id],
  }),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  admin: one(users, {
    fields: [shops.adminId],
    references: [users.id],
  }),
  employees: many(users),
  games: many(games),
  transactions: many(transactions),
  employeeProfitMargins: many(employeeProfitMargins),
  customCartelas: many(customCartelas),
  cartelas: many(cartelas),
}));

export const balanceRedemptionsRelations = relations(balanceRedemptions, ({ one }) => ({
  shop: one(shops, {
    fields: [balanceRedemptions.shopId],
    references: [shops.id],
  }),
  redeemer: one(users, {
    fields: [balanceRedemptions.redeemedBy],
    references: [users.id],
  }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  shop: one(shops, {
    fields: [games.shopId],
    references: [shops.id],
  }),
  employee: one(users, {
    fields: [games.employeeId],
    references: [users.id],
  }),
  players: many(gamePlayers),
  winner: one(gamePlayers, {
    fields: [games.winnerId],
    references: [gamePlayers.id],
  }),
  transactions: many(transactions),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  game: one(games, {
    fields: [transactions.gameId],
    references: [games.id],
  }),
  shop: one(shops, {
    fields: [transactions.shopId],
    references: [shops.id],
  }),
  employee: one(users, {
    fields: [transactions.employeeId],
    references: [users.id],
  }),
}));

export const gameHistoryRelations = relations(gameHistory, ({ one }) => ({
  game: one(games, {
    fields: [gameHistory.gameId],
    references: [games.id],
  }),
  shop: one(shops, {
    fields: [gameHistory.shopId],
    references: [shops.id],
  }),
  employee: one(users, {
    fields: [gameHistory.employeeId],
    references: [users.id],
  }),
}));



// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertShopSchema = createInsertSchema(shops).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertGamePlayerSchema = createInsertSchema(gamePlayers).omit({
  id: true,
  registeredAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions, {
  amount: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertGameHistorySchema = createInsertSchema(gameHistory).omit({
  id: true,
});

export const insertEmployeeProfitMarginSchema = createInsertSchema(employeeProfitMargins).omit({
  id: true,
});

export const insertCartelaSchema = createInsertSchema(cartelas).omit({
  id: true,
});

export const insertCustomCartelaSchema = createInsertSchema(customCartelas).omit({
  id: true,
});

export const insertDailyRevenueSummarySchema = createInsertSchema(dailyRevenueSummary, {
  totalSuperAdminRevenue: z.string(),
  totalAdminRevenue: z.string(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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
export type GameHistory = typeof gameHistory.$inferSelect;
export type InsertGameHistory = z.infer<typeof insertGameHistorySchema>;
export type EmployeeProfitMargin = typeof employeeProfitMargins.$inferSelect;
export type InsertEmployeeProfitMargin = z.infer<typeof insertEmployeeProfitMarginSchema>;
export type Cartela = typeof cartelas.$inferSelect;
export type InsertCartela = z.infer<typeof insertCartelaSchema>;
export type CustomCartela = typeof customCartelas.$inferSelect;
export type InsertCustomCartela = z.infer<typeof insertCustomCartelaSchema>;
export type DailyRevenueSummary = typeof dailyRevenueSummary.$inferSelect;
export type InsertDailyRevenueSummary = z.infer<typeof insertDailyRevenueSummarySchema>;
