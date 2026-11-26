// Fetches time-synced lyrics from LRCLIB (https://lrclib.net), free and no API key.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'https://lrclib.net/api';
const UA = 'CnySong/1.0.0 (https://github.com/tasyashbr/cnysong)';
const MISS_TTL = 7 * 24 * 3600 * 1000;

let cacheDir = null;
function init(dir) {
  cacheDir = path.join(dir, 'lyrics-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
}

function cacheFile(track) {
  const key = [track.artist, track.title, Math.round(track.durationMs / 1000)].join('|').toLowerCase();
  return path.join(cacheDir, crypto.createHash('sha1').update(key).digest('hex') + '.json');
}
function readCache(track) {
  if (!cacheDir) return null;
  try { return JSON.parse(fs.readFileSync(cacheFile(track), 'utf8')); } catch (_) { return null; }
}
function writeCache(track, value) {
  if (!cacheDir) return;
  try { fs.writeFileSync(cacheFile(track), JSON.stringify(value)); } catch (_) {}
}

// "[01:23.45] text" or "[01:23.45][02:10.00] text" -> [{ t: ms, text }]
function parseLrc(lrc) {
  const out = [];
  const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const times = [];
    let m;
    stamp.lastIndex = 0;
    while ((m = stamp.exec(raw)) !== null) {
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      times.push(parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + frac);
    }
    if (!times.length) continue; // metadata tags like [ar:Artist] have no valid mm:ss
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const t of times) out.push({ t, text });
  }
  return out.sort((a, b) => a.t - b.t);
}

function parsePlain(plain) {
  return plain.split(/\r?\n/).map((text) => ({ t: null, text: text.trim() }));
}

function cleanTitle(title) {
  return title
    .replace(/\s*[\(\[][^\)\]]*(feat\.?|ft\.?|with|remaster|live|version|edit|mono|stereo)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+-\s+(.*(remaster|version|edit|live|mono|stereo).*)$/i, '')
    .trim();
}
function firstArtist(artist) {
  return artist.split(/,|&| x | feat\.?| ft\.?/i)[0].trim();
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('LRCLIB HTTP ' + res.status);
  return res.json();
}

function toResult(rec) {
  if (!rec || rec.instrumental) return null;
  if (rec.syncedLyrics) {
    const lines = parseLrc(rec.syncedLyrics);
    if (lines.length) return { synced: true, lines };
  }
  if (rec.plainLyrics) return { synced: false, lines: parsePlain(rec.plainLyrics) };
  return null;
}

async function fetchRemote(track) {
  const dur = Math.round(track.durationMs / 1000);
  const attempts = [
    { title: track.title, artist: track.artist },
    { title: cleanTitle(track.title), artist: firstArtist(track.artist) }
  ];

  // 1) exact match
  for (const a of attempts) {
    const q = new URLSearchParams({ track_name: a.title, artist_name: a.artist, album_name: track.album || '', duration: String(dur) });
    const r = toResult(await getJson(`${BASE}/get?${q}`));
    if (r) return r;
  }

  // 2) fuzzy search: duration within 4s, prefer synced, then closest duration
  for (const a of attempts) {
    const q = new URLSearchParams({ track_name: a.title, artist_name: a.artist });
    const list = (await getJson(`${BASE}/search?${q}`)) || [];
    const ok = list
      .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics) && Math.abs((r.duration || 0) - dur) <= 4)
      .sort((x, y) => (y.syncedLyrics ? 1 : 0) - (x.syncedLyrics ? 1 : 0) || Math.abs(x.duration - dur) - Math.abs(y.duration - dur));
    const r = ok.length ? toResult(ok[0]) : null;
    if (r) return r;
  }
  return null;
}

// Returns { synced, lines } or null. Hits are cached forever, misses for 7 days.
async function get(track) {
  const cached = readCache(track);
  if (cached) {
    if (cached.data) return cached.data;
    if (cached.miss && Date.now() - cached.miss < MISS_TTL) return null;
  }
  const data = await fetchRemote(track);
  writeCache(track, data ? { data } : { miss: Date.now() });
  return data;
}

// Used after romanization so the cache also keeps the romanized lines.
function save(track, data) { writeCache(track, { data }); }

module.exports = { init, get, save, parseLrc, parsePlain, cleanTitle, firstArtist };
