// macOS only: asks the Spotify desktop app directly through AppleScript.
// No API key, no Premium, no user limit. macOS will ask permission once.
const { execFile } = require('child_process');

const SCRIPT = `
if application "Spotify" is running then
  tell application "Spotify"
    if player state is stopped then return "stopped"
    set t to current track
    set st to (player state as text)
    return st & "\\t" & (id of t) & "\\t" & (name of t) & "\\t" & (artist of t) & "\\t" & (album of t) & "\\t" & (duration of t) & "\\t" & (player position)
  end tell
else
  return "closed"
end if`;

function run() {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', SCRIPT], { timeout: 4000 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stderr }));
      resolve(stdout.trim());
    });
  });
}

async function read() {
  if (process.platform !== 'darwin') return { status: 'error', message: 'This mode is only for macOS' };
  let out;
  try { out = await run(); }
  catch (e) {
    if (/-1743|not allowed|not authorized/i.test(String(e.stderr || e.message))) return { status: 'permission' };
    return { status: 'error', message: 'AppleScript failed' };
  }
  const at = Date.now();
  if (out === 'closed' || out === 'stopped') return { status: 'idle' };

  const [state, id, title, artist, album, dur, pos] = out.split('\t');
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  return {
    status: state === 'playing' ? 'playing' : 'paused',
    track: { id, title, artist, album, durationMs: num(dur) },
    positionMs: Math.round(num(pos) * 1000),
    at
  };
}

module.exports = { read, interval: 1000 };
