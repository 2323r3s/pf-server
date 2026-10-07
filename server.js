require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════
// ПОДКЛЮЧЕНИЕ К POSTGRESQL (ZevCloud)
// ═══════════════════════════════════════════════════════
const pool = new Pool({
  connectionString: 'postgresql://zc_pfdbr:j2DpE1aigmk7nHaRnRB7AmN0srtGGtEY@zevcloud.app:56611/pf_dbr',
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL подключён'))
  .catch(err => console.error('❌ PostgreSQL ошибка:', err.stack || err.message || JSON.stringify(err)));

// ═══════════════════════════════════════════════════════
// СОЗДАНИЕ ТАБЛИЦ
// ═══════════════════════════════════════════════════════
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        code TEXT,
        paradox TEXT,
        tripcode TEXT,
        status TEXT DEFAULT 'ЖИ',
        aura INTEGER DEFAULT 100,
        tonki INTEGER DEFAULT 10,
        avatar TEXT,
        registered_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL, text TEXT NOT NULL,
        urgent BOOLEAN DEFAULT false, pinned BOOLEAN DEFAULT false, edited BOOLEAN DEFAULT false,
        author TEXT NOT NULL, author_status TEXT NOT NULL, author_avatar TEXT, date TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank (
        phone TEXT PRIMARY KEY,
        deposit INTEGER DEFAULT 0, frozen BOOLEAN DEFAULT false, frozen_at BIGINT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fines (
        id BIGINT PRIMARY KEY, phone TEXT NOT NULL, reason TEXT NOT NULL, amount INTEGER NOT NULL,
        from_phone TEXT, from_name TEXT, date TEXT NOT NULL, paid BOOLEAN DEFAULT false, paid_at TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        user_phone TEXT NOT NULL, friend_phone TEXT NOT NULL, type TEXT NOT NULL,
        PRIMARY KEY (user_phone, friend_phone, type)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT PRIMARY KEY, from_phone TEXT NOT NULL, from_name TEXT NOT NULL,
        from_avatar TEXT, from_status TEXT, text TEXT NOT NULL, time TEXT NOT NULL, date TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id BIGINT PRIMARY KEY, chat_id TEXT NOT NULL, from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL, text TEXT NOT NULL, time TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, content TEXT NOT NULL)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate (
        id INTEGER PRIMARY KEY DEFAULT 1,
        to_rub NUMERIC NOT NULL DEFAULT 10,
        updated_at TIMESTAMP DEFAULT NOW(), updated_by TEXT
      )
    `);
    await pool.query(`INSERT INTO rate (id, to_rub) VALUES (1, 10) ON CONFLICT (id) DO NOTHING`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank_pf (
        id INTEGER PRIMARY KEY DEFAULT 1, amount BIGINT NOT NULL DEFAULT 3124000000000
      )
    `);
    await pool.query(`INSERT INTO bank_pf (id, amount) VALUES (1, 3124000000000) ON CONFLICT (id) DO NOTHING`);
    console.log('✅ Таблицы готовы');
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err.stack || err.message || JSON.stringify(err));
  }
};

initDB();

// ═══════════════════════════════════════════════════════
// ГЛАВНАЯ
// ═══════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.send('🏚️ Подвальная Федерация — сервер работает (PostgreSQL)!');
});

// ═══════════════════════════════════════════════════════
// API: ПОЛЬЗОВАТЕЛИ
// ═══════════════════════════════════════════════════════
app.get('/api/users', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users ORDER BY registered_at ASC');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const u = req.body;
    await pool.query(
      `INSERT INTO users (phone, login, password, first_name, last_name, code, paradox, tripcode, status, aura, tonki, avatar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (phone) DO UPDATE SET login=$2, password=$3, first_name=$4, last_name=$5, code=$6, paradox=$7, tripcode=$8, status=$9, aura=$10, tonki=$11, avatar=$12`,
      [u.phone, u.login, u.password, u.firstName, u.lastName, u.code, u.paradox, u.tripcode, u.status, u.aura, u.tonki, u.avatar]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:phone', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE phone=$1', [req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: НОВОСТИ
// ═══════════════════════════════════════════════════════
app.get('/api/news', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM news ORDER BY id DESC');
    res.json(r.rows.map(n => ({ id: n.id, title: n.title, text: n.text, urgent: n.urgent, pinned: n.pinned, edited: n.edited, author: n.author, authorStatus: n.author_status, authorAvatar: n.author_avatar, date: n.date })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/news', async (req, res) => {
  try {
    const n = req.body;
    await pool.query(
      `INSERT INTO news (id, title, text, urgent, pinned, edited, author, author_status, author_avatar, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET title=$2, text=$3, urgent=$4, pinned=$5, edited=$6, date=$10`,
      [n.id, n.title, n.text, n.urgent, n.pinned, n.edited, n.author, n.authorStatus, n.authorAvatar, n.date]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM news WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: БАНК
// ═══════════════════════════════════════════════════════
app.get('/api/bank', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM bank');
    const obj = {};
    r.rows.forEach(x => { obj[x.phone] = { deposit: x.deposit, frozen: x.frozen, frozenAt: x.frozen_at }; });
    res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bank/:phone', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `INSERT INTO bank (phone, deposit, frozen, frozen_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (phone) DO UPDATE SET deposit=$2, frozen=$3, frozen_at=$4`,
      [req.params.phone, b.deposit, b.frozen, b.frozenAt]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: ОБЩИЙ ЧАТ
// ═══════════════════════════════════════════════════════
app.get('/api/messages', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM messages ORDER BY id ASC LIMIT 200');
    res.json(r.rows.map(m => ({ id: m.id, from: m.from_phone, fromName: m.from_name, fromAvatar: m.from_avatar, fromStatus: m.from_status, text: m.text, time: m.time, date: m.date })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.from, m.fromName, m.fromAvatar, m.fromStatus, m.text, m.time, m.date]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: ШТРАФЫ
// ═══════════════════════════════════════════════════════
app.get('/api/fines', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM fines ORDER BY id DESC');
    res.json(r.rows.map(f => ({ id: f.id, phone: f.phone, reason: f.reason, amount: f.amount, fromPhone: f.from_phone, fromName: f.from_name, date: f.date, paid: f.paid, paidAt: f.paid_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fines', async (req, res) => {
  try {
    const f = req.body;
    await pool.query(
      `INSERT INTO fines (id, phone, reason, amount, from_phone, from_name, date, paid, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET paid=$8, paid_at=$9`,
      [f.id, f.phone, f.reason, f.amount, f.fromPhone, f.fromName, f.date, f.paid, f.paidAt || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: ДРУЗЬЯ
// ═══════════════════════════════════════════════════════
app.get('/api/friends', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM friends');
    const obj = {};
    r.rows.forEach(x => {
      if (!obj[x.user_phone]) obj[x.user_phone] = { friends: [], incoming: [], outgoing: [] };
      obj[x.user_phone][x.type].push(x.friend_phone);
    });
    res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/friends', async (req, res) => {
  try {
    const { user_phone, friend_phone, type } = req.body;
    await pool.query(
      `INSERT INTO friends (user_phone, friend_phone, type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [user_phone, friend_phone, type]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/friends', async (req, res) => {
  try {
    const { user_phone, friend_phone, type } = req.body;
    await pool.query(
      `DELETE FROM friends WHERE user_phone=$1 AND friend_phone=$2 AND type=$3`,
      [user_phone, friend_phone, type]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: ДОКУМЕНТЫ
// ═══════════════════════════════════════════════════════
app.get('/api/docs', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM docs');
    const obj = {};
    r.rows.forEach(x => { obj[x.key] = x.content; });
    res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/docs', async (req, res) => {
  try {
    const { key, content } = req.body;
    await pool.query(
      `INSERT INTO docs (key, content) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET content=$2`,
      [key, content]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: КУРС
// ═══════════════════════════════════════════════════════
app.get('/api/rate', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM rate WHERE id=1');
    if (r.rows.length === 0) return res.json({ toRub: 10 });
    res.json({ toRub: parseFloat(r.rows[0].to_rub), updatedAt: r.rows[0].updated_at, updatedBy: r.rows[0].updated_by });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rate', async (req, res) => {
  try {
    const { toRub, updatedBy } = req.body;
    await pool.query(`UPDATE rate SET to_rub=$1, updated_at=NOW(), updated_by=$2 WHERE id=1`, [toRub, updatedBy]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// API: БАНК ПФ
// ═══════════════════════════════════════════════════════
app.get('/api/bank_pf', async (req, res) => {
  try {
    const r = await pool.query('SELECT amount FROM bank_pf WHERE id=1');
    res.json({ amount: parseInt(r.rows[0]?.amount || 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bank_pf', async (req, res) => {
  try {
    const { amount } = req.body;
    await pool.query('UPDATE bank_pf SET amount=$1 WHERE id=1', [amount]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('🚀 Сервер запущен на порту ' + PORT);
});