import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'store.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
const getSetting = db.prepare('SELECT value FROM settings WHERE key=?');
const putSetting = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || !/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) {
  console.warn('Set ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET and a 64-character hex ENCRYPTION_KEY before production use.');
}
const encKey = /^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY || '') ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;

function encrypt(value) {
  if (!encKey) throw new Error('Server encryption is not configured.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
function decrypt(value) {
  if (!encKey) throw new Error('Server encryption is not configured.');
  const raw = Buffer.from(value, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, raw.subarray(0,12));
  decipher.setAuthTag(raw.subarray(12,28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
function dripKey() {
  const row = getSetting.get('drip_api_key');
  return row ? decrypt(row.value) : null;
}
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use(session({
  name: 'drip_admin',
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: 2 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));

const requireAdmin = (req,res,next) => req.session?.admin ? next() : res.status(401).json({error:'Silakan login sebagai admin.'});
const api = async (endpoint, options={}) => {
  const key = dripKey();
  if (!key) throw new Error('API Key Drip belum diatur oleh admin.');
  const response = await fetch(`https://dripclientofficial.dev/api/v1${endpoint}`, {
    ...options, headers: { Accept:'application/json', Authorization:`Bearer ${key}`, ...(options.headers||{}) }
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Drip API error ${response.status}`);
  return json.data;
};

app.get('/api/catalog', async (_req,res) => {
  try {
    const key = dripKey();
    const response = await fetch('https://dripclientofficial.dev/api/v1/products', {
      headers: {Accept:'application/json', ...(key ? {Authorization:`Bearer ${key}`} : {})}
    });
    const json = await response.json();
    if (!response.ok) return res.status(response.status).json({error:json?.error?.message || 'Gagal mengambil katalog.'});
    res.json({items:json?.data?.items || [], priceTier:json?.data?.priceTier || 'retail'});
  } catch (e) { res.status(502).json({error:e.message || 'Koneksi Drip gagal.'}); }
});

app.post('/api/admin/login', (req,res) => {
  const {username,password} = req.body || {};
  const u = process.env.ADMIN_USERNAME || '';
  const p = process.env.ADMIN_PASSWORD || '';
  const safeEq = (a,b) => {
    const aa=Buffer.from(String(a||'')), bb=Buffer.from(String(b||''));
    return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
  };
  if (!u || !p || !safeEq(username,u) || !safeEq(password,p)) return res.status(401).json({error:'Username atau password salah.'});
  req.session.admin = true;
  res.json({ok:true});
});
app.post('/api/admin/logout', requireAdmin, (req,res) => req.session.destroy(()=>res.json({ok:true})));
app.get('/api/admin/status', (req,res) => res.json({loggedIn:!!req.session?.admin}));
app.get('/api/admin/settings', requireAdmin, (_req,res) => {
  const qr = getSetting.get('payment_qr_url')?.value || '';
  res.json({hasApiKey:!!getSetting.get('drip_api_key'), qrUrl:qr, paymentNote:getSetting.get('payment_note')?.value || ''});
});
app.post('/api/admin/settings', requireAdmin, (req,res) => {
  const {apiKey,qrUrl,paymentNote} = req.body || {};
  if (typeof apiKey === 'string' && apiKey.trim()) {
    if (!/^drip_sk_(test|live)_/.test(apiKey.trim())) return res.status(400).json({error:'Format API Key tidak dikenali. Periksa key Drip.'});
    putSetting.run('drip_api_key', encrypt(apiKey.trim()));
  }
  if (typeof qrUrl === 'string') putSetting.run('payment_qr_url', qrUrl.slice(0,2000));
  if (typeof paymentNote === 'string') putSetting.run('payment_note', paymentNote.slice(0,1000));
  res.json({ok:true});
});
app.get('/api/payment-info', (_req,res) => res.json({
  qrUrl:getSetting.get('payment_qr_url')?.value || '',
  paymentNote:getSetting.get('payment_note')?.value || 'Hubungi admin untuk instruksi pembayaran.'
}));
app.get('/api/admin/account', requireAdmin, async (_req,res) => {
  try {
    const [me,balance] = await Promise.all([api('/me'),api('/balance')]);
    res.json({me,balance});
  } catch(e) { res.status(400).json({error:e.message}); }
});

// Intentionally no public order endpoint yet: payment confirmation must be verified
// before any paid Drip API purchase is triggered.
app.listen(PORT, () => console.log(`DRIP CLIENT STORE running on port ${PORT}`));
