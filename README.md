# Nexus Finance

Live Demo: `https://your-domain.com`

## VI
Nexus Finance là nền tảng theo dõi tài chính và thị trường theo thời gian thực: crypto, cổ phiếu, forex, AI Advisor, bản đồ toàn cầu và giao dịch.

## EN
Nexus Finance is a real-time finance platform for crypto, stocks, forex, AI advisory, global map insights, and trading analysis.

## ES
Nexus Finance es una plataforma financiera en tiempo real con cripto, acciones, forex, asesor IA, mapa global y analitica de trading.

## Main Features
- Real-time watchlist: crypto, stocks, fx
- AI Advisor chat + meal/budget planner
- Trading screen: candles, indicators, market depth
- Global map 2D/3D with country insights
- Portfolio and analytics dashboard
- Multi-language UI: Vietnamese, English, Spanish

## Click Guide (Where to click)
1. Open `https://your-domain.com`.
2. Top-right: choose language `VIE / EN / ES`.
3. Left sidebar:
- `Dashboard`: overview + market ticker
- `AI Advisor`: chat AI, budget/meal analysis
- `Global Map`: 2D/3D map, click country for details
- `Portfolio`: allocation and holdings
- `Analytics`: volatility, momentum, correlation
- `Trading`: chart, indicators, watchlist, pair search
- `Settings`: API keys, AI provider/model, system options

## Direct URLs
- `https://your-domain.com/vi/dashboard`
- `https://your-domain.com/en/dashboard`
- `https://your-domain.com/es/dashboard`

## Run Local
1. Open 2 terminals at project root.
2. Terminal 1:
```bash
./scripts/dev-backend.sh
```
3. Terminal 2:
```bash
./scripts/dev-frontend.sh
```
4. Open `http://localhost:3000`.

## Run Online
1. Push source code to GitHub.
2. Import repository into Vercel.
3. Set root directory to `frontend`.
4. Set environment variable `USE_INTERNAL_API=1`.
5. Deploy and open `https://your-project.vercel.app`.

## Domain Options
- Free, easiest: subdomain from platform deploy
- Vercel: `your-project.vercel.app`
- Netlify: `your-project.netlify.app`
- Render: `your-project.onrender.com`
- Railway: `your-project.up.railway.app`
- Custom domain (professional): buy domain (`.com`, `.io`, `.ai`) and connect DNS in hosting dashboard

## Thanks
- Thank you for visiting Nexus Finance. 🙌
- Cam on ban da ghe tham Nexus Finance. 💙
- Gracias por visitar Nexus Finance. 🚀

## Current Limitations (Vercel-only)
- Settings/API keys are stored in serverless memory and can reset after cold start.
- No Redis/SQLite persistence in this mode.
- Heavy workloads and long-running tasks are limited by Vercel Hobby quotas.
