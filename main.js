const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');

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

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
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