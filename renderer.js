const { ipcRenderer } = require('electron');
const { localStorage } = window;

let state = 'disconnected';
let page = 'connect';
let servers = [];
let selectedNode = null;
let trafficTimer = null;
let dl = 0, ul = 0, ping = 0;

const STATUS_TEXT = {
  disconnected: 'Aether Ready',
  connected: 'Aether Active',
  starting: 'Starting Aether VPN',
  scanning: 'Finding a gateway',
  securing: 'Securing your route',
  disconnecting: 'Disconnecting',
  error: 'Connection needs attention'
};

document.addEventListener('DOMContentLoaded', () => {
  loadServers();
  bindDropdowns();
  restoreSettings();
  showPage('connect');
  checkStatus();
});

/* ================= Page navigation ================= */
function showPage(name) {
  page = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  const titles = { connect: 'Aether VPN', configurations: 'Configurations', settings: 'Settings', about: 'About' };
  document.getElementById('toolbar-title').textContent = titles[name];
}

/* ================= Server list (NODE dropdown) ================= */
async function loadServers() {
  const sel = document.getElementById('nodeSelect');
  try {
    sel.innerHTML = '<option value="">Loading servers...</option>';
    const result = await ipcRenderer.invoke('avpn-servers');
    servers = parseServers(result.success ? result.output : '');
    sel.innerHTML = servers.map((s, i) => `<option value="${i}">${s.name} — ${s.location}</option>`).join('');
    if (servers.length > 0) {
      const last = localStorage.getItem('lastNode');
      const idx = servers.findIndex(s => s.name === last);
      sel.value = idx >= 0 ? idx : 0;
      selectedNode = servers[sel.value] || servers[0];
      nodeChanged();
    }
  } catch (e) {
    sel.innerHTML = '<option value="">No servers available</option>';
  }
}

function parseServers(output) {
  const lines = (output || '').trim().split('\n');
  const list = [];
  let inTable = false;
  for (const line of lines) {
    if (/ID\s+Name/i.test(line)) { inTable = true; continue; }
    if (line.includes('---')) continue;
    if (inTable && line.trim()) {
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length >= 4) list.push({ id: parts[0], name: parts[1], location: parts[2], ip: parts[3] });
    }
  }
  if (!list.length) {
    const fallback = [
      { id: 1, name: 'Mashhad', location: 'Iran', ip: '10.0.1.1' },
      { id: 2, name: 'US East', location: 'New York', ip: '10.0.2.1' },
      { id: 3, name: 'US West', location: 'Los Angeles', ip: '10.0.3.1' },
      { id: 4, name: 'EU London', location: 'United Kingdom', ip: '10.0.4.1' },
      { id: 5, name: 'EU Germany', location: 'Frankfurt', ip: '10.0.5.1' },
      { id: 6, name: 'Asia Tokyo', location: 'Japan', ip: '10.0.6.1' },
    ];
    return fallback;
  }
  return list;
}

function nodeChanged() {
  const sel = document.getElementById('nodeSelect');
  const idx = parseInt(sel.value);
  selectedNode = servers[idx] || servers[0];
  if (selectedNode) localStorage.setItem('lastNode', selectedNode.name);
}

function connectNodeId() {
  return selectedNode ? selectedNode.id : 1;
}

/* ================= Connect / Disconnect ================= */
async function toggleConnect() {
  if (state === 'connecting' || state === 'disconnecting') return;
  if (state !== 'connected') connect();
  else disconnect();
}

function connect() {
  if (!selectedNode) { showMsg('Select a node first'); return; }
  setState('starting');
  showProgress(true);
  showMsg('Starting Aether VPN');
  setTimeout(() => setState('scanning'), 1200);
  setTimeout(() => setState('securing'), 2400);
  setTimeout(async () => {
    const result = await ipcRenderer.invoke('avpn-connect', connectNodeId());
    setState(result && result.success ? 'connected' : 'error');
    showProgress(false);
    if (result && result.output) showMsg(result.output.split('\n').filter(l => l.trim()).pop() || 'Connected');
    startTrafficSim();
  }, 3600);
}

async function disconnect() {
  setState('disconnecting');
  showProgress(true);
  showMsg('Disconnecting');
  const result = await ipcRenderer.invoke('avpn-disconnect');
  setState('disconnected');
  showProgress(false);
  stopTrafficSim();
  showMsg('Tap to secure');
}

async function checkStatus() {
  const result = await ipcRenderer.invoke('avpn-status');
  if (result.success && result.output && result.output.includes('Connected')) {
    setState('connected'); startTrafficSim();
  }
}

function setState(s) {
  state = s;
  const orb = document.getElementById('connectBtn');
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('orbLabel');
  const connected = s === 'connected';

  orb.classList.toggle('connected', connected);
  dot.className = 'dot';
  if (connected) dot.classList.add('on');
  else if (s === 'error' || s === 'disconnected') dot.classList.add('off');

  lbl.textContent = connected ? 'DISCONNECT' : state === 'connecting' || state === 'starting' || state === 'scanning' || state === 'securing' ? 'CONNECTING…' : state === 'disconnecting' ? 'DISCONNECTING…' : 'CONNECT';
  document.getElementById('statusText').textContent = STATUS_TEXT[s] || 'Aether Ready';
  document.getElementById('tapHint').textContent = connected ? 'You are protected' : 'Tap to secure';
}

function showProgress(on) {
  const p = document.getElementById('progressBar');
  document.querySelector('.progress').style.display = on ? 'block' : 'none';
  if (on) { p.style.width = '0%'; requestAnimationFrame(() => { p.style.width = '100%'; p.style.transition = 'width 3.6s linear'; }); }
  else { p.style.width = '0%'; p.style.transition = ''; }
}

function showMsg(t) { document.getElementById('connectMsg').textContent = t; }

/* Traffic simulation */
function startTrafficSim() {
  stopTrafficSim();
  document.getElementById('metricsBox').classList.remove('hidden');
  dl = Math.random() * 5 + 1; ul = Math.random() * 2 + 0.3; ping = 150 + Math.floor(Math.random() * 80);
  updateMetrics();
  trafficTimer = setInterval(() => {
    dl += Math.random() * 0.5 + 0.1; ul += Math.random() * 0.2 + 0.03; ping = 150 + Math.floor(Math.random() * 80);
    updateMetrics();
  }, 2000);
}
function stopTrafficSim() {
  if (trafficTimer) clearInterval(trafficTimer);
  trafficTimer = null;
  document.getElementById('metricsBox').classList.add('hidden');
}
function updateMetrics() {
  document.getElementById('downloadValue').textContent = (dl / 1024).toFixed(1) + ' GB';
  document.getElementById('uploadValue').textContent = (ul / 1024).toFixed(1) + ' GB';
  document.getElementById('pingValue').textContent = ping + ' ms';
}

/* ================= Configurations ================= */
function setMode(mode) {
  document.querySelectorAll('#modeGroup button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  localStorage.setItem('mode', mode);
  updateModeUi();
  saveSettings();
}
function updateModeUi() {
  const mode = localStorage.getItem('mode') || 'vpn';
  const summaries = {
    vpn: 'A device-level VPN route using the selected protocol.',
    proxy: 'A local SOCKS5 proxy on this device.',
    smart: 'Test every protocol and choose the fastest reliable route.'
  };
  document.getElementById('modeSummary').textContent = summaries[mode] || '';
}
function setRouting(r) {
  document.querySelectorAll('#routingGroup button').forEach(b => b.classList.toggle('active', b.dataset.routing === r));
  localStorage.setItem('routing', r);
  saveSettings();
}
function setMtuMode(m) {
  document.querySelectorAll('#mtuModeGroup button').forEach(b => b.classList.toggle('active', b.dataset.mtu === m));
  localStorage.setItem('mtuMode', m);
  document.getElementById('mtuInput').classList.toggle('hidden', m !== 'manual');
  const s = m === 'automatic'
    ? 'Probe the current network and use the largest stable MTU.'
    : 'Use 1360 for the tunnel and transport.';
  document.getElementById('mtuSummary').textContent = s;
  saveSettings();
}
function toggleAdvanced() {
  const c = document.getElementById('advancedContainer');
  const t = document.getElementById('advancedToggle');
  const open = c.classList.toggle('hidden');
  t.textContent = open ? 'Show advanced ▾' : 'Hide advanced ▴';
}
function resetDefaults() {
  Object.keys(localStorage).forEach(k => { if (k !== 'lastNode') localStorage.removeItem(k); });
  bindDropdowns(); restoreSwitches(); setMode('vpn'); setMtuMode('automatic');
  toast('Defaults restored');
}

/* ================= Settings ================= */
function setTheme(onInit) {
  const theme = document.getElementById('themeInput').value || 'Dark';
  localStorage.setItem('theme', theme);
  if (theme === 'Light') {
    document.documentElement.style.setProperty('--bg', '#f5f6fa');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--surface2', '#f0f1f6');
    document.documentElement.style.setProperty('--text', '#111');
    document.documentElement.style.setProperty('--muted', '#6b7280');
    document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.1)');
  } else {
    document.documentElement.style.setProperty('--bg', '#0a0f1e');
    document.documentElement.style.setProperty('--surface', '#111827');
    document.documentElement.style.setProperty('--surface2', '#0d1525');
    document.documentElement.style.setProperty('--text', '#e7eef8');
    document.documentElement.style.setProperty('--muted', '#6b7280');
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
  }
}
function checkUpdates() {
  const lv = document.getElementById('latestVersion');
  const us = document.getElementById('updateStatus');
  const pb = document.getElementById('updateProgress');
  lv.textContent = 'Checking…'; us.textContent = 'Checking…';
  document.querySelector('#page-settings .progress').style.display = 'block';
  let w = 0;
  const iv = setInterval(() => {
    w += 20; pb.style.width = w + '%';
    if (w >= 100) {
      clearInterval(iv);
      lv.textContent = 'v2.1.1';
      us.textContent = 'Up to date';
      document.getElementById('downloadUpdateBtn').classList.add('hidden');
      toast('You are up to date');
    }
  }, 400);
}
function openTelegram() { ipcRenderer.invoke('avpn-help'); toast('https://t.me/hamvex'); }

/* ================= Switch / settings helpers ================= */
function toggleSwitch(el, key) {
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  localStorage.setItem(key, on ? 'true' : 'false');
  if (key === 'lanEnabled') document.getElementById('lanSub').textContent = on ? '127.0.0.1:18190' : 'Disabled';
  if (key === 'splitEnabled') document.getElementById('splitContainer').classList.toggle('hidden', !on);
  saveSettings();
}
function saveSettings() {
  const s = {
    protocol: document.getElementById('protocolInput').value,
    scan: document.getElementById('scanInput').value,
    transport: document.getElementById('transportInput').value,
    ip: document.getElementById('ipInput').value,
    obfuscation: document.getElementById('obfuscationInput').value,
    socks: document.getElementById('socksInput').value,
    peer: document.getElementById('peerInput').value,
    mtu: document.getElementById('mtuInput').value,
    language: document.getElementById('languageInput').value
  };
  localStorage.setItem('prefs', JSON.stringify(s));
}
function restoreSettings() {
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  const apply = (id, key) => { const el = document.getElementById(id); if (el && prefs[key]) el.value = prefs[key]; };
  apply('protocolInput', 'protocol'); apply('scanInput', 'scan'); apply('transportInput', 'transport');
  apply('ipInput', 'ip'); apply('obfuscationInput', 'obfuscation');
  apply('socksInput', 'socks'); apply('peerInput', 'peer'); apply('mtuInput', 'mtu');
  apply('languageInput', 'language');
  restoreSwitches();
  const mode = localStorage.getItem('mode') || 'vpn'; setMode(mode);
  const mtu = localStorage.getItem('mtuMode') || 'automatic'; setMtuMode(mtu);
  const theme = localStorage.getItem('theme') || 'Dark';
  document.getElementById('themeInput').value = theme; setTheme(true);
  if (localStorage.getItem('splitEnabled') === 'true') document.getElementById('splitContainer').classList.remove('hidden');
}
function restoreSwitches() {
  const map = {
    quickReconnect: 'reconnectSwitch', autoConnectAtStart: 'autoConnectSwitch',
    lanEnabled: 'lanSwitch', splitEnabled: 'splitSwitch', dnsLeak: 'dnsSwitch',
    killSwitch: 'killswitchSwitch', autoUpdate: 'autoUpdateSwitch'
  };
  for (const [key, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    const v = localStorage.getItem(key);
    const on = v === null ? (key === 'quickReconnect' || key === 'dnsLeak' || key === 'autoUpdate') : v === 'true';
    el.classList.toggle('on', on);
    if (key === 'lanEnabled') document.getElementById('lanSub').textContent = on ? '127.0.0.1:18190' : 'Disabled';
  }
}
function bindDropdowns() {
  [['protocolInput', ['MASQUE','WireGuard','gool / WARP-in-WARP','Smart Connect']],
   ['scanInput', ['Balanced','Turbo (recommended)','Thorough','Stealth','Ironclad verification']],
   ['transportInput', ['HTTP/3 (QUIC)','HTTP/2 (TCP, recommended)']],
   ['ipInput', ['IPv4 (recommended)','IPv6','IPv4 + IPv6']],
   ['obfuscationInput', ['Firewall (recommended)','GFW','Balanced','Aggressive','Off']],
   ['themeInput', ['System default','Light','Dark']],
   ['languageInput', ['English','فارسی']]
  ].forEach(([id, opts]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    if (cur && opts.includes(cur)) return;
    el.innerHTML = opts.map(o => `<option${o === (id === 'protocolInput' ? 'gool / WARP-in-WARP' : id === 'scanInput' ? 'Balanced' : id === 'transportInput' ? 'HTTP/2 (TCP, recommended)' : id === 'obfuscationInput' ? 'Balanced' : id === 'themeInput' ? 'Dark' : id === 'languageInput' ? 'English' : '') ? ' selected' : ''}>${o}</option>`).join('');
  });
}

/* ================= Toast ================= */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}