import { LLMTracer } from './src/index.js';

const tracer = new LLMTracer({
  apiKey: 'llmscope_live_bb6a4a3eb10a44d6add69792208786d4', // from POST /apps/register
  baseUrl: 'http://localhost:3000',
  captureResponses: true,
});

// ── Test 1: Mock OpenAI non-streaming response ────────────────────────────────

console.log('\n--- Test 1: Mock OpenAI non-streaming ---');

const mockOpenAIResponse = {
  id: 'chatcmpl-abc123',
  object: 'chat.completion',
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello from mock OpenAI!' },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 150,
    completion_tokens: 42,
    total_tokens: 192,
  },
};

const openAIResult = await tracer.trace(
  'test-openai-feature',
  async () => mockOpenAIResponse
);

console.log('Returned response matches original:', openAIResult === mockOpenAIResponse);
console.log('Response text:', openAIResult.choices[0].message.content);
console.log('Trace fired in background (check backend logs)');

// ── Test 2: Mock Anthropic non-streaming response ─────────────────────────────

console.log('\n--- Test 2: Mock Anthropic non-streaming ---');

const mockAnthropicResponse = {
  id: 'msg_abc123',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-6',
  content: [
    { type: 'text', text: 'Hello from mock Anthropic!' },
  ],
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 200,
    output_tokens: 55,
  },
};

const anthropicResult = await tracer.trace(
  'test-anthropic-feature',
  async () => mockAnthropicResponse
);

console.log('Returned response matches original:', anthropicResult === mockAnthropicResponse);
console.log('Response text:', anthropicResult.content[0].text);

// ── Test 3: Mock Gemini non-streaming response ────────────────────────────────

console.log('\n--- Test 3: Mock Gemini non-streaming ---');

const mockGeminiResponse = {
  candidates: [
    {
      content: {
        parts: [{ text: 'Hello from mock Gemini!' }],
        role: 'model',
      },
      finishReason: 'STOP',
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 30,
    totalTokenCount: 130,
  },
};

const geminiResult = await tracer.trace(
  'test-gemini-feature',
  async () => mockGeminiResponse
);

console.log('Returned response matches original:', geminiResult === mockGeminiResponse);

// ── Test 4: Error handling — fn() throws ─────────────────────────────────────

console.log('\n--- Test 4: Error handling ---');

try {
  await tracer.trace('test-error-feature', async () => {
    throw new Error('Simulated provider error');
  });
} catch (err) {
  console.log('Error correctly re-thrown:', err instanceof Error && err.message);
}

// ── Test 5: Mock OpenAI streaming ─────────────────────────────────────────────

console.log('\n--- Test 5: Mock OpenAI streaming ---');

// Build a mock async iterable that yields OpenAI stream chunks
async function* mockOpenAIStream() {
  const chunks = [
    { model: 'gpt-4o', choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
    { model: 'gpt-4o', choices: [{ delta: { content: ' from' }, finish_reason: null }] },
    { model: 'gpt-4o', choices: [{ delta: { content: ' stream!' }, finish_reason: 'stop' }] },
    // Final chunk with usage (requires stream_options.include_usage in real calls)
    { model: 'gpt-4o', choices: [{ delta: {}, finish_reason: null }], usage: { prompt_tokens: 50, completion_tokens: 10 } },
  ];

  for (const chunk of chunks) {
    yield chunk;
  }
}

const streamResult = await tracer.traceStream(
  'test-stream-feature',
  async () => mockOpenAIStream()
);

let streamText = '';
for await (const chunk of streamResult) {
  const content = chunk.choices[0]?.delta?.content ?? '';
  streamText += content;
  process.stdout.write(content);
}
console.log('\nStream text collected:', streamText);

// ── Wait for transport to fire before process exits ───────────────────────────

console.log('\n--- Waiting 2s for background transport to send traces ---');
await new Promise(resolve => setTimeout(resolve, 2000));
console.log('Done. Check backend logs and PostgreSQL for traces.');