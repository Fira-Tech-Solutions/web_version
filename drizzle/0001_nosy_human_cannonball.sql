CREATE TABLE "activation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"machine_id" text NOT NULL,
	"activated_at" text NOT NULL,
	CONSTRAINT "activation_machine_id_unique" UNIQUE("machine_id")
);
--> statement-breakpoint
CREATE TABLE "admin_recharge_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_recharge_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"filename" text NOT NULL,
	"file_data" text NOT NULL,
	"signature" text NOT NULL,
	"employee_id" integer,
	"amount" real NOT NULL,
	"created_at" text NOT NULL,
	"used_at" text,
	"shop_id" text
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"account_number" text NOT NULL,
	"admin_generated_balance" text DEFAULT '0',
	"employee_paid_amount" text DEFAULT '0',
	"total_recharge_files" integer DEFAULT 0,
	"total_recharge_amount" text DEFAULT '0',
	"created_at" text NOT NULL,
	"shop_id" text,
	"is_blocked" boolean DEFAULT false,
	"role" text DEFAULT 'employee',
	"machine_id" text,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username"),
	CONSTRAINT "admin_users_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "recharge_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recharge_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transaction_id" text NOT NULL,
	"amount" real NOT NULL,
	"employee_id" integer,
	"redeemed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "used_tokens" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"amount" real NOT NULL,
	"employee_id" integer,
	"redeemed_at" text NOT NULL
);
