-- Create table for tracking used recharges to prevent replay attacks
CREATE TABLE IF NOT EXISTS used_recharges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nonce TEXT UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  amount REAL NOT NULL,
  user_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_used_recharges_nonce ON used_recharges(nonce);
CREATE INDEX IF NOT EXISTS idx_used_recharges_signature ON used_recharges(signature);
