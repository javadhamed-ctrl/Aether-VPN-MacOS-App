const { ipcRenderer } = require('electron');

let state = 'disconnected';
let page = 'connect';
let region = null;
let trafficTimer = null;
let lastRx = null, lastTx = null;
let dl = 0, ul = 0, ping = 0;
let lang = 'en';
let lastMsgKey = null;
let exitIp = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function isTunnelActive(output) {
  return !!output && !/disconnect/i.test(output) && /\bconnected\b|active|tunnel active/i.test(output);
}


/* ================= i18n ================= */
const I18N = {
  en: {
    'nav.connect': 'Connect', 'nav.configurations': 'Configurations', 'nav.settings': 'Settings',
    'nav.about': 'About', 'nav.telegram': 'Firstham on Telegram',
    'connect.orb.connect': 'CONNECT', 'connect.orb.connecti': 'CONNECTING…',
    'connect.orb.disconnect': 'DISCONNECT', 'connect.orb.disconnecti': 'DISCONNECTING…',
    'connect.status.ready': 'Aether Ready', 'connect.status.connected': 'Aether Active',
    'connect.status.starting': 'Starting Aether VPN', 'connect.status.scanning': 'Finding a gateway',
    'connect.status.securing': 'Securing your route', 'connect.status.disconnecting': 'Disconnecting',
    'connect.status.error': 'Connection needs attention',
    'connect.tap': 'Tap to secure', 'connect.protected': 'You are protected',
    'connect.download': '↓ Download', 'connect.upload': '↑ Upload', 'connect.ping': 'Ping',
    'connect.region': 'EXIT REGION', 'connect.msg': 'Finding a gateway…',
    'msg.selectnode': 'Select a node first', 'msg.starting': 'Starting Aether VPN',
    'msg.scanning': 'Finding a gateway', 'msg.securing': 'Securing your route',
    'msg.disconnecting': 'Disconnecting', 'msg.tap': 'Tap to secure',
    'msg.connected': 'Connected', 'msg.connectfailed': 'Connection failed',
    'msg.disconnected': 'Disconnected',
    'msg.noroute': 'No active tunnel route detected.',
    'servers.loading': 'Loading servers...', 'servers.empty': 'No servers available',
    'config.title': 'Configurations', 'config.sub': 'Connection mode, protocol and tunnel behaviour',
    'config.mode': 'Connection mode', 'config.mode.vpn': 'Device VPN', 'config.mode.proxy': 'SOCKS5 proxy',
    'config.mode.smart': 'Smart Connect',
    'config.mode.sum.vpn': 'A device-level VPN route using the selected protocol.',
    'config.mode.sum.proxy': 'A local SOCKS5 proxy on this device.',
    'config.mode.sum.smart': 'Test every protocol and choose the fastest reliable route.',
    'config.protocol': 'Protocol', 'config.scan': 'Scan mode', 'config.transport': 'MASQUE transport',
    'config.reconnect': 'Auto Reconnect', 'config.reconnect.sub': 'Recover automatically after a temporary connection failure',
    'config.autostart': 'Auto connect at start', 'config.autostart.sub': 'Connect with the saved configuration when Aether opens',
    'config.lan': 'Connection from LAN', 'config.lan.on': '127.0.0.1:18190', 'config.lan.off': 'Disabled',
    'config.split': 'Split Tunneling', 'config.split.sub': 'Choose which apps use the Aether connection.',
    'config.routing': 'Routing mode', 'config.routing.include': 'Include Apps', 'config.routing.exclude': 'Exclude Apps',
    'config.apps': 'Select Apps', 'config.apps.count': 'apps selected', 'config.done': 'Done',
    'config.advanced': 'Show advanced ▾', 'config.hideadvanced': 'Hide advanced ▴',
    'config.ipscan': 'IP scan', 'config.obfuscation': 'Obfuscation',
    'config.socks': 'Local SOCKS5 address', 'config.socks.ph': '127.0.0.1:1819',
    'config.endpoint': 'Custom endpoint (optional)', 'config.endpoint.ph': 'optional',
    'config.mtu': 'VPN MTU', 'config.mtu.auto': 'Automatic', 'config.mtu.manual': 'Manual',
    'config.mtu.sum.auto': 'Probe the current network and use the largest stable MTU.',
    'config.mtu.sum.manual': 'Use 1360 for the tunnel and transport.',
    'config.dns': 'Private DNS routing', 'config.dns.sub': 'Route DNS requests through the tunnel',
    'config.kill': 'Fail closed on tunnel errors', 'config.kill.sub': 'Keep VPN routes blocked if Aether unexpectedly stops',
    'config.reset': 'Reset defaults',
    'settings.title': 'Settings', 'settings.sub': 'How should the Aether app behave and look?',
    'settings.theme': 'Theme', 'settings.lang': 'Language',
    'settings.notif': 'Notifications', 'settings.notif.sub': 'Manage VPN and update notifications',
    'settings.notif.btn': 'Manage Notifications', 'settings.notif.btn.t': 'Notification settings opened',
    'settings.quick': 'Quick Settings', 'settings.quick.sub': 'Add the Aether VPN tile for fast connect and disconnect',
    'settings.quick.btn': 'Add Aether VPN Tile', 'settings.quick.btn.t': 'Quick Settings is a mobile feature, not available on macOS.',
    'settings.updates': 'Aether VPN Updates', 'settings.cur': 'Current version',
    'settings.latest': 'Latest available version', 'settings.status': 'Update status',
    'settings.notchecked': 'Not checked', 'settings.checking': 'Checking…',
    'settings.check': 'Check for updates', 'settings.download': 'Download update', 'settings.download.t': 'Download started',
    'settings.uptodate': 'Up to date', 'settings.noupdate': 'No update available',
    'settings.unavail': 'Update server unreachable', 'settings.autoupd': 'Automatic updates',
    'settings.autoupd.sub': 'Check for and download verified updates automatically over any available network',
    'settings.backup': 'Backup & Restore', 'settings.backup.btn': 'Backup settings',
    'settings.restore.btn': 'Restore settings', 'settings.saved': 'Settings backed up',
    'settings.restored': 'Settings restored', 'settings.restoreFail': 'Restore failed',
    'settings.telegram.t': 'Firstham on Telegram', 'settings.telegram.sub': 'Updates, tips, and new releases from @hamvex.',
    'about.orig': 'Original Project: Aether', 'about.orig.sub': 'Based on the original Aether project by CluvexStudio.',
    'about.app': 'Application: Aether VPN', 'about.app.sub': 'macOS application/interface developed for Aether.',
    'toast.defaults': 'Defaults restored', 'toast.apps': 'apps selected',
    'tunnel.error': 'Tunnel not established', 'tunnel.active': 'Tunnel active'
  },
  fa: {
    'nav.connect': 'اتصال', 'nav.configurations': 'پیکربندی', 'nav.settings': 'تنظیمات',
    'nav.about': 'درباره', 'nav.telegram': 'فِرستهـم در تلگرام',
    'connect.orb.connect': 'اتصال', 'connect.orb.connecti': 'در حال اتصال…',
    'connect.orb.disconnect': 'قطع اتصال', 'connect.orb.disconnecti': 'در حال قطع…',
    'connect.status.ready': 'آماده', 'connect.status.connected': 'فعال',
    'connect.status.starting': 'راه‌اندازی', 'connect.status.scanning': 'در حال یافتن دروازه',
    'connect.status.securing': 'در حال امن‌سازی مسیر', 'connect.status.disconnecting': 'در حال قطع',
    'connect.status.error': 'اتصال نیاز به بررسی دارد',
    'connect.tap': 'لمس کنید تا امن شوید', 'connect.protected': 'شما محافظت شده‌اید',
    'connect.download': '↓ دانلود', 'connect.upload': '↑ آپلود', 'connect.ping': 'پینگ',
    'connect.region': 'منطقهٔ خروج', 'connect.msg': 'در حال یافتن دروازه…',
    'msg.selectnode': 'ابتدا یک گره انتخاب کنید', 'msg.starting': 'در حال راه‌اندازی',
    'msg.scanning': 'در حال یافتن دروازه', 'msg.securing': 'در حال امن‌سازی مسیر',
    'msg.disconnecting': 'در حال قطع', 'msg.tap': 'لمس کنید تا امن شوید',
    'msg.connected': 'متصل شد', 'msg.connectfailed': 'اتصال ناموفق',
    'msg.disconnected': 'قطع شد',
    'msg.noroute': 'مسیر تونل فعالی شناسایی نشد.',
    'servers.loading': 'در حال بارگذاری سرورها...', 'servers.empty': 'سروری در دسترس نیست',
    'config.title': 'پیکربندی', 'config.sub': 'حالت اتصال، پروتکل و رفتار تونل',
    'config.mode': 'حالت اتصال', 'config.mode.vpn': 'وی‌پی‌ان دستگاه', 'config.mode.proxy': 'پراکسی SOCKS5',
    'config.mode.smart': 'اتصال هوشمند',
    'config.mode.sum.vpn': 'مسیر وی‌پی‌ان سطح دستگاه با پروتکل انتخاب‌شده.',
    'config.mode.sum.proxy': 'پراکسی SOCKS5 محلی روی این دستگاه.',
    'config.mode.sum.smart': 'هر پروتکل را آزمایش و سریع‌ترین مسیر مطمئن را انتخاب کنید.',
    'config.protocol': 'پروتکل', 'config.scan': 'حالت اسکن', 'config.transport': 'انتقال MASQUE',
    'config.reconnect': 'اتصال مجدد خودکار', 'config.reconnect.sub': 'بازیابی خودکار پس از قطعی موقت اتصال',
    'config.autostart': 'اتصال خودکار هنگام شروع', 'config.autostart.sub': 'اتصال با تنظیمات ذخیره‌شده هنگام باز شدن اپ',
    'config.lan': 'اتصال از شبکه محلی', 'config.lan.on': '127.0.0.1:18190', 'config.lan.off': 'غیرفعال',
    'config.split': 'تونل تقسیم‌شده', 'config.split.sub': 'انتخاب کنید کدام برنامه‌ها از اتصال استفاده کنند.',
    'config.routing': 'حالت مسیریابی', 'config.routing.include': 'شامل برنامه‌ها', 'config.routing.exclude': 'مستثنی برنامه‌ها',
    'config.apps': 'انتخاب برنامه‌ها', 'config.apps.count': 'برنامه انتخاب شد', 'config.done': 'تأیید',
    'config.advanced': 'نمایش پیشرفته ▾', 'config.hideadvanced': 'مخفی‌سازی پیشرفته ▴',
    'config.ipscan': 'اسکن IP', 'config.obfuscation': 'مبهم‌سازی',
    'config.socks': 'آدرس محلی SOCKS5', 'config.socks.ph': '127.0.0.1:1819',
    'config.endpoint': 'نقطه اتصال سفارشی (اختیاری)', 'config.endpoint.ph': 'اختیاری',
    'config.mtu': 'MTU اتصال', 'config.mtu.auto': 'خودکار', 'config.mtu.manual': 'دستی',
    'config.mtu.sum.auto': 'بررسی شبکه فعلی و استفاده از بزرگ‌ترین MTU پایدار.',
    'config.mtu.sum.manual': 'استفاده از 1360 برای تونل و انتقال.',
    'config.dns': 'مسیریابی DNS خصوصی', 'config.dns.sub': 'مسیریابی درخواست‌های DNS از طریق تونل',
    'config.kill': 'بستن در خطای تونل', 'config.kill.sub': 'مسدود نگه‌داشتن مسیرها در صورت توقف ناگهانی اپ',
    'config.reset': 'بازنشانی پیش‌فرض‌ها',
    'settings.title': 'تنظیمات', 'settings.sub': 'رفتار و ظاهر اپ چگونه باشد؟',
    'settings.theme': 'تم', 'settings.lang': 'زبان',
    'settings.notif': 'اعلان‌ها', 'settings.notif.sub': 'مدیریت اعلان‌های اتصال و به‌روزرسانی',
    'settings.notif.btn': 'مدیریت اعلان‌ها', 'settings.notif.btn.t': 'تنظیمات اعلان‌ها باز شد',
    'settings.quick': 'تنظیمات سریع', 'settings.quick.sub': 'افزودن tile برای اتصال و قطع سریع',
    'settings.quick.btn': 'افزودن Tile اتصال', 'settings.quick.btn.t': 'تنظیمات سریع یک قابلیت موبایلی است و در macOS در دسترس نیست.',
    'settings.updates': 'به‌روزرسانی اپ', 'settings.cur': 'نسخه فعلی',
    'settings.latest': 'آخرین نسخه موجود', 'settings.status': 'وضعیت به‌روزرسانی',
    'settings.notchecked': 'بررسی نشده', 'settings.checking': 'در حال بررسی…',
    'settings.check': 'بررسی به‌روزرسانی', 'settings.download': 'دانلود به‌روزرسانی', 'settings.download.t': 'دانلود شروع شد',
    'settings.uptodate': 'به‌روز است', 'settings.noupdate': 'به‌روزرسانی موجود نیست',
    'settings.unavail': 'سرور به‌روزرسانی در دسترس نیست', 'settings.autoupd': 'به‌روزرسانی خودکار',
    'settings.autoupd.sub': 'بررسی و دانلود خودکار به‌روزرسانی‌های تأییدشده',
    'settings.backup': 'پشتیبان‌گیری و بازیابی', 'settings.backup.btn': 'پشتیبان‌گیری',
    'settings.restore.btn': 'بازیابی', 'settings.saved': 'پشتیبان‌گیری انجام شد',
    'settings.restored': 'بازیابی انجام شد', 'settings.restoreFail': 'بازیابی ناموفق بود',
    'settings.telegram.t': 'فِرستهـم در تلگرام', 'settings.telegram.sub': 'به‌روزرسانی‌ها و نسخه‌های جدید از @hamvex.',
    'about.orig': 'پروژه اصلی: Aether', 'about.orig.sub': 'بر اساس پروژه اصلی Aether توسط CluvexStudio.',
    'about.app': 'اپلیکیشن: Aether VPN', 'about.app.sub': 'برنامه/رابط مک ساخته‌شده برای Aether.',
    'toast.defaults': 'پیش‌فرض‌ها بازنشانی شد', 'toast.apps': 'برنامه انتخاب شد',
    'tunnel.error': 'تونل برقرار نشد', 'tunnel.active': 'تونل فعال است'
  }
};

function t(key) {
  const v = (I18N[lang] || {})[key];
  return v !== undefined ? v : ((I18N.en || {})[key] !== undefined ? I18N.en[key] : key);
}

const DROPDOWNS = {
  protocolInput: { selected: 'gool / WARP-in-WARP', options: [['MASQUE', 'MASQUE'], ['WireGuard', 'وایرگارد'], ['gool / WARP-in-WARP', 'gool / WARP-in-WARP'], ['Smart Connect', 'اتصال هوشمند']] },
  scanInput: { selected: 'Balanced', options: [['Balanced', 'متعادل'], ['Turbo (recommended)', 'توربو (پیشنهادی)'], ['Thorough', 'کامل'], ['Stealth', 'پنهان'], ['Ironclad verification', 'بررسی آهنین']] },
  transportInput: { selected: 'HTTP/2 (TCP, recommended)', options: [['HTTP/3 (QUIC)', 'HTTP/3 (QUIC)'], ['HTTP/2 (TCP, recommended)', 'HTTP/2 (TCP، پیشنهادی)']] },
  ipInput: { selected: 'IPv4 (recommended)', options: [['IPv4 (recommended)', 'IPv4 (پیشنهادی)'], ['IPv6', 'IPv6'], ['IPv4 + IPv6', 'IPv4 + IPv6']] },
  obfuscationInput: { selected: 'Balanced', options: [['Firewall (recommended)', 'فایروال (پیشنهادی)'], ['GFW', 'GFW'], ['Balanced', 'متعادل'], ['Aggressive', 'تهاجمی'], ['Off', 'خاموش']] },
  themeInput: { selected: 'Dark', options: [['System default', 'پیش‌فرض سیستم'], ['Light', 'روشن'], ['Dark', 'تیره']] },
  languageInput: { selected: 'English', options: [['English', 'English'], ['فارسی', 'فارسی']] }
};

function renderDropdown(id) {
  const cfg = DROPDOWNS[id];
  const el = document.getElementById(id);
  if (!el || !cfg) return;
  const cur = el.value;
  el.innerHTML = cfg.options.map(([val, fa]) =>
    `<option value="${val}">${lang === 'fa' ? fa : val}</option>`).join('');
  el.value = cur || cfg.selected;
}
function renderAllDropdowns() { Object.keys(DROPDOWNS).forEach(renderDropdown); }

document.addEventListener('DOMContentLoaded', () => {
  lang = localStorage.getItem('lang') || 'en';
  renderAllDropdowns();
  applyStoredSettings();
  showPage('connect');
  applyLanguage();
  checkStatus();
});

/* ================= Language ================= */
function setLanguage() {
  lang = document.getElementById('languageInput').value === 'فارسی' ? 'fa' : 'en';
  localStorage.setItem('lang', lang);
  applyLanguage();
}
function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (key) el.placeholder = t(key);
  });
  document.title = 'Aether VPN';
  renderAllDropdowns();
  refreshDynamic();
}
function refreshDynamic() {
  setState(state);
  updateModeUi();
  updateMtuUi();
  updateLanUi();
  updateAppsCount();
  const navTitle = { connect: 'Aether VPN', configurations: t('nav.configurations'), settings: t('nav.settings'), about: t('nav.about') };
  document.getElementById('toolbar-title').textContent = navTitle[page] || 'Aether VPN';
  if (lastMsgKey) document.getElementById('connectMsg').textContent = t(lastMsgKey);
}

/* ================= Page navigation ================= */
function showPage(name) {
  page = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  const titles = { connect: 'Aether VPN', configurations: t('nav.configurations'), settings: t('nav.settings'), about: t('nav.about') };
  document.getElementById('toolbar-title').textContent = titles[name];
}

/* ================= Live exit region ================= */
function updateRegion() {
  const el = document.getElementById('regionValue');
  if (!el) return;
  if (!region || !region.colo) { el.textContent = '\u2014'; return; }
  const flag = RegionFlags(region.cc);
  el.textContent = (flag ? flag + ' ' : '') + region.colo + (region.cc ? ' \u00b7 ' + region.cc : '') + (region.country ? ' \u00b7 ' + region.country : '');
}
function RegionFlags(cc) {
  if (!cc || cc.length !== 2) return '';
  return [...cc.toUpperCase()].map(ch => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('');
}

/* ================= Connect / Disconnect (real) ================= */
async function toggleConnect() {
  if (state === 'connecting' || state === 'disconnecting') return;
  if (state !== 'connected') connect();
  else disconnect();
}

function connect() {
  const socks = (document.getElementById('socksInput').value || '127.0.0.1:1819').trim();
  const mode = localStorage.getItem('mode') || 'vpn';
  setState('starting'); showProgress(true); showMsg('msg.starting');
  setTimeout(() => { setState('scanning'); showMsg('msg.scanning'); }, 700);
  setTimeout(() => { setState('securing'); showMsg('msg.securing'); }, 1400);
  setTimeout(async () => {
    const settings = {
      protocol: document.getElementById('protocolInput').value,
      scan: document.getElementById('scanInput').value,
      transport: document.getElementById('transportInput').value,
      ip: document.getElementById('ipInput').value,
      obfuscation: document.getElementById('obfuscationInput').value,
      socks
    };
    const r = await ipcRenderer.invoke('engine-start', settings);
    showProgress(false);
    if (r && r.success) {
      exitIp = r.exitIp || null;
      region = { colo: r.colo || null, cc: r.cc || null, country: r.country || null };
      updateExitInfo();
      updateRegion();
      let px = { ok: true };
      if (mode !== 'proxy') px = await ipcRenderer.invoke('proxy-on');
      if (px && px.cancelled) {
        toast('System proxy needs admin — enable SOCKS 127.0.0.1:1819 in Network settings');
      }
      setState('connected');
      showRawMsg('Exit ' + (exitIp || '') + ' · ' + (r.colo || '') + ' · warp=' + (r.warp || r.warp === 'on' ? 'on' : 'off'));
      startTraffic();
    } else {
      setState('error');
      const tail = (r && r.logTail) ? r.logTail.trim().split('\n').pop() : t('msg.connectfailed');
      showRawMsg(tail);
    }
  }, 2100);
}

async function disconnect() {
  setState('disconnecting'); showProgress(true); showMsg('msg.disconnecting');
  const mode = localStorage.getItem('mode') || 'vpn';
  if (mode !== 'proxy') await ipcRenderer.invoke('proxy-off');
  await ipcRenderer.invoke('engine-stop');
  setState('disconnected'); showProgress(false);
  stopTraffic(); exitIp = null; region = null;
  document.getElementById('exitInfo').textContent = '';
  document.getElementById('regionValue').textContent = '\u2014';
  showMsg('msg.tap');
}

async function checkStatus() {
  const result = await ipcRenderer.invoke('engine-status');
  if (result && result.running) {
    exitIp = result.exitIp || null;
    region = { colo: result.colo || null, cc: result.cc || null, country: result.country || null };
    updateExitInfo();
    updateRegion();
    setState('connected'); startTraffic();
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
  const key = connected ? 'connect.orb.disconnect'
    : (s === 'connecting' || s === 'starting' || s === 'scanning' || s === 'securing') ? 'connect.orb.connecti'
    : s === 'disconnecting' ? 'connect.orb.disconnecti' : 'connect.orb.connect';
  lbl.textContent = t(key);
  const skey = s === 'disconnected' ? 'connect.status.ready' : ('connect.status.' + s);
  document.getElementById('statusText').textContent = t(skey);
  document.getElementById('tapHint').textContent = connected ? t('connect.protected') : t('connect.tap');
}

function showProgress(on) {
  const b = document.getElementById('progressBar');
  document.querySelector('.progress').style.display = on ? 'block' : 'none';
  if (on) {
    b.style.width = '0%';
    requestAnimationFrame(() => { b.style.width = '100%'; b.style.transition = 'width 2.7s linear'; });
  } else { b.style.width = '0%'; b.style.transition = ''; }
}
function showMsg(key) { lastMsgKey = key; document.getElementById('connectMsg').textContent = t(key); }
function showRawMsg(text) { lastMsgKey = null; document.getElementById('connectMsg').textContent = text; }

/* ================= Traffic (real interface counters) ================= */
function startTraffic() {
  stopTraffic();
  document.getElementById('metricsBox').classList.remove('hidden');
  dl = 0; ul = 0; ping = 0; lastRx = null; lastTx = null;
  updateMetrics();
  pollTraffic();
  trafficTimer = setInterval(pollTraffic, 2000);
}
function stopTraffic() {
  if (trafficTimer) clearInterval(trafficTimer);
  trafficTimer = null;
  document.getElementById('metricsBox').classList.add('hidden');
}
async function pollTraffic() {
  const r = await ipcRenderer.invoke('engine-traffic');
  if (r && r.success && r.active) {
    if (lastRx === null) { lastRx = r.rx; lastTx = r.tx; }
    dl = (r.rx - lastRx) / 1048576;
    ul = (r.tx - lastTx) / 1048576;
    if (dl < 0) dl = 0;
    if (ul < 0) ul = 0;
    lastRx = r.rx; lastTx = r.tx;
  } else if (r && r.success && !r.active && state === 'connected') {
    stopTraffic();
    setState('error');
    showMsg('tunnel.error');
  }
  const p = await ipcRenderer.invoke('engine-ping');
  if (p && p.success && p.ms) ping = p.ms;
  const e = await ipcRenderer.invoke('engine-exit-ip');
  if (e && e.success && e.ip) {
    exitIp = e.ip;
    region = { colo: e.colo || (region ? region.colo : null), cc: e.cc || (region ? region.cc : null), country: e.country || (region ? region.country : null) };
    updateExitInfo();
    updateRegion();
  }
  updateMetrics();
}
function updateMetrics() {
  document.getElementById('downloadValue').textContent = dl.toFixed(2) + ' MB';
  document.getElementById('uploadValue').textContent = ul.toFixed(2) + ' MB';
  document.getElementById('pingValue').textContent = (ping ? ping + ' ms' : '--');
}
function updateExitInfo() {
  const el = document.getElementById('exitInfo');
  if (el) el.textContent = exitIp ? (lang === 'fa' ? 'آی‌پی خروجی: ' : 'Exit IP: ') + exitIp : '';
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
  const keys = { vpn: 'config.mode.sum.vpn', proxy: 'config.mode.sum.proxy', smart: 'config.mode.sum.smart' };
  document.getElementById('modeSummary').textContent = t(keys[mode] || 'config.mode.sum.vpn');
  renderAllDropdowns();
}
function setRouting(r) {
  document.querySelectorAll('#routingGroup button').forEach(b => b.classList.toggle('active', b.dataset.routing === r));
  localStorage.setItem('routing', r);
  saveSettings();
}
function setMtuMode(m) {
  document.querySelectorAll('#mtuModeGroup button').forEach(b => b.classList.toggle('active', b.dataset.mtu === m));
  localStorage.setItem('mtuMode', m);
  const hidden = m !== 'manual';
  document.getElementById('mtuInput').classList.toggle('hidden', hidden);
  updateMtuUi();
  saveSettings();
}
function updateMtuUi() {
  const m = localStorage.getItem('mtuMode') || 'automatic';
  document.getElementById('mtuSummary').textContent = t(m === 'automatic' ? 'config.mtu.sum.auto' : 'config.mtu.sum.manual');
}
function toggleAdvanced() {
  const c = document.getElementById('advancedContainer');
  const tBtn = document.getElementById('advancedToggle');
  const nowHidden = c.classList.toggle('hidden');
  tBtn.textContent = nowHidden ? t('config.advanced') : t('config.hideadvanced');
}
function resetDefaults() {
  Object.keys(localStorage).forEach(k => { if (k !== 'lastNode' && k !== 'lang') localStorage.removeItem(k); });
  renderAllDropdowns(); restoreSwitches(); setMode('vpn'); setMtuMode('automatic');
  toast(t('toast.defaults'));
}

/* ================= App picker (Split Tunneling) ================= */
async function openAppPicker() {
  let apps = (localStorage.getItem('appList') || '').split(',').filter(Boolean);
  if (!apps.length) {
    const r = await ipcRenderer.invoke('app-list-apps');
    if (r && r.success && r.apps.length) { apps = r.apps; localStorage.setItem('appList', apps.join(',')); }
    else apps = ['Safari', 'Chrome', 'Firefox'];
  }
  const picked = (localStorage.getItem('pickedApps') || '').split(',').filter(Boolean);
  const list = document.getElementById('appPickerList');
  list.innerHTML = apps.map(a =>
    `<label class="picker-app"><input type="checkbox" value="${a}" ${picked.includes(a) ? 'checked' : ''}> <span>${a}</span></label>`).join('');
  document.getElementById('appPicker').classList.remove('hidden');
}
function closeAppPicker() {
  const picked = [...document.querySelectorAll('#appPickerList input:checked')].map(i => i.value);
  localStorage.setItem('pickedApps', picked.join(','));
  document.getElementById('appPicker').classList.add('hidden');
  updateAppsCount();
}
function updateAppsCount() {
  const picked = (localStorage.getItem('pickedApps') || '').split(',').filter(Boolean);
  document.getElementById('selectedAppsCount').textContent = picked.length + ' ' + t('config.apps.count');
}

/* ================= Settings ================= */
function setTheme(onInit) {
  const raw = document.getElementById('themeInput').value || 'Dark';
  const dark = raw === 'System default'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : raw === 'Dark';
  localStorage.setItem('theme', raw);
  if (dark) {
    document.documentElement.style.setProperty('--bg', '#0a0f1e');
    document.documentElement.style.setProperty('--surface', '#111827');
    document.documentElement.style.setProperty('--surface2', '#0d1525');
    document.documentElement.style.setProperty('--text', '#e7eef8');
    document.documentElement.style.setProperty('--muted', '#6b7280');
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
  } else {
    document.documentElement.style.setProperty('--bg', '#f5f6fa');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--surface2', '#f0f1f6');
    document.documentElement.style.setProperty('--text', '#111827');
    document.documentElement.style.setProperty('--muted', '#6b7280');
    document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.1)');
  }
}
async function checkUpdates() {
  const lv = document.getElementById('latestVersion');
  const us = document.getElementById('updateStatus');
  const pb = document.getElementById('updateProgress');
  lv.textContent = t('settings.checking'); us.textContent = t('settings.checking');
  document.querySelector('#page-settings .progress').style.display = 'block';
  let w = 0;
  const iv = setInterval(() => { w += 20; pb.style.width = w + '%'; }, 200);
  const r = await ipcRenderer.invoke('app-check-updates');
  clearInterval(iv); pb.style.width = '100%';
  if (r && r.success) {
    if (r.latest && r.latest !== 'v2.1.1') {
      lv.textContent = r.latest; us.textContent = t('settings.noupdate');
      document.getElementById('downloadUpdateBtn').classList.remove('hidden');
    } else {
      lv.textContent = 'v2.1.1'; us.textContent = t('settings.uptodate');
      document.getElementById('downloadUpdateBtn').classList.add('hidden');
    }
  } else {
    lv.textContent = t('settings.notchecked'); us.textContent = t('settings.unavail');
    document.getElementById('downloadUpdateBtn').classList.add('hidden');
  }
  setTimeout(() => { document.querySelector('#page-settings .progress').style.display = 'none'; }, 1500);
}
function openTelegram() {
  ipcRenderer.invoke('app-open-url', 'https://t.me/hamvex');
  toast(t('nav.telegram'));
}
async function backupSettings() {
  const prefs = {};
  Object.keys(localStorage).forEach(k => prefs[k] = localStorage.getItem(k));
  const r = await ipcRenderer.invoke('app-backup', prefs);
  toast(r && r.success ? t('settings.saved') : t('settings.restoreFail'));
}
async function restoreSettings() {
  const r = await ipcRenderer.invoke('app-restore');
  if (r && r.success && r.data) {
    Object.keys(r.data).forEach(k => localStorage.setItem(k, r.data[k]));
    renderAllDropdowns(); applyStoredSettings(); applyLanguage(); setTheme(true);
    toast(t('settings.restored'));
  } else if (r && r.cancelled) { /* noop */ }
  else toast(t('settings.restoreFail'));
}

/* ================= Switch / settings helpers ================= */
function toggleSwitch(el, key) {
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  localStorage.setItem(key, on ? 'true' : 'false');
  if (key === 'lanEnabled') updateLanUi();
  if (key === 'splitEnabled') document.getElementById('splitContainer').classList.toggle('hidden', !on);
  saveSettings();
}
function updateLanUi() {
  const on = localStorage.getItem('lanEnabled') === 'true';
  document.getElementById('lanSub').textContent = on ? t('config.lan.on') : t('config.lan.off');
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
function applyStoredSettings() {
  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  const apply = (id, key) => { const el = document.getElementById(id); if (el && prefs[key]) { el.value = prefs[key]; renderDropdown(id); } };
  apply('protocolInput', 'protocol'); apply('scanInput', 'scan'); apply('transportInput', 'transport');
  apply('ipInput', 'ip'); apply('obfuscationInput', 'obfuscation');
  apply('socksInput', 'socks'); apply('peerInput', 'peer'); apply('mtuInput', 'mtu');
  apply('languageInput', 'language');
  restoreSwitches();
  const mode = localStorage.getItem('mode') || 'vpn'; setMode(mode);
  const mtu = localStorage.getItem('mtuMode') || 'automatic'; setMtuMode(mtu);
  const theme = localStorage.getItem('theme') || 'Dark';
  document.getElementById('themeInput').value = theme; renderDropdown('themeInput'); setTheme(true);
  if (localStorage.getItem('splitEnabled') === 'true') document.getElementById('splitContainer').classList.remove('hidden');
  updateAppsCount();
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
  }
  updateLanUi();
}

/* ================= Toast ================= */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ================= Diagnostic verification (invoked by automated checks) ================= */
window.__verify = async function () {
  const out = {};
  out.nav = {};
  out.i18n = {};
  out.controls = {};
  out.server = {};
  out.node = {};
  out.connect = {};
  out.disconnect = {};
  out.debug = {};
  for (const pg of ['connect', 'configurations', 'settings', 'about']) {
    showPage(pg);
    const active = document.getElementById('page-' + pg).classList.contains('active');
    const navActive = document.querySelector('.nav-item.active').dataset.page === pg;
    out.nav[pg] = active && navActive;
  }
  showPage('connect');
  setLanguageTo('fa');
  out.i18n.faDetail = {
    nav: document.querySelector('[data-i18n="nav.settings"]').textContent,
    config: document.querySelector('[data-i18n="config.title"]').textContent,
    status: document.getElementById('statusText').textContent,
    orb: document.getElementById('orbLabel').textContent,
    lang: lang
  };
  out.i18n.fa = out.i18n.faDetail.nav === 'تنظیمات'
    && out.i18n.faDetail.config === 'پیکربندی'
    && out.i18n.faDetail.status === 'آماده'
    && out.i18n.faDetail.orb === 'اتصال';
  out.i18n.dropdownFa = document.getElementById('protocolInput').options[3].text === 'اتصال هوشمند'
    && document.getElementById('scanInput').options[1].text === 'توربو (پیشنهادی)';
  setLanguageTo('en');
  out.i18n.backEn = document.querySelector('[data-i18n="nav.settings"]').textContent === 'Settings'
    && document.getElementById('protocolInput').options[3].text === 'Smart Connect';

  const before = document.getElementById('reconnectSwitch').classList.contains('on');
  toggleSwitch(document.getElementById('reconnectSwitch'), 'quickReconnect');
  out.controls.switch = before !== document.getElementById('reconnectSwitch').classList.contains('on');
  const advHidden = document.getElementById('advancedContainer').classList.contains('hidden');
  toggleAdvanced();
  out.controls.advanced = advHidden !== document.getElementById('advancedContainer').classList.contains('hidden');
  toggleAdvanced();
  const mtHidden = document.getElementById('mtuInput').classList.contains('hidden');
  setMtuMode('manual');
  out.controls.mtu = mtHidden && !document.getElementById('mtuInput').classList.contains('hidden');
  setMtuMode('automatic');
  setRouting('exclude');
  out.controls.routing = document.querySelector('[data-routing="exclude"]').classList.contains('active');
  setRouting('include');

  setTheme();
  out.controls.theme = document.documentElement.style.getPropertyValue('--bg') === '#0a0f1e';
  document.getElementById('languageInput').value = 'English';

  const btn = document.getElementById('connectBtn');
  localStorage.setItem('mode', 'proxy');
  btn.click();
  let waited = 0;
  while (state === 'starting' || state === 'scanning' || state === 'securing') {
    await new Promise(r => setTimeout(r, 500));
    waited += 500;
    if (waited > 50000) break;
  }
  out.connect.status = document.getElementById('statusText').textContent;
  out.connect.orb = document.getElementById('orbLabel').textContent;
  out.connect.msg = document.getElementById('connectMsg').textContent;
  out.connect.waitedMs = waited;
  out.connect.exitIp = exitIp;
  out.connect.region = region;
  out.connect.regionShown = (document.getElementById('regionValue').textContent || '').includes('·');
  out.connect.state = state;
  out.connect.ok = state === 'connected' && !!exitIp && !!region && !!region.colo;
  const t0 = document.getElementById('downloadValue').textContent;
  await new Promise(r => setTimeout(r, 2200));
  out.connect.trafficMoving = t0 !== document.getElementById('downloadValue').textContent
    || document.getElementById('pingValue').textContent !== '--';
  out.connect.trafficVisible = !document.getElementById('metricsBox').classList.contains('hidden');

  if (state === 'connected') { btn.click(); }
  else { await disconnect(); }
  await new Promise(r => setTimeout(r, 1200));
  out.disconnect.status = document.getElementById('statusText').textContent;
  out.disconnect.msg = document.getElementById('connectMsg').textContent;
  out.disconnect.ok = out.disconnect.status === (lang === 'fa' ? 'آماده' : 'Aether Ready')
    && out.disconnect.msg === t('msg.tap');
  return out;
};
function setLanguageTo(v) {
  lang = v; localStorage.setItem('lang', v);
  document.getElementById('languageInput').value = v === 'fa' ? 'فارسی' : 'English';
  applyLanguage();
}