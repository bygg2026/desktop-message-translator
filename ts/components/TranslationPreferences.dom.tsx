// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { TranslationConfigInput } from '../types/Translation.std.ts';
import { TRANSLATION_LANGUAGES } from '../types/Translation.std.ts';

export function TranslationPreferences(): JSX.Element {
  const [config, setConfig] = useState<TranslationConfigInput | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [models, setModels] = useState<ReadonlyArray<string>>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    void window.SignalContext.getTranslationConfig()
      .then(value => {
        if (!cancelled) {
          setConfig(value);
          setHasKey(value.apiKeyConfigured);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('读取配置失败 / Settings could not be loaded');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const change = (patch: Partial<TranslationConfigInput>) => {
    setConfig(previous => (previous ? { ...previous, ...patch } : previous));
    setMessage('');
  };
  const action = async (kind: 'save' | 'validate' | 'models') => {
    if (!config || pending) {
      return;
    }
    setPending(true);
    setMessage('处理中 / Working…');
    try {
      if (kind === 'models') {
        const result = await window.SignalContext.getTranslationModels(config);
        setModels(result.models);
        setMessage(`${result.models.length} models`);
      } else if (kind === 'validate') {
        const result =
          await window.SignalContext.validateTranslationConfig(config);
        setMessage(
          result.ok
            ? '连接成功 / Connection verified'
            : '连接失败，请检查地址、密钥和模型 / Check connection settings'
        );
      } else {
        const result = await window.SignalContext.setTranslationConfig(config);
        setConfig({ ...result, apiKey: undefined });
        setHasKey(result.apiKeyConfigured);
        setMessage('已保存 / Saved');
      }
    } catch {
      setMessage(
        '操作失败，请检查配置或网络后重试 / Check settings and connection, then retry'
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Translation settings" style={{ padding: 16 }}>
      <h2>消息翻译 / Message translation</h2>
      <p>
        开启后，消息明文会发送给选择的翻译服务。Messages are sent to the
        selected translation provider.
      </p>
      {config && (
        <fieldset disabled={pending} style={{ display: 'grid', gap: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={event => change({ enabled: event.target.checked })}
            />{' '}
            开启翻译 / Enable translation
          </label>
          <label>
            服务 / Provider{' '}
            <select
              value={config.provider}
              onChange={event =>
                change({
                  provider:
                    event.target.value === 'custom' ? 'custom' : 'google',
                })
              }
            >
              <option value="google">Google Translate</option>
              <option value="custom">OpenAI-compatible API</option>
            </select>
          </label>
          {(['receiveLanguage', 'sendLanguage'] as const).map(field => (
            <label key={field}>
              {field === 'receiveLanguage'
                ? '接收语言 / Receive'
                : '发送语言 / Send'}{' '}
              <select
                value={config[field]}
                onChange={event => change({ [field]: event.target.value })}
              >
                {TRANSLATION_LANGUAGES.map(language => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {config.provider === 'custom' && (
            <>
              <label>
                API URL{' '}
                <input
                  type="url"
                  value={config.apiUrl}
                  onChange={event => change({ apiUrl: event.target.value })}
                />
              </label>
              <label>
                API Key{' '}
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    hasKey
                      ? '已保存，留空保留 / Saved key retained'
                      : 'Optional'
                  }
                  value={config.apiKey ?? ''}
                  onChange={event =>
                    change({ apiKey: event.target.value || undefined })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  change({ apiKey: null });
                  setHasKey(false);
                }}
              >
                清除密钥 / Clear key
              </button>
              <label>
                Model{' '}
                <input
                  list="translation-models"
                  value={config.model}
                  onChange={event => change({ model: event.target.value })}
                />
              </label>
              <datalist id="translation-models">
                {models.map(model => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => {
                  void action('models');
                }}
              >
                获取模型 / Load models
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={config.outgoingStyleEnabled}
                  onChange={event =>
                    change({ outgoingStyleEnabled: event.target.checked })
                  }
                />{' '}
                自定义发送语气 / Outgoing style
              </label>
              {config.outgoingStyleEnabled && (
                <label>
                  语气要求 / Style{' '}
                  <textarea
                    maxLength={4000}
                    value={config.outgoingStylePrompt}
                    onChange={event =>
                      change({ outgoingStylePrompt: event.target.value })
                    }
                  />
                </label>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              void action('validate');
            }}
          >
            验证连接 / Verify
          </button>
          <button
            type="button"
            onClick={() => {
              void action('save');
            }}
          >
            保存并使用 / Save and use
          </button>
        </fieldset>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
