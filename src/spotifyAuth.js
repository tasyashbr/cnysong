// Spotify login with Authorization Code + PKCE. No client secret needed.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { shell, safeStorage } = require('electron');

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`; // register this exact URI in the Spotify dashboard
const SCOPES = 'user-read-currently-playing user-read-playback-state';

let tokenFile = null;
let clientId = '';
let tokens = null; // { access_token, refresh_token, expires_at }

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function init(dir, id) {
  tokenFile = path.join(dir, 'spotify-token.bin');
  clientId = id || '';
  try {
    const raw = fs.readFileSync(tokenFile);
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    tokens = JSON.parse(json);
  } catch (_) { tokens = null; }
}
function setClientId(id) { clientId = id; }

function save() {
  try {
    if (!tokens) { fs.rmSync(tokenFile, { force: true }); return; }
    const json = JSON.stringify(tokens);
    fs.writeFileSync(tokenFile, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json));
  } catch (_) {}
}

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...params })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.error_description || json.error || 'token error'); e.code = json.error; throw e; }
  return json;
}

function storeTokens(json) {
  tokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || (tokens && tokens.refresh_token),
    expires_at: Date.now() + json.expires_in * 1000
  };
  save();
}

function resultPage(msg) {
  return `<!doctype html><meta charset="utf-8"><title>CnySong</title>
  <body style="font:16px system-ui;background:#14121f;color:#f6efe4;display:grid;place-items:center;height:100vh;margin:0">
  <p>${msg}</p></body>`;
}

async function login() {
  if (!clientId) throw new Error('Client ID kosong');
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: clientId, scope: SCOPES, redirect_uri: REDIRECT,
    code_challenge_method: 'S256', code_challenge: challenge, state
  });

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new Error('Login timeout')); }, 120000);
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      const ok = u.searchParams.get('code') && u.searchParams.get('state') === state && !u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(resultPage(ok ? 'Berhasil. Kamu boleh menutup tab ini.' : 'Login gagal. Coba lagi dari CnySong.'));
      clearTimeout(timer);
      server.close();
      ok ? resolve(u.searchParams.get('code')) : reject(new Error(u.searchParams.get('error') || 'state mismatch'));
    });
    server.on('error', (e) => { clearTimeout(timer); reject(new Error(e.code === 'EADDRINUSE' ? `Port ${PORT} sedang dipakai` : e.message)); });
    server.listen(PORT, '127.0.0.1', () => shell.openExternal(authUrl));
  });

  storeTokens(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier }));
}

async function getAccessToken() {
  if (!tokens) return null;
  if (tokens.expires_at - Date.now() > 60000) return tokens.access_token;
  try {
    storeTokens(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }));
    return tokens.access_token;
  } catch (e) {
    if (e.code === 'invalid_grant' || e.code === 'invalid_client') { logout(); return null; }
    throw e;
  }
}

function logout() { tokens = null; save(); }
function isConnected() { return !!tokens; }

module.exports = { init, setClientId, login, logout, getAccessToken, isConnected, REDIRECT };
