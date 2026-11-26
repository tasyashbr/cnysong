// Reads the current track from the Spotify Web API (works on macOS and Windows).
const auth = require('../spotifyAuth');

async function read() {
  const token = await auth.getAccessToken();
  if (!token) return { status: 'auth' };

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const at = Date.now();

  if (res.status === 204) return { status: 'idle' };
  if (res.status === 401) { auth.logout(); return { status: 'auth' }; }
  if (res.status === 429) return { status: 'rate', retryMs: (Number(res.headers.get('retry-after')) || 5) * 1000 };
  if (!res.ok) return { status: 'error', message: 'Spotify HTTP ' + res.status };

  const j = await res.json();
  const it = j.item;
  if (!it || it.type !== 'track') return { status: 'idle' };
  return {
    status: j.is_playing ? 'playing' : 'paused',
    track: {
      id: it.id || it.uri,
      title: it.name,
      artist: (it.artists || []).map((a) => a.name).join(', '),
      album: it.album ? it.album.name : '',
      durationMs: it.duration_ms
    },
    positionMs: j.progress_ms,
    at
  };
}

module.exports = { read, interval: 1500 };
