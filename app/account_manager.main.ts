// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { app, BrowserWindow, dialog } from 'electron';
import { spawn } from 'node:child_process';
import {
  accountIdFromArgs,
  createAccount,
  listAccounts,
  renameAccount,
  setAccountArchived,
} from './account_profiles.node.ts';

let manager: BrowserWindow | undefined;
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] ?? c
  );
export function showAccountManager(): void {
  if (manager && !manager.isDestroyed()) {
    manager.show();
    manager.focus();
    return;
  }
  const window = new BrowserWindow({
    width: 620,
    height: 650,
    title: '账号管理 / Accounts',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'translator-account-manager',
    },
  });
  manager = window;
  window.on('closed', () => {
    manager = undefined;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const render = (): void => {
    const accounts = listAccounts(app.getPath('appData'));
    const archived = accounts
      .filter(account => account.archived)
      .map(
        account =>
          `<li>${escapeHtml(account.name)} <a href="https://accounts.invalid/restore?id=${account.id}">恢复到列表</a></li>`
      )
      .join('');
    const rows = accounts
      .filter(account => !account.archived)
      .map(
        account =>
          `<li><div><strong>${escapeHtml(account.name)}</strong>${account.id === 'default' ? '' : `<form action="https://accounts.invalid/rename" method="get"><input type="hidden" name="id" value="${account.id}"><input name="name" value="${escapeHtml(account.name)}" required maxlength="60" aria-label="账号备注"><button type="submit">重命名</button></form>`}</div><div><a href="https://accounts.invalid/open?id=${account.id}">打开窗口</a>${account.id === 'default' ? '' : `<p><a href="https://accounts.invalid/archive?id=${account.id}">移出列表</a></p>`}</div></li>`
      )
      .join('');
    void window.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<!doctype html><html lang="zh"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action https://accounts.invalid"><title>账号管理</title><style>body{font:16px system-ui;padding:28px;color:#202632;background:#f5f7fc}li{display:flex;justify-content:space-between;padding:16px;background:white;margin:10px 0;border-radius:10px}ul{padding:0}input,button{padding:12px;font:inherit}p{line-height:1.6}a{color:#3159c7}</style><h1>多账号管理</h1><p>每个账号使用独立聊天数据和翻译设置。新账号首次打开需要手机扫码。现有登录保留在默认账号。</p><ul>${rows}</ul><form action="https://accounts.invalid/create" method="get"><input name="name" required maxlength="60" placeholder="账号备注，例如：工作"><button type="submit">新增账号</button></form><p>同一账号重复打开会切回已有窗口。移出列表保留本地数据，不退出手机关联。</p><details><summary>已移出的账号</summary><ul>${archived}</ul></details></html>`
        )
    );
  };
  window.webContents.on('will-navigate', (event, target) => {
    event.preventDefault();
    void (async () => {
      try {
        const url = new URL(target);
        if (url.origin !== 'https://accounts.invalid') return;
        if (url.pathname === '/create') {
          createAccount(
            app.getPath('appData'),
            url.searchParams.get('name') ?? ''
          );
          render();
          return;
        }
        if (url.pathname === '/archive' || url.pathname === '/restore') {
          const archive = url.pathname === '/archive';
          if (archive) {
            const answer = await dialog.showMessageBox(window, {
              type: 'question',
              buttons: ['取消', '移出列表'],
              defaultId: 0,
              cancelId: 0,
              message: '将此账号移出列表？',
              detail:
                '聊天数据和登录状态会保留，可从“已移出的账号”恢复。已打开的窗口不会退出。',
            });
            if (answer.response !== 1) return;
          }
          setAccountArchived(
            app.getPath('appData'),
            url.searchParams.get('id') ?? '',
            archive
          );
          render();
          return;
        }
        if (url.pathname === '/rename') {
          renameAccount(
            app.getPath('appData'),
            url.searchParams.get('id') ?? '',
            url.searchParams.get('name') ?? ''
          );
          render();
          return;
        }
        if (url.pathname !== '/open') return;
        const id = accountIdFromArgs([
          `--translator-account=${url.searchParams.get('id') ?? ''}`,
        ]);
        if (
          !listAccounts(app.getPath('appData')).some(
            account => account.id === id
          )
        )
          return;
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        delete env.CHROME_CRASHPAD_PIPE_NAME;
        const child = spawn(
          process.execPath,
          [
            ...(app.isPackaged ? [] : [app.getAppPath()]),
            `--translator-account=${id}`,
          ],
          { detached: true, stdio: 'ignore', env }
        );
        child.on('error', () => {
          void dialog.showMessageBox(window, {
            type: 'error',
            message: '账号窗口启动失败，请重试。',
          });
        });
        child.unref();
      } catch {
        await dialog.showMessageBox(window, {
          type: 'error',
          message: '操作失败，请检查账号名称后重试。',
        });
      }
    })();
  });
  render();
}
