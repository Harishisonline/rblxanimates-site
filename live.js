// live.js — keeps every number on the page current.
//
// Order of truth: /api/stats (live, fetched by the Vercel function with private keys)
//   → falls back per platform to /data/stats.json (snapshot) → the HTML (pre-rendered snapshot).
// The last good live answer is cached in localStorage so repeat visits paint the newest
// numbers instantly, then quietly refresh.
//
// Markup contract:
//   data-stat="youtube.views"            text = value (data-format: full | compact | pct)
//   class="count" + data-stat            counts up when scrolled into view, re-animates on change
//   data-hide-empty="instagram.growthPct" hidden when that value is missing
//   data-ring                            <ol> rebuilt with the top 5 across both platforms
//   data-rail="youtube|instagram"        rail rebuilt with that platform's top 5
//   data-top="youtube|instagram"         "most viewed" card
//   data-stamp                           "live · updated 5 min ago" / snapshot date
import gsap from "gsap";

const CACHE_KEY = "rblx:stats:v1";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- formatting ----------
const full = (n) => Math.round(n).toLocaleString("en-US");
const compact = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};
const pct = (n) => (n > 0 ? "+" : "") + Math.round(n) + "%";
const FORMAT = { full, compact, pct };

// "😢 MY BULLY BEGGED ME… | ROBLOX STORY PART 2 #roblox" → "My bully begged me… Part 2"
function cleanTitle(t = "") {
  let s = t.replace(/\p{Extended_Pictographic}|️/gu, "").replace(/#[\p{L}\p{N}_]+/gu, "");
  const part = s.match(/part\s*\d+/i);
  s = s.split(/\s*[|│]\s*/)[0].replace(/\s+/g, " ").trim();
  if (part && !new RegExp(part[0], "i").test(s)) s += ` ${part[0].replace(/^p/i, "P")}`;
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) {
    s = s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase()).replace(/\bi\b/g, "I");
  }
  return s.replace(/^n this town/i, "In this town") || "Watch the story";
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ---------- data ----------
function merge(snap, live) {
  const out = structuredClone(snap);
  if (!live) return out;
  for (const p of ["youtube", "instagram"]) {
    if (!live[p]) continue;
    for (const [k, v] of Object.entries(live[p])) if (v != null && !(Array.isArray(v) && !v.length)) out[p][k] = v;
  }
  out.source = live.youtube || live.instagram ? "live" : snap.source;
  out.updatedAt = live.updatedAt || snap.updatedAt;
  out.partial = !!(live.errors && (live.errors.youtube || live.errors.instagram));
  return out;
}
function derive(d) {
  const yt = d.youtube, ig = d.instagram;
  d.total = { views: (yt.views || 0) + (ig.totalViews ?? ig.views30 ?? 0) };
  // top 5 across both platforms, skipping the same story posted twice (title word overlap)
  const words = (t) => new Set((t.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 3));
  const all = [...yt.top.map((v) => ({ ...v, platform: "youtube" })), ...ig.top.map((v) => ({ ...v, platform: "instagram" }))]
    .filter((v) => v.views != null).sort((a, b) => b.views - a.views);
  d.combined = [];
  for (const v of all) {
    const w = words(v.title);
    const dup = d.combined.some((o) => { const x = words(o.title); const inter = [...w].filter((k) => x.has(k)).length; return inter / Math.max(1, new Set([...w, ...x]).size) >= 0.4; });
    if (!dup) d.combined.push(v);
    if (d.combined.length === 5) break;
  }
  return d;
}

// ---------- rendering ----------
const ICON = { youtube: "#i-yt", instagram: "#i-ig" };
const counted = new WeakSet();
const countObserver = "IntersectionObserver" in window && new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { countObserver.unobserve(e.target); animateCount(e.target, 0); } });
}, { rootMargin: "0px 0px -12% 0px" });

function animateCount(el, from) {
  const to = Number(el.dataset.to); const suffix = el.dataset.suffix || "";
  counted.add(el);
  if (reduce || !isFinite(to)) { el.textContent = full(to) + suffix; return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: from ? 1 : 1.6, ease: "expo.out", onUpdate: () => (el.textContent = full(o.v) + suffix) });
}

function setStats(d, first) {
  document.querySelectorAll("[data-stat]").forEach((el) => {
    const v = get(d, el.dataset.stat);
    if (v == null) return;
    if (el.classList.contains("count")) {
      const prev = Number(el.dataset.to);
      el.dataset.to = v;
      if (counted.has(el)) { if (prev !== v) animateCount(el, prev || 0); }
      else if (first && countObserver && !reduce) { el.textContent = "0" + (el.dataset.suffix || ""); countObserver.observe(el); }
      else if (!countObserver || reduce) el.textContent = full(v) + (el.dataset.suffix || "");
    } else {
      el.textContent = (FORMAT[el.dataset.format] || full)(v);
    }
  });
  document.querySelectorAll("[data-hide-empty]").forEach((el) => { el.hidden = get(d, el.dataset.hideEmpty) == null; });
}

function setRing(d) {
  const ring = document.querySelector("[data-ring]");
  if (!ring || !d.combined.length) return;
  const sig = d.combined.map((v) => v.id + v.views).join();
  if (ring.dataset.sig === sig) return;
  ring.dataset.sig = sig;
  ring.innerHTML = d.combined.map((v, i) => `<li class="card"><a href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.thumb)}" alt="" width="360" height="640" loading="lazy" /><span class="card__rank">#${i + 1}</span><span class="card__meta"><svg aria-hidden="true"><use href="${ICON[v.platform]}"/></svg>${compact(v.views)} views</span><span class="card__title">${esc(cleanTitle(v.title))}</span></a></li>`).join("");
  document.dispatchEvent(new CustomEvent("ring:changed"));
}

function setRails(d) {
  for (const p of ["youtube", "instagram"]) {
    const list = document.querySelector(`[data-rail="${p}"] .rail__list`);
    const top = d[p].top.filter((v) => v.views != null);
    if (!list || !top.length) continue;
    const sig = top.map((v) => v.id + v.views).join();
    if (list.dataset.sig === sig) continue;
    list.dataset.sig = sig;
    list.innerHTML = top.map((v, i) => `<li><a class="rail__item" href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.thumb)}" alt="" width="360" height="640" loading="lazy" /><span class="rail__rank">${i + 1}</span><span class="rail__views">${compact(v.views)}</span><span class="rail__title">${esc(cleanTitle(v.title))}</span></a></li>`).join("");
  }
}

function setTops(d) {
  document.querySelectorAll("[data-top]").forEach((a) => {
    const v = d[a.dataset.top].top[0];
    if (!v) return;
    a.href = v.url;
    const img = a.querySelector("img");
    // snapshot keeps its hand-picked full-size frame; live data brings the platform's own thumbnail
    if (img && /^https?:/.test(v.thumb) && img.getAttribute("src") !== v.thumb) img.src = v.thumb;
    a.querySelector(".top__title").textContent = cleanTitle(v.title);
    a.querySelector(".top__meta").textContent = `${full(v.views)} views · ${full(v.likes)} likes`;
  });
}

function setStamp(d) {
  const el = document.querySelector("[data-stamp]");
  if (!el) return;
  const when = new Date(d.updatedAt);
  if (d.source === "live") {
    const mins = Math.max(0, Math.round((Date.now() - when) / 60000));
    const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    el.textContent = `Live from YouTube and Instagram · updated ${ago}${d.partial ? " (one platform from snapshot)" : ""}`;
    el.classList.add("is-live");
  } else {
    el.textContent = `Snapshot from ${when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  }
}

function render(d, first = false) {
  d = derive(d);
  setStats(d, first); setRing(d); setRails(d); setTops(d); setStamp(d);
}

// broken remote thumbnails (expired Instagram CDN links) fall back to the avatar
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t.tagName === "IMG" && !t.dataset.fallback && /rail__item|card|top/.test(t.parentElement?.className || "")) { t.dataset.fallback = 1; t.src = "./media/avatar.jpg"; }
}, true);

// ---------- boot ----------
(async () => {
  const fetchJSON = (u, ms) => Promise.race([fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))), new Promise((_, rej) => setTimeout(() => rej("timeout"), ms))]);
  let snap;
  try { snap = await fetchJSON("./data/stats.json", 5000); } catch { return; } // HTML already shows the snapshot

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch {}
  render(merge(snap, cached), true);

  try {
    const live = await fetchJSON("./api/stats", 9000);
    if (live && (live.youtube || live.instagram)) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(live)); } catch {}
      render(merge(snap, live));
    }
  } catch { /* no keys yet or API down: snapshot (or last cached live data) stays on screen */ }
})();
