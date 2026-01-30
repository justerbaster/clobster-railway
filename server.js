import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/db.js';
import { TradingService } from './server/trading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from dist (built React app)
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize trading service
const tradingService = new TradingService();

// ============== API ROUTES ==============

// Dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await db.getStats();
    const positions = await db.getPositions();
    const trades = await db.getTrades(20);
    const thoughts = await db.getThoughts(10);

    const positionsWithPnl = positions.map(p => ({
      ...p,
      current_value: p.shares * p.current_price,
      pnl: (p.shares * p.current_price) - p.invested,
      pnl_percent: ((p.shares * p.current_price - p.invested) / p.invested * 100).toFixed(2)
    }));

    res.json({
      stats,
      positions: positionsWithPnl,
      trades,
      thoughts,
      last_update: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual analyze trigger
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('[API] Manual analysis triggered');
    await tradingService.analyze();
    res.json({ success: true, message: 'Analysis completed' });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ============== CRON JOB ==============

// Run trading analysis every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('[CRON] Running scheduled analysis...');
  try {
    await tradingService.analyze();
    console.log('[CRON] Analysis completed');
  } catch (error) {
    console.error('[CRON] Error:', error);
  }
});

// ============== START SERVER ==============

async function start() {
  try {
    // Initialize database
    await db.init();
    console.log('[DB] Database initialized');

    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log('[CRON] Trading analysis scheduled every 2 minutes');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
