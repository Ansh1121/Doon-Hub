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

// ---------- START ----------
setMode(false);
route();
