const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { Settings } = require('./src/settings');
const auth = require('./src/spotifyAuth');
const lyrics = require('./src/lyrics');
const { romanizeLines } = require('./src/romanize');
const { Player } = require('./src/player');

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('com.example.cnysong');

let win = null;
let tray = null;
let settings = null;
let player = null;
let quitting = false;
let currentKey = null;
let lastState = { status: 'idle' };
let lastLyrics = null;

const SIZES = {
  Small: [380, 180],
  Medium: [460, 240],
  Large: [600, 320],
  Tall: [460, 420]
};

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/* ---------- window ---------- */

function applyPin() {
  const on = settings.get('alwaysOnTop');
  win.setAlwaysOnTop(on, 'screen-saver');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(on, { visibleOnFullScreen: on });
}
function applyClickThrough() {
  win.setIgnoreMouseEvents(settings.get('clickThrough'), { forward: true });
}

function createWindow() {
  const b = settings.get('bounds');
  win = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    minWidth: 300, minHeight: 140,
    frame: false, transparent: true, hasShadow: false,
    resizable: true, fullscreenable: false, show: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  applyPin();
  applyClickThrough();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());

  let t = null;
  const saveBounds = () => { clearTimeout(t); t = setTimeout(() => settings.set({ bounds: win.getBounds() }), 400); };
  win.on('moved', saveBounds);
  win.on('resized', saveBounds);
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); refreshTray(); } });
}

function toggleWindow() {
  if (win.isVisible()) win.hide(); else win.showInactive();
  refreshTray();
}

/* ---------- settings ---------- */

const ALLOWED = ['mode', 'fontSize', 'offsetMs', 'bgAlpha', 'alwaysOnTop', 'clickThrough'];

function applySettings(patch) {
  const clean = {};
  for (const k of ALLOWED) if (k in patch) clean[k] = patch[k];
  settings.set(clean);
  if ('alwaysOnTop' in clean) applyPin();
  if ('clickThrough' in clean) applyClickThrough();
  send('settings:update', settings.get());
  refreshTray();
}

function setSource(source) {
  settings.set({ source });
  player.restart();
  send('settings:update', settings.get());
  refreshTray();
}

/* ---------- tray ---------- */

function buildTray() {
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  const p = path.join(__dirname, 'assets', file);
  const img = fs.existsSync(p) ? nativeImage.createFromPath(p) : nativeImage.createEmpty();
  tray = new Tray(img);
  if (img.isEmpty()) tray.setTitle('\u266A');
  tray.setToolTip('CnySong');
  if (process.platform !== 'darwin') tray.on('click', toggleWindow);
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const s = settings.get();
  const radio = (label, checked, click) => ({ label, type: 'radio', checked, click });
  const template = [
    { label: win && win.isVisible() ? 'Hide lyrics' : 'Show lyrics', click: toggleWindow },
    { type: 'separator' },
    { label: 'Always on top', type: 'checkbox', checked: s.alwaysOnTop, click: (i) => applySettings({ alwaysOnTop: i.checked }) },
    { label: 'Click-through (mouse passes over)', type: 'checkbox', checked: s.clickThrough, click: (i) => applySettings({ clickThrough: i.checked }) },
    { type: 'separator' },
    {
      label: 'Lyrics display',
      submenu: [
        radio('Original', s.mode === 'original', () => applySettings({ mode: 'original' })),
        radio('Romanized', s.mode === 'romanized', () => applySettings({ mode: 'romanized' })),
        radio('Both', s.mode === 'both', () => applySettings({ mode: 'both' }))
      ]
    },
    {
      label: 'Font size',
      submenu: [16, 20, 24, 28, 32, 40].map((n) => radio(String(n), s.fontSize === n, () => applySettings({ fontSize: n })))
    },
    {
      label: 'Background opacity',
      submenu: [1, 0.82, 0.6, 0.35, 0.1].map((a) => radio(Math.round(a * 100) + '%', s.bgAlpha === a, () => applySettings({ bgAlpha: a })))
    },
    {
      label: 'Window size',
      submenu: Object.entries(SIZES).map(([name, [w, h]]) => ({ label: name, click: () => { win.setSize(w, h); settings.set({ bounds: win.getBounds() }); } }))
    },
    { type: 'separator' },
    {
      label: 'Source',
      submenu: [
        { ...radio('Spotify app (macOS, no login)', s.source === 'local', () => setSource('local')), enabled: process.platform === 'darwin' },
        radio('Spotify Web API (login)', s.source === 'web', () => setSource('web'))
      ]
    },
    { label: auth.isConnected() ? 'Disconnect Spotify account' : 'Connect Spotify account...', click: () => {
        if (auth.isConnected()) { auth.logout(); player.restart(); refreshTray(); }
        else { settings.set({ source: 'web' }); player.restart(); win.showInactive(); send('ui:setup', true); refreshTray(); }
      } },
    { type: 'separator' },
    { label: 'Quit CnySong', click: () => { quitting = true; app.quit(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

/* ---------- player and lyrics ---------- */

function onState(s) {
  lastState = s;
  send('player:update', s);
  if (s.track) {
    if (s.track.id !== currentKey) { currentKey = s.track.id; loadLyrics(s.track, currentKey); }
  } else if (s.status === 'idle') {
    currentKey = null;
  }
}

async function loadLyrics(track, key) {
  lastLyrics = { key, status: 'loading' };
  send('lyrics:update', lastLyrics);
  try {
    let data = await lyrics.get(track);
    if (key !== currentKey) return;
    if (!data) { lastLyrics = { key, status: 'none' }; send('lyrics:update', lastLyrics); return; }
    if (data.hasRomanization === undefined) {
      const r = await romanizeLines(data.lines);
      data = { ...data, lines: r.lines, hasRomanization: r.hasRomanization };
      lyrics.save(track, data);
    }
    if (key !== currentKey) return;
    lastLyrics = { key, status: 'ok', ...data };
  } catch (e) {
    if (key !== currentKey) return;
    lastLyrics = { key, status: 'error', message: e.message };
  }
  send('lyrics:update', lastLyrics);
}

/* ---------- IPC ---------- */

ipcMain.handle('app:getState', () => ({ settings: settings.get(), player: lastState, lyrics: lastLyrics, redirect: auth.REDIRECT, platform: process.platform }));
ipcMain.handle('settings:set', (_e, patch) => { applySettings(patch || {}); });
ipcMain.handle('window:hide', () => { win.hide(); refreshTray(); });
ipcMain.handle('auth:connect', async (_e, clientId) => {
  const id = String(clientId || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(id)) return { error: 'Client ID should be 32 characters (letters and numbers).' };
  try {
    settings.set({ clientId: id, source: 'web' });
    auth.setClientId(id);
    await auth.login();
    player.restart();
    refreshTray();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

/* ---------- lifecycle ---------- */

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  const dir = app.getPath('userData');
  settings = new Settings(dir);
  auth.init(dir, settings.get('clientId'));
  lyrics.init(dir);
  createWindow();
  buildTray();
  player = new Player(() => settings.get('source'));
  player.on('state', onState);
  player.start();
});

app.on('second-instance', () => { if (win) win.showInactive(); });
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* keep running in the tray */ });
