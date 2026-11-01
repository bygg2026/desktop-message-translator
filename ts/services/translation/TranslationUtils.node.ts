// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  TranslationConfig,
  TranslationConfigInput,
  TranslationProvider,
} from '../../types/Translation.std.ts';
import { DEFAULT_TRANSLATION_CONFIG } from '../../types/Translation.std.ts';

const MAX_URL_LENGTH = 2048;
const MAX_MODEL_LENGTH = 512;
const MAX_STYLE_LENGTH = 4000;

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeTranslationConfig(
  value: unknown
): TranslationConfigInput {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_TRANSLATION_CONFIG };
  }

  const input = value as Record<string, unknown>;
  const provider: TranslationProvider =
    input.provider === 'custom' ? 'custom' : 'google';

  let apiKey: string | null | undefined;
  if (input.apiKey === null) {
    apiKey = null;
  } else if (typeof input.apiKey === 'string') {
    apiKey = input.apiKey.trim().slice(0, 4096);
  }

  return {
    enabled: input.enabled !== false,
    provider,
    receiveLanguage:
      normalizeString(input.receiveLanguage, 32) ||
      DEFAULT_TRANSLATION_CONFIG.receiveLanguage,
    sendLanguage:
      normalizeString(input.sendLanguage, 32) ||
      DEFAULT_TRANSLATION_CONFIG.sendLanguage,
    apiUrl: normalizeString(input.apiUrl, MAX_URL_LENGTH),
    model: normalizeString(input.model, MAX_MODEL_LENGTH),
    outgoingStyleEnabled: input.outgoingStyleEnabled === true,
    outgoingStylePrompt: normalizeString(
      input.outgoingStylePrompt,
      MAX_STYLE_LENGTH
    ),
    apiKey,
  };
}

export function assertHttpUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('API URL is invalid');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API URL must use HTTP or HTTPS');
  }
  return parsed;
}

export function getCustomChatEndpoint(value: string): string {
  const parsed = assertHttpUrl(value);
  const base = parsed.toString().replace(/\/+$/, '');

  if (/\/chat\/completions$/i.test(base)) {
    return base;
  }
  if (/\/models$/i.test(base)) {
    return base.replace(/\/models$/i, '/chat/completions');
  }
  if (/\/v1$/i.test(base)) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

export function getCustomModelsEndpoints(value: string): ReadonlyArray<string> {
  const parsed = assertHttpUrl(value);
  const base = parsed.toString().replace(/\/+$/, '');
  const endpoints = new Set<string>();

  if (/\/chat\/completions$/i.test(base)) {
    endpoints.add(base.replace(/\/chat\/completions$/i, '/models'));
  } else if (/\/models$/i.test(base)) {
    endpoints.add(base);
  } else if (/\/v1$/i.test(base)) {
    endpoints.add(`${base}/models`);
  } else {
    endpoints.add(`${base}/v1/models`);
    endpoints.add(`${base}/models`);
  }
  return [...endpoints];
}

export function parseModelIds(value: unknown): Array<string> {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const found = new Set<string>();
  for (const collection of [record.data, record.models]) {
    if (!Array.isArray(collection)) {
      continue;
    }
    for (const item of collection) {
      if (typeof item === 'string') {
        const model = item.trim();
        if (model) {
          found.add(model);
        }
      } else if (typeof item === 'object' && item !== null) {
        const model = item as Record<string, unknown>;
        const candidate =
          typeof model.id === 'string'
            ? model.id
            : typeof model.name === 'string'
              ? model.name
              : '';
        if (candidate.trim()) {
          found.add(candidate.trim());
        }
      }
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

export function getLanguageName(language: string): string {
  const names: Record<string, string> = {
    my: 'Burmese (Myanmar)',
    en: 'English',
    'zh-CN': 'Simplified Chinese',
    'zh-TW': 'Traditional Chinese',
    th: 'Thai',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ru: 'Russian',
    uk: 'Ukrainian',
  };
  return names[language] ?? language;
}

export function containsClearlyNonEnglishScript(value: string): boolean {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u1000-\u109f\ua9e0-\ua9ff\uaa60-\uaa7f\u0400-\u04ff\u0600-\u06ff]/u.test(
    value
  );
}

export function createTranslationCacheKey(options: {
  configRevision: string;
  targetLanguage: string;
  text: string;
}): string {
  return `${options.configRevision}|${options.targetLanguage}|${options.text}`;
}

export function toStoredPublicConfig(
  config: TranslationConfig
): TranslationConfig {
  return { ...config };
}
