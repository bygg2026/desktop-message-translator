const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron: electron } = require('playwright');
(async () => {
  delete process.env.ELECTRON_RUN_AS_NODE;
  delete process.env.CHROME_CRASHPAD_PIPE_NAME;
  const app = await electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['.', '--no-sandbox', '--disable-gpu'], env: { ...process.env, NODE_ENV: 'development', NODE_CONFIG: JSON.stringify({ storagePath: path.resolve('.smoke-accounts-profile'), openDevTools: false }) } });
  try {
    const main = await app.firstWindow();
    await main.getByText('Link your account', { exact: false }).waitFor({ timeout: 30000 });
    const managerEvent = app.waitForEvent('window');
    await app.evaluate(({ Menu }) => {
      const accounts = Menu.getApplicationMenu().items.find(item => item.label === '账号 / Accounts');
      if (!accounts) throw Error('Accounts menu missing');
      accounts.submenu.items[0].click();
    });
    await managerEvent;
    const result = await app.evaluate(async ({BrowserWindow}) => {
      const manager = BrowserWindow.getAllWindows().find(w => w.getTitle() === '账号管理 / Accounts' || w.getTitle() === '账号管理');
      if (!manager) throw Error('Manager missing');
      if(manager.webContents.isLoading()) await new Promise(resolve => manager.webContents.once('did-finish-load',resolve));
      return manager.webContents.executeJavaScript('({text:document.body.innerText,inputs:document.querySelectorAll("form input[name=name]").length,node:typeof window.require})');
    });
    console.log('MANAGER_RESULT', result);
    assert.ok(result.text.includes('多账号管理'));
    assert.ok(result.text.includes('默认账号 / Default'));
    assert.equal(result.inputs, 1);
    assert.equal(result.node, 'undefined');
    console.log('Diagnostic manager smoke passed: menu, default account, create form, isolated renderer');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
