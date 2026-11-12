import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db.js';
const secret = process.env.JWT_SECRET || 'dev-only-change-this-secret';
export function issueToken(user) { return jwt.sign({ id:user.id, role:user.role, email:user.email }, secret, { expiresIn:'7d' }); }
export function requireAuth(req,res,next) {
  try { const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):''; req.user=jwt.verify(token,secret); next(); }
  catch { res.status(401).json({error:'Please sign in again'}); }
}
export const requireAdmin=(req,res,next)=> req.user?.role==='admin' ? next() : res.status(403).json({error:'Admin access required'});
export async function ensureAdmin(){
  const email=(process.env.ADMIN_EMAIL||'admin@example.com').toLowerCase();
  if(!db.prepare('SELECT id FROM users WHERE email=?').get(email)){
    const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD||'change-this-password-now',12);
    db.prepare('INSERT INTO users(id,email,password_hash,role,name,created_at) VALUES(?,?,?,?,?,?)').run(nanoid(),email,hash,'admin','Administrator',new Date().toISOString());
  }
}
