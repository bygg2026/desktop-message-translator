// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { app } from 'electron';

import { start } from './base_config.node.ts';
import config from './config.main.ts';
import * as Errors from '../ts/types/errors.std.ts';
import OS from '../ts/util/os/osMain.node.ts';

import { accountDataPath, accountIdFromArgs } from './account_profiles.node.ts';

export const activeAccountId = accountIdFromArgs(process.argv);
let userData: string | undefined = accountDataPath(
  app.getPath('appData'),
  activeAccountId
);
// Use separate data directory for benchmarks & development
if (activeAccountId !== 'default') {
  // Named accounts always retain their isolated directory.
} else if (config.has('storagePath')) {
  userData = String(config.get('storagePath'));
} else if (config.has('storageProfile')) {
  userData = join(
    app.getPath('appData'),
    // oxlint-disable-next-line typescript/restrict-template-expressions
    `Desktop Message Translator-${config.get('storageProfile')}`
  );
} else if (OS.isAppImage()) {
  userData = join(app.getPath('appData'), `${app.getName()} AppImage`);
}

if (userData !== undefined) {
  try {
    mkdirSync(userData, { recursive: true });
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error('Failed to create userData', Errors.toLogFormat(error));
  }

  app.setPath('userData', userData);
}

// Use console.log because logger isn't fully initialized yet
// oxlint-disable-next-line no-console
console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = join(userDataPath, 'config.json');

export const userConfig = start({
  name: 'user',
  targetPath,
  throwOnFilesystemErrors: true,
});

export const get = userConfig.get.bind(userConfig);
export const remove = userConfig.remove.bind(userConfig);
export const set = userConfig.set.bind(userConfig);
