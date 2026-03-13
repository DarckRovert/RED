/* ━━━ RED — Masterpiece Edition Script v7.0 — PERÚ EDITION ━━━ */
'use strict';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

// Constants
const LIMA = { lat: -12.0464, lng: -77.0428 };
const WORLD_CITIES = [
  { name:'Buenos Aires', lat:-34.6037, lng:-58.3816 },
  { name:'São Paulo',    lat:-23.5505, lng:-46.6333 },
  { name:'Bogotá',       lat:4.7110,   lng:-74.0721 },
  { name:'Mexico City',  lat:19.4326,  lng:-99.1332 },
  { name:'Miami',        lat:25.7617,  lng:-80.1918 },
  { name:'New York',     lat:40.7128,  lng:-74.0060 },
  { name:'London',       lat:51.5074,  lng:-0.1278  },
  { name:'Madrid',       lat:40.4168,  lng:-3.7038  },
  { name:'Paris',        lat:48.8566,  lng:2.3522   },
  { name:'Tokyo',        lat:35.6762,  lng:139.6503 },
  { name:'Sydney',       lat:-33.8688, lng:151.2093 }
];
const PERU_RED = '#dc1818';
const PERU_WHITE = '#ffffff';

/* ─── NAVIGATION & SCROLL ───────────────────────────── */
const initNavigation = () => {
  const navToggle = $('#nav-toggle');
  const navLinks = $('#nav-links');
  const navLinksItems = document.querySelectorAll('a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  // Mobile Toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      navToggle.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
    });
  }

  // Smooth Scroll & Auto-close
  navLinksItems.forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = $(href);
        if (target) {
          if (navLinks) navLinks.classList.remove('active');
          if (navToggle) navToggle.textContent = '☰';
          
          window.scrollTo({
            top: target.offsetTop - 80,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // ScrollSpy
  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    document.querySelectorAll('.nav__links a').forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === `#${current}`) {
        a.classList.add('active');
      }
    });
  });
};

/* ─── INITIALIZATION ────────────────────────────────────── */
// Fire everything
const init = () => {
  initCyberMesh();
  initPreloader();
  initCustomCursor();
  initObservers();
  initChakanaParticles();
  initGeoParticles();
  initRadar();
  initNavigation();
  loadThreeAndGlobe();
};

document.addEventListener('DOMContentLoaded', init);

/* ─── SCROLL & NAV ───────────────────────────────────────── */
const initScrollEffects = () => {
  const nav = $('.nav');
  const progress = $('#scroll-progress');

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav && nav.classList.toggle('scrolled', y > 48);
    
    if (progress) {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (y / total) * 100 + '%';
    }
  }, { passive: true });
};

/* ─── MASTER OBSERVER SYSTEM ────────────────────────────── */
const initObservers = () => {
  const options = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target.classList.contains('reveal-text')) {
          entry.target.classList.add('active');
        } else {
          entry.target.classList.add('visible');
        }
        
        // Counter logic integrated
        if (entry.target.dataset.target && !entry.target.dataset.done) {
          entry.target.dataset.done = '1';
          animateCounter(entry.target);
        }
        
        revealObserver.unobserve(entry.target);
      }
    });
  }, options);

  $$('.reveal, .reveal-text, [data-target]').forEach(el => revealObserver.observe(el));
};

/* ─── COUNTER ANIMATION ─────────────────────────────────── */
const animateCounter = (el) => {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  if (isNaN(target)) return;
  
  const dur = 2000;
  const start = performance.now();
  const ease = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // Expo ease out

  const run = (now) => {
    const p = clamp((now - start) / dur, 0, 1);
    el.textContent = (target === 0 ? '0' : Math.round(ease(p) * target)) + suffix;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};

/* ─── CYBER-MESH (Interactive Background) ───────────────── */
const initCyberMesh = () => {
  const canvas = $('#bg-mesh-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w, h, points = [];
  const spacing = 60;
  const mouse = { x: -1000, y: -1000, radius: 280 };

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    points = [];
    for (let x = -spacing; x < w + spacing; x += spacing) {
      for (let y = -spacing; y < h + spacing; y += spacing) {
        points.push({ x, y, ox: x, oy: y });
      }
    }
  };

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const animate = () => {
    ctx.clearRect(0, 0, w, h);
    
    points.forEach(p => {
      const dx = mouse.x - p.ox;
      const dy = mouse.y - p.oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < mouse.radius) {
        const f = (mouse.radius - dist) / mouse.radius;
        p.x = p.ox - dx * f * 0.6;
        p.y = p.oy - dy * f * 0.6;
        
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(232, 0, 28, ${f * 0.15})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        ctx.fillStyle = `rgba(232, 0, 28, ${f * 0.8})`;
      } else {
        p.x += (p.ox - p.x) * 0.1;
        p.y += (p.oy - p.y) * 0.1;
        ctx.fillStyle = 'rgba(232, 0, 28, 0.12)';
      }
      
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    });
    requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resize);
  resize();
  animate();
};

/* ─── GLOBE LOGIC ────────────────────────────────────────── */
const loadThreeAndGlobe = () => {
  if (window.Globe) return initGlobe();

  const loadScript = (src) => new Promise((res) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    document.head.appendChild(s);
  });

  // Load Three.js first, THEN load Globe.gl to prevent race condition missing arcs
  loadScript('https://unpkg.com/three@0.150.1/build/three.min.js')
    .then(() => loadScript('https://unpkg.com/globe.gl@2.29.0/dist/globe.gl.min.js'))
    .then(initGlobe);
};

const initGlobe = () => {
  const container = $('#globe-container');
  if (!container || !window.Globe) return;

  const size = window.innerWidth > 1100 ? 800 : 500;
  container.style.width = container.style.height = size + 'px';

  const arcs = WORLD_CITIES.map((city, i) => ({
    startLat: LIMA.lat,
    startLng: LIMA.lng,
    endLat: city.lat,
    endLng: city.lng,
    color: i % 2 === 0 ? [PERU_RED, PERU_WHITE] : [PERU_WHITE, PERU_RED]
  }));

  const globe = Globe({ animateIn: true })(container)
    .width(size).height(size)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('rgba(220,24,24,0.35)')
    .atmosphereAltitude(0.2)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
    .arcsData(arcs)
    .arcColor('color')
    .arcDashLength(0.4)
    .arcDashGap(4)
    .arcDashAnimateTime(1500)
    .arcStroke(0.5)
    .arcAltitude(0.25)
    .pointsData([{ lat: LIMA.lat, lng: LIMA.lng, size: 1.8, color: PERU_RED }])
    .pointColor('color').pointAltitude(0.02).pointRadius('size');

  const ctrl = globe.controls();
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 0.5;
  ctrl.enableZoom = false;
  globe.pointOfView({ lat: LIMA.lat, lng: LIMA.lng, altitude: 2.5 }, 0);
};

/* ─── RADAR ──────────────────────────────────────────────── */
const initRadar = () => {
  const canvas = $('#radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 300;
  canvas.width = canvas.height = size;
  const cx = size / 2, cy = size / 2, R = size / 2 - 10;
  
  let scanA = 0;
  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    // Rings
    ctx.strokeStyle = 'rgba(232,0,28,0.1)';
    for(let i=1;i<=3;i++){ ctx.beginPath(); ctx.arc(cx,cy,R*(i/3),0,Math.PI*2); ctx.stroke(); }
    // Sweep
    scanA += 0.02;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,scanA - 0.5, scanA);
    ctx.lineTo(cx,cy);
    ctx.fillStyle = 'rgba(232,0,28,0.15)';
    ctx.fill();
    requestAnimationFrame(draw);
  };
  draw();
};

/* ─── PERUVIAN CURSOR & PARTICLES ───────────────────────── */
const initCustomCursor = () => {
  const cursor = $('#custom-cursor');
  const follower = $('#custom-cursor-follower');
  if (!cursor || !follower) return;

  let mx = 0, my = 0, px = 0, py = 0;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  const tick = () => {
    cursor.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    px += (mx - px) * 0.15;
    py += (my - py) * 0.15;
    follower.style.transform = `translate3d(${px - 20}px, ${py - 20}px, 0)`;
    requestAnimationFrame(tick);
  };
  tick();
};

const initPreloader = () => {
  const p = $('#preloader');
  if (!p) return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      p.classList.add('fade-out');
      setTimeout(() => p.remove(), 800);
    }, 1500);
  });
};

const initChakanaParticles = () => {
  const shapes = ['◆', '✥', '✚'];
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'chakana-particle';
    el.textContent = shapes[i % 3];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = Math.random() * 100 + 'vh';
    el.style.color = Math.random() > 0.5 ? 'var(--peru-red)' : 'var(--text-muted)';
    document.body.appendChild(el);
  }
};

const initGeoParticles = () => {
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'geo-particle';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.setProperty('--d', (Math.random() * 15 + 10) + 's');
    document.body.appendChild(el);
  }
};

// Fire everything
document.addEventListener('DOMContentLoaded', init);
