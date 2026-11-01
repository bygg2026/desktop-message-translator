// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, 'package.json'));
const builderRequire = createRequire(require.resolve('electron-builder'));
const appBuilderRequire = createRequire(
  builderRequire.resolve('app-builder-lib')
);
const rebuildRequire = createRequire(
  appBuilderRequire.resolve('@electron/rebuild')
);
const gyp = rebuildRequire.resolve('node-gyp/bin/node-gyp.js');
const electronVersion = require('./package.json').devDependencies.electron;
const result = spawnSync(
  process.execPath,
  [
    gyp,
    'rebuild',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    '--arch=x64',
  ],
  {
    cwd: join(root, 'packages/windows-ucv'),
    stdio: 'inherit',
  }
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
