// ---------- 1. SETTINGS ----------
const SUPABASE_URL = 'https://xmdhxbsxzntzpekyqzui.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aDgiMnlQf3FHrxmh6jaQ0A_5U7N7Zaz'; // publishable key: safe to be public
const FAKE_EMAIL_DOMAIN = 'doonvibes.app'; // users never see this; no email is ever sent
const INTERESTS = ['Cafes', 'Thrifting', 'Gaming', 'Drives', 'Anime', 'Music', 'Sports', 'Movies', 'Travel', 'Art'];

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

let signupMode = false;
let heroSeen = false; // the welcome screen shows once per visit (and again after log out)
let me = null; // { user, profile }
const picked = new Set();

// ---------- 2. SMALL HELPERS ----------
function showScreen(name) {
  ['auth', 'onboarding', 'app'].forEach((s) => $(s).classList.toggle('hidden', s !== name));
  if (name === 'auth' && !heroSeen) { if ($('hero').classList.contains('hidden')) showHero(); }
  else $('hero').classList.add('hidden');
}

// ---------- WELCOME (hero) ----------
function showHero() {
  const h = $('hero');
  h.classList.remove('hidden', 'slide-out-blurred-top');
  h.querySelectorAll('[data-anim]').forEach((n) => { // replay the entrance animations
    n.classList.remove(n.dataset.anim);
    void n.offsetWidth;
    n.classList.add(n.dataset.anim);
  });
}
function enterFromHero(signup) {
  const h = $('hero');
  if (h.classList.contains('slide-out-blurred-top')) return;
  setMode(signup);
  heroSeen = true;
  const done = (ev) => {
    if (ev.target !== h) return; // ignore the children's animation events
    h.classList.add('hidden');
    h.removeEventListener('animationend', done);
  };
  h.addEventListener('animationend', done);
  setTimeout(() => h.classList.add('hidden'), 900); // safety net
  h.classList.add('slide-out-blurred-top');
}
$('hero-login').onclick = () => enterFromHero(false);
$('hero-signup').onclick = () => enterFromHero(true);
function say(el, text, ok = false) {
  el.textContent = text;
  el.className = 'msg' + (ok ? ' ok' : '');
}
const toEmail = (username) => `${username}@${FAKE_EMAIL_DOMAIN}`;
function friendly(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Wrong username or password.';
  if (m.includes('already registered') || m.includes('already exists')) return 'That username is taken. Try another.';
  return error.message;
}

// ---------- 3. LOG IN / SIGN UP ----------
function setMode(signup) {
  signupMode = signup;
  $('tab-login').classList.toggle('on', !signup);
  $('tab-signup').classList.toggle('on', signup);
  $('age-row').classList.toggle('hidden', !signup);
  $('auth-btn').textContent = signup ? 'Create account' : 'Log in';
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  say($('auth-msg'), '');
}
$('tab-login').onclick = () => setMode(false);
$('tab-signup').onclick = () => setMode(true);

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('auth-msg');
  const username = $('username').value.trim().toLowerCase();
  const password = $('password').value;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return say(msg, 'Username must be 3 to 20 letters, numbers or _ .');
  if (signupMode && !$('age-ok').checked) return say(msg, 'Please confirm you are 18 or older.');

  $('auth-btn').disabled = true;
  say(msg, 'Please wait...', true);
  const creds = { email: toEmail(username), password };
  const { data, error } = signupMode
    ? await db.auth.signUp(creds)
    : await db.auth.signInWithPassword(creds);
  $('auth-btn').disabled = false;

  if (error) return say(msg, friendly(error));
  if (signupMode && !data.session) {
    return say(msg, 'Account made, but you are not logged in. In Supabase, turn OFF "Confirm email" (Authentication > Sign In / Providers > Email).');
  }
  say(msg, '');
  route();
});

// ---------- 4. DECIDE WHICH SCREEN TO SHOW ----------
async function route() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return showScreen('auth');

  const { data: profile, error } = await db
    .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) {
    heroSeen = true;
    showScreen('auth');
    return say($('auth-msg'), 'Could not load your profile: ' + error.message);
  }
  me = { user: session.user, profile };

  if (!profile) {
    buildChips();
    return showScreen('onboarding');
  }
  $('hello').textContent = 'Hi, ' + me.profile.name;
  showScreen('app');
  setBountyTab('board', false); // a new login always starts on the Board
  showTab('discover');
  loadDiscover();
  if (!(me.profile.taste && me.profile.taste.done)) openTaste(true); // first visit: show the bubble picker
  refreshBadge();
  if (!pollId) pollId = setInterval(refreshBadge, 30000);
}

// ---------- 5. PROFILE SETUP ----------
function buildChips() {
  const box = $('chips');
  if (box.childElementCount) return;
  INTERESTS.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = name;
    b.onclick = () => {
      picked.has(name) ? picked.delete(name) : picked.add(name);
      b.classList.toggle('on');
    };
    box.appendChild(b);
  });
}

$('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('ob-msg');
  const uid = me.user.id;
  const age = parseInt($('age').value, 10);
  const ig = $('ig').value.trim().replace(/^@/, '');

  if (!(age >= 18 && age <= 99)) return say(msg, 'You must be 18 or older to use this app.');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(ig)) return say(msg, 'Instagram handle can only have letters, numbers, . and _ .');
  if (picked.size === 0) return say(msg, 'Pick at least one interest.');

  $('ob-btn').disabled = true;
  say(msg, 'Saving...', true);
  const uploadedPaths = [];
  try {
    // a) upload photos into your own folder (the first one is the main photo)
    const files = [...$('photo').files];
    if (!files.length) throw new Error('Add at least one photo.');
    if (files.length > MAX_PROFILE_PHOTOS) throw new Error('You can add up to ' + MAX_PROFILE_PHOTOS + ' photos.');
    const urls = await uploadProfilePhotos(files, uid, uploadedPaths);
    const avatar_url = urls[0];

    // b) save the public profile
    const p = await db.from('profiles').insert({
      id: uid,
      name: $('name').value.trim(),
      age,
      locality: $('locality').value,
      college: $('college').value.trim() || null,
      bio: $('bio').value.trim() || null,
      interests: [...picked],
      avatar_url,
      photos: urls,
    });
    if (p.error) throw p.error;

    // c) save the hidden Instagram handle in its own table
    const c = await db.from('private_contacts').insert({ user_id: uid, instagram_handle: ig });
    if (c.error) {
      await db.from('profiles').delete().eq('id', uid); // undo so you can try again
      throw c.error;
    }
    say(msg, '');
    route();
  } catch (err) {
    if (uploadedPaths.length) db.storage.from('avatars').remove(uploadedPaths); // no orphan photos after a failed try
    say(msg, err.message || 'Something went wrong. Try again.');
  }
  $('ob-btn').disabled = false;
});

// ---------- 6. TABS AND LOG OUT ----------
function showTab(name) {
  document.body.dataset.tab = name; // each tab has its own accent colour
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'view-' + name));
  if (name === 'activity') loadActivity();
  if (name === 'bounties') loadBounties();
  if (name === 'feed') loadFeed();
  if (name === 'profile') renderProfileTab();
}
document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.onclick = () => showTab(btn.dataset.tab);
});
$('logout').onclick = async () => {
  await db.auth.signOut();
  me = null;
  heroSeen = false; // show the welcome screen again
  route();
};

// ---------- 7. DISCOVER (swipe cards) ----------
const AVATAR_PREFIX = SUPABASE_URL + '/storage/v1/object/public/avatars/';
let deck = [];
let busy = false;
let drag = null;

// Build elements with textContent only, so nobody's bio can inject code.
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

async function loadDiscover() {
  say($('dmsg'), 'Loading people...', true);
  const { data, error } = await db.rpc('get_discover_feed', { lim: 20 });
  if (error) return say($('dmsg'), 'Could not load people: ' + error.message);
  say($('dmsg'), '');
  const mine = new Set(me.profile.interests);
  deck = (data || [])
    .map((p) => ({ p, shared: p.interests.filter((i) => mine.has(i)) }))
    .sort((x, y) => (y.shared.length + affinity(y.p)) - (x.shared.length + affinity(x.p)));
  // most in common first (a shared artist counts double)
  renderTop();
}

function renderTop() {
  const stage = $('stage');
  stage.replaceChildren();
  $('swipe-btns').classList.toggle('hidden', !deck.length);
  if (!deck.length) {
    stage.append(el('p', 'empty', 'You have seen everyone for now. Check back soon.'));
    const b = el('button', 'btn ghost', 'Refresh');
    b.onclick = loadDiscover;
    stage.append(b);
    return;
  }
  const { p, shared } = deck[0];
  const card = buildCard(p, shared);
  attachDrag(card);
  stage.append(card);
}

function sharedArtists(p) {
  if (!me || p.id === me.user.id) return [];
  const mine = new Set(Array.isArray(me.profile.spotify_artists) ? me.profile.spotify_artists : []);
  return (Array.isArray(p.spotify_artists) ? p.spotify_artists : []).filter((n) => mine.has(n));
}

function tasteBlock(p, body) {
  const other = me && p.id !== me.user.id;
  const mt = other ? (me.profile.taste || {}) : {};
  const t = p.taste || {};
  const mineA = new Set(other && Array.isArray(me.profile.spotify_artists) ? me.profile.spotify_artists : []);
  const mineG = new Set((mt.games || []).map((g) => g.name));
  const mineS = new Set(mt.sports || []);
  const section = (title, items, note) => {
    if (!items.length) return;
    const box = el('div', 'spot-box');
    box.append(el('p', 'spot-title', title));
    const row = el('div', 'chips');
    items.forEach((i) => row.append(el('span', 'tag' + (i.hit ? ' shared' : ''), i.t)));
    box.append(row);
    if (note) box.append(el('p', 'ploc', note));
    body.append(box);
  };
  const arts = Array.isArray(p.spotify_artists) ? p.spotify_artists : [];
  const genres = Array.isArray(p.spotify_genres) ? p.spotify_genres : [];
  section('Heavy rotation', arts.slice(0, 8).map((n) => ({ t: n, hit: mineA.has(n) })), genres.join(' / '));
  section('Plays', (t.games || []).map((g) => ({ t: g.rank ? g.name + ' - ' + g.rank : g.name, hit: mineG.has(g.name) })));
  section('Into', (t.sports || []).map((s) => ({ t: s, hit: mineS.has(s) })));
  if (t.bikes && (t.bikes.fav || []).length) {
    section('Bikes', t.bikes.fav.map((b) => ({ t: b, hit: false })), t.bikes.owns === true ? 'Owns one right now' : '');
  }
}

function affinity(p) {
  if (!me || p.id === me.user.id) return 0;
  const mt = me.profile.taste || {}, t = p.taste || {};
  const games = new Set((mt.games || []).map((g) => g.name));
  const sports = new Set(mt.sports || []);
  return 2 * (sharedArtists(p).length
    + (t.games || []).filter((g) => games.has(g.name)).length
    + (t.sports || []).filter((s) => sports.has(s)).length);
}

function buildCard(p, shared) {
  const card = el('article', 'pcard');
  const gal = buildGallery(p);

  const body = el('div', 'pbody');
  body.append(el('h3', '', `${p.name}, ${p.age}`));
  body.append(el('p', 'ploc', p.college ? `${p.locality}, ${p.college}` : p.locality));
  if (p.bio) body.append(el('p', 'pbio', p.bio));
  const chips = el('div', 'chips');
  [...shared, ...p.interests.filter((i) => !shared.includes(i))].forEach((i) =>
    chips.append(el('span', 'tag' + (shared.includes(i) ? ' shared' : ''), i)));
  body.append(chips);
  if (shared.length) body.append(el('p', 'pshared', 'You both like ' + shared.join(', ')));

  tasteBlock(p, body);

  card.append(gal, body);
  return card;
}

// All of a person's photos (older profiles only have avatar_url).
function photoList(p) {
  const list = Array.isArray(p.photos) && p.photos.length ? p.photos : (p.avatar_url ? [p.avatar_url] : []);
  return list.filter((u) => typeof u === 'string' && u.startsWith(AVATAR_PREFIX)).slice(0, MAX_PROFILE_PHOTOS);
}

// Photo area on a card: tap the right half for the next photo, the left half for the previous one.
function buildGallery(p) {
  const urls = photoList(p);
  const gal = el('div', 'pgal');
  const img = el('img', 'pphoto');
  gal.append(img);
  let i = 0;
  const dots = el('div', 'pdots');
  const show = (k) => {
    i = Math.max(0, Math.min(urls.length - 1, k));
    img.src = urls[i];
    img.alt = 'Photo ' + (i + 1) + ' of ' + urls.length + ' of ' + p.name;
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
  };
  gal._go = (d) => show(i + d);
  if (urls.length > 1) {
    urls.forEach(() => dots.append(el('i')));
    gal.append(dots);
    const prev = el('button', 'gbtn gprev');
    const next = el('button', 'gbtn gnext');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Previous photo');
    next.setAttribute('aria-label', 'Next photo');
    // On the swipe deck, mouse and touch taps are handled by attachDrag; keyboard clicks (detail 0) come here.
    prev.onclick = (e) => { if (gal._tap && e.detail > 0) return; show(i - 1); };
    next.onclick = (e) => { if (gal._tap && e.detail > 0) return; show(i + 1); };
    gal.append(prev, next);
  }
  if (urls.length) {
    show(0);
    urls.slice(1).forEach((u) => { const pre = new Image(); pre.src = u; }); // preload so flipping is instant
  } else {
    img.alt = 'No photo';
  }
  return gal;
}

function attachDrag(card) {
  const g = card.querySelector('.pgal');
  if (g) g._tap = true;
  card.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, gal: e.target.closest ? e.target.closest('.pgal') : null };
    card.setPointerCapture(e.pointerId);
    card.classList.add('drag');
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
  });
  card.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const tapGal = Math.abs(dx) < 8 ? drag.gal : null; // a tap, not a swipe
    drag = null;
    card.classList.remove('drag');
    if (tapGal && tapGal._go) {
      const r = tapGal.getBoundingClientRect();
      tapGal._go(e.clientX < r.left + r.width / 2 ? -1 : 1);
      card.style.transform = '';
    } else if (Math.abs(dx) > 110) swipe(dx > 0);
    else card.style.transform = '';
  });
}

async function swipe(liked) {
  if (busy || !deck.length) return;
  busy = true;
  const { p } = deck[0];
  const card = $('stage').firstElementChild;
  const { error } = await db.from('swipes').insert({ swiper_id: me.user.id, swiped_id: p.id, liked });
  if (error) {
    busy = false;
    if (card) card.style.transform = '';
    return say($('dmsg'), 'Could not save your swipe: ' + error.message);
  }
  say($('dmsg'), '');
  if (card) card.classList.add(liked ? 'out-right' : 'out-left');
  await new Promise((r) => setTimeout(r, 220));
  deck.shift();
  renderTop();
  if (liked) await checkMatch(p);
  busy = false;
}

// The database trigger already made the match if both liked, so we just look for it.
async function checkMatch(p) {
  const a = me.user.id, b = p.id;
  const { data } = await db.from('matches').select('id')
    .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
    .maybeSingle();
  if (!data) return;
  const { data: ig } = await db.rpc('get_unlocked_contact', { other_id: b });
  showMatch(p, ig);
}

function showMatch(p, ig) {
  $('match-text').textContent = `You and ${p.name} liked each other.`;
  $('match-handle').textContent = ig ? '@' + ig : 'Handle not available';
  $('open-ig').href = ig ? 'https://instagram.com/' + encodeURIComponent(ig) : '#';
  $('copy-ig').disabled = !ig;
  $('copy-ig').textContent = 'Copy @handle';
  $('copy-ig').onclick = async () => {
    try { await navigator.clipboard.writeText('@' + ig); $('copy-ig').textContent = 'Copied'; }
    catch { $('copy-ig').textContent = 'Select the handle and copy it'; }
  };
  $('match').classList.remove('hidden');
}

$('match-close').onclick = () => $('match').classList.add('hidden');
$('pass').onclick = () => swipe(false);
$('like').onclick = () => swipe(true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { ['match', 'pview', 'bmodal', 'amodal'].forEach((id) => $(id).classList.add('hidden')); return; }
  const onDiscover = !$('app').classList.contains('hidden') && !$('view-discover').classList.contains('hidden');
  if (!onDiscover || !$('match').classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') swipe(false);
  if (e.key === 'ArrowRight') swipe(true);
});

// ---------- 8. ACTIVITY (system inbox) ----------
let pollId = null;

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}

function setBadge(n) {
  $('badge').textContent = n;
  $('badge').classList.toggle('hidden', !n);
}

async function refreshBadge() {
  if (!me) return;
  const { count } = await db.from('notifications')
    .select('id', { count: 'exact', head: true }).eq('is_read', false);
  setBadge(count || 0);
}

async function loadActivity() {
  const { data, error } = await db.from('notifications')
    .select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return say($('amsg'), 'Could not load activity: ' + error.message);
  say($('amsg'), '');
  const list = $('alist');
  list.replaceChildren();
  if (!data.length) list.append(el('p', 'empty', 'Nothing yet. Matches and accepted bounties will show up here.'));
  data.forEach((n) => list.append(alertItem(n)));
  if (data.some((n) => !n.is_read)) {
    await db.from('notifications').update({ is_read: true }).eq('user_id', me.user.id).eq('is_read', false);
  }
  setBadge(0);
}

function alertItem(n) {
  const item = el('article', 'alert' + (n.is_read ? '' : ' unread'));
  item.append(el('p', 'amsgtxt', n.message), el('p', 'atime', timeAgo(n.created_at)));
  const row = el('div', 'arow');
  if (n.unlocked_ig) {
    item.append(el('p', 'handle small', '@' + n.unlocked_ig));
    const copy = el('button', 'btn small', 'Copy @handle');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText('@' + n.unlocked_ig); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Copy failed'; }
    };
    const open = el('a', 'btn small ghost', 'Open Instagram');
    open.href = 'https://instagram.com/' + encodeURIComponent(n.unlocked_ig);
    open.target = '_blank';
    open.rel = 'noopener';
    row.append(copy, open);
  }
  if (n.actor_id) {
    const view = el('button', 'btn small ghost', 'View profile');
    view.onclick = () => viewProfile(n.actor_id);
    row.append(view);
  }
  item.append(row);
  return item;
}

async function viewProfile(id) {
  const { data: p, error } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error || !p) return alert('Could not load this profile.');
  const mine = new Set(me.profile.interests);
  const body = $('pview-body');
  body.replaceChildren(buildCard(p, p.interests.filter((i) => mine.has(i))));
  const row = el('div', 'arow');
  const rep = el('button', 'btn small ghost', 'Report');
  rep.onclick = () => reportUser(id);
  const blk = el('button', 'btn small ghost', 'Block');
  blk.onclick = () => blockUser(id);
  row.append(rep, blk);
  body.append(row);
  $('pview').classList.remove('hidden');
}

async function reportUser(id) {
  const reason = prompt('What is the problem? (3 to 500 characters)');
  if (!reason || reason.trim().length < 3) return;
  const { error } = await db.from('reports')
    .insert({ reporter_id: me.user.id, reported_id: id, reason: reason.trim().slice(0, 500) });
  alert(error ? 'Could not send report: ' + error.message : 'Report sent. Thank you.');
}

async function blockUser(id) {
  if (!confirm('Block this person? You will not see each other in Discover.')) return;
  const { error } = await db.from('blocks').insert({ blocker_id: me.user.id, blocked_id: id });
  if (error) return alert('Could not block: ' + error.message);
  $('pview').classList.add('hidden');
  loadDiscover();
  if (document.body.dataset.tab === 'feed') loadFeed(); // hide their posts right away
}

$('pview-close').onclick = () => $('pview').classList.add('hidden');

// ---------- 9. BOUNTIES ----------
let bountyTab = 'board';
const fmtTime = (iso) => new Date(iso).toLocaleString('en-IN',
  { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function setBountyTab(t, load = true) {
  bountyTab = t;
  $('bt-board').classList.toggle('on', t === 'board');
  $('bt-mine').classList.toggle('on', t === 'mine');
  $('cats').classList.toggle('hidden', t !== 'board');
  if (load) loadBounties();
}
$('bt-board').onclick = () => setBountyTab('board');
$('bt-mine').onclick = () => setBountyTab('mine');
const loadBounties = () => (bountyTab === 'board' ? loadBoard() : loadMine());

// Little animated pictures for the bounty cards (plain SVG, styled in the CSS above).
const INK = '#12146B';
const S = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const ART = {
  movie: `<svg class="art" viewBox="0 0 64 64"><rect x="8" y="26" width="48" height="30" rx="4" fill="#fff" ${S}/><path d="M8 38h48" fill="none" ${S}/><g class="clap"><rect x="8" y="14" width="48" height="12" rx="3" fill="${INK}"/><path d="M19 14l-6 12M31 14l-6 12M43 14l-6 12M55 14l-6 12" stroke="#fff" stroke-width="4" fill="none"/></g></svg>`,
  cafe: `<svg class="art" viewBox="0 0 64 64"><path class="steam s1" d="M24 18c-4 5 4 7 0 12" fill="none" ${S}/><path class="steam s2" d="M32 14c-4 5 4 7 0 12" fill="none" ${S}/><path class="steam s3" d="M40 18c-4 5 4 7 0 12" fill="none" ${S}/><path d="M14 34h32v8a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" fill="#fff" ${S}/><path d="M46 38h3a6 6 0 0 1 0 12h-5" fill="none" ${S}/></svg>`,
  sports: `<svg class="art" viewBox="0 0 64 64"><ellipse class="shadow" cx="32" cy="58" rx="14" ry="3" fill="${INK}" opacity=".25"/><g class="bounce"><circle cx="32" cy="30" r="20" fill="#FF6B5B" ${S}/><path d="M12 30h40M32 10v40M17 17c8 8 8 22 0 30M47 17c-8 8-8 22 0 30" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></g></svg>`,
  study: `<svg class="art" viewBox="0 0 64 64"><rect x="10" y="8" width="38" height="48" rx="4" fill="#fff" ${S}/><path d="M18 22h22M18 32h22M18 42h14" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><g class="pencil"><path d="M44 34l12-12 6 6-12 12-8 2z" fill="#FFD93D" ${S}/></g></svg>`,
  gaming: `<svg class="art" viewBox="0 0 64 64"><g class="pad"><path d="M16 24h32a10 10 0 0 1 10 10l2 10a6 6 0 0 1-10 4l-5-6H19l-5 6a6 6 0 0 1-10-4l2-10a10 10 0 0 1 10-10z" fill="#fff" ${S}/><path d="M20 31v10M15 36h10" fill="none" ${S}/><circle class="b1" cx="44" cy="33" r="3.2" fill="#FF6B5B"/><circle class="b2" cx="50" cy="38" r="3.2" fill="#FFD93D"/></g></svg>`,
  other: `<svg class="art" viewBox="0 0 64 64"><path class="spin" d="M32 8l6 16 16 6-16 6-6 16-6-16-16-6 16-6z" fill="#FFD93D" ${S}/></svg>`,
};
const CAT_SLUG = { 'Movie': 'movie', 'Cafe Hop': 'cafe', 'Sports': 'sports', 'Study': 'study', 'Gaming': 'gaming', 'Study/Gaming': 'study', 'Other': 'other' };
function catStrip(category) {
  const slug = CAT_SLUG[category] || 'other';
  const strip = el('div', 'bart cat-' + slug);
  strip.append(el('span', 'tag', category));
  const art = el('div');
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = ART[slug]; // fixed strings above, never user text
  strip.append(art);
  return strip;
}

// The banners. img = file in your repo next to index.html. key = the category saved in the database.
const BCATS = [
  { key: 'Movie', label: 'Movies', img: 'threatre.jpg' },
  { key: 'Cafe Hop', label: 'Cafes', img: 'cafe.jpg' },
  { key: 'Sports', label: 'Sports', img: 'sports.jpg' },
  { key: 'Study', label: 'Study', img: 'study.jpg' },
  { key: 'Gaming', label: 'Gaming', img: 'gaming.jpg' },
  { key: 'Other', label: 'Other', img: null },
];
let boardCat = null; // null = show everything
let boardFeed = [];
// old bounties saved as "Study/Gaming" still show under both Study and Gaming
const inCat = (b, key) => b.category === key || (b.category === 'Study/Gaming' && (key === 'Study' || key === 'Gaming'));

async function loadBoard() {
  say($('bmsg'), 'Loading...', true);
  const { data, error } = await db.rpc('get_bounty_feed');
  if (error) return say($('bmsg'), 'Could not load bounties: ' + error.message);
  boardFeed = data || [];
  try {
    renderBoard();
    say($('bmsg'), '');
  } catch (err) {
    say($('bmsg'), 'Could not show bounties: ' + err.message);
  }
}

function renderBoard() {
  const box = $('cats');
  box.replaceChildren();
  BCATS.forEach((c) => {
    const n = boardFeed.filter((b) => inCat(b, c.key)).length;
    const tile = el('button', 'catbtn' + (boardCat === c.key ? ' on' : ''));
    tile.type = 'button';
    tile.setAttribute('aria-pressed', boardCat === c.key);
    if (c.img) {
      const im = el('img');
      im.src = c.img;
      im.alt = '';
      im.loading = 'lazy';
      im.onerror = () => im.remove(); // missing file: the blue tile and label still work
      tile.append(im);
    }
    tile.append(el('span', 'cat-label', c.label + (n ? ' (' + n + ')' : '')));
    tile.onclick = () => { boardCat = boardCat === c.key ? null : c.key; renderBoard(); };
    box.append(tile);
  });

  const list = $('blist');
  list.replaceChildren();
  const cur = BCATS.find((c) => c.key === boardCat);
  list.append(el('p', 'atime', cur ? 'Showing ' + cur.label + '. Tap it again to see everything.' : 'Showing everything. Tap a banner to filter.'));
  const shown = boardCat ? boardFeed.filter((b) => inCat(b, boardCat)) : boardFeed;
  if (!shown.length) {
    list.append(el('p', 'empty', cur ? 'No ' + cur.label + ' bounties right now. Post the first one!'
      : 'No open bounties right now. Bounties disappear a few hours after their start time.'));
  }
  shown.forEach((b) => list.append(bountyCard(b)));
}

function bountyCard(b) {
  const c = el('article', 'alert bcard');
  const top = el('div', 'bhost');
  const img = el('img', 'bavatar');
  img.alt = '';
  if (b.host_avatar && b.host_avatar.startsWith(AVATAR_PREFIX)) img.src = b.host_avatar;
  const who = el('div');
  who.append(el('strong', '', `${b.host_name}, ${b.host_age}`), el('div', 'atime', b.host_locality));
  top.append(img, who);
  c.append(catStrip(b.category), top, el('h3', 'btitle', b.title));
  if (b.description) c.append(el('p', 'pbio', b.description));
  const left = b.max_spots - b.accepted_count;
  c.append(el('p', 'atime', `${fmtTime(b.event_time)} - ${b.locality} - ${left} of ${b.max_spots} spots left`));

  const btn = el('button', 'btn small');
  const mineB = b.host_id === me.user.id;
  if (mineB) {
    btn.textContent = 'Yours - manage';
    btn.classList.add('ghost');
    btn.onclick = () => setBountyTab('mine');
  } else if (b.my_status === 'accepted') {
    btn.textContent = 'Accepted! See Activity';
    btn.onclick = () => showTab('activity');
  } else if (b.my_status === 'declined') {
    btn.textContent = 'Not this time';
    btn.disabled = true;
  } else if (b.my_status === 'pending') {
    btn.textContent = 'Applied - tap to withdraw';
    btn.classList.add('ghost');
    btn.onclick = async () => {
      btn.disabled = true;
      const { error } = await db.from('bounty_applications').delete()
        .eq('bounty_id', b.id).eq('applicant_id', me.user.id);
      if (error) { btn.disabled = false; return say($('bmsg'), error.message); }
      loadBoard();
    };
  } else {
    btn.textContent = left > 0 ? "I'm In / Apply" : 'Full';
    btn.disabled = left <= 0;
    btn.onclick = async () => {
      btn.disabled = true;
      const { error } = await db.rpc('apply_to_bounty', { bid: b.id });
      if (error) { btn.disabled = false; return say($('bmsg'), error.message); }
      loadBoard();
    };
  }
  const hostBtn = el('button', 'btn small ghost', 'View host');
  hostBtn.onclick = () => viewProfile(b.host_id);
  const row = el('div', 'arow');
  row.append(btn);
  if (!mineB) row.append(hostBtn);
  c.append(row);
  return c;
}

async function loadMine() {
  say($('bmsg'), 'Loading...', true);
  const { data: bs, error } = await db.from('bounties').select('*')
    .eq('host_id', me.user.id).order('event_time', { ascending: false });
  if (error) return say($('bmsg'), 'Could not load your bounties: ' + error.message);
  let apps = [];
  if (bs.length) {
    const r = await db.from('bounty_applications').select('bounty_id,status').in('bounty_id', bs.map((b) => b.id));
    apps = r.data || [];
  }
  say($('bmsg'), '');
  const list = $('blist');
  list.replaceChildren();
  if (!bs.length) list.append(el('p', 'empty', 'You have not posted any bounties yet.'));
  bs.forEach((b) => {
    const mine = apps.filter((a) => a.bounty_id === b.id);
    const pending = mine.filter((a) => a.status === 'pending').length;
    const accepted = mine.filter((a) => a.status === 'accepted').length;
    const c = el('article', 'alert');
    c.append(catStrip(b.category), el('h3', 'btitle', b.title),
      el('p', 'atime', `${fmtTime(b.event_time)} - ${b.locality} - ${accepted} of ${b.max_spots} accepted - ${b.status}`));
    const row = el('div', 'arow');
    const view = el('button', 'btn small', `View Applicants (${pending})`);
    view.onclick = () => openApplicants(b);
    const del = el('button', 'btn small ghost', 'Delete');
    del.onclick = async () => {
      if (!confirm('Delete this bounty and all its applications?')) return;
      const { error: e } = await db.from('bounties').delete().eq('id', b.id);
      if (e) return say($('bmsg'), 'Could not delete: ' + e.message);
      loadMine();
    };
    row.append(view, del);
    c.append(row);
    list.append(c);
  });
}

// Post a bounty
$('post-bounty').onclick = () => {
  $('b-loc').innerHTML = $('locality').innerHTML;
  $('b-loc').value = me.profile.locality;
  if (boardCat && bountyTab === 'board') $('b-cat').value = boardCat; // posting from a filtered view starts on that category
  const soon = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  $('b-time').min = soon.toISOString().slice(0, 16);
  say($('b-msg'), '');
  $('bmodal').classList.remove('hidden');
};
$('b-close').onclick = () => $('bmodal').classList.add('hidden');

$('bounty-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('b-msg');
  const when = new Date($('b-time').value);
  if (isNaN(when) || when <= new Date()) return say(msg, 'Pick a time in the future.');
  $('b-btn').disabled = true;
  say(msg, 'Posting...', true);
  const { error } = await db.from('bounties').insert({
    host_id: me.user.id,
    title: $('b-title').value.trim(),
    description: $('b-desc').value.trim() || null,
    category: $('b-cat').value,
    locality: $('b-loc').value,
    event_time: when.toISOString(),
    max_spots: parseInt($('b-spots').value, 10),
  });
  $('b-btn').disabled = false;
  if (error) return say(msg, error.message);
  say(msg, '');
  $('bounty-form').reset();
  $('bmodal').classList.add('hidden');
  setBountyTab('mine');
});

// Host: review applicants
async function openApplicants(b) {
  $('a-title').textContent = `Applicants: ${b.title}`;
  $('amodal').classList.remove('hidden');
  await renderApplicants(b);
}
$('a-close').onclick = () => { $('amodal').classList.add('hidden'); if (bountyTab === 'mine') loadMine(); };

async function renderApplicants(b) {
  const list = $('a-list');
  list.replaceChildren();
  say($('a-msg'), 'Loading...', true);
  const { data: apps, error } = await db.from('bounty_applications')
    .select('id,applicant_id,status').eq('bounty_id', b.id).order('created_at');
  if (error) return say($('a-msg'), error.message);
  say($('a-msg'), '');
  if (!apps.length) return list.append(el('p', 'empty', 'Nobody has applied yet.'));
  const { data: ps } = await db.from('profiles').select('id,name,age,locality')
    .in('id', apps.map((a) => a.applicant_id));
  const byId = Object.fromEntries((ps || []).map((p) => [p.id, p]));
  apps.forEach((a) => {
    const p = byId[a.applicant_id];
    if (!p) return;
    const row = el('article', 'alert');
    const name = el('button', 'link applink', `${p.name}, ${p.age} - ${p.locality}`);
    name.onclick = () => viewProfile(p.id);
    row.append(name, el('p', 'atime', 'Status: ' + a.status + '. Tap the name to see their profile.'));
    if (a.status === 'pending') {
      const btns = el('div', 'arow');
      const yes = el('button', 'btn small', 'Accept');
      const no = el('button', 'btn small ghost', 'Decline');
      yes.onclick = () => respond(b, a.id, true);
      no.onclick = () => respond(b, a.id, false);
      btns.append(yes, no);
      row.append(btns);
    }
    list.append(row);
  });
}

async function respond(b, appId, accept) {
  const { error } = await db.rpc('respond_to_application', { app_id: appId, accept });
  if (error) return say($('a-msg'), error.message);
  await renderApplicants(b);
  if (accept) say($('a-msg'), 'Accepted. Their Instagram is now in your Activity tab.', true);
}

// ---------- 10. MY PROFILE (preview, edit, Spotify) ----------
const editInterests = new Set();

function makeChips(box, set) {
  box.replaceChildren();
  INTERESTS.forEach((name) => {
    const b = el('button', 'chip' + (set.has(name) ? ' on' : ''), name);
    b.type = 'button';
    b.onclick = () => { set.has(name) ? set.delete(name) : set.add(name); b.classList.toggle('on'); };
    box.append(b);
  });
}

async function renderProfileTab() {
  const p = me.profile;
  $('pv-preview').replaceChildren(buildCard(p, []));
  renderPhotoGrid();
  $('e-locality').innerHTML = $('locality').innerHTML;
  $('e-locality').value = p.locality;
  $('e-college').value = p.college || '';
  $('e-bio').value = p.bio || '';
  editInterests.clear();
  p.interests.forEach((i) => editInterests.add(i));
  makeChips($('e-chips'), editInterests);
  vibeStatus();
  const { data } = await db.from('private_contacts').select('instagram_handle').eq('user_id', me.user.id).maybeSingle();
  $('e-ig').value = data ? '@' + data.instagram_handle : '';
}

$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('e-msg');
  const ig = $('e-ig').value.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(ig)) return say(msg, 'Instagram handle can only have letters, numbers, . and _ .');
  if (!editInterests.size) return say(msg, 'Pick at least one interest.');
  $('e-btn').disabled = true;
  say(msg, 'Saving...', true);
  const r = await db.from('profiles').update({
    locality: $('e-locality').value,
    college: $('e-college').value.trim() || null,
    bio: $('e-bio').value.trim() || null,
    interests: [...editInterests],
  }).eq('id', me.user.id).select().single();
  const c = r.error ? null : await db.from('private_contacts').update({ instagram_handle: ig }).eq('user_id', me.user.id);
  $('e-btn').disabled = false;
  if (r.error) return say(msg, r.error.message);
  if (c.error) return say(msg, c.error.message);
  me.profile = r.data;
  $('pv-preview').replaceChildren(buildCard(me.profile, []));
  say(msg, 'Saved.', true);
});

function vibeStatus() {
  const t = me.profile.taste || {};
  const bits = [];
  const n = (me.profile.spotify_artists || []).length;
  if (n) bits.push(n + ' artists');
  if ((t.games || []).length) bits.push(t.games.length + ' games');
  if ((t.sports || []).length) bits.push(t.sports.length + ' sports');
  if (t.bikes && (t.bikes.fav || []).length) bits.push('bikes');
  $('vibe-status').textContent = bits.length
    ? 'You picked: ' + bits.join(', ') + '.'
    : 'Pick your music, games and sports so people can see what you have in common.';
}
$('vibe-btn').onclick = () => openTaste(false);

function openTaste(first) {
  Taste.open(me.profile, async (res) => {
    if (!res) {
      if (!first) return; // skipped while editing: change nothing
      res = { artists: [], genres: [], taste: { done: true } }; // skipped at the start: do not ask again
    }
    const { data, error } = await db.from('profiles')
      .update({ spotify_artists: res.artists, spotify_genres: res.genres, taste: res.taste })
      .eq('id', me.user.id).select().single();
    if (error) return alert('Could not save your vibe: ' + error.message);
    me.profile = data;
    renderProfileTab();
    loadDiscover();
  });
}

$('pv-bounties').onclick = () => { setBountyTab('mine', false); showTab('bounties'); };

// ---------- 11. FEED (posts with up to 3 photos) ----------
const POST_PREFIX = SUPABASE_URL + '/storage/v1/object/public/post-images/';
const MAX_PHOTOS = 3;
let postPhotos = [];   // photos waiting to be posted: { blob, url }
let feedRows = [];
let feedMore = false;

function timeAgo(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}

// Shrinks a phone photo to about 1280px wide. Re-saving it this way also removes hidden data like GPS location.
const MAX_PHOTO_MB = 10; // biggest photo someone can pick; it is shrunk before upload
async function shrinkPhoto(file, maxSide = 1280) {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a photo.');
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) throw new Error('That photo is over ' + MAX_PHOTO_MB + ' MB.');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('Could not read that photo. Try a JPG or PNG.'); }
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process that photo.'))), 'image/jpeg', 0.82));
}

function renderPreviews() {
  const box = $('p-previews');
  box.replaceChildren();
  postPhotos.forEach((p, i) => {
    const wrap = el('div', 'pv');
    const im = el('img');
    im.src = p.url;
    im.alt = 'Photo ' + (i + 1) + ' to post';
    const x = el('button', '', '\u00d7');
    x.type = 'button';
    x.setAttribute('aria-label', 'Remove photo ' + (i + 1));
    x.onclick = () => { URL.revokeObjectURL(p.url); postPhotos.splice(i, 1); renderPreviews(); };
    wrap.append(im, x);
    box.append(wrap);
  });
  $('p-add').disabled = postPhotos.length >= MAX_PHOTOS;
}

$('p-add').onclick = () => $('p-files').click();
$('p-files').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  const room = MAX_PHOTOS - postPhotos.length;
  say($('p-msg'), files.length > room ? 'You can add up to 3 photos.' : '');
  for (const f of files.slice(0, room)) {
    try {
      const blob = await shrinkPhoto(f);
      postPhotos.push({ blob, url: URL.createObjectURL(blob) });
    } catch (err) { say($('p-msg'), err.message); }
  }
  renderPreviews();
};
$('p-body').addEventListener('input', () => { $('p-count').textContent = $('p-body').value.length + ' / 500'; });

$('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('p-msg');
  const text = $('p-body').value.trim();
  if (!text && !postPhotos.length) return say(msg, 'Write something or add a photo.');
  $('p-btn').disabled = true;
  say(msg, postPhotos.length ? 'Uploading...' : 'Posting...', true);
  const paths = [];
  try {
    for (const p of postPhotos) {
      const path = me.user.id + '/' + crypto.randomUUID() + '.jpg';
      const up = await db.storage.from('post-images').upload(path, p.blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      paths.push(path);
    }
    const images = paths.map((p) => db.storage.from('post-images').getPublicUrl(p).data.publicUrl);
    const { error } = await db.from('posts').insert({ author_id: me.user.id, body: text || null, images });
    if (error) throw error;
  } catch (err) {
    if (paths.length) db.storage.from('post-images').remove(paths); // do not leave orphan photos behind
    $('p-btn').disabled = false;
    return say(msg, 'Could not post: ' + (err.message || err));
  }
  $('p-btn').disabled = false;
  postPhotos.forEach((p) => URL.revokeObjectURL(p.url));
  postPhotos = [];
  $('post-form').reset();
  $('p-count').textContent = '0 / 500';
  renderPreviews();
  say(msg, '');
  loadFeed();
});

async function loadFeed(more = false) {
  const msg = $('fmsg');
  if (!more) say(msg, 'Loading...', true);
  const older = more && feedRows.length ? feedRows[feedRows.length - 1].created_at : null;
  const { data, error } = await db.rpc('get_feed', { lim: 20, older_than: older });
  if (error) return say(msg, 'Could not load the feed: ' + error.message);
  feedRows = more ? feedRows.concat(data) : data;
  feedMore = data.length === 20;
  try {
    renderFeed();
    say(msg, '');
  } catch (err) {
    say(msg, 'Could not show the feed: ' + err.message);
  }
}
$('f-more').onclick = () => loadFeed(true);

function renderFeed() {
  const list = $('flist');
  list.replaceChildren();
  if (!feedRows.length) list.append(el('p', 'empty', 'No posts yet. Be the first to share something!'));
  feedRows.forEach((r) => list.append(postCard(r)));
  $('f-more').classList.toggle('hidden', !feedMore);
}

function postCard(r) {
  const own = r.author_id === me.user.id;
  const c = el('article', 'post');
  const head = el('div', 'post-head');
  const av = el('img', 'bavatar');
  av.alt = '';
  if (r.author_avatar && r.author_avatar.startsWith(AVATAR_PREFIX)) av.src = r.author_avatar;
  const who = el('button', 'post-who');
  who.type = 'button';
  who.append(el('strong', '', r.author_name + ', ' + r.author_age), el('div', 'atime', r.author_locality + ' - ' + timeAgo(r.created_at)));
  if (own) who.disabled = true; else who.onclick = () => viewProfile(r.author_id);
  head.append(av, who);
  c.append(head);
  if (r.body) c.append(el('p', 'post-body', r.body));
  const imgs = (r.images || []).filter((u) => typeof u === 'string' && u.startsWith(POST_PREFIX)).slice(0, MAX_PHOTOS);
  if (imgs.length) {
    const grid = el('div', 'post-imgs n' + imgs.length);
    imgs.forEach((u) => { const im = el('img'); im.src = u; im.alt = 'Photo in post'; im.loading = 'lazy'; grid.append(im); });
    c.append(grid);
  }
  const row = el('div', 'arow');
  const btn = el('button', 'btn small ghost', own ? 'Delete' : 'Report');
  btn.onclick = () => (own ? deletePost(r) : reportPost(r));
  row.append(btn);
  c.append(row);
  return c;
}

async function deletePost(r) {
  if (!confirm('Delete this post?')) return;
  const { error } = await db.from('posts').delete().eq('id', r.id);
  if (error) return say($('fmsg'), 'Could not delete: ' + error.message);
  const paths = (r.images || []).filter((u) => u.startsWith(POST_PREFIX)).map((u) => u.slice(POST_PREFIX.length));
  if (paths.length) db.storage.from('post-images').remove(paths);
  loadFeed();
}

async function reportPost(r) {
  const reason = prompt('What is wrong with this post? (3 to 400 characters)');
  if (!reason || reason.trim().length < 3) return;
  const { error } = await db.from('reports').insert({
    reporter_id: me.user.id, reported_id: r.author_id,
    reason: ('Post ' + r.id + ': ' + reason.trim().slice(0, 400)),
  });
  alert(error ? 'Could not send report: ' + error.message : 'Report sent. Thank you.');
}

// ---------- 12. YOUR PHOTOS (up to 5) ----------
const MAX_PROFILE_PHOTOS = 5;

// Shrinks each photo, uploads it to your own folder, and returns the public links.
async function uploadProfilePhotos(files, uid, pathsOut) {
  const urls = [];
  for (const f of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw new Error('Photos must be JPG, PNG or WEBP.');
    const blob = await shrinkPhoto(f, 1600);
    const path = uid + '/photo-' + crypto.randomUUID() + '.jpg';
    const up = await db.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    pathsOut.push(path);
    urls.push(db.storage.from('avatars').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function savePhotos(list) {
  const { data, error } = await db.from('profiles')
    .update({ photos: list, avatar_url: list[0] || null }).eq('id', me.user.id).select().single();
  if (error) throw error;
  me.profile = data;
}

function renderPhotoGrid() {
  const grid = $('ph-grid');
  const list = photoList(me.profile);
  grid.replaceChildren();
  list.forEach((u, i) => {
    const box = el('div', 'ph');
    const im = el('img');
    im.src = u;
    im.alt = 'Your photo ' + (i + 1);
    box.append(im);
    const x = el('button', 'x', '\u00d7');
    x.type = 'button';
    x.setAttribute('aria-label', 'Remove photo ' + (i + 1));
    x.onclick = () => removePhoto(u);
    box.append(x);
    if (i === 0) {
      box.append(el('span', 'main', 'Main'));
    } else {
      const set = el('button', 'main ph-set', 'Make main');
      set.type = 'button';
      set.onclick = () => makeMain(u);
      box.append(set);
    }
    grid.append(box);
  });
  $('ph-add').disabled = list.length >= MAX_PROFILE_PHOTOS;
}

async function photosChanged() {
  renderPhotoGrid();
  $('pv-preview').replaceChildren(buildCard(me.profile, []));
}

async function removePhoto(url) {
  const list = photoList(me.profile);
  if (list.length <= 1) return say($('ph-msg'), 'Keep at least one photo.');
  try {
    await savePhotos(list.filter((u) => u !== url));
  } catch (err) { return say($('ph-msg'), 'Could not remove it: ' + err.message); }
  say($('ph-msg'), '');
  const path = decodeURIComponent(url.slice(AVATAR_PREFIX.length).split('?')[0]);
  db.storage.from('avatars').remove([path]);
  photosChanged();
}

async function makeMain(url) {
  const list = photoList(me.profile);
  try {
    await savePhotos([url, ...list.filter((u) => u !== url)]);
  } catch (err) { return say($('ph-msg'), 'Could not change it: ' + err.message); }
  say($('ph-msg'), '');
  photosChanged();
}

$('ph-add').onclick = () => $('ph-files').click();
$('ph-files').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  const have = photoList(me.profile);
  const room = MAX_PROFILE_PHOTOS - have.length;
  if (!files.length) return;
  const msg = $('ph-msg');
  say(msg, files.length > room ? 'Only the first ' + room + ' were added (5 photos max). Uploading...' : 'Uploading...', true);
  const paths = [];
  try {
    const urls = await uploadProfilePhotos(files.slice(0, Math.max(room, 0)), me.user.id, paths);
    await savePhotos([...have, ...urls]);
  } catch (err) {
    if (paths.length) db.storage.from('avatars').remove(paths);
    return say(msg, 'Could not add photos: ' + (err.message || err));
  }
  say(msg, '');
  photosChanged();
};

// ---------- START ----------
setMode(false);
route();
