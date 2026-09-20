const { ipcRenderer } = require('electron');
let selectedServer = null;
let connected = false;

document.addEventListener('DOMContentLoaded', () => {
  loadServers();
  checkStatus();
});

async function loadServers() {
  try {
    const result = await window.electronAPI.serversList();
    if (result.success) {
      const lines = (result.output || '').trim().split('\n');
      if (lines.length > 1) {
        document.getElementById('serverList').innerHTML = lines.map((l, i) =>
          `<div class="server-item" onclick="selectServer(${i})"><div class="server-name">${l.trim()}</div><span style="color:#667eea;font-size:12px">→</span></div>`
        ).join('');
      } else {
        document.getElementById('serverList').innerHTML = `<div style="color:#888;font-size:13px;padding:10px">${result.output || 'No servers available'}</div>`;
      }
    } else {
      document.getElementById('serverList').innerHTML = `<div style="color:#ef4444;font-size:13px">${result.error || 'Error loading servers'}</div>`;
    }
  } catch (e) {
    document.getElementById('serverList').innerHTML = `<div style="color:#ef4444;font-size:13px">Connection error</div>`;
  }
}

function selectServer(index) {
  selectedServer = index;
  document.querySelectorAll('.server-item').forEach((el, i) => el.classList.toggle('selected', i === index));
}

async function doLogin() {
  const email = document.getElementById('emailInput').value;
  if (!email) return addLog('Please enter an email');
  addLog(`Logging in as ${email}...`);
  try {
    const result = await window.electronAPI.login(email);
    addLog(result.success ? result.output : `Error: ${result.error}`);
  } catch (e) { addLog(`Error: ${e.message}`); }
}

async function toggleConnect() {
  const btn = document.getElementById('connectBtn');
  if (connected) {
    addLog('Disconnecting...');
    const result = await window.electronAPI.disconnect();
    addLog(result.success ? result.output : `Error: ${result.error}`);
    connected = false; btn.textContent = 'Connect'; btn.classList.remove('connected');
    updateStatus('disconnected');
  } else {
    addLog('Connecting...');
    const result = await window.electronAPI.connect(selectedServer || '');
    addLog(result.success ? result.output : `Error: ${result.error}`);
    connected = true; btn.textContent = 'Disconnect'; btn.classList.add('connected');
    updateStatus('connected');
  }
}

async function doStatus() {
  addLog('Checking status...');
  const result = await window.electronAPI.status();
  addLog(result.success ? (result.output || 'Status checked') : `Error: ${result.error}`);
  if (result.output && result.output.includes('connected')) { connected = true; updateStatus('connected'); }
  else { connected = false; updateStatus('disconnected'); }
}

async function doKeys() {
  addLog('Generating keys...');
  const result = await window.electronAPI.keys();
  addLog(result.success ? result.output : `Error: ${result.error}`);
}

async function checkStatus() {
  const result = await window.electronAPI.status();
  if (result.output && result.output.includes('connected')) { connected = true; updateStatus('connected'); }
  else updateStatus('disconnected');
}

function updateStatus(status) {
  const badge = document.getElementById('statusBadge');
  if (status === 'connected') { badge.textContent = 'Connected'; badge.className = 'status-badge status-connected'; }
  else { badge.textContent = 'Disconnected'; badge.className = 'status-badge status-disconnected'; }
}

function addLog(msg) {
  const logArea = document.getElementById('logArea');
  const time = new Date().toLocaleTimeString();
  logArea.innerHTML += `<div>[${time}] ${msg}</div>`;
  logArea.scrollTop = logArea.scrollHeight;
}
