// main.js v2 — smooth scroll; the whole page drives one 3D camera; story ring; counters; tilt.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = matchMedia("(max-width: 760px)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const saveData = navigator.connection?.saveData;
const hasWebGL = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

let lenis;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href"); if (id.length < 2) return;
    const el = document.querySelector(id); if (!el) return;
    e.preventDefault(); lenis.scrollTo(el.closest(".pin-spacer") || el, { offset: 0, duration: 1.4 });
  }));
}

// ---------- videos: play only near the viewport ----------
const vids = { yt: document.getElementById("v-yt"), ig: document.getElementById("v-ig") };
Object.values(vids).forEach((v) => {
  if (!v) return;
  if (reduce) return; // posters only
  new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { rootMargin: "60% 0px" }).observe(v);
});

// ---------- stations: every section is a camera position in the town ----------
const stages = [...document.querySelectorAll("[data-station]")];
const VEIL = [0.38, 0.62, 0.42, 0.42, 0.8, 0.62, 0.5];
const navLinks = [...document.querySelectorAll(".nav nav a")];
let anchors = [];
function measure() {
  anchors = stages.map((s) => {
    const el = s.closest(".pin-spacer") || s;
    const r = el.getBoundingClientRect(); const top = r.top + scrollY;
    return top + r.height / 2 - innerHeight / 2; // scrollY at which the section sits centred
  });
}
function stationAt(y) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  }
  return anchors.length - 1;
}
let town = null;
const veil = document.querySelector(".veil");
function onScroll() {
  const f = stationAt(scrollY);
  town?.setStation(f);
  const i = Math.min(VEIL.length - 2, Math.floor(f)), t = f - i;
  veil.style.setProperty("--veil", (VEIL[i] + (VEIL[i + 1] - VEIL[i]) * t).toFixed(3));
  const near = Math.round(f);
  const id = stages[near]?.id;
  navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
}
ScrollTrigger.addEventListener("refresh", () => { measure(); onScroll(); });
addEventListener("scroll", onScroll, { passive: true });

const whenIdle = (fn) => {
  const go = () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 900 }) : setTimeout(fn, 200));
  document.readyState === "complete" ? go() : addEventListener("load", go, { once: true });
};
if (hasWebGL && !saveData) whenIdle(() => import("./town.js").then(({ initTown }) => {
  town = initTown(document.getElementById("town"), {
    small, reduce, videos: vids,
    posters: { yt: "./media/yt-poster.jpg", ig: "./media/ig-poster.jpg" },
  });
  measure(); onScroll();
}));

// ---------- hero entrance (the h1 is LCP: it moves, never fades from 0) ----------
if (!reduce) {
  gsap.from(".hero .display", { y: 36, duration: 1.2, ease: "expo.out", delay: 0.15 });
  // text never starts invisible (the lede is the LCP element on phones); only the buttons fade
  gsap.from(".hero .kicker, .hero .lede", { y: 22, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.3 });
  gsap.from(".hero .actions", { y: 22, opacity: 0, duration: 1, ease: "expo.out", delay: 0.45 });
}

// ---------- story ring: scroll turns it, the card facing you lights up ----------
const ring = document.querySelector(".ring");
let cards = [], STEP = 72, lastSpin = 0;
function collectCards() {
  cards = [...document.querySelectorAll(".ring .card")];
  STEP = 360 / Math.max(cards.length, 3);
  ring?.style.setProperty("--step", `${STEP}deg`);
  cards.forEach((c, i) => c.style.setProperty("--i", i));
  lightCards(lastSpin);
}
function lightCards(spin) {
  lastSpin = spin;
  cards.forEach((c, i) => {
    let a = ((i * STEP + spin) % 360 + 540) % 360 - 180; // -180..180, 0 = facing the viewer
    const face = Math.cos((a * Math.PI) / 180);
    c.style.setProperty("--lit", (0.3 + 0.7 * Math.max(0, face) ** 1.5).toFixed(3));
    c.style.opacity = (0.08 + 0.92 * Math.max(0, face) ** 2).toFixed(3);
    c.style.zIndex = Math.round(face * 10 + 10);
    c.querySelector("a").tabIndex = face > 0.5 ? 0 : -1;
  });
}
collectCards();
document.addEventListener("ring:changed", collectCards); // live.js re-ranked the stories
if (!reduce && ring) {
  const state = { spin: 0 };
  gsap.to(state, {
    spin: () => -(cards.length - 1) * STEP, ease: "none",
    scrollTrigger: { trigger: ".stories__pin", start: "top top", end: small ? "+=160%" : "+=200%", pin: true, scrub: 0.8 },
    onUpdate: () => { ring.style.setProperty("--spin", `${state.spin}deg`); lightCards(state.spin); },
  });
}

// ---------- devices tilt toward the pointer ----------
if (finePointer && !reduce) {
  document.querySelectorAll(".device").forEach((d) => {
    const base = d.classList.contains("device--ig") ? 10 : -10;
    d.addEventListener("pointermove", (e) => {
      const r = d.getBoundingClientRect();
      d.style.setProperty("--ry", `${base + ((e.clientX - r.left) / r.width - 0.5) * 16}deg`);
      d.style.setProperty("--rx", `${4 - ((e.clientY - r.top) / r.height - 0.5) * 12}deg`);
    });
    d.addEventListener("pointerleave", () => { d.style.setProperty("--ry", `${base}deg`); d.style.setProperty("--rx", "4deg"); });
  });
  // magnetic pills and platform cards
  document.querySelectorAll(".pill, .platform-card").forEach((el) => {
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "expo.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "expo.out" });
    const k = el.classList.contains("platform-card") ? 0.08 : 0.25;
    el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * k); y((e.clientY - r.top - r.height / 2) * k); });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  });
}

// counters: handled by live.js (they re-animate when live numbers arrive)

// ---------- 3D entrances for the lower sections (one style, once) ----------
if (!reduce) {
  gsap.utils.toArray(".split__copy, .device, .board, .results__head, .made h2, .closer__title, .platform-card").forEach((el) => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
  });
  gsap.from(".steps li", { rotateX: 55, y: 60, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".steps", start: "top 80%", once: true } });
}

measure(); onScroll();

addEventListener("load", () => {
  ScrollTrigger.refresh();
  const target = location.hash && document.querySelector(location.hash);
  if (target) lenis ? lenis.scrollTo(target.closest(".pin-spacer") || target, { immediate: true }) : target.scrollIntoView();
  else { lenis ? lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0); }
});
