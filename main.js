const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { exec, execSync } = require('child_process');
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
/* ================= Real engine (official aether binary) ================= */
const AETHER_PATH = path.join(process.resourcesPath, 'aether');
let engine = { pid: null, log: null, exiting: false };

function engineFlags(s) {
  const f = [];
  const proto = s.protocol || 'gool / WARP-in-WARP';
  if (proto === 'MASQUE') f.push('--masque');
  else if (proto === 'WireGuard') f.push('--wg');
  else if (proto === 'gool / WARP-in-WARP') f.push('--gool');
  const scan = s.scan || 'Balanced';
  if (scan === 'Turbo (recommended)') f.push('--turbo');
  else if (scan === 'Thorough') f.push('--thorough');
  else if (scan === 'Stealth') f.push('--stealth');
  else if (scan === 'Ironclad verification') f.push('--ironclad');
  else f.push('--balanced');
  const tr = s.transport || 'HTTP/2 (TCP, recommended)';
  if (tr === 'HTTP/3 (QUIC)') f.push('--h3'); else f.push('--h2');
  const ip = s.ip || 'IPv4 (recommended)';
  if (ip === 'IPv6') f.push('-6'); else if (ip === 'IPv4 + IPv6') f.push('--dual'); else f.push('-4');
  const obf = s.obfuscation || 'Balanced';
  const noize = obf === 'Off' ? 'off' : obf === 'Firewall (recommended)' ? 'firewall' : obf === 'GFW' ? 'gfw' : obf === 'Aggressive' ? 'aggressive' : 'balanced';
  f.push('--noize', noize);
  const bind = (s.socks || '127.0.0.1:1819').trim();
  f.push('--bind', bind, '--quick-reconnect', '--log-level', 'info');
  return { flags: f, bind };
}

function appendLog(txt) { try { if (engine && engine.log) fs.appendFileSync(engine.log, txt); } catch (e) {} }

function parseReady(logText) {
  return /socks5 server listening/.test(logText) || /proxy is ready/.test(logText);
}

async function waitForLinked() {
  const net = require('net');
  const tcpProbe = () => new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port: 1819 }, () => { s.destroy(); res(true); });
    s.on('error', () => { s.destroy(); res(false); });
    s.setTimeout(2000, () => { s.destroy(); res(false); });
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    let logText = '';
    try { logText = fs.readFileSync(engine.log, 'utf8'); } catch (e) {}
    if (/socks5 server listening/.test(logText)) return true;
    if (await tcpProbe()) return true;
    await new Promise(r => setTimeout(r, 700));
  }
  return false;
}

function httpLatency(proxyPort) {
  return new Promise((resolve) => {
    exec(`curl -s -o /dev/null -w "%{time_connect}" --max-time 6 --proxy "socks5h://127.0.0.1:${proxyPort}" https://1.1.1.1`, (err, out) => {
      const ms = parseFloat(out);
      if (!isNaN(ms) && ms > 0) resolve({ success: true, ms: Math.round(ms * 1000) });
      else resolve({ success: true, ms: null });
    });
  });
}

function exitTrace(proxyPort) {
  return new Promise((resolve) => {
    exec(`curl -s --max-time 8 --proxy "socks5h://127.0.0.1:${proxyPort}" https://www.cloudflare.com/cdn-cgi/trace`, (err, out) => {
      const fields = {};
      for (const line of (out || '').split('\n')) {
        const i = line.indexOf('=');
        if (i > 0) fields[line.slice(0, i)] = line.slice(i + 1);
      }
      resolve(fields);
    });
  });
}

function nettopBytes(pid, proxyPort) {
  return new Promise((resolve) => {
    exec(`nettop -p ${pid} -P -L 1 -J bytes_in,bytes_out`, (err, out) => {
      if (err || !out) { resolve({ rx: 0, tx: 0, ok: false }); return; }
      let rx = 0, tx = 0, ok = false;
      for (const line of out.split('\n')) {
        const m = line.match(new RegExp(`^\\S*\\.${pid}(?:\\s*|,)(\\d+)(?:\\s*|,)(\\d+)`));
        if (m) { rx = parseInt(m[1]) || 0; tx = parseInt(m[2]) || 0; ok = true; break; }
      }
      if (!ok) {
        const m = out.match(/^(\S+\.,\s*\d+,\s*\d+)/m);
        if (m) { const parts = m[1].replace('.', '').split(','); rx = parseInt(parts[1]) || 0; tx = parseInt(parts[2]) || 0; ok = true; }
      }
      resolve({ rx, tx, ok });
    });
  });
}

function sandboxaether() { return engine.pid ? require('child_process').execSync(`kill ${engine.pid} 2>/dev/null; pkill -f "Resources/aether" 2>/dev/null`) : undefined; }

function serviceName() {
  try {
    const route = execSync('route get default 2>/dev/null').toString();
    const m = route.match(/interface:\s*(\S+)/);
    if (!m) return 'Wi-Fi';
    const hw = execSync('networksetup -listallhardwareports').toString();
    const lines = hw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const d = lines[i].match(/Device:\s*(\S+)/);
      if (d && d[1] === m[1]) {
        for (let j = i - 1; j >= 0; j--) {
          const s = lines[j].match(/Hardware Port:\s*(.+)/);
          if (s) {
            const svc = execSync('networksetup -listallnetworkservices').toString().split('\n').map(x => x.trim()).find(x => x.toLowerCase().includes(s[1].toLowerCase().split(' ')[0].substring(0, 4)));
            return svc || 'Wi-Fi';
          }
        }
      }
    }
  } catch (e) {}
  return 'Wi-Fi';
}

function runElevated(cmd) {
  return new Promise((resolve) => {
    exec(`osascript -e 'do shell script "${cmd.replace(/'/g, "\\'")}" with administrator privileges'`, { timeout: 120000 }, (err, out, er) => {
      if (err && /cancel|not authorized/i.test(String(er || err))) { resolve({ ok: false, cancelled: true }); return; }
      resolve({ ok: !err || !!out, out: out || er, cancelled: false });
    });
  });
}

let v6PriorSaved = null;

function getV6(svc) {
  try {
    const o = execSync(`networksetup -getinfo "${svc}"`, { timeout: 10000 }).toString();
    const m = o.match(/^IPv6 Configuration:\s*(Automatic|Off|Manual)\s*$/im);
    return m ? m[1] : 'Automatic';
  } catch (e) { return 'Automatic'; }
}

/* HTTP CONNECT proxy that forwards to the engine's SOCKS5 (remote DNS) */
const net = require('net');
let httpProxy = null;
function snipConnectRequest(host, port) {
  const b = Buffer.from(host);
  const out = Buffer.alloc(4 + 1 + b.length + 2);
  out[0] = 0x05; out[1] = 0x01; out[2] = 0x00;
  if (/^[0-9.]+$/.test(host) && b.length === 4) { out[3] = 0x01; b.copy(out, 4); out.writeUInt16BE(port, 8); return out; }
  if (host.includes(':')) { out[3] = 0x04; out[6] = 0xff; out[7] = 0xff; out[8] = 0xff; out[9] = 0xff; out.writeUInt16BE(port, 10); return out; }
  out[3] = 0x03; out[4] = b.length; b.copy(out, 5); out.writeUInt16BE(port, 5 + b.length); return out;
}
function startHttpProxy(port) {
  if (httpProxy) return;
  httpProxy = net.createServer((src) => {
    let buf = '';
    let rejected = false;
    src.on('data', (d) => {
      if (rejected) return;
      buf += d;
      const idx = buf.indexOf('\r\n\r\n');
      if (idx < 0) { if (buf.length > 65536) { rejected = true; src.destroy(); } return; }
      const head = buf.slice(0, idx);
      const m = head.match(/^CONNECT\s+(\[?[^\s:\]]+\]?):(\d+)\s+HTTP\/1\.[01]/);
      if (!m) { rejected = true; src.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
      let host = m[1];
      if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
      const portTwo = parseInt(m[2]);
      const socks = net.connect(1819, '127.0.0.1');
      let stage = 0;
      const abort = (msg) => { try { src.end(msg); } catch (e) {} socks.destroy(); };
      socks.setTimeout(12000, () => { socks.destroy(); abort('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
      socks.on('connect', () => socks.write(Buffer.from([0x05, 0x01, 0x00])));
      socks.on('data', (sbt) => {
        if (stage === 0) {
          stage = 1;
          if (sbt.length < 2 || sbt[1] !== 0x00) { socks.destroy(); abort('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return; }
          socks.write(snipConnectRequest(host, portTwo));
        } else if (stage === 1) {
          if (sbt.length < 3 || sbt[1] !== 0x00) { socks.destroy(); abort('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return; }
          src.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          socks.removeAllListeners('data');
          src.removeAllListeners('data');
          src.pipe(socks); socks.pipe(src);
        }
      });
      const killsrc = () => { try { socks.destroy(); } catch (e) {} };
      socks.on('error', () => { try { src.destroy(); } catch (e) {} });
      src.on('error', killsrc); src.on('close', killsrc); socks.on('close', () => { try { src.destroy(); } catch (e) {} });
    });
  });
  httpProxy.on('error', (e) => { if (e.code !== 'EADDRINUSE') console.error('http proxy error', e); });
  httpProxy.listen(port, '127.0.0.1');
}
function stopHttpProxy() { if (httpProxy) { try { httpProxy.close(); } catch (e) {} httpProxy = null; } }

async function proxyState() {
  const svc = serviceName();
  const g = {};
  const checks = [['web', '-getwebproxy', 1820], ['secure', '-getsecurewebproxy', 1820], ['socks', '-getsocksfirewallproxy', 1819]];
  for (const [k, cmd, port] of checks) {
    try {
      const o = execSync(`networksetup ${cmd} "${svc}"`, { timeout: 10000 }).toString();
      g[k] = /^Enabled: Yes/im.test(o) && /Server:\s*127\.0\.0\.1/.test(o) && new RegExp(`Port:\\s*${port}`).test(o);
    } catch (e) { g[k] = false; }
  }
  g.v6off = getV6(svc) === 'Off';
  return g;
}

function v6StoreFile() { return path.join(app.getPath('userData'), 'engine', 'v6prior.txt'); }
function v6LoadPrior() {
  try {
    if (v6PriorSaved) return;
    if (fs.existsSync(v6StoreFile())) v6PriorSaved = fs.readFileSync(v6StoreFile(), 'utf8').trim() || null;
  } catch (e) {}
}

async function setSystemProxy(on) {
  const svc = serviceName();
  const s = "'" + svc + "'";
  if (on) v6LoadPrior();
  const st = await proxyState();
  const needProxy = on ? !(st.web && st.secure && st.socks) : (st.web || st.secure || st.socks);
  const curV6 = getV6(svc);
  const cmds = [];
  if (needProxy) {
    cmds.push(...(on
      ? [
          `networksetup -setwebproxy ${s} 127.0.0.1 1820`,
          `networksetup -setsecurewebproxy ${s} 127.0.0.1 1820`,
          `networksetup -setsocksfirewallproxy ${s} 127.0.0.1 1819`,
        ]
      : [
          `networksetup -setwebproxystate ${s} off`,
          `networksetup -setsecurewebproxystate ${s} off`,
          `networksetup -setsocksfirewallproxystate ${s} off`,
        ]));
  }
  if (on) {
    if (curV6 !== 'Off') {
      v6PriorSaved = curV6;
      try { fs.writeFileSync(v6StoreFile(), curV6); } catch (e) {}
      cmds.push(`networksetup -setv6off ${s}`);
    }
  } else {
    if (v6PriorSaved && v6PriorSaved !== curV6) cmds.push(`networksetup -setv6${v6PriorSaved.toLowerCase()} ${s}`);
    v6PriorSaved = null;
    try { fs.unlinkSync(v6StoreFile()); } catch (e) {}
  }
  if (!cmds.length) return { ok: true, already: true, elevated: false }; // no dialog needed
  // try unprivileged first; fall back to admin
  try {
    execSync(cmds.join(' && '), { stdio: 'ignore', timeout: 15000 });
    return { ok: true, elevated: false };
  } catch (e) {
    const r = await runElevated(cmds.join('; '));
    return { ok: r.ok, cancelled: r.cancelled, elevated: true };
  }
}

ipcMain.handle('proxy-status', async () => proxyState());

ipcMain.handle('engine-start', async (_, s) => {
  if (engine.pid) { try { process.kill(engine.pid, 'SIGTERM'); } catch (e) {} }
  try { execSync('pkill -f "Resources/aether" 2>/dev/null', { stdio: 'ignore' }); } catch (e) {}
  await new Promise(r => setTimeout(r, 500));
  const appData = path.join(app.getPath('userData'), 'engine');
  fs.mkdirSync(appData, { recursive: true });
  const log = path.join(appData, 'engine.log');
  engine.log = log;
  const { flags, bind } = engineFlags(s || {});
  const spawn = require('child_process').spawn;
  fs.writeFileSync(log, 'starting aether with: ' + flags.join(' ') + '\n');
  const child = spawn(AETHER_PATH, [...flags, '--config', path.join(appData, 'aether.toml')], { detached: false });
  engine.pid = child.pid;
  child.stdout.on('data', d => appendLog(d.toString()));
  child.stderr.on('data', d => appendLog(d.toString()));
  child.on('exit', code => { if (engine.pid === child.pid && !engine.exiting) enginesilentlyDied(code); engine.pid = null; });
  const ready = await waitForLinked();
  if (!ready) {
    let tail = '';
    try { tail = fs.readFileSync(log, 'utf8').split('\n').slice(-6).join('\n'); } catch (e) {}
    try { process.kill(child.pid, 'SIGTERM'); } catch (e) {}
    engine.pid = null;
    return { success: false, logTail: tail || 'engine failed to start' };
  }
  const tr = await exitTrace(bind.split(':').pop() || 1819);
  const geo = lookupGeo(tr.ip || null);
  startHttpProxy(1820);
  return { success: true, exitIp: tr.ip || null, colo: tr.colo || null, warp: tr.warp || null, bind, cc: geo.cc, country: geo.country };
});
function enginesilentlyDied(code) {
  process.send && process.send({ type: 'engine-exit', code });
}

ipcMain.handle('engine-stop', async () => {
  engine.exiting = true;
  stopHttpProxy();
  if (engine.pid) { try { process.kill(engine.pid, 'SIGTERM'); } catch (e) {} }
  try { execSync('pkill -f "Resources/aether" 2>/dev/null', { stdio: 'ignore' }); } catch (e) {}
  engine.pid = null;
  engine.exiting = false;
  return { success: true };
});

ipcMain.handle('engine-status', async () => {
  const port = 1819;
  const tr = await exitTrace(port);
  const running = engine.pid !== null && tr.ip;
  const geo = lookupGeo(tr.ip || null);
  return { running, exitIp: running ? tr.ip : null, colo: running ? tr.colo : null, pid: engine.pid, cc: geo.cc, country: geo.country };
});

ipcMain.handle('engine-traffic', async () => {
  if (!engine.pid) return { success: true, rx: 0, tx: 0, active: false };
  const r = await nettopBytes(engine.pid, 1819);
  return { success: true, rx: r.rx, tx: r.tx, active: r.ok };
});

ipcMain.handle('engine-ping', async () => await httpLatency(1819));

let geoCache = { ip: null, at: 0, cc: null, country: null };
function lookupGeo(ip) {
  if (!ip) return { cc: null, country: null };
  if (geoCache.ip === ip && Date.now() - geoCache.at < 30000) return { cc: geoCache.cc, country: geoCache.country };
  try {
    const out = execSync(`curl -s --max-time 8 "https://ipwho.is/${encodeURIComponent(ip)}"`, { timeout: 12000 }).toString();
    const g = JSON.parse(out);
    const cc = (g && g.success !== false && g.country_code) ? g.country_code : null;
    const country = (g && g.success !== false && g.country) ? g.country : null;
    geoCache = { ip, at: Date.now(), cc, country };
    return { cc, country };
  } catch (e) {
    return { cc: geoCache.cc, country: geoCache.country };
  }
}

ipcMain.handle('engine-exit-ip', async () => {
  const tr = await exitTrace(1819);
  const geo = lookupGeo(tr.ip || null);
  return { success: true, ip: tr.ip || null, colo: tr.colo || null, warp: tr.warp || null, cc: geo.cc, country: geo.country };
});

ipcMain.handle('proxy-on', async () => await setSystemProxy(true));
ipcMain.handle('proxy-off', async () => await setSystemProxy(false));

/* dev/verify hook (only active when VERIFY=1) */
if (process.env.VERIFY) {
  app.whenReady().then(async () => {
    await new Promise(r => setTimeout(r, 3000));
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      try {
        const result = await w.webContents.executeJavaScript('window.__verify ? window.__verify() : "no-verify"', true);
        fs.writeFileSync('/tmp/aether-verify.json', JSON.stringify(result, null, 2));
      } catch (e) {
        fs.writeFileSync('/tmp/aether-verify.json', JSON.stringify({ error: String(e) }, null, 2));
      }
    }
    app.exit(0);
  });
}
