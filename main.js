const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');

const AVPN_PATH = '/Applications/Aether VPN.app/Contents/MacOS/avpn';

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0a0a2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    title: 'Aether VPN',
    icon: path.join(__dirname, 'icon.png'),
    trafficLightPosition: { x: 15, y: 15 }
  });

  // Load the local Next.js app or use the HTML file
  win.loadFile('renderer.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

function runAvpn(args) {
  return new Promise((resolve, reject) => {
    const trimmed = (args || '').trim();
    const fullArgs = trimmed ? ` ${trimmed}` : '';
    exec(`${AVPN_PATH}${fullArgs}`, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

ipcMain.handle('avpn-servers', async () => {
  try { const output = await runAvpn('servers list'); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-connect', async (_, serverId) => {
  try { const output = await runAvpn('vpn connect ' + (serverId || '')); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-disconnect', async () => {
  try { const output = await runAvpn('vpn disconnect'); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-status', async () => {
  try { const output = await runAvpn('vpn status'); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-login', async (_, email) => {
  try { const output = await runAvpn('auth login ' + email); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-keys', async () => {
  try { const output = await runAvpn('vpn keys'); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('avpn-help', async () => {
  try { const output = await runAvpn(''); return { success: true, output }; }
  catch (e) { return { success: false, error: e.message }; }
});

console.log('Aether VPN GUI running');
