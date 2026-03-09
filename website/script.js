/* RED — Landing Page Script */
'use strict';

// ─────────────────────────────────────────────────
// P2P NODE 3D GLOBE ANIMATION
// ─────────────────────────────────────────────────
(function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container || !window.Globe) return;

  // Generate random data for the P2P mesh network visualization
  const N = 300;
  const gData = [...Array(N).keys()].map(() => ({
    lat: (Math.random() - 0.5) * 160,
    lng: (Math.random() - 0.5) * 360,
    size: Math.random() / 3,
    color: Math.random() > 0.8 ? '#ff2d47' : '#8c0011'
  }));

  const arcsData = [...Array(N / 3).keys()].map(() => {
    const from = gData[Math.floor(Math.random() * N)];
    const to = gData[Math.floor(Math.random() * N)];
    return {
      startLat: from.lat,
      startLng: from.lng,
      endLat: to.lat,
      endLng: to.lng,
      color: Math.random() > 0.5 ? ['#e8001c', '#ff2d47'] : ['rgba(255, 255, 255, 0.1)', 'rgba(232, 0, 28, 0.6)']
    };
  });

  const globe = Globe()
    (container)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .pointsData(gData)
    .pointAltitude('size')
    .pointColor('color')
    .arcsData(arcsData)
    .arcColor('color')
    .arcDashLength(0.4)
    .arcDashGap(4)
    .arcDashInitialGap(() => Math.random() * 5)
    .arcDashAnimateTime(2000)
    .width(800)
    .height(800);

  // Configure Auto-Rotate & Controls
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.8;
  globe.controls().enableZoom = false;

  // Resize handler
  window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
      globe.width(window.innerWidth).height(400);
    } else {
      globe.width(800).height(800);
    }
  });

  // Initial sizing trigger
  if (window.innerWidth < 768) globe.width(window.innerWidth).height(400);

  // Slight initial tilt for a better angle
  globe.pointOfView({ lat: 20, lng: -40, altitude: 2.2 });
})();

// ─────────────────────────────────────────────────
// SCROLL REVEAL
// ─────────────────────────────────────────────────
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

// ─────────────────────────────────────────────────
// ANIMATED COUNTERS
// ─────────────────────────────────────────────────
(function initCounters() {
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const isFloat = el.dataset.float === 'true';
    const duration = 1800;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = (isFloat ? value.toFixed(1) : Math.round(value)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
})();

// ─────────────────────────────────────────────────
// NAV SCROLL EFFECT
// ─────────────────────────────────────────────────
(function initNav() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // Mobile toggle
  const toggle = document.getElementById('nav-toggle');
  const links = document.querySelector('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
      links.style.flexDirection = 'column';
      links.style.position = 'fixed';
      links.style.top = '72px';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = 'rgba(3,3,5,0.97)';
      links.style.padding = '20px 24px';
      links.style.borderBottom = '1px solid rgba(255,255,255,0.07)';
      links.style.backdropFilter = 'blur(20px)';
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (links) links.style.display = 'none';
      }
    });
  });
})();

// ─────────────────────────────────────────────────
// DOWNLOAD BUTTONS
// ─────────────────────────────────────────────────
(function initDownload() {
  // Hook up download cards to actual release links (can be updated when builds are ready)
  const downloadMap = {
    'android': 'red.apk',
    'web': '#',
    'github': 'https://github.com/DarckRovert/RED',
  };

  document.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = downloadMap[btn.dataset.download];
      if (target) window.open(target, '_blank', 'noopener');
    });
  });
})();

// ─────────────────────────────────────────────────
// MESH RADAR ANIMATION (offline section)
// ─────────────────────────────────────────────────
(function initRadar() {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = 240;
  canvas.height = 240;
  const cx = 120, cy = 120;
  let angle = 0;

  const dots = [
    { angle: 0.8, dist: 60, label: 'A' },
    { angle: 2.1, dist: 85, label: 'B' },
    { angle: 3.8, dist: 50, label: 'C' },
    { angle: 5.0, dist: 90, label: 'D' },
  ];

  function drawRadar() {
    requestAnimationFrame(drawRadar);
    ctx.clearRect(0, 0, 240, 240);

    // Rings
    [30, 60, 90, 110].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232, 0, 28, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Cross hairs
    ctx.strokeStyle = 'rgba(232, 0, 28, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 110, cy); ctx.lineTo(cx + 110, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 110); ctx.lineTo(cx, cy + 110); ctx.stroke();

    // Sweep gradient
    const sweep = ctx.createConicalGradient ? null : null;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, 110, 0);
    grad.addColorStop(0, 'rgba(232, 0, 28, 0.7)');
    grad.addColorStop(1, 'rgba(232, 0, 28, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 110, -0.4, 0, false);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Dots (devices)
    dots.forEach(d => {
      const dx = cx + Math.cos(d.angle) * d.dist;
      const dy = cy + Math.sin(d.angle) * d.dist;

      const angleDiff = ((angle - d.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const fade = Math.max(0, 1 - angleDiff / (Math.PI * 0.8));

      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 45, 71, ${0.3 + fade * 0.7})`;
      ctx.fill();
      if (fade > 0.5) {
        ctx.beginPath();
        ctx.arc(dx, dy, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232, 0, 28, ${fade * 0.25})`;
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + fade * 0.5})`;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(d.label, dx + 9, dy + 3);
    });

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e8001c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,0,28,0.2)';
    ctx.fill();

    angle = (angle + 0.02) % (Math.PI * 2);
  }

  drawRadar();
})();

console.log('%c🔴 RED — Red Encriptada Descentralizada', 'color:#e8001c; font-size:16px; font-weight:bold;');
console.log('%cCifrado E2E · P2P · Sin servidores · Sin censura', 'color:#a0a0b8; font-size:12px');
