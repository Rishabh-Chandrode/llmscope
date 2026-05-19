
type ModelPricing = {
  input: number;
  output: number;
}

const PRICING: Record<string, ModelPricing> = {
  
  'gpt-4o':                    { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':               { input: 10.00, output: 30.00 },
  'gpt-4':                     { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':             { input: 0.50,  output: 1.50  },
  
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00  },
  'claude-3-opus-20240229':    { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229':  { input: 3.00,  output: 15.00 },
  'claude-3-haiku-20240307':   { input: 0.25,  output: 1.25  },
  
  'gemini-1.5-pro':            { input: 1.25,  output: 5.00  },
  'gemini-1.5-flash':          { input: 0.075, output: 0.30  },
  'gemini-1.0-pro':            { input: 0.50,  output: 1.50  },
};

const FALLBACK_PRICING: ModelPricing = { input: 1.00, output: 3.00 };


export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] ?? FALLBACK_PRICING;
  const inputCost  = (inputTokens  / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1e8) / 1e8;
}

export function isKnownModel(model: string): boolean {
  return model in PRICING;
}

export function getPricingTable(): Record<string, ModelPricing> {
  return { ...PRICING };
}