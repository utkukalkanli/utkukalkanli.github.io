/* ─────────────────────────────────────────────
   PARTICLE CANVAS — Neural Network Background
───────────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const CONFIG = {
    count: 75,
    connectDistance: 140,
    speed: 0.35,
    minRadius: 1,
    maxRadius: 2.5,
  };

  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  class Particle {
    constructor() { this.reset(true); }

    reset(init = false) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : (Math.random() < 0.5 ? -5 : H + 5);
      this.vx = (Math.random() - 0.5) * CONFIG.speed;
      this.vy = (Math.random() - 0.5) * CONFIG.speed;
      this.r  = CONFIG.minRadius + Math.random() * (CONFIG.maxRadius - CONFIG.minRadius);
      this.alpha    = 0.2 + Math.random() * 0.4;
      this.highlight = Math.random() < 0.12;
      this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(t) {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < -10 || this.x > W + 10 || this.y < -10 || this.y > H + 10) {
        this.reset();
      }
      // subtle pulse on highlighted nodes
      if (this.highlight) {
        this.currentAlpha = this.alpha + 0.15 * Math.sin(t * 0.002 + this.pulsePhase);
      } else {
        this.currentAlpha = this.alpha;
      }
    }

    draw() {
      const a = Math.max(0, Math.min(1, this.currentAlpha));
      if (this.highlight) {
        // Glow halo
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${a * 0.12})`;
        ctx.fill();
        // Core dot
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${a})`;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 58, 237, ${a * 0.7})`;
        ctx.fill();
      }
    }
  }

  const particles = Array.from({ length: CONFIG.count }, () => new Particle());

  function drawEdges() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.connectDistance) {
          const strength = 1 - dist / CONFIG.connectDistance;
          const bothHighlight = particles[i].highlight && particles[j].highlight;
          const color = bothHighlight
            ? `rgba(0, 212, 255, ${strength * 0.5})`
            : `rgba(124, 58, 237, ${strength * 0.18})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = color;
          ctx.lineWidth   = bothHighlight ? 0.8 : 0.4;
          ctx.stroke();
        }
      }
    }
  }

  let raf;
  function animate(t) {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => p.update(t));
    drawEdges();
    particles.forEach(p => p.draw());
    raf = requestAnimationFrame(animate);
  }

  raf = requestAnimationFrame(animate);

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
})();

/* ─────────────────────────────────────────────
   TYPING ANIMATION
───────────────────────────────────────────── */
(function () {
  const el = document.getElementById('typing-text');
  if (!el) return;

  const titles = [
    'Machine Learning Engineer',
    'Computer Vision Specialist',
    'MLOps Enthusiast',
    '3D Vision Researcher',
    'Deep Learning Practitioner',
  ];

  let titleIdx  = 0;
  let charIdx   = 0;
  let deleting  = false;
  let pauseTick = 0;

  function tick() {
    const current = titles[titleIdx];

    if (pauseTick > 0) {
      pauseTick--;
      setTimeout(tick, 60);
      return;
    }

    if (!deleting) {
      el.textContent = current.slice(0, ++charIdx);
      if (charIdx === current.length) {
        deleting  = true;
        pauseTick = 28; // ~1.7s pause
      }
      setTimeout(tick, 90);
    } else {
      el.textContent = current.slice(0, --charIdx);
      if (charIdx === 0) {
        deleting  = false;
        titleIdx  = (titleIdx + 1) % titles.length;
        pauseTick = 6;
      }
      setTimeout(tick, 45);
    }
  }

  // Delay start so it feels intentional
  setTimeout(tick, 800);
})();

/* ─────────────────────────────────────────────
   NAVBAR — scroll behaviour
───────────────────────────────────────────── */
(function () {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // Hamburger toggle
  const toggle = document.getElementById('navToggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  // Close menu on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
})();

/* ─────────────────────────────────────────────
   SCROLL ANIMATIONS — IntersectionObserver
───────────────────────────────────────────── */
(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        // stagger siblings
        const siblings = el.parentElement
          ? Array.from(el.parentElement.children).filter(c => c.classList.contains(el.classList[0]))
          : [];
        const idx = siblings.indexOf(el);
        el.style.transitionDelay = idx > 0 ? `${idx * 0.1}s` : '0s';

        el.classList.add('visible');
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-in, .roadmap-item').forEach(el => {
    observer.observe(el);
  });
})();

/* ─────────────────────────────────────────────
   LANGUAGE BARS — animate on scroll
───────────────────────────────────────────── */
(function () {
  const fills = document.querySelectorAll('.lang-fill');
  if (!fills.length) return;

  // Store target widths and collapse to 0 initially
  const targets = Array.from(fills).map(el => {
    const w = el.style.width;
    el.style.width = '0%';
    return w;
  });

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fills.forEach((el, i) => { el.style.width = targets[i]; });
        obs.disconnect();
      }
    });
  }, { threshold: 0.5 });

  const footer = document.getElementById('contact');
  if (footer) obs.observe(footer);
})();

/* ─────────────────────────────────────────────
   SMOOTH ACTIVE NAV LINK
───────────────────────────────────────────── */
(function () {
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  if (!sections.length || !navLinks.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => a.style.color = '');
        const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if (active) active.style.color = 'var(--cyan)';
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => io.observe(s));
})();
