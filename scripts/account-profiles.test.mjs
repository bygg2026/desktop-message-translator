import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  accountIdFromArgs,
  accountDataPath,
  listAccounts,
  createAccount,
  renameAccount,
  setAccountArchived,
} from '../app/account_profiles.node.ts';
test('accounts preserve default path and isolate created profiles', t => {
  const root = mkdtempSync(join(tmpdir(), 'dmt-accounts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(
    accountDataPath(root, 'default'),
    join(root, 'Desktop Message Translator')
  );
  listAccounts(root);
  const first = createAccount(root, '工作');
  const second = createAccount(root, '个人');
  assert.notEqual(first.id, second.id);
  writeFileSync(
    join(accountDataPath(root, first.id), 'translation-v2.json'),
    'test'
  );
  assert.equal(
    existsSync(join(accountDataPath(root, second.id), 'translation-v2.json')),
    false
  );
  assert.equal(listAccounts(root).length, 3);
  renameAccount(root, first.id, '工作新名称');
  assert.equal(
    listAccounts(root).find(a => a.id === first.id).name,
    '工作新名称'
  );
  assert.ok(
    existsSync(join(accountDataPath(root, first.id), 'translation-v2.json'))
  );
  setAccountArchived(root, first.id, true);
  assert.equal(listAccounts(root).find(a => a.id === first.id).archived, true);
  assert.ok(
    existsSync(join(accountDataPath(root, first.id), 'translation-v2.json'))
  );
  setAccountArchived(root, first.id, false);
  assert.equal(listAccounts(root).find(a => a.id === first.id).archived, false);
  assert.throws(() => setAccountArchived(root, 'default', true));
  assert.throws(() => renameAccount(root, 'default', '替换'));
  assert.throws(() => renameAccount(root, first.id, ' '));
  assert.equal(
    accountIdFromArgs([`--translator-account=${first.id}`]),
    first.id
  );
});
test('invalid account identifiers cannot traverse directories or conflict', () => {
  for (const id of ['../Signal', '', 'a/b', 'DEFAULT', 'C:\\data']) {
    assert.throws(() => accountIdFromArgs([`--translator-account=${id}`]));
  }
  assert.throws(() =>
    accountIdFromArgs([
      '--translator-account=default',
      '--translator-account=default',
    ])
  );
});
