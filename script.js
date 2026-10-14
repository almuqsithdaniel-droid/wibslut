/* Paviliun Mahjong – permainan simulasi. Semua chip virtual, tanpa uang asli. */
'use strict';

/* ---------- State & penyimpanan ---------- */
const KEY = 'paviliunMahjong_v1';
const START_BALANCE = 1000;
const BONUS_AMOUNT = 500;
const BONUS_COOLDOWN = 24 * 60 * 60 * 1000;

const TOPUP_MAX = 100000;
const defaults = { balance: START_BALANCE, best: START_BALANCE, played: 0, won: 0, history: [], ledger: [], topup: 0, lastBonus: 0, slotSet: 'mahjong' };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const st = Object.assign({}, defaults, saved || {});
    st.history = (st.history || []).slice();
    st.ledger = (st.ledger || []).slice();
    return st;
  } catch (e) {
    return Object.assign({}, defaults, { history: [], ledger: [] });
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* abaikan */ }
}

let S = load();

/* ---------- Util ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => Math.round(n).toLocaleString('id-ID');
const rand = (n) => Math.floor(Math.random() * n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function setResult(sel, text, kind) {
  const el = $(sel);
  el.textContent = text;
  el.classList.remove('win', 'lose');
  if (kind) el.classList.add(kind);
}

/* ---------- Dompet, taruhan, riwayat ---------- */
function render() {
  const bal = $('#balance');
  bal.textContent = fmt(S.balance);
  bal.classList.remove('bump');
  void bal.offsetWidth;
  bal.classList.add('bump');

  $('#statPlayed').textContent = fmt(S.played);
  $('#statWon').textContent = fmt(S.won);
  $('#statRate').textContent = S.played ? Math.round((S.won / S.played) * 100) + '%' : '0%';
  $('#statBest').textContent = fmt(S.best);
  $('#walletBalance').textContent = fmt(S.balance);
  $('#statTopup').textContent = fmt(S.topup);

  const led = $('#ledger');
  led.innerHTML = '';
  if (!S.ledger.length) {
    led.innerHTML = '<li class="empty">Belum ada mutasi.</li>';
  } else {
    S.ledger.forEach((e) => {
      const li = document.createElement('li');
      const time = new Date(e.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const sign = e.amount >= 0 ? '+' : '−';
      li.innerHTML = `<span class="led-main">${e.type}<small>${time} · saldo ${fmt(e.balance)}</small></span>` +
        `<span class="${e.amount >= 0 ? 'plus' : 'minus'}">${sign}${fmt(Math.abs(e.amount))}</span>`;
      led.appendChild(li);
    });
  }

  const list = $('#history');
  list.innerHTML = '';
  if (!S.history.length) {
    list.innerHTML = '<li class="empty">Belum ada ronde.</li>';
  } else {
    S.history.forEach((h) => {
      const li = document.createElement('li');
      const net = h.payout - h.bet;
      const sign = net >= 0 ? '+' : '−';
      li.innerHTML = `<span>${h.game}</span><span class="${net >= 0 ? 'plus' : 'minus'}">${sign}${fmt(Math.abs(net))}</span>`;
      list.appendChild(li);
    });
  }

  updateBonusButton();
}

function getBet() {
  const input = $('#betInput');
  const bet = Math.floor(Number(input.value));
  if (!bet || bet < 1) { toast('Masukkan taruhan minimal 1 chip.'); return 0; }
  if (bet > S.balance) { toast('Saldo tidak cukup untuk taruhan ini.'); return 0; }
  return bet;
}

function addLedger(type, amount) {
  S.ledger.unshift({ type, amount, balance: S.balance, t: Date.now() });
  S.ledger = S.ledger.slice(0, 40);
}

function takeBet(amount) {
  S.balance -= amount;
  addLedger('Taruhan', -amount);
  save();
  render();
}

function settle(game, bet, payout) {
  S.balance += payout;
  if (payout > 0) addLedger('Kemenangan ' + game, payout);
  S.played += 1;
  if (payout > bet) S.won += 1;
  if (S.balance > S.best) S.best = S.balance;
  S.history.unshift({ game, bet, payout });
  S.history = S.history.slice(0, 25);
  save();
  render();
  checkBroke();
}

function checkBroke() {
  if (S.balance < 1) {
    toast('Chip habis. Klaim bonus harian atau mulai ulang di panel Pengaturan.');
  }
}

/* Tombol nominal cepat */
$$('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $('#betInput');
    const v = btn.dataset.bet;
    const cur = Math.floor(Number(input.value)) || 0;
    if (v === 'half') input.value = Math.max(1, Math.floor(cur / 2));
    else if (v === 'double') input.value = Math.min(S.balance, Math.max(1, cur * 2));
    else if (v === 'max') input.value = Math.max(1, S.balance);
    else input.value = Math.min(Number(v), Math.max(1, S.balance));
  });
});

/* Bonus harian */
function updateBonusButton() {
  const btn = $('#btnBonus');
  const remain = S.lastBonus + BONUS_COOLDOWN - Date.now();
  if (remain > 0) {
    const h = Math.floor(remain / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    btn.disabled = true;
    btn.textContent = `Bonus lagi ${h} j ${m} m`;
  } else {
    btn.disabled = false;
    btn.textContent = `Klaim bonus harian (+${fmt(BONUS_AMOUNT)})`;
  }
}
$('#btnBonus').addEventListener('click', () => {
  if (Date.now() < S.lastBonus + BONUS_COOLDOWN) return;
  S.lastBonus = Date.now();
  S.balance += BONUS_AMOUNT;
  if (S.balance > S.best) S.best = S.balance;
  addLedger('Bonus harian', BONUS_AMOUNT);
  save();
  render();
  toast(`Bonus ${fmt(BONUS_AMOUNT)} chip masuk ke saldo.`);
});
setInterval(updateBonusButton, 30000);

/* Reset */
$('#btnReset').addEventListener('click', () => {
  if (autoRunning) { toast('Hentikan putar otomatis dulu.'); return; }
  if (!confirm('Mulai ulang? Saldo, statistik, dan riwayat akan dihapus.')) return;
  S = Object.assign({}, defaults, { history: [], ledger: [] });
  save();
  render();
  toast('Permainan dimulai ulang dengan 1.000 chip.');
});

/* Tab permainan */
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (busy || autoRunning) { toast('Selesaikan ronde atau hentikan putar otomatis dulu.'); return; }
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $$('.game').forEach((g) => g.classList.remove('active'));
    tab.classList.add('active');
    $('#game-' + tab.dataset.game).classList.add('active');
  });
});

let busy = false; // true saat ronde berlangsung

/* ======================================================
   SLOT
   ====================================================== */
/* Set item slot. Urutan item: dari bayaran terkecil ke terbesar. */
const SLOT_WEIGHTS = [6, 5, 4, 3, 2, 1];
const SLOT_PAYS = [5, 8, 10, 15, 25, 50];
const SLOT_SETS = {
  mahjong: { name: 'Ubin Mahjong', items: ['筒', '索', '萬', '東', '發', '中'] },
  harta:   { name: 'Harta Karun',  items: ['🪙', '🏺', '📜', '💍', '💎', '👑'] },
  zodiak:  { name: 'Zodiak Cina',  items: ['🐭', '🐰', '🐍', '🐯', '🐴', '🐉'] },
  buah:    { name: 'Buah Klasik',  items: ['🍒', '🍋', '🍉', '🔔', '⭐', '7️⃣'] }
};

let SLOT_POOL = [];
let SLOT_PAY = {};

function setReel(el, sym) {
  el.textContent = sym;
  el.dataset.sym = sym;
}

let autoRunning = false;
let autoStopRequested = false;
const AUTO_MAX = 500;

async function spinOnce(fast) {
  if (busy) return null;
  const bet = getBet();
  if (!bet) return null;
  busy = true;
  takeBet(bet);
  $('#btnSpin').disabled = true;
  setResult('#slotsResult', 'Berputar…');

  const reels = $$('#reels .reel');
  const final = [SLOT_POOL[rand(SLOT_POOL.length)], SLOT_POOL[rand(SLOT_POOL.length)], SLOT_POOL[rand(SLOT_POOL.length)]];
  const stopAt = fast ? [200, 320, 440] : [700, 1100, 1500];
  const tick = fast ? 50 : 70;
  const start = Date.now();

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      reels.forEach((r, i) => {
        if (elapsed < stopAt[i]) {
          r.classList.add('spinning');
          setReel(r, SLOT_POOL[rand(SLOT_POOL.length)]);
        } else {
          r.classList.remove('spinning');
          setReel(r, final[i]);
        }
      });
      if (elapsed >= stopAt[2]) { clearInterval(timer); resolve(); }
    }, tick);
  });

  let payout = 0;
  const triple = final[0] === final[1] && final[1] === final[2];
  if (triple) {
    payout = bet * SLOT_PAY[final[0]];
    setResult('#slotsResult', `Tiga item ${final[0]}! Menang ${fmt(payout)} chip.`, 'win');
  } else if (final[0] === final[1] || final[1] === final[2]) {
    payout = Math.floor(bet * 1.5);
    setResult('#slotsResult', `Dua item sama. Menang ${fmt(payout)} chip.`, 'win');
  } else {
    setResult('#slotsResult', 'Belum beruntung. Coba lagi.', 'lose');
  }
  settle('Slot', bet, payout);
  $('#btnSpin').disabled = autoRunning;
  busy = false;
  return { bet, payout, triple };
}

$('#btnSpin').addEventListener('click', () => { spinOnce(false); });

/* ---------- Putar otomatis ---------- */
function setAutoUI(on) {
  $('#btnSpin').disabled = on;
  $$('.auto-btn').forEach((b) => { b.disabled = on; });
  ['#autoCustom', '#autoLossLimit', '#autoStopJackpot', '#betInput', '#slotSet'].forEach((sel) => { $(sel).disabled = on; });
  $$('.chip').forEach((c) => { c.disabled = on; });
  $('#btnAutoStop').hidden = !on;
}

async function runAuto(count) {
  if (autoRunning || busy) return;
  count = Math.floor(Number(count));
  if (!count || count < 1) { toast('Masukkan jumlah putaran minimal 1.'); return; }
  if (count > AUTO_MAX) { toast(`Maksimal ${AUTO_MAX} putaran otomatis.`); return; }
  if (!getBet()) return;

  const lossLimit = Math.floor(Number($('#autoLossLimit').value)) || 0;
  const stopOnTriple = $('#autoStopJackpot').checked;

  autoRunning = true;
  autoStopRequested = false;
  setAutoUI(true);

  let done = 0, net = 0, reason = 'Selesai.';
  while (done < count) {
    if (autoStopRequested) { reason = 'Dihentikan olehmu.'; break; }
    const bet = Math.floor(Number($('#betInput').value)) || 0;
    if (bet < 1 || bet > S.balance) { reason = 'Saldo tidak cukup untuk taruhan berikutnya.'; break; }

    const r = await spinOnce(true);
    if (!r) { reason = 'Putaran tidak bisa dilanjutkan.'; break; }
    done++;
    net += r.payout - r.bet;
    $('#autoStatus').textContent = `Putar otomatis: ${done} dari ${count}`;

    if (stopOnTriple && r.triple) { reason = 'Berhenti karena tiga item sama.'; break; }
    if (lossLimit > 0 && -net >= lossLimit) { reason = 'Batas rugi tercapai.'; break; }
    await sleep(400);
  }

  autoRunning = false;
  setAutoUI(false);
  const sign = net >= 0 ? '+' : '−';
  const msg = `${done} putaran, hasil bersih ${sign}${fmt(Math.abs(net))} chip. ${reason}`;
  $('#autoStatus').textContent = msg;
  toast(msg);
}

$$('[data-auto]').forEach((b) => {
  b.addEventListener('click', () => runAuto(b.dataset.auto));
});
$('#autoCustomBtn').addEventListener('click', () => runAuto($('#autoCustom').value));
$('#autoCustom').addEventListener('keydown', (e) => { if (e.key === 'Enter') runAuto($('#autoCustom').value); });
$('#btnAutoStop').addEventListener('click', () => {
  autoStopRequested = true;
  toast('Putar otomatis berhenti setelah putaran ini.');
});

/* ======================================================
   BLACKJACK
   ====================================================== */
const SUITS = ['萬', '筒', '索', '東'];
const SUIT_CLASS = { '萬': 's-wan', '筒': 's-tong', '索': 's-sok', '東': 's-dong' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const bj = { deck: [], player: [], dealer: [], bet: 0, active: false };

function newDeck() {
  const d = [];
  SUITS.forEach((s) => RANKS.forEach((r) => d.push({ r, s })));
  for (let i = d.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function cardValue(c) {
  if (c.r === 'A') return 11;
  if ('JQK'.includes(c.r) || c.r === '10') return 10;
  return Number(c.r);
}
function handTotal(hand) {
  let total = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces = hand.filter((c) => c.r === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function cardEl(c, hidden) {
  const el = document.createElement('div');
  if (hidden) { el.className = 'card back'; return el; }
  el.className = 'card ' + SUIT_CLASS[c.s];
  el.innerHTML = `<span class="rank">${c.r}</span><span class="suit">${c.s}</span>`;
  return el;
}
function renderBJ(hideDealer) {
  const dh = $('#dealerHand'), ph = $('#playerHand');
  dh.innerHTML = ''; ph.innerHTML = '';
  bj.dealer.forEach((c, i) => dh.appendChild(cardEl(c, hideDealer && i === 1)));
  bj.player.forEach((c) => ph.appendChild(cardEl(c, false)));
  $('#dealerTotal').textContent = bj.dealer.length ? (hideDealer ? `(${cardValue(bj.dealer[0]) === 11 ? 11 : cardValue(bj.dealer[0])})` : `(${handTotal(bj.dealer)})`) : '';
  $('#playerTotal').textContent = bj.player.length ? `(${handTotal(bj.player)})` : '';
}
function setBJButtons(playing) {
  $('#bjDeal').disabled = playing;
  $('#bjHit').disabled = !playing;
  $('#bjStand').disabled = !playing;
  $('#bjDouble').disabled = !(playing && bj.player.length === 2 && S.balance >= bj.bet);
}

function bjFinish(outcome) {
  // outcome: 'blackjack' | 'win' | 'push' | 'lose'
  bj.active = false;
  busy = false;
  renderBJ(false);
  setBJButtons(false);
  let payout = 0;
  if (outcome === 'blackjack') { payout = Math.floor(bj.bet * 2.5); setResult('#bjResult', `Blackjack! Menang ${fmt(payout - bj.bet)} chip.`, 'win'); }
  else if (outcome === 'win') { payout = bj.bet * 2; setResult('#bjResult', `Kamu menang ${fmt(bj.bet)} chip.`, 'win'); }
  else if (outcome === 'push') { payout = bj.bet; setResult('#bjResult', 'Seri. Taruhan dikembalikan.'); }
  else { setResult('#bjResult', 'Dealer menang. Coba lagi.', 'lose'); }
  settle('Blackjack', bj.bet, payout);
}

function dealerPlay() {
  while (handTotal(bj.dealer) < 17) bj.dealer.push(bj.deck.pop());
  const p = handTotal(bj.player), d = handTotal(bj.dealer);
  if (d > 21 || p > d) bjFinish('win');
  else if (p === d) bjFinish('push');
  else bjFinish('lose');
}

$('#bjDeal').addEventListener('click', () => {
  if (busy) return;
  const bet = getBet();
  if (!bet) return;
  busy = true;
  bj.bet = bet;
  takeBet(bet);
  bj.deck = newDeck();
  bj.player = [bj.deck.pop(), bj.deck.pop()];
  bj.dealer = [bj.deck.pop(), bj.deck.pop()];
  bj.active = true;
  setResult('#bjResult', 'Giliranmu: tambah ubin, berhenti, atau gandakan.');
  const pBJ = handTotal(bj.player) === 21;
  const dBJ = handTotal(bj.dealer) === 21;
  if (pBJ || dBJ) {
    renderBJ(false);
    if (pBJ && dBJ) bjFinish('push');
    else if (pBJ) bjFinish('blackjack');
    else bjFinish('lose');
    return;
  }
  renderBJ(true);
  setBJButtons(true);
});

$('#bjHit').addEventListener('click', () => {
  if (!bj.active) return;
  bj.player.push(bj.deck.pop());
  renderBJ(true);
  const t = handTotal(bj.player);
  if (t > 21) bjFinish('lose');
  else if (t === 21) dealerPlay();
  else setBJButtons(true);
});

$('#bjStand').addEventListener('click', () => {
  if (!bj.active) return;
  dealerPlay();
});

$('#bjDouble').addEventListener('click', () => {
  if (!bj.active || S.balance < bj.bet) return;
  takeBet(bj.bet);
  bj.bet *= 2;
  bj.player.push(bj.deck.pop());
  renderBJ(true);
  if (handTotal(bj.player) > 21) bjFinish('lose');
  else dealerPlay();
});

/* ======================================================
   DADU
   ====================================================== */
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
let diceChoice = 'low';

$$('[data-dice]').forEach((b) => {
  b.addEventListener('click', () => {
    if (busy) return;
    $$('[data-dice]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    diceChoice = b.dataset.dice;
  });
});

$('#btnRoll').addEventListener('click', async () => {
  if (busy) return;
  const bet = getBet();
  if (!bet) return;
  busy = true;
  takeBet(bet);
  $('#btnRoll').disabled = true;
  setResult('#diceResult', 'Dadu berguling…');

  const d1 = $('#die1'), d2 = $('#die2');
  d1.classList.add('rolling'); d2.classList.add('rolling');
  for (let i = 0; i < 10; i++) {
    d1.textContent = FACES[rand(6)];
    d2.textContent = FACES[rand(6)];
    await sleep(80);
  }
  d1.classList.remove('rolling'); d2.classList.remove('rolling');

  const a = rand(6), b = rand(6);
  d1.textContent = FACES[a];
  d2.textContent = FACES[b];
  const sum = a + b + 2;
  $('#diceSum').textContent = 'Jumlah: ' + sum;

  let payout = 0;
  if (diceChoice === 'low' && sum <= 6) payout = Math.floor(bet * 2.2);
  else if (diceChoice === 'high' && sum >= 8) payout = Math.floor(bet * 2.2);
  else if (diceChoice === 'seven' && sum === 7) payout = bet * 5;

  if (payout > 0) setResult('#diceResult', `Tebakan benar. Menang ${fmt(payout - bet)} chip.`, 'win');
  else setResult('#diceResult', 'Tebakan meleset. Coba lagi.', 'lose');

  settle('Dadu', bet, payout);
  $('#btnRoll').disabled = false;
  busy = false;
});

/* ======================================================
   ROULETTE
   ====================================================== */
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');
let roulChoice = 'red';

$$('[data-roul]').forEach((b) => {
  b.addEventListener('click', () => {
    if (busy) return;
    $$('[data-roul]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    roulChoice = b.dataset.roul;
    $('#numberPick').hidden = roulChoice !== 'number';
  });
});

$('#btnRoulette').addEventListener('click', async () => {
  if (busy) return;
  let pick = null;
  if (roulChoice === 'number') {
    pick = Math.floor(Number($('#roulNumber').value));
    if (isNaN(pick) || pick < 0 || pick > 36) { toast('Pilih angka antara 0 dan 36.'); return; }
  }
  const bet = getBet();
  if (!bet) return;
  busy = true;
  takeBet(bet);
  $('#btnRoulette').disabled = true;
  setResult('#roulResult', 'Roda berputar…');

  const wheel = $('#wheel'), label = $('#wheelNumber');
  const result = rand(37);
  for (let i = 0; i < 24; i++) {
    const n = rand(37);
    label.textContent = n;
    wheel.className = 'wheel ' + colorOf(n);
    await sleep(60 + i * 8);
  }
  label.textContent = result;
  wheel.className = 'wheel ' + colorOf(result);

  const col = colorOf(result);
  let payout = 0;
  if (roulChoice === 'red' && col === 'red') payout = bet * 2;
  else if (roulChoice === 'black' && col === 'black') payout = bet * 2;
  else if (roulChoice === 'odd' && result !== 0 && result % 2 === 1) payout = bet * 2;
  else if (roulChoice === 'even' && result !== 0 && result % 2 === 0) payout = bet * 2;
  else if (roulChoice === 'number' && result === pick) payout = bet * 36;

  const colName = { red: 'merah', black: 'hitam', green: 'hijau' }[col];
  if (payout > 0) setResult('#roulResult', `Keluar ${result} (${colName}). Menang ${fmt(payout - bet)} chip.`, 'win');
  else setResult('#roulResult', `Keluar ${result} (${colName}). Belum beruntung.`, 'lose');

  settle('Roulette', bet, payout);
  $('#btnRoulette').disabled = false;
  busy = false;
});

/* ======================================================
   ISI CHIP (virtual, gratis, tanpa pembayaran)
   ====================================================== */
function topUp(amount) {
  amount = Math.floor(Number(amount));
  if (!amount || amount < 1) { toast('Masukkan jumlah minimal 1 chip.'); return false; }
  if (amount > TOPUP_MAX) { toast(`Maksimal ${fmt(TOPUP_MAX)} chip per pengisian.`); return false; }
  S.balance += amount;
  S.topup += amount;
  if (S.balance > S.best) S.best = S.balance;
  addLedger('Isi chip', amount);
  save();
  render();
  toast(`${fmt(amount)} chip virtual ditambahkan ke saldo.`);
  return true;
}

const topupDialog = $('#topupDialog');
function openTopup() {
  $('#topupCustom').value = '';
  if (typeof topupDialog.showModal === 'function') topupDialog.showModal();
  else topupDialog.setAttribute('open', '');
}
function closeTopup() {
  if (typeof topupDialog.close === 'function') topupDialog.close();
  else topupDialog.removeAttribute('open');
}
$('#btnTopup').addEventListener('click', openTopup);
$('#btnTopup2').addEventListener('click', openTopup);
$('#topupClose').addEventListener('click', closeTopup);
topupDialog.addEventListener('click', (e) => { if (e.target === topupDialog) closeTopup(); });

$$('[data-topup]').forEach((b) => {
  b.addEventListener('click', () => { if (topUp(b.dataset.topup)) closeTopup(); });
});
$('#topupCustomBtn').addEventListener('click', () => {
  if (topUp($('#topupCustom').value)) closeTopup();
});
$('#topupCustom').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#topupCustomBtn').click();
});

function applySlotSet(key) {
  if (!SLOT_SETS[key]) key = 'mahjong';
  S.slotSet = key;
  const items = SLOT_SETS[key].items;

  SLOT_POOL = [];
  SLOT_PAY = {};
  items.forEach((sym, i) => {
    for (let n = 0; n < SLOT_WEIGHTS[i]; n++) SLOT_POOL.push(sym);
    SLOT_PAY[sym] = SLOT_PAYS[i];
  });

  const reels = $$('#reels .reel');
  reels.forEach((r, i) => setReel(r, items[i]));

  // Tabel pembayaran, dari bayaran terbesar
  const order = items.map((sym, i) => ({ sym, pay: SLOT_PAYS[i] })).reverse();
  const mini = (sym) => `<span class="mini" data-sym="${sym}">${sym}</span>`;
  let html = '<caption>Tabel pembayaran (tiga item sama)</caption>';
  for (let i = 0; i < order.length; i += 2) {
    const a = order[i], b = order[i + 1];
    html += `<tr><td>${mini(a.sym).repeat(3)}</td><td>${a.pay}×</td>` +
            `<td>${mini(b.sym).repeat(3)}</td><td>${b.pay}×</td></tr>`;
  }
  $('#paytable').innerHTML = html;

  $('#slotSet').value = key;
  setResult('#slotsResult', 'Tekan Putar untuk memulai.');
  save();
}

$('#slotSet').addEventListener('change', (e) => {
  if (busy || autoRunning) {
    e.target.value = S.slotSet;
    toast('Tunggu putaran selesai sebelum mengganti set item.');
    return;
  }
  applySlotSet(e.target.value);
  toast('Set item: ' + SLOT_SETS[S.slotSet].name);
});

/* ---------- Mulai ---------- */
applySlotSet(S.slotSet);
render();
