// ============================================================================
// LINK TERMINAL — URL shortener frontend
// Static site (S3) -> API Gateway HTTP API -> Lambda -> DynamoDB (LinkMappings)
// Routes:  POST /api/links   GET /api/links   GET /api/resolve/{short_code}
// ============================================================================
const API_BASE = "https://3d12ebwpy0.execute-api.us-east-1.amazonaws.com";
const RECENT_KEY = "link-terminal-recent-v1";   // fallback list only (codes used in this browser)
const THEME_KEY = "link-terminal-page-theme";

const $ = (id) => document.getElementById(id);
let busy = false;
let lastResult = null;

function endpoint(path) {
  return API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api/" + path.replace(/^\/+/, "");
}
function apiMessage(data, fallback) {
  const m = data && (data.error || data.message);
  return typeof m === "string" && m.trim() ? m : fallback;
}
function safeHref(u) {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.href : "#";
  } catch (_) { return "#"; }
}

// ---------- small UI helpers ----------
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
function setStatus(msg, isErr) {
  $("status").textContent = msg;
  $("status").parentElement.classList.toggle("err", !!isErr);
}
function setBadge(text, kind) {
  const b = $("badge");
  b.textContent = text;
  b.className = "badge" + (kind ? " " + kind : "");
}
function setLive(ok) {
  $("liveBadge").classList.toggle("off", !ok);
  $("liveText").textContent = ok ? "AWS live API" : "API unreachable";
}
function setBusy(on) {
  busy = on;
  $("resolveBtn").disabled = on;
  $("saveBtn").disabled = on;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
  }
  toast("Copied to clipboard");
}

// ---------- request-flow indicator ----------
const NODES = ["nodeBrowser", "nodeApi", "nodeLambda", "nodeDb"];
let flowTimers = [];
function flowReset() {
  flowTimers.forEach(clearTimeout); flowTimers = [];
  NODES.forEach((id) => $(id).classList.remove("on", "fail"));
}
function flowStart(route) {
  flowReset();
  $("flowRoute").textContent = route;
  NODES.forEach((id, i) => flowTimers.push(setTimeout(() => $(id).classList.add("on"), i * 280)));
}
function flowStop(ok) {
  flowTimers.forEach(clearTimeout); flowTimers = [];
  NODES.forEach((id) => { $(id).classList.remove("fail"); $(id).classList.toggle("on", ok); });
  if (!ok) $("nodeApi").classList.add("fail");
}

// ---------- QR code (real, scannable: encodes the destination URL) ----------
function drawQr(text) {
  const canvas = $("qrCanvas");
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4, scale = 6;
  const size = (n + quiet * 2) * scale;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }
}

// ---------- result panel ----------
function showResult(code, url, ms) {
  lastResult = { code, url };
  $("empty").hidden = true;
  $("result").hidden = false;
  $("resultCode").textContent = code;
  $("latency").textContent = ms + " ms";
  const href = safeHref(url);
  const a = $("resultUrl");
  a.textContent = url; a.href = href;
  $("openBtn").href = href;
  // QR encodes the normalized, percent-encoded URL so any scanner opens it.
  try {
    drawQr(new URL(url).href);
    document.querySelector(".qr-wrap").hidden = false;
  } catch (e) {
    document.querySelector(".qr-wrap").hidden = true;
    toast("This URL is too long to show as a QR code.");
  }
  setBadge("RESOLVED", "ok");
}
function showError(code, message) {
  $("result").hidden = true;
  $("empty").hidden = false;
  $("empty").querySelector("p").textContent = message;
  setBadge(code ? "NOT FOUND" : "ERROR", "err");
  setStatus(message, true);
  toast(message);
}

// ---------- recent codes (fallback when the list route is not available) ----------
function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "{}") || {}; } catch (_) { return {}; }
}
function remember(code, url) {
  try {
    const r = readRecent(); r[code] = url;
    localStorage.setItem(RECENT_KEY, JSON.stringify(r));
  } catch (_) {}
}

// ---------- resolve ----------
async function resolve(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) { toast("Enter a short code first."); return; }
  if (busy) return;
  setBusy(true);
  setBadge("LOOKING UP…", "busy");
  setStatus(`Resolving ${code}…`);
  flowStart(`GET /api/resolve/${code}`);
  const t0 = performance.now();
  try {
    const res = await fetch(endpoint("resolve/" + encodeURIComponent(code)), { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = res.status === 404 ? "Short code not found" : apiMessage(data, `Lookup failed (HTTP ${res.status}).`);
      throw Object.assign(new Error(msg), { status: res.status });
    }
    const url = data && (data.url || data.destination_url || data.original_url);
    if (typeof url !== "string" || !url.trim()) throw new Error("The API response did not include a destination URL.");
    const ms = Math.max(1, Math.round(performance.now() - t0));
    flowStop(true); setLive(true);
    showResult(code, url, ms);
    remember(code, url);
    setStatus(`${code} resolved in ${ms} ms.`);
  } catch (e) {
    flowStop(!!e.status);   // an HTTP error (404 etc.) still means the request reached AWS
    if (e instanceof TypeError) {
      setLive(false);
      showError(null, "Could not reach the API. Check your network and the API CORS setting.");
    } else {
      showError(e.status === 404 ? code : null, e.message || "Could not complete the lookup.");
    }
  } finally {
    setBusy(false);
  }
}

// ---------- save ----------
async function saveMapping(rawCode, rawUrl) {
  const code = rawCode.trim().toUpperCase();
  const urlText = rawUrl.trim();
  if (!/^[A-Z0-9_-]{1,12}$/.test(code)) { toast("Code must be 1–12 letters, numbers, - or _."); return; }
  let url;
  try {
    const p = new URL(urlText);
    if (p.protocol !== "http:" && p.protocol !== "https:") throw new Error();
    url = p.href;
  } catch (_) { toast("Enter a valid URL starting with http:// or https://"); return; }
  if (busy) return;
  setBusy(true);
  setStatus(`Saving ${code}…`);
  flowStart("POST /api/links");
  try {
    const res = await fetch(endpoint("links"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ short_code: code, url })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = res.status === 409 ? apiMessage(data, "That short code already exists.") : apiMessage(data, `Could not save (HTTP ${res.status}).`);
      throw Object.assign(new Error(msg), { status: res.status });
    }
    flowStop(true); setLive(true);
    remember(code, url);
    toast(`Saved ${code} to DynamoDB.`);
    setStatus(`${code} saved.`);
    $("newCode").value = ""; $("newUrl").value = "";
    setBusy(false);
    await loadSaved();
    resolve(code);
  } catch (e) {
    flowStop(!!e.status);
    if (e instanceof TypeError) { setLive(false); toast("Could not reach the API. Check your network and the API CORS setting."); }
    else toast(e.message || "Could not save the mapping.");
    setStatus(e.message || "Save failed.", true);
  } finally {
    setBusy(false);
  }
}

// ---------- saved codes (from DynamoDB via GET /api/links) ----------
function normalizeItems(data) {
  const arr = Array.isArray(data) ? data : (data && (data.items || data.links || data.mappings)) || [];
  return arr.map((it) => ({
    code: String(it.short_code || it.code || "").toUpperCase(),
    url: it.url || it.original_url || it.destination_url || ""
  })).filter((it) => it.code);
}
function renderSaved(items, live) {
  const body = $("savedBody");
  body.textContent = "";
  items.sort((a, b) => a.code.localeCompare(b.code));
  items.forEach((it) => {
    const tr = document.createElement("tr");
    const c = document.createElement("td"); c.className = "code"; c.textContent = it.code;
    const d = document.createElement("td"); d.className = "dest"; d.textContent = it.url || "—";
    const a = document.createElement("td"); a.className = "right";
    const b1 = document.createElement("button"); b1.className = "row-btn"; b1.dataset.act = "resolve"; b1.dataset.code = it.code; b1.textContent = "Resolve";
    a.appendChild(b1);
    if (it.url) {
      const b2 = document.createElement("button"); b2.className = "row-btn"; b2.dataset.act = "copy"; b2.dataset.url = it.url; b2.textContent = "Copy"; b2.style.marginLeft = "6px";
      a.appendChild(b2);
    }
    tr.append(c, d, a); body.appendChild(tr);
  });
  $("savedWrap").hidden = items.length === 0;
  $("savedEmpty").hidden = items.length !== 0;
  $("savedCount").textContent = items.length + (items.length === 1 ? " code" : " codes");
  const note = $("savedNote");
  if (live) { note.hidden = true; }
}
async function loadSaved() {
  $("savedCount").textContent = "Loading…";
  try {
    const res = await fetch(endpoint("links"), { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error("list unavailable"), { status: res.status });
    renderSaved(normalizeItems(data), true);
    setLive(true);
  } catch (e) {
    // The list route is not available (yet): show only codes this browser has really saved or resolved.
    const recent = readRecent();
    const items = Object.keys(recent).map((k) => ({ code: k, url: recent[k] }));
    renderSaved(items, false);
    const note = $("savedNote");
    note.hidden = false;
    note.textContent = e instanceof TypeError
      ? "Could not reach the API, so the live list is unavailable. Showing codes saved or resolved in this browser."
      : "The live list needs the GET /api/links route on the API (see README). Showing codes saved or resolved in this browser.";
    if (e instanceof TypeError) setLive(false);
  }
}

// ---------- theme ----------
function initTheme() {
  const btn = $("themeToggleBtn");
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch (_) {}
  if (!theme) theme = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    btn.textContent = theme === "dark" ? "☀ Light mode" : "☾ Dark mode";
    btn.setAttribute("aria-pressed", String(theme === "dark"));
  };
  apply();
  btn.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
    apply();
  });
}

// ---------- wire up ----------
$("resolveForm").addEventListener("submit", (e) => { e.preventDefault(); resolve($("shortCode").value); });
$("addForm").addEventListener("submit", (e) => { e.preventDefault(); saveMapping($("newCode").value, $("newUrl").value); });
$("clearBtn").addEventListener("click", () => { $("shortCode").value = ""; $("shortCode").focus(); });
$("refreshBtn").addEventListener("click", loadSaved);
$("copyBtn").addEventListener("click", () => lastResult && copyText(lastResult.url));
$("qrDownloadBtn").addEventListener("click", () => {
  if (!lastResult) return;
  $("qrCanvas").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${lastResult.code}-qr.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});
$("savedBody").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.act === "resolve") { $("shortCode").value = b.dataset.code; resolve(b.dataset.code); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (b.dataset.act === "copy") copyText(b.dataset.url);
});

initTheme();
loadSaved();
