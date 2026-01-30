# Clobster 🦞

Autonomous Polymarket trading bot — Railway deployment.

## Deploy on Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/clobster)

### Quick Deploy:

1. Click the button above or go to [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Select this repository
4. Railway auto-detects Node.js and deploys

### Add PostgreSQL:

1. In your project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Railway automatically sets `DATABASE_URL`

### Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Auto-set by Railway | PostgreSQL connection |
| `INITIAL_BALANCE` | `1500` | Starting balance |
| `OPENAI_API_KEY` | Your key | Optional, for AI reasoning |

### Redeploy

After adding PostgreSQL and variables, click **Redeploy**.

---

## Features

- Real-time Polymarket analysis
- Automated trading every 2 minutes (node-cron)
- PostgreSQL database
- AI-powered trade reasoning (optional)
- Ocean-themed pixel art UI

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Express.js
- **Database:** PostgreSQL
- **Cron:** node-cron

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run development (frontend + backend)
npm run dev

# Or separately:
npm run dev:server  # Backend on :3000
npm run dev:client  # Frontend on :5173
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Full dashboard data |
| POST | `/api/analyze` | Trigger manual analysis |
| GET | `/api/health` | Health check |

## Project Structure

```
├── server.js          # Express server + cron
├── server/
│   ├── db.js          # PostgreSQL operations
│   ├── trading.js     # Trading logic
│   ├── polymarket.js  # Polymarket API
│   └── llm.js         # AI reasoning
├── src/               # React frontend
├── public/            # Static assets
└── dist/              # Built frontend (auto-generated)
```

## Links

- [Twitter](https://x.com/ClobsterClaude)
- [Polymarket](https://polymarket.com)

---

Built with claws and code 🦞
