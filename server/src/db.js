import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
const dbPath = process.env.DB_PATH || './data/adshare.sqlite';
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'advertiser',name TEXT NOT NULL,upi_id TEXT,balance_paise INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),company_name TEXT NOT NULL,ad_type TEXT NOT NULL CHECK(ad_type IN ('text','image','video')),title TEXT NOT NULL,body TEXT NOT NULL,media_url TEXT,click_url TEXT NOT NULL,requested_shows INTEGER NOT NULL,approved_shows INTEGER NOT NULL DEFAULT 0,shown_count INTEGER NOT NULL DEFAULT 0,unit_price_paise INTEGER NOT NULL,total_paise INTEGER NOT NULL,payment_status TEXT NOT NULL DEFAULT 'awaiting_payment',payment_reference TEXT,status TEXT NOT NULL DEFAULT 'pending_review',rejection_reason TEXT,created_at TEXT NOT NULL,approved_at TEXT);
CREATE TABLE IF NOT EXISTS impressions(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),user_id TEXT NOT NULL REFERENCES users(id),impression_key TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,reward_paise INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,amount_paise INTEGER NOT NULL,reference_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(kind,reference_id));
CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),upi_id TEXT NOT NULL,amount_paise INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',admin_note TEXT,created_at TEXT NOT NULL,processed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON campaigns(status,payment_status);
CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON impressions(campaign_id);
`);
