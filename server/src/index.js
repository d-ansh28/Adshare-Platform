import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { issueToken, requireAuth, requireAdmin, ensureAdmin } from './auth.js';
import { PRICING, MIN_WITHDRAWAL_PAISE, RAZORPAY_PROFILE_URL } from './config.js';

const app=express();
app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:true,credentials:false}));
app.use(express.json({limit:'1mb'}));
app.use(express.static(new URL('../public',import.meta.url).pathname));
const now=()=>new Date().toISOString();
const money=n=>Math.round(n)/100;
const cleanUrl=(v)=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.toString():null}catch{return null}};

app.get('/api/health',(req,res)=>res.json({ok:true,pricing:Object.fromEntries(Object.entries(PRICING).map(([k,v])=>[k,{...v,advertiserRupees:money(v.advertiserPaise),userRupees:money(v.userPaise)}])),minimumWithdrawal:money(MIN_WITHDRAWAL_PAISE)}));
app.post('/api/auth/register',async(req,res)=>{
  const {email,password,name}=req.body||{}; if(!email||!password||password.length<10||!name) return res.status(400).json({error:'Name, email and password (10+ characters) required'});
  const normalized=String(email).trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(normalized)) return res.status(400).json({error:'Invalid email'});
  try{const id=nanoid();const hash=await bcrypt.hash(password,12);db.prepare('INSERT INTO users(id,email,password_hash,role,name,created_at) VALUES(?,?,?,?,?,?)').run(id,normalized,hash,'advertiser',String(name).trim().slice(0,100),now());const user={id,email:normalized,role:'advertiser',name};res.json({token:issueToken(user),user});}catch{res.status(409).json({error:'Email already registered'});}
});
app.post('/api/auth/login',async(req,res)=>{const email=String(req.body?.email||'').toLowerCase().trim();const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user||!(await bcrypt.compare(req.body?.password||'',user.password_hash)))return res.status(401).json({error:'Invalid email or password'});res.json({token:issueToken(user),user:{id:user.id,email:user.email,role:user.role,name:user.name}});});
app.get('/api/me',requireAuth,(req,res)=>{const u=db.prepare('SELECT id,email,role,name,upi_id,balance_paise,created_at FROM users WHERE id=?').get(req.user.id);res.json({...u,balance:money(u.balance_paise)});});

app.post('/api/campaigns',requireAuth,(req,res)=>{
 const {companyName,adType,title,body,mediaUrl,clickUrl,shows}=req.body||{}; const p=PRICING[adType];
 if(req.user.role!=='advertiser')return res.status(403).json({error:'Advertiser account required'});
 if(!p||!companyName||!title||!body||!Number.isInteger(Number(shows))||Number(shows)<100||Number(shows)>1000000)return res.status(400).json({error:'Invalid campaign details. Shows must be 100–1,000,000.'});
 const click=cleanUrl(clickUrl); if(!click)return res.status(400).json({error:'Valid http(s) destination URL required'});
 let media=null;if(adType==='image'||adType==='video'){media=cleanUrl(mediaUrl);if(!media)return res.status(400).json({error:'Image/video URL must be a valid public http(s) URL'});}
 const id=nanoid(14),total=Number(shows)*p.advertiserPaise;
 db.prepare(`INSERT INTO campaigns(id,user_id,company_name,ad_type,title,body,media_url,click_url,requested_shows,unit_price_paise,total_paise,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,req.user.id,String(companyName).trim().slice(0,120),adType,String(title).trim().slice(0,120),String(body).trim().slice(0,500),media,click,Number(shows),p.advertiserPaise,total,now());
 res.status(201).json({id,total:money(total),totalPaise:total,paymentStatus:'under_review',paymentUrl:RAZORPAY_PROFILE_URL,instructions:'Pay the exact displayed amount using the payment page, then submit your payment reference. Campaigns remain inactive until admin verification.'});
});
app.post('/api/campaigns/:id/submit-payment',requireAuth,(req,res)=>{const ref=String(req.body?.paymentReference||'').trim().slice(0,100);if(!ref)return res.status(400).json({error:'Payment reference required'});const c=db.prepare('SELECT * FROM campaigns WHERE id=? AND user_id=?').get(req.params.id,req.user.id);if(!c)return res.status(404).json({error:'Campaign not found'});if(c.payment_status==='verified')return res.status(409).json({error:'Payment already verified'});db.prepare("UPDATE campaigns SET payment_reference=?,payment_status='under_review',status='pending_review' WHERE id=?").run(ref,c.id);res.json({ok:true,status:'under_review'});});
app.get('/api/campaigns',requireAuth,(req,res)=>{const rows=req.user.role==='admin'?db.prepare('SELECT c.*,u.email advertiser_email FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC').all():db.prepare('SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);res.json(rows.map(c=>({...c,total:money(c.total_paise),unitPrice:money(c.unit_price_paise),remaining:Math.max(0,c.approved_shows-c.shown_count),progress:c.approved_shows?Math.min(100,Math.round(c.shown_count/c.approved_shows*100)):0})));});
app.get('/api/campaigns/:id/analytics',requireAuth,(req,res)=>{const c=db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);if(!c|| (req.user.role!=='admin'&&c.user_id!==req.user.id))return res.status(404).json({error:'Not found'});const daily=db.prepare("SELECT substr(created_at,1,10) day,count(*) impressions,sum(reward_paise) rewards FROM impressions WHERE campaign_id=? GROUP BY day ORDER BY day").all(c.id);res.json({campaign:c,impressions:c.shown_count,approvedShows:c.approved_shows,remaining:Math.max(0,c.approved_shows-c.shown_count),spent:money(c.shown_count*c.unit_price_paise),daily});});

// Serve only approved, paid campaigns. User must be authenticated. Server chooses randomly.
app.get('/api/ads/next',requireAuth,(req,res)=>{
 const rows=db.prepare("SELECT * FROM campaigns WHERE status='active' AND payment_status='verified' AND shown_count<approved_shows ORDER BY RANDOM() LIMIT 12").all();
 if(!rows.length)return res.json({ad:null});const c=rows[Math.floor(Math.random()*rows.length)];
 res.json({ad:{campaignId:c.id,type:c.ad_type,title:c.title,body:c.body,mediaUrl:c.media_url,clickUrl:c.click_url,unitReward:money(PRICING[c.ad_type].userPaise),servedAt:Date.now()}});
});
// Replace the ledger user_id placeholder atomically with actual user ID.
app.post('/api/ads/impression',requireAuth,(req,res)=>{
 const {campaignId,impressionKey,visibleMs}=req.body||{};if(!campaignId||!impressionKey||String(impressionKey).length>100||Number(visibleMs)<2000)return res.status(400).json({error:'Invalid impression'});
 const c=db.prepare("SELECT * FROM campaigns WHERE id=? AND status='active' AND payment_status='verified'").get(campaignId);if(!c||c.shown_count>=c.approved_shows)return res.status(409).json({error:'Campaign unavailable'});
 const reward=PRICING[c.ad_type].userPaise;const id=nanoid();
 try{const tx=db.transaction(()=>{db.prepare('INSERT INTO impressions(id,campaign_id,user_id,impression_key,created_at,reward_paise) VALUES(?,?,?,?,?,?)').run(id,c.id,req.user.id,String(impressionKey),now(),reward);const changed=db.prepare('UPDATE campaigns SET shown_count=shown_count+1 WHERE id=? AND shown_count<approved_shows').run(c.id);if(!changed.changes)throw new Error('cap');db.prepare('UPDATE users SET balance_paise=balance_paise+? WHERE id=?').run(reward,req.user.id);db.prepare('INSERT INTO ledger(id,user_id,kind,amount_paise,reference_id,created_at) VALUES(?,?,?,?,?,?)').run(nanoid(),req.user.id,'reward',reward,id,now());});tx();res.json({ok:true,reward:money(reward)});}catch(e){res.status(409).json({error:e.message==='cap'?'Campaign limit reached':'Duplicate impression'});}
});

app.post('/api/withdrawals',requireAuth,(req,res)=>{const upi=String(req.body?.upiId||'').trim();if(!/^[\w.\-]{2,256}@[\w]{2,64}$/.test(upi))return res.status(400).json({error:'Enter a valid UPI ID'});const u=db.prepare('SELECT balance_paise FROM users WHERE id=?').get(req.user.id);if(u.balance_paise<MIN_WITHDRAWAL_PAISE)return res.status(400).json({error:'Minimum withdrawal is ₹1,000'});const id=nanoid();try{const tx=db.transaction(()=>{const changed=db.prepare('UPDATE users SET balance_paise=balance_paise-?,upi_id=? WHERE id=? AND balance_paise>=?').run(u.balance_paise,upi,req.user.id,MIN_WITHDRAWAL_PAISE);if(!changed.changes)throw new Error('balance');db.prepare('INSERT INTO withdrawals(id,user_id,upi_id,amount_paise,status,created_at) VALUES(?,?,?,?,?,?)').run(id,req.user.id,upi,u.balance_paise,'pending',now());db.prepare('INSERT INTO ledger(id,user_id,kind,amount_paise,reference_id,created_at) VALUES(?,?,?,?,?,?)').run(nanoid(),req.user.id,'withdrawal_hold',-u.balance_paise,id,now());});tx();res.status(201).json({id,status:'pending',amount:money(u.balance_paise)});}catch{res.status(409).json({error:'Balance changed; refresh and try again'});}});
app.get('/api/withdrawals',requireAuth,(req,res)=>{const rows=req.user.role==='admin'?db.prepare('SELECT w.*,u.email,u.name FROM withdrawals w JOIN users u ON u.id=w.user_id ORDER BY w.created_at DESC').all():db.prepare('SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);res.json(rows.map(w=>({...w,amount:money(w.amount_paise)})));});
app.post('/api/admin/campaigns/:id/decision',requireAuth,requireAdmin,(req,res)=>{const {decision,reason,approvedShows}=req.body||{};const c=db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Campaign not found'});if(decision==='reject'){const msg=String(reason||'Payment not verified').slice(0,250);db.prepare("UPDATE campaigns SET status='rejected',payment_status='rejected',rejection_reason=? WHERE id=?").run(msg,c.id);return res.json({ok:true,status:'rejected'});}if(decision!=='approve')return res.status(400).json({error:'Decision must be approve or reject'});if(c.payment_status!=='under_review'||!c.payment_reference)return res.status(409).json({error:'Payment reference must be submitted before approval'});const shows=Number(approvedShows);if(!Number.isInteger(shows)||shows<1||shows>c.requested_shows)return res.status(400).json({error:'Approved shows must be between 1 and requested shows'});const expected=shows*c.unit_price_paise;if(c.total_paise<expected)return res.status(400).json({error:'Requested payment does not cover approved shows'});db.prepare("UPDATE campaigns SET approved_shows=?,status='active',payment_status='verified',approved_at=?,rejection_reason=NULL WHERE id=?").run(shows,now(),c.id);res.json({ok:true,status:'active',approvedShows:shows});});
app.post('/api/admin/withdrawals/:id/decision',requireAuth,requireAdmin,(req,res)=>{const {decision,note}=req.body||{};const w=db.prepare('SELECT * FROM withdrawals WHERE id=?').get(req.params.id);if(!w||w.status!=='pending')return res.status(404).json({error:'Pending withdrawal not found'});if(decision==='paid'){db.prepare("UPDATE withdrawals SET status='paid',admin_note=?,processed_at=? WHERE id=?").run(String(note||'UPI payment sent').slice(0,250),now(),w.id);return res.json({ok:true});}if(decision==='reject'){const tx=db.transaction(()=>{db.prepare("UPDATE withdrawals SET status='rejected',admin_note=?,processed_at=? WHERE id=?").run(String(note||'Rejected').slice(0,250),now(),w.id);db.prepare('UPDATE users SET balance_paise=balance_paise+? WHERE id=?').run(w.amount_paise,w.user_id);db.prepare('INSERT INTO ledger(id,user_id,kind,amount_paise,reference_id,created_at) VALUES(?,?,?,?,?,?)').run(nanoid(),w.user_id,'withdrawal_refund',w.amount_paise,w.id,now());});tx();return res.json({ok:true});}res.status(400).json({error:'Invalid decision'});});
app.get('/api/admin/overview',requireAuth,requireAdmin,(req,res)=>{const campaigns=db.prepare('SELECT count(*) total,sum(CASE WHEN status="active" THEN 1 ELSE 0 END) active,sum(shown_count) impressions,sum(total_paise) booked FROM campaigns').get();const withdrawals=db.prepare("SELECT count(*) count,sum(amount_paise) amount FROM withdrawals WHERE status='pending'").get();const users=db.prepare('SELECT count(*) count FROM users WHERE role="advertiser"').get();res.json({campaigns,withdrawals:{count:withdrawals.count,amount:money(withdrawals.amount||0)},advertisers:users.count});});

await ensureAdmin();
const port=Number(process.env.PORT||3000);app.listen(port,()=>console.log(`AdShare listening on ${port}`));
