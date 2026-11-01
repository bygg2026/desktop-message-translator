// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { app, ipcMain, safeStorage } from 'electron';
import type { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { TranslationService } from './TranslationService.node.ts';

export function installTranslationIpc(
  getWindow: () => BrowserWindow | undefined
): void {
  let service: TranslationService | undefined;
  const getService = () => {
    service ??= new TranslationService({
      path: join(app.getPath('userData'), 'translation-v2.json'),
      storage: safeStorage,
      onChanged: config => {
        const window = getWindow();
        if (window && !window.isDestroyed()) {
          window.webContents.send('translation-config-changed', config);
        }
      },
    });
    return service;
  };
  const handlers: Record<string, (value: unknown) => Promise<unknown>> = {
    'translation-config-get': () => getService().getConfig(),
    'translation-config-set': value => getService().setConfig(value),
    'translation-config-validate': value => getService().validate(value),
    'translation-models-list': value => getService().models(value),
    'translate-text': value => getService().translate(value),
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, value: unknown) => {
      const window = getWindow();
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      ) {
        throw new Error('Translation request rejected');
      }
      return handler(value);
    });
  }
}
