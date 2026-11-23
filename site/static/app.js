// Spec-Guard demo interface. Plain ES module, no external code. Every number shown comes from the
// service's JSON API, which reads archived result files (deploy/results.py, deploy/replay.py) or the
// record of a live run (deploy/pipeline.py).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function h(tag, attrs = {}, ...kids) {
  const svg = ["svg", "g", "rect", "path", "text", "line", "circle", "tspan", "animateMotion", "mpath", "title"].includes(tag);
  const e = svg ? document.createElementNS(NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.setAttribute("class", v);
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const f2 = (x, d = 2) => (x === null || x === undefined ? "n/a" : Number(x).toFixed(d));
const sg = (x, d = 2) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const pct = x => (100 * x).toFixed(0);

// Static build (GitHub Pages, deploy/export_static.py): the same answers, read from exported JSON.
const STATIC = document.documentElement.dataset.static === "1";
const SCACHE = {};
async function sget(rel) {
  if (!(rel in SCACHE)) SCACHE[rel] = fetch(rel).then(r => { if (!r.ok) throw new Error("This item is not part of the static showcase."); return r.json(); });
  return SCACHE[rel];
}
const sid = s => s.replace(/[^A-Za-z0-9_-]/g, "_");
const OR_OUT = { all: () => true, router_right_vlm_wrong: r => r.f1_router === 1 && r.f1_s1 < 1, router_wrong: r => r.f1_router < 1,
  both_right: r => r.f1_router === 1 && r.f1_s1 === 1, route_P: r => r.route === "P" };
const RC_OUT = { all: () => true, sg_right_program_wrong: r => r.sg && r.program === false, sg_routed: r => r.routed,
  program_right_b0_wrong: r => r.program && r.b0 === false, program_wrong: r => r.program === false, vlm_wrong: r => r.vlm === false };
const normq = q => (q || "").toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const selKey = s => !s ? null : s.kind === "example" ? s.id : s.kind === "rcexample" ? `${s.split}:${s.index}` : s.kind === "recorded" ? s.key : null;
async function staticApi(path, opt) {
  const u = new URL(path, location.href), p = decodeURIComponent(u.pathname.replace(/^.*?\/(health|api\/)/, "/$1")), q = u.searchParams;
  const page = list => { const off = +(q.get("offset") || 0), lim = Math.min(+(q.get("limit") || 60), 200); return { total: list.length, offset: off, rows: list.slice(off, off + lim) }; };
  const text = (q.get("q") || "").toLowerCase().trim();
  if (p === "/health") return sget("data/health.json");
  if (p === "/api/version") return sget("data/version.json");
  if (p === "/api/summary") return sget("data/summary.json");
  if (p === "/api/examples") return sget("data/examples.json");
  if (p === "/api/rows") {
    const rows = (await sget("data/or_rows.json")).filter(r => (q.get("category") || "all") === "all" || r.category === q.get("category"))
      .filter(r => (q.get("variant") || "all") === "all" || r.variant === q.get("variant"))
      .filter(OR_OUT[q.get("outcome") || "all"] || OR_OUT.all).filter(r => !text || r.expression.toLowerCase().includes(text) || r.id.includes(text));
    return page(rows);
  }
  if (p.startsWith("/api/rows/")) return sget(`data/or/${sid(p.slice(10))}.json`);
  if (p === "/api/refcoco/splits") return sget("data/rc_splits.json");
  if (p === "/api/refcoco/rows") {
    const rows = (await sget(`data/rc_rows_${q.get("split")}.json`)).filter(RC_OUT[q.get("outcome") || "all"] || RC_OUT.all)
      .filter(r => !text || r.query.toLowerCase().includes(text));
    return page(rows);
  }
  let m = p.match(/^\/api\/refcoco\/rows\/([^/]+)\/(\d+)$/);
  if (m) { const i = +m[2]; const ch = await sget(`data/rc/${m[1]}/${Math.floor(i / 250)}.json`); if (!ch[i]) throw new Error("No such row."); return ch[i]; }
  m = p.match(/^\/api\/refcoco\/program\/([^/]+)\/(\d+)\/(.+)$/);
  if (m) {
    const i = +m[2], none = { program: "# No program or property test is archived for this system on this row." };
    if (!(await sget("data/health.json")).programs) return { program: "# This export was made without program text (--no-programs)." };
    try { const ch = await sget(`data/rcp/${m[1]}/${Math.floor(i / 50)}.json`); return (ch[i] || {})[m[3]] || none; } catch { return none; }
  }
  if (p === "/api/run") {
    // Replay: the answer the live GPU service gave to this image and expression, recorded by deploy/record_runs.py
    const fd = opt && opt.body, R = await sget("data/recorded.json").catch(() => null);
    if (!R) throw new Error("This static showcase has no recorded runs; live queries need the GPU service.");
    const key = fd.get("recorded") || fd.get("example_id") || (fd.get("example_split") ? `${fd.get("example_split")}:${fd.get("example_index")}` : null);
    if (!key) throw new Error("A new image needs the live GPU service. On this page, choose one of the images above: Run replays the answers recorded from the live service.");
    const mode = fd.get("mode"), f = R.runs[`${key}|${mode}|${normq(fd.get("query"))}`];
    if (!f) {
      const list = (R.queries[key] || {})[mode] || [];
      throw new Error(list.length ? `This expression was not recorded for this image in this mode; a new expression needs the live service. Recorded: ${list.join("; ")}.`
        : "No run was recorded for this image in this mode.");
    }
    const rec = await sget(f);
    await new Promise(r => setTimeout(r, Math.min(1800, 500 + rec.total_ms / 5)));
    return structuredClone(rec);
  }
  throw new Error("Not available in the static showcase.");
}
const rcImg = (r, split, i) => STATIC ? (r && r.static_img) || null : `/api/refcoco/image/${split}/${i}`;
const orImg = r => STATIC ? (r && r.static_img) || null : `/api/image/${encodeURIComponent(r.id)}`;
async function api(path, opt) {
  if (STATIC) return staticApi(path, opt);
  const r = await fetch(path, opt);
  let body = null;
  try { body = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw new Error((body && body.detail) || `The server answered ${r.status}.`);
  return body;
}

const S = { health: null, version: null, summary: null, examples: [], inited: {} };

/* ------------------------------------------------------------------ theme, tooltip */
function initPresent() {
  let on = false;
  try { on = localStorage.getItem("sg-present") === "1"; } catch { /* storage blocked */ }
  const b = $("#present");
  const set = v => { document.documentElement.classList.toggle("present", v); b.setAttribute("aria-pressed", String(v)); try { localStorage.setItem("sg-present", v ? "1" : "0"); } catch { /* blocked */ } };
  set(on);
  b.addEventListener("click", () => set(!document.documentElement.classList.contains("present")));
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("sg-theme"); } catch { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $("#theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sg-theme", next); } catch { /* storage blocked */ }
  });
}
const tip = {
  el: null,
  show(html, ev) { this.el ||= $("#tip"); this.el.innerHTML = html; this.el.classList.add("on"); this.move(ev); },
  move(ev) {
    if (!this.el) return;
    const w = this.el.offsetWidth, x = Math.min(ev.clientX + 14, innerWidth - w - 8);
    this.el.style.left = x + "px"; this.el.style.top = (ev.clientY + 16) + "px";
  },
  hide() { this.el && this.el.classList.remove("on"); }
};
function hover(node, html) {
  node.addEventListener("pointerenter", e => tip.show(html, e));
  node.addEventListener("pointermove", e => tip.move(e));
  node.addEventListener("pointerleave", () => tip.hide());
}

/* ------------------------------------------------------------------ code highlighting */
const KW = new Set("def return if else elif for in not and or None True False while len min max sorted lambda is".split(" "));
const API_FN = new Set("ImagePatch find group_lines order_from exists verify_property best_text_match compute_depth crop simple_query llm_query".split(" "));
function pyHtml(src) {
  const re = /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const [t] = m;
    if (m[1]) out += `<span class="c">${esc(t)}</span>`;
    else if (m[2]) out += `<span class="s">${esc(t)}</span>`;
    else if (m[3]) out += `<span class="n">${esc(t)}</span>`;
    else if (KW.has(t)) out += `<span class="k">${t}</span>`;
    else if (API_FN.has(t)) out += `<span class="f">${t}</span>`;
    else out += t;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}
function codeBlock(title, src, note) {
  const pre = h("pre", { class: "code", html: pyHtml(src || "(no program)") });
  const btn = h("button", { class: "linkbtn", type: "button" }, "Copy");
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(src || ""); btn.textContent = "Copied"; } catch { btn.textContent = "Copy not allowed"; }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
  return h("div", {}, h("div", { class: "code-head" }, h("div", {}, h("h3", {}, title), note ? h("div", { class: "small muted" }, note) : null), btn), pre);
}

/* ------------------------------------------------------------------ route rail (signature element) */
// state: {route: "T"|"P"|null, busy, guard: "ok"|"warn"|null, animate}
function rail(state = {}) {
  const { route = null, busy = false, guard = null, animate = false } = state;
  const s = h("svg", { class: "rail", viewBox: "0 0 760 166", role: "img",
    "aria-label": route ? `Pipeline: route ${route} was taken` : "Pipeline: normaliser, route, template program or program writer, execution, Spec-Guard" });
  const P = {
    a: "M92 83 H112", b: "M224 83 H252",
    t: "M258 83 C 274 83, 272 32, 290 32", p: "M258 83 C 274 83, 272 134, 290 134",
    t2: "M470 32 C 488 32, 486 83, 504 83", p2: "M470 134 C 488 134, 486 83, 504 83",
    c: "M628 83 H642"
  };
  const cls = k => {
    if (!route) return "trk";
    if (k[0] === "t") return route === "T" ? "trk on-t" : "trk dim";
    if (k[0] === "p") return route === "P" ? "trk on-p" : "trk dim";
    return "trk on";
  };
  for (const [k, d] of Object.entries(P)) s.append(h("path", { d, class: cls(k) }));
  const node = (x, y, w, t1, t2, c) => h("g", { class: `node ${c}` },
    h("rect", { x, y, width: w, height: 52, rx: 8 }),
    h("text", { x: x + 11, y: y + 22 }, t1), h("text", { x: x + 11, y: y + 40, class: "s" }, t2));
  const on = route ? "on" : "";
  s.append(node(0, 57, 92, "Input", "image, text", on));
  s.append(node(112, 57, 112, "Normaliser", "template line", (busy ? "busy " : "") + on));
  s.append(node(290, 6, 180, "Template program", "no language model", route === "T" ? "t on" : route ? "dim" : ""));
  s.append(node(290, 108, 180, "Program writer", "Qwen2.5-Coder-7B", route === "P" ? "p on" : route ? "dim" : ""));
  s.append(node(504, 57, 124, "Execution", "sandbox, SAM 3", on));
  s.append(node(642, 57, 118, "Spec-Guard", guard === "warn" ? "a check fired" : guard === "ok" ? "checks pass" : "checks, answer",
    guard === "warn" ? "warn" : guard === "ok" ? "ok" : ""));
  const ang = route === "T" ? -40 : route === "P" ? 40 : 0;
  const col = route === "T" ? "var(--t)" : route === "P" ? "var(--p)" : "var(--ink)";
  s.append(h("g", { style: `transform-origin:252px 83px;transform:rotate(${ang}deg);transition:transform .55s cubic-bezier(.3,1.4,.5,1)` },
    h("line", { x1: 252, y1: 83, x2: 272, y2: 83, style: `stroke:${col};stroke-width:3.5;stroke-linecap:round` })));
  s.append(h("circle", { cx: 252, cy: 83, r: 6.5, class: "sw" }));
  s.append(h("text", { x: 252, y: 64, "text-anchor": "middle", class: "rl" }, route ? `route ${route}` : "route"));
  if (animate && route && !reduced) {
    const lane = route === "T" ? ["a", "b", "t", "t2", "c"] : ["a", "b", "p", "p2", "c"];
    const full = lane.map((k, i) => i ? P[k].replace(/^M/, "L") : P[k]).join(" ");
    const id = "rp" + Math.random().toString(36).slice(2, 8);
    s.append(h("path", { d: full, id, fill: "none", stroke: "none" }));
    s.append(h("circle", { r: 5.5, class: "puck" }, h("animateMotion", { dur: "1.5s", fill: "freeze", calcMode: "spline", keyTimes: "0;1", keySplines: ".4 0 .2 1" }, h("mpath", { href: "#" + id }))));
  }
  return h("div", { class: "railwrap" }, s);
}

/* ------------------------------------------------------------------ image stage with box layers */
function stage({ W, H, src, gt = [], sgBoxes = [], vl = [], vlOn = true, labels = {}, extra = [] }) {
  const wrap = h("div", { class: "stage", style: `aspect-ratio:${W}/${H};max-width:min(100%, calc(64vh * ${W} / ${H}))` });
  const inner = h("div", { class: "zoom" });
  if (src) {
    const img = h("img", { src, alt: "", draggable: "false" });
    img.addEventListener("error", () => { img.remove(); inner.prepend(h("div", { class: "empty" }, "The image is not stored on this machine. Boxes are drawn at their true positions.")); });
    inner.append(img);
  } else inner.append(h("div", { class: "empty" }, "The image is not stored on this machine. Boxes are drawn at their true positions."));
  const fs = Math.max(W, H) / 40;
  const ov = h("svg", { class: "ov", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  const layer = (cls, boxes, name, perBox) => {
    const g = h("g", { class: cls });
    boxes.forEach((b, i) => {
      const [x0, y0, x1, y1] = b;
      if (cls === "gt") g.append(h("rect", { class: "halo", x: x0, y: y0, width: x1 - x0, height: y1 - y0 }));
      g.append(h("rect", { class: "box", x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }));
      const label = perBox ? perBox[i] : boxes.length > 1 ? `${name} ${i + 1}` : name;
      const t = h("text", { x: x0 + 2 }, label);
      t._place = f => { t.setAttribute("y", cls === "gt" ? Math.min(H - 4, y1 + f * 1.05) : (cls === "vl" || cls === "b0") ? Math.min(H - 4, y1 - f * .35) : Math.max(f, y0 - f * .35));
        t.style.fontSize = `${f}px`; t.style.strokeWidth = `${f / 5}px`; };
      t._place(fs);
      g.append(t);
    });
    return g;
  };
  const layers = [];
  if (gt.length) layers.push(["gt", gt, labels.gt || "Ground truth"]);
  if (vl.length || labels.forceVl) layers.push(["vl", vl, labels.vl || "Qwen3-VL-8B"]);
  for (const x of extra) layers.push([x.cls, (x.boxes || []).filter(Boolean), x.name, x.off, x.labels]);
  if (!labels.noSg) layers.push(["sg", sgBoxes, labels.sg || "Spec-Guard"]);
  const groups = {};
  for (const [cls, boxes, name, , perBox] of layers) { groups[cls] = layer(cls, boxes, name, perBox); ov.append(groups[cls]); }
  inner.append(ov);
  wrap.append(inner);
  const toggles = h("div", { class: "layers", role: "group", "aria-label": "Show or hide boxes" });
  for (const [cls, boxes, name, off] of [...layers].reverse()) {
    const b = h("button", { type: "button", class: `layer ${cls}`, "aria-pressed": "true" }, h("i"), `${name} (${boxes.length})`);
    if ((cls === "vl" && !vlOn) || off) { b.setAttribute("aria-pressed", "false"); groups[cls].classList.add("hide"); }
    b.addEventListener("click", () => {
      const onNow = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", String(!onNow)); groups[cls].classList.toggle("hide", onNow);
    });
    toggles.append(b);
  }
  const dl = h("button", { type: "button", class: "layer", "aria-pressed": "false", title: "Save the image with the boxes that are switched on" }, "Download image");
  dl.addEventListener("click", () => {
    const img = $("img", wrap);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, W, H); else { g.fillStyle = "#eaeff2"; g.fillRect(0, 0, W, H); }
    const cs = getComputedStyle(document.documentElement);
    const col = { gt: cs.getPropertyValue("--gt"), sg: cs.getPropertyValue("--t"), vl: cs.getPropertyValue("--vlm"), pg: cs.getPropertyValue("--p"), b0: cs.getPropertyValue("--ink-2"), cand: cs.getPropertyValue("--warn") };
    const lw = Math.max(2, Math.round(Math.max(W, H) / 300));
    g.font = `600 ${Math.round(fs)}px sans-serif`;
    for (const [cls, boxes, name, , perBox] of layers) {
      if (groups[cls].classList.contains("hide")) continue;
      g.strokeStyle = g.fillStyle = (col[cls] || "#000").trim(); g.lineWidth = lw;
      g.setLineDash(cls === "gt" ? [lw * 3, lw * 2] : cls === "b0" || cls === "cand" ? [lw, lw * 2] : []);
      boxes.forEach((b, i) => { g.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); g.fillText(perBox ? perBox[i] : name, b[0] + 2, Math.max(fs, b[1] - fs * .3)); });
    }
    try { const a = document.createElement("a"); a.download = "specguard_answer.png"; a.href = c.toDataURL("image/png"); a.click(); }
    catch { liveError("The browser blocked saving this image."); }
  });
  toggles.append(dl);
  const all = layers.flatMap(l => l[1]);
  if (!all.length) toggles.append(h("span", { class: "small muted" }, "No boxes in this answer."));
  else {
    const x0 = Math.min(...all.map(b => b[0])), y0 = Math.min(...all.map(b => b[1])), x1 = Math.max(...all.map(b => b[2])), y1 = Math.max(...all.map(b => b[3]));
    const k = Math.min(4, 0.6 * Math.min(W / Math.max(8, x1 - x0), H / Math.max(8, y1 - y0)));
    if (k > 1.4) {
      const z = h("button", { type: "button", class: "layer", "aria-pressed": "false" }, "Zoom to the boxes");
      z.addEventListener("click", () => {
        const onNow = z.getAttribute("aria-pressed") === "true";
        z.setAttribute("aria-pressed", String(!onNow));
        const scaleText = q => { $$("text", ov).forEach(t => t._place(fs / q)); ov.style.setProperty("--z", q); };
        if (onNow) { inner.style.transform = ""; scaleText(1); return; }
        scaleText(k);
        const cx = (x0 + x1) / 2 / W, cy = (y0 + y1) / 2 / H;
        const tx = Math.min(0, Math.max(1 - k, 0.5 - cx * k)), ty = Math.min(0, Math.max(1 - k, 0.5 - cy * k));
        inner.style.transform = `translate(${(100 * tx).toFixed(2)}%, ${(100 * ty).toFixed(2)}%) scale(${k.toFixed(3)})`;
      });
      toggles.append(z);
    }
  }
  return h("div", {}, wrap, toggles);
}

/* ------------------------------------------------------------------ status, routing */
async function loadHealth() {
  try {
    S.health = await api("/health");
    const st = $("#status"), m = S.health.mode;
    const txt = m === "live" ? `Live on ${S.health.gpu ? S.health.gpu.name : "GPU"}` : S.health.static ? "Static showcase: archived runs" : m === "offline" ? "Offline: archived runs only" : "Interface test: models mocked";
    st.innerHTML = `<span class="dot ${m === "live" ? "live" : "off"}"></span><span class="txt">${esc(txt)}${S.health.busy ? ", running a query" : ""}</span>`;
    st.title = `Code ${S.health.commit}, started ${S.health.started}`;
    $("#foot-ver").textContent = `Code ${S.health.commit}. Service started ${S.health.started}.`;
  } catch {
    $("#status").innerHTML = `<span class="dot"></span><span class="txt">Service not reachable</span>`;
  }
}

const VIEWS = ["overview", "findings", "live", "explorer", "results", "models", "architecture", "about"];
function route() {
  const raw = location.hash.slice(1) || "overview";
  const [view, qs] = raw.split("?");
  const v = VIEWS.includes(view) ? view : "overview";
  for (const x of VIEWS) $(`#v-${x}`).classList.toggle("on", x === v);
  $$("nav.tabs a").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === `#${v}` ? "page" : "false"));
  const params = new URLSearchParams(qs || "");
  ({ overview: initOverview, findings: initFindings, live: initLive, explorer: () => initExplorer(params), results: initResults, models: initModels,
     architecture: initArch, about: initAbout })[v]();
  if (!params.get("row")) scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ overview */
async function initOverview() {
  if (S.inited.overview) return;
  S.inited.overview = true;
  const card = $("#ov-demo");
  card.append(h("p", { class: "muted small" }, "Loading an example from the test set"));
  try {
    const [sum, list] = await Promise.all([S.summary || api("/api/summary"), api("/api/rows?category=ordinal&variant=P4&outcome=router_right_vlm_wrong&limit=200")]);
    S.summary = sum;
    renderEvidence(sum);
    if (sum.by_model && !$("#ov-models")) {
      $(".steps").after(h("div", { id: "ov-models", class: "ovm" },
        h("h3", {}, "Every model in the work"),
        h("div", { class: "chips" }, ...sum.by_model.models.map(m => h("a", { class: "chip", href: "#models" }, h("b", {}, m.name), h("span", {}, m.family)))),
        h("a", { class: "linkbtn", href: "#results" }, "See the best result of every model")));
    }
    const pick = list.rows.find(r => r.f1_c5g < 1) || list.rows[0];
    if (!pick) { card.textContent = ""; return; }
    const r = await api(`/api/rows/${encodeURIComponent(pick.id)}`);
    card.textContent = "";
    card.append(
      h("p", { class: "small muted" }, "A paraphrased ordinal expression from the OpenRef test set"),
      h("p", { class: "q" }, `“${r.expression}”`),
      h("code", { class: "line" }, r.normalised || ""),
      rail({ route: r.route, guard: null, animate: true }),
      stage({ W: r.width, H: r.height, src: r.has_image ? orImg(r) : null, gt: r.gt, sgBoxes: r.router_boxes, vl: r.s1_boxes }),
      h("div", { class: "scores" },
        h("div", { class: "t" }, h("b", { class: "num" }, f2(r.f1_router)), h("span", {}, "Spec-Guard, route " + r.route)),
        h("div", { class: "p" }, h("b", { class: "num" }, f2(r.f1_c5g)), h("span", {}, "Generated program alone")),
        h("div", { class: "v" }, h("b", { class: "num" }, f2(r.f1_s1)), h("span", {}, "Qwen3-VL-8B"))),
      h("p", { class: "small muted" }, "F1 at IoU 0.5 for this row. The row was chosen by a fixed rule: the first in which the router is right and both alternatives are wrong. ",
        h("a", { href: `#explorer?row=${encodeURIComponent(r.id)}` }, "Open it in the explorer"), ", where the router’s failures are shown too.")
    );
  } catch (e) { card.textContent = e.message; }
}
function renderEvidence(sum) {
  const hd = sum.headline; if (!hd) return;
  const rcs = (sum.refcoco && sum.refcoco.specguard || []).filter(x => x.exp === "E24" && x.generator.endsWith("Lite, C5"));
  if (rcs.length && !$("#ov-rc")) {
    $("#ov-evidence").after(h("div", { class: "panel pad", id: "ov-rc", style: "margin-top:28px;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:28px;align-items:center" },
      h("div", {}, h("h3", { style: "font:600 24px/1.2 var(--cond)" }, "On RefCOCO, Spec-Guard decides when to trust the program"),
        h("p", { class: "muted", style: "margin-top:8px" }, "For single-object expressions a property test and the whole-image rule check each program answer, and a rejected answer falls back to the detector. ",
          "On RefCOCO testB the detector alone is still ahead; on RefCOCO+ testB the two are level. ",
          h("a", { href: "#explorer?ds=refcoco" }, "Browse every RefCOCO row"), ".")),
      h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ...["Confirmation split (E24)", "Program", "Spec-Guard", "Detector only"].map((x, i) => h("th", { class: i ? "n" : "" }, x)))),
        h("tbody", {}, ...rcs.map(r => h("tr", {}, h("td", {}, r.split), h("td", { class: "n" }, f2(r.program)), h("td", { class: "n" }, f2(r.both)), h("td", { class: "n" }, f2(r.b0))))))));
  }
  const d = hd.router_minus_s1_all;
  $("#ov-evidence").replaceChildren(
    h("div", {}, h("div", { class: "fig num" }, f2(hd.router_all), h("small", {}, "F1")),
      h("p", {}, `On all ${hd.n_all.toLocaleString("en")} OpenRef test expressions. Qwen3-VL-8B scores ${f2(hd.s1_all)} on the same rows: a difference of ${sg(d.diff)} points, 95% interval ${sg(d.ci95[0])} to ${sg(d.ci95[1])}.`)),
    h("div", {}, h("div", { class: "fig num" }, f2(hd.router_para), h("small", {}, "F1")),
      h("p", {}, `On ordinal expressions reworded four ways. Generated programs alone score ${f2(hd.c5g_para)} and Qwen3-VL-8B ${f2(hd.s1_para)}.`)),
    h("div", {}, h("div", { class: "fig num" }, f2(hd.router_ordinal), h("small", {}, "F1")),
      h("p", {}, `On ordinal expressions in template form, where Qwen3-VL-8B scores ${f2(hd.s1_ordinal)}. Single-target expressions remain better served by Qwen3-VL-8B; see Results.`))
  );
}

/* ------------------------------------------------------------------ live */
const L = { sel: null, runs: [], timer: null, mode: "openref" };
const MODE_NOTE = {
  openref: "The registered E28 router: normaliser, decidable route, template program or generated program (C5-G), sandboxed execution. Answers may be several boxes.",
  refcoco: "The registered E24 Spec-Guard: a generated program, the whole-image rule and a property test; when a check fails, the answer falls back to the detector’s top box for the full expression. One box."
};
async function initLive() {
  if (S.inited.live) return;
  S.inited.live = true;
  const off = S.health && S.health.mode === "offline";
  L.rec = STATIC ? await sget("data/recorded.json").catch(() => null) : null;
  L.replay = !!(L.rec && Object.keys(L.rec.runs).length);
  if (L.replay) {
    $("#live-off").append(h("div", { class: "notice", style: "margin-bottom:20px" },
      h("b", {}, "Recorded runs. "),
      `This public page has no GPU, so Run replays the answers the live service gave on ${L.rec.recorded_at.slice(0, 10)} (${L.rec.service.gpu}, code ${L.rec.service.commit}), unchanged. `,
      "Choose one of the images below; the chips under the expression list what was recorded for it. A new image or a new expression needs the live service."));
  } else if (off) {
    $("#live-off").append(h("div", { class: "notice", style: "margin-bottom:20px" },
      h("b", {}, "This instance has no GPU attached, so live queries are switched off. "),
      "The explorer replays every archived test row of OpenRef and the RefCOCO family, and Results and Architecture are complete. ",
      h("a", { href: "#explorer" }, "Open the explorer")));
    $("#run").disabled = true;
  }
  const vlmOk = S.health && S.health.vlm;
  $("#opt-vlm").disabled = !vlmOk;
  if (!vlmOk) $("#vlm-note").textContent = "Not loaded in this session. Start the service with --with-vlm to enable it.";
  S.version = S.version || await api("/api/version");
  const loaded = new Set(S.version.coders_loaded || []);
  $("#opt-writer").replaceChildren(...Object.entries(S.version.coders).map(([k, v]) =>
    h("option", { value: k, disabled: loaded.has(k) ? null : true }, loaded.has(k) ? v : `${v} (not loaded)`)));
  if (!loaded.has("deepseek")) $("#pt-note").textContent = "Needs DeepSeek-Coder-V2-Lite, which is not loaded in this session. Without it only the whole-image rule applies (E21).";
  $$("#live-mode button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.v)));
  try { S.examples = await api("/api/examples"); } catch { S.examples = { openref: [], refcoco: [] }; }
  setMode("openref");
  const drop = $("#drop"), file = $("#file");
  drop.addEventListener("click", () => file.click());
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  file.addEventListener("change", () => file.files[0] && useFile(file.files[0]));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) useFile(f); });
  document.addEventListener("paste", e => {
    if (!$("#v-live").classList.contains("on")) return;
    const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (f) useFile(f);
  });
  $("#query").addEventListener("input", qcount);
  $("#query").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("#live-form").requestSubmit(); } });
  $("#live-form").addEventListener("submit", e => { e.preventDefault(); runLive(); });
  $("#runall").addEventListener("click", runAll);
  if (off && !L.replay) $("#runall").disabled = true;
}
const SUGG = {
  openref: ["the third person from the left", "the first person from the right", "person", "the second bottle from the left in the top row", "the topmost apple of the first column from the left"],
  refcoco: ["man holding the framed photo", "bouquet of flowers", "person on the far left", "the man in the middle", "framed certificate on the wall"]
};
function renderSugg() {
  const recq = L.replay ? (L.rec.queries[selKey(L.sel)] || {})[L.mode] : null;
  const list = L.replay ? (recq || []) : SUGG[L.mode];
  $("#sugg").replaceChildren(h("span", { class: "small muted" }, L.replay ? (recq ? "Recorded:" : "Choose an image to see its recorded expressions.") : "Try:"), ...list.map(q =>
    h("button", { type: "button", class: "sg-chip", onclick: () => { $("#query").value = q; qcount(); $("#query").focus(); } }, q)));
}
function setMode(m) {
  L.mode = m;
  $$("#live-mode button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === m)));
  $("#mode-note").textContent = MODE_NOTE[m];
  renderSugg();
  $("#cond-wrap").hidden = m !== "refcoco";
  $("#pt-wrap").hidden = m !== "refcoco";
  $("#fb-wrap").hidden = m !== "openref";
  const loaded = new Set(S.version.coders_loaded || []);
  const want = m === "openref" ? "qwen" : (loaded.has("deepseek") ? "deepseek" : "qwen");
  $("#opt-writer").value = want;
  $("#query").placeholder = m === "openref" ? "the topmost peach of the fifth column from the left" : "man in the red shirt on the left";
  const box = $("#examples"); box.replaceChildren();
  const list = [...(m === "openref" ? S.examples.openref : S.examples.refcoco),
    ...(S.examples.recorded || []).map(x => ({ ...x, recorded: true, has_image: true, note: x.title,
      expression: ((L.rec && L.rec.queries[x.key]) || {})[m]?.[0] || "" }))];
  for (const ex of list) {
    const src = ex.recorded ? ex.static_img : m === "openref" ? orImg(ex) : rcImg(ex, ex.split, ex.index);
    const img = ex.has_image ? h("img", { src, alt: "" }) : h("span", { class: "ph" });
    const b = h("button", { type: "button", class: "ex", "aria-pressed": "false", "data-key": ex.recorded ? ex.key : null }, img, h("span", { class: "ext" }, h("b", {}, ex.note || ex.category), h("span", {}, ex.expression)));
    if (!ex.has_image) { b.disabled = true; b.title = "Image not stored on this machine"; }
    b.addEventListener("click", () => {
      $$(".ex").forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true");
      L.sel = ex.recorded ? { kind: "recorded", key: ex.key, src } : m === "openref" ? { kind: "example", id: ex.id, src } : { kind: "rcexample", split: ex.split, index: ex.index, src };
      $("#query").value = ex.expression; qcount(); showThumb(src); renderSugg();
    });
    box.append(b);
  }
  renderLiveIdle();
}
function qcount() { $("#qcount").textContent = `${$("#query").value.length} / 200`; }
function showThumb(src) {
  $("#drop-inner").replaceChildren(h("img", { class: "thumb", src, alt: "Selected image" }), h("span", { class: "small" }, "Click or drop to replace"));
}
async function useFile(f) {
  if (!f.type.startsWith("image/") && !/\.(jfif|jpe?g|png|webp)$/i.test(f.name)) { liveError("Choose a JPEG or PNG image."); return; }
  liveError("");
  $$(".ex").forEach(x => x.setAttribute("aria-pressed", "false"));
  const src = URL.createObjectURL(f);
  L.sel = { kind: "file", file: f, src };
  if (L.replay) {
    // On the public page an upload can be replayed only if it is the same file as a recorded photograph.
    let hit = null;
    try {
      const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()))].map(b => b.toString(16).padStart(2, "0")).join("");
      hit = (S.examples.recorded || []).find(x => x.sha256 === hex);
    } catch { /* no Web Crypto (plain http): treated as a new image */ }
    if (hit) {
      L.sel = { kind: "recorded", key: hit.key, src };
      $$(".ex").forEach(x => { if (x.dataset.key === hit.key) x.setAttribute("aria-pressed", "true"); });
      $("#query").value = ((L.rec.queries[hit.key] || {})[L.mode] || [""])[0]; qcount();
    } else {
      liveError("This image was not recorded on the live service, so this public page cannot answer for it. Choose one of the images above, or use the live service for a new image.");
    }
  }
  showThumb(src); renderSugg();
}
function liveError(msg) { $("#live-err").replaceChildren(msg ? h("div", { class: "notice err" }, msg) : ""); }
function renderLiveIdle() {
  $("#live-rail").replaceChildren(L.mode === "openref" ? rail({}) : rail2({}));
  $("#live-body").replaceChildren(h("div", { class: "placeholder" }, h("div", {},
    h("h3", {}, "No query yet"),
    h("p", { style: "margin-top:6px" }, "Choose an example on the left, or upload an image and type an expression. The answer, the program that ran and every check will appear here."))));
}
async function runLive() {
  liveError("");
  const q = $("#query").value.trim();
  if (!L.sel) return liveError("Add an image first: pick an example or upload one.");
  if (!q) return liveError("Type a referring expression.");
  const fd = new FormData();
  fd.append("query", q);
  fd.append("mode", L.mode);
  fd.append("writer", $("#opt-writer").value);
  if (L.sel.kind === "example") fd.append("example_id", L.sel.id);
  else if (L.sel.kind === "rcexample") { fd.append("example_split", L.sel.split); fd.append("example_index", L.sel.index); }
  else if (L.sel.kind === "recorded") fd.append("recorded", L.sel.key);
  else fd.append("image", L.sel.file);
  fd.append("vlm", $("#opt-vlm").checked ? "true" : "false");
  fd.append("fallback", $("#opt-fb").checked ? "true" : "false");
  fd.append("condition", $("#opt-cond").value);
  fd.append("proptest", $("#opt-pt").checked ? "true" : "false");
  const btn = $("#run"); btn.disabled = true;
  const t0 = performance.now();
  $("#live-rail").replaceChildren(L.mode === "openref" ? rail({ busy: true }) : rail2({ busy: true }));
  const counter = h("span", { class: "num" }, "0.0 s");
  $("#live-body").replaceChildren(h("div", { class: "placeholder" }, h("div", {}, h("span", { class: "spin" }), L.replay ? " Replaying the recorded run " : " Running on the GPU ", counter)));
  L.timer = setInterval(() => (counter.textContent = ((performance.now() - t0) / 1000).toFixed(1) + " s"), 100);
  try {
    const rec = await api("/api/run", { method: "POST", body: fd });
    const run = { rec, src: L.sel.src, query: q, at: new Date() };
    L.runs.unshift(run);
    renderRun(run, true);
    renderHistory();
  } catch (e) {
    liveError(e.message); renderLiveIdle();
  } finally {
    clearInterval(L.timer); btn.disabled = S.health && S.health.mode === "offline" && !L.replay; loadHealth();
  }
}
function formFor(mode, q, extra = {}) {
  const fd = new FormData();
  fd.append("query", q); fd.append("mode", mode);
  if (L.sel.kind === "example") fd.append("example_id", L.sel.id);
  else if (L.sel.kind === "rcexample") { fd.append("example_split", L.sel.split); fd.append("example_index", L.sel.index); }
  else if (L.sel.kind === "recorded") fd.append("recorded", L.sel.key);
  else fd.append("image", L.sel.file);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}
async function runAll() {
  liveError("");
  const q = $("#query").value.trim();
  if (!L.sel) return liveError("Add an image first: pick an example or upload one.");
  if (!q) return liveError("Type a referring expression.");
  const loaded = new Set(S.version.coders_loaded || []);
  const vlm = !!(S.health && S.health.vlm);
  const plan = [
    { key: "or", title: "OpenRef router (E28)", mode: "openref", extra: { writer: "qwen" } },
    { key: "rc", title: "RefCOCO Spec-Guard (E24)", mode: "refcoco", extra: { writer: loaded.has("deepseek") ? "deepseek" : "qwen", condition: "c5", proptest: "true", vlm: vlm ? "true" : "false" } }
  ];
  $("#run").disabled = $("#runall").disabled = true;
  const cards = {};
  const grid = h("div", { class: "cmpgrid" });
  for (const p of plan) { cards[p.key] = h("div", { class: "cmpcard" }, h("h3", {}, p.title), h("div", { class: "placeholder", style: "min-height:200px" }, h("div", {}, h("span", { class: "spin" }), " waiting"))); grid.append(cards[p.key]); }
  if (vlm) { cards.vl = h("div", { class: "cmpcard" }, h("h3", {}, "Qwen3-VL-8B (end to end)"), h("div", { class: "placeholder", style: "min-height:200px" }, "comes with the RefCOCO run")); grid.append(cards.vl); }
  $("#live-rail").replaceChildren();
  $("#live-body").replaceChildren(h("p", { class: "qecho" }, `\u201c${q}\u201d`), h("p", { class: "small muted", style: "margin-bottom:12px" }, "The same image and expression through every method loaded in this session. Select a card to open its full record."), grid);
  const src = L.sel.src;
  try {
    for (const p of plan) {
      $(".placeholder", cards[p.key]).replaceChildren(h("div", {}, h("span", { class: "spin" }), L.replay ? " replaying" : " running on the GPU"));
      const rec = await api("/api/run", { method: "POST", body: formFor(p.mode, q, p.extra) });
      const run = { rec, src, query: q, at: new Date() };
      L.runs.unshift(run);
      const [W, H] = rec.image_size;
      const fired = Object.entries(rec.spec_guard).filter(([, v]) => v.fires).length;
      const verdict = rec.mode === "refcoco" ? (rec.routed ? "Fell back to the detector" : "Program answer kept") : `Route ${rec.route}, ${rec.answer_boxes.length} box${rec.answer_boxes.length === 1 ? "" : "es"}`;
      cards[p.key].replaceChildren(h("h3", {}, p.title),
        h("div", { class: "cmpmeta" }, h("span", { class: `tag ${fired ? "warn" : "ok"}` }, fired ? `${fired} check${fired > 1 ? "s" : ""} fired` : "checks pass"), h("span", { class: "small" }, verdict), h("span", { class: "small muted num" }, `${(rec.total_ms / 1000).toFixed(1)} s`)),
        stage({ W, H, src, gt: rec.example ? rec.example.gt : [], sgBoxes: rec.answer_boxes, labels: { sg: p.key === "or" ? "Router" : "Spec-Guard" } }),
        h("button", { type: "button", class: "linkbtn", onclick: () => renderRun(run, false) }, "Open the full record"));
      if (p.key === "rc" && cards.vl) {
        cards.vl.replaceChildren(h("h3", {}, "Qwen3-VL-8B (end to end)"),
          h("div", { class: "cmpmeta" }, h("span", { class: "tag vlm" }, "no program, no checks"), h("span", { class: "small muted num" }, rec.stages_ms.vlm ? `${(rec.stages_ms.vlm / 1000).toFixed(1)} s` : "")),
          stage({ W, H, src, gt: rec.example ? rec.example.gt : [], sgBoxes: [], vl: (rec.vlm || {}).boxes || [], labels: { noSg: true, forceVl: true } }));
      }
    }
    renderHistory();
  } catch (e) { liveError(e.message); }
  finally { $("#run").disabled = $("#runall").disabled = S.health && S.health.mode === "offline" && !L.replay; loadHealth(); }
}
function renderHistory() {
  $("#hist-wrap").hidden = L.runs.length < 2;
  $("#history").replaceChildren(...L.runs.map(r => {
    const b = h("button", { type: "button" }, h("span", {}, r.query.length > 44 ? r.query.slice(0, 42) + "…" : r.query),
      h("span", {}, `${r.rec.mode === "refcoco" ? "RefCOCO" : "OpenRef"}, ${(r.rec.total_ms / 1000).toFixed(1)} s`));
    b.addEventListener("click", () => renderRun(r, false));
    return b;
  }));
}
const recTag = r => r._recorded ? h("span", { class: "tag", title: `Answer of the live service, recorded ${r._recorded.at} on ${r._recorded.gpu}, code ${r._recorded.commit}` }, `Recorded run, ${r._recorded.at.slice(0, 10)}`) : null;
function renderRun(run, animate) {
  const r = run.rec;
  if (r.mode === "refcoco") return renderRunRefcoco(run, animate);
  const fired = Object.entries(r.spec_guard).filter(([, v]) => v.fires).map(([k]) => k.split(" ")[0]);
  $("#live-rail").replaceChildren(rail({ route: r.route, guard: fired.length ? "warn" : "ok", animate }));
  const [W, H] = r.image_size;
  const head = h("div", { class: "result-head" },
    h("span", { class: "big" }, `${r.answer_boxes.length} ${r.answer_boxes.length === 1 ? "box" : "boxes"}`),
    h("span", { class: `tag ${r.route === "T" ? "t" : "p"}` }, r.route === "T" ? "Route T: template program" : "Route P: generated program"),
    fired.length ? h("span", { class: "tag warn" }, `Fired: ${fired.join(", ")}`) : h("span", { class: "tag ok" }, "All checks pass"),
    r.fallback_used ? h("span", { class: "tag warn" }, "Fallback answer") : null,
    recTag(r),
    h("span", { class: "stat" }, "Total ", h("b", { class: "num" }, `${(r.total_ms / 1000).toFixed(2)} s`)),
    h("span", { class: "stat" }, "Peak GPU ", h("b", { class: "num" }, r.peak_gpu_mib ? `${r.peak_gpu_mib.toLocaleString("en")} MiB` : "n/a")));
  const st = stage({ W, H, src: run.src, gt: r.example ? r.example.gt : [], sgBoxes: r.answer_boxes, vl: r.vlm ? r.vlm.boxes : [],
    labels: { forceVl: !!r.vlm } });
  const tabs = [
    ["Checks", () => checksPanel(r)],
    ["Program", () => codeBlock("Program that ran", r.program, r.program_source)],
    ["Timing", () => timingPanel(r)],
    ["Perception calls", () => tracePanel(r)],
    ["Record", () => recordPanel(r)]
  ];
  $("#live-body").replaceChildren(...[h("p", { class: "qecho" }, `“${r.query}”`), head, explainOpenref(r), st, tabset(tabs)].filter(Boolean));
}
function explainOpenref(r) {
  // A plain-language reading of the record: what went wrong, and the one-click next step.
  const empty = r.trace.filter(t => t.call === "find" && t.n_out === 0).map(t => `find("${t.argument}")`);
  const whole = Object.values(r.spec_guard).some(v => v.fires && /whole image/.test(v.reason));
  const g2 = r.spec_guard["G2 query preservation in find()"];
  let msg = null;
  if (whole && empty.length) msg = `${empty.join(", ")} found nothing above the detector threshold (${S.version.tau}), so the program returned the whole image instead of an object. Spec-Guard flags this (G4). OpenRef reports the checks without acting on them; the RefCOCO single-object mode, or the fallback switch, answers with the detector’s top box instead.`;
  else if (whole) msg = "The program returned the whole image, which Spec-Guard flags (G4). The RefCOCO single-object mode, or the fallback switch, replaces such an answer with the detector’s top box.";
  else if (!r.answer_boxes.length) msg = "The program returned no box. The RefCOCO single-object mode always returns one box, falling back to the detector when a check fails.";
  if (!msg) return null;
  const again = (fn) => () => { fn(); $("#live-form").requestSubmit(); };
  return h("div", { class: "decision fb" },
    h("b", {}, "What happened. "), msg,
    g2 && g2.fires ? h("div", { class: "small", style: "margin-top:6px" }, `G2 also fired (${g2.reason}): some words of the expression never reached a detector call.`) : null,
    h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:10px" },
      h("button", { type: "button", class: "btn", onclick: again(() => { const q = $("#query").value; setMode("refcoco"); $("#query").value = q; qcount(); }) }, "Run in RefCOCO single-object mode"),
      h("button", { type: "button", class: "btn", onclick: again(() => { $("#opt-fb").checked = true; }) }, "Run again with the fallback")));
}
function renderRunRefcoco(run, animate) {
  const r = run.rec;
  const fired = Object.entries(r.spec_guard).filter(([, v]) => v.fires).map(([k]) => k.split(" (")[0]);
  $("#live-rail").replaceChildren(rail2({ routed: r.routed, guard: r.routed ? "warn" : "ok", animate, writer: S.version.coders[r.writer], cond: r.condition }));
  const [W, H] = r.image_size;
  const head = h("div", { class: "result-head" },
    h("span", { class: "big" }, r.routed ? "Detector answer" : "Program answer"),
    h("span", { class: `tag ${r.routed ? "warn" : "ok"}` }, r.routed ? "Spec-Guard fell back" : "Spec-Guard accepted the program"),
    h("span", { class: "tag p" }, `${S.version.coders[r.writer]}, ${r.condition.toUpperCase()}`),
    recTag(r),
    h("span", { class: "stat" }, "Total ", h("b", { class: "num" }, `${(r.total_ms / 1000).toFixed(2)} s`)),
    h("span", { class: "stat" }, "Peak GPU ", h("b", { class: "num" }, r.peak_gpu_mib ? `${r.peak_gpu_mib.toLocaleString("en")} MiB` : "n/a")));
  const st = stage({ W, H, src: run.src, gt: r.example ? r.example.gt : [], sgBoxes: r.answer_boxes, vl: r.vlm ? r.vlm.boxes : [],
    labels: { forceVl: !!r.vlm, sg: "Spec-Guard answer" },
    extra: [{ cls: "pg", name: "Program", boxes: r.program_box ? [r.program_box] : [], off: !r.routed },
            { cls: "b0", name: "Detector only", boxes: r.b0_box ? [r.b0_box] : [], off: r.routed },
            { cls: "cand", name: "Detector candidates", boxes: (r.b0_candidates || []).map(c => c.box), off: true,
              labels: (r.b0_candidates || []).map((c, k) => `#${k + 1}${c.score != null ? " " + c.score.toFixed(2) : ""}`) }] });
  const dec = h("div", { class: `decision ${r.routed ? "fb" : ""}` },
    r.routed ? `Spec-Guard replaced the program’s answer with the detector’s top box because ${r.route_reasons.join(" and ")}.`
      : "Every check passed, so Spec-Guard kept the program’s answer.");
  const tabs = [
    ["Checks", () => h("div", {}, ...Object.entries(r.spec_guard).map(([k, v]) =>
      chk(/not applicable/.test(v.reason) ? "na" : v.fires ? "warn" : "ok", k, v.reason === "passed" ? "Passed." : v.reason)),
      r.execution.error ? chk("warn", "Execution", r.execution.error) : null,
      h("p", { class: "note" }, "The registered system on RefCOCO (E24) acts on the whole-image rule and the property test. G1 and G2 are shown for reference."))],
    ["Program", () => codeBlock("Program that ran", r.program, r.program_source)],
    ["Detector candidates", () => (r.b0_candidates || []).length ? h("div", {},
      h("p", { class: "small muted", style: "margin-bottom:10px" }, "The detector’s five best boxes for the full expression, with SAM 3 scores. The fallback answer is candidate 1. Shown to explain the answer; it is not part of the method. Switch on “Detector candidates” under the image to draw them."),
      h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Rank"), h("th", { class: "n" }, "Score"), h("th", {}, "Box (x0, y0, x1, y1)"))),
        h("tbody", {}, ...r.b0_candidates.map((c, k) => h("tr", {}, h("td", {}, `#${k + 1}`), h("td", { class: "n" }, c.score != null ? c.score.toFixed(3) : "n/a"),
          h("td", { class: "num" }, c.box.map(v => Math.round(v)).join(", "))))))) : h("p", { class: "muted" }, "No candidates recorded.")],
    ["Property test", () => r.property_test.code ? codeBlock("Property test", r.property_test.code, `Written by DeepSeek-Coder-V2-Lite from the expression alone; outcome: ${r.property_test.outcome}${r.property_test.detail ? `, ${r.property_test.detail}` : ""}.`)
      : h("p", { class: "muted" }, r.property_test.generated ? "No test could be extracted from the model output." : "Not run in this session.")],
    ["Timing", () => timingPanel(r)],
    ["Perception calls", () => tracePanel(r)],
    ["Record", () => recordPanel(r)]
  ];
  $("#live-body").replaceChildren(h("p", { class: "qecho" }, `“${r.query}”`), head, dec, st, tabset(tabs));
}
function rail2(state = {}) {
  // RefCOCO Spec-Guard: program, execution, checks, then a switch between the program's answer and the detector's.
  const { routed = null, busy = false, guard = null, animate = false, writer = "Program writer", cond = "" } = state;
  const s = h("svg", { class: "rail", viewBox: "0 0 760 166", role: "img",
    "aria-label": routed === null ? "Pipeline: program, execution, checks, answer or detector fallback" : routed ? "The detector fallback was used" : "The program's answer was kept" });
  const P = { a: "M92 83 H108", b: "M232 83 H246", c: "M354 83 H368", s1: "M500 83 H520",
    t: "M526 83 C 540 83, 540 32, 556 32", p: "M526 83 C 540 83, 540 134, 556 134" };
  const cls = k => routed === null ? "trk" : k === "t" ? (!routed ? "trk on-t" : "trk dim") : k === "p" ? (routed ? "trk on-p" : "trk dim") : "trk on";
  for (const [k, d] of Object.entries(P)) s.append(h("path", { d, class: cls(k) }));
  const node = (x, y, w, t1, t2, c) => h("g", { class: `node ${c}` }, h("rect", { x, y, width: w, height: 52, rx: 8 }),
    h("text", { x: x + 11, y: y + 22 }, t1), h("text", { x: x + 11, y: y + 40, class: "s" }, t2));
  const on = routed === null ? "" : "on";
  s.append(node(0, 57, 92, "Input", "image, text", on));
  const short = { "Qwen2.5-Coder-7B": "Qwen 7B", "DeepSeek-Coder-V2-Lite": "DeepSeek Lite", "Yi-Coder-9B": "Yi 9B" }[writer] || "code model";
  s.append(node(108, 57, 124, "Program", cond ? `${short}, ${cond.toUpperCase()}` : "code model", (busy ? "busy " : "") + on));
  s.append(node(246, 57, 108, "Execution", "sandbox, SAM 3", on));
  s.append(node(368, 57, 132, "Spec-Guard", guard === "warn" ? "a check failed" : guard === "ok" ? "checks pass" : "rule, property test", guard === "warn" ? "warn" : guard === "ok" ? "ok" : ""));
  s.append(node(556, 6, 204, "Program answer", "kept when every check passes", routed === false ? "t on" : routed ? "dim" : ""));
  s.append(node(556, 108, 204, "Detector only (B0)", "top box for the full expression", routed ? "p on" : routed === false ? "dim" : ""));
  const ang = routed === false ? -40 : routed ? 40 : 0;
  const col = routed === false ? "var(--t)" : routed ? "var(--p)" : "var(--ink)";
  s.append(h("g", { style: `transform-origin:520px 83px;transform:rotate(${ang}deg);transition:transform .55s cubic-bezier(.3,1.4,.5,1)` },
    h("line", { x1: 520, y1: 83, x2: 540, y2: 83, style: `stroke:${col};stroke-width:3.5;stroke-linecap:round` })));
  s.append(h("circle", { cx: 520, cy: 83, r: 6.5, class: "sw" }));
  if (animate && routed !== null && !reduced) {
    const lane = ["a", "b", "c", "s1", routed ? "p" : "t"];
    const full = lane.map((k, i) => i ? P[k].replace(/^M/, "L") : P[k]).join(" ");
    const id = "rq" + Math.random().toString(36).slice(2, 8);
    s.append(h("path", { d: full, id, fill: "none", stroke: "none" }));
    s.append(h("circle", { r: 5.5, class: "puck" }, h("animateMotion", { dur: "1.4s", fill: "freeze", calcMode: "spline", keyTimes: "0;1", keySplines: ".4 0 .2 1" }, h("mpath", { href: "#" + id }))));
  }
  return h("div", { class: "railwrap" }, s);
}
function tabset(tabs) {
  const bar = h("div", { class: "tabset", role: "tablist" }), panel = h("div", { class: "tabpanel", role: "tabpanel" });
  tabs.forEach(([name, fn], i) => {
    const b = h("button", { type: "button", role: "tab", "aria-selected": i === 0 ? "true" : "false" }, name);
    b.addEventListener("click", () => { $$("button", bar).forEach(x => x.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true"); panel.replaceChildren(fn()); });
    bar.append(b);
  });
  panel.append(tabs[0][1]());
  return h("div", {}, bar, panel);
}
function checksPanel(r) {
  const items = [];
  const tm = r.template;
  items.push(chk(r.route === "T" ? "ok" : "na", "Normaliser and route",
    h("span", {}, h("code", { class: "line", style: "margin:4px 0 6px" }, r.normalised || "(empty line)"),
      tm ? `Parsed: noun “${tm.noun}”, clauses ${tm.clauses.map(c => `${c[0]} ${c[1]}${c[2] ? " " + c[2] : ""}`).join("; ")}. ` : "",
      `Route ${r.route}: ${r.route_reason}.`)));
  for (const [k, v] of Object.entries(r.spec_guard)) {
    const na = /not applicable/.test(v.reason);
    items.push(chk(na ? "na" : v.fires ? "warn" : "ok", k, v.reason === "passed" ? "Passed." : v.reason));
  }
  if (r.execution.error) items.push(chk("warn", "Execution", r.execution.error));
  return h("div", {}, ...items,
    h("p", { class: "note" }, "G1 checks the program’s output contract. G2 checks that every content word of the expression reaches some find() call. G4 is the single-referent fallback condition. On OpenRef the registered system reports these checks and does not act on them unless the fallback option is on."));
}
function chk(kind, title, body) {
  return h("div", { class: "check" }, h("span", { class: `ic ${kind}`, "aria-hidden": "true" }, kind === "ok" ? "✓" : kind === "warn" ? "!" : "–"),
    h("h4", {}, title, h("span", { class: "sr" }, kind === "ok" ? " passes" : kind === "warn" ? " fires" : " not applicable")), h("p", {}, body));
}
function timingPanel(r) {
  const stages = Object.entries(r.stages_ms), total = r.total_ms || 1;
  const names = { normaliser: "Normaliser", route: "Route", program: "Program", execution: "Execution", fallback: "Fallback", vlm: "Qwen3-VL-8B", "test generation": "Test written", "test execution": "Test run", "detector only": "Detector only" };
  const grid = h("div", { class: "wf" });
  let off = 0;
  for (const [k, ms] of stages) {
    const cls = k === "program" ? (r.route === "T" ? "t" : "p") : k === "vlm" ? "vlm" : k.startsWith("test") ? "t" : "";
    grid.append(h("span", {}, names[k] || k),
      h("span", { class: "tr" }, h("i", { class: cls, style: `left:${(100 * off / total).toFixed(2)}%;width:${Math.max(.4, 100 * ms / total).toFixed(2)}%` })),
      h("span", { class: "r" }, ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`));
    off += ms;
  }
  grid.append(h("b", {}, "Total"), h("span"), h("b", { class: "r num" }, `${(total / 1000).toFixed(2)} s`));
  return h("div", {}, grid, h("p", { class: "note" }, "Wall-clock time of this run on this node. Latency for the dissertation comes only from the fixed 100-row benchmark (deploy/bench.py), not from single demo runs."));
}
function tracePanel(r) {
  if (!r.trace.length) return h("p", { class: "muted" }, "The program made no perception calls.");
  return h("div", { class: "scroll" }, h("table", { class: "tbl" },
    h("thead", {}, h("tr", {}, h("th", {}, "Call"), h("th", {}, "Argument"), h("th", { class: "n" }, "Outputs"), h("th", { class: "n" }, "Time"))),
    h("tbody", {}, ...r.trace.map(t => h("tr", {}, h("td", {}, h("code", {}, t.call)), h("td", {}, t.argument ?? ""),
      h("td", { class: "n" }, t.n_out ?? ""), h("td", { class: "n" }, `${t.ms} ms`))))));
}
function recordPanel(r) {
  const json = JSON.stringify(r, null, 1);
  const a = h("a", { class: "btn", download: `specguard_run_${Date.now()}.json`, href: URL.createObjectURL(new Blob([json], { type: "application/json" })) }, "Download the record");
  return h("div", {}, h("p", { class: "small muted", style: "margin-bottom:10px" }, "The full audit record of this run, without the image. Nothing is stored on the server."),
    a, h("pre", { class: "code", style: "margin-top:12px" }, json));
}

/* ------------------------------------------------------------------ explorer */
const X = { cat: "ordinal", variant: "P4", outcome: "router_right_vlm_wrong", q: "", rows: [], total: 0, offset: 0, cur: null };
function initExplorer(params) {
  if (!S.inited.xds) {
    S.inited.xds = true;
    $$("#x-ds button").forEach(b => b.addEventListener("click", () => setDs(b.dataset.v, new URLSearchParams())));
    document.addEventListener("keydown", e => {
      if (!$("#v-explorer").classList.contains("on") || /input|textarea|select/i.test(e.target.tagName) || X.ds !== "refcoco") return;
      if (e.key === "j" || e.key === "k") { e.preventDefault(); rcStep(e.key === "j" ? 1 : -1); }
    });
  }
  setDs(params.get("ds") === "refcoco" ? "refcoco" : (X.ds || "openref"), params);
}
function setDs(ds, params) {
  X.ds = ds;
  $$("#x-ds button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === ds)));
  $("#orx").hidden = ds !== "openref"; $("#rcx").hidden = ds !== "refcoco";
  if (ds === "refcoco") initRcx(params); else initOpenrefExplorer(params);
}
function initOpenrefExplorer(params) {
  const want = params.get("row");
  if (!S.inited.explorer) {
    S.inited.explorer = true;
    $$("#f-cat button").forEach(b => b.addEventListener("click", () => {
      $$("#f-cat button").forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true");
      X.cat = b.dataset.v;
      if (X.cat !== "ordinal" && X.cat !== "all") { $("#f-var").value = "all"; X.variant = "all"; }
      loadRows(true);
    }));
    $("#f-var").addEventListener("change", e => { X.variant = e.target.value; loadRows(true); });
    $("#f-out").addEventListener("change", e => { X.outcome = e.target.value; loadRows(true); });
    let t; $("#f-q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { X.q = e.target.value; loadRows(true); }, 220); });
    $("#rows-more").addEventListener("click", () => loadRows(false));
    $("#rows-rand").addEventListener("click", async () => {
      const qs = new URLSearchParams({ category: X.cat, variant: X.variant, outcome: "all", q: X.q, offset: Math.floor(Math.random() * 1e9) % Math.max(1, X.allTotal || 1), limit: 1 });
      const d = await api(`/api/rows?${qs}`); if (d.rows[0]) showRow(d.rows[0].id);
    });
    document.addEventListener("keydown", e => {
      if (!$("#v-explorer").classList.contains("on") || /input|textarea|select/i.test(e.target.tagName) || X.ds === "refcoco") return;
      if (e.key === "j" || e.key === "k") { e.preventDefault(); step(e.key === "j" ? 1 : -1); }
    });
    loadRows(true, want);
  } else if (want && want !== X.cur) showRow(want);
}
async function loadRows(reset, want) {
  if (reset) { X.offset = 0; X.rows = []; }
  const qs = new URLSearchParams({ category: X.cat, variant: X.variant, outcome: X.outcome, q: X.q, offset: X.offset, limit: 80 });
  const d = await api(`/api/rows?${qs}`);
  X.total = d.total; X.rows.push(...d.rows); X.offset += d.rows.length;
  if (reset) { const all = await api(`/api/rows?${new URLSearchParams({ category: X.cat, variant: X.variant, outcome: "all", q: X.q, limit: 1 })}`); X.allTotal = all.total; }
  const list = $("#rows");
  if (reset) list.replaceChildren();
  for (const r of d.rows) list.append(rowItem(r));
  $("#rows-count").textContent = `${X.total.toLocaleString("en")} ${X.total === 1 ? "row" : "rows"}`;
  $("#rows-more").hidden = X.offset >= X.total;
  if (!X.rows.length) { list.replaceChildren(h("p", { class: "pad muted small" }, "No rows match these filters. Widen the outcome or phrasing.")); $("#detail").replaceChildren(); return; }
  if (reset) showRow(want || X.rows[0].id);
}
function rowItem(r) {
  const b = h("button", { class: "rowi", type: "button", role: "listitem", "data-id": r.id },
    h("div", { class: "e" }, r.expression),
    h("div", { class: "m" }, h("span", {}, `${r.category}, ${r.variant}`), h("span", {}, `route ${r.route}`),
      h("span", {}, "Spec-Guard ", h("span", { class: `mk ${r.f1_router === 1 ? "y" : "n"}` }, f2(r.f1_router))),
      h("span", {}, "Qwen3-VL ", h("span", { class: `mk ${r.f1_s1 === 1 ? "y" : "n"}` }, f2(r.f1_s1)))));
  b.addEventListener("click", () => showRow(r.id));
  return b;
}
function step(d) {
  const i = X.rows.findIndex(r => r.id === X.cur);
  const n = X.rows[Math.min(X.rows.length - 1, Math.max(0, i + d))];
  if (n) showRow(n.id);
}
async function showRow(id) {
  X.cur = id;
  $$(".rowi").forEach(b => b.setAttribute("aria-current", b.dataset.id === id ? "true" : "false"));
  const cur = $(`.rowi[data-id="${CSS.escape(id)}"]`); if (cur) cur.scrollIntoView({ block: "nearest" });
  if ($("#v-explorer").classList.contains("on")) history.replaceState(null, "", `#explorer?row=${encodeURIComponent(id)}`);
  const r = await api(`/api/rows/${encodeURIComponent(id)}`);
  if (X.cur !== id) return;
  const g = r.spec_guard_on_generated;
  const sib = r.siblings.length > 1 ? h("div", { style: "margin-top:18px" }, h("h3", { style: "margin-bottom:6px" }, "The same expression in five phrasings"),
    h("table", { class: "phr" }, h("tbody", {}, ...r.siblings.map(s => {
      const tr = h("tr", { "aria-current": s.id === r.id ? "true" : "false", tabindex: 0 },
        h("td", { class: "v" }, s.variant), h("td", {}, s.expression),
        h("td", { class: "num", style: "white-space:nowrap" }, h("span", { class: `mk ${s.f1_router === 1 ? "y" : "n"}` }, f2(s.f1_router)), h("span", { class: "muted" }, " / "),
          h("span", { class: `mk ${s.f1_s1 === 1 ? "y" : "n"}` }, f2(s.f1_s1))));
      tr.addEventListener("click", () => showRow(s.id));
      tr.addEventListener("keydown", e => e.key === "Enter" && showRow(s.id));
      return tr;
    }))), h("p", { class: "note" }, "F1 of Spec-Guard / Qwen3-VL-8B for each phrasing.")) : null;
  $("#detail").replaceChildren(
    h("p", { class: "expr" }, `“${r.expression}”`),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" },
      h("span", { class: "tag" }, r.category), h("span", { class: "tag" }, r.variant === "P0" ? "template phrasing" : `paraphrase ${r.variant}`),
      h("span", { class: `tag ${r.route === "T" ? "t" : "p"}` }, r.route === "T" ? "Route T: template program" : "Route P: generated program"),
      h("span", { class: "tag" }, r.id)),
    h("div", { class: "detail-grid" },
      h("div", {}, stage({ W: r.width, H: r.height, src: r.has_image ? orImg(r) : null, gt: r.gt, sgBoxes: r.router_boxes, vl: r.s1_boxes })),
      h("div", {},
        h("div", { class: "scores" },
          h("div", { class: "t" }, h("b", { class: "num" }, f2(r.f1_router)), h("span", {}, "Spec-Guard router")),
          h("div", { class: "p" }, h("b", { class: "num" }, f2(r.f1_c5g)), h("span", {}, "Generated program alone")),
          h("div", { class: "v" }, h("b", { class: "num" }, f2(r.f1_s1)), h("span", {}, "Qwen3-VL-8B"))),
        h("dl", { class: "kv" },
          h("dt", {}, "Normaliser line"), h("dd", {}, h("code", {}, r.normalised || "(none)")),
          h("dt", {}, "Route"), h("dd", {}, `${r.route}${r.route_registered !== r.route ? ` (before amendment 1 it was ${r.route_registered})` : ""}`),
          h("dt", {}, "Checks on the generated program"), h("dd", {}, `G1 ${g.G1.fires ? "fires" : "passes"}; G2 ${g.G2.fires ? "fires" : "passes"}${g.G2.fires ? ` (${g.G2.reason})` : ""}`),
          h("dt", {}, "Execution"), h("dd", { class: "num" }, `${r.execution.kind}, ${r.execution.exec_latency_s} s${r.execution.error ? `, ${r.execution.error}` : ""}`)),
        sib)),
    h("div", { class: "two-code" },
      codeBlock("Program the router ran", r.program, r.route === "T" ? "Built from the parse; no language model." : "Generated by Qwen2.5-Coder-7B with prompt C5-G."),
      codeBlock("Program generated for the same expression", r.generated_program, "Qwen2.5-Coder-7B, prompt C5-G (E25, E27).")),
    h("p", { class: "note" }, "F1 at IoU 0.5 per sample, from the E17 scorer. Ground truth is dashed; boxes come from the archived run files named on the About page."));
}

/* ------------------------------------------------------------------ RefCOCO explorer */
const RX = { split: "refcoco_testB", outcome: "sg_right_program_wrong", q: "", rows: [], total: 0, offset: 0, cur: null, sel: null, splits: [] };
async function initRcx(params) {
  if (!S.inited.rcx) {
    S.inited.rcx = true;
    RX.splits = await api("/api/refcoco/splits");
    $("#r-split").replaceChildren(...RX.splits.map(x => h("option", { value: x.key }, `${x.label} (${x.n.toLocaleString("en")} expressions)`)));
    if (params.get("split")) RX.split = params.get("split");
    $("#r-split").value = RX.split;
    const syncOutcome = () => {
      const sp = RX.splits.find(x => x.key === RX.split);
      const hasSg = sp.systems.some(x => x.kind === "specguard"), hasVlm = sp.systems.some(x => x.kind === "vlm");
      $$("#r-out option").forEach(o => { o.disabled = (o.value.startsWith("sg_") && !hasSg) || (o.value === "vlm_wrong" && !hasVlm); });
      if ($("#r-out").selectedOptions[0].disabled) { $("#r-out").value = "program_right_b0_wrong"; RX.outcome = "program_right_b0_wrong"; }
    };
    syncOutcome();
    $("#r-split").addEventListener("change", e => { RX.split = e.target.value; RX.sel = null; syncOutcome(); loadRcRows(true); });
    $("#r-out").addEventListener("change", e => { RX.outcome = e.target.value; loadRcRows(true); });
    let t; $("#r-q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { RX.q = e.target.value; loadRcRows(true); }, 220); });
    $("#r-more").addEventListener("click", () => loadRcRows(false));
    $("#r-rand").addEventListener("click", () => {
      const sp = RX.splits.find(x => x.key === RX.split);
      rcShowRow(Math.floor(Math.random() * sp.n));
    });
    const want = params.get("i");
    await loadRcRows(true, want !== null ? +want : null);
  }
}
async function loadRcRows(reset, want) {
  if (reset) { RX.offset = 0; RX.rows = []; }
  const qs = new URLSearchParams({ split: RX.split, outcome: RX.outcome, q: RX.q, offset: RX.offset, limit: 80 });
  const d = await api(`/api/refcoco/rows?${qs}`);
  RX.total = d.total; RX.rows.push(...d.rows); RX.offset += d.rows.length;
  const list = $("#r-rows");
  if (reset) list.replaceChildren();
  const mk = (lab, v) => v === undefined ? null : h("span", {}, `${lab} `, h("span", { class: `mk ${v ? "y" : "n"}` }, v ? "right" : "wrong"));
  for (const r of d.rows) {
    const b = h("button", { class: "rowi", type: "button", role: "listitem", "data-i": r.index },
      h("div", { class: "e" }, r.query),
      h("div", { class: "m" }, h("span", {}, `#${r.index}`), mk("Spec-Guard", r.sg), mk("program", r.program), mk("Qwen3-VL", r.vlm)));
    b.addEventListener("click", () => rcShowRow(r.index));
    list.append(b);
  }
  $("#r-count").textContent = `${RX.total.toLocaleString("en")} ${RX.total === 1 ? "row" : "rows"}`;
  $("#r-more").hidden = RX.offset >= RX.total;
  if (!RX.rows.length) { list.replaceChildren(h("p", { class: "pad muted small" }, "No rows match these filters.")); if (want == null) $("#r-detail").replaceChildren(); }
  if (reset) rcShowRow(want ?? (RX.rows[0] ? RX.rows[0].index : 0));
}
function rcStep(d) {
  const i = RX.rows.findIndex(r => r.index === RX.cur);
  const n = RX.rows[Math.min(RX.rows.length - 1, Math.max(0, i + d))];
  if (n) rcShowRow(n.index);
}
const RC_GROUPS = [["Spec-Guard", e => e.kind === "specguard"], ["Programs, modern stack (SAM 3, SigLIP 2, Depth Anything V2 Large)", e => e.kind === "program" && e.stack === "modern"],
  ["Programs, legacy stack (GLIP-L, CLIP ViT-L/14, MiDaS DPT hybrid)", e => e.kind === "program" && e.stack === "legacy"], ["Baselines", e => e.kind === "b0" || e.kind === "vlm"]];
async function rcShowRow(i) {
  RX.cur = i;
  $$("#r-rows .rowi").forEach(b => b.setAttribute("aria-current", +b.dataset.i === i ? "true" : "false"));
  const cur = $(`#r-rows .rowi[data-i="${i}"]`); if (cur) cur.scrollIntoView({ block: "nearest" });
  if ($("#v-explorer").classList.contains("on")) history.replaceState(null, "", `#explorer?ds=refcoco&split=${RX.split}&i=${i}`);
  const r = await api(`/api/refcoco/rows/${RX.split}/${i}`);
  if (RX.cur !== i) return;
  const by = Object.fromEntries(r.systems.map(s => [s.id, s]));
  const reg = by.specguard || by.c5_ds_specguard;
  const prog = by.modern_c5_ds || by.c5_ds_program;
  if (!RX.sel || !by[RX.sel]) RX.sel = prog ? prog.id : r.systems[0].id;
  const sel = by[RX.sel];
  const vlm = by.qwen3vl, b0 = by.modern_b0;
  const st = stage({ W: r.W, H: r.H, src: r.has_image ? rcImg(r, RX.split, i) : null, gt: [r.gt],
    sgBoxes: reg && reg.box ? [reg.box] : [], vl: vlm && vlm.box ? [vlm.box] : [], vlOn: true,
    labels: { sg: "Spec-Guard", noSg: !reg },
    extra: [{ cls: "pg", name: sel.label.split(" (")[0], boxes: sel.box ? [sel.box] : [] },
            { cls: "b0", name: "Detector only", boxes: b0 && b0.box ? [b0.box] : [], off: true }] });
  const dec = reg ? h("div", { class: `decision ${reg.routed ? "fb" : ""}` },
    h("b", {}, reg.routed ? "Spec-Guard fell back to the detector. " : "Spec-Guard kept the program’s answer. "),
    reg.routed ? `Reason: ${reg.why.join(" and ")}. ` : "The property test passed and the answer is not the whole image. ",
    `Result: IoU ${f2(reg.iou)} with the ground truth (${reg.correct ? "correct" : "wrong"}); the program alone had IoU ${f2(reg.program_iou)}.`) : null;
  const tbody = h("tbody");
  for (const [gname, test] of RC_GROUPS) {
    const items = r.systems.filter(test);
    if (!items.length) continue;
    tbody.append(h("tr", { class: "grp-h" }, h("td", { colspan: 4 }, gname)));
    for (const s of items) {
      const tr = h("tr", { tabindex: 0, "aria-current": s.id === RX.sel ? "true" : "false" },
        h("td", {}, s.label.replace(/ \((modern|legacy) stack\)/, ""), s.kind === "specguard" && s.routed ? h("div", { class: "small muted" }, "fell back: " + s.why.join(", ")) : null),
        h("td", { class: "small muted" }, s.exp + (s.source && s.exp === "E7" ? ", before D34" : "")),
        h("td", { class: "n" }, f2(s.iou)), h("td", { class: s.correct ? "ok" : "bad" }, s.correct ? "right" : "wrong"));
      const pick = () => { RX.sel = s.id; rcShowRow(i); };
      tr.addEventListener("click", pick); tr.addEventListener("keydown", e => e.key === "Enter" && pick());
      tbody.append(tr);
    }
  }
  const table = h("div", { class: "scroll", style: "max-height:520px;overflow:auto" }, h("table", { class: "tbl systbl" },
    h("thead", {}, h("tr", {}, h("th", {}, "System (select to draw it and show its program)"), h("th", {}, "Run"), h("th", { class: "n" }, "IoU"), h("th", {}, "At 0.5"))), tbody));
  const codeWrap = h("div", { class: "two-code" }, h("p", { class: "muted small" }, "Loading the program"));
  $("#r-detail").replaceChildren(...[
    h("p", { class: "expr" }, `“${r.query}”`),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px" },
      h("span", { class: "tag" }, r.split_label), h("span", { class: "tag" }, `row ${r.index}`), r.ref_id != null ? h("span", { class: "tag" }, `ref ${r.ref_id}`) : null),
    dec,
    h("div", { class: "detail-grid" }, h("div", {}, st), h("div", {}, table)),
    codeWrap,
    h("p", { class: "note" }, "IoU with the ground-truth box; a row counts as correct at IoU 0.5. E7 rows are the archived runs before the D34 execution fix; the reported RefCOCO tables use the post-D34 re-run (E18), which the service reads instead whenever that file is present on the machine.")].filter(Boolean));
  if (sel.kind === "program" || sel.kind === "specguard") {
    const p = await api(`/api/refcoco/program/${RX.split}/${i}/${sel.id}`);
    if (RX.cur !== i) return;
    codeWrap.replaceChildren(
      codeBlock(`Program: ${sel.label}`, p.program || "(not archived)", sel.cond ? `Prompt ${sel.cond.toUpperCase()}` : ""),
      p.test ? codeBlock("Property test for this expression", p.test, sel.test_outcome ? `Outcome on this program: ${sel.test_outcome}` : "Written from the expression alone; its outcome is shown on the Spec-Guard row of the same program.") : h("div"));
  } else codeWrap.replaceChildren(h("p", { class: "muted small" }, sel.kind === "vlm" ? "Qwen3-VL-8B answers directly; there is no program." : "The detector-only baseline takes the top detection for the full expression; there is no program."));
}

/* ------------------------------------------------------------------ best result per model */
function bestMatrix(bm) {
  if (!bm) return null;
  const cols = bm.columns, scored = bm.models.filter(m => Object.keys(m.best).length);
  const head1 = h("tr", {}, h("th", { rowspan: 2 }, "Model"),
    h("th", { colspan: 3, class: "grp" }, "OpenRef, F1 at IoU 0.5"), h("th", { colspan: 5, class: "grp" }, "RefCOCO family, accuracy at IoU 0.5"));
  const head2 = h("tr", {}, ...cols.map(c => h("th", { class: "n" }, c.label.replace("OpenRef, ", ""))));
  const body = h("tbody", {}, ...scored.map(m => h("tr", {},
    h("th", { scope: "row" }, h("div", { class: "mname" }, m.name), h("div", { class: "mfam" }, m.family)),
    ...cols.map(c => {
      const b = m.best[c.id];
      if (!b) return h("td", { class: "mx empty" }, "not run");
      const top = Math.abs(b.value - bm.column_max[c.id]) < 1e-9;
      const td = h("td", { class: `mx${top ? " top" : ""}`, style: `--v:${(b.value / 100).toFixed(3)}`, tabindex: 0 },
        h("div", { class: "mv num" }, f2(b.value)), h("div", { class: "mc" }, b.config.split(" (")[0]), top ? h("span", { class: "best" }, "best") : null);
      hover(td, `<b>${esc(m.name)}</b>, ${esc(c.label)}<br>${f2(b.value)}: ${esc(b.config)}<br><span style="opacity:.75">best of ${b.n_configs} archived configuration${b.n_configs > 1 ? "s" : ""}; ${esc(b.source)}</span>`);
      return td;
    }))));
  return h("figure", { class: "chart", id: "res-best" },
    h("figcaption", {}, h("h3", {}, "Best result of every model"), h("span", { class: "src" }, "e17, e18_e7, e23, e24, e28, e29, phase2a_qwen3vl")),
    h("p", { class: "note", style: "margin:0 0 14px" }, "Each cell is the model’s highest archived score on that split and names the configuration that reached it: the program alone (any prompt, either stack), the OpenRef router it writes for, or Spec-Guard built on its programs. The highest value in each column is outlined. Hover a cell for its source."),
    h("div", { class: "scroll" }, h("table", { class: "matrix" }, h("thead", {}, head1, head2), body)),
    h("p", { class: "note" }, "Detectors appear alone as the corrected detector-only baseline. Spec-Guard on C1 programs is not counted for a code model: every C1 program fails, so that cell is the detector itself. Empty cells were not run (Yi-Coder-9B: E7 scope, D27). SigLIP 2, Depth Anything V2, CLIP and MiDaS are components inside programs and have no standalone score; see the Models page."));
}

const S_MODELS = { inited: false };
async function initModels() {
  if (S_MODELS.inited) return;
  S_MODELS.inited = true;
  const R = S.summary || (S.summary = await api("/api/summary"));
  const bm = R.by_model, cols = Object.fromEntries(bm.columns.map(c => [c.id, c]));
  const grid = $("#models");
  const fams = [["Code models: write the programs", m => m.family === "Code model"], ["Vision-language model: the end-to-end baseline", m => m.family.startsWith("Vision")],
    ["Detectors: find() inside programs, and the detector-only baseline", m => m.family.startsWith("Detector")], ["Perception components inside programs", m => m.component]];
  for (const [title, test] of fams) {
    const ms = bm.models.filter(test);
    grid.append(h("h3", { class: "famh" }, title));
    grid.append(h("div", { class: "mcards" }, ...ms.map(m => {
      const best = Object.entries(m.best).sort((a, b) => b[1].value - a[1].value);
      return h("article", { class: "mcard panel" },
        h("div", { class: "mtop" }, h("span", { class: "tag" }, m.family), h("span", { class: "small muted" }, m.used)),
        h("h4", {}, m.name), h("code", { class: "small muted" }, m.hf),
        h("p", {}, m.role),
        best.length ? h("table", { class: "tbl mini" }, h("tbody", {}, ...best.map(([cid, b]) => {
          const top = Math.abs(b.value - bm.column_max[cid]) < 1e-9;
          return h("tr", {}, h("td", {}, cols[cid].label, h("div", { class: "small muted" }, b.config)),
            h("td", { class: "n" }, h("b", { class: `num${top ? " topv" : ""}` }, f2(b.value)), top ? h("div", { class: "small", style: "color:var(--t)" }, "best on split") : null));
        }))) : h("p", { class: "small muted" }, "A component called by programs; its effect is inside every program result, with no standalone score."));
    })));
  }
}

/* ------------------------------------------------------------------ results */
const SERIES = ["var(--t)", "var(--p)", "var(--vlm)"];
async function initResults() {
  if (S.inited.results) return;
  S.inited.results = true;
  const R = S.summary || (S.summary = await api("/api/summary"));
  const box = $("#res");
  const hd = R.headline;
  box.append(
    h("nav", { class: "seg jump", "aria-label": "Results sections" },
      h("a", { href: "#results", class: "linkbtn", style: "padding:6px 12px", onclick: e => { e.preventDefault(); $("#res-best").scrollIntoView({ behavior: "smooth" }); } }, "Best per model"),
      h("a", { href: "#results", class: "linkbtn", style: "padding:6px 12px", onclick: e => { e.preventDefault(); $("#res-or").scrollIntoView({ behavior: "smooth" }); } }, "OpenRef"),
      h("a", { href: "#results", class: "linkbtn", style: "padding:6px 12px", onclick: e => { e.preventDefault(); $("#res-rc").scrollIntoView({ behavior: "smooth" }); } }, "RefCOCO family")),
    h("div", { class: "panel pad", style: "scroll-margin-top:80px" }, bestMatrix(R.by_model)),
    h("h2", { id: "res-or", style: "scroll-margin-top:80px" }, "OpenRef"),
    h("div", { class: "panel pad" }, h("p", { style: "font-size:18px;line-height:1.55;max-width:80ch" },
      `The router scores ${f2(hd.router_all)} F1 on all ${hd.n_all.toLocaleString("en")} OpenRef test expressions against ${f2(hd.s1_all)} for Qwen3-VL-8B, `,
      `and ${f2(hd.router_para)} on paraphrased ordinal expressions, where the generated programs alone score ${f2(hd.c5g_para)}. `,
      "Qwen3-VL-8B stays ahead on single-target expressions; both effects are shown below with their intervals.")),
    h("div", { class: "panel pad" }, barChart(R.by_type)),
    h("div", { class: "panel pad" }, mainTable(R)),
    h("div", { class: "panel pad" }, forest(R.comparisons)),
    h("div", { class: "panel pad" }, h("figure", { class: "chart" },
      h("figcaption", {}, h("h3", {}, "Pre-registered hypotheses"), h("span", { class: "src" }, "results/e24, e25, e27, e28, e29")),
      h("p", { class: "note", style: "margin:0 0 12px" }, "Each hypothesis was written before its test run. Falsified ones stay in the record."),
      h("div", { class: "hyps" }, ...R.hypotheses.map(x => h("div", { class: "hyp" },
        h("span", { class: `tag ${x.holds ? "ok" : "warn"}` }, x.holds ? "Holds" : "Falsified"),
        h("span", {}, h("b", {}, x.exp), " ", hypName(x.name))))))),
    h("div", { class: "cols2" }, h("div", { class: "panel pad" }, latency(R.latency_s)), h("div", { class: "panel pad" }, routeShare(R.route_share))),
    h("div", { class: "panel pad" }, published(R.published)),
    ...refcocoResults(R.refcoco, R.refcoco_controls).filter(Boolean)
  );
}
const RAMP = ["#a7d8d1", "#5db8ac", "#1f978a", "#0b6a61"];
function refcocoResults(rc, controls) {
  if (!rc) return [];
  const reg = rc.specguard.filter(x => x.generator.startsWith("DeepSeek-Coder-V2-Lite") && (x.exp === "E23" || x.generator.endsWith("C5")));
  const steps = [["program", "Program alone"], ["rule", "Whole-image rule"], ["proptest", "Property test"], ["both", "Spec-Guard (both)"]];
  const W = 980, left = 160, right = 40, bh = 13, gap = 3, gpad = 22, pw = W - left - right;
  const svg = h("svg", { class: "ch", role: "img", "aria-label": "Spec-Guard ablation on RefCOCO splits" });
  let y = 10;
  for (const r of reg) {
    svg.append(h("text", { class: "lab", x: left - 12, y: y + (bh + gap) * 2 + 2, "text-anchor": "end" }, r.split));
    steps.forEach(([k, lab], j) => {
      const v = r[k], w = Math.max(2, pw * v / 100), yy = y + j * (bh + gap);
      const m = h("g", { class: "m" }, h("rect", { class: "mark", x: left, y: yy, width: w, height: bh, rx: 4, style: `fill:${RAMP[j]}` }),
        h("rect", { class: "hit", x: left, y: yy - 1, width: pw, height: bh + 2 }));
      if (j === 3) m.append(h("text", { class: "val", x: left + w + 6, y: yy + bh - 2 }, f2(v, 1)));
      hover(m, `<b>${esc(r.split)}, ${esc(r.exp)}</b><br>${esc(lab)}: ${f2(v)}`);
      svg.append(m);
    });
    const yb = y + 4 * (bh + gap) - gap;
    const tick = (v, col, name) => { if (v == null) return; const x = left + pw * v / 100;
      const g = h("g", { class: "m" }, h("line", { x1: x, x2: x, y1: y - 3, y2: yb + 3, style: `stroke:${col};stroke-width:2.5` }), h("rect", { class: "hit", x: x - 5, y: y - 3, width: 10, height: yb - y + 6 }));
      hover(g, `<b>${esc(r.split)}</b><br>${name}: ${f2(v)}`); svg.append(g); };
    tick(r.b0, "var(--ink)", "Detector only (B0)"); tick(r.qwen3vl, "var(--vlm)", "Qwen3-VL-8B");
    y += 4 * (bh + gap) + gpad;
  }
  const yb = y - gpad + 6;
  for (const t of [0, 25, 50, 75, 100]) { const x = left + pw * t / 100; svg.prepend(h("line", { class: "gl", x1: x, x2: x, y1: 0, y2: yb })); svg.append(h("text", { x, y: yb + 16, "text-anchor": "middle" }, t)); }
  svg.setAttribute("viewBox", `0 0 ${W} ${yb + 24}`);
  const chart = h("figure", { class: "chart" },
    h("figcaption", {}, h("h3", {}, "Spec-Guard on RefCOCO: each check added to the C5 DeepSeek program"), h("span", { class: "src" }, "results/e23 and e24 result files")),
    h("div", { class: "legend" }, ...steps.map(([, n], j) => h("span", {}, h("i", { style: `background:${RAMP[j]}` }), n)),
      h("span", {}, h("i", { style: "background:var(--ink);width:3px" }), "detector only (B0)"), h("span", {}, h("i", { style: "background:var(--vlm);width:3px" }), "Qwen3-VL-8B")),
    svg, h("p", { class: "note" }, "Accuracy at IoU 0.5. testA rows are E23, testB rows are E24, the confirmation on splits never used before. Spec-Guard closes most of the gap between the program and the detector-only baseline but stays below it on RefCOCO; Qwen3-VL-8B remains far ahead. Hover for values."));
  const sgT = h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Spec-Guard, every cell"), h("span", { class: "src" }, "results/e23, results/e24")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ...["Run", "Split", "Generator", "Program", "Rule", "Property test", "Both", "Both minus B0 (95% CI)", "B0"].map((x, i) => h("th", { class: i > 2 ? "n" : "" }, x)))),
      h("tbody", {}, ...rc.specguard.map(r => h("tr", { class: r.exp === "E24" && r.generator.endsWith("Lite, C5") ? "me" : "" },
        h("td", {}, r.exp), h("td", {}, r.split), h("td", {}, r.generator), ...["program", "rule", "proptest", "both"].map(k => h("td", { class: "n" }, f2(r[k]))),
        h("td", { class: "n" }, r.both_minus_b0 ? `${sg(r.both_minus_b0[0])} (${sg(r.both_minus_b0[1])}, ${sg(r.both_minus_b0[2])})` : "n/a"), h("td", { class: "n" }, f2(r.b0))))))),
    h("p", { class: "note" }, "Highlighted: the registered system on the confirmation splits. Cluster bootstrap over ref_id, 10,000 draws, seed 4."));
  const mainT = h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "C5 programs against their own detector and Qwen3-VL-8B"), h("span", { class: "src" }, "results/e18_e7, results/e20, results/phase2a_qwen3vl")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ...["Stack", "Split", "Generator", "Program", "Program minus B0 (95% CI)", "Whole image (%)", "With G4 rule", "G4 minus B0 (95% CI)", "B0", "Qwen3-VL-8B"].map((x, i) => h("th", { class: i > 2 ? "n" : "" }, x)))),
      h("tbody", {}, ...rc.main.map(r => h("tr", {}, h("td", {}, r.stack), h("td", {}, r.split), h("td", {}, r.generator), h("td", { class: "n" }, f2(r.program)),
        h("td", { class: "n" }, `${sg(r.program_minus_b0[0])} (${sg(r.program_minus_b0[1])}, ${sg(r.program_minus_b0[2])})`), h("td", { class: "n" }, f2(r.whole_image_pct)),
        h("td", { class: "n" }, f2(r.g4)), h("td", { class: "n" }, r.g4_minus_b0 ? `${sg(r.g4_minus_b0[0])} (${sg(r.g4_minus_b0[1])}, ${sg(r.g4_minus_b0[2])})` : "n/a"),
        h("td", { class: "n" }, f2(r.b0)), h("td", { class: "n" }, f2(r.qwen3vl))))))),
    h("p", { class: "note" }, "Program: post-D34 execution (E18). B0: the detector’s top detection for the full expression (E14, D33). Same values as results/tables/phase2b_main.md."));
  const ladT = h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Prompt specification ladder, C1 to C5"), h("span", { class: "src" }, "results/e18_e7/*_compare.json")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ...["Stack", "Split", "Generator", "C1", "C2", "C3", "C4", "C5", "B0"].map((x, i) => h("th", { class: i > 2 ? "n" : "" }, x)))),
      h("tbody", {}, ...rc.ladder.map(r => {
        const vals = ["c1", "c2", "c3", "c4", "c5"].map(k => r[k]).filter(v => v != null), best = Math.max(...vals);
        return h("tr", {}, h("td", {}, r.stack), h("td", {}, r.split), h("td", {}, r.generator),
          ...["c1", "c2", "c3", "c4", "c5"].map(k => h("td", { class: "n" }, r[k] == null ? "not run" : r[k] === best ? h("b", {}, f2(r[k])) : f2(r[k]))), h("td", { class: "n" }, f2(r.b0)));
      })))),
    h("p", { class: "note" }, "C1 API only, C2 grounding notes, C3 depth API, C4 conditional depth, C5 full specification. Best condition per row in bold. Accuracy at IoU 0.5 after the D34 execution fix."));
  const ctl = controls && controls.length ? h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Control: the explorer reproduces the archived accuracies (Spec-Guard E23, E24; post-D34 program records E18)"), h("span", { class: "src" }, "computed at start-up")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Check"), h("th", { class: "n" }, "Archived"), h("th", { class: "n" }, "Recomputed from rows"), h("th", {}, "Result"))),
      h("tbody", {}, ...controls.map(c => h("tr", {}, h("td", {}, c.check), h("td", { class: "n" }, f2(c.archived)), h("td", { class: "n" }, f2(c.recomputed)),
        h("td", {}, h("span", { class: `tag ${c.passed ? "ok" : "warn"}` }, c.passed ? "reproduced" : "differs")))))))) : null;
  return [h("h2", { id: "res-rc", style: "margin-top:18px;scroll-margin-top:80px" }, "RefCOCO, RefCOCO+ and RefCOCOg"),
    h("div", { class: "panel pad" }, chart), h("div", { class: "panel pad" }, sgT), h("div", { class: "panel pad" }, mainT), h("div", { class: "panel pad" }, ladT), ctl ? h("div", { class: "panel pad" }, ctl) : null];
}

function hypName(k) {
  const m = { c5g: "C5-G", c5o: "C5-O", s1: "S1", s3: "S3", s3n: "S3-N", ds: "DeepSeek", q7: "Qwen-7B", b0: "detector", proptest: "property test",
    refcoco: "RefCOCO", refcocop: "RefCOCO+", para: "paraphrase", c1: "C1", c5: "C5" };
  const [id, ...rest] = k.split("_");
  return `${id}: ` + rest.map(w => m[w] || w).join(" ");
}
function barChart(bt) {
  const W = 980, left = 170, right = 50, bh = 15, gap = 3, gpad = 20, pw = W - left - right;
  const svg = h("svg", { class: "ch", role: "img", "aria-label": "F1 by query type for three systems" });
  let y = 8;
  for (const t of [0, 25, 50, 75, 100]) svg.append(h("line", { class: "gl", x1: left + pw * t / 100, x2: left + pw * t / 100, y1: 0, y2: 1 }));
  const gl = $$("line", svg);
  for (const [g, gname] of bt.groups) {
    svg.append(h("text", { class: "lab", x: left - 12, y: y + (bh + gap) * 1.5 + 4, "text-anchor": "end" }, gname));
    bt.series.forEach((s, k) => {
      const v = s.values[g], w = Math.max(2, pw * v / 100), yy = y + k * (bh + gap);
      const m = h("g", { class: "m" }, h("rect", { class: "mark", x: left, y: yy, width: w, height: bh, rx: 4, style: `fill:${SERIES[k]}` }),
        h("rect", { class: "hit", x: left, y: yy - 1, width: pw, height: bh + 2 }));
      if (k === 0) m.append(h("text", { class: "val", x: left + w + 6, y: yy + bh - 3 }, f2(v, 1)));
      hover(m, `<b>${esc(s.name)}</b><br>${esc(gname)}: ${f2(v)} F1`);
      svg.append(m);
    });
    y += 3 * (bh + gap) + gpad;
  }
  const yb = y - gpad + 6;
  gl.forEach((l, i) => { l.setAttribute("y2", yb); svg.append(h("text", { x: l.getAttribute("x1"), y: yb + 16, "text-anchor": "middle" }, [0, 25, 50, 75, 100][i])); });
  svg.append(h("line", { class: "base", x1: left, x2: left, y1: 0, y2: yb }));
  svg.setAttribute("viewBox", `0 0 ${W} ${yb + 24}`);
  return h("figure", { class: "chart" },
    h("figcaption", {}, h("h3", {}, "F1 by query type"), h("span", { class: "src" }, bt.source)),
    h("div", { class: "legend" }, ...bt.series.map((s, k) => h("span", {}, h("i", { style: `background:${SERIES[k]}` }), s.name))),
    svg, h("p", { class: "note" }, "Hover a bar for its value. The router’s values are labelled; all values are in the table below."));
}
function mainTable(R) {
  const cols = [["ordinal", "Ordinal"], ["para", "Paraphrased"], ["multi", "Multi"], ["single", "Single"], ["all", "All"]];
  const ob = R.oracle_bound_not_accuracy;
  return h("figure", { class: "chart" },
    h("figcaption", {}, h("h3", {}, "OpenRef test, F1 at IoU 0.5"), h("span", { class: "src" }, "results/e28, e29 and e27 result files")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "System"), h("th", {}, "Experiment"), ...cols.map(([, n]) => h("th", { class: "n" }, n)))),
      h("tbody", {}, ...R.main_table.map((r, i) => h("tr", { class: i === 0 ? "me" : "" }, h("td", {}, r.system, r.note ? h("div", { class: "small muted" }, r.note) : null),
        h("td", { class: "muted" }, r.exp), ...cols.map(([k]) => h("td", { class: "n" }, r[k] === null || r[k] === undefined ? "n/a" : f2(r[k])))))))),
    h("p", { class: "note" }, `Paraphrased: mean over the four paraphrases P1 to P4 of each ordinal expression. An oracle that picks the better route for every row would reach ${f2(ob.all_template_rows)} on all rows and ${f2(ob.ordinal_paraphrase)} on paraphrases; this is an upper bound, not an accuracy.`));
}
function forest(comps) {
  const lo = Math.min(0, ...comps.map(c => c.ci95[0])) - 3, hi = Math.max(0, ...comps.map(c => c.ci95[1])) + 3;
  const W = 980, left = 470, rh = 27, pw = W - left - 20, X = d => left + pw * (d - lo) / (hi - lo);
  const H = 30 + rh * comps.length;
  const svg = h("svg", { class: "ch", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Paired differences with 95% intervals" });
  for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += 10) {
    svg.append(h("line", { class: t === 0 ? "zero" : "gl", x1: X(t), x2: X(t), y1: 18, y2: H - 6 }),
      h("text", { x: X(t), y: 12, "text-anchor": "middle" }, t === 0 ? "0" : sg(t, 0)));
  }
  comps.forEach((c, i) => {
    const y = 34 + i * rh, [a, b] = c.ci95;
    const col = a > 0 ? "var(--t)" : b < 0 ? "var(--vlm)" : "var(--ink-3)";
    const name = c.name.replace(/ \((no direction predicted|no direction)\)/, "");
    const g = h("g", { class: "m" },
      h("text", { class: "lab", x: left - 14, y: y + 4, "text-anchor": "end" }, `${c.exp}  ${name}`),
      h("line", { x1: X(a), x2: X(b), y1: y, y2: y, style: `stroke:${col};stroke-width:2.5;stroke-linecap:round` }),
      h("circle", { class: "mark", cx: X(c.diff), cy: y, r: 5.5, style: `fill:${col}` }),
      h("rect", { class: "hit", x: 0, y: y - rh / 2, width: W, height: rh }));
    hover(g, `<b>${esc(c.exp)}: ${esc(c.name)}</b><br>${sg(c.diff)} points, 95% interval ${sg(a)} to ${sg(b)}<br>n ${c.n}; ${f2(c.a)} against ${f2(c.b)}`);
    svg.append(g);
  });
  return h("figure", { class: "chart" },
    h("figcaption", {}, h("h3", {}, "Paired differences with 95% intervals"), h("span", { class: "src" }, "results/e28 and e29 result files")),
    h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--t)" }), "interval above zero"),
      h("span", {}, h("i", { style: "background:var(--vlm)" }), "interval below zero"), h("span", {}, h("i", { style: "background:var(--ink-3)" }), "interval includes zero")),
    h("div", { class: "scroll" }, h("div", { style: "min-width:760px" }, svg)),
    h("p", { class: "note" }, "Paired bootstrap over samples, 10,000 draws, seed 4. Comparisons marked as having no predicted direction are reported, not tested."));
}
function latency(lat) {
  const rows = Object.entries(lat), mx = Math.max(...rows.map(r => r[1]));
  return h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Latency recorded in E28"), h("span", { class: "src" }, "results/e28/e28_results.json")),
    h("div", { class: "wf", style: "grid-template-columns:minmax(140px,1.4fr) 1fr 64px" }, ...rows.flatMap(([k, v]) => [h("span", { class: "small" }, k),
      h("span", { class: "tr" }, h("i", { class: /template exec/.test(k) ? "t" : /S1/.test(k) ? "vlm" : /C5-G/.test(k) ? "p" : "", style: `left:0;width:${(100 * v / mx).toFixed(1)}%` })),
      h("span", { class: "r" }, `${f2(v, 3)} s`)])),
    h("p", { class: "note" }, "Seconds per call, descriptive, from the batch runs of the experiments. The demo’s own latency table comes from deploy/bench.py."));
}
function routeShare(rs) {
  return h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Rows sent to the template program"), h("span", { class: "src" }, "results/e28/e28_results.json")),
    h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Subset"), h("th", { class: "n" }, "Route T"), h("th", { class: "n" }, "Rows"))),
      h("tbody", {}, ...Object.entries(rs).map(([k, [a, b]]) => h("tr", {}, h("td", {}, k), h("td", { class: "n" }, a), h("td", { class: "n" }, b))))),
    h("p", { class: "note" }, "“As registered” is the route before E28 amendment 1 (the query-preservation check), which was fixed on the dev split before the test run."));
}
function refcoco(rc) {
  if (!rc || !rc.length) return "";
  return h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Single-referent setting: Spec-Guard as a fallback on RefCOCO"), h("span", { class: "src" }, "results/e24/e24_results.json")),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ...["Setting", "Program", "Spec-Guard rule", "Property test", "Both", "Detector only", "n"].map((x, i) => h("th", { class: i ? "n" : "" }, x)))),
      h("tbody", {}, ...rc.map(r => h("tr", {}, h("td", {}, r.setting), ...["program", "rule", "proptest", "both", "b0"].map(k => h("td", { class: "n" }, f2(r[k]))), h("td", { class: "n" }, r.n)))))),
    h("p", { class: "note" }, "Accuracy at IoU 0.5 on testB. When a check fires, the answer falls back to the detector’s top box."));
}
function published(p) {
  if (!p) return "";
  const t = (head, rows) => h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ...head.map((x, i) => h("th", { class: i && i < head.length - 1 ? "n" : "" }, x)))), h("tbody", {}, ...rows)));
  return h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, "Numbers other 2026 papers report"), h("span", { class: "src" }, "deploy/published_2026.json")),
    h("p", { class: "note", style: "margin:0 0 12px" }, p.note),
    t(["System, as published", "Ordinal", "Multi", "Single", "Source"], p.openref.map(r => h("tr", {}, h("td", {}, r.system), h("td", { class: "n" }, f2(r.ordinal, 1)), h("td", { class: "n" }, f2(r.multi, 1)), h("td", { class: "n" }, f2(r.single, 1)), h("td", { class: "small muted" }, r.source)))),
    h("div", { style: "height:14px" }),
    t(["System, as published", "RefCOCO testA", "RefCOCO+ testA", "Source"], p.refcoco_testA.map(r => h("tr", {}, h("td", {}, r.system), h("td", { class: "n" }, f2(r.refcoco, 1)), h("td", { class: "n" }, f2(r.refcoco_plus, 1)), h("td", { class: "small muted" }, r.source)))));
}

/* ------------------------------------------------------------------ architecture */
const ARCH = [
  { id: "in", x: 360, y: 10, w: 240, t: "Input", s: "image and expression", d: { Role: "An image and a referring expression, up to 200 characters.", Limits: "16 megapixels, 4096 px per side (configs/deploy.yaml)." } },
  { id: "norm", x: 330, y: 96, w: 300, t: "Normaliser", s: "Qwen2.5-Coder-7B", cls: "p", d: { Role: "Rewrites the expression into the template line the rule parser reads, for example “from left {fifth} column from top {first} peach”.", Model: "Qwen2.5-Coder-7B-Instruct, greedy, 48 new tokens.", Prompt: "prompts/e27_normalise.prompt, frozen in E27.", Code: "scripts/e27_normalise.py" } },
  { id: "route", x: 300, y: 184, w: 360, t: "Decidable route", s: "parse, then query-preservation check", cls: "g", d: { Role: "Route T when the E17 parser reads the line (either clause order) and every side, index and unit in it is stated in the expression; route P otherwise.", Frozen: "E27 amendment 1 and E28 amendment 1, fixed on the dev split before the test run.", Code: "scripts/e27_rule.py, scripts/e28_route.py" } },
  { id: "tmpl", x: 60, y: 290, w: 320, t: "Template program", s: "deterministic, no language model", cls: "t", d: { Role: "Builds the program directly from the parse: find(noun), group_lines, order_from.", Code: "scripts/e28_route.py template_program", Why: "On ordinal expressions this removes generation errors such as transposed rows and columns (D39)." } },
  { id: "gen", x: 580, y: 290, w: 320, t: "Program writer", s: "Qwen2.5-Coder-7B, prompt C5-G", cls: "p", d: { Role: "Writes a Python program against the visual API with the grouping primitives.", Model: "Qwen2.5-Coder-7B-Instruct, greedy, 320 new tokens.", Prompt: "prompts/api_depth_desc_c5g.prompt, frozen in E25." } },
  { id: "g12", x: 610, y: 380, w: 260, t: "Spec-Guard G1, G2", s: "checks before execution", cls: "g", d: { G1: "Output contract: the program returns an image patch or a list of patches.", G2: "Query preservation: every content word of the expression reaches some find() call.", Specified: "2 November, before any check was measured.", Code: "src/specguard/guard/checks.py" } },
  { id: "exec", x: 330, y: 470, w: 300, t: "Sandboxed executor", s: "restricted namespace, timeout", d: { Role: "Runs the program with API functions only: no imports, no file or network access.", Timeout: "60 s in the demo, enforced by a watchdog thread.", Code: "src/specguard/api/executor.py" } },
  { id: "sam", x: 40, y: 566, w: 205, t: "find()", s: "SAM 3", cls: "m", d: { Model: "SAM 3 detector.", Threshold: "0.40, chosen on OpenRef dev (results/e17/selection.json).", Code: "src/specguard/api/vision_bus.py" } },
  { id: "sig", x: 260, y: 566, w: 205, t: "verify, match", s: "SigLIP 2", cls: "m", d: { Model: "SigLIP 2 for attribute verification and text matching.", Code: "src/specguard/api/vision_bus.py" } },
  { id: "dep", x: 480, y: 566, w: 205, t: "depth", s: "Depth Anything V2", cls: "m", d: { Model: "Depth Anything V2 Large (depth-anything/Depth-Anything-V2-Large-hf), the D26 revision; Depth Anything 3 was rejected before any run.", Code: "src/specguard/api/vision_bus.py" } },
  { id: "grp", x: 700, y: 566, w: 205, t: "group_lines, order_from", s: "grouping primitives", d: { Role: "Group detections into rows or columns and order them from a side.", Added: "E25.", Code: "src/specguard/api/grouping.py" } },
  { id: "g4", x: 250, y: 666, w: 460, t: "Spec-Guard G4 and answer", s: "boxes, latency, audit record", cls: "g", d: { G4: "Single-referent fallback condition: no box, or a box covering the whole image.", Fallback: "Optional: answer with the detector’s top box when a check fires (RefCOCO setting, E21 to E24). Off for OpenRef.", Record: "Every stage, every perception call, latency and peak GPU memory, downloadable as JSON." } },
  { id: "vlm", x: 720, y: 10, w: 200, t: "Comparison", s: "Qwen3-VL-8B", cls: "m", d: { Role: "Answers the same image and expression directly, for comparison.", Model: "Qwen3-VL-8B-Instruct with the frozen S1 prompt and parser (E17).", Code: "scripts/openref_qwen3vl.py" } }
];
const LINKS = [["in", "norm"], ["norm", "route"], ["route", "tmpl", "route T"], ["route", "gen", "route P"], ["gen", "g12"], ["tmpl", "exec"], ["g12", "exec"], ["exec", "sam"], ["exec", "sig"], ["exec", "dep"], ["exec", "grp"], ["exec", "g4"], ["in", "vlm"]];
const ARCH_RC = [
  { id: "in", x: 360, y: 10, w: 240, t: "Input", s: "image and expression", d: { Role: "One image and one expression that names a single object (RefCOCO, RefCOCO+, RefCOCOg)." } },
  { id: "gen", x: 300, y: 96, w: 360, t: "Program writer", s: "three code models, prompts C1 to C5", cls: "p", d: { Models: "Qwen2.5-Coder-7B, DeepSeek-Coder-V2-Lite, Yi-Coder-9B (E7 grid).", Prompts: "C1 API only, C2 grounding notes, C3 depth API, C4 conditional depth, C5 full specification (prompts/api*.prompt).", Decoding: "Greedy, 320 new tokens.", Registered: "C5 with DeepSeek-Coder-V2-Lite is the registered Spec-Guard cell (E24)." } },
  { id: "exec", x: 300, y: 190, w: 360, t: "Sandboxed executor", s: "modern stack or legacy stack", d: { Modern: "SAM 3 at threshold 0.3, SigLIP 2, Depth Anything V2 (E7 modern, E24).", Legacy: "GLIP-L, CLIP ViT-L/14 and MiDaS DPT hybrid, the original ViperGPT tools (E7 legacy, Phase 1).", Fix: "D34 execution fix re-run in E18; the tables use the post-D34 values.", Code: "src/specguard/api/executor.py" } },
  { id: "rule", x: 60, y: 300, w: 300, t: "Whole-image rule", s: "G4, E21", cls: "g", d: { Rule: "An answer within 1 px of the whole image is rejected.", Source: "Spec-Guard specification of 2 November; confirmed on val in E21." } },
  { id: "pt", x: 600, y: 300, w: 300, t: "Property test", s: "DeepSeek-Coder-V2-Lite writes, sandbox runs", cls: "g", d: { Role: "A test written from the expression alone, such as exists(\"darkness\") and verify_property(...), run on the program’s answer.", Prompt: "prompts/proptest_refcoco.prompt, greedy, 192 new tokens (E22, D36).", Outcomes: "pass, assert_fail, test_error, no_test, program_fail; every outcome except pass rejects the answer.", Code: "scripts/proptest_gen.py, scripts/proptest_exec.py" } },
  { id: "sw", x: 330, y: 400, w: 300, t: "Spec-Guard decision", s: "route rule of scripts/e24_analyze.py", cls: "g", d: { Rule: "Keep the program’s answer only if the test passes and the answer is not the whole image.", Check: "The explorer recomputes this decision for every archived row and reproduces the archived E23 and E24 accuracies." } },
  { id: "keep", x: 120, y: 500, w: 300, t: "Program answer", s: "kept", cls: "t", d: { Result: "The program’s box." } },
  { id: "b0", x: 540, y: 500, w: 300, t: "Detector only, B0", s: "top box for the full expression", cls: "m", d: { Role: "The detector’s top-scoring box for the whole expression, taken unconditionally (corrected B0, E14, D33).", Threshold: "0.0, so the top box always exists." } },
  { id: "vlm", x: 720, y: 10, w: 200, t: "Comparison", s: "Qwen3-VL-8B", cls: "m", d: { Role: "Answers the same image and expression directly (E9 on RefCOCO).", Model: "Qwen3-VL-8B-Instruct, coordinates normalised 0 to 1000 (D31)." } }
];
const LINKS_RC = [["in", "gen"], ["gen", "exec"], ["exec", "rule"], ["exec", "pt"], ["rule", "sw"], ["pt", "sw"], ["sw", "keep", "all pass"], ["sw", "b0", "a check fails"], ["in", "vlm"]];
function initArch() {
  if (S.inited.arch) return;
  S.inited.arch = true;
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Diagram" },
    h("button", { type: "button", "aria-pressed": "true", "data-v": "or" }, "OpenRef router (E28)"),
    h("button", { type: "button", "aria-pressed": "false", "data-v": "rc" }, "RefCOCO Spec-Guard (E24)"));
  const holder = h("div");
  $("#arch-fig").append(h("div", { style: "margin-bottom:14px" }, seg), holder);
  const draw = v => {
    $$("button", seg).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    holder.replaceChildren(archSvg(v === "or" ? ARCH : ARCH_RC, v === "or" ? LINKS : LINKS_RC, v === "or" ? 730 : 570, v === "or"));
  };
  $$("button", seg).forEach(b => b.addEventListener("click", () => draw(b.dataset.v)));
  draw("or");
}
function archSvg(nodes, links, H, group) {
  const svg = h("svg", { viewBox: `0 0 960 ${H}`, role: "group", "aria-label": "Architecture diagram; each component is a button" });
  svg.append(h("defs", {}));
  $("defs", svg).innerHTML = `<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)"/></marker>`;
  if (group) { svg.append(h("rect", { class: "grp", x: 25, y: 455, width: 900, height: 175, rx: 10 })); svg.append(h("text", { class: "lbl", x: 40, y: 476 }, "src/specguard")); }
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  for (const [a, b, lab] of links) {
    const A = by[a], B = by[b];
    let x1 = A.x + A.w / 2, y1 = A.y + 52, x2 = B.x + B.w / 2, y2 = B.y;
    if (b === "vlm") { x1 = A.x + A.w; y1 = A.y + 26; x2 = B.x; y2 = B.y + 26; }
    svg.append(h("path", { class: "ln", d: `M${x1} ${y1} L${x2} ${y2 - 2}`, "marker-end": "url(#ah)" }));
    if (lab) svg.append(h("text", { class: "lbl", x: (x1 + x2) / 2 + (x2 < x1 ? -90 : 14), y: (y1 + y2) / 2 }, lab));
  }
  for (const n of nodes) {
    const g = h("g", { class: `an ${n.cls || ""}`, tabindex: 0, role: "button", "aria-label": `${n.t}: ${n.s}` },
      h("rect", { x: n.x, y: n.y, width: n.w, height: 52, rx: 8 }),
      h("text", { x: n.x + n.w / 2, y: n.y + 22, "text-anchor": "middle" }, n.t),
      h("text", { class: "s", x: n.x + n.w / 2, y: n.y + 40, "text-anchor": "middle" }, n.s));
    const pick = () => { $$(".an", svg).forEach(x => x.classList.remove("sel")); g.classList.add("sel"); archSide(n); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    svg.append(g);
  }
  const legend = h("div", { class: "legend", style: "margin-top:14px" },
    h("span", {}, h("i", { style: "background:var(--t-soft);border:1px solid var(--t)" }), "deterministic or kept answer"),
    h("span", {}, h("i", { style: "background:var(--p-soft);border:1px solid var(--p)" }), "language model"),
    h("span", {}, h("i", { style: "background:var(--ok-soft);border:1px solid var(--ok)" }), "check"),
    h("span", {}, h("i", { style: "background:var(--surface);border:1px solid var(--rule)" }), "perception, execution or baseline"));
  const out = h("div", {}, h("div", { class: "scroll" }, h("div", { style: "min-width:640px" }, svg)), legend);
  setTimeout(() => { const first = $$(".an", svg)[group ? 2 : 5]; if (first) first.dispatchEvent(new Event("click")); }, 0);
  return out;
}
function archSide(n) {
  $("#arch-side").replaceChildren(h("h3", {}, n.t), h("p", { class: "muted", style: "margin-bottom:16px" }, n.s),
    h("dl", { class: "kv", style: "grid-template-columns:minmax(80px,110px) 1fr" }, ...Object.entries(n.d).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, /\.(py|json|prompt|yaml)/.test(v) && k === "Code" ? h("code", {}, v) : v)])));
}

/* ------------------------------------------------------------------ about */
async function initAbout() {
  if (S.inited.about) return;
  S.inited.about = true;
  const v = S.version || (S.version = await api("/api/version"));
  await loadHealth();
  const hl = S.health;
  const para = (t, ...ps) => h("div", { class: "panel pad" }, h("h3", {}, t), ...ps.map(p => h("p", {}, p)));
  $("#about").append(
    para("What this is", "A research prototype for the M.Tech dissertation on specification-guarded visual programs (CSE, Information Security and Privacy, SVNIT Surat; guide Prof. Mukesh A. Zaveri). It locates objects described in words. It is not a surveillance or identification product, and it is not meant for tracking people."),
    para("Privacy", "Uploaded images are processed in memory and never written to disk. The audit record stays in your browser unless you download it. The page loads no external fonts, scripts or analytics."),
    para("Network", "The service binds to the compute node’s internal hostname, never a public interface, and is reached only through an SSH tunnel. Models load from the local cache with the Hugging Face hub offline."),
    para("Limits", `Expression up to ${v.limits.max_query_chars} characters. Image up to ${v.limits.max_image_side} px per side and ${(v.limits.max_image_pixels / 1e6).toFixed(0)} megapixels. Execution timeout ${v.timeout_s} s. One query at a time.`),
    h("div", { class: "panel pad" }, h("h3", {}, "Configuration of this instance"),
      h("dl", { class: "kv", style: "margin-top:10px" },
        h("dt", {}, "Mode"), h("dd", {}, hl.mode), h("dt", {}, "Code version"), h("dd", {}, h("code", {}, v.commit)),
        h("dt", {}, "GPU"), h("dd", {}, hl.gpu ? hl.gpu.name : "none"),
        h("dt", {}, "Cold start"), h("dd", {}, hl.cold_start_s ? `${hl.cold_start_s.total_s} s` : "n/a"),
        h("dt", {}, "Coder model"), h("dd", {}, v.models.coder), h("dt", {}, "Comparison model"), h("dd", {}, `${v.models.vlm}${hl.vlm ? "" : " (not loaded)"}`),
        h("dt", {}, "Prompts"), h("dd", {}, h("code", {}, v.prompts.normaliser), ", ", h("code", {}, v.prompts.program)),
        h("dt", {}, "Detector threshold"), h("dd", {}, String(v.tau)), h("dt", {}, "Python"), h("dd", {}, v.python))),
    h("div", { class: "panel pad wide" }, h("h3", {}, "Integrity of the archived runs"),
      h("p", { class: "small muted", style: "margin:6px 0 10px" }, "Each file the explorer reads is hashed at start-up and compared with the SHA-256 list written when it was archived."),
      h("table", { class: "tbl" }, h("tbody", {}, ...Object.entries(hl.archived_files).map(([k, s]) => h("tr", {}, h("td", { style: "overflow-wrap:anywhere" }, h("code", { style: "font-size:12.5px" }, k)),
        h("td", {}, h("span", { class: `tag ${s === "verified" ? "ok" : /MISMATCH|missing/.test(s) ? "warn" : ""}` }, s))))))),
    (() => {
      const rcf = Object.entries(hl.archived_files_refcoco || {});
      const cnt = {}; rcf.forEach(([, v]) => (cnt[v] = (cnt[v] || 0) + 1));
      const joins = Object.entries(hl.refcoco_image_join || {});
      const det = h("details", {}, h("summary", { class: "small", style: "cursor:pointer;margin:8px 0" }, `Show all ${rcf.length} files`),
        h("table", { class: "tbl" }, h("tbody", {}, ...rcf.map(([k, v]) => h("tr", {}, h("td", { style: "overflow-wrap:anywhere" }, h("code", { style: "font-size:12.5px" }, k)),
          h("td", {}, h("span", { class: `tag ${v === "verified" ? "ok" : /MISMATCH/.test(v) ? "warn" : ""}` }, v)))))));
      return h("div", { class: "panel pad wide" }, h("h3", {}, "RefCOCO family: archived runs and images"),
        h("p", { class: "small muted", style: "margin:6px 0 10px" }, "Run records read by the RefCOCO explorer. E23 and E24 copies carry SHA-256 manifests and are checked; the E7 grid, E14 and E9 files predate the manifest convention, which the list states rather than hides. The Spec-Guard decisions recomputed from these rows reproduce the archived accuracies (Results page)."),
        h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, ...Object.entries(cnt).map(([k, v]) => h("span", { class: `tag ${k === "verified" ? "ok" : /MISMATCH/.test(k) ? "warn" : ""}` }, `${v} ${k}`))),
        det,
        h("p", { class: "small muted", style: "margin-top:10px" }, joins.length ? "COCO images joined through load_refcoco(): " + joins.map(([k, v]) => `${k} ${v ? (v.error ? "failed (" + v.error + ")" : v.query_mismatch ? "query mismatch, images withheld" : v.n_files + " rows") : "no refs on this machine"}`).join("; ") + "." : "COCO images are joined when a split is first opened; on a machine without the RefCOCO annotations the boxes are drawn without the image."));
    })(),
    para("Reporting rule", "Every number on these pages is read from archived result files. Oracle bounds are labelled as bounds, never as accuracy. Numbers from other papers are shown with their source and are not same-sample comparisons. Latency for the dissertation comes only from the fixed benchmark run."),
    h("div", { class: "panel pad" }, h("h3", {}, "Programmatic access"),
      h("dl", { class: "kv", style: "margin-top:10px" },
        h("dt", {}, h("code", {}, "GET /health")), h("dd", {}, "mode, GPU, archive integrity"),
        h("dt", {}, h("code", {}, "POST /api/run")), h("dd", {}, "image and query in, audit record out"),
        h("dt", {}, h("code", {}, "GET /api/rows")), h("dd", {}, "archived test rows with filters"),
        STATIC ? null : h("dt", {}, h("a", { href: "/api/docs" }, "/api/docs")), STATIC ? null : h("dd", {}, "interactive API documentation")))
  );
}

/* ------------------------------------------------------------------ findings (Phase 2B, comparison with 2026 systems) */
// Every number is read from summary.phase2b (deploy/results.py phase2b_summary), itself read from archived result
// files. gRefCOCO and Ref-Adv-s appear as aggregate numbers only (annotation licences not confirmed).
const PCT = x => `${f2(x)}%`;
function segCtl(label, opts, cur, onPick) {
  const box = h("div", { class: "seg", role: "group", "aria-label": label });
  const draw = v => $$("button", box).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  for (const [v, name] of opts) box.append(h("button", { type: "button", "data-v": v, onclick: () => { draw(v); onPick(v); } }, name));
  draw(cur);
  return box;
}
function hbars({ groups, series, max = 100, unit = "", refs = [], aria }) {
  // grouped horizontal bars; groups: [[key,label,n]], series: [{name,color,values:{key:v}}]
  const W = 900, left = 150, right = 70, bh = 14, gap = 3, gpad = 16, pw = W - left - right;
  const svg = h("svg", { class: "ch", role: "img", "aria-label": aria });
  let y = 8;
  const X = v => left + pw * Math.max(0, v) / max;
  for (const t of [0, 25, 50, 75, 100].filter(t => t <= max)) svg.append(h("line", { class: "gl", x1: X(t), x2: X(t), y1: 0, y2: 1, "data-t": t }));
  const gl = $$("line", svg), gy = {};
  for (const [g, gname, n] of groups) {
    const gh = series.length * (bh + gap);
    gy[g] = [y - 5, y + gh + 2];
    svg.append(h("text", { class: "lab", x: left - 12, y: y + gh / 2 + 2, "text-anchor": "end" }, gname),
      n ? h("text", { x: left - 12, y: y + gh / 2 + 16, "text-anchor": "end" }, `n ${n.toLocaleString("en")}`) : "");
    series.forEach((s, k) => {
      const v = s.values[g], yy = y + k * (bh + gap);
      if (v === undefined || v === null) return;
      const m = h("g", { class: "m" }, h("rect", { class: "mark", x: left, y: yy, width: Math.max(2, X(v) - left), height: bh, rx: 3, style: `fill:${s.color}` }),
        h("text", { class: "val", x: X(v) + 6, y: yy + bh - 3 }, f2(v, 1)),
        h("rect", { class: "hit", x: left, y: yy - 1, width: pw, height: bh + 2 }));
      hover(m, `<b>${esc(s.name)}</b><br>${esc(gname)}: ${f2(v)}${unit}${n ? `<br>n ${n.toLocaleString("en")}` : ""}`);
      svg.append(m);
    });
    y += gh + gpad;
  }
  const yb = y - gpad + 4;
  for (const r of refs) {
    const [ra, rb] = r.group && gy[r.group] ? gy[r.group] : [0, yb];
    const g = h("g", { class: "m" }, h("line", { x1: X(r.v), x2: X(r.v), y1: ra, y2: rb, style: "stroke:var(--ink);stroke-width:1.5;stroke-dasharray:3 3" }),
      h("rect", { class: "hit", x: X(r.v) - 5, y: ra, width: 10, height: rb - ra }));
    hover(g, `<b>${esc(r.name)}</b>: ${f2(r.v, 1)}${unit}<br>${esc(r.source)}<br>Reported by its authors; not the same run.`);
    svg.append(g);
  }
  gl.forEach(l => { l.setAttribute("y2", yb); svg.append(h("text", { x: l.getAttribute("x1"), y: yb + 16, "text-anchor": "middle" }, l.dataset.t)); });
  svg.append(h("line", { class: "base", x1: left, x2: left, y1: 0, y2: yb }));
  svg.setAttribute("viewBox", `0 0 ${W} ${yb + 24}`);
  return svg;
}
const refLegend_ = () => h("span", {}, h("i", { style: "background:none;border-left:2px dashed var(--ink);border-radius:0" }), "published 2026 systems, all rows");
function refNote(refs, src) {
  if (!refs.length) return "";
  return h("p", { class: "note" }, "Dashed lines on the all-rows group, as published by their authors (" + src + "); different runs, not the same rows: " +
    [...refs].sort((a, b) => b.v - a.v).map(r => `${r.name} ${f2(r.v, 1)}`).join("; ") + ".");
}
function legendRow(series, extra = []) {
  return h("div", { class: "legend" }, ...series.map(s => h("span", {}, h("i", { style: `background:${s.color}` }), s.name)), ...extra);
}
function figPanel(title, src, ...kids) {
  return h("div", { class: "panel pad" }, h("figure", { class: "chart" }, h("figcaption", {}, h("h3", {}, title), h("span", { class: "src" }, src)), ...kids));
}

async function initFindings() {
  if (S.inited.findings) return;
  S.inited.findings = true;
  const R = S.summary || (S.summary = await api("/api/summary"));
  const P = R.phase2b, box = $("#fx");
  if (!P) { box.append(h("p", { class: "muted" }, "This build has no Phase 2B results.")); return; }
  const g = P.grefcoco, ta = g && g.testA.scores, comp = P.components || [], c0 = comp[0], adv = P.refadv;
  const cards = [];
  if (ta) cards.push(h("div", {}, h("div", { class: "fig" }, f2(ta.router.none.exact_set), h("small", {}, "%")),
    h("p", {}, `of the gRefCOCO testA expressions with no target are answered “nothing here” by the router; Qwen3-VL-8B does so on ${f2(ta.vlm.none.exact_set)}% with its own prompt and ${f2(ta.vlm_e.none.exact_set)}% when told it may (E30, E33).`)));
  if (c0) cards.push(h("div", {}, h("div", { class: "fig" }, sg(c0.both_minus_program.diff), h("small", {}, "points")),
    h("p", {}, `from the decidable checks over the unchecked program on untouched ${c0.setting} (95% interval ${sg(c0.both_minus_program.ci95[0])} to ${sg(c0.both_minus_program.ci95[1])}); the checks raise the program on every benchmark tested.`)));
  if (c0) cards.push(h("div", {}, h("div", { class: "fig" }, f2(c0.accepted_acc.both), h("small", {}, "%")),
    h("p", {}, `accuracy of the programs the checks accept on ${c0.setting}, at ${f2(c0.coverage.both, 1)}% coverage, against ${f2(c0.accuracy.program)}% for all programs.`)));
  if (adv) cards.push(h("div", {}, h("div", { class: "fig" }, f2(adv.scores.specguard.all["acc@0.5"]), h("small", {}, "%")),
    h("p", {}, `Spec-Guard on the adversarial Ref-Adv-s, against ${f2(adv.scores.qwen3vl.all["acc@0.5"])}% for Qwen3-VL-8B: where an end-to-end 2026 model is far ahead, stated as a limit.`)));
  box.append(
    h("nav", { class: "seg jump", "aria-label": "Findings sections" }, ...[["fx-walk", "Pipeline walkthrough"], ["fx-g", "Absent objects"], ["fx-adv", "Adversarial"],
      ["fx-sel", "What the checks accept"], ["fx-cost", "Cost"], ["fx-hyp", "Hypotheses"], ["fx-lim", "Limits"], ["fx-figs", "Figures"]]
      .map(([id, n]) => h("a", { href: "#findings", class: "linkbtn", onclick: e => { e.preventDefault(); $("#" + id).scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); } }, n))),
    h("div", { class: "evidence fx-cards" }, ...cards),
    walkthrough(P.walkthrough),
    grefcocoPanel(g, R.published),
    refadvPanel(adv, R.published),
    selectivePanel(comp, P.note_a),
    costPanel(P.cost),
    hypPanel(P.hypotheses),
    limitsPanel(P, R),
    figuresPanel(P.figures));
}

/* pipeline walkthrough: one case at a time, four steps, played or stepped */
function walkthrough(cases) {
  if (!cases || !cases.length) return "";
  const names = { T: "Router, route T", A: "Spec-Guard accepts", F: "Spec-Guard falls back" };
  const wrap = h("div", { class: "panel pad", id: "fx-walk" });
  const body = h("div", { class: "wk" });
  let cur = cases[0], stepN = 0, timer = null;
  const steps = ["Program", "Execution", "Checks", "Answer"];
  const stepBtns = h("ol", { class: "wk-steps" });
  const stageBox = h("div", { class: "wk-stage" }), side = h("div", { class: "wk-side", "aria-live": "polite" });
  const play = h("button", { type: "button", class: "btn primary" }, "Play");
  const prev = h("button", { type: "button", class: "btn" }, "Back"), next = h("button", { type: "button", class: "btn" }, "Next");
  let img = null, ov = null;
  const q = h("p", { class: "wk-q" });
  const leg = h("span", { class: "small muted" });

  async function load(c) {
    cur = c; stop(); stageBox.replaceChildren(h("p", { class: "muted small" }, "Loading the image"));
    let src = null;
    try {
      if (c.mode === "openref") src = orImg(await api(`/api/rows/${encodeURIComponent(c.id)}`));
      else { const [sp, i] = c.id.split(":"); src = rcImg(await api(`/api/refcoco/rows/${sp}/${i}`), sp, +i); }
    } catch { src = null; }
    const [W, H] = c.image_size;
    img = h("div", { class: "stage", style: `aspect-ratio:${W}/${H};max-width:min(100%, calc(58vh * ${W} / ${H}))` });
    const inner = h("div", { class: "zoom" });
    inner.append(src ? h("img", { src, alt: `Image for “${c.query}”`, draggable: "false" }) : h("div", { class: "empty" }, "Image not stored here; boxes at their true positions."));
    ov = h("svg", { class: "ov", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" });
    inner.append(ov); img.append(inner); stageBox.replaceChildren(img);
    q.textContent = `“${c.query}”`;
    show(0);
  }
  const R_ = (b, cls, extra = {}) => h("rect", { class: cls, x: b[0], y: b[1], width: Math.max(1, b[2] - b[0]), height: Math.max(1, b[3] - b[1]), ...extra });
  function drawStep(n) {
    const c = cur, [W, H] = c.image_size, lw = Math.max(W, H) / 260;
    ov.replaceChildren(); ov.style.setProperty("--lw", lw);
    if (n >= 1) {
      const gAll = h("g", { class: "wk-all" });
      c.finds.forEach((f, k) => f.boxes.forEach(b => gAll.append(R_(b, k ? "wk-b2" : (c.grouping ? "wk-cand" : "wk-b1")))));
      ov.append(gAll);
      if (c.grouping) {
        const gl = h("g", { class: "wk-line" }); c.grouping.line.forEach(b => gl.append(R_(b, "wk-row"))); ov.append(gl);
        ov.append(R_(c.grouping.pick, "wk-pick"));
      }
      if (c.program_box) ov.append(R_(c.program_box, "wk-ret"));
    }
    if (n >= 3) {
      ov.replaceChildren();
      c.gt.forEach(b => { ov.append(R_(b, "wk-gth"), R_(b, "wk-gt")); });
      c.vlm.forEach(b => ov.append(R_(b, "wk-vl")));
      c.answer.forEach(b => ov.append(R_(b, "wk-ans")));
    }
    if (!reduced) $$("rect", ov).forEach((r, i) => { r.style.animationDelay = `${Math.min(i * 6, 900)}ms`; r.classList.add("pop"); });
  }
  function sideFor(n) {
    const c = cur, el = [];
    if (n === 0) {
      if (c.mode === "openref") el.push(h("p", { class: "small muted" }, "Qwen2.5-Coder-7B rewrites the expression as one line in a fixed format:"),
        h("pre", { class: "wk-code" }, c.normalised), h("p", { class: "small" }, h("span", { class: "tag t" }, `Route ${c.route}`), " ", c.route_reason, ". The program below is written by code from the parsed line; no language model writes it."));
      else el.push(h("p", { class: "small muted" }, `${c.program_source}:`));
      el.push(h("pre", { class: "wk-code", html: pyHtml(c.program) }));
    } else if (n === 1) {
      el.push(h("p", {}, "The program runs; every perception call is logged:"));
      const ul = h("ul", { class: "wk-calls" });
      c.finds.forEach((f, k) => ul.append(h("li", {}, h("code", {}, `find("${f.arg}")`), ` returned ${f.n} patch${f.n === 1 ? "" : "es"}`,
        h("i", { class: `sw ${c.grouping ? "cand" : k ? "b2" : "b1"}` }))));
      if (c.grouping) ul.append(h("li", {}, h("code", {}, `group_lines(…, "${c.grouping.side1}")`), ` makes ${c.grouping.lines} rows; row ${c.grouping.line_index} is kept`, h("i", { class: "sw row" })),
        h("li", {}, h("code", {}, `order_from(row, "${c.grouping.side2}")[${c.grouping.k - 1}]`), " is the answer", h("i", { class: "sw pick" })));
      if (c.depth_calls) ul.append(h("li", {}, h("code", {}, "compute_depth()"), ` on ${c.depth_calls} patches`));
      if (c.program_box) ul.append(h("li", {}, "the program returns the dotted patch", h("i", { class: "sw ret" })));
      el.push(ul);
    } else if (n === 2) {
      const s = c.spec_guard || {}, list = h("ul", { class: "wk-checks" });
      const row = (state, t, why) => h("li", { class: state }, h("b", {}, { pass: "✓", fail: "✗", info: "•", route: "→" }[state]), h("span", {}, t, h("small", {}, why)));
      if (c.mode === "openref") list.append(row("route", `Route ${c.route}`, c.route_reason));
      for (const [k, v] of Object.entries(s)) {
        const info = /G2/.test(k) && c.mode === "refcoco";
        list.append(row(info ? "info" : v.fires ? "fail" : "pass", k.replace(" (G4, E21)", "").replace(" (E22)", "") + (info ? " (reported only)" : ""), v.reason));
      }
      el.push(list);
      if (c.property_test) el.push(h("p", { class: "small muted" }, "Property test written by DeepSeek-Coder-V2-Lite, run on the returned patch:"),
        h("pre", { class: "wk-code", html: pyHtml(c.property_test) }),
        ...c.test_finds.map(f => h("p", { class: "small" }, `“${f.arg}” searched inside the returned patch: ${f.n} found.`)));
      list.querySelectorAll("li").forEach((li, i) => { if (!reduced) { li.style.animationDelay = `${i * 260}ms`; li.classList.add("pop"); } });
    } else {
      const why = c.mode === "refcoco" ? (c.route === "program" ? "Every check passed: the program’s patch is the answer." : "A check fired: the answer falls back to the detector’s top box (B0).")
        : (c.answer.length ? "The template program’s patch is the answer." : "The program found nothing: the answer is empty.");
      el.push(h("p", {}, why),
        h("div", { class: "wk-iou" }, h("div", {}, h("span", { class: "sw ans" }), "System", h("b", {}, f2(c.iou_system)), h("small", {}, "IoU with the ground truth")),
          h("div", {}, h("span", { class: "sw vl" }), "Qwen3-VL-8B", h("b", {}, f2(c.iou_vlm)), h("small", {}, "IoU with the ground truth"))),
        h("p", { class: "small muted" }, `Control: route and answer equal the archived run (${c.control.same_route && c.control.same_answer_boxes ? "passed" : "FAILED"}). Run by scripts/walkthrough_run.py at code ${c.run_commit}.`));
    }
    side.replaceChildren(h("h4", {}, `${n + 1}. ${steps[n]}`), ...el);
  }
  function show(n) {
    stepN = n;
    $$("li", stepBtns).forEach((li, i) => { li.classList.toggle("on", i === n); li.classList.toggle("done", i < n); $("button", li).setAttribute("aria-current", i === n ? "step" : "false"); });
    drawStep(n); sideFor(n);
    prev.disabled = n === 0; next.disabled = n === steps.length - 1;
    leg.replaceChildren(...(n === 0 ? [] : n < 3 ? ["Boxes as listed beside the image"]
      : ["Legend: ", h("span", { class: "sw ans" }), "answer ", h("span", { class: "sw gt" }), "ground truth ", h("span", { class: "sw vl" }), "Qwen3-VL-8B"]));
  }
  function stop() { if (timer) clearInterval(timer); timer = null; play.textContent = "Play"; }
  play.addEventListener("click", () => {
    if (timer) return stop();
    play.textContent = "Pause"; if (stepN === steps.length - 1) show(0);
    timer = setInterval(() => { if (stepN < steps.length - 1) show(stepN + 1); else stop(); }, 2600);
  });
  prev.addEventListener("click", () => { stop(); show(Math.max(0, stepN - 1)); });
  next.addEventListener("click", () => { stop(); show(Math.min(steps.length - 1, stepN + 1)); });
  steps.forEach((s, i) => stepBtns.append(h("li", {}, h("button", { type: "button", onclick: () => { stop(); show(i); } }, h("span", {}, i + 1), s))));
  const pick = segCtl("Case", cases.map(c => [c.key, names[c.key] || c.path]), cases[0].key, k => load(cases.find(c => c.key === k)));
  wrap.append(h("div", { class: "wk-head" }, h("div", {}, h("h3", {}, "Watch the pipeline run"),
      h("p", { class: "small muted" }, "Real runs of the code that serves this site, every perception call logged (scripts/walkthrough_run.py). Cases fixed by a rule before the run, one per path.")), pick),
    q, stepBtns, h("div", { class: "wk-body" }, stageBox, side),
    h("div", { class: "wk-ctl" }, prev, play, next, leg));
  load(cases[0]);
  return wrap;
}

function grefcocoPanel(g, pub) {
  if (!g) return "";
  const splits = [["testA", "testA"], ["testB", "testB"], ["conf", "train sample (untouched)"]];
  let sp = "testA", met = "exact_set";
  const holder = h("div");
  const SYS = [["router", "Decidable router", "var(--t)"], ["vlm", "Qwen3-VL-8B, prompt S1", "var(--vlm)"], ["vlm_e", "Qwen3-VL-8B, prompt S1E (may answer empty)", "var(--warn)"]];
  const draw = () => {
    const d = g[sp], groups = [["none", "No target", d.n.none], ["single", "One target", d.n.single], ["multiple", "Several targets", d.n.multiple], ["all", "All rows", d.n.all]];
    const series = SYS.filter(([k]) => d.scores[k]).map(([k, n, col]) => ({ name: n, color: col, values: Object.fromEntries(groups.map(([gk]) => [gk, d.scores[k][gk][met]])) }));
    const refs = met === "sample_f1" && sp === "testA" ? (pub && pub.grefcoco_testA || []).map(p => ({ name: p.system, v: p.sample_f1, source: p.source, group: "all" })) : [];
    holder.replaceChildren(legendRow(series, refs.length ? [refLegend_()] : []),
      h("div", { class: "scroll" }, h("div", { style: "min-width:640px" }, hbars({ groups, series, unit: "%", refs, aria: "gRefCOCO scores by number of targets" }))),
      refNote(refs, "VGE, arXiv 2611.22625, Table 1(a)"),
      d.role === "confirmation" ? h("p", { class: "note" }, "The train sample was never used to design or tune anything; it is where the post hoc combination rule (E32) was confirmed.") : "");
  };
  draw();
  const panel = figPanel("Saying “nothing here”: gRefCOCO, where some expressions have no target", "results/e32/e32_e33_*_results.json (E30, E32, E33)",
    h("p", { class: "note", style: "margin:0 0 12px" }, "A 2026 VLM almost always draws a box. The router’s program returns an empty answer when the detector finds nothing, so it says “nothing here” far more often. It is behind on expressions with one target: both are shown."),
    h("div", { class: "fx-ctl" }, segCtl("Split", splits, sp, v => { sp = v; draw(); }), segCtl("Metric", [["exact_set", "Exact set (no-target accuracy)"], ["sample_f1", "Sample F1"]], met, v => { met = v; draw(); })),
    holder, h("p", { class: "note" }, "Exact set: every target found and nothing else; on no-target rows this is no-target accuracy. Sample F1 follows VGE (arXiv 2611.22625). S1E was not run on testB."));
  panel.id = "fx-g";
  return panel;
}

function refadvPanel(adv, pub) {
  if (!adv) return "";
  const subsets = [["all", "All"], ["negation", "With negation"], ["no_negation", "Without"], ["distractors_2_3", "2-3 distractors"],
    ["distractors_4_6", "4-6"], ["distractors_7plus", "7 or more"], ["coco", "COCO images"], ["openimages", "Open Images"]];
  const SYS = [["specguard", "Spec-Guard", "var(--t)"], ["program", "Program alone", "var(--p)"], ["b0", "Detector only (B0)", "var(--ink-3)"], ["qwen3vl", "Qwen3-VL-8B", "var(--vlm)"]];
  let thr = "acc@0.5";
  const holder = h("div");
  const draw = () => {
    const groups = subsets.map(([k, n]) => [k, n, adv.scores.specguard[k].n]);
    const series = SYS.map(([k, n, col]) => ({ name: n, color: col, values: Object.fromEntries(groups.map(([gk]) => [gk, adv.scores[k][gk][thr]])) }));
    const refs = thr === "acc@0.5" ? (pub && pub.refadv_s || []).map(p => ({ name: p.system, v: p.acc50, source: p.source, group: "all" })) : [];
    holder.replaceChildren(legendRow(series, refs.length ? [refLegend_()] : []),
      h("div", { class: "scroll" }, h("div", { style: "min-width:640px" }, hbars({ groups, series, unit: "%", refs, aria: "Ref-Adv-s accuracy by subset" }))),
      refNote(refs, "Ref-Adv repository table, ICLR 2026"));
  };
  draw();
  const panel = figPanel("Adversarial expressions: Ref-Adv-s (ICLR 2026)", "results/e31/e31_results.json (E31)",
    h("p", { class: "note", style: "margin:0 0 12px" }, `The checks lift the program on hard distractors and negation, and fall back to the detector on ${f2(adv.fallback_rate, 1)}% of rows; an end-to-end 2026 VLM stays far ahead here. Reported as a limit.`),
    h("div", { class: "fx-ctl" }, segCtl("IoU threshold", [["acc@0.5", "IoU 0.5"], ["acc@0.75", "0.75"], ["acc@0.9", "0.9"]], thr, v => { thr = v; draw(); })),
    holder);
  panel.id = "fx-adv";
  return panel;
}

function selectivePanel(comp, noteA) {
  if (!comp.length) return "";
  let k = 0;
  const holder = h("div");
  const RULES = [["all", "All programs", "circle"], ["whole_image_only", "Whole-image rule passed", "square"], ["test_only", "Property test passed", "triangle"], ["both", "Both passed (Spec-Guard)", "star"]];
  const shape = (s, x, y, r, cls) => s === "circle" ? h("circle", { cx: x, cy: y, r, class: cls }) : s === "square" ? h("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, class: cls })
    : s === "triangle" ? h("path", { d: `M${x},${y - r * 1.2}L${x + r * 1.1},${y + r * .8}L${x - r * 1.1},${y + r * .8}Z`, class: cls })
      : h("path", { d: Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .55 : r * 1.4; return `${i ? "L" : "M"}${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`; }).join("") + "Z", class: cls });
  const draw = () => {
    const c = comp[k], W = 640, H = 330, l = 56, r = 20, t = 14, b = 44, X = v => l + (W - l - r) * v / 100;
    const ys = [c.accuracy.b0, c.accuracy.program, ...Object.values(c.accepted_acc)], na0 = noteA && noteA[c.setting];
    if (na0) ys.push(na0.b0_acc_accepted);
    const lo = Math.max(0, Math.floor((Math.min(...ys) - 5) / 10) * 10), Y = v => t + (H - t - b) * (1 - (v - lo) / (100 - lo));
    const yt = []; for (let v = lo; v <= 100; v += 10) yt.push(v);
    const svg = h("svg", { class: "ch", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Accuracy of accepted programs against coverage, ${c.setting}` });
    for (const v of [0, 20, 40, 60, 80, 100]) svg.append(h("line", { class: "gl", x1: X(v), x2: X(v), y1: t, y2: H - b }), h("text", { x: X(v), y: H - b + 18, "text-anchor": "middle" }, v));
    for (const v of yt) svg.append(h("line", { class: "gl", x1: l, x2: W - r, y1: Y(v), y2: Y(v) }), h("text", { x: l - 8, y: Y(v) + 4, "text-anchor": "end" }, v));
    
    svg.append(h("text", { x: (l + W - r) / 2, y: H - 6, "text-anchor": "middle" }, "Programs accepted (coverage, %)"),
      h("text", { x: 14, y: (t + H - b) / 2, transform: `rotate(-90 14 ${(t + H - b) / 2})`, "text-anchor": "middle" }, "Accuracy of accepted programs (%)"));
    const b0 = h("g", { class: "m" }, h("line", { x1: l, x2: W - r, y1: Y(c.accuracy.b0), y2: Y(c.accuracy.b0), style: "stroke:var(--ink-3);stroke-dasharray:4 4" }),
      h("text", { x: W - r - 4, y: Y(c.accuracy.b0) - 6, "text-anchor": "end" }, `detector alone, all rows ${f2(c.accuracy.b0)}`),
      h("rect", { class: "hit", x: l, y: Y(c.accuracy.b0) - 6, width: W - l - r, height: 12 }));
    hover(b0, `<b>Detector only (B0)</b>, every row: ${f2(c.accuracy.b0)}%`);
    svg.append(b0);
    const na = noteA && noteA[c.setting];
    if (na) {
      const m = h("g", { class: "m" }, shape("circle", X(na.accepted_pct), Y(na.b0_acc_accepted), 7, "na"), h("rect", { class: "hit", x: X(na.accepted_pct) - 10, y: Y(na.b0_acc_accepted) - 10, width: 20, height: 20 }));
      hover(m, `<b>Detector alone on the same accepted rows</b>: ${f2(na.b0_acc_accepted)}%<br>accepted programs ${f2(na.program_acc_accepted)}%; difference ${sg(na.program_minus_b0_accepted[0])} (95% interval ${sg(na.program_minus_b0_accepted[1])} to ${sg(na.program_minus_b0_accepted[2])})`);
      svg.append(m);
    }
    for (const [rk, rn, sh] of RULES) {
      const x = rk === "all" ? 100 : c.coverage[rk], y = rk === "all" ? c.accuracy.program : c.accepted_acc[rk];
      const m = h("g", { class: "m" }, shape(sh, X(x), Y(y), 7, rk === "both" ? "sgp" : "pp"), h("rect", { class: "hit", x: X(x) - 10, y: Y(y) - 10, width: 20, height: 20 }));
      hover(m, `<b>${esc(rn)}</b><br>coverage ${f2(x, 1)}%, accuracy ${f2(y)}%`);
      svg.append(m);
    }
    holder.replaceChildren(h("div", { class: "legend" }, ...RULES.map(([, n, sh]) => h("span", {}, h("svg", { viewBox: "0 0 16 16", width: 14, height: 14 }, shape(sh, 8, 8, 5, n.startsWith("Both") ? "sgp" : "pp")), n)),
      h("span", {}, h("i", { style: "background:none;border-top:2px dashed var(--ink-3);border-radius:0;height:0" }), "detector alone, all rows"),
      na ? h("span", {}, h("svg", { viewBox: "0 0 16 16", width: 14, height: 14 }, h("circle", { cx: 8, cy: 8, r: 5, class: "na" })), "detector alone, same accepted rows") : ""),
      h("div", { class: "scroll" }, h("div", { style: "min-width:420px;max-width:760px" }, svg)),
      na ? h("p", { class: "note" }, `Read this with care: on ${c.setting} the detector alone is ${f2(na.b0_acc_accepted)}% on the very rows whose programs the checks accept, against ${f2(na.program_acc_accepted)}% for those programs. The checks select reliable programs; they do not make programs better than the detector.`)
        : h("p", { class: "note" }, "Post hoc decomposition of registered runs (A2)."));
  };
  draw();
  const panel = figPanel("What the checks accept is far more precise", "results/analysis/a1_a2.json (A2, post hoc) and results/e24/e24_results.json",
    h("div", { class: "fx-ctl" }, segCtl("Benchmark", comp.map((c, i) => [String(i), c.setting]), "0", v => { k = +v; draw(); })), holder);
  panel.id = "fx-sel";
  return panel;
}

function costPanel(cost) {
  if (!cost) return "";
  const rows = [];
  const COL = { "Decidable router": "var(--t)", "Spec-Guard": "var(--t)", "Program alone": "var(--p)", "Detector only (B0)": "var(--ink-3)", "Qwen3-VL-8B, S1": "var(--vlm)" };
  for (const [, s] of Object.entries(cost)) for (const [n, v] of Object.entries(s.systems)) rows.push({ set: s.label, metric: s.metric, n, ...v });
  const W = 900, l = 300, r = 110, rh = 30, H = 40 + rh * rows.length, lo = Math.log10(0.2), hi = Math.log10(16), X = v => l + (W - l - r) * (Math.log10(v) - lo) / (hi - lo);
  const svg = h("svg", { class: "ch", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Seconds per query" });
  for (const v of [0.25, 0.5, 1, 2, 4, 8]) svg.append(h("line", { class: "gl", x1: X(v), x2: X(v), y1: 20, y2: H - 10 }), h("text", { x: X(v), y: 14, "text-anchor": "middle" }, `${v} s`));
  let last = null;
  rows.forEach((d, i) => {
    const y = 34 + i * rh;
    if (d.set !== last) { svg.append(h("text", { class: "lab", x: 4, y: y + 4, style: "font-weight:600" }, d.set)); last = d.set; }
    const g = h("g", { class: "m" }, h("text", { class: "lab", x: l - 12, y: y + 4, "text-anchor": "end" }, d.n),
      h("line", { x1: X(d.p10_s), x2: X(d.p90_s), y1: y, y2: y, style: `stroke:${COL[d.n] || "var(--ink-2)"};stroke-width:5;stroke-linecap:round;opacity:.35` }),
      h("circle", { class: "mark", cx: X(d.median_s), cy: y, r: 6, style: `fill:${COL[d.n] || "var(--ink-2)"}` }),
      h("text", { class: "val", x: W - r + 10, y: y + 4 }, `${d.metric === "sample_f1" ? "F1" : "Acc"} ${f2(d.accuracy, 1)}`),
      h("rect", { class: "hit", x: 0, y: y - rh / 2, width: W, height: rh }));
    hover(g, `<b>${esc(d.n)}</b> (${esc(d.set)})<br>median ${f2(d.median_s)} s; 10th to 90th percentile ${f2(d.p10_s)} to ${f2(d.p90_s)} s<br>${d.metric === "sample_f1" ? "sample F1" : "accuracy at IoU 0.5"} ${f2(d.accuracy)}`);
    svg.append(g);
  });
  const panel = figPanel("What it costs: seconds per query on the same rows", "results/analysis/cost_accuracy.json (descriptive)",
    h("p", { class: "note", style: "margin:0 0 12px" }, "Stage timings recorded for every row, one H100 NVL shard, batch 1; the dot is the median, the bar the 10th to 90th percentile. The checked programs are slower than an 8B VLM in this implementation; training-free, but not cheaper."),
    h("div", { class: "scroll" }, h("div", { style: "min-width:640px" }, svg)));
  panel.id = "fx-cost";
  return panel;
}

function hypPanel(hyps) {
  if (!hyps || !hyps.length) return "";
  const panel = figPanel("Registered hypotheses, Phase 2B", "results/e30, e31, e32 result files",
    h("p", { class: "note", style: "margin:0 0 12px" }, "Each was written before its run; a hypothesis holds when the 95% interval is above zero. Falsified ones are shown as prominently as the rest."),
    h("div", { class: "scroll" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "Experiment"), h("th", {}, "Hypothesis"), h("th", {}, "Data"), h("th", { class: "n" }, "Difference"), h("th", { class: "n" }, "95% interval"), h("th", {}, "Verdict"))),
      h("tbody", {}, ...hyps.map(x => h("tr", {}, h("td", {}, h("b", {}, x.exp)), h("td", {}, x.name.replace(/\bvlm_e\b/g, "Qwen3-VL-8B (S1E)").replace(/\bvlm\b/g, "Qwen3-VL-8B (S1)").replace(/\bC\b/g, "rule C"),
        x.post_hoc ? h("span", { class: "tag", style: "margin-left:6px" }, "post hoc on this split") : ""), h("td", { class: "muted" }, x.split),
        h("td", { class: "n" }, sg(x.diff)), h("td", { class: "n" }, `${sg(x.ci95[0])} to ${sg(x.ci95[1])}`),
        h("td", {}, h("span", { class: `tag ${x.holds ? "ok" : "warn"}` }, x.holds ? "Holds" : "Falsified"))))))));
  panel.id = "fx-hyp";
  return panel;
}

function limitsPanel(P, R) {
  const L = [], g = P.grefcoco, c = P.components || [], adv = P.refadv, na = P.note_a, cost = P.cost;
  if (g) L.push(["Far below a 2026 VLM on single-target expressions", `gRefCOCO testA, one target: sample F1 ${f2(g.testA.scores.router.single.sample_f1)} against ${f2(g.testA.scores.vlm.single.sample_f1)} for Qwen3-VL-8B.`]);
  if (c[0]) L.push(["Spec-Guard below the detector alone on RefCOCO testB", `${f2(c[0].accuracy.both)} against ${f2(c[0].accuracy.b0)}; on RefCOCO+ testB the two are level (${f2(c[1].accuracy.both)} and ${f2(c[1].accuracy.b0)}).`]);
  const e32 = (P.hypotheses || []).find(x => x.exp === "E32" && /H1/.test(x.name) && /untouched/.test(x.split));
  if (e32) L.push(["Combining the router’s empty answer with the VLM does not help", `On untouched data the combination is ${sg(e32.diff)} points below Qwen3-VL-8B (95% interval ${sg(e32.ci95[0])} to ${sg(e32.ci95[1])}).`]);
  if (g && P.router_rejections) L.push(["The router’s empty answers are imprecise", `It answers nothing on ${f2(g.conf.router_empty_rate.present, 1)}% of untouched rows that do have a target; ${f2(Math.min(...Object.values(P.router_rejections)), 0)} to ${f2(Math.max(...Object.values(P.router_rejections)), 0)}% of these are programs that raised an error.`]);
  const e33 = (P.hypotheses || []).find(x => x.exp === "E33" && /H1/.test(x.name) && /untouched/.test(x.split));
  if (e33) L.push(["The lead on absent objects shrinks on untouched data", `Router over Qwen3-VL-8B told it may answer empty: ${sg(e33.diff)} points on the untouched sample (95% interval ${sg(e33.ci95[0])} to ${sg(e33.ci95[1])}).`]);
  if (adv) L.push(["Adversarial expressions", `Ref-Adv-s: Spec-Guard ${f2(adv.scores.specguard.all["acc@0.5"])} against ${f2(adv.scores.qwen3vl.all["acc@0.5"])} for Qwen3-VL-8B.`]);
  if (na) { const a = na["RefCOCO testB"]; L.push(["Accepted rows are easy rows", `On RefCOCO testB the detector alone is ${f2(a.b0_acc_accepted)}% on the rows whose programs are accepted, against ${f2(a.program_acc_accepted)}% for those programs.`]); }
  if (cost) { const r = cost.grefcoco_testA.systems, a = cost.refadv_s.systems; L.push(["Not cheaper per query than an 8B VLM", `Median ${f2(r["Decidable router"].median_s)} s against ${f2(r["Qwen3-VL-8B, S1"].median_s)} s (gRefCOCO); Spec-Guard ${f2(a["Spec-Guard"].median_s)} s against ${f2(a["Qwen3-VL-8B, S1"].median_s)} s (Ref-Adv-s).`]); }
  const panel = h("div", { class: "panel pad", id: "fx-lim" }, h("h3", {}, "What this work does not show"),
    h("p", { class: "note", style: "margin:4px 0 14px" }, "Stated in the paper beside the claims they qualify. No claim is made of beating 2026 VLMs or trained systems."),
    h("ol", { class: "fx-lims" }, ...L.map(([t, d]) => h("li", {}, h("b", {}, t), h("span", {}, d)))));
  return panel;
}

function figuresPanel(figs) {
  if (!figs || !figs.length) return "";
  const url = n => STATIC ? `data/fig/${n}.png` : `/api/figure/${n}`;
  const dlg = h("dialog", { class: "fx-dlg", "aria-label": "Figure" });
  const show = f => { dlg.replaceChildren(h("button", { type: "button", class: "icon-btn fx-x", "aria-label": "Close", onclick: () => dlg.close() }, "×"),
    h("img", { src: url(f.name), alt: f.title }), h("p", {}, h("b", {}, f.name), " ", f.title)); dlg.showModal(); };
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  const panel = h("div", { class: "panel pad", id: "fx-figs" }, h("h3", {}, "Paper figures"),
    h("p", { class: "note", style: "margin:4px 0 14px" }, "Drawn from archived JSON by committed scripts and checked for the ACL page (docs/figure_audit.md). Figures that show gRefCOCO or Ref-Adv-s images are kept out of the public site."),
    h("div", { class: "fx-gal" }, ...figs.map(f => h("button", { type: "button", class: "fx-fig", onclick: () => show(f) },
      h("img", { src: url(f.name), alt: "", loading: "lazy" }), h("span", {}, f.title)))), dlg);
  return panel;
}

/* ------------------------------------------------------------------ start */
initTheme();
initPresent();
await loadHealth();
addEventListener("hashchange", route);
route();
setInterval(loadHealth, 20000);
