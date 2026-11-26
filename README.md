# CnySong

A small always-on-top window that shows **time-synced lyrics** for the song playing in Spotify,
with a **romanized** toggle for Japanese, Korean, Chinese, Russian, Thai and other non-Latin scripts.
Pin it over your work, glance at it, sing along.

- Synced lyrics from [LRCLIB](https://lrclib.net) (free, no key)
- Original / Romanized / Both display
- Always on top, also over full-screen apps on macOS
- Click-through mode, adjustable size, font, opacity and sync offset
- macOS only for now, Windows is planned

## Two ways to read what Spotify is playing

| Source | Platform | Needs |
|---|---|---|
| **Spotify app** (AppleScript) | macOS | Nothing. macOS asks once to allow control of Spotify |
| **Spotify Web API** | macOS | Your own Spotify developer app (free, owner needs Premium) |

Spotify limits a developer app in Development Mode to 5 authorized users, so each person uses
their own Client ID. That is why the app asks you for it instead of shipping one.

### Create your Client ID (Web API mode)
1. Go to <https://developer.spotify.com/dashboard> and create an app, choose **Web API**.
2. Add the Redirect URI `http://127.0.0.1:8888/callback`.
3. Copy the Client ID, paste it in CnySong, press Connect.

## Run from source
```bash
npm install
npm run icons   # optional, regenerates placeholder icons
npm start
```
Requires Node.js 22 or newer.

## Build installers
```bash
npm run dist:mac   # on a Mac: dist/*.dmg (arm64 and x64)
```
Push a tag like `v1.0.0` and GitHub Actions builds the macOS installer and attaches it to a Release.

### Unsigned builds
Builds are not signed. On macOS, right-click the app, choose Open, or run
`xattr -cr /Applications/CnySong.app`.

## Controls
Hover the window to see the toolbar. Everything is also in the menu bar / tray icon.
Drag the top bar to move the window. If click-through is on, turn it off from the tray menu.

## How it works
```
Spotify app / Web API -> player.js (poll) -> main.js -> lyrics.js (LRCLIB) -> romanize.js
                                               |
                                               +-> renderer (own clock, 60fps highlight)
```

## Credits
LRCLIB for lyrics. kuroshiro + kuromoji (Japanese), hangul-romanization (Korean),
pinyin-pro (Chinese), transliteration (other scripts).
Lyrics belong to their rights holders. This app only displays them for personal use.

## License
MIT
