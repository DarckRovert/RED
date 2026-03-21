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
      if (href && href.startsWith('#')) {
        e.preventDefault();
        
        if (navLinks) navLinks.classList.remove('active');
        if (navToggle) navToggle.textContent = '☰';

        if (href === '#') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const target = $(href);
        if (target) {
          const offset = 80;
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = target.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
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
  initSmoothScroll();
  initCyberMesh();
  initMagneticButtons();
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
/* ─── SMOOTH SCROLL (Lenis & GSAP) ──────────────────────── */
const initSmoothScroll = () => {
  if (typeof Lenis === 'undefined') return;
  const lenis = new Lenis({
    smoothWheel: true,
    lerp: 0.1,
    wheelMultiplier: 1.1,
  });
  
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    
    // Sync ScrollTrigger with Lenis
    lenis.on('scroll', ScrollTrigger.update);
    
    gsap.ticker.add((time) => { lenis.raf(time * 1000) });
    gsap.ticker.lagSmoothing(0);
    
    // Parallax
    if($('.hero__glow')) gsap.to('.hero__glow', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if($('.hero-peru-badge')) gsap.to('.hero-peru-badge', { yPercent: -50, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if($('.neon-inca-pattern')) gsap.to('.neon-inca-pattern', { yPercent: 20, ease: 'none', scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: true } });
  } else {
    // Basic RAF fallback if GSAP fails
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
};

/* ─── MAGNETIC BUTTONS ──────────────────────────────────── */
const initMagneticButtons = () => {
  if (typeof gsap === 'undefined') return;
  const magnets = $$('.btn-primary, .btn-secondary, .nav__cta');
  
  magnets.forEach(btn => {
    const xTo = gsap.quickTo(btn, "x", {duration: 0.4, ease: "power3"}),
          yTo = gsap.quickTo(btn, "y", {duration: 0.4, ease: "power3"});
          
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left) - rect.width/2;
      const y = (e.clientY - rect.top) - rect.height/2;
      xTo(x * 0.35); // Magnetic pull factor
      yTo(y * 0.35);
    });
    btn.addEventListener('mouseleave', () => {
      xTo(0); yTo(0);
    });
  });
};

/* ─── CYBER-MESH (Organic Particle Fluid) ───────────────── */
const initCyberMesh = () => {
  const canvas = $('#bg-mesh-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  let particles = [];
  const count = window.innerWidth > 768 ? 200 : 80;
  
  const mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
  let lastMouse = { x: -1000, y: -1000 };

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    lastMouse.x = mouse.x; lastMouse.y = mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.vx = mouse.x - lastMouse.x;
    mouse.vy = mouse.y - lastMouse.y;
  });

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
      baseSize: Math.random() * 2 + 1,
      angle: Math.random() * Math.PI * 2
    });
  }

  const animate = () => {
    ctx.fillStyle = '#020205'; // bg-deep void color
    ctx.fillRect(0, 0, w, h);
    
    // Decay mouse velocity
    mouse.vx *= 0.9; mouse.vy *= 0.9;

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.angle += 0.01;
      
      // Wrap around
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      
      // Interaction with mouse
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 200) {
        const force = (200 - dist) / 200;
        p.x += mouse.vx * force * 0.04;
        p.y += mouse.vy * force * 0.04;
        
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(232, 0, 28, ${force * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      
      // Draw particle
      ctx.fillStyle = dist < 200 ? `rgba(232, 0, 28, ${0.4 + (200-dist)/200})` : 'rgba(232, 0, 28, 0.2)';
      const size = p.baseSize + Math.sin(p.angle) * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Connect particles nearby
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = dx*dx + dy*dy;
        if (dist < 8000) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(232, 0, 28, ${0.1 * (1 - dist/8000)})`;
          ctx.stroke();
        }
      }
    }
    
    requestAnimationFrame(animate);
  };
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
