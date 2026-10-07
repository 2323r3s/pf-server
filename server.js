require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════
// ПОДКЛЮЧЕНИЕ
// ═══════════════════════════════════════════════════════
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL подключён'))
  .catch(err => console.error('❌ PostgreSQL ошибка:', err.stack || err.message));

// ═══════════════════════════════════════════════════════
// ТАБЛИЦЫ
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
        code TEXT, paradox TEXT, tripcode TEXT,
        status TEXT DEFAULT 'ЖИ',
        aura INTEGER DEFAULT 100,
        tonki INTEGER DEFAULT 10,
        avatar TEXT,
        registered_at TIMESTAMP DEFAULT NOW(),
        login_changed_at TIMESTAMP,
        has_pension BOOLEAN DEFAULT false,
        has_insurance BOOLEAN DEFAULT false,
        insurance_until TIMESTAMP
      )
    `);

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_pension BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS insurance_until TIMESTAMP`);

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

    await pool.query(`CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, content TEXT NOT NULL)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate (
        id INTEGER PRIMARY KEY DEFAULT 1,
        to_rub NUMERIC NOT NULL DEFAULT 10,
        updated_at TIMESTAMP DEFAULT NOW(), updated_by TEXT
      )
    `);
    await pool.query(`INSERT INTO rate (id, to_rub) VALUES (1, 10) ON CONFLICT (id) DO NOTHING`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_history (
        id SERIAL PRIMARY KEY,
        rate NUMERIC NOT NULL,
        time TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_target (
        id INTEGER PRIMARY KEY DEFAULT 1,
        target NUMERIC, start_rate NUMERIC,
        started_at TIMESTAMP, deadline TIMESTAMP, created_by TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank_pf (
        id INTEGER PRIMARY KEY DEFAULT 1, amount BIGINT NOT NULL DEFAULT 3124000000000
      )
    `);
    await pool.query(`INSERT INTO bank_pf (id, amount) VALUES (1, 3124000000000) ON CONFLICT (id) DO NOTHING`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS appeals (
        id BIGINT PRIMARY KEY,
        fine_id BIGINT NOT NULL,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        pr_comment TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS doc_requests (
        id BIGINT PRIMARY KEY,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        pr_comment TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aura_history (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `);

    // Зарплаты — когда кто получил
    await pool.query(`
      CREATE TABLE IF NOT EXISTS salary_paid (
        phone TEXT PRIMARY KEY,
        last_paid TEXT NOT NULL
      )
    `);

    console.log('✅ Таблицы готовы');
  } catch (err) {
    console.error('❌ Ошибка таблиц:', err.stack || err.message);
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
// ПОЛЬЗОВАТЕЛИ
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
      `INSERT INTO users (phone, login, password, first_name, last_name, code, paradox, tripcode, status, aura, tonki, avatar, has_pension, has_insurance, insurance_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (phone) DO UPDATE SET
         login=$2, password=$3, first_name=$4, last_name=$5, code=$6,
         paradox=$7, tripcode=$8, status=$9, aura=$10, tonki=$11, avatar=$12,
         has_pension=$13, has_insurance=$14, insurance_until=$15`,
      [u.phone, u.login, u.password, u.firstName, u.lastName, u.code, u.paradox,
       u.tripcode, u.status, u.aura, u.tonki, u.avatar,
       u.hasPension || false, u.hasInsurance || false, u.insuranceUntil || null]
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
// ЗАРПЛАТЫ
// ═══════════════════════════════════════════════════════
app.get('/api/salary_paid/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT last_paid FROM salary_paid WHERE phone=$1', [req.params.phone]);
    res.json({ lastPaid: r.rows[0]?.last_paid || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salary_paid', async (req, res) => {
  try {
    const { phone, lastPaid } = req.body;
    await pool.query(
      `INSERT INTO salary_paid (phone, last_paid) VALUES ($1,$2)
       ON CONFLICT (phone) DO UPDATE SET last_paid=$2`,
      [phone, lastPaid]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ИСТОРИЯ АУРЫ
// ═══════════════════════════════════════════════════════
app.get('/api/aura_history/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM aura_history WHERE phone=$1 ORDER BY id DESC LIMIT 100', [req.params.phone]);
    res.json(r.rows.map(h => ({ id: h.id, phone: h.phone, delta: h.delta, reason: h.reason, date: h.date })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/aura_history', async (req, res) => {
  try {
    const h = req.body;
    await pool.query(
      `INSERT INTO aura_history (id, phone, delta, reason, date)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [h.id, h.phone, h.delta, h.reason, h.date]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// НОВОСТИ
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
// БАНК
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
// ОБЩИЙ ЧАТ
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
// ЛИЧНЫЕ
// ═══════════════════════════════════════════════════════
app.get('/api/private/:chatId', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM private_messages WHERE chat_id=$1 ORDER BY id ASC', [req.params.chatId]);
    res.json(r.rows.map(m => ({ id: m.id, from: m.from_phone, fromName: m.from_name, text: m.text, time: m.time })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/private', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO private_messages (id, chat_id, from_phone, from_name, text, time)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.chatId, m.from, m.fromName, m.text, m.time]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ШТРАФЫ
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

app.delete('/api/fines/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fines WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ДРУЗЬЯ
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
// ДОКУМЕНТЫ
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
// КУРС
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
    await pool.query(`INSERT INTO rate_history (rate) VALUES ($1)`, [toRub]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rate_history', async (req, res) => {
  try {
    const r = await pool.query('SELECT rate, time FROM rate_history ORDER BY id ASC LIMIT 200');
    res.json(r.rows.map(x => ({ rate: parseFloat(x.rate), time: x.time })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rate_target', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM rate_target WHERE id=1');
    if (r.rows.length === 0) return res.json(null);
    const t = r.rows[0];
    if (!t.target || !t.deadline) return res.json(null);
    res.json({ target: parseFloat(t.target), startRate: parseFloat(t.start_rate), startedAt: t.started_at, deadline: t.deadline, createdBy: t.created_by });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rate_target', async (req, res) => {
  try {
    const t = req.body;
    if (!t || !t.target) {
      await pool.query('DELETE FROM rate_target WHERE id=1');
      return res.json({ ok: true });
    }
    await pool.query(
      `INSERT INTO rate_target (id, target, start_rate, started_at, deadline, created_by)
       VALUES (1, $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET target=$1, start_rate=$2, started_at=$3, deadline=$4, created_by=$5`,
      [t.target, t.startRate, t.startedAt, t.deadline, t.createdBy]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// БАНК ПФ
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
// АПЕЛЛЯЦИИ
// ═══════════════════════════════════════════════════════
app.get('/api/appeals', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM appeals ORDER BY id DESC');
    res.json(r.rows.map(a => ({ id: a.id, fineId: a.fine_id, userPhone: a.user_phone, userName: a.user_name, reason: a.reason, status: a.status, prComment: a.pr_comment, createdAt: a.created_at, resolvedAt: a.resolved_at, resolvedBy: a.resolved_by })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appeals', async (req, res) => {
  try {
    const a = req.body;
    await pool.query(
      `INSERT INTO appeals (id, fine_id, user_phone, user_name, reason, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET status=$6, pr_comment=$8, resolved_at=$9, resolved_by=$10`,
      [a.id, a.fineId, a.userPhone, a.userName, a.reason, a.status || 'pending', a.createdAt, a.prComment || null, a.resolvedAt || null, a.resolvedBy || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/appeals/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM appeals WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appeals/:id/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedBy } = req.body;
    const appealRes = await pool.query('SELECT * FROM appeals WHERE id=$1', [req.params.id]);
    if (appealRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const appeal = appealRes.rows[0];

    await pool.query(
      `UPDATE appeals SET status=$1, pr_comment=$2, resolved_at=$3, resolved_by=$4 WHERE id=$5`,
      [status, prComment || null, new Date().toISOString(), resolvedBy || null, req.params.id]
    );

    if (status === 'approved') {
      await pool.query('DELETE FROM fines WHERE id=$1', [appeal.fine_id]);
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ЗАЯВКИ НА ДОКУМЕНТЫ
// ═══════════════════════════════════════════════════════
app.get('/api/doc_requests', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM doc_requests ORDER BY id DESC');
    res.json(r.rows.map(a => ({
      id: a.id,
      userPhone: a.user_phone,
      userName: a.user_name,
      docType: a.doc_type,
      status: a.status,
      prComment: a.pr_comment,
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
      resolvedBy: a.resolved_by,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/doc_requests', async (req, res) => {
  try {
    const a = req.body;
    await pool.query(
      `INSERT INTO doc_requests (id, user_phone, user_name, doc_type, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET status=$5, pr_comment=$7, resolved_at=$8, resolved_by=$9`,
      [a.id, a.userPhone, a.userName, a.docType, a.status || 'pending', a.createdAt,
       a.prComment || null, a.resolvedAt || null, a.resolvedBy || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/doc_requests/:id/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedBy } = req.body;
    const reqRes = await pool.query('SELECT * FROM doc_requests WHERE id=$1', [req.params.id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const request = reqRes.rows[0];

    await pool.query(
      `UPDATE doc_requests SET status=$1, pr_comment=$2, resolved_at=$3, resolved_by=$4 WHERE id=$5`,
      [status, prComment || null, new Date().toISOString(), resolvedBy || null, req.params.id]
    );

    if (status === 'approved') {
      if (request.doc_type === 'pension') {
        await pool.query('UPDATE users SET has_pension=true WHERE phone=$1', [request.user_phone]);
      } else if (request.doc_type === 'insurance') {
        const until = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        await pool.query(
          'UPDATE users SET has_insurance=true, insurance_until=$1 WHERE phone=$2',
          [until, request.user_phone]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// АВТО-КУРС
// ═══════════════════════════════════════════════════════
const tickRate = async () => {
  try {
    const targetRes = await pool.query('SELECT * FROM rate_target WHERE id=1');
    if (targetRes.rows.length === 0) return;
    const t = targetRes.rows[0];
    if (!t.target || !t.deadline) return;

    const rateRes = await pool.query('SELECT to_rub FROM rate WHERE id=1');
    const currentRate = parseFloat(rateRes.rows[0]?.to_rub || 10);
    const startTime = new Date(t.started_at).getTime();
    const endTime = new Date(t.deadline).getTime();
    const now = Date.now();

    if (now >= endTime) {
      if (Math.abs(currentRate - parseFloat(t.target)) > 0.001) {
        await pool.query('UPDATE rate SET to_rub=$1, updated_at=NOW(), updated_by=$2 WHERE id=1', [t.target, 'auto']);
        await pool.query('INSERT INTO rate_history (rate) VALUES ($1)', [t.target]);
      }
      await pool.query('DELETE FROM rate_target WHERE id=1');
      return;
    }

    const total = endTime - startTime;
    const elapsed = now - startTime;
    const progress = Math.min(1, Math.max(0, elapsed / total));
    const expectedRate = parseFloat(t.start_rate) + (parseFloat(t.target) - parseFloat(t.start_rate)) * progress;
    const rounded = Math.round(expectedRate * 100) / 100;

    if (Math.abs(rounded - currentRate) > 0.01) {
      await pool.query('UPDATE rate SET to_rub=$1, updated_at=NOW(), updated_by=$2 WHERE id=1', [rounded, 'auto']);
      await pool.query('INSERT INTO rate_history (rate) VALUES ($1)', [rounded]);
    }
  } catch (err) { console.error('tickRate:', err.message); }
};

setInterval(tickRate, 30 * 1000);
setTimeout(tickRate, 5000);

// ═══════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('🚀 Сервер запущен на порту ' + PORT);
});