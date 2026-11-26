# CnySong

A small always-on-top lyrics window for Spotify on macOS. Time-synced lyrics, with a romanized
view for Japanese, Korean, Chinese, Russian, Thai and other non-Latin scripts.
Pin it over your work, glance at it, sing along.

## Download

Get the latest version from the [Releases page](https://github.com/tasyashbr/cnysong/releases/latest):

- **Apple Silicon** (M1, M2, M3, M4): `CnySong-1.0.0-arm64.dmg`
- **Intel Mac**: `CnySong-1.0.0.dmg`

Not sure which one? Open the Apple menu, then About This Mac. If it says "Chip: Apple ...", pick the arm64 file.

## Install

1. Open the `.dmg` and drag **CnySong** into **Applications**.
2. CnySong is not signed by Apple, so the first launch needs one extra step:
   - Open **Applications**, right-click **CnySong**, choose **Open**, then **Open** again.
   - If macOS still blocks it, open **System Settings, Privacy & Security**, scroll down and click **Open Anyway**.
   - If it says the app is "damaged", open Terminal and run:
     `xattr -cr /Applications/CnySong.app`
3. When macOS asks if CnySong may control Spotify, click **Allow**.

## Use

1. Open the **Spotify desktop app** and play a song. The web player is not supported.
2. The lyrics window appears. CnySong has no Dock icon, look for its icon in the menu bar.
3. Hover over the window to see the toolbar:
   - Original, Romanized or Both (shown for songs with non-Latin lyrics)
   - Sync offset, if lyrics feel a little early or late
   - Text size
   - Pin on or off
4. Drag the top bar to move the window.

The menu bar icon also has: show or hide the window, always on top, click-through,
font size, background opacity and window size.

## Troubleshooting

- **"Allow CnySong to control Spotify"**: open System Settings, Privacy & Security, Automation, and turn on Spotify under CnySong.
- **No lyrics found**: lyrics come from [LRCLIB](https://lrclib.net), a community database. Popular songs are usually there, newer or indie songs may not be.
- **No Romanized button**: it only appears for songs with non-Latin lyrics. For a new song it can take a few seconds. Some LRCLIB entries are already typed in Latin letters, so there is nothing to convert.
- **The window disappeared**: click the menu bar icon and choose Show lyrics. If click-through is on, turn it off from the same menu.
- **Lyrics are slightly off**: use the `-` and `+` buttons in the toolbar.

## Credits

Lyrics from LRCLIB. Romanization by kuroshiro and kuromoji (Japanese), hangul-romanization (Korean),
pinyin-pro (Chinese) and transliteration (other scripts). Romanization is automatic, so it is not
always perfect, especially for kanji.

Lyrics belong to their rights holders. CnySong only displays them for personal use.

<details>
<summary>For developers</summary>

### Run from source
```bash
git clone https://github.com/tasyashbr/cnysong.git
cd cnysong
npm install
npm start
```
Requires Node.js 22 or newer.

### Build the installer
```bash
npm run dist:mac    # dist/*.dmg, arm64 and x64
```

### Release
Push a tag like `v1.0.0`. GitHub Actions builds the macOS installer and attaches it to a Release.

### How it works
```
Spotify app -> player.js (poll) -> main.js -> lyrics.js (LRCLIB) -> romanize.js
                                      |
                                      +-> renderer (own clock, 60fps highlight)
```

### Optional: Spotify Web API source
The default source reads the Spotify app directly and needs no login. A Web API source also exists
(tray menu, Source). It needs your own Spotify developer app with the redirect URI
`http://127.0.0.1:8888/callback`, and the app owner needs Premium.

Windows is not supported yet.

</details>

## License

MIT