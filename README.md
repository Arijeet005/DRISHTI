# DRISHTI (दृष्टि)

**Data-driven Risk Intelligence System for Timely Intervention**

DRISHTI is a land-acquisition project tracking and risk-assessment application for Indian infrastructure projects. It combines a project dashboard, statutory-stage tracking, risk predictions, and a Gemini-powered assistant.

## Live deployments

| Service | URL |
|---|---|
| DRISHTI web app and Express API (AWS EC2) | [http://3.106.184.56:3000/](http://3.106.184.56:3000/) |
| ML service health | [https://dristi-model.onrender.com/health](https://dristi-model.onrender.com/health) |
| ML service readiness | [https://dristi-model.onrender.com/ready](https://dristi-model.onrender.com/ready) |
| ML service API documentation | [https://dristi-model.onrender.com/docs](https://dristi-model.onrender.com/docs) |

The EC2 address is an HTTP URL and may change if the instance's public IP changes. Use an Elastic IP and configure HTTPS/domain routing before treating it as a stable production URL. The ML service is hosted separately on Render.

## Features

- Portfolio dashboard with project totals, risk categories, land area, affected-family counts, and critical-project summaries.
- Project registry with create, edit, search, filter, and detail views.
- Six-stage acquisition workflow: `Drafting`, `PreliminaryNotification`, `ObjectionsHearing`, `DeclarationVesting`, `AwardAnnounced`, and `PossessionTaken`.
- Parallel Section 3G(5) arbitration tracking, available from `AwardAnnounced` onward without blocking possession-stage progression.
- Risk assessment from project attributes, including a bridge to an 18-feature ML input schema.
- Gemini assistant for general DRISHTI and land-acquisition risk questions. The Gemini key is read by the server and must not be exposed as a `VITE_` variable.
- Seed/reference project data for demonstration.

## Technology

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| UI | Lucide React, Motion, React Markdown |
| Application server/API | Node.js, Express 4, `tsx` |
| Data layer | Supabase JavaScript client, PostgreSQL, Prisma 6 |
| Risk inference | Python, FastAPI, Pydantic; a separately hosted inference service plus a TypeScript fallback |
| AI assistant | Google Gemini Interactions API |
| Deployment | AWS EC2, Docker |

## Architecture and implementation notes

The Express application serves the compiled Vite frontend from `dist` and mounts the application endpoints under `/api` and the prediction endpoint under `/ml`. The ML service is a separate FastAPI deployment; the Express server forwards prediction requests to `ML_SERVICE_URL`.

The application currently attempts Supabase first, then Prisma/PostgreSQL, and falls back to in-memory sample data when those services are unavailable. In-memory changes are not durable across server restarts. Configure and verify the database before relying on persistent project records.

The prediction path attempts the configured ML service and falls back to a deterministic TypeScript scoring calculation if the service cannot be reached. A prediction response alone does not prove that a trained model handled it; check the ML service's `/ready` response and the response's model/source fields.

**Demo limitations:** the current role switch is simulated in the frontend, not authenticated production Clerk RBAC. The API also has demo role handling and should not be exposed as a secure multi-user system without proper server-side authentication and authorization. The sample dataset and risk outputs are for demonstration, not legal or financial advice.

## API endpoints

The application API base is `http://3.106.184.56:3000` (replace it with your deployment base URL).

### Express application API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List projects |
| `GET` | `/api/projects/:id` | Get a project |
| `POST` | `/api/projects` | Create a project and calculate its risk |
| `PUT` | `/api/projects/:id` | Update a project and recalculate risk |
| `PATCH` | `/api/projects/:id/arbitration` | Update the arbitration flag |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `POST` | `/api/seed` | Reset/repopulate sample project data |
| `POST` | `/api/chat` | Send chat history to Gemini and return an assistant reply |
| `POST` | `/ml/predict` | Request a risk prediction through the configured ML service/fallback |

`POST /api/seed` is a data-reset operation. Do not expose it to untrusted users.

Example chat request:

```json
{
  "messages": [
    { "role": "user", "text": "What does the arbitration flag mean?" }
  ]
}
```

### Python ML service

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Service health |
| `GET` | `/ready` | Readiness/model status |
| `POST` | `/predict` | Predict from the 18-feature input schema |
| `GET` | `/docs` | Interactive OpenAPI/Swagger documentation |

The project-level `/ml/predict` endpoint accepts project attributes or the ML feature payload and adapts the result for the application.

## Configuration

Create a local `.env` file using `.env.example` as a reference. Set deployment variables in the hosting provider or container runtime. Do not commit `.env`, private keys, or API secrets.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable client key |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `ML_SERVICE_URL` | Full URL for the FastAPI prediction endpoint, e.g. `https://dristi-model.onrender.com/predict` |
| `GEMINI_API_KEY` | Server-side Google Gemini API key |
| `PORT` | Express listening port; defaults to `3000` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Optional frontend setting; current role selection remains simulated |

## Run locally

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
```

Copy `.env.example` to `.env`, configure the services you intend to use, then run:

```bash
npm run dev
```

The application is available at [http://localhost:3000](http://localhost:3000).

Useful project scripts:

```bash
npm run lint       # TypeScript check
npm run build      # Generate Prisma Client and build the frontend into dist/
npm start          # Start the Express application server
npm run db:generate
npm run db:push
npm run db:seed
```

For production, build the image/artifact in a Linux-compatible environment, provide runtime secrets through the host/container environment, and expose the application through a secured web endpoint. Do not copy `.env` into `dist` or bake it into a Docker image.

The current Docker build may require Linux-specific optional dependencies for Tailwind's native binding and OpenSSL for Prisma. Verify `docker build` on the target architecture before deploying an updated image.

## Repository map

```text
src/
  components/       React views and reusable UI
  context/          User/role context
  data/             Sample project data
  server/           Express routes and database adapters
  services/         Prediction adapter, fallback scorer, Supabase client
  types/            Shared TypeScript types
api/main.py         18-feature FastAPI inference service
ml/                 Legacy/alternate 7-feature model service and CLI
prisma/             PostgreSQL schema and seed script
server.ts           Production Express server and dist/ static serving
vite.config.ts      Vite, Tailwind, and development API middleware
```

