# llmscope-sdk

Wrap your OpenAI, Anthropic, or Gemini calls with one line and instantly get
latency tracking, token usage, cost breakdown, and failure monitoring — all
sent to your self-hosted LLMScope backend.

## Installation

```bash
npm install llmscope-sdk
```

## Quick start

### 1. Start the LLMScope backend

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/llmscope
cd llmscope
cp apps/backend/.env.example apps/backend/.env
docker compose up -d
```

### 2. Register your app and get an API key

```bash
curl -X POST http://localhost:3000/apps/register \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

Save the `apiKey` from the response — it is shown once and cannot be recovered.

### 3. Wrap your LLM calls

```typescript
import { LLMTracer } from 'llmscope-sdk';
import OpenAI from 'openai';

const openai = new OpenAI();
const tracer = new LLMTracer({
  apiKey: 'llmscope_live_YOUR_KEY_HERE',
  baseUrl: 'http://localhost:3000',
});

// Pass your LLM call as a function — the response is returned untouched
const response = await tracer.trace('summarize-document', () =>
  openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Summarize this document...' }],
  })
);

// response is exactly what OpenAI returned — no modification
console.log(response.choices[0].message.content);
```

That is it. Every call is now tracked.

## Streaming

```typescript
const stream = await tracer.traceStream('chat-response', () =>
  openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [...],
    stream: true,
  })
);

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
// trace fires automatically when the stream ends
```

## Supported providers

| Provider | Non-streaming | Streaming |
|---|---|---|
| OpenAI | ✓ | ✓ |
| Anthropic | ✓ | ✓ |
| Google Gemini | ✓ | ✓ |

Provider is detected automatically from the response shape — no configuration needed.

## Configuration

```typescript
const tracer = new LLMTracer({
  apiKey: 'llmscope_live_...',   // required
  baseUrl: 'http://localhost:3000', // default — change for production
  capturePrompts: false,          // set true to store prompt text (default: false)
  captureResponses: false,        // set true to store response text (default: false)
  timeout: 5000,                  // transport HTTP timeout in ms (default: 5000)
});
```

`capturePrompts` and `captureResponses` are off by default. Enable them only
if you need to debug prompt/response content and are comfortable storing that
data in your database.

## Optional metadata

Pass extra context alongside each trace:

```typescript
const response = await tracer.trace(
  'generate-email',
  () => openai.chat.completions.create({ ... }),
  {
    userId: 'user_abc123',
    sessionId: 'sess_xyz',
    environment: 'production',
  }
);
```

## Error handling

The SDK never swallows errors. If the LLM call throws, the SDK captures the
error message in the trace (status: `failed`) and re-throws the original error:

```typescript
try {
  const response = await tracer.trace('my-feature', () =>
    openai.chat.completions.create({ ... })
  );
} catch (err) {
  // err is exactly what OpenAI threw — the SDK did not modify it
  console.error(err);
}
```

## Performance

The SDK adds zero latency to your LLM calls. Trace data is sent to the backend
in the background (fire-and-forget) after your call returns. If the backend is
unreachable, the SDK retries up to 3 times with exponential backoff — silently,
without affecting your application.

## Requirements

- Node.js 18 or higher
- LLMScope backend running (self-hosted)

## License

MIT