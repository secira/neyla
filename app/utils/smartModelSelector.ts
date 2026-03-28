import type { ProviderInfo } from '~/types/model';

export type ComplexityTier = 'fast' | 'balanced' | 'powerful';

const FAST_KEYWORDS = [
  'fix',
  'typo',
  'rename',
  'color',
  'colour',
  'font',
  'size',
  'margin',
  'padding',
  'spacing',
  'align',
  'center',
  'bold',
  'italic',
  'underline',
  'change the text',
  'update the text',
  'change the label',
  'update the label',
  'change the button',
  'update the button',
  'minor',
  'small change',
  'quick',
  'simple',
  'just change',
  'just update',
  'only change',
  'only update',
  'move',
  'reorder',
  'swap',
  'replace text',
  'replace the text',
  'background color',
  'background colour',
  'border',
  'shadow',
  'opacity',
  'visibility',
  'hide',
  'show',
  'toggle',
];

const POWERFUL_KEYWORDS = [
  'build',
  'create a full',
  'build a full',
  'full stack',
  'fullstack',
  'saas',
  'platform',
  'e-commerce',
  'ecommerce',
  'marketplace',
  'complete app',
  'entire app',
  'entire website',
  'whole app',
  'whole website',
  'from scratch',
  'authentication',
  'auth system',
  'login system',
  'payment',
  'checkout',
  'database schema',
  'api endpoints',
  'rest api',
  'graphql',
  'dashboard',
  'admin panel',
  'analytics',
  'multi-page',
  'multipage',
  'landing page',
  'build me a',
  'create me a',
  'make me a',
  'generate a',
  'generate me a',
  'complex',
  'advanced',
];

export function detectComplexity(prompt: string): ComplexityTier {
  const lower = prompt.toLowerCase().trim();

  const isFast = FAST_KEYWORDS.some((kw) => lower.includes(kw));
  const isPowerful = POWERFUL_KEYWORDS.some((kw) => lower.includes(kw));

  if (isPowerful) {
    return 'powerful';
  }

  if (isFast && !isPowerful) {
    return 'fast';
  }

  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  if (wordCount > 30) {
    return 'powerful';
  }

  if (wordCount > 12) {
    return 'balanced';
  }

  return 'balanced';
}

interface ModelChoice {
  model: string;
  provider: ProviderInfo;
}

export function selectModelForPrompt(prompt: string, providerList: ProviderInfo[]): ModelChoice | null {
  const tier = detectComplexity(prompt);

  const findProvider = (name: string) => providerList.find((p) => p.name === name);

  const openai = findProvider('OpenAI');
  const anthropic = findProvider('Anthropic');
  const groq = findProvider('Groq');
  const openRouter = findProvider('OpenRouter');

  if (tier === 'powerful') {
    if (openai) {
      return { model: 'gpt-4o', provider: openai };
    }

    if (groq) {
      return { model: 'llama-3.3-70b-versatile', provider: groq };
    }

    if (openRouter) {
      return { model: 'anthropic/claude-3.5-sonnet', provider: openRouter };
    }

    if (anthropic) {
      return { model: 'claude-3-5-sonnet-20241022', provider: anthropic };
    }
  }

  if (tier === 'balanced') {
    if (openai) {
      return { model: 'gpt-4o-mini', provider: openai };
    }

    if (groq) {
      return { model: 'llama-3.3-70b-versatile', provider: groq };
    }
  }

  if (tier === 'fast') {
    if (groq) {
      return { model: 'llama-3.1-8b-instant', provider: groq };
    }

    if (openai) {
      return { model: 'gpt-4o-mini', provider: openai };
    }
  }

  if (openai) {
    return { model: 'gpt-4o-mini', provider: openai };
  }

  if (anthropic) {
    return { model: 'claude-3-5-sonnet-20241022', provider: anthropic };
  }

  if (groq) {
    return { model: 'llama-3.3-70b-versatile', provider: groq };
  }

  if (openRouter) {
    return { model: 'meta-llama/llama-3.3-70b-instruct', provider: openRouter };
  }

  return null;
}
