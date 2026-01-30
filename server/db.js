import pg from 'pg';

const { Pool } = pg;

const INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE) || 1500;

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.error('⚠️  DATABASE_URL is not set!');
  console.error('👉 In Railway: click "+ New" → "Database" → "PostgreSQL"');
}

export const db = {
  async init() {
    if (!pool) {
      console.error('❌ Cannot initialize: DATABASE_URL not configured');
      console.error('👉 Add PostgreSQL in Railway, then redeploy');
      return;
    }
    
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS account (
          id INTEGER PRIMARY KEY DEFAULT 1,
          balance DECIMAL(12,2) NOT NULL DEFAULT ${INITIAL_BALANCE},
          initial_balance DECIMAL(12,2) NOT NULL DEFAULT ${INITIAL_BALANCE},
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS positions (
          id SERIAL PRIMARY KEY,
          market_id TEXT NOT NULL,
          market_slug TEXT,
          market_title TEXT NOT NULL,
          outcome TEXT NOT NULL,
          shares DECIMAL(12,6) NOT NULL,
          entry_price DECIMAL(8,6) NOT NULL,
          current_price DECIMAL(8,6) NOT NULL,
          invested DECIMAL(12,2) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(market_id, outcome)
        );

        CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          market_id TEXT NOT NULL,
          market_slug TEXT,
          market_title TEXT NOT NULL,
          outcome TEXT NOT NULL,
          action TEXT NOT NULL,
          shares DECIMAL(12,6) NOT NULL,
          price DECIMAL(8,6) NOT NULL,
          total DECIMAL(12,2) NOT NULL,
          pnl DECIMAL(12,2) DEFAULT 0,
          reasoning TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS thoughts (
          id SERIAL PRIMARY KEY,
          trade_id INTEGER REFERENCES trades(id),
          content TEXT NOT NULL,
          market_title TEXT,
          action TEXT,
          outcome TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        INSERT INTO account (id, balance, initial_balance) 
        VALUES (1, ${INITIAL_BALANCE}, ${INITIAL_BALANCE}) 
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Database initialized');
    } finally {
      client.release();
    }
  },

  async getAccount() {
    if (!pool) return { balance: INITIAL_BALANCE, initial_balance: INITIAL_BALANCE };
    const { rows } = await pool.query('SELECT * FROM account WHERE id = 1');
    return rows[0] || { balance: INITIAL_BALANCE, initial_balance: INITIAL_BALANCE };
  },

  async updateBalance(newBalance) {
    if (!pool) return;
    await pool.query(
      'UPDATE account SET balance = $1, updated_at = NOW() WHERE id = 1',
      [newBalance]
    );
  },

  async getPositions() {
    if (!pool) return [];
    const { rows } = await pool.query(
      'SELECT * FROM positions ORDER BY created_at DESC'
    );
    return rows;
  },

  async getPosition(marketId, outcome) {
    if (!pool) return null;
    const { rows } = await pool.query(
      'SELECT * FROM positions WHERE market_id = $1 AND outcome = $2',
      [marketId, outcome]
    );
    return rows[0];
  },

  async upsertPosition(position) {
    if (!pool) return;
    const existing = await this.getPosition(position.market_id, position.outcome);
    
    if (existing) {
      await pool.query(`
        UPDATE positions SET 
          shares = $1, current_price = $2, invested = $3, updated_at = NOW()
        WHERE market_id = $4 AND outcome = $5
      `, [position.shares, position.current_price, position.invested, position.market_id, position.outcome]);
    } else {
      await pool.query(`
        INSERT INTO positions (market_id, market_slug, market_title, outcome, shares, entry_price, current_price, invested)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        position.market_id, position.market_slug, position.market_title,
        position.outcome, position.shares, position.entry_price,
        position.current_price, position.invested
      ]);
    }
  },

  async deletePosition(marketId, outcome) {
    if (!pool) return;
    await pool.query(
      'DELETE FROM positions WHERE market_id = $1 AND outcome = $2',
      [marketId, outcome]
    );
  },

  async updatePositionPrice(marketId, outcome, currentPrice) {
    if (!pool) return;
    await pool.query(
      'UPDATE positions SET current_price = $1, updated_at = NOW() WHERE market_id = $2 AND outcome = $3',
      [currentPrice, marketId, outcome]
    );
  },

  async getTrades(limit = 50) {
    if (!pool) return [];
    const { rows } = await pool.query(
      'SELECT * FROM trades ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return rows;
  },

  async addTrade(trade) {
    if (!pool) return null;
    const { rows } = await pool.query(`
      INSERT INTO trades (market_id, market_slug, market_title, outcome, action, shares, price, total, pnl, reasoning)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      trade.market_id, trade.market_slug, trade.market_title,
      trade.outcome, trade.action, trade.shares,
      trade.price, trade.total, trade.pnl || 0, trade.reasoning || ''
    ]);
    return rows[0]?.id;
  },

  async getThoughts(limit = 20) {
    if (!pool) return [];
    const { rows } = await pool.query(
      'SELECT * FROM thoughts ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return rows;
  },

  async addThought(tradeId, content) {
    if (!pool) return;
    const { rows: trades } = await pool.query(
      'SELECT market_title, action, outcome FROM trades WHERE id = $1',
      [tradeId]
    );
    const trade = trades[0];

    await pool.query(`
      INSERT INTO thoughts (trade_id, content, market_title, action, outcome)
      VALUES ($1, $2, $3, $4, $5)
    `, [tradeId, content, trade?.market_title, trade?.action, trade?.outcome]);
  },

  async getStats() {
    const account = await this.getAccount();
    const positions = await this.getPositions();
    
    let trades = [];
    if (pool) {
      const result = await pool.query('SELECT * FROM trades');
      trades = result.rows;
    }

    const completedTrades = trades.filter(t => t.action === 'SELL');
    const wins = completedTrades.filter(t => parseFloat(t.pnl || 0) > 0).length;
    const losses = completedTrades.filter(t => parseFloat(t.pnl || 0) < 0).length;
    const totalPnl = completedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);

    const unrealizedPnl = positions.reduce((sum, p) => {
      return sum + (parseFloat(p.shares) * parseFloat(p.current_price) - parseFloat(p.invested));
    }, 0);

    const bestTrade = completedTrades.reduce(
      (best, t) => (parseFloat(t.pnl || 0) > parseFloat(best?.pnl || 0) ? t : best),
      null
    );
    const worstTrade = completedTrades.reduce(
      (worst, t) => (parseFloat(t.pnl || 0) < parseFloat(worst?.pnl || 0) ? t : worst),
      null
    );

    return {
      balance: parseFloat(account.balance),
      initial_balance: parseFloat(account.initial_balance),
      total_pnl: totalPnl,
      unrealized_pnl: unrealizedPnl,
      total_trades: trades.length,
      wins,
      losses,
      win_rate: completedTrades.length > 0 ? (wins / completedTrades.length * 100).toFixed(1) : 0,
      best_trade: bestTrade,
      worst_trade: worstTrade,
      active_positions: positions.length
    };
  }
};
