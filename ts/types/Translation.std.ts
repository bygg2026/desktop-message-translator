// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type TranslationProvider = 'google' | 'custom';
export type TranslationDirection = 'receive' | 'send';

export type TranslationConfig = Readonly<{
  enabled: boolean;
  provider: TranslationProvider;
  receiveLanguage: string;
  sendLanguage: string;
  apiUrl: string;
  model: string;
  outgoingStyleEnabled: boolean;
  outgoingStylePrompt: string;
}>;

export type TranslationConfigForRenderer = TranslationConfig &
  Readonly<{
    apiKeyConfigured: boolean;
    revision: string;
  }>;

export type TranslationConfigInput = TranslationConfig &
  Readonly<{
    // undefined keeps the saved key; null clears it; string replaces it.
    apiKey?: string | null;
  }>;

export type TranslationValidationResult = Readonly<{
  ok: boolean;
  message: string;
  // Machine-readable reason for a failed probe, so the settings screen can tell
  // a rate limit apart from a bad key instead of showing one generic sentence.
  code?: string;
}>;

export type TranslationModelsResult = Readonly<{
  models: ReadonlyArray<string>;
  endpoint: string;
}>;

export const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  enabled: true,
  provider: 'google',
  receiveLanguage: 'zh-CN',
  sendLanguage: 'en',
  apiUrl: '',
  model: '',
  outgoingStyleEnabled: false,
  outgoingStylePrompt: '',
};

export const TRANSLATION_LANGUAGES: ReadonlyArray<
  Readonly<{ label: string; value: string }>
> = [
  { label: 'Burmese (Myanmar)', value: 'my' },
  { label: 'English', value: 'en' },
  { label: 'Simplified Chinese', value: 'zh-CN' },
  { label: 'Traditional Chinese', value: 'zh-TW' },
  { label: 'Thai', value: 'th' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Russian', value: 'ru' },
  { label: 'Ukrainian', value: 'uk' },
];
