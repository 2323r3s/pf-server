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
    // users
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
        insurance_until TIMESTAMP,
        is_banned BOOLEAN DEFAULT false,
        ban_reason TEXT,
        ban_type TEXT,
        stamp_until TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_pension BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS insurance_until TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_type TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stamp_until TIMESTAMP`);

    // news
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL, text TEXT NOT NULL,
        urgent BOOLEAN DEFAULT false, pinned BOOLEAN DEFAULT false, edited BOOLEAN DEFAULT false,
        author TEXT NOT NULL, author_status TEXT NOT NULL, author_avatar TEXT, date TEXT NOT NULL
      )
    `);

    // bank
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank (
        phone TEXT PRIMARY KEY,
        deposit INTEGER DEFAULT 0, frozen BOOLEAN DEFAULT false, frozen_at BIGINT
      )
    `);
    await pool.query(`ALTER TABLE bank ADD COLUMN IF NOT EXISTS last_interest_at TIMESTAMP`);
    await pool.query(`ALTER TABLE bank ADD COLUMN IF NOT EXISTS total_interest INTEGER DEFAULT 0`);

    // interest_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interest_history (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        amount INTEGER NOT NULL,
        deposit INTEGER NOT NULL,
        date TEXT NOT NULL
      )
    `);

    // fines
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fines (
        id BIGINT PRIMARY KEY, phone TEXT NOT NULL, reason TEXT NOT NULL, amount INTEGER NOT NULL,
        from_phone TEXT, from_name TEXT, date TEXT NOT NULL, paid BOOLEAN DEFAULT false, paid_at TIMESTAMP
      )
    `);

    // friends
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        user_phone TEXT NOT NULL, friend_phone TEXT NOT NULL, type TEXT NOT NULL,
        PRIMARY KEY (user_phone, friend_phone, type)
      )
    `);

    // messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT PRIMARY KEY, from_phone TEXT NOT NULL, from_name TEXT NOT NULL,
        from_avatar TEXT, from_status TEXT, text TEXT NOT NULL, time TEXT NOT NULL, date TEXT
      )
    `);

    // private_messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id BIGINT PRIMARY KEY, chat_id TEXT NOT NULL, from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL, text TEXT NOT NULL, time TEXT NOT NULL
      )
    `);

    // docs
    await pool.query(`CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, content TEXT NOT NULL)`);

    // rate
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate (
        id INTEGER PRIMARY KEY DEFAULT 1,
        to_rub NUMERIC NOT NULL DEFAULT 10,
        updated_at TIMESTAMP DEFAULT NOW(), updated_by TEXT
      )
    `);
    await pool.query(`INSERT INTO rate (id, to_rub) VALUES (1, 10) ON CONFLICT (id) DO NOTHING`);

    // rate_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_history (
        id SERIAL PRIMARY KEY,
        rate NUMERIC NOT NULL,
        time TIMESTAMP DEFAULT NOW()
      )
    `);

    // rate_target
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_target (
        id INTEGER PRIMARY KEY DEFAULT 1,
        target NUMERIC, start_rate NUMERIC,
        started_at TIMESTAMP, deadline TIMESTAMP, created_by TEXT
      )
    `);

    // bank_pf
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank_pf (
        id INTEGER PRIMARY KEY DEFAULT 1, amount BIGINT NOT NULL DEFAULT 3124000000000
      )
    `);
    await pool.query(`INSERT INTO bank_pf (id, amount) VALUES (1, 3124000000000) ON CONFLICT (id) DO NOTHING`);

    // appeals
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

    // doc_requests
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

    // aura_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aura_history (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `);

    // salary_paid
    await pool.query(`
      CREATE TABLE IF NOT EXISTS salary_paid (
        phone TEXT PRIMARY KEY,
        last_paid TEXT NOT NULL
      )
    `);

    // elections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS elections (
        id INTEGER PRIMARY KEY DEFAULT 1,
        started_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        finished BOOLEAN DEFAULT false,
        winner_phone TEXT,
        winner_name TEXT
      )
    `);

    // election_candidates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS election_candidates (
        election_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        program TEXT,
        registered_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (election_id, phone)
      )
    `);

    // election_votes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS election_votes (
        election_id INTEGER NOT NULL,
        voter_phone TEXT NOT NULL,
        candidate_phone TEXT NOT NULL,
        voted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (election_id, voter_phone)
      )
    `);

    // casino_history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_history (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        bet INTEGER NOT NULL,
        win INTEGER NOT NULL,
        reels TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `);

    // casino_daily
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_daily (
        phone TEXT PRIMARY KEY,
        last_date TEXT NOT NULL,
        count INTEGER DEFAULT 0
      )
    `);

    // casino_permission
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_permission (
        phone TEXT PRIMARY KEY,
        granted_at TEXT NOT NULL,
        granted_by TEXT
      )
    `);

    // credit_requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_requests (
        id BIGINT PRIMARY KEY,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        months INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        pr_comment TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      )
    `);

    // credits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credits (
        id BIGINT PRIMARY KEY,
        user_phone TEXT NOT NULL,
        amount INTEGER NOT NULL,
        total_due INTEGER NOT NULL,
        paid INTEGER DEFAULT 0,
        reason TEXT NOT NULL,
        months INTEGER NOT NULL,
        due_date TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP
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
      `INSERT INTO users (phone, login, password, first_name, last_name, code, paradox, tripcode, status, aura, tonki, avatar, has_pension, has_insurance, insurance_until, is_banned, ban_reason, ban_type, stamp_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (phone) DO UPDATE SET
         login=$2, password=$3, first_name=$4, last_name=$5, code=$6,
         paradox=$7, tripcode=$8, status=$9, aura=$10, tonki=$11, avatar=$12,
         has_pension=$13, has_insurance=$14, insurance_until=$15,
         is_banned=$16, ban_reason=$17, ban_type=$18, stamp_until=$19`,
      [u.phone, u.login, u.password, u.firstName, u.lastName, u.code, u.paradox,
       u.tripcode, u.status, u.aura, u.tonki, u.avatar,
       u.hasPension || false, u.hasInsurance || false, u.insuranceUntil || null,
       u.isBanned || false, u.banReason || null, u.banType || null, u.stampUntil || null]
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
// ВЫСЕЛЕНИЕ / ШТАММ / ПРОЩЕНИЕ
// ═══════════════════════════════════════════════════════
app.post('/api/admin/ban', async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone || !reason) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `UPDATE users SET is_banned=true, ban_reason=$1, ban_type='permanent', stamp_until=NULL WHERE phone=$2`,
      [reason, phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/forgive_ban', async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone || !reason) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `UPDATE users SET is_banned=true, ban_reason=$1, ban_type='forgiving', stamp_until=NULL WHERE phone=$2`,
      [reason, phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/stamp', async (req, res) => {
  try {
    const { phone, reason, until } = req.body;
    if (!phone || !reason || !until) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `UPDATE users SET is_banned=false, ban_reason=$1, ban_type='stamp', stamp_until=$2 WHERE phone=$3`,
      [reason, until, phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/unstamp', async (req, res) => {
  try {
    const { phone } = req.body;
    await pool.query(
      `UPDATE users SET ban_reason=NULL, ban_type=NULL, stamp_until=NULL WHERE phone=$1`,
      [phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/pardon', async (req, res) => {
  try {
    const { phone } = req.body;
    await pool.query(
      `UPDATE users SET is_banned=false, ban_reason=NULL, ban_type=NULL, stamp_until=NULL WHERE phone=$1`,
      [phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/check_stamp/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE phone=$1', [req.params.phone]);
    if (r.rows.length === 0) return res.json({ active: false });
    const u = r.rows[0];
    if (u.ban_type !== 'stamp' || !u.stamp_until) return res.json({ active: false });
    const until = new Date(u.stamp_until).getTime();
    if (Date.now() >= until) {
      await pool.query(
        `UPDATE users SET ban_reason=NULL, ban_type=NULL, stamp_until=NULL WHERE phone=$1`,
        [req.params.phone]
      );
      return res.json({ active: false });
    }
    res.json({ active: true, until: u.stamp_until, reason: u.ban_reason });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// КРЕДИТЫ
// ═══════════════════════════════════════════════════════
app.get('/api/credit_requests', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM credit_requests ORDER BY id DESC');
    res.json(r.rows.map(x => ({
      id: x.id, userPhone: x.user_phone, userName: x.user_name,
      amount: x.amount, reason: x.reason, months: x.months,
      status: x.status, prComment: x.pr_comment,
      createdAt: x.created_at, resolvedAt: x.resolved_at, resolvedBy: x.resolved_by,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/credit_requests', async (req, res) => {
  try {
    const a = req.body;
    await pool.query(
      `INSERT INTO credit_requests (id, user_phone, user_name, amount, reason, months, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET status=$7, pr_comment=$9, resolved_at=$10, resolved_by=$11`,
      [a.id, a.userPhone, a.userName, a.amount, a.reason, a.months,
       a.status || 'pending', a.createdAt,
       a.prComment || null, a.resolvedAt || null, a.resolvedBy || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/credit_requests/:id/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedBy } = req.body;
    const reqRes = await pool.query('SELECT * FROM credit_requests WHERE id=$1', [req.params.id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const request = reqRes.rows[0];

    await pool.query(
      `UPDATE credit_requests SET status=$1, pr_comment=$2, resolved_at=$3, resolved_by=$4 WHERE id=$5`,
      [status, prComment || null, new Date().toISOString(), resolvedBy || null, req.params.id]
    );

    if (status === 'approved') {
      const userRes = await pool.query('SELECT * FROM users WHERE phone=$1', [request.user_phone]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [(u.tonki || 0) + request.amount, request.user_phone]);
      }
      const totalDue = Math.floor(request.amount * 1.1);
      const dueDate = new Date(Date.now() + request.months * 30 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO credits (id, user_phone, amount, total_due, reason, months, due_date, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',NOW())`,
        [Date.now(), request.user_phone, request.amount, totalDue, request.reason, request.months, dueDate.toISOString()]
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/credits/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM credits WHERE user_phone=$1 ORDER BY id DESC', [req.params.phone]);
    res.json(r.rows.map(c => ({
      id: c.id, userPhone: c.user_phone, amount: c.amount,
      totalDue: c.total_due, paid: c.paid,
      reason: c.reason, months: c.months,
      dueDate: c.due_date, status: c.status,
      createdAt: c.created_at, paidAt: c.paid_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/credits', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM credits ORDER BY id DESC');
    res.json(r.rows.map(c => ({
      id: c.id, userPhone: c.user_phone, amount: c.amount,
      totalDue: c.total_due, paid: c.paid,
      reason: c.reason, months: c.months,
      dueDate: c.due_date, status: c.status,
      createdAt: c.created_at, paidAt: c.paid_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/credits/:id/pay', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount || amount <= 0) return res.status(400).json({ error: 'Bad amount' });

    const creditRes = await pool.query('SELECT * FROM credits WHERE id=$1', [req.params.id]);
    if (creditRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const credit = creditRes.rows[0];

    if (credit.status !== 'active') return res.status(400).json({ error: 'Кредит уже закрыт' });
    if (credit.user_phone !== phone) return res.status(403).json({ error: 'Не твой кредит' });

    const userRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    if (user.tonki < amount) return res.status(400).json({ error: 'Недостаточно тонков' });

    const remaining = credit.total_due - (credit.paid || 0);
    const payAmount = Math.min(amount, remaining);
    const newPaid = (credit.paid || 0) + payAmount;
    const newStatus = newPaid >= credit.total_due ? 'paid' : 'active';

    await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [user.tonki - payAmount, phone]);
    await pool.query(
      `UPDATE credits SET paid=$1, status=$2, paid_at=$3 WHERE id=$4`,
      [newPaid, newStatus, newStatus === 'paid' ? new Date().toISOString() : null, credit.id]
    );

    const prRes = await pool.query('SELECT * FROM users WHERE status=$1 LIMIT 1', ['ПР']);
    if (prRes.rows.length > 0) {
      const pr = prRes.rows[0];
      await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [(pr.tonki || 0) + payAmount, pr.phone]);
    }

    res.json({ ok: true, paid: newPaid, remaining: credit.total_due - newPaid, closed: newStatus === 'paid' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// КАЗИНО
// ═══════════════════════════════════════════════════════
app.post('/api/casino/spin', async (req, res) => {
  try {
    const { phone, name, bet } = req.body;
    if (!phone || !bet || bet < 20 || bet > 1000) {
      return res.status(400).json({ error: 'Ставка 20-1000' });
    }

    const userRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const user = userRes.rows[0];
    const isPR = user.status === 'ПР';

    if (!isPR) {
      const permRes = await pool.query('SELECT * FROM casino_permission WHERE phone=$1', [phone]);
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'Нужно Разрешение на казик от ПР' });
      }

      const today = new Date().toISOString().slice(0, 10);
      const dailyRes = await pool.query('SELECT * FROM casino_daily WHERE phone=$1', [phone]);
      if (dailyRes.rows.length > 0) {
        const d = dailyRes.rows[0];
        if (d.last_date === today && d.count >= 10) {
          return res.status(403).json({ error: 'Лимит 10 игр в день исчерпан' });
        }
      }
    }

    if (user.tonki < bet) {
      return res.status(400).json({ error: 'Недостаточно тонков', need: bet - user.tonki });
    }

    const symbols = ['🍎', '🍇', '🍑', '🍌'];
    const weights = [34, 33, 30, 3];
    const pickWeighted = () => {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      for (let i = 0; i < symbols.length; i++) {
        r -= weights[i];
        if (r <= 0) return symbols[i];
      }
      return symbols[symbols.length - 1];
    };

    const reels = [pickWeighted(), pickWeighted(), pickWeighted()];

    const appleCount = reels.filter(r => r === '🍎').length;
    const grapeCount = reels.filter(r => r === '🍇').length;
    const plumCount = reels.filter(r => r === '🍑').length;
    const bananaCount = reels.filter(r => r === '🍌').length;

    let winAmount = 0;
    let prizeType = 'lose';

    if (bananaCount === 3) { winAmount = Math.floor(bet * 16); prizeType = 'jackpot_banana'; }
    else if (bananaCount === 2) { winAmount = Math.floor(bet * 8); prizeType = 'double_banana'; }
    else if (bananaCount === 1) { winAmount = Math.floor(bet * 4); prizeType = 'banana'; }
    else if (appleCount === 3) { winAmount = Math.floor(bet * 2); prizeType = 'triple_apple'; }
    else if (grapeCount === 3) { winAmount = Math.floor(bet * 4); prizeType = 'triple_grape'; }
    else if (plumCount === 3) { winAmount = Math.floor(bet * 8); prizeType = 'triple_plum'; }
    else if (grapeCount === 2) { winAmount = Math.floor(bet * 3); prizeType = 'double_grape'; }
    else if (plumCount === 2) { winAmount = Math.floor(bet * 2); prizeType = 'double_plum'; }
    else if (appleCount === 2) { winAmount = Math.floor(bet * 1.5); prizeType = 'double_apple'; }
    else if (grapeCount === 1) { winAmount = Math.floor(bet * 1.6); prizeType = 'one_grape'; }
    else if (plumCount === 1) { winAmount = Math.floor(bet * 1.2); prizeType = 'one_plum'; }
    else { winAmount = 0; prizeType = 'lose'; }

    const newTonki = user.tonki - bet + winAmount;

    await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [newTonki, phone]);

    let gamesLeft = null;
    if (!isPR) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyRes = await pool.query('SELECT * FROM casino_daily WHERE phone=$1', [phone]);
      const prevCount = (dailyRes.rows[0]?.last_date === today) ? dailyRes.rows[0].count : 0;
      const newCount = prevCount + 1;
      await pool.query(
        `INSERT INTO casino_daily (phone, last_date, count) VALUES ($1, $2, $3)
         ON CONFLICT (phone) DO UPDATE SET last_date=$2, count=$3`,
        [phone, today, newCount]
      );
      gamesLeft = 10 - newCount;
    }

    await pool.query(
      `INSERT INTO casino_history (id, phone, name, bet, win, reels, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [Date.now(), phone, name || 'ЖИ', bet, winAmount, reels.join(''), new Date().toLocaleString('ru-RU')]
    );

    res.json({
      ok: true, reels, bet, winAmount,
      netWin: winAmount - bet, prizeType,
      newTonki, oldTonki: user.tonki,
      gamesLeft, isPR,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/casino/history/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM casino_history WHERE phone=$1 ORDER BY id DESC LIMIT 20', [req.params.phone]);
    res.json(r.rows.map(h => ({ id: h.id, bet: h.bet, win: h.win, reels: h.reels, date: h.date })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/casino/daily/:phone', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const daily = await pool.query('SELECT * FROM casino_daily WHERE phone=$1', [req.params.phone]);
    const perm = await pool.query('SELECT * FROM casino_permission WHERE phone=$1', [req.params.phone]);
    const count = (daily.rows[0]?.last_date === today) ? daily.rows[0].count : 0;
    res.json({ count, left: Math.max(0, 10 - count), hasPermission: perm.rows.length > 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/casino/permission', async (req, res) => {
  try {
    const { phone, grantedBy } = req.body;
    await pool.query(
      `INSERT INTO casino_permission (phone, granted_at, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone) DO UPDATE SET granted_at=$2, granted_by=$3`,
      [phone, new Date().toISOString(), grantedBy || 'ПР']
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/casino/permission/:phone', async (req, res) => {
  try {
    await pool.query('DELETE FROM casino_permission WHERE phone=$1', [req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/casino/permissions', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM casino_permission');
    res.json(r.rows.map(x => ({ phone: x.phone, grantedAt: x.granted_at, grantedBy: x.granted_by })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ВЫБОРЫ
// ═══════════════════════════════════════════════════════
app.get('/api/elections/current', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM elections WHERE id=1');
    if (r.rows.length === 0) return res.json(null);
    const e = r.rows[0];
    const candidates = await pool.query('SELECT * FROM election_candidates WHERE election_id=$1 ORDER BY registered_at ASC', [e.id]);
    const votes = await pool.query('SELECT candidate_phone, COUNT(*) AS cnt FROM election_votes WHERE election_id=$1 GROUP BY candidate_phone', [e.id]);
    const voteCounts = {};
    votes.rows.forEach(v => { voteCounts[v.candidate_phone] = parseInt(v.cnt); });
    res.json({
      id: e.id, startedAt: e.started_at, endsAt: e.ends_at, finished: e.finished,
      winnerPhone: e.winner_phone, winnerName: e.winner_name,
      candidates: candidates.rows.map(c => ({ phone: c.phone, name: c.name, program: c.program, votes: voteCounts[c.phone] || 0 })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/elections/create', async (req, res) => {
  try {
    const { startedAt, endsAt } = req.body;
    await pool.query('DELETE FROM election_candidates WHERE election_id=1');
    await pool.query('DELETE FROM election_votes WHERE election_id=1');
    await pool.query('DELETE FROM elections WHERE id=1');
    await pool.query(`INSERT INTO elections (id, started_at, ends_at, finished) VALUES (1, $1, $2, false)`, [startedAt, endsAt]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/elections/register', async (req, res) => {
  try {
    const { phone, name, program } = req.body;
    await pool.query(
      `INSERT INTO election_candidates (election_id, phone, name, program)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (election_id, phone) DO UPDATE SET program=$3`,
      [phone, name, program]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/elections/candidates/:phone', async (req, res) => {
  try {
    await pool.query('DELETE FROM election_candidates WHERE election_id=1 AND phone=$1', [req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/elections/vote', async (req, res) => {
  try {
    const { voterPhone, candidatePhone } = req.body;
    await pool.query(
      `INSERT INTO election_votes (election_id, voter_phone, candidate_phone)
       VALUES (1, $1, $2)
       ON CONFLICT (election_id, voter_phone) DO UPDATE SET candidate_phone=$2, voted_at=NOW()`,
      [voterPhone, candidatePhone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/elections/my_vote/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT candidate_phone FROM election_votes WHERE election_id=1 AND voter_phone=$1', [req.params.phone]);
    res.json({ candidatePhone: r.rows[0]?.candidate_phone || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/elections/finish', async (req, res) => {
  try {
    const cands = await pool.query(`
      SELECT c.phone, c.name, COALESCE(COUNT(v.voter_phone), 0) AS votes
      FROM election_candidates c
      LEFT JOIN election_votes v ON v.candidate_phone = c.phone AND v.election_id = 1
      WHERE c.election_id = 1
      GROUP BY c.phone, c.name
      ORDER BY votes DESC, c.phone ASC
    `);
    if (cands.rows.length === 0) return res.status(400).json({ error: 'No candidates' });
    const winner = cands.rows[0];
    const winnerPhone = winner.phone;
    const winnerName = winner.name;
    await pool.query('UPDATE users SET status=$1 WHERE phone=$2', ['ПВ', winnerPhone]);
    await pool.query('UPDATE users SET status=$1 WHERE status=$2 AND phone<>$3', ['ЖИ', 'ПВ', winnerPhone]);
    await pool.query('UPDATE users SET tonki = tonki + 100 WHERE phone=$1', [winnerPhone]);
    await pool.query('UPDATE elections SET finished=true, winner_phone=$1, winner_name=$2 WHERE id=1', [winnerPhone, winnerName]);
    res.json({ ok: true, winnerPhone, winnerName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/elections', async (req, res) => {
  try {
    await pool.query('DELETE FROM election_votes WHERE election_id=1');
    await pool.query('DELETE FROM election_candidates WHERE election_id=1');
    await pool.query('DELETE FROM elections WHERE id=1');
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
    r.rows.forEach(x => {
      obj[x.phone] = {
        deposit: x.deposit, frozen: x.frozen, frozenAt: x.frozen_at,
        lastInterestAt: x.last_interest_at, totalInterest: x.total_interest || 0,
      };
    });
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

app.post('/api/bank/:phone/accrue', async (req, res) => {
  try {
    const phone = req.params.phone;
    const bankRes = await pool.query('SELECT * FROM bank WHERE phone=$1', [phone]);
    if (bankRes.rows.length === 0) return res.json({ accrued: 0 });

    const acc = bankRes.rows[0];
    if (!acc.deposit || acc.deposit < 30) return res.json({ accrued: 0 });
    if (acc.frozen) return res.json({ accrued: 0 });

    const now = Date.now();
    const lastAt = acc.last_interest_at ? new Date(acc.last_interest_at).getTime() : (acc.frozen_at || now);
    const daysPassed = (now - lastAt) / (24 * 60 * 60 * 1000);
    if (daysPassed < 1) return res.json({ accrued: 0 });

    const interest = Math.floor(acc.deposit * (0.3 / 365) * daysPassed);
    if (interest <= 0) return res.json({ accrued: 0 });

    const newDeposit = acc.deposit + interest;
    const newTotal = (acc.total_interest || 0) + interest;

    await pool.query(
      `UPDATE bank SET deposit=$1, last_interest_at=NOW(), total_interest=$2 WHERE phone=$3`,
      [newDeposit, newTotal, phone]
    );
    await pool.query(
      `INSERT INTO interest_history (id, phone, amount, deposit, date)
       VALUES ($1,$2,$3,$4,$5)`,
      [Date.now(), phone, interest, acc.deposit, new Date().toLocaleString('ru-RU')]
    );

    res.json({ accrued: interest, newDeposit, daysPassed: Math.floor(daysPassed) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/interest_history/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM interest_history WHERE phone=$1 ORDER BY id DESC LIMIT 20', [req.params.phone]);
    res.json(r.rows.map(h => ({ id: h.id, amount: h.amount, deposit: h.deposit, date: h.date })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ОБЩИЙ ЧАТ
// ═══════════════════════════════════════════════════════
app.get('/api/messages', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM messages ORDER BY id ASC LIMIT 200');
    res.json(r.rows.map(m => ({
      id: m.id, from: m.from_phone, fromName: m.from_name,
      fromAvatar: m.from_avatar, fromStatus: m.from_status,
      text: m.text, time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.from, m.fromName, m.fromAvatar, m.fromStatus, m.text || '', m.time, m.date]
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
    res.json(r.rows.map(m => ({
      id: m.id, from: m.from_phone, fromName: m.from_name,
      text: m.text, time: m.time,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/private', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO private_messages (id, chat_id, from_phone, from_name, text, time)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.chatId, m.from, m.fromName, m.text || '', m.time]
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
    res.json(r.rows.map(a => ({ id: a.id, userPhone: a.user_phone, userName: a.user_name, docType: a.doc_type, status: a.status, prComment: a.pr_comment, createdAt: a.created_at, resolvedAt: a.resolved_at, resolvedBy: a.resolved_by })));
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
        await pool.query('UPDATE users SET has_insurance=true, insurance_until=$1 WHERE phone=$2', [until, request.user_phone]);
      } else if (request.doc_type === 'casino_permit') {
        await pool.query(
          `INSERT INTO casino_permission (phone, granted_at, granted_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (phone) DO UPDATE SET granted_at=$2, granted_by=$3`,
          [request.user_phone, new Date().toISOString(), resolvedBy || 'ПР']
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