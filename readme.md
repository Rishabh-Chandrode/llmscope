# LLMScope

A self-hosted observability tool for LLM API calls. Wrap your OpenAI, Anthropic,
or Gemini calls with the SDK and get full visibility into latency, token usage,
cost, and failure rates — all stored in your own database.

```typescript
import { LLMTracer } from 'llmscope-sdk';

const tracer = new LLMTracer({ apiKey: 'llmscope_live_...' });

const response = await tracer.trace('summarize-doc', () =>
  openai.chat.completions.create({ model: 'gpt-4o', messages: [...] })
);
// response is untouched — trace data sent in background
```

## What it tracks

- **Latency** — p50, p95, p99 per feature, rolled up hourly
- **Token usage** — input and output tokens per call and per model
- **Cost** — USD cost per call, per feature, per day (based on current pricing)
- **Failure rate** — failed and timed-out calls with error messages
- **Full prompt and response** — optional, off by default

## How it works

```
Your app
  └── llmscope-sdk
        └── wraps LLM call
        └── measures latency
        └── sends trace (fire-and-forget) ──→ POST /ingest
                                                  └── Redis buffer
                                                        └── flush job (every 5s)
                                                              └── PostgreSQL
                                                                    └── hourly rollup
                                                                    └── alert engine
```

The SDK adds zero latency to your LLM calls. Trace data is sent in the background
after your call returns.

## Stack

| Layer | Technology |
|---|---|
| SDK | TypeScript, zero dependencies |
| Backend | Node.js, Express v5, TypeScript |
| Queue / buffer | Redis (ioredis) |
| Database | PostgreSQL |
| Validation | Zod v4 |
| Logging | Pino |
| Metrics | Prometheus (prom-client) |
| Infrastructure | Docker + Docker Compose |
| Package manager | pnpm workspaces (monorepo) |

## Repository structure

```
llmscope/
├── packages/
│   └── sdk/              ← npm package (llmscope-sdk)
└── apps/
    └── backend/          ← self-hosted server
```

## Getting started

### Run the backend

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/llmscope
cd llmscope
cp apps/backend/.env.example apps/backend/.env
docker compose up -d
```

### Register an app

```bash
curl -X POST http://localhost:3000/apps/register \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

Save the `apiKey` from the response.

### Install the SDK

```bash
npm install llmscope-sdk
```

### Wrap your first LLM call

```typescript
import { LLMTracer } from 'llmscope-sdk';

const tracer = new LLMTracer({
  apiKey: 'llmscope_live_YOUR_KEY',
  baseUrl: 'http://localhost:3000',
});

const response = await tracer.trace('my-feature', () =>
  openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }],
  })
);
```

Traces appear in PostgreSQL within 5 seconds (flush interval).

## API

### Query your traces

```bash
# List recent traces
GET /traces?limit=50&from=2024-01-01T00:00:00Z

# 24h overview
GET /metrics/overview

# Cost breakdown by feature
GET /metrics/cost?groupBy=feature

# Latency percentiles over time
GET /metrics/latency?from=2024-01-01T00:00:00Z

# Call volume per hour
GET /metrics/volume
```

All routes require the `x-api-key` header.

### Alert rules

Create webhook alerts when thresholds are breached:

```bash
curl -X POST http://localhost:3000/alerts \
  -H "x-api-key: llmscope_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "metric": "daily_cost",
    "threshold": 10.00,
    "windowMinutes": 1440,
    "notifyUrl": "https://hooks.slack.com/..."
  }'
```

Supported metrics: `daily_cost`, `error_rate`, `p95_latency`.

### Prometheus metrics

```bash
GET /metrics   # no auth required — for Prometheus scraping
```

Exposes: `traces_ingested_total`, `traces_flushed_total`, `redis_buffer_size`,
`flush_duration_ms`, `ingest_http_duration_ms`, `alert_evaluations_total`,
`alerts_fired_total`, plus default Node.js metrics.

## Supported LLM providers

| Provider | Models | Non-streaming | Streaming |
|---|---|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo | ✓ | ✓ |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 | ✓ | ✓ |
| Google Gemini | gemini-1.5-pro, gemini-1.5-flash | ✓ | ✓ |

Provider is detected automatically from the response shape — no configuration needed.

## Self-hosting

See [apps/backend/SELF_HOSTING.md](apps/backend/SELF_HOSTING.md) for the
full self-hosting guide including Docker setup, backups, and exposing the
backend over HTTPS.

## SDK documentation

See [packages/sdk/README.md](packages/sdk/README.md) for full SDK documentation
including all configuration options, streaming usage, and error handling.

## Contributing

Pull requests are welcome. For significant changes, open an issue first to
discuss what you would like to change.

## License

MIT

llmscope_live_f14751e665da4a4fa5090e798be25f41