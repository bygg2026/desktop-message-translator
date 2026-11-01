// Diagnostic integration test: synthetic profiles only, never real user data.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
  delete process.env.ELECTRON_RUN_AS_NODE;
  delete process.env.CHROME_CRASHPAD_PIPE_NAME;
  const root = mkdtempSync(path.resolve('.smoke-multi-'));
  const bootstrap = path.join(root, 'bootstrap.cjs');
  writeFileSync(bootstrap, `const {app}=require('electron');app.setAppPath(${JSON.stringify(path.resolve('.'))});app.setPath('appData',${JSON.stringify(root)});require(${JSON.stringify(path.resolve('bundles/main.js'))});`);
  const apps = [];
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  try {
    for (const id of ids) {
      const app = await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'), args:[bootstrap, `--translator-account=${id}`, '--no-sandbox','--disable-gpu'], env:{...process.env,NODE_ENV:'development',NODE_CONFIG:JSON.stringify({openDevTools:false})},timeout:60000});
      apps.push(app);
      const window = await app.firstWindow();
      await window.getByText('Link your account', {exact:false}).waitFor({timeout:30000});
    }
    const directories = await Promise.all(apps.map(app => app.evaluate(({app}) => app.getPath('userData'))));
    assert.notEqual(directories[0], directories[1]);
    assert.ok(directories.every((dir,i) => dir.endsWith(ids[i]) && dir.startsWith(root)));
    assert.equal(apps.length,2);
    await apps[0].evaluate(({app}) => { globalThis.__duplicateSeen = false; app.once('second-instance', () => { globalThis.__duplicateSeen = true; }); });
    const {spawn} = require('node:child_process');
    const child = spawn(path.resolve('node_modules/electron/dist/electron.exe'), [bootstrap, `--translator-account=${ids[0]}`, '--no-sandbox', '--disable-gpu'], {stdio:'ignore',env:{...process.env,NODE_ENV:'development',NODE_CONFIG:JSON.stringify({openDevTools:false})}});
    let timer;
    try {
      const code = await Promise.race([new Promise((resolve,reject) => {child.once('exit',resolve);child.once('error',reject);}),new Promise((_,reject) => {timer=setTimeout(() => {child.kill();reject(Error('Duplicate instance did not exit'));},15000);})]);
      assert.equal(code,0);
      assert.equal(await apps[0].evaluate(() => globalThis.__duplicateSeen),true);
    } finally {clearTimeout(timer);}
    console.log('Two independent account windows loaded; paths differ; duplicate account exits and notifies existing instance. Diagnostic sandbox flags used.');
  } finally { for (const app of apps.reverse()) await app.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
