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
