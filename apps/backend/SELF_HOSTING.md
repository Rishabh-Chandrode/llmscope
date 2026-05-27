# Self-hosting LLMScope Backend

LLMScope backend runs entirely via Docker. You need Docker and Docker Compose
installed — nothing else.

## Prerequisites

- Docker 24+
- Docker Compose v2+
- A server or machine with at least 512MB RAM

To install Docker: https://docs.docker.com/engine/install/

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/llmscope
cd llmscope
```

### 2. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
```

Open `apps/backend/.env` and review the defaults. For most self-hosted setups
the only things you may want to change are:

```bash
PORT=3000          # port the backend listens on
NODE_ENV=production
```

The database and Redis URLs are already configured to point to the Docker
containers — leave them as-is unless you are using external managed services.

### 3. Start everything

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6380
- LLMScope backend on port 3000

All database tables are created automatically on first start via the
migration file mounted into the PostgreSQL container.

### 4. Verify it is running

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"...","version":"0.1.0"}
```

### 5. Register your first app

```bash
curl -X POST http://localhost:3000/apps/register \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

Save the `apiKey` — it is shown once. Use it in the SDK configuration.

## Stopping and starting

```bash
# Stop (keeps data)
docker compose stop

# Start again
docker compose start

# Stop and remove containers (keeps data in volumes)
docker compose down

# Full reset — removes everything including data
docker compose down -v
```

## Viewing logs

```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

## Data persistence

PostgreSQL and Redis data are stored in Docker named volumes:
- `postgres_data` — all traces, metrics, alert rules
- `redis_data` — Redis AOF persistence

These volumes survive `docker compose down` but are removed by `docker compose down -v`.

To back up your PostgreSQL data:

```bash
docker compose exec postgres pg_dump -U postgres llmscope > backup.sql
```

To restore:

```bash
docker compose exec -T postgres psql -U postgres llmscope < backup.sql
```

## Exposing to the internet

If you want the backend accessible from outside your machine (so the SDK
can reach it from production apps), you will need to:

1. Open port 3000 on your server's firewall
2. Set up a reverse proxy (nginx or Caddy) with HTTPS
3. Update `baseUrl` in your SDK config to point to your server

A minimal Caddy config:

```
your-domain.com {
  reverse_proxy localhost:3000
}
```

Caddy handles HTTPS automatically via Let's Encrypt.

## Environment variable reference

| Variable | Default | Description |
|---|---|---|
| PORT | 3000 | Backend server port |
| NODE_ENV | development | Set to `production` in prod |
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/llmscope | PostgreSQL connection string |
| REDIS_URL | redis://localhost:6380 | Redis connection string |
| FLUSH_INTERVAL_MS | 5000 | How often to flush Redis buffer to PostgreSQL |
| AGGREGATE_INTERVAL_MS | 3600000 | How often to run hourly rollup (1 hour) |
| ALERT_INTERVAL_MS | 300000 | How often to evaluate alert rules (5 minutes) |
| REDIS_BUFFER_BATCH_SIZE | 500 | Max traces to flush per cycle |
| API_KEY_PREFIX | llmscope_live_ | Prefix for generated API keys |