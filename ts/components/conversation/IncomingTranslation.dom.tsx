// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

export function IncomingTranslation({
  text,
}: {
  text: string;
}): JSX.Element | null {
  const [revision, setRevision] = useState(0);
  const [translated, setTranslated] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(
    () =>
      window.SignalContext.onTranslationConfigChanged(() => {
        setTranslated(null);
        setRevision(value => value + 1);
      }),
    []
  );
  useEffect(() => {
    let cancelled = false;
    setTranslated(null);
    setFailed(false);
    void (async () => {
      try {
        const config = await window.SignalContext.getTranslationConfig();
        if (cancelled || !config.enabled || !text.trim()) {
          return;
        }
        const result = await window.SignalContext.translateText(
          text,
          'receive',
          config.revision
        );
        if (!cancelled) {
          setTranslated(result);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, revision]);
  if (failed) {
    return (
      <span style={{ display: 'block' }}>
        <button type="button" onClick={() => setRevision(value => value + 1)}>
          翻译失败，点击重试 / Retry translation
        </button>
      </span>
    );
  }
  return translated ? (
    <span
      style={{
        display: 'block',
        marginTop: 4,
        fontSize: 12,
        opacity: 0.8,
        whiteSpace: 'pre-wrap',
      }}
    >
      {translated}
    </span>
  ) : null;
}
