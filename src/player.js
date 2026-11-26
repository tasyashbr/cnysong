// Polls the chosen provider and emits 'state' events: { status, track?, positionMs?, at? }
const { EventEmitter } = require('events');
const web = require('./providers/spotifyWeb');
const local = require('./providers/macLocal');

class Player extends EventEmitter {
  constructor(getSource) {
    super();
    this.getSource = getSource;
    this.timer = null;
    this.running = false;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }
  stop() { this.running = false; clearTimeout(this.timer); }
  restart() { this.stop(); this.start(); }

  async tick() {
    if (!this.running) return;
    const provider = this.getSource() === 'local' ? local : web;
    let wait = provider.interval;
    try {
      const s = await provider.read();
      if (!this.running) return;
      if (s.status === 'rate') wait = s.retryMs;
      if (s.status === 'auth' || s.status === 'permission') wait = 3000;
      this.emit('state', s);
    } catch (e) {
      this.emit('state', { status: 'error', message: e.message });
      wait = 5000;
    }
    this.timer = setTimeout(() => this.tick(), wait);
  }
}

module.exports = { Player };
