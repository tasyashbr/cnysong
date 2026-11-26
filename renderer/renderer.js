const $ = (id) => document.getElementById(id);
const els = {
  card: $('card'), title: $('title'), artist: $('artist'), stage: $('stage'), lines: $('lines'), notice: $('notice'),
  btnMode: $('btnMode'), btnPin: $('btnPin'), offset: $('offset'),
  setup: $('setup'), clientId: $('clientId'), setupMsg: $('setupMsg'), redirect: $('redirect'), macHint: $('macHint')
};

let S = null;                       // settings
let platform = 'darwin';
let state = { status: 'idle' };     // player state from main
let lyrics = null;                  // { status, synced, lines, hasRomanization }
let base = { pos: 0, at: Date.now(), playing: false, trackId: null };
let lineEls = [];
let activeIdx = -1;
let setupManual = false;

const MODES = ['original', 'romanized', 'both'];
const MODE_LABEL = { original: 'Original', romanized: 'Romanized', both: 'Both' };
const hasRom = (l) => !!(l && l.status === 'ok' && l.lines && l.lines.some((x) => x.rom));

/* ---------- clock ---------- */

const now = () => (base.playing ? base.pos + (Date.now() - base.at) : base.pos);

function findIdx(lines, p) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= p) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/* ---------- rendering ---------- */

function texts(line) {
  const mode = S ? S.mode : 'original';
  if (line.rom && mode === 'romanized') return [line.rom, ''];
  if (line.rom && mode === 'both') return [line.rom, line.text];
  return [line.text, ''];
}

function buildLines() {
  els.lines.textContent = '';
  lineEls = [];
  activeIdx = -1;
  els.stage.classList.toggle('plain', !!lyrics && lyrics.status === 'ok' && !lyrics.synced);
  if (!lyrics || lyrics.status !== 'ok') return;

  const frag = document.createDocumentFragment();
  for (const l of lyrics.lines) {
    const [main, sub] = texts(l);
    const d = document.createElement('div');
    d.className = 'line' + (main ? '' : ' gap');
    const m = document.createElement('div');
    m.className = 'main';
    m.textContent = main || '\u266A';
    d.appendChild(m);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sub;
      d.appendChild(s);
    }
    frag.appendChild(d);
    lineEls.push(d);
  }
  els.lines.appendChild(frag);
  placeLines();
}

function placeLines() {
  if (!lineEls.length || !lyrics.synced) return;
  const ref = lineEls[Math.max(activeIdx, 0)];
  const target = els.stage.clientHeight * 0.4;
  const y = ref.offsetTop + ref.offsetHeight / 2 - target;
  els.lines.style.transform = `translateY(${-y}px)`;
}

function setActive(idx) {
  if (lineEls[activeIdx]) lineEls[activeIdx].classList.remove('active');
  activeIdx = idx;
  if (lineEls[idx]) lineEls[idx].classList.add('active');
  placeLines();
}

function frame() {
  if (lyrics && lyrics.status === 'ok' && lyrics.synced && lineEls.length) {
    const p = now() + (S ? S.offsetMs : 0);
    const idx = findIdx(lyrics.lines, p);
    if (idx !== activeIdx) setActive(idx);
    if (idx >= 0) {
      const l = lyrics.lines[idx];
      const next = lyrics.lines[idx + 1];
      const gap = next ? next.t - l.t : 6000;
      const len = (texts(l)[0] || '').length;
      const dur = Math.max(300, Math.min(gap, Math.max(1500, len * 220)));
      const pct = Math.max(0, Math.min(100, ((p - l.t) / dur) * 100));
      lineEls[idx].style.setProperty('--p', pct.toFixed(1));
    }
  }
  requestAnimationFrame(frame);
}

function syncNotice() {
  const st = state.status;
  let msg = '';
  if (st === 'auth') {
    showSetup(true);
  } else {
    if (!setupManual) showSetup(false);
    if (st === 'permission') msg = 'Allow CnySong to control Spotify: System Settings, Privacy & Security, Automation.';
    else if (st === 'error') msg = state.message || 'Something went wrong.';
    else if (st === 'idle') msg = 'Play a song in Spotify.';
    else if (!lyrics || lyrics.status === 'loading') msg = 'Finding lyrics...';
    else if (lyrics.status === 'none') msg = 'No lyrics found for this song.';
    else if (lyrics.status === 'error') msg = 'Could not load lyrics: ' + lyrics.message;
  }
  els.notice.textContent = msg;
  els.notice.hidden = !msg;
  els.lines.hidden = !!msg;
  placeLines(); // offsets are only measurable while the list is visible
}

function showSetup(on) {
  els.setup.hidden = !on;
  if (on) {
    els.redirect.textContent = window.__redirect || '';
    els.macHint.hidden = platform !== 'darwin';
    if (S && S.clientId && !els.clientId.value) els.clientId.value = S.clientId;
  }
}

function setMeta(track) {
  els.title.textContent = track ? track.title : 'CnySong';
  els.artist.textContent = track ? track.artist : '';
}

function applySettings(next) {
  const prev = S;
  S = next;
  const root = document.documentElement.style;
  root.setProperty('--fs', S.fontSize + 'px');
  root.setProperty('--bg', S.bgAlpha);
  els.btnMode.textContent = MODE_LABEL[S.mode];
  els.btnPin.textContent = S.alwaysOnTop ? 'Pinned' : 'Pin';
  els.btnPin.classList.toggle('off', !S.alwaysOnTop);
  const o = S.offsetMs / 1000;
  els.offset.textContent = (o > 0 ? '+' : '') + o.toFixed(1) + 's';
  if (!prev || prev.mode !== S.mode) buildLines();
  else placeLines();
}

/* ---------- events from main ---------- */

window.api.onPlayer((s) => {
  state = s;
  if (s.track) {
    const same = base.trackId === s.track.id;
    const playing = s.status === 'playing';
    // keep our own smooth clock unless the reported time is clearly different
    if (!same || !playing || !base.playing || Math.abs(now() - s.positionMs) > 350) {
      base = { pos: s.positionMs, at: s.at, playing, trackId: s.track.id };
    }
    setMeta(s.track);
  } else {
    base.playing = false;
    base.trackId = null;
    if (s.status === 'idle') setMeta(null);
  }
  syncNotice();
});

window.api.onLyrics((l) => {
  // update from the same song (if romanization has just finished): keep the line position and scroll
  const refresh = !!(lyrics && l && lyrics.key === l.key && lyrics.status === 'ok' && l.status === 'ok');
  const scroll = els.stage.scrollTop;
  lyrics = l;
  els.btnMode.hidden = !hasRom(l);
  buildLines();
  if (refresh) {
    els.stage.scrollTop = scroll;
    if (l.synced) setActive(findIdx(l.lines, now() + (S ? S.offsetMs : 0)));
  }
  syncNotice();
});

window.api.onSettings(applySettings);
window.api.onSetup(() => { setupManual = true; showSetup(true); });

/* ---------- controls ---------- */

const set = (patch) => window.api.setSettings(patch);

els.btnMode.onclick = () => set({ mode: MODES[(MODES.indexOf(S.mode) + 1) % MODES.length] });
$('btnEarlier').onclick = () => set({ offsetMs: Math.min(5000, S.offsetMs + 200) });
$('btnLater').onclick = () => set({ offsetMs: Math.max(-5000, S.offsetMs - 200) });
$('btnSmaller').onclick = () => set({ fontSize: Math.max(12, S.fontSize - 2) });
$('btnBigger').onclick = () => set({ fontSize: Math.min(56, S.fontSize + 2) });
els.btnPin.onclick = () => set({ alwaysOnTop: !S.alwaysOnTop });
$('btnHide').onclick = () => window.api.hide();
$('btnCloseSetup').onclick = () => { setupManual = false; showSetup(false); syncNotice(); };

$('btnConnect').onclick = async () => {
  els.setupMsg.textContent = 'Waiting for login in your browser...';
  const r = await window.api.connect(els.clientId.value);
  if (r.error) { els.setupMsg.textContent = r.error; return; }
  els.setupMsg.textContent = '';
  setupManual = false;
  showSetup(false);
  syncNotice();
};
els.clientId.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnConnect').click(); });

window.addEventListener('resize', placeLines);

/* ---------- start ---------- */

(async () => {
  const init = await window.api.getState();
  platform = init.platform;
  window.__redirect = init.redirect;
  applySettings(init.settings);
  state = init.player || state;
  lyrics = init.lyrics;
  if (state.track) { setMeta(state.track); base = { pos: state.positionMs, at: state.at, playing: state.status === 'playing', trackId: state.track.id }; }
  els.btnMode.hidden = !hasRom(lyrics);
  buildLines();
  syncNotice();
  requestAnimationFrame(frame);
})();
