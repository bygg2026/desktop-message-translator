// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { join } from 'node:path';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';

export const DEFAULT_ACCOUNT = 'default';
export function accountIdFromArgs(argv: ReadonlyArray<string>): string {
  if (argv.includes('--translator-account'))
    throw new Error('Use --translator-account=<id>');
  const values = argv.filter(value =>
    value.startsWith('--translator-account=')
  );
  if (values.length > 1) throw new Error('Duplicate account argument');
  const id =
    values[0]?.slice('--translator-account='.length) ?? DEFAULT_ACCOUNT;
  if (
    id !== DEFAULT_ACCOUNT &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      id
    )
  ) {
    throw new Error('Invalid account identifier');
  }
  return id;
}
export function accountDataPath(appData: string, id: string): string {
  accountIdFromArgs([`--translator-account=${id}`]);
  return id === DEFAULT_ACCOUNT
    ? join(appData, 'Desktop Message Translator')
    : join(appData, 'Desktop Message Translator Accounts', id);
}
export type AccountProfile = { id: string; name: string; archived?: boolean };
export function setAccountArchived(
  appData: string,
  id: string,
  archived: boolean
): void {
  if (
    id === DEFAULT_ACCOUNT ||
    !listAccounts(appData).some(account => account.id === id)
  )
    throw new Error('Account cannot be archived');
  writeFileSync(
    join(accountDataPath(appData, id), 'account-state.json'),
    JSON.stringify({ archived })
  );
}
export function listAccounts(appData: string): Array<AccountProfile> {
  const accounts: Array<AccountProfile> = [
    { id: DEFAULT_ACCOUNT, name: '默认账号 / Default' },
  ];
  const root = join(appData, 'Desktop Message Translator Accounts');
  if (!existsSync(root)) return accounts;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const id = accountIdFromArgs([`--translator-account=${entry.name}`]);
      const value: unknown = JSON.parse(
        readFileSync(join(root, id, 'account-name.json'), 'utf8')
      );
      let archived = false;
      try {
        const state: unknown = JSON.parse(
          readFileSync(join(root, id, 'account-state.json'), 'utf8')
        );
        archived =
          typeof state === 'object' &&
          state !== null &&
          'archived' in state &&
          state.archived === true;
      } catch {
        /* Older accounts are active by default. */
      }
      if (typeof value === 'string' && value.length > 0 && value.length <= 60)
        accounts.push({ id, name: value, archived });
    } catch {
      /* Ignore incomplete or unrelated directories. */
    }
  }
  return accounts;
}
export function renameAccount(appData: string, id: string, name: string): void {
  const normalized = name.trim();
  if (id === DEFAULT_ACCOUNT)
    throw new Error('Default account name is reserved');
  if (!normalized || normalized.length > 60)
    throw new Error('账号名称需要 1–60 个字符');
  if (!listAccounts(appData).some(account => account.id === id))
    throw new Error('Account not found');
  writeFileSync(
    join(accountDataPath(appData, id), 'account-name.json'),
    JSON.stringify(normalized)
  );
}

export function createAccount(appData: string, name: string): AccountProfile {
  const normalized = name.trim();
  if (!normalized || normalized.length > 60)
    throw new Error('账号名称需要 1–60 个字符');
  const account = { id: randomUUID(), name: normalized };
  const directory = accountDataPath(appData, account.id);
  mkdirSync(join(appData, 'Desktop Message Translator Accounts'), {
    recursive: true,
  });
  mkdirSync(directory, { recursive: false });
  writeFileSync(
    join(directory, 'account-name.json'),
    JSON.stringify(normalized),
    { flag: 'wx' }
  );
  return account;
}
