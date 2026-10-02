// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import type { KeyboardEvent, JSX, ReactNode } from 'react';
import type { AttachmentType } from '../../types/Attachment.std.ts';
import { canBeDownloaded, isDownloaded } from '../../util/Attachment.std.ts';
import type { ShowConversationType } from '../../state/ducks/conversations.preload.ts';
import type { HydratedBodyRangesType } from '../../types/BodyRange.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { MessageTextRenderer } from './MessageTextRenderer.dom.tsx';
import type { RenderLocation } from './MessageTextRenderer.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { shouldLinkifyMessage } from '../../types/LinkPreview.std.ts';
import { FunJumboEmojiSize } from '../fun/FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';

function getSizeClass(str: string): FunJumboEmojiSize | null {
  const count = Emoji.getJumboEmojiCount(str);
  if (count == null) {
    return null;
  }
  if (count === 1) {
    return FunJumboEmojiSize.Max;
  }
  if (count === 2) {
    return FunJumboEmojiSize.ExtraLarge;
  }
  if (count === 3) {
    return FunJumboEmojiSize.Large;
  }
  if (count === 4) {
    return FunJumboEmojiSize.Medium;
  }
  if (count === 5) {
    return FunJumboEmojiSize.Small;
  }
  throw missingCaseError(count);
}

export type Props = {
  author?: string | null;
  bodyRanges?: HydratedBodyRangesType;
  direction?: 'incoming' | 'outgoing';
  // If set, all emoji will be the same size. Otherwise, just one emoji will be large.
  disableJumbomoji?: boolean;
  // If set, interactive elements will be left as plain text: links, mentions, spoilers
  disableLinks?: boolean;
  i18n: LocalizerType;
  isSpoilerExpanded: Record<string, boolean>;
  kickOffBodyDownload?: () => void;
  onExpandSpoiler?: (data: Record<number, boolean>) => unknown;
  onIncreaseTextLength?: () => unknown;
  prefix?: string;
  renderLocation: RenderLocation;
  showConversation?: ShowConversationType;
  text: string;
  textAttachment?: Pick<
    AttachmentType,
    'pending' | 'digest' | 'key' | 'wasTooBig' | 'path'
  >;
  originalText: string;
};

const translationCache = new Map<string, Promise<string | null>>();

function translateToChinese(text: string): Promise<string | null> {
  const trimmed = text.trim();

  if (!trimmed) {
    return Promise.resolve(null);
  }

  return window.SignalContext.getTranslationConfig().then(config => {
    if (!config.enabled) {
      return null;
    }

    const cacheKey = `${config.provider}|${config.receiveLanguage}|${trimmed}`;

    const cached = translationCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    console.log(
      '[TRANSLATE UI] request:',
      config.provider,
      config.receiveLanguage,
      trimmed
    );

    const request = window.SignalContext.translateText(
      trimmed,
      'receive'
    ).catch(error => {
      console.error('[TRANSLATE UI] failed:', error);
      translationCache.delete(cacheKey);
      throw error;
    });

    translationCache.set(cacheKey, request);

    return request;
  });
}

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export function MessageBody({
  author,
  bodyRanges,
  direction,
  disableJumbomoji,
  disableLinks,
  i18n,
  isSpoilerExpanded,
  kickOffBodyDownload,
  onExpandSpoiler,
  onIncreaseTextLength,
  prefix,
  renderLocation,
  showConversation,
  text,
  textAttachment,
  originalText,
}: Props): JSX.Element {
  const [translation, setTranslation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setTranslation(null);

    void translateToChinese(text)
      .then(result => {
        if (!cancelled) {
          setTranslation(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTranslation(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  const shouldDisableLinks =
    disableLinks || !shouldLinkifyMessage(originalText);
  const textWithSuffix =
    textAttachment?.pending || onIncreaseTextLength || textAttachment?.wasTooBig
      ? `${text}...`
      : text;

  const sizeClass = disableJumbomoji ? null : getSizeClass(text);

  let endNotification: ReactNode;
  if (onIncreaseTextLength) {
    endNotification = (
      <button
        className="MessageBody__read-more"
        onClick={() => {
          onIncreaseTextLength();
        }}
        onKeyDown={(ev: KeyboardEvent) => {
          if (ev.key === 'Space' || ev.key === 'Enter') {
            onIncreaseTextLength();
          }
        }}
        tabIndex={0}
        type="button"
      >
        {' '}
        {i18n('icu:MessageBody--read-more')}
      </button>
    );
  } else if (textAttachment?.pending) {
    endNotification = (
      <span className="MessageBody__highlight"> {i18n('icu:downloading')}</span>
    );
  } else if (
    textAttachment &&
    canBeDownloaded(textAttachment) &&
    !isDownloaded(textAttachment) &&
    kickOffBodyDownload
  ) {
    endNotification = (
      <span>
        {' '}
        <button
          className="MessageBody__download-body"
          onClick={() => {
            kickOffBodyDownload();
          }}
          onKeyDown={(ev: KeyboardEvent) => {
            if (ev.key === 'Space' || ev.key === 'Enter') {
              kickOffBodyDownload();
            }
          }}
          tabIndex={0}
          type="button"
        >
          {i18n('icu:downloadFullMessage')}
        </button>
      </span>
    );
  } else if (textAttachment?.wasTooBig) {
    endNotification = (
      <span className="MessageBody__message-too-long">
        {' '}
        {i18n('icu:MessageBody--message-too-long')}
      </span>
    );
  }
  return (
    <span>
      {author && (
        <>
          <span className="MessageBody__author">
            <UserText text={author} />
          </span>
          :{' '}
        </>
      )}
      {prefix && (
        <>
          <span className="MessageBody__prefix">
            <UserText text={prefix} />
          </span>{' '}
        </>
      )}

      <MessageTextRenderer
        bodyRanges={bodyRanges ?? []}
        direction={direction}
        disableLinks={shouldDisableLinks}
        jumboEmojiSize={sizeClass}
        i18n={i18n}
        isSpoilerExpanded={isSpoilerExpanded}
        messageText={textWithSuffix}
        originalMessageText={originalText}
        onMentionTrigger={conversationId =>
          showConversation?.({ conversationId })
        }
        onExpandSpoiler={onExpandSpoiler}
        renderLocation={renderLocation}
        textLength={text.length}
      />

      {endNotification}
      {translation && (
        <span
          style={{
            display: 'block',
            marginTop: '4px',
            fontSize: '12px',
            opacity: 0.72,
            whiteSpace: 'pre-wrap',
          }}
        >
          {translation}
        </span>
      )}
    </span>
  );
}
