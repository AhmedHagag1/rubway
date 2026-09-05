# RUBWAY Frontend

Customer and administration interface for the RUBWAY transfer-workflow prototype.

The frontend is built with **Next.js, React, TypeScript and Tailwind CSS** and communicates with the FastAPI backend through the REST API configured by `NEXT_PUBLIC_API_URL`.

## Main Areas

- Customer transfer flow and status experience.
- Admin login and dashboard.
- Transfer-management views.
- Payment-account administration and capacity indicators.
- API integration and access-token handling.

## Local Development

```bash
npm ci
```

Create a local environment file and point the frontend to the API:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Validation

The repository CI validates the frontend with:

```bash
npm ci
npm run lint
npm run build
```

## Deployment

The frontend can be deployed from this `frontend/` directory on Vercel. Configure `NEXT_PUBLIC_API_URL` with the deployed FastAPI `/api/v1` URL.

For the complete architecture, backend setup, security notes and project limitations, see the [root README](../README.md).
