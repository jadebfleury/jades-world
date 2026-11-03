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
const fmtDate = (d) =>
  d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const money = (n, cur) =>
  n.toLocaleString(cur === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency: cur });

/* ---------- paydays ---------- */

const PAYDAYS = [
  { label: "job 1 · todo dia 10", next: (today) => {
    let d = new Date(today.getFullYear(), today.getMonth(), 10);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, 10);
    return d;
  } },
  { label: "job 2 · a cada 2 semanas", next: (today) => {
    // Anchor: last paid Thursday, 29 Oct 2026.
    const anchor = new Date(2026, 9, 29);
    const days = Math.round((today - anchor) / DAY);
    const cycles = Math.max(0, Math.ceil(days / 14));
    return new Date(2026, 9, 29 + cycles * 14);
  } },
];

function renderPaydays() {
  const list = document.getElementById("paydays");
  if (!list) return;
  const today = startOfDay(new Date());
  list.replaceChildren(
    ...PAYDAYS.map((p) => {
      const date = p.next(today);
      const days = Math.round((date - today) / DAY);
      const status = days === 0 ? "today" : days <= 10 ? "approaching" : "upcoming";
      const when = days === 0 ? "hoje!" : days === 1 ? "amanhã" : `em ${days} dias`;
      return el(
        "li",
        { className: "payday " + status },
        el("span", { className: "payday-label", textContent: p.label }),
        el("strong", { textContent: fmtDate(date) }),
        el("span", { className: "payday-when", textContent: when }),
        el("span", { className: "payday-badge", textContent: status })
      );
    })
  );
}

/* ---------- dólar ↔ real ---------- */

const fx = { rate: null, history: [], dir: store.get("fx-dir", "usd-brl") };

async function loadFx() {
  try {
    const live = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL").then((r) => r.json());
    fx.rate = parseFloat(live.USDBRL.bid);
    fx.updated = new Date(parseInt(live.USDBRL.timestamp, 10) * 1000);
  } catch {}
  try {
    const start = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10);
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
  renderLedger();
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
  const shown = sellingUsd ? fx.rate : 1 / fx.rate;
  rateEl.textContent = shown.toFixed(sellingUsd ? 4 : 4);
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
    const pct = Math.round(below * 100);
    stats.replaceChildren(
      el("dt", { textContent: "vs. último ano" }),
      el("dd", { textContent: `dólar mais caro que em ${pct}% dos dias` }),
      el("dt", { textContent: "média 1 ano" }),
      el("dd", { textContent: "R$ " + avg.toFixed(4) }),
      el("dt", { textContent: "média 30 dias" }),
      el("dd", { textContent: "R$ " + avg30.toFixed(4) }),
      el("dt", { textContent: "mín / máx" }),
      el("dd", { textContent: `R$ ${Math.min(...h).toFixed(2)} / R$ ${Math.max(...h).toFixed(2)}` })
    );
    drawChart(h, avg);
  } else {
    verdict.textContent = "sem histórico agora";
  }
  renderConvert();
}

function drawChart(h, avg) {
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

/* ---------- in & out ---------- */

let ledger = store.get("ledger", []);

function renderLedger() {
  const body = document.getElementById("ledger-body");
  if (!body) return;
  const save = () => {
    store.set("ledger", ledger);
    renderTotals();
  };
  body.replaceChildren(
    ...ledger.map((row) => {
      const desc = el("input", { value: row.desc, ariaLabel: "Descrição" });
      desc.addEventListener("change", () => { row.desc = desc.value; save(); });
      const kind = el("select", { ariaLabel: "Tipo" },
        el("option", { value: "in", textContent: "in" }),
        el("option", { value: "out", textContent: "out" }));
      kind.value = row.kind;
      kind.addEventListener("change", () => { row.kind = kind.value; tr.className = row.kind; save(); });
      const amount = el("input", { type: "number", step: "0.01", min: "0", value: row.amount, ariaLabel: "Valor" });
      amount.addEventListener("change", () => { row.amount = parseFloat(amount.value) || 0; save(); });
      const cur = el("select", { ariaLabel: "Moeda" },
        el("option", { value: "USD", textContent: "USD" }),
        el("option", { value: "BRL", textContent: "BRL" }));
      cur.value = row.cur;
      cur.addEventListener("change", () => { row.cur = cur.value; save(); });
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover linha" });
      del.addEventListener("click", () => { ledger = ledger.filter((r) => r !== row); save(); renderLedger(); });
      const tr = el("tr", { className: row.kind },
        el("td", {}, desc), el("td", {}, kind), el("td", {}, amount), el("td", {}, cur), el("td", {}, del));
      return tr;
    })
  );
  if (!ledger.length) {
    body.append(el("tr", {}, el("td", { colSpan: 5, className: "empty", textContent: "nada ainda. adiciona a primeira linha aqui em cima." })));
  }
  renderTotals();
}

function renderTotals() {
  const box = document.getElementById("ledger-totals");
  if (!box) return;
  const sum = { USD: { in: 0, out: 0 }, BRL: { in: 0, out: 0 } };
  ledger.forEach((r) => (sum[r.cur][r.kind] += r.amount));
  const cards = ["USD", "BRL"].map((c) => {
    const net = sum[c].in - sum[c].out;
    return el("div", { className: "total" },
      el("span", { textContent: c }),
      el("small", { textContent: `in ${money(sum[c].in, c)} · out ${money(sum[c].out, c)}` }),
      el("strong", { className: net < 0 ? "neg" : "", textContent: money(net, c) }));
  });
  if (fx.rate) {
    const netUsd = sum.USD.in - sum.USD.out + (sum.BRL.in - sum.BRL.out) / fx.rate;
    cards.push(el("div", { className: "total all" },
      el("span", { textContent: "tudo junto" }),
      el("small", { textContent: `na cotação de hoje (R$ ${fx.rate.toFixed(2)})` }),
      el("strong", { className: netUsd < 0 ? "neg" : "", textContent: `${money(netUsd, "USD")} · ${money(netUsd * fx.rate, "BRL")}` })));
  }
  box.replaceChildren(...cards);
}

document.getElementById("ledger-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  ledger.push({ id: uid(), desc: f.desc.value.trim(), kind: f.kind.value, amount: parseFloat(f.amount.value) || 0, cur: f.cur.value });
  store.set("ledger", ledger);
  f.desc.value = "";
  f.amount.value = "";
  f.desc.focus();
  renderLedger();
});

/* ---------- to-do lists (UF) ---------- */

document.querySelectorAll(".todo").forEach((box) => {
  const key = "todo:" + box.dataset.todo;
  let items = store.get(key, []);
  const list = box.querySelector(".todo-list");
  const save = () => store.set(key, items);
  const render = () => {
    list.replaceChildren(
      ...items.map((it) => {
        const check = el("input", { type: "checkbox", checked: it.done, ariaLabel: "Feito" });
        const text = el("input", { type: "text", value: it.text, className: "todo-text", ariaLabel: "Tarefa" });
        const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover tarefa" });
        const li = el("li", { className: it.done ? "done" : "" }, check, text, del);
        check.addEventListener("change", () => { it.done = check.checked; li.className = it.done ? "done" : ""; save(); });
        text.addEventListener("change", () => { it.text = text.value; save(); });
        del.addEventListener("click", () => { items = items.filter((x) => x !== it); save(); render(); });
        return li;
      })
    );
  };
  box.querySelector(".todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    if (!input.value.trim()) return;
    items.push({ id: uid(), text: input.value.trim(), done: false });
    input.value = "";
    save();
    render();
  });
  render();
});

/* ---------- habit tracker (wellness) ---------- */

const HABITS = ["alimentação saudável", "água", "treino", "cardio", "alongar"];
const habits = { data: store.get("habits", {}), offset: 0 };

function weekStart(offset) {
  const today = startOfDay(new Date());
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
}

function renderHabits() {
  const head = document.getElementById("habits-head");
  if (!head) return;
  const start = weekStart(habits.offset);
  const days = [...Array(7)].map((_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      const countCell = el("td", { className: "count" });
      const update = () => {
        const n = days.filter((d) => habits.data[iso(d)]?.[habit]).length;
        countCell.textContent = `${n}/7`;
      };
      const cells = days.map((d) => {
        const k = iso(d);
        const box = el("input", { type: "checkbox", checked: !!habits.data[k]?.[habit], ariaLabel: `${habit}, ${fmtDate(d)}` });
        box.addEventListener("change", () => {
          habits.data[k] = { ...habits.data[k], [habit]: box.checked };
          store.set("habits", habits.data);
          update();
        });
        return el("td", { className: k === today ? "today" : "" }, el("label", { className: "dot-check" }, box, el("span")));
      });
      update();
      return el("tr", {}, el("th", { scope: "row", textContent: habit }), ...cells, countCell);
    })
  );
}

document.getElementById("habits-prev")?.addEventListener("click", () => { habits.offset--; renderHabits(); });
document.getElementById("habits-next")?.addEventListener("click", () => { habits.offset++; renderHabits(); });

/* ---------- books (hobbies) ---------- */

const BOOK_STATUS = ["quero ler", "lendo", "lido"];
let books = store.get("books", []);

function renderBooks() {
  const list = document.getElementById("books-list");
  if (!list) return;
  const save = () => store.set("books", books);
  list.replaceChildren(
    ...books.map((b) => {
      const title = el("input", { value: b.title, className: "book-title", ariaLabel: "Título" });
      const author = el("input", { value: b.author, className: "book-author", placeholder: "autor(a)", ariaLabel: "Autor ou autora" });
      const status = el("select", { ariaLabel: "Status" }, ...BOOK_STATUS.map((s) => el("option", { value: s, textContent: s })));
      status.value = b.status;
      const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover livro" });
      const li = el("li", { className: "book " + b.status.replace(" ", "-") }, el("span", { className: "spine" }), title, author, status, del);
      title.addEventListener("change", () => { b.title = title.value; save(); });
      author.addEventListener("change", () => { b.author = author.value; save(); });
      status.addEventListener("change", () => { b.status = status.value; li.className = "book " + b.status.replace(" ", "-"); save(); });
      del.addEventListener("click", () => { books = books.filter((x) => x !== b); save(); renderBooks(); });
      return li;
    })
  );
  if (!books.length) list.append(el("li", { className: "empty", textContent: "nenhum livro ainda." }));
}

document.getElementById("books-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  books.push({ id: uid(), title: f.title.value.trim(), author: f.author.value.trim(), status: "quero ler" });
  store.set("books", books);
  f.reset();
  f.title.focus();
  renderBooks();
});

/* ---------- job board (post-its) ---------- */

const JOB_COLUMNS = [
  { id: "applied", label: "applications enviadas" },
  { id: "active", label: "processos ativos" },
  { id: "interview", label: "entrevistas" },
  { id: "closed", label: "encerrados" },
];
const POSTIT_COLORS = ["yellow", "pink", "mint", "peach", "blue"];
let jobs = store.get("jobs", []);

function renderJobs() {
  const board = document.getElementById("jobs-board");
  if (!board) return;
  const save = () => store.set("jobs", jobs);
  board.replaceChildren(
    ...JOB_COLUMNS.map((col, ci) => {
      const cards = jobs.filter((j) => j.col === col.id).map((j) => {
        const field = (key, cls, placeholder) => {
          const node = el("div", { className: cls, contentEditable: "true", textContent: j[key] || "" });
          node.dataset.placeholder = placeholder;
          node.addEventListener("blur", () => { j[key] = node.textContent.trim(); save(); });
          return node;
        };
        const move = (dir) => {
          const btn = el("button", { type: "button", textContent: dir < 0 ? "←" : "→", ariaLabel: dir < 0 ? "Mover pra trás" : "Mover pra frente" });
          btn.disabled = ci + dir < 0 || ci + dir >= JOB_COLUMNS.length;
          btn.addEventListener("click", () => { j.col = JOB_COLUMNS[ci + dir].id; save(); renderJobs(); });
          return btn;
        };
        const del = el("button", { type: "button", className: "x", textContent: "×", ariaLabel: "Remover post-it" });
        del.addEventListener("click", () => { jobs = jobs.filter((x) => x !== j); save(); renderJobs(); });
        return el("article", { className: "postit " + j.color },
          field("company", "postit-company", "empresa"),
          field("role", "postit-role", "vaga"),
          field("note", "postit-note", "nota"),
          el("div", { className: "postit-actions" }, move(-1), del, move(1)));
      });
      return el("section", { className: "jobs-col" },
        el("h3", {}, col.label, el("span", { className: "count", textContent: cards.length })),
        ...cards);
    })
  );
}

document.getElementById("jobs-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  jobs.push({
    id: uid(), col: "applied",
    company: f.company.value.trim(), role: f.role.value.trim(), note: f.note.value.trim(),
    color: POSTIT_COLORS[jobs.length % POSTIT_COLORS.length],
  });
  store.set("jobs", jobs);
  f.reset();
  f.company.focus();
  renderJobs();
});

renderPaydays();
renderLedger();
renderHabits();
renderBooks();
renderJobs();
loadFx();
