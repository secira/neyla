import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';

/*
 * Curated, non-programmer-friendly model list.
 * Only a short list of well-known providers/models is shown by default,
 * each with a plain-language label. Users who add their own API key for
 * another provider (via Settings → AI Providers) still see that provider.
 */

const CURATED_PROVIDER_NAMES = ['OpenAI', 'Anthropic', 'Groq'];

const CURATED_MODEL_LABELS: Record<string, Record<string, string>> = {
  OpenAI: {
    'gpt-4o-mini': 'Fast — great for most apps (recommended)',
    'gpt-4o': 'Powerful — best for complex apps',
  },
  Anthropic: {
    'claude-3-5-sonnet-latest': 'Claude — great for polished designs',
    'claude-3-5-sonnet-20241022': 'Claude — great for polished designs',
    'claude-3-7-sonnet-20250219': 'Claude — most capable',
  },
  Groq: {
    'llama-3.3-70b-versatile': 'Llama — quick and free-spirited drafts',
  },
};

export function curateProviderList(providers: ProviderInfo[], apiKeys: Record<string, string> = {}): ProviderInfo[] {
  const curated = providers.filter(
    (p) => CURATED_PROVIDER_NAMES.includes(p.name) || Boolean(apiKeys[p.name]),
  );

  // Safety: never return an empty picker
  return curated.length > 0 ? curated : providers;
}

export function curateModelList(models: ModelInfo[], apiKeys: Record<string, string> = {}): ModelInfo[] {
  const result: ModelInfo[] = [];
  const byProvider = new Map<string, ModelInfo[]>();

  for (const model of models) {
    const list = byProvider.get(model.provider) ?? [];
    list.push(model);
    byProvider.set(model.provider, list);
  }

  for (const [providerName, providerModels] of byProvider) {
    const curatedLabels = CURATED_MODEL_LABELS[providerName];

    if (!curatedLabels) {
      // Provider not curated: keep as-is (only shown if user added a key)
      result.push(...providerModels);
      continue;
    }

    const matched = providerModels
      .filter((m) => curatedLabels[m.name])
      .map((m) => ({ ...m, label: curatedLabels[m.name] }));

    // Safety: if none of the curated model names exist, keep the original list
    if (matched.length > 0) {
      result.push(...matched);

      // A user with their own key for this provider gets the full list too
      if (apiKeys[providerName]) {
        const matchedNames = new Set(matched.map((m) => m.name));
        result.push(...providerModels.filter((m) => !matchedNames.has(m.name)));
      }
    } else {
      result.push(...providerModels);
    }
  }

  return result;
}
