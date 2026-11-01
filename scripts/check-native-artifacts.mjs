// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
const required =
  process.platform === 'win32'
    ? [
        'packages/windows-ucv/dist/index.js',
        'packages/windows-ucv/build/Release/windows-ucv.node',
        'node_modules/@signalapp/ringrtc/build/win32/libringrtc-x64.node',
        'node_modules/@signalapp/libsignal-client/prebuilds/win32-x64/@signalapp+libsignal-client.node',
        'node_modules/@signalapp/sqlcipher/prebuilds/win32-x64/@signalapp+sqlcipher.node',
      ]
    : [];
const missing = [];
for (const file of required) {
  try {
    await access(file, constants.R_OK);
  } catch {
    missing.push(file);
  }
}
if (missing.length) {
  console.error(
    'Native runtime artifacts missing; do not publish this build:\n' +
      missing.join('\n')
  );
  process.exitCode = 1;
} else {
  console.log('Native runtime artifacts present');
}
