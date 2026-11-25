// The bubble picker. Needs taste-data.js (GENRES, GAMES, SPORTS, BIKES).
// Taste.open(profile, callback): callback gets null (skipped) or
//   { artists: [...], genres: [...], taste: { done, worlds, byGenre, games, sports, bikes } }
const Taste = (() => {
  const WORLDS = ['Music', 'Gaming', 'Sports', 'Bikes'];
  const OWN_YES = 'Yes, I own one';
  const OWN_NO = 'Not yet';
  let ov = null, ans = null, idx = 0, finishCb = null;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const q = (id) => ov.querySelector('#' + id);

  // Start from what the person already saved (so "Edit your vibe" keeps their picks).
  function init(p) {
    const t = (p && p.taste) || {};
    const by = t.byGenre || {};
    const games = t.games || [];
    ans = {
      worlds: Array.isArray(t.worlds) ? [...t.worlds] : [],
      genres: Object.keys(by).filter((g) => GENRES[g]),
      artists: JSON.parse(JSON.stringify(by)),
      games: games.map((g) => g.name),
      ranks: Object.fromEntries(games.filter((g) => g.rank).map((g) => [g.name, g.rank])),
      sports: Array.isArray(t.sports) ? [...t.sports] : [],
      bikes: t.bikes && Array.isArray(t.bikes.fav) ? [...t.bikes.fav] : [],
      owns: t.bikes && t.bikes.owns === true ? [OWN_YES] : t.bikes && t.bikes.owns === false ? [OWN_NO] : [],
      extra: {},
    };
    Object.keys(by).forEach((g) => {
      ans.extra['art-' + g] = by[g].filter((a) => !(GENRES[g] || []).includes(a));
    });
  }

  // The list of screens depends on earlier answers, so it is rebuilt every time.
  function steps() {
    const has = (w) => ans.worlds.includes(w);
    const s = [];
    s.push({ id: 'worlds', title: 'What are you into?', sub: 'Tap all that fit. Anything you skip stays off your card.',
      opts: WORLDS, max: 4, get: () => ans.worlds, set: (v) => { ans.worlds = v; } });

    if (has('Music')) {
      s.push({ id: 'genres', title: "What's your vibe in music?", sub: 'Pick up to 3 genres.',
        opts: Object.keys(GENRES), max: 3, get: () => ans.genres, set: (v) => { ans.genres = v; } });
      ans.genres.forEach((g) => s.push({
        id: 'art-' + g, title: 'Favorite ' + g + ' artists', sub: 'Pick up to 4. Search, or type a name and press Enter to add your own.',
        opts: GENRES[g], max: 4, search: true, custom: true,
        get: () => ans.artists[g] || [], set: (v) => { ans.artists[g] = v; } }));
    }

    if (has('Gaming')) {
      s.push({ id: 'games', title: 'What do you play?', sub: 'Pick up to 5 games.',
        opts: Object.keys(GAMES), max: 5, search: true, get: () => ans.games, set: (v) => { ans.games = v; } });
      ans.games.filter((n) => GAMES[n]).forEach((n) => s.push({
        id: 'rank-' + n, title: 'Your rank in ' + n, sub: 'Pick the closest one.',
        opts: GAMES[n], max: 1, single: true,
        get: () => (ans.ranks[n] ? [ans.ranks[n]] : []),
        set: (v) => { if (v[0]) ans.ranks[n] = v[0]; else delete ans.ranks[n]; } }));
    }

    if (has('Sports')) {
      s.push({ id: 'sports', title: 'Which sports are you into?', sub: 'Playing or watching. Pick up to 3.',
        opts: SPORTS, max: 3, get: () => ans.sports, set: (v) => { ans.sports = v; } });
    }

    if (has('Bikes')) {
      s.push({ id: 'bikes', title: 'Your dream or favorite bike?', sub: 'Pick up to 2.',
        opts: BIKES, max: 2, search: true, get: () => ans.bikes, set: (v) => { ans.bikes = v; } });
      s.push({ id: 'owns', title: 'Do you own a bike right now?', sub: '',
        opts: [OWN_YES, OWN_NO], max: 1, single: true, get: () => ans.owns, set: (v) => { ans.owns = v; } });
    }
    return s;
  }

  function build() {
    ov = el('div');
    ov.id = 'taste';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 't-title');
    ov.innerHTML = `
      <div class="t-top"><div class="t-bar"><i></i></div><button type="button" class="link" id="t-skipall">Skip all</button></div>
      <div class="t-mid"><div class="t-in">
        <h2 id="t-title"></h2>
        <p class="sub" id="t-sub"></p>
        <input id="t-search" class="t-search" placeholder="Search..." autocomplete="off" aria-label="Search">
        <div class="t-bubbles" id="t-bubbles"></div>
        <p class="msg" id="t-msg" role="status"></p>
      </div></div>
      <div class="t-foot"><button type="button" class="btn ghost" id="t-back">Back</button><button type="button" class="btn" id="t-next">Next</button></div>`;
    document.body.append(ov);

    q('t-skipall').onclick = () => close(null);
    q('t-back').onclick = () => { if (idx > 0) { idx--; render(); } };
    q('t-next').onclick = next;
    q('t-search').addEventListener('input', () => drawBubbles(current()));
    q('t-search').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const st = current();
      const text = q('t-search').value.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (text.length < 2) return;
      const all = [...st.opts, ...(ans.extra[st.id] || [])];
      let match = all.find((o) => o.toLowerCase() === text.toLowerCase());
      if (!match && st.custom) {
        (ans.extra[st.id] = ans.extra[st.id] || []).push(text);
        match = text;
      }
      if (!match) return;
      q('t-search').value = '';
      if (!st.get().includes(match)) pick(st, match);
      drawBubbles(st);
    });
  }

  const current = () => { const l = steps(); return l[Math.min(idx, l.length - 1)]; };
  const say = (t) => { q('t-msg').textContent = t; };

  function render() {
    const list = steps();
    if (idx > list.length - 1) idx = list.length - 1;
    const st = list[idx];
    ov.querySelector('.t-bar i').style.width = ((idx + 1) / list.length * 100) + '%';
    q('t-title').textContent = st.title;
    q('t-sub').textContent = st.sub;
    q('t-sub').classList.toggle('hidden', !st.sub);
    q('t-search').classList.toggle('hidden', !st.search);
    q('t-search').value = '';
    say('');
    q('t-back').style.visibility = idx ? 'visible' : 'hidden';
    drawBubbles(st);
    updateNext(list);
  }

  function updateNext(list) {
    list = list || steps();
    const st = list[Math.min(idx, list.length - 1)];
    q('t-next').textContent = idx >= list.length - 1 ? 'Finish' : st.get().length ? 'Next' : 'Skip';
  }

  function drawBubbles(st) {
    const box = q('t-bubbles');
    const f = q('t-search').value.trim().toLowerCase();
    box.replaceChildren();
    [...st.opts, ...(ans.extra[st.id] || [])]
      .filter((o) => !f || o.toLowerCase().includes(f))
      .forEach((o, i) => {
        const b = el('button', 'bubble' + (st.get().includes(o) ? ' on' : ''), o);
        b.type = 'button';
        b.setAttribute('aria-pressed', st.get().includes(o));
        b.style.setProperty('--d', (i % 7) * 0.45 + 's');
        b.onclick = () => pick(st, o, b);
        box.append(b);
      });
  }

  function pick(st, o, b) {
    let cur = [...st.get()];
    if (cur.includes(o)) cur = cur.filter((x) => x !== o);
    else if (st.single) cur = [o];
    else if (cur.length >= st.max) return say('You can pick up to ' + st.max + '.');
    else cur.push(o);
    st.set(cur);
    say('');
    if (st.single) {
      q('t-bubbles').querySelectorAll('.bubble').forEach((x) => {
        const on = cur.includes(x.textContent);
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on);
      });
    } else if (b) {
      b.classList.toggle('on', cur.includes(o));
      b.setAttribute('aria-pressed', cur.includes(o));
    }
    updateNext();
    if (st.single && cur.length) setTimeout(next, 280);
  }

  function next() {
    const list = steps();
    if (idx >= list.length - 1) return finish();
    idx++;
    render();
  }

  function finish() {
    const music = ans.worlds.includes('Music');
    const byGenre = {};
    const artists = [];
    if (music) {
      ans.genres.forEach((g) => {
        const picks = ans.artists[g] || [];
        if (picks.length) byGenre[g] = picks;
        picks.forEach((a) => { if (!artists.includes(a)) artists.push(a); });
      });
    }
    const gaming = ans.worlds.includes('Gaming');
    const bikes = ans.worlds.includes('Bikes');
    close({
      artists,
      genres: music ? ans.genres : [],
      taste: {
        done: true,
        worlds: ans.worlds,
        byGenre,
        games: gaming ? ans.games.map((n) => ({ name: n, rank: ans.ranks[n] || null })) : [],
        sports: ans.worlds.includes('Sports') ? ans.sports : [],
        bikes: bikes ? { fav: ans.bikes, owns: ans.owns.length ? ans.owns[0] === OWN_YES : null } : { fav: [], owns: null },
      },
    });
  }

  function close(result) {
    ov.classList.add('hidden');
    document.body.classList.remove('noscroll');
    const cb = finishCb;
    finishCb = null;
    if (cb) cb(result);
  }

  function open(profile, cb) {
    init(profile);
    if (!ov) build();
    finishCb = cb;
    idx = 0;
    ov.classList.remove('hidden');
    document.body.classList.add('noscroll');
    render();
  }

  return { open };
})();
