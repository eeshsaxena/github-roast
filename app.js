/*
 * app.js: UI, GitHub fetch, render, and PNG export.
 * Everything runs client-side. No keys, no backend, no storage.
 */

const $ = (id) => document.getElementById(id);
const form = $("roast-form");
const input = $("username");
const goBtn = $("go");
const statusEl = $("status");
const resultEl = $("result");

let lastResult = null; // { user, analysis } for export/copy

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = input.value.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").split("/")[0];
  if (!raw) return;
  runRoast(raw);
});

$("again").addEventListener("click", () => {
  resultEl.hidden = true;
  input.value = "";
  input.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("copy").addEventListener("click", copyRoast);
$("download").addEventListener("click", downloadCard);

async function runRoast(username) {
  goBtn.disabled = true;
  resultEl.hidden = true;
  showStatus(`<div class="spinner"></div>Digging through @${escapeHtml(username)}'s repos…`);

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`),
    ]);

    if (userRes.status === 404) throw new Error(`No GitHub user called "${username}". Typo, or did they rage-quit?`);
    if (userRes.status === 403) throw new Error("GitHub rate limit hit (60/hr unauthenticated). Give it a minute and try again.");
    if (!userRes.ok) throw new Error(`GitHub said ${userRes.status}. Rude.`);

    const user = await userRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];

    const analysis = RoastEngine.analyze({ user, repos });
    lastResult = { user, analysis };
    render(user, analysis);
  } catch (err) {
    showStatus(`⚠️ ${escapeHtml(err.message)}`, true);
  } finally {
    goBtn.disabled = false;
  }
}

function render(user, a) {
  statusEl.hidden = true;

  $("avatar").src = user.avatar_url || "";
  $("card-name").textContent = user.name || user.login;
  $("card-handle").textContent = "@" + user.login;
  $("score-num").textContent = a.score;
  $("verdict").textContent = a.verdict;

  const roastsEl = $("roasts");
  roastsEl.innerHTML = "";
  a.roasts.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    roastsEl.appendChild(li);
  });

  const statRow = $("stat-row");
  statRow.innerHTML = "";
  a.stats.forEach((s) => {
    const d = document.createElement("div");
    d.className = "stat";
    d.innerHTML = `<div class="n">${escapeHtml(String(s.n))}</div><div class="l">${escapeHtml(s.l)}</div>`;
    statRow.appendChild(d);
  });

  const gl = $("glowup-list");
  gl.innerHTML = "";
  a.glowups.forEach((g) => {
    const li = document.createElement("li");
    li.textContent = g;
    gl.appendChild(li);
  });

  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showStatus(html, isError = false) {
  statusEl.innerHTML = html;
  statusEl.className = "status" + (isError ? " error" : "");
  statusEl.hidden = false;
}

function copyRoast() {
  if (!lastResult) return;
  const { user, analysis } = lastResult;
  const text =
    `🔥 GitHub Roast of @${user.login}: ${analysis.score}/100\n\n` +
    `${analysis.verdict}\n\n` +
    analysis.roasts.map((r) => "🔥 " + r).join("\n") +
    `\n\nRoast yourself before they do 👉 github-roast`;
  navigator.clipboard.writeText(text).then(() => flash($("copy"), "Copied! ✓"));
}

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1400);
}

/* ---------- PNG export: hand-drawn on canvas so it always works offline ---------- */
async function downloadCard() {
  if (!lastResult) return;
  const { user, analysis } = lastResult;
  const c = $("export-canvas");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#12141c");
  bg.addColorStop(1, "#0b0d12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow accents
  radial(ctx, W * 0.1, H * 0.08, 500, "rgba(255,106,43,0.18)");
  radial(ctx, W * 0.95, H * 0.95, 520, "rgba(124,92,255,0.18)");

  const pad = 80;
  let y = 96;

  // Title
  ctx.fillStyle = "#ff8a3d";
  ctx.font = "800 46px system-ui, sans-serif";
  ctx.fillText("🔥 GitHub Roast", pad, y);
  y += 70;

  // Avatar
  try {
    const img = await loadImg(user.avatar_url);
    roundImage(ctx, img, pad, y, 110, 26);
  } catch (_) { /* avatar optional */ }

  // Name + handle
  ctx.fillStyle = "#eef1f6";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText(clip(ctx, user.name || user.login, 620), pad + 140, y + 48);
  ctx.fillStyle = "#9aa4b6";
  ctx.font = "400 30px system-ui, sans-serif";
  ctx.fillText("@" + user.login, pad + 140, y + 92);

  // Score badge
  ctx.fillStyle = "#ff8a3d";
  ctx.font = "900 84px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(analysis.score), W - pad, y + 72);
  ctx.fillStyle = "#9aa4b6";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("/100", W - pad, y + 104);
  ctx.textAlign = "left";

  y += 170;

  // Verdict
  ctx.fillStyle = "#eef1f6";
  ctx.font = "700 34px system-ui, sans-serif";
  y = wrapText(ctx, analysis.verdict, pad, y, W - pad * 2, 46);
  y += 30;

  // Roast lines
  ctx.font = "400 30px system-ui, sans-serif";
  analysis.roasts.slice(0, 5).forEach((r) => {
    ctx.fillStyle = "#ff8a3d";
    ctx.fillText("🔥", pad, y);
    ctx.fillStyle = "#dfe4ee";
    y = wrapText(ctx, r, pad + 54, y, W - pad * 2 - 54, 40) + 22;
  });

  // Footer
  ctx.fillStyle = "#565e72";
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText("github-roast · roast yourself before they do", pad, H - 60);

  // Download
  const link = document.createElement("a");
  link.download = `github-roast-${user.login}.png`;
  link.href = c.toDataURL("image/png");
  link.click();
  flash($("download"), "Saved! ✓");
}

/* ---- canvas helpers ---- */
function radial(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function roundImage(ctx, img, x, y, size, radius) {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
