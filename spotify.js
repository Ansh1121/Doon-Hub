// Spotify "Authorization Code with PKCE" login. No client secret is used anywhere.
// Setup: https://developer.spotify.com/dashboard -> Create app -> add the Redirect URI
// (your exact GitHub Pages address, e.g. https://yourname.github.io/doon-vibes/) -> paste Client ID below.
const Spotify = (() => {
  const CLIENT_ID = 'PASTE_YOUR_SPOTIFY_CLIENT_ID';
  const REDIRECT_URI = location.origin + location.pathname;
  const SCOPE = 'user-top-read';

  const b64url = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

  // Step 1: send the person to Spotify to say yes.
  async function connect() {
    if (CLIENT_ID.startsWith('PASTE')) throw new Error('Add your Spotify Client ID at the top of spotify.js first.');
    const verifier = rand(48);
    const state = rand(16);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    localStorage.setItem('sp_verifier', verifier);
    localStorage.setItem('sp_state', state);
    const q = new URLSearchParams({
      response_type: 'code', client_id: CLIENT_ID, scope: SCOPE, redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: challenge, state,
    });
    location.href = 'https://accounts.spotify.com/authorize?' + q;
  }

  // Step 2: Spotify sends them back with ?code=... Swap it for a token, read top artists, forget the token.
  async function handleCallback() {
    const qs = new URLSearchParams(location.search);
    const code = qs.get('code'), err = qs.get('error'), state = qs.get('state');
    if (!code && !err) return null;
    history.replaceState({}, '', location.pathname); // clean the address bar

    const verifier = localStorage.getItem('sp_verifier');
    const saved = localStorage.getItem('sp_state');
    localStorage.removeItem('sp_verifier');
    localStorage.removeItem('sp_state');
    if (err) throw new Error('Spotify said: ' + err);
    if (!verifier || state !== saved) throw new Error('Spotify login could not be verified. Please try again.');

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID, code_verifier: verifier,
      }),
    });
    const tok = await res.json();
    if (!res.ok) throw new Error(tok.error_description || 'Could not connect to Spotify.');

    const topRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    });
    const top = await topRes.json();
    if (!topRes.ok) throw new Error((top.error && top.error.message) || 'Could not read your top artists.');
    const items = top.items || [];
    if (!items.length) throw new Error('Spotify has no listening history for you yet.');

    const counts = {};
    items.forEach((a) => (a.genres || []).forEach((g) => { counts[g] = (counts[g] || 0) + 1; }));
    const genres = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
    return { artists: items.slice(0, 5).map((a) => a.name), genres };
  }

  return { connect, handleCallback };
})();
