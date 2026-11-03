// Interactive pages. Everything saves in this browser's localStorage.

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem("jw:" + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("jw:" + key, JSON.stringify(value));
    } catch {}
  },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};
const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
};
const daysUntil = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
const fmtDate = (d) =>
  d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const money = (n, cur) =>
  n.toLocaleString(cur === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency: cur });
const whenText = (days) =>
  days === 0 ? "hoje!" : days === 1 ? "amanhã" : days > 0 ? `em ${days} dias` : days === -1 ? "ontem" : `há ${-days} dias`;
// Small stable tilt so stickers and post-its look hand-placed but don't jump on re-render.
const tilt = (seed, range = 6) => {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range;
};
const POSTIT_COLORS = ["yellow", "pink", "mint", "peach", "blue"];

/* ---------- frase do dia ---------- */

const QUOTES = [
  "devagar também é chegar.",
  "o que você planta hoje floresce no seu tempo.",
  "feito é melhor que perfeito.",
  "um passo pequeno ainda é um passo.",
  "você não precisa dar conta de tudo hoje. só do próximo.",
  "descanso também é produtivo.",
  "a versão de você daqui a um ano agradece o que você faz hoje.",
  "constância vence intensidade.",
  "você já passou por dias difíceis antes. e passou.",
  "cuida de você como cuida das suas plantas: com água, luz e paciência.",
  "não compara o seu capítulo 3 com o capítulo 20 de ninguém.",
  "coragem é fazer mesmo com medo.",
  "o caminho aparece quando você começa a andar.",
  "seja gentil com você. você tá aprendendo.",
  "hoje conta, mesmo que seja pouco.",
  "grandes coisas levam tempo, e tudo bem.",
  "a disciplina é uma forma de amor próprio.",
  "você é a pessoa certa pra fazer isso.",
  "progresso, não perfeição.",
  "respira. organiza. vai.",
  "o \"não\" você já tem. vai buscar o sim.",
  "faz por você, não pela plateia.",
  "um dia de cada vez, uma tarefa de cada vez.",
  "o seu ritmo é válido.",
  "o universo gosta de quem aparece.",
  "você pode recomeçar quantas vezes precisar.",
  "pequenas alegrias contam muito.",
  "confia no processo e no seu esforço.",
  "o difícil de hoje vira o fácil de amanhã.",
  "lembra por que você começou.",
  "você é muito mais capaz do que pensa.",
];

function renderQuote() {
  const node = document.getElementById("daily-quote");
  if (!node) return;
  const now = new Date();
  const dayOfYear = Math.round((startOfDay(now) - new Date(now.getFullYear(), 0, 1)) / DAY);
  node.textContent = "“" + QUOTES[(dayOfYear + now.getFullYear()) % QUOTES.length] + "”";
}

/* ---------- paydays ---------- */

// Each payday knows its next date on/after a day and its last date before a day.
const PAYDAYS = [
  {
    id: "job1",
    label: "job 1 · todo dia 10",
    next: (from) => {
      const d = new Date(from.getFullYear(), from.getMonth(), 10);
      return d < from ? new Date(from.getFullYear(), from.getMonth() + 1, 10) : d;
    },
    prev: (before) => {
      const d = new Date(before.getFullYear(), before.getMonth(), 10);
      return d < before ? d : new Date(before.getFullYear(), before.getMonth() - 1, 10);
    },
  },
  {
    id: "job2",
    label: "job 2 · a cada 2 semanas",
    // Anchor: paid Thursday, 29 Oct 2026.
    next: (from) => {
      const cycles = Math.max(0, Math.ceil(Math.round((from - new Date(2026, 9, 29)) / DAY) / 14));
      return new Date(2026, 9, 29 + cycles * 14);
    },
    prev: (before) => {
      const cycles = Math.ceil(Math.round((before - new Date(2026, 9, 29)) / DAY) / 14) - 1;
      return new Date(2026, 9, 29 + cycles * 14);
    },
  },
];
const paydayAmounts = store.get("payday-amounts", {});

function receivePayday(p, date, amount) {
  paydayAmounts[p.id] = amount;
  store.set("payday-amounts", paydayAmounts);
  const today = iso(new Date());
  const payDate = iso(date);
  tx.push({ id: uid(), date: payDate <= today ? payDate : today, desc: "payday · " + p.label.split(" · ")[0], kind: "in", cat: "", amount, cur: "USD", payday: p.id, payDate });
  saveFinance();
  renderFinance();
}

function renderPaydays() {
  const list = document.getElementById("paydays");
  if (!list) return;
  const today = startOfDay(new Date());
  const received = (p, d) => tx.find((t) => t.payday === p.id && t.payDate === iso(d));
  const receiveForm = (p, date, label) => {
    const amount = el("input", { type: "number", step: "0.01", min: "0", placeholder: "US$", value: paydayAmounts[p.id] ?? "", ariaLabel: "Valor recebido" });
    const btn = el("button", { type: "button", className: "receive", textContent: label });
    btn.addEventListener("click", () => {
      const n = parseFloat(amount.value);
      if (!(n > 0)) { amount.focus(); amount.classList.add("need"); return; }
      receivePayday(p, date, n);
    });
    return el("div", { className: "payday-receive" }, amount, btn);
  };
  list.replaceChildren(
    ...PAYDAYS.map((p) => {
      let date = p.next(today);
      const got = received(p, date);
      // Once this one is logged, the card moves on to the following payday.
      if (got) date = p.next(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
      const days = daysUntil(date);
      const status = days === 0 ? "today" : days <= 10 ? "approaching" : "upcoming";
      const li = el(
        "li",
        { className: "payday " + status },
        el("span", { className: "payday-label", textContent: p.label }),
        el("strong", { textContent: fmtDate(date) }),
        el("span", { className: "payday-when", textContent: whenText(days) }),
        el("span", { className: "payday-badge", textContent: status })
      );
      if (got) {
        const undo = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Desfazer recebido" });
        undo.addEventListener("click", () => { tx = tx.filter((t) => t !== got); saveFinance(); renderFinance(); });
        li.append(el("div", { className: "payday-got" }, el("span", { textContent: `recebido ✓ ${money(got.amount, "USD")} (${got.payDate.slice(8)}/${got.payDate.slice(5, 7)})` }), undo));
      } else {
        li.append(receiveForm(p, date, "recebido"));
      }
      // A recent payday that never got logged.
      const last = p.prev(today);
      if (!received(p, last) && daysUntil(last) >= -16) {
        li.append(el("div", { className: "payday-missed" },
          el("span", { textContent: `recebeu ${last.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}?` }),
          receiveForm(p, last, "registrar")));
      }
      return li;
    })
  );
}

/* ---------- dólar ↔ real ---------- */

const fx = { rate: null, history: [], dir: store.get("fx-dir", "usd-brl") };
// Used only until the live rate loads (or if it can't).
const FALLBACK_RATE = 5.4;
const rate = () => fx.rate || FALLBACK_RATE;
const toUSD = (amount, cur) => (cur === "BRL" ? amount / rate() : amount);

async function loadFx() {
  try {
    const live = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL").then((r) => r.json());
    fx.rate = parseFloat(live.USDBRL.bid);
    fx.updated = new Date(parseInt(live.USDBRL.timestamp, 10) * 1000);
  } catch {}
  try {
    const start = iso(new Date(Date.now() - 365 * DAY));
    const hist = await fetch(`https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=BRL`).then((r) => r.json());
    fx.history = Object.values(hist.rates).map((r) => r.BRL);
  } catch {
    try {
      const hist = await fetch("https://economia.awesomeapi.com.br/json/daily/USD-BRL/260").then((r) => r.json());
      fx.history = hist.map((d) => parseFloat(d.bid)).reverse();
    } catch {}
  }
  if (fx.rate == null && fx.history.length) fx.rate = fx.history[fx.history.length - 1];
  renderFx();
  renderFinance();
}

function renderFx() {
  const rateEl = document.getElementById("fx-rate");
  if (!rateEl) return;
  document.querySelectorAll(".fx-toggle button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.dir === fx.dir))
  );
  const sellingUsd = fx.dir === "usd-brl";
  const updated = document.getElementById("fx-updated");
  if (fx.rate == null) {
    rateEl.textContent = "—";
    updated.textContent = "não consegui buscar a cotação agora. tenta recarregar.";
    return;
  }
  rateEl.textContent = (sellingUsd ? fx.rate : 1 / fx.rate).toFixed(4);
  document.getElementById("fx-unit").textContent = sellingUsd ? "R$ por US$ 1" : "US$ por R$ 1";
  updated.textContent = fx.updated
    ? "atualizado " + fx.updated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";

  const h = fx.history;
  const verdict = document.getElementById("fx-verdict");
  const stats = document.getElementById("fx-stats");
  if (h.length > 20) {
    const below = h.filter((v) => v < fx.rate).length / h.length;
    const avg = h.reduce((a, b) => a + b, 0) / h.length;
    const last30 = h.slice(-22);
    const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length;
    // Selling USD wants a high USD/BRL; buying USD wants a low one.
    const score = sellingUsd ? below : 1 - below;
    const [cls, text] =
      score >= 0.66 ? ["good", "bom momento"] : score <= 0.33 ? ["bad", "momento ruim"] : ["meh", "na média"];
    verdict.className = "fx-verdict " + cls;
    verdict.textContent = `${text} pra ${sellingUsd ? "converter dólar em real" : "converter real em dólar"}`;
    stats.replaceChildren(
      el("dt", { textContent: "vs. último ano" }),
      el("dd", { textContent: `dólar mais caro que em ${Math.round(below * 100)}% dos dias` }),
      el("dt", { textContent: "média 1 ano" }),
      el("dd", { textContent: "R$ " + avg.toFixed(4) }),
      el("dt", { textContent: "média 30 dias" }),
      el("dd", { textContent: "R$ " + avg30.toFixed(4) }),
      el("dt", { textContent: "mín / máx" }),
      el("dd", { textContent: `R$ ${Math.min(...h).toFixed(2)} / R$ ${Math.max(...h).toFixed(2)}` })
    );
    drawFxChart(h, avg);
  } else {
    verdict.textContent = "sem histórico agora";
  }
  renderConvert();
}

function drawFxChart(h, avg) {
  const svg = document.getElementById("fx-chart");
  const min = Math.min(...h), max = Math.max(...h);
  const y = (v) => 76 - ((v - min) / (max - min || 1)) * 72;
  const pts = h.map((v, i) => `${((i / (h.length - 1)) * 300).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  svg.innerHTML =
    `<line x1="0" x2="300" y1="${y(avg)}" y2="${y(avg)}" class="avg" />` +
    `<polyline points="${pts}" class="line" />` +
    `<circle cx="300" cy="${y(fx.rate)}" r="3.5" class="now" />`;
}

function renderConvert() {
  const input = document.getElementById("fx-amount");
  const out = document.getElementById("fx-result");
  if (!input || fx.rate == null) return;
  const n = parseFloat(input.value) || 0;
  out.textContent =
    fx.dir === "usd-brl"
      ? `${money(n, "USD")} = ${money(n * fx.rate, "BRL")}`
      : `${money(n, "BRL")} = ${money(n / fx.rate, "USD")}`;
}

document.querySelectorAll(".fx-toggle button").forEach((b) =>
  b.addEventListener("click", () => {
    fx.dir = b.dataset.dir;
    store.set("fx-dir", fx.dir);
    renderFx();
  })
);
document.getElementById("fx-amount")?.addEventListener("input", renderConvert);

/* ---------- finance: data ---------- */

const BUCKETS = [
  { id: "lazer", label: "lazer", sticker: "🎡" },
  { id: "groceries", label: "groceries", sticker: "🥕" },
  { id: "treats", label: "eating out / treats", sticker: "🍰" },
  { id: "compras", label: "compras", sticker: "🛍️" },
  { id: "others", label: "others", sticker: "📎" },
];
const FIXED = { id: "fixed", label: "fixed expense" };

// Older versions kept an undated "ledger"; carry it over once.
let tx = store.get("tx", null);
if (!tx) {
  const today = iso(new Date());
  tx = store.get("ledger", []).map((r) => ({ ...r, date: today, cat: r.kind === "out" ? "others" : "" }));
  store.set("tx", tx);
}
// Two savings accounts (one in R$, one in US$) and three investment accounts in R$.
// Each account keeps its base balance in its own currency.
const DEFAULT_ACCOUNTS = [
  { id: "acc1", name: "savings R$", type: "savings", cur: "BRL", base: 0 },
  { id: "acc2", name: "savings US$", type: "savings", cur: "USD", base: 0 },
  { id: "acc3", name: "investimento 1", type: "invest", cur: "BRL", base: 0 },
  { id: "acc4", name: "investimento 2", type: "invest", cur: "BRL", base: 0 },
  { id: "acc5", name: "investimento 3", type: "invest", cur: "BRL", base: 0 },
];
let accounts = store.get("accounts", DEFAULT_ACCOUNTS);
// Older saves had three untyped "savings N" jars; give them the new shape, keeping any custom names.
if (accounts.some((a) => !a.type)) {
  accounts = DEFAULT_ACCOUNTS.map((d) => {
    const old = accounts.find((a) => a.id === d.id);
    return old ? { ...d, base: old.base || 0, name: /^savings \d$/.test(old.name) ? d.name : old.name } : d;
  });
  store.set("accounts", accounts);
}
let bills = store.get("bills", [
  { id: "rent", name: "rent", amount: 750, day: 1 },
  { id: "utilities", name: "utilities", amount: null, day: 15 },
  { id: "studyedge", name: "StudyEdge", amount: 50, day: null, auto: true, since: "2026-11" },
]);
// StudyEdge is on autopay; saved lists from before this flag existed get it once.
if (!store.get("bills-autopay", false)) {
  const se = bills.find((b) => b.id === "studyedge");
  if (se && se.auto === undefined) Object.assign(se, { auto: true, since: "2026-11" });
  store.set("bills-autopay", true);
  store.set("bills", bills);
}
const saveFinance = () => {
  store.set("tx", tx);
  store.set("accounts", accounts);
  store.set("bills", bills);
};

const fin = { offset: 0, view: store.get("fin-view", "month"), base: store.get("fin-base", "BRL") };
// Totals are kept in US$ internally; these show them in the chosen main currency (and the other one small).
const conv = (usd) => (fin.base === "BRL" ? usd * rate() : usd);
const show = (usd) => money(conv(usd), fin.base);
const showOther = (usd) => (fin.base === "BRL" ? money(usd, "USD") : money(usd * rate(), "BRL"));
// Manual starting points for the rolled-over balance: { "YYYY-MM": amount carried into that month }.
let rollover = store.get("rollover", {});
const selectedMonth = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + fin.offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthLabel = (key, opts = { month: "long", year: "numeric" }) =>
  parseIso(key + "-01").toLocaleDateString("pt-BR", opts).replace(".", "");
const shiftMonth = (key, n) => {
  const d = parseIso(key + "-01");
  const s = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}`;
};
const inMonth = (key) => tx.filter((t) => t.date.startsWith(key));
const sumUSD = (list) => list.reduce((a, t) => a + toUSD(t.amount, t.cur), 0);
const monthTotals = (key) => {
  const list = inMonth(key);
  const by = (k) => sumUSD(list.filter((t) => t.kind === k));
  const income = by("in"), out = by("out"), saved = by("savings");
  // net: didn't spend. left: what stays in the account after moving money to savings (this is what rolls over).
  return { income, out, saved, net: income - out, left: income - out - saved };
};
// What carried into a month: the latest manual start at/before it, plus every month's net since.
function carryIn(key) {
  const starts = Object.keys(rollover).filter((m) => m <= key).sort();
  let from, base;
  if (starts.length) {
    from = starts[starts.length - 1];
    base = rollover[from];
  } else {
    from = tx.map((t) => t.date.slice(0, 7)).sort()[0] || key;
    base = 0;
  }
  let total = base;
  for (let m = from; m < key; m = shiftMonth(m, 1)) total += monthTotals(m).left;
  return total;
}

// Date to file a new entry under: today if browsing this month, else the 1st of that month.
const entryDate = () => (fin.offset === 0 ? iso(new Date()) : selectedMonth() + "-01");
const catLabel = (t) => {
  if (t.kind === "savings") return accounts.find((a) => a.id === t.cat)?.name || "—";
  if (t.kind === "out") return t.cat === "fixed" ? FIXED.label : BUCKETS.find((b) => b.id === t.cat)?.label || "—";
  return "—";
};

const billDate = (bill, month) => `${month}-${pad(Math.min(bill.day || 1, 28))}`;

// Autopay bills log themselves as paid each month, from `since` up to the current month.
function applyAutopay() {
  const now = iso(new Date()).slice(0, 7);
  let changed = false;
  bills.filter((b) => b.auto && b.amount > 0).forEach((bill) => {
    for (let m = bill.since || now; m <= now; m = shiftMonth(m, 1)) {
      if ((bill.skip || []).includes(m)) continue;
      if (tx.some((t) => t.bill === bill.id && t.date.startsWith(m))) continue;
      tx.push({ id: uid(), date: billDate(bill, m), desc: bill.name, kind: "out", cat: "fixed", amount: bill.amount, cur: "USD", bill: bill.id });
      changed = true;
    }
  });
  if (changed) saveFinance();
}

function renderFinance() {
  if (!document.getElementById("finance")) return;
  applyAutopay();
  document.getElementById("fin-month").textContent = monthLabel(selectedMonth());
  renderPaydays();
  renderSummary();
  renderFinChart();
  renderSavings();
  renderBills();
  renderBuckets();
  renderLedger();
}

document.getElementById("fin-prev")?.addEventListener("click", () => { fin.offset--; renderFinance(); });
document.getElementById("fin-next")?.addEventListener("click", () => { fin.offset++; renderFinance(); });

/* ---------- finance: summary + chart ---------- */

function renderSummary() {
  const month = selectedMonth();
  const t = monthTotals(month);
  const rolled = fin.view === "rolled";
  const carry = carryIn(month);
  const tile = (label, value, cls, sticker, extra) =>
    el("div", { className: "stat " + cls },
      el("span", { className: "stat-sticker", textContent: sticker, ariaHidden: "true" }),
      el("span", { className: "stat-label", textContent: label }),
      el("strong", { textContent: (value < 0 ? "−" : "") + show(Math.abs(value)) }),
      el("small", { textContent: (value < 0 ? "−" : "") + showOther(Math.abs(value)) }),
      extra || "");
  const end = rolled ? carry + t.left : t.net;
  const tiles = [
    tile("entrou", t.income, "in", "💸"),
    tile("saiu", t.out, "out", "🧾"),
    tile("guardado", t.saved, "saved", "🐷"),
  ];
  if (rolled) {
    const edit = el("input", { type: "number", step: "0.01", value: Math.round(conv(carry) * 100) / 100, ariaLabel: "Valor que veio do mês passado" });
    edit.addEventListener("change", () => {
      const v = parseFloat(edit.value) || 0;
      rollover[month] = fin.base === "BRL" ? v / rate() : v;
      store.set("rollover", rollover);
      renderFinance();
    });
    const restart = el("button", { type: "button", textContent: "restart", title: "Começar este mês do zero" });
    restart.addEventListener("click", () => { rollover[month] = 0; store.set("rollover", rollover); renderFinance(); });
    const controls = el("div", { className: "carry-controls" }, el("label", {}, el("span", { textContent: "editar" }), edit), restart);
    if (month in rollover) {
      const auto = el("button", { type: "button", textContent: "automático", title: "Voltar a calcular a partir dos meses anteriores" });
      auto.addEventListener("click", () => { delete rollover[month]; store.set("rollover", rollover); renderFinance(); });
      controls.append(auto);
    }
    tiles.unshift(tile("veio do mês passado", carry, "carry", "↪️", controls));
  }
  tiles.push(tile(rolled ? "saldo acumulado" : end >= 0 ? "surplus" : "deficit", end, end >= 0 ? "surplus" : "deficit", end >= 0 ? "🌱" : "🌧️"));
  const box = document.getElementById("fin-summary");
  box.classList.toggle("rolled", rolled);
  box.replaceChildren(...tiles);
  document.querySelectorAll(".base-toggle button").forEach((b) =>
  b.addEventListener("click", () => {
    fin.base = b.dataset.base;
    store.set("fin-base", fin.base);
    ["ledger-form"].forEach((id) => { const f = document.getElementById(id); if (f) f.cur.value = fin.base; });
    renderFinance();
  })
);

document.querySelectorAll(".view-toggle button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === fin.view)));
  document.querySelectorAll(".base-toggle button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.base === fin.base)));
}

document.querySelectorAll(".view-toggle button").forEach((b) =>
  b.addEventListener("click", () => {
    fin.view = b.dataset.view;
    store.set("fin-view", fin.view);
    renderFinance();
  })
);

function renderFinChart() {
  const svg = document.getElementById("fin-chart");
  const months = [...Array(6)].map((_, i) => shiftMonth(selectedMonth(), i - 5));
  const rolled = fin.view === "rolled";
  const nets = months.map((m) => (rolled ? carryIn(m) + monthTotals(m).left : monthTotals(m).net));
  const max = Math.max(50, ...nets.map(Math.abs)) * 1.15;
  const W = 360, L = 14, R = 346, top = 26, bottom = 146, mid = (top + bottom) / 2;
  const x = (i) => L + (i / (months.length - 1)) * (R - L);
  const y = (v) => mid - (v / max) * ((bottom - top) / 2);
  const pts = nets.map((v, i) => [x(i), y(v)]);
  // Smooth curve through the points (Catmull-Rom as cubic Béziers).
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${R},${mid} L${L},${mid} Z`;
  const fmt = (v) => `${v < 0 ? "−" : "+"}${fin.base === "BRL" ? "R$" : "$"}${Math.round(Math.abs(conv(v))).toLocaleString(fin.base === "BRL" ? "pt-BR" : "en-US")}`;
  let out = `
    <defs>
      <clipPath id="fc-above"><rect x="0" y="0" width="${W}" height="${mid}" /></clipPath>
      <clipPath id="fc-below"><rect x="0" y="${mid}" width="${W}" height="${180 - mid}" /></clipPath>
      <linearGradient id="fc-pos" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d9456" stop-opacity=".45" /><stop offset="1" stop-color="#7d9456" stop-opacity="0" /></linearGradient>
      <linearGradient id="fc-neg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d77b7b" stop-opacity=".45" /><stop offset="1" stop-color="#d77b7b" stop-opacity="0" /></linearGradient>
    </defs>
    <text x="${L}" y="${top - 12}" class="axis">surplus ↑</text>
    <text x="${L}" y="${bottom + 12}" class="axis">deficit ↓</text>
    <line x1="${L}" x2="${R}" y1="${mid}" y2="${mid}" class="zero" />
    <path d="${area}" fill="url(#fc-pos)" clip-path="url(#fc-above)" />
    <path d="${area}" fill="url(#fc-neg)" clip-path="url(#fc-below)" />
    <path d="${d}" class="curve" />`;
  months.forEach((m, i) => {
    const v = nets[i], [px, py] = pts[i];
    const cur = m === selectedMonth();
    if (cur) out += `<line x1="${px}" x2="${px}" y1="${top - 4}" y2="${bottom + 4}" class="guide" />`;
    out += `<circle cx="${px}" cy="${py}" r="${cur ? 6 : 4.5}" class="dot ${v > 0 ? "pos" : v < 0 ? "neg" : "flat"}${cur ? " cur" : ""}" />`;
    if (v !== 0) {
      const ly = v > 0 ? py - 12 : py + 20;
      const anchor = i === 0 ? "start" : i === months.length - 1 ? "end" : "middle";
      out += `<text x="${px}" y="${ly}" text-anchor="${anchor}" class="val ${v > 0 ? "pos" : "neg"}">${fmt(v)}</text>`;
    }
    out += `<text x="${px}" y="174" text-anchor="${i === 0 ? "start" : i === months.length - 1 ? "end" : "middle"}" class="lab${cur ? " cur" : ""}">${monthLabel(m, { month: "short" })}</text>`;
  });
  svg.innerHTML = out;

  const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
  const cur = nets[nets.length - 1];
  document.getElementById("fin-chart-note").replaceChildren(
    el("span", { className: cur >= 0 ? "pos" : "neg", textContent: `${rolled ? "saldo agora" : "este mês"} ${fmt(cur)}` }),
    el("span", { textContent: `média 6 meses ${fmt(avg)}` })
  );
}

/* ---------- finance: savings ---------- */

// Each account shows its balance in its own currency; deposits are converted into it.
const toCur = (amount, from, to) => (from === to ? amount : from === "USD" ? amount * rate() : amount / rate());

function accountBalance(acc) {
  const deposits = tx.filter((t) => t.kind === "savings" && t.cat === acc.id).reduce((a, t) => a + toCur(t.amount, t.cur, acc.cur), 0);
  return { deposits, balance: (acc.base || 0) + deposits };
}

function renderAccountList(listId, type) {
  const list = document.getElementById(listId);
  const mine = accounts.filter((a) => a.type === type);
  list.replaceChildren(
    ...mine.map((acc, i) => {
      const { deposits, balance } = accountBalance(acc);
      const other = acc.cur === "BRL" ? "USD" : "BRL";
      const name = el("input", { value: acc.name, className: "acc-name", ariaLabel: "Nome da conta" });
      name.addEventListener("change", () => { acc.name = name.value.trim() || acc.name; saveFinance(); renderFinance(); });
      const base = el("input", { type: "number", step: "0.01", value: acc.base || "", placeholder: "0", ariaLabel: `Saldo base em ${acc.cur}` });
      base.addEventListener("change", () => { acc.base = parseFloat(base.value) || 0; saveFinance(); renderFinance(); });
      const li = el("li", { className: `jar ${type === "invest" ? "jar-invest" : ""} jar-${i % 3}` },
        el("span", { className: "jar-lid", ariaHidden: "true" }),
        type === "invest" ? el("span", { className: "jar-sticker", textContent: "📈", ariaHidden: "true" }) : "",
        name,
        el("strong", { className: "jar-balance", textContent: money(balance, acc.cur) }),
        el("small", { className: "jar-usd", textContent: "≈ " + money(toCur(balance, acc.cur, other), other) }),
        el("label", { className: "jar-base" }, el("span", { textContent: `saldo base ${acc.cur === "BRL" ? "R$" : "US$"}` }), base),
        el("small", { textContent: deposits ? `+ ${money(deposits, acc.cur)} guardado aqui` : "nenhum depósito logado" }));
      li.dataset.balance = toCur(balance, acc.cur, "BRL");
      return li;
    })
  );
  // Fill each jar relative to the fullest one in its group.
  const jars = [...list.children];
  const fullest = Math.max(0, ...jars.map((j) => +j.dataset.balance));
  jars.forEach((j) => {
    const b = +j.dataset.balance;
    j.style.setProperty("--fill", fullest > 0 && b > 0 ? `${Math.max(10, (b / fullest) * 78)}%` : "0%");
  });
  return mine.reduce((a, acc) => a + toCur(accountBalance(acc).balance, acc.cur, "BRL"), 0);
}

function renderSavings() {
  const saved = renderAccountList("savings-list", "savings");
  const invested = renderAccountList("invest-list", "invest");
  const total = saved + invested;
  document.getElementById("savings-total").replaceChildren(
    el("span", { textContent: `savings ${money(saved, "BRL")}` }),
    el("span", { textContent: `investimentos ${money(invested, "BRL")}` }),
    el("span", { className: "all", textContent: `total ${money(total, "BRL")} · ≈ ${money(total / rate(), "USD")}` })
  );
}

/* ---------- finance: fixed expenses ---------- */

function renderBills() {
  const list = document.getElementById("bills-list");
  const month = selectedMonth();
  const isCurrent = fin.offset === 0;
  list.replaceChildren(
    ...bills.map((bill) => {
      const paid = tx.find((t) => t.bill === bill.id && t.date.startsWith(month));
      const name = el("input", { value: bill.name, className: "bill-name", ariaLabel: "Nome" });
      name.addEventListener("change", () => { bill.name = name.value.trim() || bill.name; saveFinance(); renderFinance(); });
      const amount = el("input", { type: "number", step: "0.01", min: "0", value: bill.amount ?? "", placeholder: "valor", ariaLabel: "Valor" });
      amount.addEventListener("change", () => { bill.amount = amount.value === "" ? null : parseFloat(amount.value); saveFinance(); });
      const day = el("input", { type: "number", min: "1", max: "31", value: bill.day ?? "", placeholder: "—", ariaLabel: "Dia do vencimento" });
      day.addEventListener("change", () => { bill.day = day.value === "" ? null : parseInt(day.value, 10); saveFinance(); renderBills(); });

      const auto = el("label", { className: "bill-auto", title: "Débito automático: entra como pago todo mês" },
        el("input", { type: "checkbox", checked: !!bill.auto }), el("span", { textContent: "auto" }));
      auto.firstChild.addEventListener("change", () => {
        bill.auto = auto.firstChild.checked;
        if (bill.auto) {
          bill.since = iso(new Date()).slice(0, 7);
          bill.skip = [];
        }
        saveFinance();
        renderFinance();
      });

      let status = "monthly", statusText = "mensal";
      if (paid) {
        status = "paid";
        statusText = bill.auto ? "pago (auto) ✓" : "pago ✓";
      } else if (bill.day && isCurrent) {
        const d = daysUntil(parseIso(`${month}-${pad(bill.day)}`));
        status = d < 0 ? "late" : d <= 5 ? "approaching" : "upcoming";
        statusText = d < 0 ? `atrasado (${whenText(d)})` : `vence ${whenText(d)}`;
      } else if (bill.day) {
        statusText = `todo dia ${bill.day}`;
      }

      const pay = el("button", { type: "button", className: "pay", textContent: paid ? "desfazer" : "marcar pago" });
      pay.addEventListener("click", () => {
        if (paid) {
          tx = tx.filter((t) => t !== paid);
          // Undoing an autopay month: remember it so it doesn't come back.
          if (bill.auto) bill.skip = [...(bill.skip || []), month];
        } else {
          if (!(bill.amount > 0)) { amount.focus(); amount.classList.add("need"); return; }
          const date = bill.day ? billDate(bill, month) : entryDate();
          tx.push({ id: uid(), date, desc: bill.name, kind: "out", cat: "fixed", amount: bill.amount, cur: "USD", bill: bill.id });
          if (bill.skip) bill.skip = bill.skip.filter((m) => m !== month);
        }
        saveFinance();
        renderFinance();
      });
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover conta fixa" });
      del.addEventListener("click", () => { bills = bills.filter((b) => b !== bill); saveFinance(); renderBills(); });

      return el("li", { className: "bill " + status },
        name,
        el("label", { className: "bill-field" }, el("span", { textContent: "US$" }), amount),
        el("label", { className: "bill-field" }, el("span", { textContent: "dia" }), day),
        auto,
        el("span", { className: "bill-status", textContent: statusText }),
        pay, del);
    })
  );
}

document.getElementById("bills-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  bills.push({
    id: uid(), name: f.name.value.trim(),
    amount: f.amount.value === "" ? null : parseFloat(f.amount.value),
    day: f.day.value === "" ? null : parseInt(f.day.value, 10),
  });
  saveFinance();
  f.reset();
  renderBills();
});

/* ---------- finance: buckets ---------- */

function renderBuckets() {
  const box = document.getElementById("buckets");
  const month = inMonth(selectedMonth());
  box.replaceChildren(
    ...BUCKETS.map((b, i) => {
      const items = month.filter((t) => t.kind === "out" && t.cat === b.id).sort((x, y) => y.date.localeCompare(x.date));
      const form = el("form", { className: "bucket-form" },
        el("input", { name: "desc", placeholder: "o quê?", required: true, ariaLabel: `Gasto em ${b.label}` }),
        el("input", { name: "amount", type: "number", step: "0.01", min: "0", placeholder: fin.base === "BRL" ? "R$" : "$", required: true, ariaLabel: "Valor" }),
        el("select", { name: "cur", ariaLabel: "Moeda" }, el("option", { textContent: "BRL" }), el("option", { textContent: "USD" })),
        el("button", { type: "submit", textContent: "+", ariaLabel: "Adicionar gasto" }));
      form.cur.value = fin.base;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        tx.push({ id: uid(), date: entryDate(), desc: form.desc.value.trim(), kind: "out", cat: b.id, amount: parseFloat(form.amount.value) || 0, cur: form.cur.value });
        saveFinance();
        renderFinance();
        document.querySelector(`.bucket-${b.id} input`)?.focus();
      });
      return el("article", { className: `bucket bucket-${b.id} tone-${i}` },
        el("span", { className: "bucket-sticker", textContent: b.sticker, ariaHidden: "true", style: `--r:${tilt(b.id, 12)}deg` }),
        el("h4", { textContent: b.label }),
        el("strong", { className: "bucket-total", textContent: show(sumUSD(items)) }),
        el("ul", { className: "bucket-items" },
          ...(items.length
            ? items.map((t) => {
                const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover gasto" });
                del.addEventListener("click", () => { tx = tx.filter((x) => x !== t); saveFinance(); renderFinance(); });
                return el("li", {},
                  el("span", { className: "bi-date", textContent: t.date.slice(8) + "/" + t.date.slice(5, 7) }),
                  el("span", { className: "bi-desc", textContent: t.desc }),
                  el("span", { className: "bi-amt", textContent: money(t.amount, t.cur) }),
                  del);
              })
            : [el("li", { className: "empty", textContent: "nada ainda" })])),
        form);
    })
  );
}

/* ---------- finance: ledger ---------- */

const catOptions = (kind) =>
  kind === "out"
    ? [...BUCKETS.map((b) => [b.id, b.label]), [FIXED.id, FIXED.label]]
    : kind === "savings"
      ? accounts.map((a) => [a.id, `${a.type === "invest" ? "📈 " : "🐷 "}${a.name} (${a.cur === "BRL" ? "R$" : "US$"})`])
      : [["", "—"]];
const fillSelect = (select, kind, value) => {
  select.replaceChildren(...catOptions(kind).map(([v, l]) => el("option", { value: v, textContent: l })));
  if (value != null && [...select.options].some((o) => o.value === value)) select.value = value;
  select.disabled = kind === "in";
};

function renderLedger() {
  const body = document.getElementById("ledger-body");
  const commit = () => { saveFinance(); renderFinance(); };
  const rows = inMonth(selectedMonth()).sort((a, b) => b.date.localeCompare(a.date));
  body.replaceChildren(
    ...rows.map((row) => {
      const date = el("input", { type: "date", value: row.date, ariaLabel: "Data" });
      date.addEventListener("change", () => { if (date.value) { row.date = date.value; commit(); } });
      const desc = el("input", { value: row.desc, ariaLabel: "Descrição" });
      desc.addEventListener("change", () => { row.desc = desc.value; commit(); });
      const kind = el("select", { ariaLabel: "Tipo" }, ...["in", "out", "savings"].map((k) => el("option", { value: k, textContent: k })));
      kind.value = row.kind;
      const cat = el("select", { ariaLabel: "Bucket ou conta" });
      fillSelect(cat, row.kind, row.cat);
      kind.addEventListener("change", () => { row.kind = kind.value; fillSelect(cat, row.kind); row.cat = cat.value; delete row.bill; commit(); });
      cat.addEventListener("change", () => { row.cat = cat.value; commit(); });
      const amount = el("input", { type: "number", step: "0.01", min: "0", value: row.amount, ariaLabel: "Valor" });
      amount.addEventListener("change", () => { row.amount = parseFloat(amount.value) || 0; commit(); });
      const cur = el("select", { ariaLabel: "Moeda" }, el("option", { textContent: "USD" }), el("option", { textContent: "BRL" }));
      cur.value = row.cur;
      cur.addEventListener("change", () => { row.cur = cur.value; commit(); });
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover linha" });
      del.addEventListener("click", () => { tx = tx.filter((r) => r !== row); commit(); });
      return el("tr", { className: row.kind },
        el("td", {}, date), el("td", {}, desc), el("td", {}, kind), el("td", {}, cat),
        el("td", {}, amount), el("td", {}, cur), el("td", {}, del));
    })
  );
  if (!rows.length) {
    body.append(el("tr", {}, el("td", { colSpan: 7, className: "empty", textContent: "nada logado neste mês ainda." })));
  }
  const form = document.getElementById("ledger-form");
  if (!form.date.value) {
    form.date.value = entryDate();
    form.cur.value = fin.base;
  }
  const keep = form.cat.value;
  fillSelect(form.cat, form.kind.value, keep);
}

const ledgerForm = document.getElementById("ledger-form");
ledgerForm?.kind.addEventListener("change", () => fillSelect(ledgerForm.cat, ledgerForm.kind.value));
ledgerForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  tx.push({ id: uid(), date: f.date.value, desc: f.desc.value.trim(), kind: f.kind.value, cat: f.cat.value, amount: parseFloat(f.amount.value) || 0, cur: f.cur.value });
  saveFinance();
  f.desc.value = "";
  f.amount.value = "";
  f.desc.focus();
  renderFinance();
});

/* ---------- post-it notes (reminders + upcoming) ---------- */

function setupNotes(form) {
  const key = form.dataset.notes;
  const board = document.querySelector(`[data-notes-board="${key}"]`);
  let notes = store.get("notes:" + key, []);
  const save = () => store.set("notes:" + key, notes);
  const render = () => {
    const sorted = [...notes].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    board.replaceChildren(
      ...sorted.map((n) => {
        const text = el("div", { className: "note-text", contentEditable: "true", textContent: n.text });
        text.addEventListener("blur", () => { n.text = text.textContent.trim(); save(); });
        const date = el("input", { type: "date", value: n.date || "", ariaLabel: "Data" });
        date.addEventListener("change", () => { n.date = date.value; save(); render(); });
        const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover post-it" });
        del.addEventListener("click", () => { notes = notes.filter((x) => x !== n); save(); render(); });
        let when = "";
        let cls = "";
        if (n.date) {
          const d = daysUntil(parseIso(n.date));
          when = whenText(d);
          cls = d < 0 ? " late" : d <= 3 ? " soon" : "";
        }
        return el("article", { className: `postit note ${n.color}${cls}`, style: `--r:${tilt(n.id, 3)}deg` },
          text,
          el("div", { className: "note-meta" }, date, el("span", { className: "note-when", textContent: when }), del));
      })
    );
    if (!notes.length) board.append(el("p", { className: "empty", textContent: "nenhum post-it ainda." }));
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    notes.push({ id: uid(), text: form.text.value.trim(), date: form.date.value, color: POSTIT_COLORS[notes.length % POSTIT_COLORS.length] });
    save();
    form.reset();
    form.text.focus();
    render();
  });
  render();
}
document.querySelectorAll("form[data-notes]").forEach(setupNotes);

/* ---------- to-do lists ---------- */

document.querySelectorAll(".paper[data-list]").forEach((box) => {
  const key = "todo:" + box.dataset.list;
  const dated = box.classList.contains("dated");
  let items = store.get(key, []);
  const list = box.querySelector(".todo-list");
  const save = () => store.set(key, items);
  const render = () => {
    const shown = dated ? [...items].sort((a, b) => (a.done - b.done) || (a.date || "9999").localeCompare(b.date || "9999")) : items;
    list.replaceChildren(
      ...shown.map((it) => {
        const check = el("input", { type: "checkbox", checked: it.done, ariaLabel: "Feito" });
        const text = el("input", { type: "text", value: it.text, className: "todo-text", ariaLabel: "Tarefa" });
        const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover" });
        const li = el("li", { className: it.done ? "done" : "" }, el("label", { className: "hand-check" }, check, el("span")), text);
        if (dated) {
          const days = it.date ? daysUntil(parseIso(it.date)) : null;
          const due = el("span", {
            className: "due" + (days == null ? "" : days < 0 && !it.done ? " late" : days <= 3 && !it.done ? " soon" : ""),
            textContent: it.date
              ? `${it.date.slice(8)}/${it.date.slice(5, 7)}${days === 0 ? " · hoje" : days === 1 ? " · amanhã" : days < 0 ? " · atrasada" : ` · ${days}d`}`
              : "sem data",
            title: it.date ? whenText(days) : "",
          });
          li.append(due);
        }
        li.append(del);
        check.addEventListener("change", () => { it.done = check.checked; save(); dated ? render() : (li.className = it.done ? "done" : ""); renderNotebooks(); });
        text.addEventListener("change", () => { it.text = text.value; save(); });
        del.addEventListener("click", () => { items = items.filter((x) => x !== it); save(); render(); renderNotebooks(); });
        return li;
      })
    );
  };
  box.querySelector(".todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const [input, date] = e.target.querySelectorAll("input");
    if (!input.value.trim()) return;
    items.push({ id: uid(), text: input.value.trim(), done: false, ...(dated ? { date: date.value } : {}) });
    input.value = "";
    if (dated) date.value = "";
    save();
    render();
    renderNotebooks();
  });
  render();
});

// Little status line on each UF notebook cover: open tasks + next due thing.
function renderNotebooks() {
  document.querySelectorAll("[data-notebook]").forEach((nb) => {
    const key = nb.dataset.notebook;
    const lists = ["", "-assignments", "-study"].map((suffix) => store.get("todo:" + key + suffix, []));
    const open = lists.flat().filter((t) => !t.done).length;
    const dated = [...lists[1].filter((t) => !t.done && t.date), ...store.get("notes:upcoming-" + key, []).filter((n) => n.date)]
      .map((t) => t.date)
      .filter((d) => daysUntil(parseIso(d)) >= 0)
      .sort();
    const next = dated[0] ? `próximo: ${whenText(daysUntil(parseIso(dated[0])))}` : "nada marcado";
    nb.querySelector(".nb-status").textContent = `${open} pendente${open === 1 ? "" : "s"} · ${next}`;
  });
}

/* ---------- habit tracker with stickers (wellness) ---------- */

const HABITS = [
  { name: "alimentação saudável", sticker: "🥗" },
  { name: "água", sticker: "💧" },
  { name: "treino", sticker: "🏋️" },
  { name: "cardio", sticker: "🏃‍♀️" },
  { name: "alongar", sticker: "🧘‍♀️" },
  { name: "leitura", sticker: "📖" },
  { name: "meditação", sticker: "🕯️" },
  { name: "news", sticker: "📰" },
];
const STICKERS = ["🥗", "💧", "🏋️", "🏃‍♀️", "🧘‍♀️", "📖", "🕯️", "📰", "⭐", "🌸", "💖", "✨", "🍓"];
const habits = { data: store.get("habits", {}), offset: 0, selected: null };

function weekStart(offset) {
  const today = startOfDay(new Date());
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
}

function placeSticker(day, habit, sticker) {
  habits.data[day] = { ...habits.data[day], [habit]: sticker };
  if (!sticker) delete habits.data[day][habit];
  store.set("habits", habits.data);
  renderHabits();
}

function renderStickerSheet() {
  const sheet = document.getElementById("sticker-sheet");
  if (!sheet) return;
  sheet.replaceChildren(
    ...STICKERS.map((s) => {
      const btn = el("button", { type: "button", className: "sticker", textContent: s, ariaLabel: "Sticker " + s, ariaPressed: String(habits.selected === s) });
      btn.style.setProperty("--r", tilt(s, 10) + "deg");
      btn.addEventListener("pointerdown", (e) => startStickerDrag(e, s));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSticker(s); }
      });
      return btn;
    })
  );
}

function selectSticker(s) {
  habits.selected = habits.selected === s ? null : s;
  renderStickerSheet();
  document.querySelector(".habits")?.classList.toggle("placing", !!habits.selected);
}

// Pointer-based drag so it works with mouse and touch alike.
function startStickerDrag(e, sticker) {
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  let ghost = null;
  let hover = null;
  const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest(".habit-cell");
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
      ghost = el("div", { className: "sticker-ghost", textContent: sticker });
      document.body.append(ghost);
    }
    if (!ghost) return;
    ghost.style.transform = `translate(${ev.clientX - 22}px, ${ev.clientY - 22}px) rotate(-8deg) scale(1.15)`;
    const cell = cellAt(ev.clientX, ev.clientY);
    if (cell !== hover) {
      hover?.classList.remove("drop-hover");
      cell?.classList.add("drop-hover");
      hover = cell;
    }
  };
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    hover?.classList.remove("drop-hover");
    if (ghost) {
      ghost.remove();
      const cell = ev.type === "pointerup" && cellAt(ev.clientX, ev.clientY);
      if (cell) placeSticker(cell.dataset.day, cell.dataset.habit, sticker);
    } else {
      selectSticker(sticker);
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function renderHabits() {
  const head = document.getElementById("habits-head");
  if (!head) return;
  const start = weekStart(habits.offset);
  const days = [...Array(7)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = iso(new Date());
  document.getElementById("habits-week").textContent =
    habits.offset === 0 ? "esta semana" : `semana de ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  head.replaceChildren(
    el("th", { textContent: "" }),
    ...days.map((d) => el("th", { className: iso(d) === today ? "today" : "" },
      el("span", { textContent: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") }),
      el("small", { textContent: d.getDate() }))),
    el("th", { textContent: "semana" })
  );
  document.getElementById("habits-body").replaceChildren(
    ...HABITS.map((habit) => {
      let count = 0;
      const cells = days.map((d) => {
        const k = iso(d);
        let s = habits.data[k]?.[habit.name];
        if (s === true) s = habit.sticker;
        if (s) count++;
        const btn = el("button", {
          type: "button",
          className: "habit-cell" + (s ? " filled" : ""),
          ariaLabel: `${habit.name}, ${fmtDate(d)}${s ? ": feito" : ""}`,
        });
        btn.dataset.day = k;
        btn.dataset.habit = habit.name;
        if (s) btn.append(el("span", { className: "placed", textContent: s, style: `--r:${tilt(k + habit.name, 14)}deg` }));
        btn.addEventListener("click", () => {
          if (habits.selected) placeSticker(k, habit.name, habits.selected);
          else placeSticker(k, habit.name, s ? null : habit.sticker);
        });
        return el("td", { className: k === today ? "today" : "" }, btn);
      });
      return el("tr", {},
        el("th", { scope: "row" }, el("span", { className: "row-sticker", textContent: habit.sticker, ariaHidden: "true" }), " " + habit.name),
        ...cells,
        el("td", { className: "count", textContent: `${count}/7` }));
    })
  );
}

document.getElementById("habits-prev")?.addEventListener("click", () => { habits.offset--; renderHabits(); });
document.getElementById("habits-next")?.addEventListener("click", () => { habits.offset++; renderHabits(); });

/* ---------- exam countdown + study hours (UF classes) ---------- */

document.querySelectorAll("[data-countdown]").forEach((box) => {
  const key = "countdown:" + box.dataset.countdown;
  const cfg = store.get(key, { name: box.dataset.name, date: box.dataset.date });
  const name = box.querySelector(".cd-name");
  const date = box.querySelector(".cd-date");
  name.textContent = cfg.name;
  date.value = cfg.date;
  const save = () => store.set(key, cfg);
  name.addEventListener("blur", () => { cfg.name = name.textContent.trim() || "exam"; save(); });
  date.addEventListener("change", () => { if (date.value) { cfg.date = date.value; save(); tick(); } });
  const digit = (n, label) => el("div", { className: "cd-unit" }, el("strong", { textContent: String(n).padStart(2, "0") }), el("span", { textContent: label }));
  const tick = () => {
    // Counts down to 9am on exam day.
    const target = parseIso(cfg.date);
    target.setHours(9);
    const ms = target - new Date();
    const days = daysUntil(parseIso(cfg.date));
    box.classList.toggle("soon", days >= 0 && days <= 3);
    box.classList.toggle("past", days < 0);
    if (days < 0) {
      box.querySelector(".cd-digits").replaceChildren();
      box.querySelector(".cd-msg").textContent = "já foi! espero que tenha arrasado ✨";
      return;
    }
    const left = Math.max(0, ms);
    box.querySelector(".cd-digits").replaceChildren(
      digit(Math.floor(left / DAY), "dias"),
      digit(Math.floor((left % DAY) / 3600000), "horas"),
      digit(Math.floor((left % 3600000) / 60000), "min")
    );
    box.querySelector(".cd-msg").textContent =
      days === 0 ? "é hoje! respira e vai 💪" : days <= 3 ? "reta final, você consegue!" : "dá tempo de estudar com calma.";
  };
  tick();
  setInterval(tick, 30000);
});

document.querySelectorAll("[data-study]").forEach((box) => {
  const key = "study:" + box.dataset.study;
  let log = store.get(key, {});
  let offset = 0;
  const form = box.querySelector(".study-form");
  form.date.value = iso(new Date());
  const render = () => {
    const start = weekStart(offset);
    const days = [...Array(7)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const hours = days.map((d) => log[iso(d)] || 0);
    const max = Math.max(4, ...hours);
    const today = iso(new Date());
    box.querySelector(".study-week").textContent =
      offset === 0 ? "esta semana" : `semana de ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}`;
    box.querySelector(".study-bars").replaceChildren(
      ...days.map((d, i) => {
        const h = hours[i];
        const k = iso(d);
        const bar = el("button", { type: "button", className: "study-bar" + (k === today ? " today" : ""), ariaLabel: `${fmtDate(d)}: ${h} horas. Clique pra editar.` },
          el("span", { className: "sb-val", textContent: h ? `${h}h` : "" }),
          el("span", { className: "sb-track" }, el("span", { className: "sb-fill", style: `height:${(h / max) * 100}%` })),
          el("span", { className: "sb-star", textContent: h >= 3 ? "⭐" : h >= 1 ? "✨" : "", ariaHidden: "true" }),
          el("span", { className: "sb-day", textContent: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3) }));
        bar.addEventListener("click", () => {
          form.date.value = k;
          form.hours.value = h || "";
          form.hours.focus();
        });
        return bar;
      })
    );
    const week = hours.reduce((a, b) => a + b, 0);
    const all = Object.values(log).reduce((a, b) => a + b, 0);
    // Consecutive days with study, counting back from today (or yesterday if today isn't logged yet).
    let streak = 0;
    const d = startOfDay(new Date());
    if (!(log[today] > 0)) d.setDate(d.getDate() - 1);
    while (log[iso(d)] > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    box.querySelector(".study-stats").replaceChildren(
      el("span", { textContent: `semana: ${week}h` }),
      el("span", { textContent: `total: ${all}h` }),
      el("span", { textContent: `streak: ${streak} dia${streak === 1 ? "" : "s"} 🔥` })
    );
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const h = parseFloat(form.hours.value) || 0;
    if (h > 0) log[form.date.value] = h;
    else delete log[form.date.value];
    store.set(key, log);
    form.hours.value = "";
    render();
  });
  box.querySelector(".study-prev").addEventListener("click", () => { offset--; render(); });
  box.querySelector(".study-next").addEventListener("click", () => { offset++; render(); });
  render();
});

/* ---------- books (hobbies) ---------- */

const BOOK_STATUS = ["quero ler", "lendo", "lido"];
let books = store.get("books", []);

function renderBooks() {
  const list = document.getElementById("books-list");
  if (!list) return;
  const save = () => store.set("books", books);
  list.replaceChildren(
    ...books.map((b) => {
      b.progress ??= b.status === "lido" ? 100 : 0;
      const title = el("input", { value: b.title, className: "book-title", ariaLabel: "Título" });
      const author = el("input", { value: b.author, className: "book-author", placeholder: "autor(a)", ariaLabel: "Autor ou autora" });
      const status = el("select", { ariaLabel: "Status" }, ...BOOK_STATUS.map((s) => el("option", { value: s, textContent: s })));
      status.value = b.status;
      const range = el("input", { type: "range", min: "0", max: "100", step: "5", value: b.progress, ariaLabel: "Porcentagem lida" });
      const pct = el("output", { className: "book-pct", textContent: b.progress + "%" });
      const bar = el("span", { className: "book-bar" }, el("span", { style: `width:${b.progress}%` }));
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover livro" });
      const li = el("li", { className: "book " + b.status.replace(" ", "-") },
        el("span", { className: "book-sticker", textContent: b.progress >= 100 ? "📗" : "📚", ariaHidden: "true", style: `--r:${tilt(b.id, 10)}deg` }),
        el("div", { className: "book-main" }, title, author),
        el("div", { className: "book-progress" }, bar, range, pct),
        status, del);
      const setClass = () => { li.className = "book " + b.status.replace(" ", "-"); };
      title.addEventListener("change", () => { b.title = title.value; save(); });
      author.addEventListener("change", () => { b.author = author.value; save(); });
      range.addEventListener("input", () => {
        b.progress = parseInt(range.value, 10);
        pct.textContent = b.progress + "%";
        bar.firstChild.style.width = b.progress + "%";
      });
      range.addEventListener("change", () => {
        // Keep the status in step with the slider.
        if (b.progress >= 100) b.status = "lido";
        else if (b.progress > 0) b.status = "lendo";
        else if (b.status === "lido") b.status = "quero ler";
        save();
        renderBooks();
      });
      status.addEventListener("change", () => {
        b.status = status.value;
        if (b.status === "lido") b.progress = 100;
        if (b.status === "quero ler") b.progress = 0;
        save();
        setClass();
        renderBooks();
      });
      del.addEventListener("click", () => { books = books.filter((x) => x !== b); save(); renderBooks(); });
      return li;
    })
  );
  if (!books.length) list.append(el("li", { className: "empty", textContent: "nenhum livro ainda." }));
}

document.getElementById("books-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  books.push({ id: uid(), title: f.title.value.trim(), author: f.author.value.trim(), status: "quero ler", progress: 0 });
  store.set("books", books);
  f.reset();
  f.title.focus();
  renderBooks();
});

/* ---------- art check-ins (hobbies) ---------- */

const ART_KINDS = [
  { id: "dança", sticker: "💃" },
  { id: "arte visual", sticker: "🎨" },
  { id: "escrita", sticker: "✍️" },
];
let art = store.get("art", []);
let artOffset = 0;

function renderArt() {
  const list = document.getElementById("art-list");
  if (!list) return;
  const save = () => store.set("art", art);
  const form = document.getElementById("art-form");
  if (!form.date.value) form.date.value = iso(new Date());
  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() + artOffset, 1);
  const monthKey = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
  document.getElementById("art-month").textContent = monthLabel(monthKey);
  document.getElementById("art-counts").replaceChildren(
    ...ART_KINDS.map((k) => {
      const all = art.filter((a) => a.kind === k.id);
      const month = all.filter((a) => a.date.startsWith(monthKey)).length;
      return el("div", { className: "art-count" },
        el("span", { className: "art-count-sticker", textContent: k.sticker, ariaHidden: "true" }),
        el("strong", { textContent: month }),
        el("span", { textContent: `${k.id} ${artOffset === 0 ? "este mês" : "no mês"}` }),
        el("small", { textContent: `${all.length} no total` }));
    })
  );
  const sorted = art.filter((a) => a.date.startsWith(monthKey)).sort((a, b) => b.date.localeCompare(a.date));
  list.replaceChildren(
    ...sorted.map((a) => {
      const kind = ART_KINDS.find((k) => k.id === a.kind) || ART_KINDS[0];
      const date = el("input", { type: "date", value: a.date, ariaLabel: "Data" });
      date.addEventListener("change", () => { if (date.value) { a.date = date.value; save(); renderArt(); } });
      const note = el("input", { value: a.note || "", placeholder: "nota", className: "art-note", ariaLabel: "Nota" });
      note.addEventListener("change", () => { a.note = note.value; save(); });
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover check-in" });
      del.addEventListener("click", () => { art = art.filter((x) => x !== a); save(); renderArt(); });
      return el("li", { className: "art-item" },
        el("span", { className: "art-sticker", textContent: kind.sticker, ariaHidden: "true", style: `--r:${tilt(a.id, 12)}deg` }),
        el("span", { className: "art-kind", textContent: kind.id }),
        date, note, del);
    })
  );
  if (!sorted.length) list.append(el("li", { className: "empty", textContent: "nenhum check-in neste mês." }));
}

document.getElementById("art-prev")?.addEventListener("click", () => { artOffset--; renderArt(); });
document.getElementById("art-next")?.addEventListener("click", () => { artOffset++; renderArt(); });

document.getElementById("art-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  art.push({ id: uid(), kind: f.kind.value, date: f.date.value, note: f.note.value.trim() });
  store.set("art", art);
  f.note.value = "";
  renderArt();
});

/* ---------- post-it boards (jobs + scholarships) ---------- */

const BOARDS = {
  jobs: {
    placeholders: ["empresa", "vaga", "nota"],
    columns: [
      { id: "applied", label: "applications enviadas" },
      { id: "active", label: "processos ativos" },
      { id: "interview", label: "entrevistas" },
      { id: "closed", label: "encerrados" },
    ],
  },
  scholarships: {
    placeholders: ["bolsa", "valor", "nota"],
    columns: [
      { id: "applying", label: "applying" },
      { id: "applied", label: "applied" },
      { id: "won", label: "won ★" },
    ],
  },
};

// The first job board saved cards as {company, role}; map them to the shared shape once.
if (!store.get("board:jobs", null)) {
  store.set("board:jobs", store.get("jobs", []).map((j) => ({ id: j.id, col: j.col, title: j.company, sub: j.role, note: j.note, color: j.color })));
}

function setupBoard(boardEl) {
  const name = boardEl.dataset.board;
  const cfg = BOARDS[name];
  const form = document.querySelector(`[data-board-form="${name}"]`);
  let cards = store.get("board:" + name, []);
  const save = () => store.set("board:" + name, cards);
  const render = () => {
    boardEl.replaceChildren(
      ...cfg.columns.map((col, ci) => {
        const colCards = cards.filter((c) => c.col === col.id).map((c) => {
          const field = (key, cls, placeholder) => {
            const node = el("div", { className: cls, contentEditable: "true", textContent: c[key] || "" });
            node.dataset.placeholder = placeholder;
            node.addEventListener("blur", () => { c[key] = node.textContent.trim(); save(); });
            return node;
          };
          const move = (dir) => {
            const btn = el("button", { type: "button", textContent: dir < 0 ? "←" : "→", ariaLabel: dir < 0 ? "Mover pra trás" : "Mover pra frente" });
            btn.disabled = ci + dir < 0 || ci + dir >= cfg.columns.length;
            btn.addEventListener("click", () => { c.col = cfg.columns[ci + dir].id; save(); render(); });
            return btn;
          };
          const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover post-it" });
          del.addEventListener("click", () => { cards = cards.filter((x) => x !== c); save(); render(); });
          return el("article", { className: `postit ${c.color}`, style: `--r:${tilt(c.id, 2.5)}deg` },
            col.id === "won" ? el("span", { className: "won-star", textContent: "🏆", ariaHidden: "true" }) : "",
            field("title", "postit-company", cfg.placeholders[0]),
            field("sub", "postit-role", cfg.placeholders[1]),
            field("note", "postit-note", cfg.placeholders[2]),
            el("div", { className: "postit-actions" }, move(-1), del, move(1)));
        });
        return el("section", { className: "jobs-col col-" + col.id },
          el("h3", {}, col.label, el("span", { className: "count", textContent: colCards.length })),
          ...colCards);
      })
    );
  };
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    cards.push({
      id: uid(), col: cfg.columns[0].id,
      title: form.title.value.trim(), sub: form.sub.value.trim(), note: form.note.value.trim(),
      color: POSTIT_COLORS[cards.length % POSTIT_COLORS.length],
    });
    save();
    form.reset();
    form.title.focus();
    render();
  });
  render();
}
document.querySelectorAll("[data-board]").forEach(setupBoard);

renderQuote();
renderPaydays();
renderFinance();
renderStickerSheet();
renderHabits();
renderBooks();
renderArt();
renderNotebooks();
window.addEventListener("hashchange", renderNotebooks);
loadFx();
