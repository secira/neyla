import { describe, expect, it } from 'vitest';
import { curateProviderList, curateModelList } from './curatedModels';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(name: string): ProviderInfo {
  return {
    name,
    staticModels: [],
    getDynamicModels: undefined,
    getApiKeyLink: undefined,
    labelForGetApiKey: undefined,
    icon: undefined,
  } as unknown as ProviderInfo;
}

function makeModel(name: string, provider: string): ModelInfo {
  return { name, label: name, provider, maxTokenAllowed: 8000 };
}

// ---------------------------------------------------------------------------
// curateProviderList
// ---------------------------------------------------------------------------

describe('curateProviderList', () => {
  const allProviders = ['OpenAI', 'Anthropic', 'Groq', 'Mistral', 'Cohere'].map(makeProvider);

  it('keeps only curated providers when no extra API keys are present', () => {
    const result = curateProviderList(allProviders);
    const names = result.map((p) => p.name);
    expect(names).toContain('OpenAI');
    expect(names).toContain('Anthropic');
    expect(names).toContain('Groq');
    expect(names).not.toContain('Mistral');
    expect(names).not.toContain('Cohere');
  });

  it('includes a non-curated provider when the user has supplied an API key for it', () => {
    const result = curateProviderList(allProviders, { Mistral: 'sk-mistral-key' });
    const names = result.map((p) => p.name);
    expect(names).toContain('Mistral');
    expect(names).not.toContain('Cohere');
  });

  it('fallback: returns the full provider list when the curated filter would produce an empty result', () => {
    const unknownProviders = ['FakeA', 'FakeB'].map(makeProvider);
    const result = curateProviderList(unknownProviders);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(['FakeA', 'FakeB']);
  });

  it('returns an empty array as-is when both the curated list and the fallback are empty', () => {
    const result = curateProviderList([]);
    expect(result).toHaveLength(0);
  });

  it('handles an undefined apiKeys argument gracefully', () => {
    const result = curateProviderList(allProviders, undefined);
    expect(result.map((p) => p.name)).toContain('OpenAI');
  });
});

// ---------------------------------------------------------------------------
// curateModelList
// ---------------------------------------------------------------------------

describe('curateModelList', () => {
  const openAiModels = [
    makeModel('gpt-4o-mini', 'OpenAI'),
    makeModel('gpt-4o', 'OpenAI'),
    makeModel('gpt-3.5-turbo', 'OpenAI'),
  ];
  const anthropicModels = [
    makeModel('claude-3-5-sonnet-latest', 'Anthropic'),
    makeModel('claude-3-5-sonnet-20241022', 'Anthropic'),
    makeModel('claude-3-7-sonnet-20250219', 'Anthropic'),
    makeModel('claude-old-model', 'Anthropic'),
  ];
  const groqModels = [makeModel('llama-3.3-70b-versatile', 'Groq'), makeModel('mixtral-8x7b', 'Groq')];
  const mistralModels = [makeModel('mistral-large', 'Mistral')];

  it('returns only curated model names for curated providers', () => {
    const result = curateModelList(openAiModels);
    const names = result.map((m) => m.name);
    expect(names).toContain('gpt-4o-mini');
    expect(names).toContain('gpt-4o');
    expect(names).not.toContain('gpt-3.5-turbo');
  });

  it('applies friendly labels to curated models', () => {
    const result = curateModelList(openAiModels);
    const mini = result.find((m) => m.name === 'gpt-4o-mini');
    expect(mini?.label).toMatch(/recommended/i);
  });

  it('includes extra non-curated models for a provider when the user has a key', () => {
    const result = curateModelList(openAiModels, { OpenAI: 'sk-openai-key' });
    const names = result.map((m) => m.name);
    expect(names).toContain('gpt-4o-mini');
    expect(names).toContain('gpt-3.5-turbo');
  });

  it('does NOT include extra models when no API key is set for that provider', () => {
    const result = curateModelList(openAiModels);
    const names = result.map((m) => m.name);
    expect(names).not.toContain('gpt-3.5-turbo');
  });

  it('passes through all models for a non-curated provider', () => {
    const result = curateModelList(mistralModels);
    const names = result.map((m) => m.name);
    expect(names).toContain('mistral-large');
  });

  it('fallback: keeps all provider models when none of the curated names match (upstream renamed models)', () => {
    const renamedOpenAiModels = [
      makeModel('gpt-4o-mini-v2', 'OpenAI'),
      makeModel('gpt-4o-v2', 'OpenAI'),
    ];
    const result = curateModelList(renamedOpenAiModels);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.name)).toEqual(['gpt-4o-mini-v2', 'gpt-4o-v2']);
  });

  it('handles an empty model list without throwing', () => {
    const result = curateModelList([]);
    expect(result).toHaveLength(0);
  });

  it('processes multiple providers in the same call', () => {
    const allModels = [...openAiModels, ...groqModels, ...mistralModels];
    const result = curateModelList(allModels);
    const names = result.map((m) => m.name);
    expect(names).toContain('gpt-4o-mini');
    expect(names).toContain('llama-3.3-70b-versatile');
    expect(names).toContain('mistral-large');
    expect(names).not.toContain('gpt-3.5-turbo');
    expect(names).not.toContain('mixtral-8x7b');
  });

  it('does not produce duplicate models when the user has a key (curated + extras are disjoint)', () => {
    const result = curateModelList(openAiModels, { OpenAI: 'sk-key' });
    const names = result.map((m) => m.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('curates all three Anthropic model variants and excludes the old one', () => {
    const result = curateModelList(anthropicModels);
    const names = result.map((m) => m.name);
    expect(names).toContain('claude-3-5-sonnet-latest');
    expect(names).toContain('claude-3-5-sonnet-20241022');
    expect(names).toContain('claude-3-7-sonnet-20250219');
    expect(names).not.toContain('claude-old-model');
  });
});
