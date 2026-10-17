require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
    // Принудительно исправляем переносы строк в приватном ключе
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id BIGINT PRIMARY KEY, chat_id TEXT NOT NULL, from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL, text TEXT NOT NULL, time TEXT NOT NULL
      )
    `);

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
      CREATE TABLE IF NOT EXISTS party_messages (
        id BIGINT PRIMARY KEY,
        party_id BIGINT NOT NULL,
        from_phone TEXT NOT NULL,
        from_name TEXT NOT NULL,
        text TEXT NOT NULL,
        time TEXT NOT NULL
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

    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);

    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS date TEXT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);

    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS reply_to BIGINT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS from_avatar TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS date TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS voice TEXT`);
    await pool.query(`ALTER TABLE party_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER`);

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

    // ═══ FCM ТОКЕНЫ ═══
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
  res.send('🏚️ Подвальная Федерация — сервер работает (PostgreSQL + Firebase)!');
});

// ═══════════════════════════════════════════════════════
// ОТПРАВКА PUSH
// ═══════════════════════════════════════════════════════
const sendPushNotification = async (phone, title, body, target, targetId) => {
  try {
    // Явно проверяем, что Firebase загружен
    if (!admin || !admin.messaging) {
      console.log('❌ [PUSH] Firebase Admin не инициализирован');
      return;
    }

    const tokenRes = await pool.query('SELECT token FROM fcm_tokens WHERE phone=$1', [phone]);
    if (tokenRes.rows.length === 0) {
      console.log(`⚠️ [PUSH] Нет FCM-токена для ${phone}`);
      return;
    }
    
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
    const response = await admin.messaging().send(message);
    console.log(`✅ [PUSH] Успешно отправлено! ID: ${response}`);
    
  } catch (err) {
    console.error(`❌ [PUSH] Ошибка отправки:`, err.code, err.message);
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
    
    // ═══ ОТПРАВЛЯЕМ PUSH (с задержкой, чтобы Vercel не убил процесс) ═══
    await sendPushNotification(phone, title, text || '', target, targetId);
    
  } catch (err) { 
    console.error('createNotification:', err.message); 
  }
};

// ═══════════════════════════════════════════════════════
// FCM
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

// ═══════════════════════════════════════════════════════
// HEARTBEAT / TAX PAID
// ═══════════════════════════════════════════════════════
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
        [
          Date.now() + Math.floor(Math.random() * 1000),
          u.phone, 0,
          '⚠️ Понижение ПМ → ЖИ (аура упала ниже 9800, п. 2.5)',
          new Date().toLocaleString('ru-RU')
        ]
      );
    }

    res.json({ ok: true, demoted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/bonus_aura', async (req, res) => {
  try {
    const { phone, delta, reason, giverName } = req.body;
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
      [
        Date.now() + Math.floor(Math.random() * 1000),
        phone, delta,
        reason || 'Награда',
        new Date().toLocaleString('ru-RU')
      ]
    );

    if (demoted) {
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [
          Date.now() + Math.floor(Math.random() * 1000) + 1,
          phone, 0,
          '⚠️ Понижение ПМ → ЖИ (аура упала ниже 9800, п. 2.5)',
          new Date().toLocaleString('ru-RU')
        ]
      );
    }

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
      [
        Date.now() + Math.floor(Math.random() * 1000),
        phone, 1000,
        `🎁 Подарки (п. 5.10) — хороший подарок ПР (${giverName || 'ПР'})`,
        new Date().toLocaleString('ru-RU')
      ]
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
      [
        Date.now(),
        u.phone,
        `${u.first_name} ${u.last_name}`,
        u.login,
        u.phone,
        new Date().toLocaleString('ru-RU')
      ]
    );

    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Date.now() + 1,
        'system', '🔔 Система', null, 'БОТ',
        `${u.first_name} ${u.last_name} сбросил пароль`,
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      ]
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

app.get('/api/professions/salary_history/:phone', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM profession_salary_paid WHERE phone=$1 ORDER BY paid_at DESC LIMIT 50',
      [req.params.phone]
    );
    res.json(r.rows.map(x => ({
      id: x.id, phone: x.phone, profession: x.profession,
      amount: x.amount, paidBy: x.paid_by, paidAt: x.paid_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/professions/pay_salary', async (req, res) => {
  try {
    const { phone, profession, amount, paidBy } = req.body;
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

    await pool.query(
      `INSERT INTO profession_salary_paid (id, phone, profession, amount, paid_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [Date.now(), phone, profession, amount, paidBy || 'ПР']
    );

    await createNotification(phone, 'reward', '💵 Зарплата', `+${amount}₮ за ${profession}`, 'salary', null);

    res.json({ ok: true, amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/status_salary/pay', async (req, res) => {
  try {
    const { phone, amount, paidBy } = req.body;
    if (!phone || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Bad params' });
    }

    const uRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = uRes.rows[0];

    let expectedAmount = 0;
    if (u.has_pension) expectedAmount = 12;
    else if (u.status === 'МП') expectedAmount = 5;
    else if (['ПВ', 'ЗМ', 'ПЗ'].includes(u.status)) expectedAmount = 10;
    else return res.status(400).json({ error: 'У этого ЖИ нет зарплаты статуса' });

    if (amount !== expectedAmount) {
      return res.status(400).json({ error: `Сумма должна быть ${expectedAmount} ₮` });
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

    const reason = u.has_pension ? 'Пенсия' : `Зарплата ${u.status}`;
    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Date.now(),
        'system', '💰 Банк ПФ', null, 'БОТ',
        `Выдана ${reason} ${amount} ₮ для ${u.first_name} ${u.last_name}`,
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      ]
    );

    await createNotification(phone, 'reward', `💰 ${reason}`, `+${amount}₮`, 'salary', null);

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
          prRes.rows[0].phone,
          'request',
          `💼 Заявка на профессию`,
          `${a.userName}: ${a.profession}`,
          'profession_requests',
          null
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

      const PRICES = {
        pivatroon: 10, shpioniro: 8, doker: 8, tester: 10, letopisec: 0,
      };
      const price = PRICES[request.profession] || 0;
      if (price > 0) {
        const userRes = await pool.query('SELECT tonki FROM users WHERE phone=$1', [request.user_phone]);
        if (userRes.rows.length > 0) {
          const newTonki = Math.max(0, (userRes.rows[0].tonki || 0) - price);
          await pool.query('UPDATE users SET tonki=$1 WHERE phone=$2', [newTonki, request.user_phone]);
          await pool.query('UPDATE bank_pf SET amount=amount+$1 WHERE id=1', [price]);
        }
      }

      await createNotification(
        request.user_phone,
        'system',
        '✅ Заявка на профессию одобрена',
        prComment || 'Добро пожаловать на работу!',
        'professions',
        null
      );
    } else if (status === 'rejected') {
      await createNotification(
        request.user_phone,
        'system',
        '❌ Заявка на профессию отклонена',
        prComment || 'Без причины',
        'professions',
        null
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

    if (a.status === 'pending') {
      const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) {
        await createNotification(
          prRes.rows[0].phone,
          'request',
          `💳 Заявка на кредит: ${a.amount}₮`,
          `${a.userName}: ${a.reason}`,
          'credit_requests',
          null
        );
      }
    }

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

      await createNotification(
        request.user_phone,
        'reward',
        `✅ Кредит одобрен: ${request.amount}₮`,
        `К возврату: ${totalDue}₮ за ${request.months} мес.`,
        'bank',
        null
      );
    } else if (status === 'rejected') {
      await createNotification(
        request.user_phone,
        'system',
        '❌ Кредит отклонён',
        prComment || 'Без причины',
        'bank',
        null
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
        [
          Date.now() + Math.floor(Math.random() * 1000),
          phone, auraBonus,
          'Джекпот 3 банана в казино',
          new Date().toLocaleString('ru-RU')
        ]
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
    const winnerPhone = winner.phone;
    const winnerName = winner.name;

    await pool.query('UPDATE users SET status=$1 WHERE phone=$2', ['ПВ', winnerPhone]);
    await pool.query('UPDATE users SET status=$1 WHERE status=$2 AND phone<>$3', ['ЖИ', 'ПВ', winnerPhone]);
    await pool.query('UPDATE users SET tonki = tonki + 100 WHERE phone=$1', [winnerPhone]);

    let partyMembers = [];
    let partyId = null;
    try {
      const cRes = await pool.query(
        'SELECT pm.phone, pm.name, pm.party_id FROM party_members pm JOIN party_candidates pc ON pc.party_id = pm.party_id WHERE pc.phone=$1',
        [winnerPhone]
      );
      partyMembers = cRes.rows;
      if (cRes.rows.length > 0) partyId = cRes.rows[0].party_id;
    } catch (e) { console.error('party bonus:', e.message); }

    for (const m of partyMembers) {
      await pool.query('UPDATE users SET aura = COALESCE(aura, 0) + 1000 WHERE phone=$1', [m.phone]);
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [
          Date.now() + Math.floor(Math.random() * 100000),
          m.phone, 1000,
          m.phone === winnerPhone ? 'Победная партия на выборах ПВ (ты — кандидат)' : 'Победная партия на выборах ПВ',
          new Date().toLocaleString('ru-RU')
        ]
      );
    }

    let finalWins = 0;
    let rewardGranted = false;

    if (partyId) {
      const winsRes = await pool.query('SELECT * FROM party_wins WHERE party_id=$1', [partyId]);
      let currentWins = 0;
      let alreadyRewarded = false;
      if (winsRes.rows.length > 0) {
        currentWins = winsRes.rows[0].wins || 0;
        alreadyRewarded = winsRes.rows[0].reward_granted || false;
      }
      finalWins = currentWins + 1;

      if (winsRes.rows.length === 0) {
        await pool.query(
          'INSERT INTO party_wins (party_id, wins, last_win_at) VALUES ($1, $2, NOW())',
          [partyId, finalWins]
        );
      } else {
        await pool.query(
          'UPDATE party_wins SET wins=$1, last_win_at=NOW() WHERE party_id=$2',
          [finalWins, partyId]
        );
      }

      if (finalWins >= 4 && !alreadyRewarded) {
        rewardGranted = true;
        for (const m of partyMembers) {
          await pool.query('UPDATE users SET aura = COALESCE(aura, 0) + 3000 WHERE phone=$1', [m.phone]);
          await pool.query(
            `INSERT INTO aura_history (id, phone, delta, reason, date)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
            [
              Date.now() + Math.floor(Math.random() * 100000),
              m.phone, 3000,
              '🏆 Лучшая партия (п. 5.9) — 4 победы на выборах',
              new Date().toLocaleString('ru-RU')
            ]
          );
        }
        await pool.query(
          'UPDATE party_wins SET reward_granted=true WHERE party_id=$1',
          [partyId]
        );

        await pool.query(
          `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            Date.now() + Math.floor(Math.random() * 100000),
            'system', '🏆 Лучшая партия', null, 'БОТ',
            `🎉 Партия победила 4 раза! Все участники получают +3000 ауры (п. 5.9)`,
            new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
          ]
        );
      }
    }

    await pool.query('UPDATE elections SET finished=true, winner_phone=$1, winner_name=$2 WHERE id=1', [winnerPhone, winnerName]);

    const allUsers = await pool.query('SELECT phone FROM users');
    for (const u of allUsers.rows) {
      await createNotification(
        u.phone,
        'system',
        '🏁 Выборы завершены',
        `Победил: ${winnerName}`,
        'elections',
        null
      );
    }

    res.json({
      ok: true,
      winnerPhone,
      winnerName,
      partyBonus: partyMembers.length,
      partyWins: finalWins,
      bestPartyRewarded: rewardGranted,
    });
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

    const users = await pool.query('SELECT phone FROM users');
    for (const u of users.rows) {
      await createNotification(
        u.phone,
        'news',
        n.urgent ? `🔴 СРОЧНО: ${n.title}` : `📰 ${n.title}`,
        (n.text || '').slice(0, 80),
        'news',
        null
      );
    }

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
      text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, reply_to, voice, voice_duration, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.from, m.fromName, m.fromAvatar, m.fromStatus, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.time, m.date]
    );

    if (m.from && m.from !== 'system' && !m.from.includes('БОТ')) {
      const users = await pool.query('SELECT phone FROM users WHERE phone <> $1', [m.from]);
      const preview = m.voice ? '🎤 Голосовое' : (m.text || '').slice(0, 60);
      for (const u of users.rows) {
        await createNotification(
          u.phone,
          'message',
          `💬 ${m.fromName}`,
          preview,
          'general_chat',
          null
        );
      }
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ЛИЧНЫЕ
// ═══════════════════════════════════════════════════════
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
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/private', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO private_messages (id, chat_id, from_phone, from_name, text, reply_to, voice, voice_duration, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.chatId, m.from, m.fromName, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.time, m.date || null]
    );

    if (m.chatId) {
      const parts = m.chatId.split('__');
      const recipient = parts.find(p => p !== m.from);
      if (recipient) {
        const preview = m.voice ? '🎤 Голосовое' : (m.text || '').slice(0, 60);
        await createNotification(
          recipient,
          'message',
          `💬 ${m.fromName}`,
          preview,
          'private_chat',
          m.from
        );
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

    if (!f.paid) {
      await createNotification(
        f.phone,
        'fine',
        `⚠️ Новый штраф: ${f.amount}₮`,
        f.reason,
        'fines',
        null
      );
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

    if (type === 'outgoing') {
      const uRes = await pool.query('SELECT first_name, last_name FROM users WHERE phone=$1', [user_phone]);
      if (uRes.rows.length > 0) {
        const name = `${uRes.rows[0].first_name} ${uRes.rows[0].last_name}`;
        await createNotification(friend_phone, 'friend', '👥 Заявка в друзья', `${name} хочет добавить тебя`, 'friends', null);
      }
    }

    if (type === 'friends') {
      const uRes = await pool.query('SELECT first_name, last_name FROM users WHERE phone=$1', [user_phone]);
      if (uRes.rows.length > 0) {
        const name = `${uRes.rows[0].first_name} ${uRes.rows[0].last_name}`;
        await createNotification(friend_phone, 'friend', '✅ Заявка принята', `${name} теперь у тебя в друзьях`, 'friends', null);
      }
    }

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
// ЛЕТОПИСЬ
// ═══════════════════════════════════════════════════════
app.get('/api/chronicle', async (req, res) => {
  try {
    const r = await pool.query('SELECT content FROM chronicle WHERE id=1');
    res.json({ content: r.rows[0]?.content || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chronicle', async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Bad content' });
    await pool.query(
      `INSERT INTO chronicle (id, content) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET content=$1`,
      [content]
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

    if (a.status === 'pending') {
      const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) {
        await createNotification(
          prRes.rows[0].phone,
          'appeal',
          `📝 Апелляция на штраф`,
          `${a.userName}: ${a.reason}`,
          'appeals',
          null
        );
      }
    }

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
      await createNotification(
        appeal.user_phone,
        'system',
        '✅ Апелляция одобрена',
        prComment || 'Штраф снят',
        'fines',
        null
      );
    } else if (status === 'rejected') {
      await createNotification(
        appeal.user_phone,
        'system',
        '❌ Апелляция отклонена',
        prComment || 'Без причины',
        'fines',
        null
      );
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

    if (a.status === 'pending') {
      const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) {
        const DOC_NAMES = {
          pension: '💰 Пенсия',
          insurance: '🛡️ Страховка',
          casino_permit: '🎰 Разрешение на казик',
          pm_status: '💎 Статус ПМ / ПЗ',
        };
        await createNotification(
          prRes.rows[0].phone,
          'request',
          `📄 Заявка на документ`,
          `${a.userName}: ${DOC_NAMES[a.docType] || a.docType}`,
          'doc_requests',
          null
        );
      }
    }

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

      await createNotification(
        request.user_phone,
        'system',
        '✅ Заявка одобрена',
        prComment || 'Документ оформлен',
        'documents',
        null
      );
    } else if (status === 'rejected') {
      await createNotification(
        request.user_phone,
        'system',
        '❌ Заявка отклонена',
        prComment || 'Без причины',
        'documents',
        null
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ПАРТИИ
// ═══════════════════════════════════════════════════════
app.get('/api/parties', async (req, res) => {
  try {
    const partiesRes = await pool.query('SELECT * FROM parties ORDER BY id ASC');
    const parties = [];
    for (const p of partiesRes.rows) {
      const membersRes = await pool.query(
        'SELECT * FROM party_members WHERE party_id=$1 ORDER BY joined_at ASC',
        [p.id]
      );
      const candRes = await pool.query(
        'SELECT * FROM party_candidates WHERE party_id=$1',
        [p.id]
      );
      parties.push({
        id: p.id,
        name: p.name,
        leaderPhone: p.leader_phone,
        leaderName: p.leader_name,
        avatar: p.avatar,
        createdAt: p.created_at,
        members: membersRes.rows.map(m => ({
          phone: m.phone,
          name: m.name,
          joinedAt: m.joined_at,
        })),
        candidate: candRes.rows.length > 0 ? {
          phone: candRes.rows[0].phone,
          name: candRes.rows[0].name,
        } : null,
      });
    }
    res.json(parties);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties', async (req, res) => {
  try {
    const { userPhone, userName, name } = req.body;
    if (!userPhone || !name) return res.status(400).json({ error: 'Bad params' });

    const trimmed = name.trim();
    if (trimmed.length < 2) return res.status(400).json({ error: 'Название минимум 2 символа' });
    if (trimmed.length > 40) return res.status(400).json({ error: 'Название максимум 40 символов' });

    const uRes = await pool.query('SELECT has_created_party FROM users WHERE phone=$1', [userPhone]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (uRes.rows[0].has_created_party) {
      return res.status(400).json({ error: 'Ты уже создавал партию. Можно только 1 раз.' });
    }

    const cntRes = await pool.query('SELECT COUNT(*) FROM parties');
    if (parseInt(cntRes.rows[0].count) >= 4) {
      return res.status(400).json({ error: 'Максимум 4 партии в ПФ' });
    }

    const dupRes = await pool.query('SELECT id FROM parties WHERE LOWER(name)=LOWER($1)', [trimmed]);
    if (dupRes.rows.length > 0) return res.status(400).json({ error: 'Такое название уже занято' });

    const inPartyRes = await pool.query('SELECT party_id FROM party_members WHERE phone=$1', [userPhone]);
    if (inPartyRes.rows.length > 0) return res.status(400).json({ error: 'Ты уже в партии' });

    const id = Date.now();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO parties (id, name, leader_phone, leader_name, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, trimmed, userPhone, userName, now]
    );

    await pool.query(
      `INSERT INTO party_members (party_id, phone, name, joined_at)
       VALUES ($1, $2, $3, $4)`,
      [id, userPhone, userName, now]
    );

    await pool.query('UPDATE users SET has_created_party=true WHERE phone=$1', [userPhone]);

    res.json({ ok: true, partyId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties/:id/rename', async (req, res) => {
  try {
    const { userPhone, name } = req.body;
    const trimmed = (name || '').trim();
    if (trimmed.length < 2) return res.status(400).json({ error: 'Минимум 2 символа' });
    if (trimmed.length > 40) return res.status(400).json({ error: 'Максимум 40 символов' });

    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Ты не глава' });

    const dupRes = await pool.query(
      'SELECT id FROM parties WHERE LOWER(name)=LOWER($1) AND id<>$2',
      [trimmed, req.params.id]
    );
    if (dupRes.rows.length > 0) return res.status(400).json({ error: 'Такое название занято' });

    await pool.query('UPDATE parties SET name=$1 WHERE id=$2', [trimmed, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties/:id/avatar', async (req, res) => {
  try {
    const { userPhone, avatar } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Ты не глава' });

    await pool.query('UPDATE parties SET avatar=$1 WHERE id=$2', [avatar || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/parties/:id', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [userPhone]);
    const isPR = uRes.rows.length > 0 && uRes.rows[0].status === 'ПР';
    const isLeader = pRes.rows[0].leader_phone === userPhone;

    if (!isPR && !isLeader) return res.status(403).json({ error: 'Нет прав' });

    const leaderPhone = pRes.rows[0].leader_phone;

    await pool.query('DELETE FROM party_messages WHERE party_id=$1', [req.params.id]);
    await pool.query('DELETE FROM party_candidates WHERE party_id=$1', [req.params.id]);
    await pool.query('DELETE FROM party_requests WHERE party_id=$1', [req.params.id]);
    await pool.query('DELETE FROM party_members WHERE party_id=$1', [req.params.id]);
    await pool.query('DELETE FROM party_wins WHERE party_id=$1', [req.params.id]);
    await pool.query('DELETE FROM parties WHERE id=$1', [req.params.id]);

    await pool.query('UPDATE users SET has_created_party=false WHERE phone=$1', [leaderPhone]);

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties/:id/join', async (req, res) => {
  try {
    const { userPhone, userName } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const membersRes = await pool.query('SELECT COUNT(*) FROM party_members WHERE party_id=$1', [req.params.id]);
    if (parseInt(membersRes.rows[0].count) >= 3) {
      return res.status(400).json({ error: 'Партия заполнена' });
    }

    const inPartyRes = await pool.query('SELECT party_id FROM party_members WHERE phone=$1', [userPhone]);
    if (inPartyRes.rows.length > 0) return res.status(400).json({ error: 'Ты уже в партии' });

    const dupReq = await pool.query(
      `SELECT id FROM party_requests WHERE party_id=$1 AND user_phone=$2 AND status='pending'`,
      [req.params.id, userPhone]
    );
    if (dupReq.rows.length > 0) return res.status(400).json({ error: 'Заявка уже отправлена' });

    await pool.query(
      `INSERT INTO party_requests (id, party_id, user_phone, user_name, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [Date.now(), req.params.id, userPhone, userName, new Date().toISOString()]
    );

    const leaderPhone = pRes.rows[0].leader_phone;
    await createNotification(
      leaderPhone,
      'request',
      `📨 Заявка в партию «${pRes.rows[0].name}»`,
      userName,
      'party',
      String(req.params.id)
    );

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/parties/:id/requests', async (req, res) => {
  try {
    const { userPhone } = req.query;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Не глава' });

    const r = await pool.query(
      `SELECT * FROM party_requests WHERE party_id=$1 AND status='pending' ORDER BY id ASC`,
      [req.params.id]
    );
    res.json(r.rows.map(x => ({
      id: x.id, partyId: x.party_id, userPhone: x.user_phone,
      userName: x.user_name, status: x.status, createdAt: x.created_at,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/party_requests/:id/resolve', async (req, res) => {
  try {
    const { status, userPhone } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Bad status' });

    const rRes = await pool.query('SELECT * FROM party_requests WHERE id=$1', [req.params.id]);
    if (rRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const request = rRes.rows[0];

    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [request.party_id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Party not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Не глава' });

    await pool.query(
      `UPDATE party_requests SET status=$1, resolved_at=$2 WHERE id=$3`,
      [status, new Date().toISOString(), req.params.id]
    );

    if (status === 'approved') {
      const cntRes = await pool.query('SELECT COUNT(*) FROM party_members WHERE party_id=$1', [request.party_id]);
      if (parseInt(cntRes.rows[0].count) >= 3) {
        return res.status(400).json({ error: 'Партия уже заполнена' });
      }
      await pool.query(
        `INSERT INTO party_members (party_id, phone, name, joined_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [request.party_id, request.user_phone, request.user_name, new Date().toISOString()]
      );

      await createNotification(
        request.user_phone,
        'system',
        '✅ Заявка в партию одобрена',
        `Добро пожаловать в «${pRes.rows[0].name}»!`,
        'party',
        String(request.party_id)
      );
    } else {
      await createNotification(
        request.user_phone,
        'system',
        '❌ Заявка в партию отклонена',
        pRes.rows[0].name,
        'parties',
        null
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/parties/:id/members/:phone', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Не глава' });
    if (req.params.phone === userPhone) return res.status(400).json({ error: 'Себя нельзя убрать' });

    await pool.query(
      'DELETE FROM party_members WHERE party_id=$1 AND phone=$2',
      [req.params.id, req.params.phone]
    );
    await pool.query(
      'DELETE FROM party_candidates WHERE party_id=$1 AND phone=$2',
      [req.params.id, req.params.phone]
    );

    await createNotification(
      req.params.phone,
      'system',
      '❌ Вас исключили из партии',
      pRes.rows[0].name,
      'parties',
      null
    );

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties/:id/leave', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone === userPhone) {
      return res.status(400).json({ error: 'Глава не может выйти. Удали партию.' });
    }

    await pool.query(
      'DELETE FROM party_members WHERE party_id=$1 AND phone=$2',
      [req.params.id, userPhone]
    );
    await pool.query(
      'DELETE FROM party_candidates WHERE party_id=$1 AND phone=$2',
      [req.params.id, userPhone]
    );

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties/:id/candidate', async (req, res) => {
  try {
    const { userPhone, candidatePhone, candidateName } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Не глава' });

    const memRes = await pool.query(
      'SELECT * FROM party_members WHERE party_id=$1 AND phone=$2',
      [req.params.id, candidatePhone]
    );
    if (memRes.rows.length === 0) return res.status(400).json({ error: 'Этот ЖИ не в партии' });

    await pool.query(
      `INSERT INTO party_candidates (party_id, phone, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (party_id) DO UPDATE SET phone=$2, name=$3`,
      [req.params.id, candidatePhone, candidateName]
    );

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/parties/:id/candidate', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const pRes = await pool.query('SELECT * FROM parties WHERE id=$1', [req.params.id]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (pRes.rows[0].leader_phone !== userPhone) return res.status(403).json({ error: 'Не глава' });

    await pool.query('DELETE FROM party_candidates WHERE party_id=$1', [req.params.id]);
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
      id: m.id, partyId: m.party_id, from: m.from_phone,
      fromName: m.from_name, text: m.text, replyTo: m.reply_to,
      voice: m.voice, voiceDuration: m.voice_duration,
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/party_messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO party_messages (id, party_id, from_phone, from_name, text, reply_to, voice, voice_duration, time, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.partyId, m.from, m.fromName, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.time, m.date || null]
    );

    const partyRes = await pool.query('SELECT name FROM parties WHERE id=$1', [m.partyId]);
    const partyName = partyRes.rows[0]?.name || 'Партия';
    const membersRes = await pool.query(
      'SELECT phone FROM party_members WHERE party_id=$1 AND phone <> $2',
      [m.partyId, m.from]
    );
    const preview = m.voice ? '🎤 Голосовое' : (m.text || '').slice(0, 60);
    for (const mbr of membersRes.rows) {
      await createNotification(
        mbr.phone,
        'message',
        `🏛️ ${partyName}`,
        `${m.fromName}: ${preview}`,
        'party_chat',
        String(m.partyId)
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ДОЛГИ
// ═══════════════════════════════════════════════════════
app.get('/api/debts', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM debts ORDER BY id DESC');
    res.json(r.rows.map(d => ({
      id: d.id,
      debtorPhone: d.debtor_phone,
      debtorName: d.debtor_name,
      creditorPhone: d.creditor_phone,
      creditorName: d.creditor_name,
      amount: d.amount,
      reason: d.reason,
      dueDate: d.due_date,
      status: d.status,
      createdAt: d.created_at,
      paidAt: d.paid_at,
      createdBy: d.created_by,
      isGovernment: d.is_government || false,
      appealStatus: d.appeal_status || null,
      appealReason: d.appeal_reason || null,
      appealPrComment: d.appeal_pr_comment || null,
      appealCreatedAt: d.appeal_created_at || null,
      appealResolvedAt: d.appeal_resolved_at || null,
      appealResolvedBy: d.appeal_resolved_by || null,
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

    await createNotification(
      d.debtorPhone,
      'system',
      d.isGovernment ? `🏛️ Новый гос. долг: ${d.amount}₮` : `💸 Новый долг: ${d.amount}₮`,
      d.reason,
      'debts',
      null
    );

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
      return res.status(400).json({
        error: `Не хватает ${debt.amount - (debtor.tonki || 0)} ₮`,
        need: debt.amount - (debtor.tonki || 0),
      });
    }

    await pool.query(
      'UPDATE users SET tonki = tonki - $1 WHERE phone = $2',
      [debt.amount, debt.debtor_phone]
    );

    let recipientPhone = debt.creditor_phone;
    let recipientName = debt.creditor_name;

    if (debt.is_government) {
      const prRes = await pool.query("SELECT phone, first_name, last_name FROM users WHERE status='ПР' LIMIT 1");
      if (prRes.rows.length > 0) {
        recipientPhone = prRes.rows[0].phone;
        recipientName = `${prRes.rows[0].first_name} ${prRes.rows[0].last_name}`;
      }
    }

    const credRes = await pool.query('SELECT * FROM users WHERE phone=$1', [recipientPhone]);
    if (credRes.rows.length > 0) {
      await pool.query(
        'UPDATE users SET tonki = tonki + $1 WHERE phone = $2',
        [debt.amount, recipientPhone]
      );
    }

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE debts SET status='paid', paid_at=$1 WHERE id=$2`,
      [now, req.params.id]
    );

    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Date.now() + Math.floor(Math.random() * 100000),
        'system', '💸 Долги', null, 'БОТ',
        `💵 ${debt.debtor_name} выплатил ${debt.amount}₮ → ${recipientName}`,
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      ]
    );

    await createNotification(
      recipientPhone,
      'system',
      `💰 Вам выплатили долг: ${debt.amount}₮`,
      `От ${debt.debtor_name}`,
      'debts',
      null
    );

    res.json({ ok: true, paidAt: now, amount: debt.amount, recipient: recipientName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts/:id/mark_paid', async (req, res) => {
  try {
    const { markedBy, markedByPhone } = req.body;
    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    if (debt.status === 'paid') return res.status(400).json({ error: 'Уже выплачен' });

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [markedByPhone]);
    const isPR = uRes.rows.length > 0 && uRes.rows[0].status === 'ПР';
    const isCreditor = debt.creditor_phone === markedByPhone;

    if (!isPR && !isCreditor) return res.status(403).json({ error: 'Нет прав' });

    const now = new Date().toISOString();
    await pool.query(
      `UPDATE debts SET status='paid', paid_at=$1 WHERE id=$2`,
      [now, req.params.id]
    );

    await createNotification(
      debt.debtor_phone,
      'system',
      '✅ Долг закрыт',
      `${debt.creditor_name} пометил долг как выплаченный`,
      'debts',
      null
    );

    res.json({ ok: true, paidAt: now });
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

    const now = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    await pool.query(
      `UPDATE debts SET
        appeal_status='pending',
        appeal_reason=$1,
        appeal_pr_comment=NULL,
        appeal_created_at=$2,
        appeal_resolved_at=NULL,
        appeal_resolved_by=NULL
       WHERE id=$3`,
      [reason.trim(), now, req.params.id]
    );

    const prRes = await pool.query("SELECT phone FROM users WHERE status='ПР' LIMIT 1");
    if (prRes.rows.length > 0) {
      await createNotification(
        prRes.rows[0].phone,
        'appeal',
        `📝 Апелляция на долг`,
        `${debt.debtor_name}: ${reason.trim()}`,
        'debts_admin',
        null
      );
    }

    await pool.query(
      `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Date.now() + Math.floor(Math.random() * 100000),
        'system', '📝 Апелляция на долг', null, 'БОТ',
        `📝 ${debt.debtor_name} обжалует долг ${debt.amount}₮: «${reason.trim()}»`,
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      ]
    );

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/debts/:id/appeal/resolve', async (req, res) => {
  try {
    const { status, prComment, resolvedBy, resolvedByPhone } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Bad status' });

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [resolvedByPhone]);
    if (uRes.rows.length === 0 || uRes.rows[0].status !== 'ПР') {
      return res.status(403).json({ error: 'Только ПР' });
    }

    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    const now = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (status === 'approved') {
      await pool.query('DELETE FROM debts WHERE id=$1', [req.params.id]);

      await createNotification(
        debt.debtor_phone,
        'system',
        '✅ Апелляция одобрена',
        `Долг ${debt.amount}₮ снят`,
        'debts',
        null
      );

      await pool.query(
        `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          Date.now() + Math.floor(Math.random() * 100000),
          'system', '📝 Апелляция одобрена', null, 'БОТ',
          `✅ ${debt.debtor_name} — долг ${debt.amount}₮ снят (апелляция одобрена)`,
          new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
        ]
      );
    } else {
      await pool.query(
        `UPDATE debts SET
          appeal_status='rejected',
          appeal_pr_comment=$1,
          appeal_resolved_at=$2,
          appeal_resolved_by=$3
         WHERE id=$4`,
        [prComment || null, now, resolvedBy || null, req.params.id]
      );

      await createNotification(
        debt.debtor_phone,
        'system',
        '❌ Апелляция отклонена',
        prComment || 'Без причины',
        'debts',
        null
      );
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/debts/:id', async (req, res) => {
  try {
    const { deletedBy, deletedByPhone } = req.body;
    const debtRes = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
    if (debtRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const debt = debtRes.rows[0];

    const uRes = await pool.query('SELECT status FROM users WHERE phone=$1', [deletedByPhone]);
    const isPR = uRes.rows.length > 0 && uRes.rows[0].status === 'ПР';
    const isCreator = debt.created_by === deletedBy;

    if (!isPR && !isCreator) return res.status(403).json({ error: 'Нет прав' });

    await pool.query('DELETE FROM debts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// РЕЙТИНГ
// ═══════════════════════════════════════════════════════
app.get('/api/leaderboard', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT phone, first_name, last_name, status, aura, tonki, avatar
      FROM users WHERE status <> 'ПР' ORDER BY aura DESC
    `);
    res.json(r.rows.map(u => ({
      phone: u.phone,
      firstName: u.first_name,
      lastName: u.last_name,
      status: u.status,
      aura: u.aura,
      tonki: u.tonki,
      avatar: u.avatar,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// РЕАКЦИИ
// ═══════════════════════════════════════════════════════
app.get('/api/reactions', async (req, res) => {
  try {
    const { chat_type, chat_id, message_ids } = req.query;
    if (!chat_type || !message_ids) return res.json([]);
    const ids = message_ids.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
    if (ids.length === 0) return res.json([]);

    let q = `SELECT * FROM message_reactions WHERE chat_type=$1 AND message_id = ANY($2::bigint[])`;
    let params = [chat_type, ids];
    if (chat_id) { q += ` AND chat_id=$3`; params.push(chat_id); }
    const r = await pool.query(q, params);
    res.json(r.rows.map(x => ({
      id: x.id, messageId: x.message_id, chatType: x.chat_type, chatId: x.chat_id,
      fromPhone: x.from_phone, fromName: x.from_name, emoji: x.emoji,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reactions/toggle', async (req, res) => {
  try {
    const { messageId, chatType, chatId, fromPhone, fromName, emoji } = req.body;
    if (!messageId || !chatType || !fromPhone || !emoji) return res.status(400).json({ error: 'Bad params' });

    const existing = await pool.query(
      `SELECT id FROM message_reactions 
       WHERE message_id=$1 AND chat_type=$2 AND COALESCE(chat_id,'')=COALESCE($3,'') 
       AND from_phone=$4 AND emoji=$5`,
      [messageId, chatType, chatId || null, fromPhone, emoji]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM message_reactions WHERE id=$1', [existing.rows[0].id]);
      return res.json({ ok: true, action: 'removed' });
    }

    await pool.query(
      `INSERT INTO message_reactions (id, message_id, chat_type, chat_id, from_phone, from_name, emoji)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [Date.now() + Math.floor(Math.random() * 1000), messageId, chatType, chatId || null, fromPhone, fromName, emoji]
    );
    res.json({ ok: true, action: 'added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// ГРУППЫ
// ═══════════════════════════════════════════════════════
app.get('/api/groups', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM group_chats ORDER BY created_at DESC');
    const groups = [];
    for (const g of r.rows) {
      const members = await pool.query(
        'SELECT phone, name FROM group_members WHERE group_id=$1',
        [g.id]
      );
      groups.push({
        id: g.id, name: g.name, avatar: g.avatar,
        creatorPhone: g.creator_phone, createdAt: g.created_at,
        members: members.rows.map(m => ({ phone: m.phone, name: m.name })),
      });
    }
    res.json(groups);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { name, creatorPhone, creatorName, members } = req.body;
    if (!name || !creatorPhone || !members || members.length < 1) return res.status(400).json({ error: 'Bad params' });
    if (members.length > 20) return res.status(400).json({ error: 'Максимум 20 участников' });

    const id = Date.now();
    await pool.query(`INSERT INTO group_chats (id, name, creator_phone) VALUES ($1,$2,$3)`, [id, name, creatorPhone]);
    await pool.query(`INSERT INTO group_members (group_id, phone, name) VALUES ($1,$2,$3)`, [id, creatorPhone, creatorName]);

    for (const m of members) {
      if (m.phone === creatorPhone) continue;
      await pool.query(
        `INSERT INTO group_members (group_id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [id, m.phone, m.name]
      );
      await createNotification(m.phone, 'system', `👥 Добавлен в группу «${name}»`, `Создатель: ${creatorName}`, 'group_chat', String(id));
    }

    res.json({ ok: true, groupId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups/:id/rename', async (req, res) => {
  try {
    const { userPhone, name } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.id]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (g.rows[0].creator_phone !== userPhone) return res.status(403).json({ error: 'Только создатель' });

    await pool.query('UPDATE group_chats SET name=$1 WHERE id=$2', [name, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups/:id/avatar', async (req, res) => {
  try {
    const { userPhone, avatar } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.id]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (g.rows[0].creator_phone !== userPhone) return res.status(403).json({ error: 'Только создатель' });

    await pool.query('UPDATE group_chats SET avatar=$1 WHERE id=$2', [avatar || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups/:id/members/add', async (req, res) => {
  try {
    const { userPhone, memberPhone, memberName } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.id]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (g.rows[0].creator_phone !== userPhone) return res.status(403).json({ error: 'Только создатель' });

    const cnt = await pool.query('SELECT COUNT(*) FROM group_members WHERE group_id=$1', [req.params.id]);
    if (parseInt(cnt.rows[0].count) >= 20) return res.status(400).json({ error: 'Группа заполнена (20)' });

    await pool.query(
      'INSERT INTO group_members (group_id, phone, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [req.params.id, memberPhone, memberName]
    );

    await createNotification(memberPhone, 'system', `👥 Добавлен в группу «${g.rows[0].name}»`, null, 'group_chat', String(req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/groups/:id/members/:phone', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.id]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const isCreator = g.rows[0].creator_phone === userPhone;
    const isSelf = userPhone === req.params.phone;
    if (!isCreator && !isSelf) return res.status(403).json({ error: 'Нет прав' });
    if (req.params.phone === g.rows[0].creator_phone) return res.status(400).json({ error: 'Создатель не может выйти' });

    await pool.query('DELETE FROM group_members WHERE group_id=$1 AND phone=$2', [req.params.id, req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/groups/:id', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.id]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (g.rows[0].creator_phone !== userPhone) return res.status(403).json({ error: 'Только создатель' });

    await pool.query('DELETE FROM group_messages WHERE group_id=$1', [req.params.id]);
    await pool.query('DELETE FROM group_members WHERE group_id=$1', [req.params.id]);
    await pool.query('DELETE FROM group_chats WHERE id=$1', [req.params.id]);
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
      time: m.time, date: m.date,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/group_messages', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO group_messages (id, group_id, from_phone, from_name, from_avatar, text, reply_to, voice, voice_duration, time, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.groupId, m.from, m.fromName, m.fromAvatar || null, m.text || '', m.replyTo || null, m.voice || null, m.voiceDuration || null, m.time, m.date || null]
    );

    const groupRes = await pool.query('SELECT name FROM group_chats WHERE id=$1', [m.groupId]);
    const groupName = groupRes.rows[0]?.name || 'Группа';
    const membersRes = await pool.query(
      'SELECT phone FROM group_members WHERE group_id=$1 AND phone <> $2',
      [m.groupId, m.from]
    );
    const preview = m.voice ? '🎤 Голосовое' : (m.text || '').slice(0, 60);
    for (const mbr of membersRes.rows) {
      await createNotification(mbr.phone, 'message', `💬 ${groupName}`, `${m.fromName}: ${preview}`, 'group_chat', String(m.groupId));
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/group_messages/:groupId/clear', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const g = await pool.query('SELECT * FROM group_chats WHERE id=$1', [req.params.groupId]);
    if (g.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (g.rows[0].creator_phone !== userPhone) return res.status(403).json({ error: 'Только создатель' });

    await pool.query('DELETE FROM group_messages WHERE group_id=$1', [req.params.groupId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// НАСТРОЙКИ ЧАТА
// ═══════════════════════════════════════════════════════
app.get('/api/chat_settings/:phone', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM chat_settings WHERE phone=$1', [req.params.phone]);
    res.json(r.rows.map(x => ({
      chatType: x.chat_type, chatId: x.chat_id,
      clearedAt: x.cleared_at, deleted: x.deleted,
      blocked: x.blocked, lastReadId: x.last_read_id,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat_settings', async (req, res) => {
  try {
    const { phone, chatType, chatId, clearedAt, deleted, blocked, lastReadId } = req.body;
    if (!phone || !chatType || !chatId) return res.status(400).json({ error: 'Bad params' });

    await pool.query(
      `INSERT INTO chat_settings (phone, chat_type, chat_id, cleared_at, deleted, blocked, last_read_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (phone, chat_type, chat_id) DO UPDATE SET
         cleared_at = COALESCE($4, chat_settings.cleared_at),
         deleted = COALESCE($5, chat_settings.deleted),
         blocked = COALESCE($6, chat_settings.blocked),
         last_read_id = COALESCE($7, chat_settings.last_read_id)`,
      [phone, chatType, chatId, clearedAt || null, deleted, blocked, lastReadId || null]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages/clear_all', async (req, res) => {
  try {
    const { userPhone } = req.body;
    const u = await pool.query('SELECT status FROM users WHERE phone=$1', [userPhone]);
    if (u.rows.length === 0 || u.rows[0].status !== 'ПР') return res.status(403).json({ error: 'Только ПР' });
    await pool.query('DELETE FROM messages');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ (эндпоинты)
// ═══════════════════════════════════════════════════════
app.get('/api/notifications/:phone', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM notifications WHERE phone=$1 ORDER BY created_at DESC LIMIT 50',
      [req.params.phone]
    );
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

app.post('/api/notifications/:phone/read_all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=true WHERE phone=$1', [req.params.phone]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { phone, type, title, text, target, targetId } = req.body;
    if (!phone || !type || !title) return res.status(400).json({ error: 'Bad params' });
    await createNotification(phone, type, title, text, target, targetId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════
// АВТО-НАГРАДЫ (5.7, 5.11, 5.12)
// ═══════════════════════════════════════════════════════
const tickAutoRewards = async () => {
  try {
    // 5.7 Богач
    const richRes = await pool.query(`
      SELECT phone, first_name, last_name, tonki, aura
      FROM users WHERE status <> 'ПР' AND tonki > 300 AND last_rich_reward = false
    `);
    for (const u of richRes.rows) {
      await pool.query(
        'UPDATE users SET aura = COALESCE(aura, 0) + 2000, last_rich_reward = true WHERE phone = $1',
        [u.phone]
      );
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [
          Date.now() + Math.floor(Math.random() * 100000),
          u.phone, 2000,
          '💰 Богач (п. 5.7) — набрал >300₮',
          new Date().toLocaleString('ru-RU')
        ]
      );
      await createNotification(u.phone, 'reward', '💰 Богач', '+2000 ауры за >300₮', 'rewards', null);
    }

    // 5.11 Топ 1
    const today = new Date().toISOString().slice(0, 10);
    const top1Res = await pool.query(`
      SELECT phone, first_name, last_name, aura, top1_streak, last_top1_check
      FROM users WHERE status <> 'ПР' ORDER BY aura DESC LIMIT 1
    `);
    if (top1Res.rows.length > 0) {
      const top1 = top1Res.rows[0];
      if (top1.last_top1_check !== today) {
        const newStreak = (top1.top1_streak || 0) + 1;
        await pool.query(
          'UPDATE users SET top1_streak = $1, last_top1_check = $2 WHERE phone = $3',
          [newStreak, today, top1.phone]
        );

        if (newStreak >= 2) {
          await pool.query(
            'UPDATE users SET top1_streak = 0 WHERE phone <> $1 AND status <> $2',
            [top1.phone, 'ПР']
          );

          const alreadyRewardedToday = await pool.query(
            `SELECT id FROM aura_history WHERE phone = $1 AND reason LIKE '%Топ 1%' AND date >= $2`,
            [top1.phone, today]
          );
          if (alreadyRewardedToday.rows.length === 0) {
            await pool.query(
              'UPDATE users SET tonki = tonki + 10, aura = COALESCE(aura, 0) + 500 WHERE phone = $1',
              [top1.phone]
            );
            await pool.query(
              `INSERT INTO aura_history (id, phone, delta, reason, date)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
              [
                Date.now() + Math.floor(Math.random() * 100000),
                top1.phone, 500,
                '🏆 Топ 1 (п. 5.11) — 2+ дня на первом месте',
                new Date().toLocaleString('ru-RU')
              ]
            );
            await createNotification(top1.phone, 'reward', '🏆 Топ 1', '+10₮, +500 ауры', 'rewards', null);
          }
        }
      }
    }

    // 5.12 Главный пенсионер
    const pensionRes = await pool.query(`
      SELECT phone, first_name, last_name, pension_started_at
      FROM users
      WHERE has_pension = true AND last_pensioner_reward = false
        AND pension_started_at IS NOT NULL
        AND pension_started_at < NOW() - INTERVAL '90 days'
    `);
    for (const u of pensionRes.rows) {
      await pool.query(
        'UPDATE users SET tonki = tonki + 20, aura = COALESCE(aura, 0) + 1000, last_pensioner_reward = true WHERE phone = $1',
        [u.phone]
      );
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [
          Date.now() + Math.floor(Math.random() * 100000),
          u.phone, 1000,
          '👴 Главный пенсионер (п. 5.12) — 3 месяца на пенсии',
          new Date().toLocaleString('ru-RU')
        ]
      );
      await createNotification(u.phone, 'reward', '👴 Главный пенсионер', '+20₮, +1000 ауры', 'rewards', null);
    }

    await pool.query(`
      UPDATE users SET pension_started_at = NOW()
      WHERE has_pension = true AND pension_started_at IS NULL
    `);
  } catch (err) { console.error('tickAutoRewards:', err.message); }
};

app.get('/api/debug/firebase', (req, res) => {
  try {
    const env = process.env.FIREBASE_SERVICE_ACCOUNT;
    let parsed = null;
    let parseError = null;
    if (env) {
      try {
        parsed = JSON.parse(env);
      } catch (e) {
        parseError = e.message;
      }
    }
    res.json({
      hasEnv: !!env,
      envLength: env ? env.length : 0,
      envStart: env ? env.slice(0, 60) : null,
      parseOk: !!parsed,
      parseError,
      projectId: parsed ? parsed.project_id : null,
      clientEmail: parsed ? parsed.client_email : null,
      privateKeyStart: parsed && parsed.private_key ? parsed.private_key.slice(0, 30) : null,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// ═══════════════════════════════════════════════════════
// АВТО-ШТРАФЫ
// ═══════════════════════════════════════════════════════
const tickAutoFines = async () => {
  try {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const usersRes = await pool.query('SELECT * FROM users WHERE status <> $1', ['ПР']);

    for (const u of usersRes.rows) {
      if (u.is_banned) continue;
      const FINE_COOLDOWN = 6 * 60 * 60 * 1000;

      const lastSeen = u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0;
      const daysSinceSeen = lastSeen ? (now - lastSeen) / DAY : 999;
      const lastInactive = u.last_auto_inactive_at ? new Date(u.last_auto_inactive_at).getTime() : 0;
      if (daysSinceSeen >= 14 && (now - lastInactive) > FINE_COOLDOWN) {
        await applyAutoFine(u, {
          reason: '💤 Неактивность (п. 3.3)',
          fineAmount: 0, auraDelta: -400,
          stampDays: 2, stampReason: '3.3 — Неактивность',
          cooldownField: 'last_auto_inactive_at',
        });
      }

      const lastTax = u.last_tax_paid_at ? new Date(u.last_tax_paid_at).getTime() : 0;
      const daysSinceTax = lastTax ? (now - lastTax) / DAY : 999;
      const lastTaxFine = u.last_auto_tax_at ? new Date(u.last_auto_tax_at).getTime() : 0;
      if (daysSinceTax >= 4 && (now - lastTaxFine) > FINE_COOLDOWN) {
        await applyAutoFine(u, {
          reason: '📋 Налоги не оплачены (п. 3.11)',
          fineAmount: 5, auraDelta: -150,
          cooldownField: 'last_auto_tax_at',
        });
      }

      const profsRes = await pool.query('SELECT * FROM professions WHERE phone = $1', [u.phone]);
      const lastIdle = u.last_auto_idle_at ? new Date(u.last_auto_idle_at).getTime() : 0;
      for (const p of profsRes.rows) {
        const lastPaid = p.last_paid_at ? new Date(p.last_paid_at).getTime() : 0;
        const daysSincePay = lastPaid ? (now - lastPaid) / DAY : 999;
        if (daysSincePay >= 3 && (now - lastIdle) > FINE_COOLDOWN) {
          await applyAutoFine(u, {
            reason: `🚫 Бездельничество (п. 3.6) — ${p.profession}`,
            fineAmount: 10, auraDelta: -100,
            cooldownField: 'last_auto_idle_at',
          });
          break;
        }
      }

      const creditsRes = await pool.query(`SELECT * FROM credits WHERE user_phone = $1 AND status = 'active'`, [u.phone]);
      const lastCredit = u.last_auto_credit_at ? new Date(u.last_auto_credit_at).getTime() : 0;
      for (const c of creditsRes.rows) {
        if (c.due_date && new Date(c.due_date).getTime() < now && (now - lastCredit) > FINE_COOLDOWN) {
          const remaining = c.total_due - (c.paid || 0);
          await applyAutoFine(u, {
            reason: `💳 Кредит просрочен (п. 3.10) — ${remaining}₮`,
            fineAmount: 0, auraDelta: -300,
            stampDays: 30, stampReason: '3.10 — Кредит не возвращён',
            cooldownField: 'last_auto_credit_at',
          });
          break;
        }
      }

      const lastDebtor = u.last_auto_debtor_at ? new Date(u.last_auto_debtor_at).getTime() : 0;
      if (u.tonki < -200 && (now - lastDebtor) > FINE_COOLDOWN) {
        await pool.query(
          `UPDATE users SET
            is_banned = true, ban_type = 'forgiving',
            ban_reason = '3.17 — Должник (баланс -200₮ и ниже)',
            tonki = 50, last_auto_debtor_at = NOW()
          WHERE phone = $1`,
          [u.phone]
        );
        await createNotification(u.phone, 'system', '🕊️ Выселен по п. 3.17', 'Баланс -200₮ и ниже', null, null);
      }
    }
  } catch (err) { console.error('tickAutoFines:', err.message); }
};

const applyAutoFine = async (user, opts) => {
  try {
    if (opts.fineAmount > 0) {
      await pool.query(
        `INSERT INTO fines (id, phone, reason, amount, from_phone, from_name, date, paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [
          Date.now() + Math.floor(Math.random() * 1000),
          user.phone, opts.reason, opts.fineAmount,
          'auto', '🤖 Авто',
          new Date().toLocaleString('ru-RU')
        ]
      );
    }

    if (opts.auraDelta && opts.auraDelta !== 0) {
      const newAura = (user.aura || 0) + opts.auraDelta;
      let newStatus = user.status;
      if (user.status === 'ПМ' && newAura < 9800) newStatus = 'ЖИ';
      await pool.query('UPDATE users SET aura = $1, status = $2 WHERE phone = $3', [newAura, newStatus, user.phone]);
      await pool.query(
        `INSERT INTO aura_history (id, phone, delta, reason, date)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [Date.now() + Math.floor(Math.random() * 1000), user.phone, opts.auraDelta, `⚠️ Автоштраф: ${opts.reason}`, new Date().toLocaleString('ru-RU')]
      );
    }

    if (opts.stampDays) {
      const until = new Date(Date.now() + opts.stampDays * 24 * 60 * 60 * 1000).toISOString();
      await pool.query(
        `UPDATE users SET is_banned = false, ban_reason = $1, ban_type = 'stamp', stamp_until = $2 WHERE phone = $3`,
        [opts.stampReason, until, user.phone]
      );
    }

    if (opts.cooldownField) {
      await pool.query(`UPDATE users SET ${opts.cooldownField} = NOW() WHERE phone = $1`, [user.phone]);
    }

    await createNotification(
      user.phone,
      'fine',
      `⚠️ Автоштраф: ${opts.reason}`,
      `${opts.fineAmount > 0 ? opts.fineAmount + '₮ ' : ''}${opts.auraDelta ? opts.auraDelta + ' ауры' : ''}${opts.stampDays ? ' штамм ' + opts.stampDays + ' дн.' : ''}`,
      'fines',
      null
    );
  } catch (err) { console.error('applyAutoFine:', err.message); }
};

// ═══════════════════════════════════════════════════════
// ФАРМ АУРЫ (5.13)
// ═══════════════════════════════════════════════════════
const tickFarmAura = async () => {
  try {
    const res = await pool.query(`
      SELECT phone, first_name, last_name, aura FROM users
      WHERE status <> 'ПР' AND aura >= 12000 AND farm_aura_applied = false
    `);
    for (const u of res.rows) {
      await pool.query('UPDATE users SET farm_aura_applied = true WHERE phone = $1', [u.phone]);
      await createNotification(u.phone, 'reward', '💎 Фарм ауры', 'Скидка 1₮ на всё (кроме налогов)', 'profile', null);
    }

    await pool.query(`
      UPDATE users SET farm_aura_applied = false
      WHERE status <> 'ПР' AND aura < 12000 AND farm_aura_applied = true
    `);
  } catch (err) { console.error('tickFarmAura:', err.message); }
};

setInterval(tickAutoRewards, 60 * 60 * 1000);
setTimeout(tickAutoRewards, 30 * 1000);

setInterval(tickAutoFines, 6 * 60 * 60 * 1000);
setTimeout(tickAutoFines, 60 * 1000);

setInterval(tickFarmAura, 60 * 60 * 1000);
setTimeout(tickFarmAura, 20 * 1000);

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
// ПРАЗДНИКИ
// ═══════════════════════════════════════════════════════
const tickHolidays = async () => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const sendSystemMsg = async (text) => {
      await pool.query(
        `INSERT INTO messages (id, from_phone, from_name, from_avatar, from_status, text, time, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          Date.now() + Math.floor(Math.random() * 100000),
          'system', '🎉 Праздник', null, 'БОТ', text,
          new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
        ]
      );
    };

    if (month === 4 && day === 10) {
      const usersRes = await pool.query('SELECT phone, last_okpf_day_year FROM users WHERE status <> $1', ['ПР']);
      let count = 0;
      for (const u of usersRes.rows) {
        if (u.last_okpf_day_year === year) continue;
        await pool.query('UPDATE users SET tonki = tonki + 10, last_okpf_day_year = $1 WHERE phone = $2', [year, u.phone]);
        await createNotification(u.phone, 'reward', '🎉 День ОКПФ', '+10₮', 'rewards', null);
        count++;
      }
      if (count > 0) await sendSystemMsg(`🎉 С Днём ОКПФ! +10 ₮ всем ЖИ (${count} чел.)`);
    }

    if (month === 10 && day === 23) {
      const usersRes = await pool.query('SELECT phone, last_pf_day_year FROM users WHERE status <> $1', ['ПР']);
      let count = 0;
      for (const u of usersRes.rows) {
        if (u.last_pf_day_year === year) continue;
        await pool.query('UPDATE users SET tonki = tonki + 20, last_pf_day_year = $1 WHERE phone = $2', [year, u.phone]);
        await createNotification(u.phone, 'reward', '🏚️ День ПФ', '+20₮', 'rewards', null);
        count++;
      }
      if (count > 0) await sendSystemMsg(`🏚️ С Днём ПФ! +20 ₮ всем ЖИ (${count} чел.)`);
    }

    if ((month === 12 && day === 9) || (month === 3 && day === 21)) {
      const usersRes = await pool.query(
        `SELECT u.phone, u.last_vacation_year FROM users u
         WHERE u.status <> 'ПР'
         AND EXISTS (SELECT 1 FROM professions p WHERE p.phone = u.phone)`
      );
      let count = 0;
      for (const u of usersRes.rows) {
        if (u.last_vacation_year === year) continue;
        await pool.query('UPDATE users SET tonki = tonki + 10, last_vacation_year = $1 WHERE phone = $2', [year, u.phone]);
        await createNotification(u.phone, 'reward', '🏖️ Отпуск', '+10₮', 'rewards', null);
        count++;
      }
      if (count > 0) await sendSystemMsg(`🏖️ Отпуск! +10 ₮ работающим ЖИ (${count} чел.)`);
    }

    const inSummerWindow =
      (month === 5 && day >= 23) || (month === 6) || (month === 7) || (month === 8 && day <= 23);

    if (inSummerWindow) {
      const usersRes = await pool.query(
        `SELECT u.phone, u.last_burmaldeem_month FROM users u
         WHERE u.status <> 'ПР'
         AND EXISTS (SELECT 1 FROM professions p WHERE p.phone = u.phone)`
      );
      let count = 0;
      for (const u of usersRes.rows) {
        if (u.last_burmaldeem_month === monthKey) continue;
        await pool.query('UPDATE users SET tonki = tonki + 40, last_burmaldeem_month = $1 WHERE phone = $2', [monthKey, u.phone]);
        await createNotification(u.phone, 'reward', '☀️ Летние бурмалдим', '+40₮', 'rewards', null);
        count++;
      }
      if (count > 0) await sendSystemMsg(`☀️ Летние бурмалдим! +40 ₮ работающим ЖИ (${count} чел.)`);
    }
  } catch (err) { console.error('tickHolidays:', err.message); }
};

setInterval(tickHolidays, 60 * 60 * 1000);
setTimeout(tickHolidays, 10 * 1000);

// ═══════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('🚀 Сервер запущен на порту ' + PORT);
});