const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const AVPN_PATH = path.join(process.resourcesPath, 'avpn');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000, height: 750, minWidth: 700, minHeight: 500,
    backgroundColor: '#0a0f1e',
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      preload: path.join(process.resourcesPath, 'app.asar', 'preload.js')
    },
    titleBarStyle: 'hidden', title: 'Aether VPN',
    icon: path.join(process.resourcesPath, 'app.asar', 'icon.png'),
    trafficLightPosition: { x: 15, y: 15 }
  });
  win.loadFile(path.join(process.resourcesPath, 'app.asar', 'renderer.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });

function runAvpn(args) {
  return new Promise((resolve, reject) => {
    const trimmed = (args || '').trim();
    const fullArgs = trimmed ? ' ' + trimmed : '';
    exec('"' + AVPN_PATH + '"' + fullArgs, { timeout: 30000 }, (error, stdout, stderr) => {
      const output = ((stdout || '') + (stderr || '')).trim();
      if (error && !output) { reject(error); return; }
      resolve(output);
    });
  });
}

ipcMain.handle('avpn-servers', async () => { try { return { success: true, output: await runAvpn('servers list') }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-connect', async (_, id) => { try { return { success: true, output: await runAvpn('vpn connect ' + (parseInt(id) || '')) }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-disconnect', async () => { try { return { success: true, output: await runAvpn('vpn disconnect') }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-status', async () => { try { return { success: true, output: await runAvpn('vpn status') }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-login', async (_, email) => { try { return { success: true, output: await runAvpn('auth login ' + email) }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-keys', async () => { try { return { success: true, output: await runAvpn('vpn keys') }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('avpn-help', async () => { try { return { success: true, output: await runAvpn('--help') }; } catch (e) { return { success: false, error: e.message }; } });

function readUtunBytes() {
  return new Promise((resolve) => {
    exec('netstat -ib', (error, stdout) => {
      if (error || !stdout) { resolve({ rx: 0, tx: 0, ok: false }); return; }
      let rx = 0, tx = 0, found = false;
      for (const line of stdout.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'utun0') {
          found = true;
          rx = parseInt(parts[8] || 0) || 0;
          tx = parseInt(parts[11] || 0) || 0;
          break;
        }
      }
      resolve({ rx, tx, ok: found });
    });
  });
}

ipcMain.handle('avpn-traffic', async () => {
  const r = await readUtunBytes();
  return { success: true, rx: r.rx, tx: r.tx, active: r.ok };
});

ipcMain.handle('avpn-ping', async (_, ip) => {
  return new Promise((resolve) => {
    if (!ip) { resolve({ success: true, ms: null }); return; }
    exec(`ping -c 1 -t 2 ${ip.replace(/[^0-9a-zA-Z.:]/g, '')}`, (error, stdout) => {
      const m = (stdout || '').match(/time=([\d.]+)\s*ms/);
      resolve({ success: true, ms: m ? Math.round(parseFloat(m[1])) : null });
    });
  });
});

ipcMain.handle('app-open-url', async (_, url) => { try { await shell.openExternal(url); return { success: true }; } catch (e) { return { success: false }; } });

ipcMain.handle('app-list-apps', async () => {
  const apps = [];
  const roots = ['/Applications', '/System/Applications'];
  for (const root of roots) {
    try {
      for (const f of fs.readdirSync(root)) {
        if (f.endsWith('.app')) apps.push(f.replace(/\.app$/, ''));
      }
    } catch (e) { /* ignore */ }
  }
  return { success: true, apps: [...new Set(apps)].sort() };
});

ipcMain.handle('app-backup', async (_, prefs) => {
  const win = BrowserWindow.getAllWindows()[0];
  const res = await dialog.showSaveDialog(win, { defaultPath: 'aether-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (res.canceled || !res.filePath) return { success: false, cancelled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(prefs || {}, null, 2));
  return { success: true, path: res.filePath };
});

ipcMain.handle('app-restore', async () => {
  const win = BrowserWindow.getAllWindows()[0];
  const res = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths.length) return { success: false, cancelled: true };
  try {
    const data = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
    return { success: true, data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('app-check-updates', async () => {
  try {
    const res = await fetch('https://api.github.com/repos/javadhamed-ctrl/Aether-VPN-MacOS-App/releases/latest', { headers: { 'User-Agent': 'aether-vpn-app', 'Accept': 'application/vnd.github+json' } });
    if (res.ok) {
      const data = await res.json();
      return { success: true, latest: (data.tag_name || '').replace(/^v/, ''), url: data.html_url || '' };
    }
    return { success: false, code: res.status };
  } catch (e) { return { success: false, error: e.message }; }
});