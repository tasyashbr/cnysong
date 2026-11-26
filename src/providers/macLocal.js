// macOS only: asks the Spotify desktop app directly through AppleScript.
// No API key, no Premium, no user limit. macOS will ask permission once.
const { execFile } = require('child_process');

const SCRIPT = `
if application "Spotify" is running then
  tell application "Spotify"
    if player state is stopped then return "stopped"
    set t to current track
    return (player state as text) & "|||" & (id of t) & "|||" & (name of t) & "|||" & (artist of t) & "|||" & (album of t) & "|||" & (duration of t) & "|||" & (player position)
  end tell
else
  return "closed"
end if`;

function run() {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', SCRIPT], { timeout: 20000 }, (err, stdout, stderr) => {
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
    return { status: 'error', message: 'AppleScript: ' + String(e.stderr || e.message).split('\n')[0] };
  }
  const at = Date.now();
  if (out === 'closed' || out === 'stopped') return { status: 'idle' };

  const [state, id, title, artist, album, dur, pos] = out.split('|||');
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  return {
    status: state === 'playing' ? 'playing' : 'paused',
    track: { id, title, artist, album, durationMs: num(dur) },
    positionMs: Math.round(num(pos) * 1000),
    at
  };
}

module.exports = { read, interval: 1000 };
