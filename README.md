# Nexus Finance

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vusinhthanh1892007-boop/finace-nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/vusinhthanh1892007-boop/finace-nexus/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://finace-nexus.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](./docker-compose.microservices.yml)

## Live Demo

- [finace-nexus.vercel.app](https://finace-nexus.vercel.app)
- [finace-nexus-git-main-vusinhthanh1892007-boops-projects.vercel.app](https://finace-nexus-git-main-vusinhthanh1892007-boops-projects.vercel.app)
- [finace-nexus-qchj1vvgi-vusinhthanh1892007-boops-projects.vercel.app](https://finace-nexus-qchj1vvgi-vusinhthanh1892007-boops-projects.vercel.app)

---

## VI

Nexus Finance là nền tảng theo dõi tài chính và thị trường theo thời gian thực: crypto, cổ phiếu, forex, AI Advisor, bản đồ toàn cầu và giao dịch.

## EN

Nexus Finance is a real-time finance platform for crypto, stocks, forex, AI advisory, global map insights, and trading analysis.

## ES

Nexus Finance es una plataforma financiera en tiempo real con cripto, acciones, forex, asesor IA, mapa global y analitica de trading.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, TailwindCSS 4 |
| Backend | FastAPI, Python 3.12 |
| Infrastructure | Docker, Vercel |

---

## Architecture

This is a monorepo with the following structure:

```
finace-nexus/
├── frontend/          # Next.js 16 app (UI, pages, components)
├── backend/           # FastAPI Python service (data APIs, AI)
├── scripts/           # Dev helper scripts (dev-frontend.sh, dev-backend.sh)
└── docker-compose.microservices.yml  # Docker Compose for local microservices
```

---

## Data Sources

- **Yahoo Finance API** — real-time and historical stock/crypto/forex data
- **Binance API** — cryptocurrency market data
- **Stooq** — stocks and forex historical data
- **OpenBB SDK** — optional enhanced financial data
- **CoinGecko** — cryptocurrency data fallback

---

## Main Features

- Real-time watchlist: crypto, stocks, fx
- AI Advisor chat + meal/budget planner
- Trading screen: candles, indicators, market depth
- Global map 2D/3D with country insights
- Portfolio and analytics dashboard
- Multi-language UI: Vietnamese, English, Spanish

---

## Click Guide

1. Open the web app.
2. Top-right: choose language `VIE / EN / ES`.
3. Left sidebar:
   - `Dashboard`: overview + market ticker
   - `AI Advisor`: chat AI, budget/meal analysis
   - `Global Map`: 2D/3D map, click country for details
   - `Portfolio`: allocation and holdings
   - `Analytics`: volatility, momentum, correlation
   - `Trading`: chart, indicators, watchlist, pair search
   - `Settings`: API keys, AI provider/model, system options

---

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

---

## Run Online

1. Push source code to GitHub.
2. Import repository into Vercel.
3. Set root directory to `frontend`.
4. Set environment variable `USE_INTERNAL_API=1`.
5. Deploy and open `https://your-project.vercel.app`.

---

## Current Limitations (Vercel-only)

- Settings/API keys are stored in serverless memory and can reset after cold start.
- No Redis/SQLite persistence in this mode.
- Heavy workloads and long-running tasks are limited by Vercel Hobby quotas.

---

>                       Thank you for visiting Nexus Finance. 
>                       Cảm ơn bạn đã ghé thăm Nexus Finance. 
>                       Gracias por visitar Nexus Finance. 

