// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { BrowserWindow } from 'electron';
import { app, ipcMain, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import EventEmitter from 'node:events';
import { createHash } from 'node:crypto';

import { createLogger } from '../logging/log.std.ts';

const log = createLogger('ZoomFactorService');

const DEFAULT_ZOOM_FACTOR = 1.0;

// https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc
const ZOOM_LEVEL_MULTIPLIER_RATIO = 1.2;

function zoomLevelToZoomFactor(zoomLevel: number): number {
  return ZOOM_LEVEL_MULTIPLIER_RATIO ** zoomLevel;
}

function zoomFactorToZoomLevel(zoomFactor: number) {
  return Math.log(zoomFactor) / Math.log(ZOOM_LEVEL_MULTIPLIER_RATIO);
}

function zoomFactorEquals(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.001;
}

type ZoomFactorServiceConfig = Readonly<{
  getZoomFactorSetting: () => Promise<number | null>;
  setZoomFactorSetting: (zoomFactor: number) => Promise<void>;
}>;

type TranslationProvider = 'google' | 'deepl' | 'custom';
type TranslationDirection = 'receive' | 'send';

type TranslationConfig = {
  enabled: boolean;
  provider: TranslationProvider;
  receiveLanguage: string;
  sendLanguage: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  outgoingStyleEnabled: boolean;
  outgoingStylePrompt: string;
};

type TranslationValidationResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  enabled: true,
  provider: 'google',
  receiveLanguage: 'my',
  sendLanguage: 'en',
  apiUrl: '',
  apiKey: '',
  model: '',
  outgoingStyleEnabled: false,
  outgoingStylePrompt: '',
};

let translationConfig: TranslationConfig = {
  ...DEFAULT_TRANSLATION_CONFIG,
};

let translationConfigLoaded = false;

const validatedTranslationConnections = new Set<string>();

function getTranslationConfigPath(): string {
  return path.join(app.getPath('userData'), 'translation-config.json');
}

function normalizeTranslationConfig(value: unknown): TranslationConfig {
  if (typeof value !== 'object' || value === null) {
    return {
      ...DEFAULT_TRANSLATION_CONFIG,
    };
  }

  const input = value as Record<string, unknown>;

  const provider: TranslationProvider =
    input.provider === 'deepl' || input.provider === 'custom'
      ? input.provider
      : 'google';

  return {
    enabled: input.enabled !== false,

    provider,

    receiveLanguage:
      typeof input.receiveLanguage === 'string' && input.receiveLanguage.trim()
        ? input.receiveLanguage.trim()
        : 'my',

    sendLanguage:
      typeof input.sendLanguage === 'string' && input.sendLanguage.trim()
        ? input.sendLanguage.trim()
        : 'en',

    apiUrl: typeof input.apiUrl === 'string' ? input.apiUrl.trim() : '',

    apiKey: typeof input.apiKey === 'string' ? input.apiKey.trim() : '',

    model: typeof input.model === 'string' ? input.model.trim() : '',

    outgoingStyleEnabled: input.outgoingStyleEnabled === true,

    outgoingStylePrompt:
      typeof input.outgoingStylePrompt === 'string'
        ? input.outgoingStylePrompt.trim()
        : '',
  };
}
function getTranslationConnectionFingerprint(
  config: TranslationConfig
): string {
  let material: string;

  if (config.provider === 'google') {
    material = 'google';
  } else if (config.provider === 'deepl') {
    material = JSON.stringify({
      provider: 'deepl',
      apiKey: config.apiKey,
    });
  } else {
    material = JSON.stringify({
      provider: 'custom',
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  return createHash('sha256').update(material).digest('hex');
}

async function loadTranslationConfig(): Promise<void> {
  if (translationConfigLoaded) {
    return;
  }

  translationConfigLoaded = true;

  try {
    const raw = await fs.readFile(getTranslationConfigPath(), 'utf8');

    const stored = JSON.parse(raw) as Record<string, unknown>;

    const base = normalizeTranslationConfig(stored);

    let apiKey = '';

    if (
      typeof stored.apiKeyEncrypted === 'string' &&
      stored.apiKeyEncrypted &&
      safeStorage.isEncryptionAvailable()
    ) {
      try {
        apiKey = safeStorage.decryptString(
          Buffer.from(stored.apiKeyEncrypted, 'base64')
        );
      } catch (error) {
        console.error('[TRANSLATE CONFIG] API key decrypt failed:', error);
      }
    } else if (typeof stored.apiKey === 'string') {
      apiKey = stored.apiKey;
    }

    translationConfig = {
      ...base,
      apiKey,
    };

    // 已经保存在磁盘里的旧配置视为已批准。
    // 以后任何 API URL / Key / Model 的改变仍然必须重新验证。
    validatedTranslationConnections.add(
      getTranslationConnectionFingerprint(translationConfig)
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== 'ENOENT') {
      console.error('[TRANSLATE CONFIG] load failed:', error);
    }
  }
}

async function saveTranslationConfig(): Promise<void> {
  const { apiKey, ...publicConfig } = translationConfig;

  const stored: Record<string, unknown> = {
    ...publicConfig,
  };

  if (apiKey) {
    if (safeStorage.isEncryptionAvailable()) {
      stored.apiKeyEncrypted = safeStorage
        .encryptString(apiKey)
        .toString('base64');
    } else {
      console.warn(
        '[TRANSLATE CONFIG] safeStorage unavailable; API key stored as plaintext'
      );

      stored.apiKey = apiKey;
    }
  }

  await fs.writeFile(
    getTranslationConfigPath(),
    JSON.stringify(stored, null, 2),
    'utf8'
  );
}

function getLanguageName(language: string): string {
  const map: Record<string, string> = {
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

  return map[language] ?? language;
}

function getDeepLTargetLanguage(language: string): string {
  const map: Record<string, string> = {
    my: 'MY',
    en: 'EN-US',
    'zh-CN': 'ZH-HANS',
    'zh-TW': 'ZH-HANT',
    th: 'TH',
    ja: 'JA',
    ko: 'KO',
    es: 'ES',
    fr: 'FR',
    de: 'DE',
    ru: 'RU',
    uk: 'UK',
  };

  return map[language] ?? language.toUpperCase();
}

function getCustomApiEndpoint(value: string): string {
  let url = value.trim().replace(/\/+$/, '');

  if (/\/chat\/completions$/i.test(url)) {
    return url;
  }

  if (/\/v1$/i.test(url)) {
    return `${url}/chat/completions`;
  }

  return `${url}/v1/chat/completions`;
}

async function translateWithGoogle(
  text: string,
  targetLanguage: string
): Promise<string | null> {
  const url = new URL('https://translate.googleapis.com/translate_a/single');

  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetLanguage);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error('Google translation failed: ' + response.status);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google translation returned invalid data');
  }

  const translated = data[0]
    .map((part: unknown) =>
      Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''
    )
    .join('')
    .trim();

  return translated || null;
}

async function translateWithDeepL(
  config: TranslationConfig,
  text: string,
  targetLanguage: string
): Promise<string | null> {
  if (!config.apiKey) {
    throw new Error('DeepL API Key is empty');
  }

  const endpoint = config.apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      target_lang: getDeepLTargetLanguage(targetLanguage),
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      'DeepL translation failed: ' + response.status + ' ' + raw.slice(0, 300)
    );
  }

  const data = JSON.parse(raw) as {
    translations?: Array<{
      text?: unknown;
    }>;
  };

  const translated = data.translations?.[0]?.text;

  return typeof translated === 'string' ? translated.trim() || null : null;
}

type TranslationModelsResult = {
  models: Array<string>;
  endpoint: string;
};

function getTranslationModelsEndpoints(apiUrl: string): Array<string> {
  const base = apiUrl.trim().replace(/\/+$/, '');

  if (!base) {
    return [];
  }

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

async function getTranslationModelList(
  value: unknown
): Promise<TranslationModelsResult> {
  const config = normalizeTranslationConfig(value);

  if (config.provider !== 'custom') {
    throw new Error('Model discovery is only available for Custom API');
  }

  if (!config.apiUrl) {
    throw new Error('API URL is required');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const endpoints = getTranslationModelsEndpoints(config.apiUrl);

  let lastError = 'No compatible models endpoint found';

  for (const endpoint of endpoints) {
    try {
      console.log('[TRANSLATE MODELS] trying:', endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      });

      const raw = await response.text();

      if (!response.ok) {
        lastError = `${endpoint}: HTTP ${response.status} ` + raw.slice(0, 200);

        continue;
      }

      let data: unknown;

      try {
        data = JSON.parse(raw);
      } catch {
        lastError = `${endpoint}: invalid JSON`;

        continue;
      }

      const found = new Set<string>();

      if (typeof data === 'object' && data !== null) {
        const record = data as Record<string, unknown>;

        /*
         * 标准 OpenAI：
         * {
         *   data: [
         *     { id: "model-name" }
         *   ]
         * }
         */
        if (Array.isArray(record.data)) {
          for (const item of record.data) {
            if (typeof item === 'string') {
              found.add(item);
              continue;
            }

            if (typeof item === 'object' && item !== null) {
              const model = item as Record<string, unknown>;

              if (typeof model.id === 'string') {
                found.add(model.id);
              } else if (typeof model.name === 'string') {
                found.add(model.name);
              }
            }
          }
        }

        /*
         * 部分中转站：
         * {
         *   models: [...]
         * }
         */
        if (Array.isArray(record.models)) {
          for (const item of record.models) {
            if (typeof item === 'string') {
              found.add(item);
              continue;
            }

            if (typeof item === 'object' && item !== null) {
              const model = item as Record<string, unknown>;

              if (typeof model.id === 'string') {
                found.add(model.id);
              } else if (typeof model.name === 'string') {
                found.add(model.name);
              }
            }
          }
        }
      }

      const models = [...found]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      if (!models.length) {
        lastError = `${endpoint}: no model IDs returned`;

        continue;
      }

      console.log('[TRANSLATE MODELS] loaded:', models.length);

      return {
        models,
        endpoint,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}
async function translateWithCustomApi(
  config: TranslationConfig,
  text: string,
  targetLanguage: string,
  direction: TranslationDirection = 'receive'
): Promise<string | null> {
  if (!config.apiUrl) {
    throw new Error('Custom API URL is empty');
  }

  if (!config.model) {
    throw new Error('Custom API model is empty');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const languageName = getLanguageName(targetLanguage);

  const hasOutgoingStyle =
    direction === 'send' &&
    config.outgoingStyleEnabled &&
    Boolean(config.outgoingStylePrompt.trim());

  let systemPrompt: string;

  if (hasOutgoingStyle) {
    systemPrompt =
      `You are a professional translation and message-polishing engine. ` +
      `Automatically detect the source language. ` +
      `Translate the user's message into ${languageName}. ` +
      `If the message is already written in ${languageName}, polish it only as needed to follow the user's style instructions. ` +
      `Preserve the original factual meaning, intent, emotional meaning, names, numbers, emojis, URLs, line breaks, and @mentions. ` +
      `Do not invent facts, promises, relationships, opinions, or details that were not present in the original message. ` +
      `Do not answer the message and do not explain the translation. ` +
      `Return only the final message that should be sent.` +
      `\n\nUser-defined outgoing style instructions:\n` +
      config.outgoingStylePrompt.trim();
  } else {
    systemPrompt =
      `You are a strict translation engine. ` +
      `Automatically detect the source language and translate the user's message accurately into ${languageName}. ` +
      `Use the linguistic context and meaning within the message to resolve ambiguity naturally. ` +
      `If the message is already written in ${languageName}, return it unchanged. ` +
      `Preserve the original meaning, intent, tone, names, numbers, emojis, URLs, line breaks, and @mentions. ` +
      `Do not add information, answer the message, explain, summarize, or unnecessarily rewrite it. ` +
      `Return only the translated text.`;
  }

  const response = await fetch(getCustomApiEndpoint(config.apiUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,

      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  });

  const raw = await response.text();

  let data: {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
    error?: {
      message?: unknown;
    };
  } = {};

  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error('Custom API returned invalid JSON: ' + raw.slice(0, 300));
  }

  if (!response.ok) {
    const detail =
      typeof data.error?.message === 'string'
        ? data.error.message
        : raw.slice(0, 300);

    throw new Error('Custom API failed: ' + response.status + ' ' + detail);
  }

  const translated = data.choices?.[0]?.message?.content;

  if (typeof translated !== 'string') {
    throw new Error('Custom API returned no message content');
  }

  return translated.trim() || null;
}
async function translateWithConfig(
  config: TranslationConfig,
  text: string,
  targetLanguage: string,
  direction: TranslationDirection = 'receive'
): Promise<string | null> {
  if (config.provider === 'deepl') {
    return translateWithDeepL(config, text, targetLanguage);
  }

  if (config.provider === 'custom') {
    return translateWithCustomApi(config, text, targetLanguage, direction);
  }

  return translateWithGoogle(text, targetLanguage);
}
async function validateTranslationConfigCandidate(
  value: unknown
): Promise<TranslationValidationResult> {
  const candidate = normalizeTranslationConfig(value);

  if (candidate.provider === 'google') {
    return {
      ok: true,
      message: 'Google free translation is ready',
    };
  }

  if (candidate.provider === 'deepl' && !candidate.apiKey) {
    return {
      ok: false,
      message: 'DeepL API Key is required',
    };
  }

  if (candidate.provider === 'custom') {
    if (!candidate.apiUrl) {
      return {
        ok: false,
        message: 'API URL is required',
      };
    }

    if (!candidate.model) {
      return {
        ok: false,
        message: 'Model is required',
      };
    }
  }

  try {
    const testTarget = candidate.receiveLanguage || 'en';

    const result = await translateWithConfig(
      candidate,
      'Hello, this is a translation connection test.',
      testTarget
    );

    if (!result) {
      throw new Error('Provider returned empty translation');
    }

    validatedTranslationConnections.add(
      getTranslationConnectionFingerprint(candidate)
    );

    return {
      ok: true,
      message: 'API verified successfully',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
export class ZoomFactorService extends EventEmitter {
  readonly #config: ZoomFactorServiceConfig;
  #cachedZoomFactor: number | null = null;
  #isListeningForZoom = false;

  constructor(config: ZoomFactorServiceConfig) {
    super();
    this.#config = config;
    ipcMain.handle('getZoomFactor', () => {
      return this.getZoomFactor();
    });
    ipcMain.removeHandler('translation-config-get');
    ipcMain.removeHandler('translation-config-validate');
    ipcMain.removeHandler('translation-config-set');
    ipcMain.removeHandler('translate-text');

    ipcMain.removeHandler('translation-models-list');
    ipcMain.handle('translation-config-get', async () => {
      await loadTranslationConfig();
      return translationConfig;
    });

    ipcMain.handle(
      'translation-config-validate',
      async (_event, value: unknown) => {
        return validateTranslationConfigCandidate(value);
      }
    );

    ipcMain.handle(
      'translation-models-list',
      async (_event, value: unknown) => {
        return getTranslationModelList(value);
      }
    );
    ipcMain.handle('translation-config-set', async (_event, value: unknown) => {
      await loadTranslationConfig();

      const candidate = normalizeTranslationConfig(value);

      const fingerprint = getTranslationConnectionFingerprint(candidate);

      if (
        candidate.provider !== 'google' &&
        !validatedTranslationConnections.has(fingerprint)
      ) {
        throw new Error('Translation API must be verified before Save & Use');
      }

      translationConfig = candidate;

      await saveTranslationConfig();

      validatedTranslationConnections.add(fingerprint);

      console.log(
        '[TRANSLATE CONFIG] saved and activated:',
        translationConfig.provider,
        translationConfig.receiveLanguage,
        translationConfig.sendLanguage
      );

      return translationConfig;
    });

    ipcMain.handle('translate-text', async (_event, value: unknown) => {
      await loadTranslationConfig();

      if (!translationConfig.enabled) {
        return null;
      }

      if (typeof value !== 'object' || value === null) {
        throw new TypeError('translate-text expects an object');
      }

      const payload = value as {
        text?: unknown;
        direction?: unknown;
      };

      if (typeof payload.text !== 'string') {
        throw new TypeError('translate-text expects text to be a string');
      }

      const direction: TranslationDirection =
        payload.direction === 'send' ? 'send' : 'receive';

      const text = payload.text.trim();

      if (!text) {
        return null;
      }

      if (text.length > 5000) {
        throw new Error('translate-text input is too long');
      }

      const targetLanguage =
        direction === 'send'
          ? translationConfig.sendLanguage
          : translationConfig.receiveLanguage;

      console.log(
        '[TRANSLATE IPC]',
        translationConfig.provider,
        direction,
        targetLanguage
      );

      const translated = await translateWithConfig(
        translationConfig,
        text,
        targetLanguage,
        direction
      );

      console.log('[TRANSLATE IPC] result:', translated);

      return translated;
    });
    ipcMain.on('setZoomFactor', (_event, zoomFactor) => {
      return this.setZoomFactor(zoomFactor);
    });
  }

  async getZoomFactor(): Promise<number> {
    if (this.#cachedZoomFactor != null) {
      return this.#cachedZoomFactor;
    }
    const zoomFactorSetting = await this.#config.getZoomFactorSetting();
    const zoomFactor = zoomFactorSetting ?? DEFAULT_ZOOM_FACTOR;
    this.#cachedZoomFactor = zoomFactor;
    return zoomFactor;
  }

  async getZoomLevel(): Promise<number> {
    const zoomFactor = await this.getZoomFactor();
    return zoomFactorToZoomLevel(zoomFactor);
  }

  async setZoomFactor(zoomFactor: number): Promise<void> {
    if (
      this.#cachedZoomFactor != null &&
      zoomFactorEquals(this.#cachedZoomFactor, zoomFactor)
    ) {
      return;
    }
    this.#cachedZoomFactor = zoomFactor;
    await this.#config.setZoomFactorSetting(zoomFactor);
    this.emit('zoomFactorChanged', zoomFactor);
  }

  async setZoomLevel(zoomLevel: number): Promise<void> {
    const zoomFactor = zoomLevelToZoomFactor(zoomLevel);
    await this.setZoomFactor(zoomFactor);
  }

  async zoomIn(): Promise<void> {
    const zoomLevel = await this.getZoomLevel();
    await this.setZoomLevel(zoomLevel + 1);
  }

  async zoomOut(): Promise<void> {
    const zoomLevel = await this.getZoomLevel();
    await this.setZoomLevel(zoomLevel - 1);
  }

  async zoomReset(): Promise<void> {
    await this.setZoomLevel(0);
  }

  // Call this after creating a new window before you show it
  async syncWindow(window: BrowserWindow): Promise<void> {
    const onWindowChange = async () => {
      const zoomFactor = window.webContents.getZoomFactor();
      await this.setZoomFactor(zoomFactor);
    };

    const onServiceChange = (zoomFactor: number) => {
      window.webContents.setZoomFactor(zoomFactor);
      window.webContents.send('zoomFactorChanged', zoomFactor);
    };

    let initialZoomFactor: number;
    try {
      initialZoomFactor = await this.getZoomFactor();
    } catch (error) {
      log.error('Failed to get zoom factor', error);
      initialZoomFactor = DEFAULT_ZOOM_FACTOR;
    }

    const maybeListenForZoomEvents = () => {
      if (this.#isListeningForZoom) {
        return;
      }

      window.webContents.on('zoom-changed', onWindowChange);
      this.on('zoomFactorChanged', onServiceChange);
      this.#isListeningForZoom = true;
    };

    const stopListenForZoomEvents = () => {
      window.webContents.off('zoom-changed', onWindowChange);
      this.off('zoomFactorChanged', onServiceChange);
      this.#isListeningForZoom = false;
    };

    window.once('ready-to-show', () => {
      // Workaround to apply zoomFactor because webPreferences does not handle it
      // https://github.com/electron/electron/issues/10572
      window.webContents.setZoomFactor(initialZoomFactor);

      // Install handler here after we init zoomFactor otherwise an initial
      // preferred-size-changed event emits with an undesired zoomFactor.
      maybeListenForZoomEvents();
    });

    // On MacOS, the 'show' event does not reliably emit  on startup, so also try to
    // setup zoom handlers earlier during ready-to-show.
    window.on('show', maybeListenForZoomEvents);

    window.on('close', stopListenForZoomEvents);
  }
}
