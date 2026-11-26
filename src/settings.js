const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  source: process.platform === 'darwin' ? 'local' : 'web', // 'local' (Spotify app, macOS) | 'web' (Spotify Web API)
  clientId: '',
  mode: 'original',      // 'original' | 'romanized' | 'both'
  fontSize: 24,
  offsetMs: 0,           // positive = lyrics appear earlier
  alwaysOnTop: true,
  clickThrough: false,
  bgAlpha: 0.82,
  bounds: { width: 460, height: 240 }
};

class Settings {
  constructor(dir) {
    this.file = path.join(dir, 'settings.json');
    this.data = { ...DEFAULTS };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...DEFAULTS, ...saved };
    } catch (_) { /* first run */ }
  }
  get(key) { return key ? this.data[key] : { ...this.data }; }
  set(patch) {
    this.data = { ...this.data, ...patch };
    try { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch (_) {}
    return this.get();
  }
}

module.exports = { Settings, DEFAULTS };
