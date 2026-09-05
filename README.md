# RUBWAY

Full-stack web application for managing an **EGP → RUB transfer workflow**, built as a private software project by Ahmed Haggag.

RUBWAY combines a customer-facing Next.js interface with a FastAPI backend, PostgreSQL persistence, an admin workflow, pricing configuration, receipt handling and Telegram-based operational controls.

> **Project status:** working technical prototype. It is not presented as a bank, licensed payment processor or production-ready financial service. Real-money operation requires appropriate legal/compliance review, durable file storage, production monitoring and additional security testing.

## Features

- Transfer quote and pricing workflow.
- Russian recipient management.
- Payment-account selection and usage limits.
- Receipt upload and transfer status tracking.
- Admin authentication with password hashing and JWT access tokens.
- Admin transfer-management endpoints and dashboard workflow.
- Telegram bot/webhook integration for operational actions.
- PostgreSQL schema migrations with Alembic.
- Render blueprint for backend/database deployment.
- Next.js frontend designed for Vercel deployment.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint

### Backend

- Python
- FastAPI
- SQLAlchemy 2
- PostgreSQL
- Alembic
- Pydantic
- PyJWT
- `pwdlib` password hashing
- HTTPX

### Infrastructure

- Render — API and PostgreSQL
- Vercel — frontend
- Telegram Bot API — admin/operations integration

## Repository Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/v1/       # Auth, transfers, pricing, accounts, Telegram
│   │   ├── core/         # Configuration and security
│   │   ├── database/     # SQLAlchemy session/engine
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Transfer/pricing/Telegram business logic
│   ├── migrations/
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js App Router pages
│   ├── components/
│   ├── lib/
│   └── package.json
├── render.yaml
└── .env.example
```

## Local Development

### 1. Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then:

```bash
python -m pip install -r requirements.txt
```

Copy the repository `.env.example` to `.env` and configure at least the database and admin/JWT values.

Run migrations and start the API:

```bash
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

The API is available by default at `http://127.0.0.1:8000` and exposes FastAPI documentation at `/docs`.

### 2. Frontend

```bash
cd frontend
npm ci
```

Set:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Then run:

```bash
npm run dev
```

The frontend is available at `http://localhost:3000`.

## Configuration

Sensitive values are environment variables and must never be committed. Important settings include:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `FRONTEND_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `BACKEND_PUBLIC_URL`

See `.env.example` for a safe template.

## Deployment

The repository contains `render.yaml` for the FastAPI service and PostgreSQL database. The frontend can be deployed separately from the `frontend/` directory on Vercel.

See [DEPLOY_TODAY.md](DEPLOY_TODAY.md) and [TELEGRAM_ADMIN_SETUP.md](TELEGRAM_ADMIN_SETUP.md) for the current project deployment notes.

## Security Notes

- `.env` files are ignored by Git.
- Admin passwords are stored as password hashes, not plaintext values.
- JWT secrets are supplied through environment variables.
- Telegram webhook verification is supported through a webhook secret.
- Uploaded receipts are excluded from Git.

The current Render configuration uses local receipt storage. That storage may be ephemeral depending on the hosting plan, so durable object storage such as S3-compatible storage should be used before production operation.

## Portfolio Scope

This repository demonstrates full-stack application development, REST API design, relational data modeling, authentication, deployment configuration and integration with an external messaging API. It should be evaluated as a software-engineering project rather than as a claim of production financial infrastructure.
