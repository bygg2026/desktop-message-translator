// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');
const path = require('node:path');
(async () => {
  delete process.env.ELECTRON_RUN_AS_NODE;
  delete process.env.CHROME_CRASHPAD_PIPE_NAME;
  const diagnostic = process.env.DMT_DIAGNOSTIC_NO_SANDBOX === '1';
  if (diagnostic) console.log('DIAGNOSTIC ONLY: Chromium sandbox disabled for this test');
  const app = await electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['.', ...(diagnostic ? ['--no-sandbox', '--disable-gpu'] : [])],
    env: { ...process.env, NODE_ENV: 'development', NODE_CONFIG: JSON.stringify({ storagePath: path.resolve('.smoke-profile'), openDevTools: false }) },
    timeout: 60000,
  });
  try {
    const window = await app.firstWindow();
    await window.getByText('Link your account', { exact: false }).waitFor({ timeout: 30000 });
    console.log('Welcome screen loaded:', await window.title());
    const cdp = await window.context().newCDPSession(window);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');
    let verified = false;
    for (const world of worlds) {
      const response = await cdp.send('Runtime.evaluate', {
        expression: 'window.SignalContext ? window.SignalContext.getTranslationConfig() : null',
        contextId: world.id, awaitPromise: true, returnByValue: true,
      });
      assert.equal(response.exceptionDetails, undefined);
      if (response.result.value) {
        assert.equal(typeof response.result.value.apiKeyConfigured, 'boolean');
        assert.equal('apiKey' in response.result.value, false);
        assert.ok(['google', 'custom'].includes(response.result.value.provider));
        verified = true;
      }
    }
    assert.ok(verified, 'Translation IPC was not found in any renderer world');
    console.log('Translation IPC configuration verified');
    await window.screenshot({ path: 'smoke-startup.png' });
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
