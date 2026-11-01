// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TranslationService } from '../ts/services/translation/TranslationService.node.ts';

const storage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(`encrypted:${value}`),
  decryptString: value => value.toString().slice(10),
};
async function fixture(t, fetch) {
  const dir = await mkdtemp(join(tmpdir(), 'dmt-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'config.json');
  return { path, service: new TranslationService({ path, storage, fetch }) };
}
test('Google results are joined, cached, and disabled translation returns null', async t => {
  let calls = 0;
  const { service } = await fixture(t, async () => {
    calls += 1;
    return Response.json([
      [
        ['Hello', 'x'],
        [' world', 'y'],
      ],
    ]);
  });
  const input = { text: 'source', direction: 'receive' };
  assert.equal(await service.translate(input), 'Hello world');
  assert.equal(await service.translate(input), 'Hello world');
  assert.equal(calls, 1);
  await service.setConfig({ ...(await service.getConfig()), enabled: false });
  assert.equal(await service.translate(input), null);
});
test('custom keys stay out of renderer snapshots and persisted plaintext', async t => {
  let auth;
  const { service, path } = await fixture(t, async (_url, init) => {
    auth = init.headers.Authorization;
    return Response.json({ choices: [{ message: { content: 'Hello' } }] });
  });
  const config = await service.getConfig();
  const result = await service.setConfig({
    ...config,
    provider: 'custom',
    apiUrl: 'https://example.test',
    model: 'test',
    apiKey: 'secret-value',
  });
  assert.equal(auth, 'Bearer secret-value');
  assert.equal(result.apiKeyConfigured, true);
  assert.equal('apiKey' in result, false);
  const disk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal('apiKey' in disk.config, false);
  assert.equal(JSON.stringify(disk).includes('secret-value'), false);
  await service.setConfig({ ...result, sendLanguage: 'ja' });
  assert.equal(auth, 'Bearer secret-value');
});
test('HTTP errors do not expose response bodies and failed saves preserve configuration', async t => {
  const { service } = await fixture(
    t,
    async () => new Response('private secret body', { status: 401 })
  );
  const before = await service.getConfig();
  await assert.rejects(
    service.setConfig({
      ...before,
      provider: 'custom',
      apiUrl: 'https://example.test',
      model: 'test',
    }),
    error => !error.message.includes('private')
  );
  assert.deepEqual(await service.getConfig(), before);
});
test('custom provider works over HTTP and discovers models', async t => {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }
    requests.push({
      url: request.url,
      auth: request.headers.authorization,
      body: body ? JSON.parse(body) : null,
    });
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify(
        request.url.endsWith('/models')
          ? { data: [{ id: 'test-model' }, { id: 'test-model' }] }
          : { choices: [{ message: { content: 'Translated result' } }] }
      )
    );
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      })
  );
  const { service } = await fixture(t);
  const config = await service.setConfig({
    ...(await service.getConfig()),
    provider: 'custom',
    apiUrl: `http://127.0.0.1:${server.address().port}`,
    model: 'test-model',
    apiKey: 'test-key',
  });
  assert.equal(
    await service.translate({
      text: 'Sample text',
      direction: 'send',
      configRevision: config.revision,
    }),
    'Translated result'
  );
  assert.deepEqual((await service.models(config)).models, ['test-model']);
  assert.equal(requests[1].url, '/v1/chat/completions');
  assert.equal(requests[1].auth, 'Bearer test-key');
  assert.equal(requests[1].body.model, 'test-model');
  assert.ok(
    requests[1].body.messages.some(message =>
      message.content.includes('Sample text')
    )
  );
});

test('translation timeout aborts transport and releases the request slot', async t => {
  let aborted = false;
  let calls = 0;
  const { service } = await fixture(t, async (_url, { signal }) => {
    calls += 1;
    if (calls > 1) {
      return Response.json([[['Recovered']]]);
    }
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          aborted = true;
          reject(new Error('private transport error'));
        },
        { once: true }
      );
    });
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = service.translate({ text: 'First', direction: 'receive' });
  const rejected = assert.rejects(
    pending,
    error => !error.message.includes('private')
  );
  // Allow asynchronous config loading to reach the mocked network transport.
  while (calls === 0) {
    await new Promise(resolve => setImmediate(resolve));
  }
  t.mock.timers.tick(25_001);
  await rejected;
  assert.equal(aborted, true);
  assert.equal(
    await service.translate({ text: 'Second', direction: 'receive' }),
    'Recovered'
  );
});

test('configuration revision rejects stale requests', async t => {
  const { service } = await fixture(t, async () =>
    Response.json([[['Hello']]])
  );
  const before = await service.getConfig();
  await service.setConfig({ ...before, receiveLanguage: 'ja' });
  await assert.rejects(
    service.translate({
      text: 'source',
      direction: 'receive',
      configRevision: before.revision,
    })
  );
});
