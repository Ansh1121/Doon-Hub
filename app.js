// ---------- 1. SETTINGS ----------
const SUPABASE_URL = 'https://xmdhxbsxzntzpekyqzui.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aDgiMnlQf3FHrxmh6jaQ0A_5U7N7Zaz'; // publishable key: safe to be public
const FAKE_EMAIL_DOMAIN = 'doonvibes.app'; // users never see this; no email is ever sent
const INTERESTS = ['Cafes', 'Thrifting', 'Gaming', 'Drives', 'Anime', 'Music', 'Sports', 'Movies', 'Travel', 'Art'];

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

let signupMode = false;
let me = null; // { user, profile }
const picked = new Set();

// ---------- 2. SMALL HELPERS ----------
function showScreen(name) {
  ['auth', 'onboarding', 'app'].forEach((s) => $(s).classList.toggle('hidden', s !== name));
}
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
    showScreen('auth');
    return say($('auth-msg'), 'Could not load your profile: ' + error.message);
  }
  me = { user: session.user, profile };

  if (!profile) {
    buildChips();
    return showScreen('onboarding');
  }
  $('hello').textContent = 'Hi, ' + profile.name;
  showScreen('app');
  loadDiscover();
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
  try {
    // a) upload photo into your own folder
    const file = $('photo').files[0];
    if (file.size > 2 * 1024 * 1024) throw new Error('Photo must be under 2 MB.');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
    if (!ext) throw new Error('Photo must be JPG, PNG or WEBP.');
    const path = `${uid}/avatar.${ext}`;
    const up = await db.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) throw up.error;
    const avatar_url = db.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();

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
    say(msg, err.message || 'Something went wrong. Try again.');
  }
  $('ob-btn').disabled = false;
});

// ---------- 6. TABS AND LOG OUT ----------
document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'view-' + btn.dataset.tab));
  };
});
$('logout').onclick = async () => {
  await db.auth.signOut();
  me = null;
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
    .sort((x, y) => y.shared.length - x.shared.length); // most shared interests first
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
  const card = el('article', 'pcard');
  const img = el('img', 'pphoto');
  img.alt = 'Photo of ' + p.name;
  if (p.avatar_url && p.avatar_url.startsWith(AVATAR_PREFIX)) img.src = p.avatar_url;

  const body = el('div', 'pbody');
  body.append(el('h3', '', `${p.name}, ${p.age}`));
  body.append(el('p', 'ploc', p.college ? `${p.locality}, ${p.college}` : p.locality));
  if (p.bio) body.append(el('p', 'pbio', p.bio));
  const chips = el('div', 'chips');
  [...shared, ...p.interests.filter((i) => !shared.includes(i))].forEach((i) =>
    chips.append(el('span', 'tag' + (shared.includes(i) ? ' shared' : ''), i)));
  body.append(chips);
  if (shared.length) body.append(el('p', 'pshared', 'You both like ' + shared.join(', ')));

  card.append(img, body);
  attachDrag(card);
  stage.append(card);
}

function attachDrag(card) {
  card.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX };
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
    drag = null;
    card.classList.remove('drag');
    if (Math.abs(dx) > 110) swipe(dx > 0);
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
  if (e.key === 'Escape') return $('match').classList.add('hidden');
  const onDiscover = !$('app').classList.contains('hidden') && !$('view-discover').classList.contains('hidden');
  if (!onDiscover || !$('match').classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') swipe(false);
  if (e.key === 'ArrowRight') swipe(true);
});

// ---------- START ----------
setMode(false);
route();
