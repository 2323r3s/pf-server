require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Увеличено для фото/видео

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                    // 5 подключений на один экземпляр Vercel
  idleTimeoutMillis: 5000,   // Закрывать простаивающие соединения через 5 секунд
  connectionTimeoutMillis: 5000,
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL подключён'))
  .catch(err => console.error('❌ PostgreSQL ошибка:', err.stack || err.message));

// ═══════════════════════════════════════════════════════
// FIREBASE ADMIN
// ═══════════════════════════════════════════════════════
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin инициализирован');
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT не задан — push не работает');
  }
} catch (err) {
  console.error('❌ Firebase init:', err.message);
}

// ═══════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ БД
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
        insurance_until TIMESTAMP,
        is_banned BOOLEAN DEFAULT false,
        ban_reason TEXT,
        ban_type TEXT,
        stamp_until TIMESTAMP,
        has_created_party BOOLEAN DEFAULT false
      )
    `);

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_pension BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS insurance_until TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_type TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stamp_until TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_created_party BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_tax_paid_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_okpf_day_year INTEGER`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pf_day_year INTEGER`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_vacation_year INTEGER`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_burmaldeem_month TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pension_started_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS top1_streak INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_top1_check TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_rich_reward BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pensioner_reward BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_inactive_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_tax_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_idle_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_credit_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_auto_debtor_at TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_aura_applied BOOLEAN DEFAULT false`);

    // ── ИГРА IDLE ──
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS game_rubles NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS game_generators JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS game_meta_aura NUMERIC DEFAULT 0`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS idle_pending_rubles (
        phone TEXT PRIMARY KEY,
        amount BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
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
    await pool.query(`ALTER TABLE bank ADD COLUMN IF NOT EXISTS last_interest_at TIMESTAMP`);
    await pool.query(`ALTER TABLE bank ADD COLUMN IF NOT EXISTS total_interest INTEGER DEFAULT 0`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS interest_history (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        amount INTEGER NOT NULL,
        deposit INTEGER NOT NULL,
        date TEXT NOT NULL
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
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image TEXT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS video TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id BIGINT PRIMARY KEY, chat_id TEXT NOT NULL, from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL, text TEXT NOT NULL, time TEXT NOT NULL
      )
    `);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS date TEXT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS image TEXT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS video TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id BIGINT PRIMARY KEY,
        group_id BIGINT NOT NULL,
        from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL,
        from_avatar TEXT,
        text TEXT NOT NULL,
        reply_to BIGINT,
        time TEXT NOT NULL,
        date TEXT
      )
    `);
    await pool.query(`ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);
    await pool.query(`ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS image TEXT`);
    await pool.query(`ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS video TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_messages (
        id BIGINT PRIMARY KEY, party_id BIGINT NOT NULL, from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL, text TEXT NOT NULL, time TEXT NOT NULL
      )
    `);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS from_avatar TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS date TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS image TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS video TEXT`);

    await pool.query(`CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, content TEXT NOT NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS chronicle (id INTEGER PRIMARY KEY DEFAULT 1, content TEXT)`);
    
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salary_paid (
        phone TEXT PRIMARY KEY,
        last_paid TEXT NOT NULL
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS election_votes (
        election_id INTEGER NOT NULL,
        voter_phone TEXT NOT NULL,
        candidate_phone TEXT NOT NULL,
        voted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (election_id, voter_phone)
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_daily (
        phone TEXT PRIMARY KEY,
        last_date TEXT NOT NULL,
        count INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_permission (
        phone TEXT PRIMARY KEY,
        granted_at TEXT NOT NULL,
        granted_by TEXT
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS professions (
        phone TEXT NOT NULL,
        profession TEXT NOT NULL,
        hired_at TIMESTAMP DEFAULT NOW(),
        hired_by TEXT,
        last_paid_at TIMESTAMP,
        PRIMARY KEY (phone, profession)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profession_requests (
        id BIGINT PRIMARY KEY,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        profession TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        pr_comment TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profession_salary_paid (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        profession TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paid_by TEXT,
        paid_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS parties (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        leader_phone TEXT NOT NULL,
        leader_name TEXT NOT NULL,
        avatar TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_members (
        party_id BIGINT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (party_id, phone)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_requests (
        id BIGINT PRIMARY KEY,
        party_id BIGINT NOT NULL,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_candidates (
        party_id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS party_wins (
        party_id BIGINT PRIMARY KEY,
        wins INTEGER DEFAULT 0,
        last_win_at TIMESTAMP,
        reward_granted BOOLEAN DEFAULT false
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id BIGINT PRIMARY KEY,
        user_phone TEXT NOT NULL,
        user_name TEXT NOT NULL,
        login TEXT NOT NULL,
        phone TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id BIGINT PRIMARY KEY,
        debtor_phone TEXT NOT NULL,
        debtor_name TEXT NOT NULL,
        creditor_phone TEXT NOT NULL,
        creditor_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        due_date TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        created_by TEXT
      )
    `);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS is_government BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_status TEXT`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_reason TEXT`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_pr_comment TEXT`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_created_at TEXT`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_resolved_at TEXT`);
    await pool.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS appeal_resolved_by TEXT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        granted_at TIMESTAMP DEFAULT NOW(),
        granted_by TEXT,
        UNIQUE (phone, achievement_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id BIGINT PRIMARY KEY,
        message_id BIGINT NOT NULL,
        chat_type TEXT NOT NULL,
        chat_id TEXT,
        from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reactions_msg ON message_reactions (message_id, chat_type)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_chats (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        creator_phone TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id BIGINT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (group_id, phone)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_settings (
        phone TEXT NOT NULL,
        chat_type TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        cleared_at TIMESTAMP,
        deleted BOOLEAN DEFAULT false,
        blocked BOOLEAN DEFAULT false,
        last_read_id BIGINT DEFAULT 0,
        PRIMARY KEY (phone, chat_type, chat_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT PRIMARY KEY,
        phone TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT,
        target TEXT,
        target_id TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_phone ON notifications (phone, created_at DESC)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        phone TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Таблицы готовы');
  } catch (err) {
    console.error('❌ Ошибка таблиц:', err.stack || err.message);
  }
};

initDB();

app.get('/', (req, res) => {
  res.send('🏚️ Подвальная Федерация — сервер работает!');
});

// ═══════════════════════════════════════════════════════
// ОТПРАВКА PUSH
// ═══════════════════════════════════════════════════════
const sendPushNotification = async (phone, title, body, target, targetId) => {
  try {
    if (!admin || !admin.messaging) return;

    const tokenRes = await pool.query('SELECT token FROM fcm_tokens WHERE phone=$1', [phone]);
    if (tokenRes.rows.length === 0) return;
    const token = tokenRes.rows[0].token;

    const message = {
      token,
      notification: { title, body: body || '' },
      data: {
        target: target || '',
        targetId: String(targetId || ''),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'pf_default',
        },
      },
    };

    console.log(`📤 [PUSH] Отправка на ${phone}: ${title}`);
    await admin.messaging().send(message);
    console.log(`✅ [PUSH] Успешно отправлено!`);
  } catch (err) {
    console.error(`❌ [PUSH] Ошибка отправки:`, err.message);
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      await pool.query('DELETE FROM fcm_tokens WHERE phone=$1', [phone]);
    }
  }
};

// ═══════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ (помощник)
// ═══════════════════════════════════════════════════════
const createNotification = async (phone, type, title, text, target, targetId) => {
  try {
    if (!phone) return;
    await pool.query(
      `INSERT INTO notifications (id, phone, type, title, text, target, target_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [Date.now() + Math.floor(Math.random() * 1000), phone, type, title, text || null, target || null, targetId || null]
    );
    await sendPushNotification(phone, title, text || '', target, targetId);
  } catch (err) {
    console.error('createNotification:', err.message);
  }
};

// ═══════════════════════════════════════════════════════
// FCM ТОКЕНЫ И HEARTBEAT
// ═══════════════════════════════════════════════════════
app.post('/api/fcm/register', async (req, res) => {
  try {
    const { phone, token } = req.body;
    if (!phone || !token) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `INSERT INTO fcm_tokens (phone, token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (phone) DO UPDATE SET token=$2, updated_at=NOW()`,
      [phone, token]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fcm/unregister', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Bad params' });
    await pool.query('DELETE FROM fcm_tokens WHERE phone=$1', [phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/heartbeat', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Bad params' });
    await pool.query('UPDATE users SET last_seen_at=NOW() WHERE phone=$1', [phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/tax_paid', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Bad params' });
    await pool.query('UPDATE users SET last_tax_paid_at=NOW() WHERE phone=$1', [phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

    if (u.status === 'ПР') {
      u.tonki = 10000;
    }

    let demoted = false;
    if (u.status === 'ПМ' && (u.aura || 0) < 9800) {
      u.status = 'ЖИ';
      demoted = true;
    }

    if (u.status === 'ЗМ') {
      const currentRes = await pool.query(
        'SELECT status FROM users WHERE phone=$1',
        [u.phone]
      );
      const wasZM = currentRes.rows[0]?.status === 'ЗМ';
      if (!wasZM) {
        const cntRes = await pool.query("SELECT COUNT(*) FROM users WHERE status='ЗМ'");
        if (parseInt(cntRes.rows[0].count) >= 2) {
          return res.status(400).json({ error: 'Максимум 2 ЗМ в подвале (п. 1.3)' });
        }
      }
    }

    await pool.query(
      `INSERT INTO users (phone, login, password, first_name, last_name, code, paradox, tripcode, status, aura, tonki, avatar, has_pension, has_insurance, insurance_until, is_banned, ban_reason, ban_type, stamp_until, has_created_party, bio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (phone) DO UPDATE SET
         login=$2, password=$3, first_name=$4, last_name=$5, code=$6,
         paradox=$7, tripcode=$8, status=$9, aura=$10, tonki=$11, avatar=$12,
         has_pension=$13, has_insurance=$14, insurance_until=$15,
         is_banned=$16, ban_reason=$17, ban_type=$18, stamp_until=$19,
         has_created_party=$20, bio=$21`,
      [u.phone, u.login, u.password, u.firstName, u.lastName, u.code, u.paradox,
       u.tripcode, u.status, u.aura, u.tonki, u.avatar,
       u.hasPension || false, u.hasInsurance || false, u.insuranceUntil || null,
       u.isBanned || false, u.banReason || null, u.banType || null, u.stampUntil || null,
       u.hasCreatedParty || false, u.bio || null]
    );

    if (demoted) {
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [Date.now() + Math.floor(Math.random() * 1000), u.phone, 0,
         '⚠️ Понижение ПМ → ЖИ (аура упала ниже 9800, п. 2.5)',
         new Date().toLocaleString('ru-RU')]
      );
    }

    res.json({ ok: true, demoted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/bonus_aura', async (req, res) => {
  try {
    const { phone, delta, reason } = req.body;
    if (!phone || !delta) return res.status(400).json({ error: 'Bad params' });

    const uRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = uRes.rows[0];

    if (u.status === 'ПР') return res.status(400).json({ error: 'ПР не получает ауру' });

    const newAura = (u.aura || 0) + delta;
    await pool.query('UPDATE users SET aura=$1 WHERE phone=$2', [newAura, phone]);

    let finalStatus = u.status;
    let demoted = false;
    if (u.status === 'ПМ' && newAura < 9800) {
      finalStatus = 'ЖИ';
      demoted = true;
      await pool.query('UPDATE users SET status=$1 WHERE phone=$2', ['ЖИ', phone]);
    }

    await pool.query(
      `INSERT INTO aura_history (id, phone, delta, reason, date)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [Date.now() + Math.floor(Math.random() * 1000), phone, delta,
       reason || 'Награда', new Date().toLocaleString('ru-RU')]
    );

    res.json({ ok: true, newAura, status: finalStatus, demoted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/gift_reward', async (req, res) => {
  try {
    const { phone, giverName } = req.body;
    if (!phone) return res.status(400).json({ error: 'Bad params' });

    const uRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = uRes.rows[0];

    if (u.status === 'ПР') return res.status(400).json({ error: 'ПР не получает ауру' });

    const newAura = (u.aura || 0) + 1000;
    await pool.query('UPDATE users SET aura=$1 WHERE phone=$2', [newAura, phone]);

    await pool.query(
      `INSERT INTO aura_history (id, phone, delta, reason, date)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [Date.now() + Math.floor(Math.random() * 1000), phone, 1000,
       `🎁 Подарки (п. 5.10) — хороший подарок ПР (${giverName || 'ПР'})`,
       new Date().toLocaleString('ru-RU')]
    );

    res.json({ ok: true, newAura });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:phone', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE phone=$1', [req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// СБРОС ПАРОЛЯ
// ═══════════════════════════════════════════════════════
app.post('/api/password_reset/verify', async (req, res) => {
  try {
    const { login, phone } = req.body;
    if (!login || !phone) return res.status(400).json({ error: 'Введи логин и телефон' });

    const cleanLogin = login.trim().toLowerCase();
    const cleanPhone = phone.trim();

    const r = await pool.query(
      'SELECT phone, login, first_name, last_name FROM users WHERE LOWER(login)=$1 AND phone=$2',
      [cleanLogin, cleanPhone]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Логин и телефон не совпадают' });
    }

    const u = r.rows[0];
    res.json({
      ok: true,
      userPhone: u.phone,
      userName: `${u.first_name} ${u.last_name}`,
      login: u.login,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/password_reset/commit', async (req, res) => {
  try {
    const { login, phone, newPassword } = req.body;
    if (!login || !phone || !newPassword) {
      return res.status(400).json({ error: 'Заполни все поля' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const cleanPhone = phone.trim();

    const r = await pool.query(
      'SELECT * FROM users WHERE LOWER(login)=$1 AND phone=$2',
      [cleanLogin, cleanPhone]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Логин и телефон не совпадают' });
    }

    const u = r.rows[0];

    await pool.query('UPDATE users SET password=$1 WHERE phone=$2', [newPassword, u.phone]);

    await pool.query(
      `INSERT INTO password_resets (id, user_phone, user_name, login, phone, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [Date.now(), u.phone, `${u.first_name} ${u.last_name}`, u.login, u.phone, new Date().toLocaleString('ru-RU')]
    );

    res.json({ ok: true, userPhone: u.phone, userName: `${u.first_name} ${u.last_name}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/password_resets', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM password_resets ORDER BY id DESC LIMIT 100');
    res.json(r.rows.map(x => ({
      id: x.id, userPhone: x.user_phone, userName: x.user_name,
      login: x.login, phone: x.phone, date: x.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ВЫСЕЛЕНИЕ / ШТАММ
// ═══════════════════════════════════════════════════════
app.post('/api/admin/ban', async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone || !reason) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `UPDATE users SET is_banned=true, ban_reason=$1, ban_type='permanent', stamp_until=NULL WHERE phone=$2`,
      [reason, phone]
    );
    await createNotification(phone, 'system', '🚫 Вы выселены', reason, null, null);
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
    await createNotification(phone, 'system', '🕊️ Простительное выселение', reason, null, null);
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
    await createNotification(phone, 'system', '⏰ Штамм назначен', reason, null, null);
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
    await createNotification(phone, 'system', '🕊️ Вас помиловали', 'Добро пожаловать обратно в подвал!', null, null);
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
// ПРОФЕССИИ
// ═══════════════════════════════════════════════════════
app.get('/api/professions', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM professions ORDER BY hired_at ASC');
    res.json(r.rows.map(p => ({
      phone: p.phone,
      profession: p.profession,
      hiredAt: p.hired_at,
      hiredBy: p.hired_by,
      lastPaidAt: p.last_paid_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/professions', async (req, res) => {
  try {
    const { phone, profession, hiredBy } = req.body;
    if (!phone || !profession) return res.status(400).json({ error: 'Bad params' });
    await pool.query(
      `INSERT INTO professions (phone, profession, hired_by, last_paid_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (phone, profession) DO NOTHING`,
      [phone, profession, hiredBy || 'ПР']
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/professions/:phone/:profession', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM professions WHERE phone=$1 AND profession=$2',
      [req.params.phone, req.params.profession]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/professions/pay_salary', async (req, res) => {
  try {
    const { phone, profession, amount } = req.body;
    if (!phone || !profession || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Bad params' });
    }

    const bankRes = await pool.query('SELECT amount FROM bank_pf WHERE id=1');
    const bankAmount = parseInt(bankRes.rows[0]?.amount || 0);
    if (bankAmount < amount) {
      return res.status(400).json({ error: 'Недостаточно в казне' });
    }

    await pool.query('UPDATE bank_pf SET amount=amount-$1 WHERE id=1', [amount]);

    const userRes = await pool.query('SELECT tonki FROM users WHERE phone=$1', [phone]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query('UPDATE users SET tonki=tonki+$1 WHERE phone=$2', [amount, phone]);

    await pool.query(
      'UPDATE professions SET last_paid_at=NOW() WHERE phone=$1 AND profession=$2',
      [phone, profession]
    );

    await createNotification(phone, 'reward', '💵 Зарплата', `+${amount}₮ за ${profession}`, 'salary', null);

    res.json({ ok: true, amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/status_salary/pay', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Bad params' });
    }

    const bankRes = await pool.query('SELECT amount FROM bank_pf WHERE id=1');
    const bankAmount = parseInt(bankRes.rows[0]?.amount || 0);
    if (bankAmount < amount) {
      return res.status(400).json({ error: 'Недостаточно в казне ПФ' });
    }
    await pool.query('UPDATE bank_pf SET amount=amount-$1 WHERE id=1', [amount]);

    await pool.query('UPDATE users SET tonki=tonki+$1 WHERE phone=$2', [amount, phone]);

    await pool.query(
      `INSERT INTO salary_paid (phone, last_paid) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET last_paid=$2`,
      [phone, new Date().toISOString()]
    );

    await createNotification(phone, 'reward', `💰 Зарплата`, `+${amount}₮`, 'salary', null);

    res.json({ ok: true, amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profession_requests', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM profession_requests ORDER BY id DESC');
    res.json(r.rows.map(x => ({
      id: x.id, userPhone: x.user_phone, userName: x.user_name,
      profession: x.profession, status: x.status, prComment: x.pr_comment,
      createdAt: x.created_at, resolvedAt: x.resolved_at, resolvedBy: x.resolved_by,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/profession_requests', async (req, res) => {
  try {
    const a = req.body;
    await pool.query(
      `INSERT INTO profession_requests (id, user_phone, user_name, profession, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET status=$5, pr_comment=$7, resolved_at=$8, resolved_by=$9`,
      [a.id, a.userPhone, a.userName, a.profession, a.status || 'pending', a.createdAt,
       a.prComment || null, a.resolvedAt || null, a.resolvedBy || null]
    );

    if (a.status === 'pending') {
      const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) {
        await createNotification(
          prRes.rows[0].phone, 'request', `💼 Заявка на профессию`,
          `${a.userName}: ${a.profession}`, 'profession_requests', null
        );
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/profession_requests/:id/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedBy } = req.body;
    const reqRes = await pool.query('SELECT * FROM profession_requests WHERE id=$1', [req.params.id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const request = reqRes.rows[0];

    await pool.query(
      `UPDATE profession_requests SET status=$1, pr_comment=$2, resolved_at=$3, resolved_by=$4 WHERE id=$5`,
      [status, prComment || null, new Date().toISOString(), resolvedBy || null, req.params.id]
    );

    if (status === 'approved') {
      await pool.query(
        `INSERT INTO professions (phone, profession, hired_by, last_paid_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (phone, profession) DO NOTHING`,
        [request.user_phone, request.profession, resolvedBy || 'ПР']
      );

      await createNotification(
        request.user_phone, 'system', '✅ Заявка на профессию одобрена',
        prComment || 'Добро пожаловать на работу!', 'professions', null
      );
    } else if (status === 'rejected') {
      await createNotification(
        request.user_phone, 'system', '❌ Заявка на профессию отклонена',
        prComment || 'Без причины', 'professions', null
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/profession_requests/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM profession_requests WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ЧАТЫ (С ПОДДЕРЖКОЙ ФОТО/ВИДЕО)
// ═══════════════════════════════════════════════════════
app.get('/api/messages', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM messages ORDER BY id ASC LIMIT 200');
    res.json(r.rows.map(m => ({
      id: m.id, from: m.from_phone, fromName: m.from_name,
      fromAvatar: m.from_avatar, fromStatus: m.from_status,
      text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      image: m.image, video: m.video,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, reply_to, voice, voice_duration, image, video, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.from, m.fromName, m.fromAvatar, m.fromStatus, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.image || null, m.video || null, m.time, m.date]
    );

    if (m.from && m.from !== 'system' && !m.from.includes('БОТ')) {
      const users = await pool.query('SELECT phone FROM users WHERE phone <> $1', [m.from]);
      const preview = m.voice ? '🎤 Голосовое' : m.image ? '🖼️ Фото' : m.video ? '🎬 Видео' : (m.text || '').slice(0, 60);
      for (const u of users.rows) {
        await createNotification(u.phone, 'message', `💬 ${m.fromName}`, preview, 'general_chat', null);
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/private/:chatId', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM private_messages WHERE chat_id=$1 ORDER BY id ASC',
      [req.params.chatId]
    );
    res.json(r.rows.map(m => ({
      id: m.id, chatId: m.chat_id,
      from: m.from_phone, fromName: m.from_name,
      text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      image: m.image, video: m.video,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/private', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO private_messages (id, chat_id, from_phone, from_name, text, reply_to, voice, voice_duration, image, video, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.chatId, m.from, m.fromName, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.image || null, m.video || null, m.time, m.date || null]
    );

    if (m.chatId) {
      const parts = m.chatId.split('__');
      const recipient = parts.find(p => p !== m.from);
      if (recipient) {
        const preview = m.voice ? '🎤 Голосовое' : m.image ? '🖼️ Фото' : m.video ? '🎬 Видео' : (m.text || '').slice(0, 60);
        await createNotification(recipient, 'message', `💬 ${m.fromName}`, preview, 'private_chat', m.from);
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/private/:chatId/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM private_messages WHERE chat_id=$1', [req.params.chatId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/group_messages/:groupId', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM group_messages WHERE group_id=$1 ORDER BY id ASC LIMIT 200',
      [req.params.groupId]
    );
    res.json(r.rows.map(m => ({
      id: m.id, groupId: m.group_id,
      from: m.from_phone, fromName: m.from_name, fromAvatar: m.from_avatar,
      text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      image: m.image, video: m.video,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/group_messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO group_messages (id, group_id, from_phone, from_name, from_avatar, text, reply_to, voice, voice_duration, image, video, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.groupId, m.from, m.fromName, m.fromAvatar || null, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.image || null, m.video || null, m.time, m.date || null]
    );

    const groupRes = await pool.query('SELECT name FROM group_chats WHERE id=$1', [m.groupId]);
    const groupName = groupRes.rows[0]?.name || 'Группа';
    const membersRes = await pool.query(
      'SELECT phone FROM group_members WHERE group_id=$1 AND phone <> $2',
      [m.groupId, m.from]
    );
    const preview = m.voice ? '🎤 Голосовое' : m.image ? '🖼️ Фото' : m.video ? '🎬 Видео' : (m.text || '').slice(0, 60);
    for (const mbr of membersRes.rows) {
      await createNotification(mbr.phone, 'message', `💬 ${groupName}`, `${m.fromName}: ${preview}`, 'group_chat', String(m.groupId));
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/group_messages/:groupId/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM group_messages WHERE group_id=$1', [req.params.groupId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/party_messages/:partyId', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM party_messages WHERE party_id=$1 ORDER BY id ASC LIMIT 200',
      [req.params.partyId]
    );
    res.json(r.rows.map(m => ({
      id: m.id, partyId: m.party_id,
      from: m.from_phone, fromName: m.from_name,
      text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      image: m.image, video: m.video,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/party_messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO party_messages (id, party_id, from_phone, from_name, text, reply_to, voice, voice_duration, image, video, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.partyId, m.from, m.fromName, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.image || null, m.video || null, m.time, m.date || null]
    );

    const partyRes = await pool.query('SELECT name FROM parties WHERE id=$1', [m.partyId]);
    const partyName = partyRes.rows[0]?.name || 'Партия';
    const membersRes = await pool.query(
      'SELECT phone FROM party_members WHERE party_id=$1 AND phone <> $2',
      [m.partyId, m.from]
    );
    const preview = m.voice ? '🎤 Голосовое' : m.image ? '🖼️ Фото' : m.video ? '🎬 Видео' : (m.text || '').slice(0, 60);
    for (const mbr of membersRes.rows) {
      await createNotification(mbr.phone, 'message', `🏛️ ${partyName}`, `${m.fromName}: ${preview}`, 'party_chat', String(m.partyId));
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ШТРАФЫ
// ═══════════════════════════════════════════════════════
app.get('/api/fines', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM fines ORDER BY id DESC');
    res.json(r.rows.map(f => ({
      id: f.id, phone: f.phone, reason: f.reason, amount: f.amount,
      fromPhone: f.from_phone, fromName: f.from_name, date: f.date, paid: f.paid, paidAt: f.paid_at,
    })));
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

    if (!f.paid) {
      await createNotification(f.phone, 'fine', `⚠️ Новый штраф: ${f.amount}₮`, f.reason, 'fines', null);
    }

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

    res.json({ accrued: interest, newDeposit, daysPassed: Math.floor(daysPassed) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
// ИГРА: ЭВОЛЮЦИЯ ПОДВАЛА (IDLE)
// ═══════════════════════════════════════════════════════

// Получить состояние игры
app.get('/api/games/idle/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT game_rubles, game_generators, game_meta_aura FROM users WHERE phone=$1', [req.params.phone]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const u = r.rows[0];
    res.json({
      rubles: parseInt(u.game_rubles) || 0,
      generators: u.game_generators || [],
      metaAura: parseInt(u.game_meta_aura) || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Сохранить прогресс (клик / покупка)
app.post('/api/games/idle/save', async (req, res) => {
  try {
    const { phone, rubles, generators } = req.body;
    if (!phone) return res.status(400).json({ error: 'Bad params' });

    // Защита от читов (проверяем, что генераторы - это массив)
    const safeGenerators = Array.isArray(generators) ? generators : [];

    await pool.query(
      'UPDATE users SET game_rubles=$1, game_generators=$2 WHERE phone=$3',
      [rubles, JSON.stringify(safeGenerators), phone]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Престиж (Сброс Эры)
app.post('/api/games/idle/prestige', async (req, res) => {
  try {
    const { phone } = req.body;
    const r = await pool.query('SELECT game_rubles, game_meta_aura FROM users WHERE phone=$1', [phone]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const rubles = parseInt(r.rows[0].game_rubles) || 0;
    // Даем 1 мета-ауру за каждые 1000 рублей
    const earnedMeta = Math.floor(Math.sqrt(rubles / 1000)); 

    if (earnedMeta <= 0) return res.status(400).json({ error: 'Нужно больше рублей для сброса' });

    const newMeta = (parseInt(r.rows[0].game_meta_aura) || 0) + earnedMeta;

    await pool.query(
      'UPDATE users SET game_rubles=0, game_generators=\'[]\', game_meta_aura=$1 WHERE phone=$2',
      [newMeta, phone]
    );

    res.json({ ok: true, earnedMeta, newMeta });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Выдача рублей
app.post('/api/games/idle/give_rubles', async (req, res) => {
  try {
    const { adminPhone, targetPhone, amount } = req.body;
    if (!adminPhone || !targetPhone || !amount) return res.status(400).json({ error: 'Не все поля' });
    
    // Проверка ПР
    const users = await pool.query('SELECT status FROM users WHERE phone = $1', [adminPhone]);
    if (!users.rows.length || users.rows[0].status !== 'ПР') return res.status(403).json({ error: 'Только ПР' });
    
    const amt = parseInt(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Сумма > 0' });

    // Записываем в БД
    await pool.query(`
      INSERT INTO idle_pending_rubles (phone, amount)
      VALUES ($1, $2)
      ON CONFLICT (phone) DO UPDATE SET amount = idle_pending_rubles.amount + EXCLUDED.amount, updated_at = NOW()
    `, [targetPhone, amt]);

    const result = await pool.query('SELECT amount FROM idle_pending_rubles WHERE phone = $1', [targetPhone]);
    res.json({ ok: true, pending: parseInt(result.rows[0]?.amount || 0) });
  } catch (e) { 
    console.error('give_rubles ERROR:', e);
    res.status(500).json({ error: e.message || 'Ошибка' }); 
  }
});

// Проверка сколько ждёт
app.get('/api/games/idle/pending_rubles/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT amount FROM idle_pending_rubles WHERE phone = $1', [req.params.phone]);
    res.json({ pending: parseInt(r.rows[0]?.amount || 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Забрать рубли (обнулить)
app.post('/api/games/idle/claim_rubles', async (req, res) => {
  try {
    const { phone } = req.body;
    const r = await pool.query('DELETE FROM idle_pending_rubles WHERE phone = $1 RETURNING amount', [phone]);
    const claimed = parseInt(r.rows[0]?.amount || 0);
    res.json({ ok: true, claimed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// СБРОС ПОДВАЛА (ТОЛЬКО ДЛЯ ПР)
// ═══════════════════════════════════════════════════════
app.post('/api/admin/reset', async (req, res) => {
  try {
    const { adminPhone } = req.body;
    if (!adminPhone) return res.status(400).json({ error: 'Bad params' });

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [adminPhone]);
    if (uRes.rows.length === 0 || uRes.rows[0].status !== 'ПР') {
      return res.status(403).json({ error: 'Только ПР может сбросить подвал' });
    }

    await pool.query('DELETE FROM users WHERE phone <> $1', [adminPhone]);
    await pool.query('DELETE FROM news');
    await pool.query('DELETE FROM bank');
    await pool.query('DELETE FROM interest_history');
    await pool.query('DELETE FROM fines');
    await pool.query('DELETE FROM friends');
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM private_messages');
    await pool.query('DELETE FROM group_messages');
    await pool.query('DELETE FROM party_messages');
    await pool.query('DELETE FROM appeals');
    await pool.query('DELETE FROM doc_requests');
    await pool.query('DELETE FROM aura_history');
    await pool.query('DELETE FROM salary_paid');
    await pool.query('DELETE FROM elections');
    await pool.query('DELETE FROM election_candidates');
    await pool.query('DELETE FROM election_votes');
    await pool.query('DELETE FROM casino_history');
    await pool.query('DELETE FROM casino_daily');
    await pool.query('DELETE FROM casino_permission');
    await pool.query('DELETE FROM credit_requests');
    await pool.query('DELETE FROM credits');
    await pool.query('DELETE FROM professions');
    await pool.query('DELETE FROM profession_requests');
    await pool.query('DELETE FROM profession_salary_paid');
    await pool.query('DELETE FROM parties');
    await pool.query('DELETE FROM party_members');
    await pool.query('DELETE FROM party_requests');
    await pool.query('DELETE FROM party_candidates');
    await pool.query('DELETE FROM party_wins');
    await pool.query('DELETE FROM password_resets');
    await pool.query('DELETE FROM debts');
    await pool.query('DELETE FROM achievements');
    await pool.query('DELETE FROM message_reactions');
    await pool.query('DELETE FROM group_chats');
    await pool.query('DELETE FROM group_members');
    await pool.query('DELETE FROM chat_settings');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM fcm_tokens');
    await pool.query('DELETE FROM idle_pending_rubles');

    await pool.query('UPDATE users SET tonki=10000, aura=28000 WHERE phone=$1', [adminPhone]);

    res.json({ ok: true, message: 'Подвал стерт. Остался только ты.' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
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
        if (d.last_date === today && d.count >= 15) {
          return res.status(403).json({ error: 'Лимит 15 игр в день исчерпан' });
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

    let auraBonus = 0;
    if (prizeType === 'jackpot_banana') auraBonus = 1000;

    if (auraBonus > 0) {
      await pool.query(
        'UPDATE users SET tonki=$1, aura = COALESCE(aura, 0) + $2 WHERE phone=$3',
        [newTonki, auraBonus, phone]
      );
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [Date.now() + Math.floor(Math.random() * 1000), phone, auraBonus,
         'Джекпот 3 банана в казино', new Date().toLocaleString('ru-RU')]
      );
    } else {
      await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [newTonki, phone]);
    }

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
      gamesLeft = 15 - newCount;
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
      gamesLeft, isPR, auraBonus,
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
    res.json({ count, left: Math.max(0, 15 - count), hasPermission: perm.rows.length > 0 });
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
    await createNotification(phone, 'system', '🎰 Разрешение на казино', 'Одобрено', 'casino', null);
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
    
    await pool.query('UPDATE users SET status=$1 WHERE phone=$2', ['ПВ', winner.phone]);
    await pool.query('UPDATE users SET status=$1 WHERE status=$2 AND phone<>$3', ['ЖИ', 'ПВ', winner.phone]);
    await pool.query('UPDATE users SET tonki = tonki + 100 WHERE phone=$1', [winner.phone]);
    await pool.query('UPDATE elections SET finished=true, winner_phone=$1, winner_name=$2 WHERE id=1', [winner.phone, winner.name]);

    res.json({ ok: true, winnerPhone: winner.phone, winnerName: winner.name });
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
// КРЕДИТЫ
// ═══════════════════════════════════════════════════════
app.get('/api/credit_requests', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM credit_requests ORDER BY id DESC');
    res.json(r.rows.map(x => ({
      id: x.id, userPhone: x.user_phone, userName: x.user_name, amount: x.amount,
      reason: x.reason, months: x.months, status: x.status, prComment: x.pr_comment,
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
      [a.id, a.userPhone, a.userName, a.amount, a.reason, a.months, a.status || 'pending', a.createdAt, a.prComment || null, a.resolvedAt || null, a.resolvedBy || null]
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
      await createNotification(request.user_phone, 'reward', `✅ Кредит одобрен`, `К возврату: ${totalDue}₮`, 'bank', null);
    } else {
      await createNotification(request.user_phone, 'system', '❌ Кредит отклонён', prComment || 'Без причины', 'bank', null);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/credits/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM credits WHERE user_phone=$1 ORDER BY id DESC', [req.params.phone]);
    res.json(r.rows.map(c => ({
      id: c.id, userPhone: c.user_phone, amount: c.amount, totalDue: c.total_due,
      paid: c.paid, reason: c.reason, months: c.months, dueDate: c.due_date,
      status: c.status, createdAt: c.created_at, paidAt: c.paid_at,
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
// ДОЛГИ
// ═══════════════════════════════════════════════════════
app.get('/api/debts', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM debts ORDER BY id DESC');
    res.json(r.rows.map(d => ({
      id: d.id, debtorPhone: d.debtor_phone, debtorName: d.debtor_name,
      creditorPhone: d.creditor_phone, creditorName: d.creditor_name,
      amount: d.amount, reason: d.reason, dueDate: d.due_date, status: d.status,
      isGovernment: d.is_government || false, appealStatus: d.appeal_status || null,
      appealReason: d.appeal_reason || null, appealPrComment: d.appeal_pr_comment || null,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts', async (req, res) => {
  try {
    const d = req.body;
    if (!d.debtorPhone || !d.creditorPhone || !d.amount || !d.reason || !d.dueDate) {
      return res.status(400).json({ error: 'Bad params' });
    }
    const id = Date.now();
    await pool.query(
      `INSERT INTO debts (id, debtor_phone, debtor_name, creditor_phone, creditor_name, amount, reason, due_date, status, created_by, is_government)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10)`,
      [id, d.debtorPhone, d.debtorName, d.creditorPhone, d.creditorName, d.amount, d.reason, d.dueDate, d.createdBy || null, d.isGovernment || false]
    );
    await createNotification(d.debtorPhone, 'system', `💸 Новый долг: ${d.amount}₮`, d.reason, 'debts', null);
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts/:id/pay', async (req, res) => {
  try {
    const { paidBy } = req.body;
    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    if (debt.status === 'paid') return res.status(400).json({ error: 'Уже выплачен' });

    const debtorRes = await pool.query('SELECT * FROM users WHERE phone=$1', [debt.debtor_phone]);
    if (debtorRes.rows.length === 0) return res.status(404).json({ error: 'Должник не найден' });
    const debtor = debtorRes.rows[0];

    if ((debtor.tonki || 0) < debt.amount) {
      return res.status(400).json({ error: `Не хватает ${debt.amount - (debtor.tonki || 0)} ₮` });
    }

    await pool.query('UPDATE users SET tonki = tonki - $1 WHERE phone = $2', [debt.amount, debt.debtor_phone]);

    let recipientPhone = debt.creditor_phone;
    if (debt.is_government) {
      const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) recipientPhone = prRes.rows[0].phone;
    }

    await pool.query('UPDATE users SET tonki = tonki + $1 WHERE phone = $2', [debt.amount, recipientPhone]);

    const now = new Date().toISOString();
    await pool.query(`UPDATE debts SET status='paid', paid_at=$1 WHERE id=$2`, [now, req.params.id]);
    await createNotification(recipientPhone, 'system', `💰 Вам выплатили долг: ${debt.amount}₮`, `От ${debt.debtor_name}`, 'debts', null);

    res.json({ ok: true, paidAt: now, amount: debt.amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts/:id/appeal', async (req, res) => {
  try {
    const { userPhone, reason } = req.body;
    if (!userPhone || !reason) return res.status(400).json({ error: 'Bad params' });

    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    if (debt.debtor_phone !== userPhone) return res.status(403).json({ error: 'Не твой долг' });
    if (debt.status === 'paid') return res.status(400).json({ error: 'Долг уже выплачен' });
    if (debt.appeal_status === 'pending') return res.status(400).json({ error: 'Апелляция уже отправлена' });

    const now = new Date().toLocaleString('ru-RU');
    await pool.query(
      `UPDATE debts SET appeal_status='pending', appeal_reason=$1, appeal_created_at=$2 WHERE id=$3`,
      [reason.trim(), now, req.params.id]
    );

    const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
    if (prRes.rows.length > 0) {
      await createNotification(prRes.rows[0].phone, 'appeal', `📝 Апелляция на долг`, `${debt.debtor_name}: ${reason.trim()}`, 'debts_admin', null);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts/:id/appeal/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedByPhone } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Bad status' });

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [resolvedByPhone]);
    if (uRes.rows.length === 0 || uRes.rows[0].status !== 'ПР') {
      return res.status(403).json({ error: 'Только ПР' });
    }

    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    const now = new Date().toLocaleString('ru-RU');

    if (status === 'approved') {
      await pool.query('DELETE FROM debts WHERE id=$1', [req.params.id]);
      await createNotification(debt.debtor_phone, 'system', '✅ Апелляция одобрена', `Долг ${debt.amount}₮ снят`, 'debts', null);
    } else {
      await pool.query(
        `UPDATE debts SET appeal_status='rejected', appeal_pr_comment=$1, appeal_resolved_at=$2 WHERE id=$3`,
        [prComment || null, now, req.params.id]
      );
      await createNotification(debt.debtor_phone, 'system', '❌ Апелляция отклонена', prComment || 'Без причины', 'debts', null);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/debts/:id', async (req, res) => {
  try {
    const { deletedByPhone } = req.body;
    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [deletedByPhone]);
    const isPR = uRes.rows.length > 0 && uRes.rows[0].status === 'ПР';
    if (!isPR) return res.status(403).json({ error: 'Нет прав' });

    await pool.query('DELETE FROM debts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ
// ═══════════════════════════════════════════════════════
app.get('/api/notifications/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM notifications WHERE phone=$1 ORDER BY created_at DESC LIMIT 50', [req.params.phone]);
    res.json(r.rows.map(n => ({
      id: n.id, phone: n.phone, type: n.type, title: n.title, text: n.text,
      target: n.target, targetId: n.target_id, read: n.read, createdAt: n.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ФОНОВЫЕ ЗАДАЧИ (CRON)
// ═══════════════════════════════════════════════════════
const tickAutoRewards = async () => {
  try {
    await pool.query(`UPDATE users SET aura=aura+2000, last_rich_reward=true WHERE tonki>300 AND last_rich_reward=false AND status<>'ПР'`);
    await pool.query(`UPDATE users SET last_seen_at=NOW() WHERE last_seen_at IS NULL`);
    await pool.query(`UPDATE users SET pension_started_at=NOW() WHERE has_pension=true AND pension_started_at IS NULL`);
  } catch (err) { console.error('tickAutoRewards:', err.message); }
};

setInterval(tickAutoRewards, 60 * 60 * 1000);
setTimeout(tickAutoRewards, 30 * 1000);

app.listen(PORT, () => {
  console.log('🚀 Сервер запущен на порту ' + PORT);
});