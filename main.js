/**
 * CorePower Ultra — Scrollytelling Engine  v3.0
 * main.js
 *
 * What changed in v3:
 *  - 192 frames (all GIF frames, not sampled)
 *  - Transparent PNG frames + alpha canvas + mix-blend-mode:screen for floating product
 *  - 1400vh scroll height = very deliberate, cinematic scroll pace
 *  - LINEAR frame mapping: scrollProgress * (TOTAL_FRAMES-1) = frameIndex
 *  - Momentum/easing: current frame interpolates toward target at 0.12 lerp
 *  - Copy layers appear at specific progress points
 */

'use strict';

/* ══════════════════════════════════════════════
   CONFIGURATION
   ══════════════════════════════════════════════ */

const TOTAL_FRAMES = 192;
const FRAMES_DIR   = 'frames-transparent/';
const FRAME_PREFIX = 'frame_';
const FRAME_EXT    = '.png';

// Copy layers appear at these scroll progress points [0..1]
// The scroll stage is 1400vh; progress goes 0 → 1 across all of it.
const PHASES = {
  hero:         { start: 0.00, end: 0.13 },
  engineering:  { start: 0.13, end: 0.37 },
  distribution: { start: 0.37, end: 0.61 },
  fastcharge:   { start: 0.61, end: 0.82 },
  cta:          { start: 0.82, end: 1.00 },
};

// How many scroll-vh of fade-in/out on each side of a copy layer (as fraction)
const COPY_FADE = 0.035;

/* ══════════════════════════════════════════════
   GLOBALS
   ══════════════════════════════════════════════ */

let frames         = [];   // preloaded Image objects [0..TOTAL_FRAMES-1]
let allLoaded      = false;

let canvas, ctx;
let canvasW = 0, canvasH = 0;

// Current rendered frame (float, for smooth interpolation)
let displayFrame   = 0;   // what's actually on screen
let targetFrame    = 0;   // what scroll says we should show

let scrollStage, nav;
let loadingScreen, loadingBar, loadingText;
let progressBar;
let rafId = null;

let lastProgress   = -1;

/* ══════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lerp  = (a, b, t)   => a + (b - a) * t;

function pad4(n) { return String(n).padStart(4, '0'); }

function mapRange(v, a, b, c, d) {
  if (b === a) return c;
  return c + ((v - a) / (b - a)) * (d - c);
}

/* ══════════════════════════════════════════════
   LOADING SCREEN
   ══════════════════════════════════════════════ */

function buildLoadingScreen() {
  loadingScreen = document.createElement('div');
  loadingScreen.id = 'loading-screen';
  loadingScreen.innerHTML =
    '<p class="loading-logo">CorePower Ultra</p>' +
    '<div class="loading-bar-wrap"><div class="loading-bar" id="lb"></div></div>' +
    '<p class="loading-text" id="lt">Loading frames — 0%</p>';
  document.body.prepend(loadingScreen);
  loadingBar  = document.getElementById('lb');
  loadingText = document.getElementById('lt');
}

function setLoadPct(pct) {
  if (loadingBar)  loadingBar.style.width = pct + '%';
  if (loadingText) loadingText.textContent = 'Loading frames — ' + Math.round(pct) + '%';
}

function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add('loaded');
  setTimeout(function() { loadingScreen && loadingScreen.remove(); }, 900);
}

/* ══════════════════════════════════════════════
   FRAME PRELOADER
   ══════════════════════════════════════════════ */

function loadFrames() {
  return new Promise(function(resolve) {
    let done = 0;
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      (function(idx, image) {
        image.onload = image.onerror = function() {
          done++;
          setLoadPct((done / TOTAL_FRAMES) * 100);
          if (done === TOTAL_FRAMES) { allLoaded = true; resolve(); }
        };
        image.src = FRAMES_DIR + FRAME_PREFIX + pad4(idx) + FRAME_EXT;
        frames[idx] = image;
      })(i, img);
    }
  });
}

/* ══════════════════════════════════════════════
   CANVAS SETUP
   ══════════════════════════════════════════════ */

function setupCanvas() {
  canvas = document.getElementById('hero-canvas');

  // alpha: true is REQUIRED for mix-blend-mode: screen transparency
  ctx = canvas.getContext('2d', { alpha: true });

  sizeCanvas();
  window.addEventListener('resize', function() {
    sizeCanvas();
    displayFrame = -1; // force redraw
  }, { passive: true });
}

function sizeCanvas() {
  const dpr    = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  const w      = parent ? parent.clientWidth  : window.innerWidth;
  const h      = parent ? parent.clientHeight : window.innerHeight;
  const pw     = Math.round(w * dpr);
  const ph     = Math.round(h * dpr);

  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width  = pw;
    canvas.height = ph;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasW = w;
    canvasH = h;
    displayFrame = -1; // force redraw after resize
  }
}

/* ══════════════════════════════════════════════
   FRAME RENDERER
   Uses integer frame index, skips if same frame
   ══════════════════════════════════════════════ */

let lastDrawnIdx = -1;

function renderFrame(frameFloat) {
  if (canvasW === 0 || canvasH === 0) { sizeCanvas(); if (canvasW === 0) return; }

  const idx = clamp(Math.round(frameFloat), 0, TOTAL_FRAMES - 1);

  if (!allLoaded) {
    // Black placeholder
    ctx.clearRect(0, 0, canvasW, canvasH);
    return;
  }

  if (idx === lastDrawnIdx) return;
  lastDrawnIdx = idx;

  const img = frames[idx];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  // Clear to transparent (frames are PNG with transparency)
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Object-contain with mobile portrait boost
  let scale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  if (canvasW < 768 && canvasW < canvasH) {
    // Boost scale on portrait phone screens so the 3D product fills the display
    scale = scale * 1.38;
  }

  const dw    = img.naturalWidth  * scale;
  const dh    = img.naturalHeight * scale;
  const dx    = (canvasW - dw) / 2;
  const dy    = (canvasH - dh) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ══════════════════════════════════════════════
   SCROLL PROGRESS
   ══════════════════════════════════════════════ */

function getScrollProgress() {
  if (!scrollStage) return 0;

  // Walk offsetParent chain to get absolute top of scroll stage
  let stageTop = 0;
  let el = scrollStage;
  while (el && el !== document.body) {
    stageTop += el.offsetTop;
    el = el.offsetParent;
  }

  const stageH  = scrollStage.scrollHeight - window.innerHeight;
  if (stageH <= 0) return 0;

  return clamp((window.scrollY - stageTop) / stageH, 0, 1);
}

/* ══════════════════════════════════════════════
   FRAME FROM PROGRESS — LINEAR
   Scroll 0→1 maps linearly to frame 0→191
   ══════════════════════════════════════════════ */

function progressToFrame(p) {
  return p * (TOTAL_FRAMES - 1);
}

/* ══════════════════════════════════════════════
   COPY LAYER TRANSITIONS
   ══════════════════════════════════════════════ */

function layerOpacity(p, start, end) {
  const band = COPY_FADE;
  if (p < start - band || p > end + band) return 0;
  if (p < start + band) return mapRange(p, start - band, start + band, 0, 1);
  if (p > end   - band) return mapRange(p, end   - band, end   + band, 1, 0);
  return 1;
}

function updateCopyLayers(p) {
  // Hero: fades in and holds to 13%
  const heroOp = layerOpacity(p, PHASES.hero.start, PHASES.hero.end);
  setLayer('copy-hero', heroOp, 0, 0);

  // Engineering: slides from left (15–37%)
  const engOp = layerOpacity(p, PHASES.engineering.start, PHASES.engineering.end);
  const engTx = engOp < 1 ? (1 - Math.min(engOp * 3, 1)) * -60 : 0;
  setLayer('copy-engineering', engOp, engTx, 0);

  // Distribution: slides from right (37–61%)
  const distOp = layerOpacity(p, PHASES.distribution.start, PHASES.distribution.end);
  const distTx = distOp < 1 ? (1 - Math.min(distOp * 3, 1)) * 60 : 0;
  setLayer('copy-distribution', distOp, distTx, 0);

  // Fast charge: slides from below (61–82%)
  const fcOp = layerOpacity(p, PHASES.fastcharge.start, PHASES.fastcharge.end);
  const fcTy = fcOp < 1 ? (1 - Math.min(fcOp * 3, 1)) * 50 : 0;
  setLayer('copy-fastcharge', fcOp, 0, fcTy);

  // CTA: slides from below (82–100%)
  const ctaOp = layerOpacity(p, PHASES.cta.start, PHASES.cta.end);
  const ctaTy = ctaOp < 1 ? (1 - Math.min(ctaOp * 3, 1)) * 50 : 0;
  setLayer('copy-cta', ctaOp, 0, ctaTy);
}

function setLayer(id, opacity, tx, ty) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = opacity;
  const child = el.firstElementChild;
  if (child) {
    child.style.transform = (tx !== 0 || ty !== 0)
      ? `translate(${tx}px,${ty}px)`
      : '';
  }
}

/* ══════════════════════════════════════════════
   NAV UPDATE
   ══════════════════════════════════════════════ */

let navOn = false;
function updateNav(p) {
  if (!nav) return;
  if (p > 0.008 && !navOn) {
    navOn = true;
    nav.classList.add('nav-visible', 'nav-scrolled');
  } else if (p <= 0.008 && navOn) {
    navOn = false;
    nav.classList.remove('nav-scrolled');
  }
}

function updateProgressBar(p) {
  if (progressBar) progressBar.style.width = (p * 100) + '%';
}

/* ══════════════════════════════════════════════
   MAIN rAF LOOP
   Uses lerp to smoothly interpolate displayFrame
   toward targetFrame — gives a buttery "settling" feel
   ══════════════════════════════════════════════ */

const LERP_SPEED = 0.14; // 0=never moves, 1=instant snap

function tick() {
  const p = getScrollProgress();

  if (Math.abs(p - lastProgress) > 0.000025) {
    lastProgress = p;
    targetFrame  = progressToFrame(p);
    updateCopyLayers(p);
    updateNav(p);
    updateProgressBar(p);
    updatePhaseDots(p);
  }

  // Smooth frame interpolation
  if (allLoaded) {
    const diff = targetFrame - displayFrame;
    if (Math.abs(diff) > 0.15) {
      displayFrame = lerp(displayFrame, targetFrame, LERP_SPEED);
      renderFrame(displayFrame);
    } else if (Math.abs(diff) > 0.01) {
      displayFrame = targetFrame;
      renderFrame(displayFrame);
    }
  }

  rafId = requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════
   MOBILE MENU
   ══════════════════════════════════════════════ */

function setupMobileMenu() {
  const btn  = document.getElementById('nav-hamburger');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  let open = false;
  btn.addEventListener('click', function() {
    open = !open;
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  menu.querySelectorAll('.mobile-link').forEach(function(link) {
    link.addEventListener('click', function() {
      open = false;
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ══════════════════════════════════════════════
   ENTRANCE ANIMATIONS
   ══════════════════════════════════════════════ */

function setupEntranceAnims() {
  const io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.spec-card, #buy-heading, #buy-sub, #buy-card').forEach(function(el) {
    el.classList.add('anim-enter');
    io.observe(el);
  });

  const grid = document.getElementById('specs-grid');
  if (grid) {
    grid.classList.add('anim-stagger');
    io.observe(grid);
  }
}

/* ══════════════════════════════════════════════
   AMBIENT PARTICLES
   ══════════════════════════════════════════════ */

function spawnParticles() {
  const wrap = document.getElementById('canvas-sticky-wrap');
  if (!wrap) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = [
      `left:${Math.random()*100}%`,
      `top:${25+Math.random()*55}%`,
      `--tx:${(Math.random()-0.5)*150}px`,
      `--ty:${-(40+Math.random()*110)}px`,
      `--dur:${6+Math.random()*9}s`,
      `--delay:${Math.random()*14}s`
    ].join(';');
    wrap.appendChild(p);
  }
}

/* ══════════════════════════════════════════════
   CURSOR GLOW
   ══════════════════════════════════════════════ */

function setupCursorGlow() {
  if (window.matchMedia('(hover:none)').matches) return;
  const g = document.createElement('div');
  g.style.cssText = 'position:fixed;pointer-events:none;z-index:9998;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(0,80,255,0.06) 0%,transparent 65%);transform:translate(-50%,-50%);';
  document.body.appendChild(g);
  window.addEventListener('mousemove', function(e) {
    g.style.left = e.clientX + 'px';
    g.style.top  = e.clientY + 'px';
  });
}

/* ══════════════════════════════════════════════
   SMOOTH ANCHOR SCROLL
   ══════════════════════════════════════════════ */

function setupAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ══════════════════════════════════════════════
   SCROLL INDICATOR DOTS
   Shows which phase you're in, like Apple's AirPods page
   ══════════════════════════════════════════════ */

function buildPhaseDots() {
  const wrap = document.createElement('div');
  wrap.id = 'phase-dots';
  wrap.style.cssText = [
    'position:fixed',
    'right:24px',
    'top:50%',
    'transform:translateY(-50%)',
    'z-index:100',
    'display:flex',
    'flex-direction:column',
    'gap:10px',
    'opacity:0',
    'transition:opacity 0.4s'
  ].join(';');

  const phaseNames = ['Hero', 'Engineering', 'Distribution', 'Charging', 'Experience'];
  const dotIds = ['dot-hero','dot-eng','dot-dist','dot-fc','dot-cta'];

  phaseNames.forEach(function(name, i) {
    const dot = document.createElement('div');
    dot.id = dotIds[i];
    dot.title = name;
    dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.25);transition:background 0.3s,transform 0.3s;cursor:pointer;';
    dot.addEventListener('mouseenter', function() { dot.title = name; });
    wrap.appendChild(dot);
  });

  document.body.appendChild(wrap);

  // Show dots after first scroll
  setTimeout(function() { wrap.style.opacity = '1'; }, 1500);

  return { wrap, dotIds };
}

let phaseDots = null;
const DOT_IDS = ['dot-hero','dot-eng','dot-dist','dot-fc','dot-cta'];
const PHASE_KEYS = ['hero','engineering','distribution','fastcharge','cta'];

function updatePhaseDots(p) {
  DOT_IDS.forEach(function(id, i) {
    const el = document.getElementById(id);
    if (!el) return;
    const ph = PHASES[PHASE_KEYS[i]];
    const active = p >= ph.start - 0.01 && p <= ph.end + 0.01;
    el.style.background = active ? '#00D6FF' : 'rgba(255,255,255,0.2)';
    el.style.transform  = active ? 'scale(1.8)' : 'scale(1)';
  });
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */

async function init() {
  buildLoadingScreen();

  // Progress bar
  const pb = document.createElement('div');
  pb.id = 'scroll-progress';
  document.body.prepend(pb);
  progressBar = pb;

  nav         = document.getElementById('main-nav');
  scrollStage = document.getElementById('scroll-stage');

  setupCanvas();

  // Start rAF immediately (draws transparent canvas while loading)
  rafId = requestAnimationFrame(tick);

  // Show nav after brief delay
  setTimeout(function() { if (nav) nav.classList.add('nav-visible'); }, 500);

  // Load all 192 transparent frames
  await loadFrames();

  // Force immediate render now frames are ready
  displayFrame = -1;
  lastProgress = -1;
  renderFrame(0);

  setupMobileMenu();
  setupAnchors();
  setupEntranceAnims();
  spawnParticles();
  setupCursorGlow();
  buildPhaseDots();

  // Wire phase-dot update into the rAF tick
  const origUpdateCopy = updateCopyLayers;

  hideLoadingScreen();

  console.log('[CorePower v3] Ready — 192 frames, 1400vh scroll, transparent canvas');
  console.log('[CorePower v3] ScrollStage height:', scrollStage ? scrollStage.scrollHeight : 'null');
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
