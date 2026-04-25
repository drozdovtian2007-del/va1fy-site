import * as THREE from 'three';

/* ===== EDIT THIS: paste YouTube video ID for background music (e.g. "dQw4w9WgXcQ") ===== */
const MUSIC_YT_ID = 'rXvbRizNzsk'; // leave empty to use local music.mp3 instead
/* ===================================================================================== */

/* =========================================================
   CURSOR + TRAIL
   ========================================================= */
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');
let mx = innerWidth/2, my = innerHeight/2;
let rx = mx, ry = my;

addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
});

function cursorLoop(){
  rx += (mx - rx) * 0.16;
  ry += (my - ry) * 0.16;
  ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
  requestAnimationFrame(cursorLoop);
}
cursorLoop();

// Trail particles — spawn tiny dots on movement, fade out
let lastSpawnTime = 0;
addEventListener('mousemove', () => {
  const now = performance.now();
  if (now - lastSpawnTime < 22) return;
  lastSpawnTime = now;
  spawnTrail(mx, my);
});

function spawnTrail(x, y){
  const t = document.createElement('div');
  t.className = 'cursor-trail';
  const size = 3 + Math.random() * 5;
  t.style.width = t.style.height = size + 'px';
  t.style.left = x + 'px';
  t.style.top = y + 'px';
  const dx = (Math.random() - .5) * 30;
  const dy = 10 + Math.random() * 20; // drift down like sinking particles
  document.body.appendChild(t);
  const anim = t.animate([
    { transform:`translate(-50%,-50%) translate(0,0) scale(1)`, opacity:.8 },
    { transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.2)`, opacity:0 }
  ], { duration: 900 + Math.random()*400, easing:'cubic-bezier(.2,.8,.2,1)' });
  anim.onfinish = () => t.remove();
}

const hoverables = 'a, button, .clip-card, .product-card, .nav-item, .social-btn, .hero-title span, .product-jar-wrap, .buy-btn, .win-btn, .win-btn-ctrl, .modal-close, .music-btn, .footer a';
document.querySelectorAll(hoverables).forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

/* =========================================================
   SMOOTH SCROLL driver
   ========================================================= */
let targetScroll = scrollY, currentScroll = scrollY;
addEventListener('scroll', () => { targetScroll = scrollY; }, { passive:true });
(function loop(){
  currentScroll += (targetScroll - currentScroll) * 0.08;
  requestAnimationFrame(loop);
})();

/* =========================================================
   THREE.JS — deeper, darker ocean
   ========================================================= */
const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
camera.position.z = 5;

const bgMat = new THREE.ShaderMaterial({
  uniforms:{ uTime:{value:0}, uDepth:{value:0} },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }`,
  fragmentShader:`
    precision highp float;
    varying vec2 vUv;
    uniform float uTime, uDepth;

    // Darker, calmer palette
    vec3 cSurface = vec3(0.18, 0.42, 0.60);
    vec3 cShallow = vec3(0.08, 0.24, 0.42);
    vec3 cMid     = vec3(0.02, 0.10, 0.22);
    vec3 cDeep    = vec3(0.01, 0.04, 0.10);
    vec3 cAbyss   = vec3(0.0,  0.01, 0.03);

    vec3 palette(float t){
      t = clamp(t, 0.0, 1.0);
      if(t < 0.25)      return mix(cSurface, cShallow, t/0.25);
      else if(t < 0.5)  return mix(cShallow, cMid,     (t-0.25)/0.25);
      else if(t < 0.75) return mix(cMid,     cDeep,    (t-0.5)/0.25);
      else              return mix(cDeep,    cAbyss,   (t-0.75)/0.25);
    }

    float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      vec2 u=f*f*(3.-2.*f);
      return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
    }

    void main(){
      float t = clamp(uDepth + (1.0 - vUv.y) * 0.25, 0.0, 1.0);
      vec3 col = palette(t);
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.5;

      // softer caustics, only near surface
      float cStr = smoothstep(0.25, 0.0, uDepth);
      if(cStr > 0.001){
        vec2 cp = vUv * 2.5;
        float c = noise(cp + vec2(uTime*0.1, uTime*0.08));
        c += noise(cp * 2.0 - vec2(uTime*0.15, 0.0)) * 0.5;
        c = pow(c * 0.55, 4.0);
        col += vec3(0.3, 0.5, 0.7) * c * cStr * 0.25;
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  depthWrite:false, depthTest:false,
});
const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), bgMat);
bgMesh.renderOrder = -1;
scene.add(bgMesh);

/* Bubbles */
const particleCount = 400;
const pGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount*3);
const speeds = new Float32Array(particleCount);
const sizes = new Float32Array(particleCount);
for (let i=0;i<particleCount;i++){
  positions[i*3]   = (Math.random()-0.5)*20;
  positions[i*3+1] = (Math.random()-0.5)*30;
  positions[i*3+2] = (Math.random()-0.5)*10 - 2;
  speeds[i] = 0.002 + Math.random()*0.009;
  sizes[i]  = 0.4 + Math.random()*2.2;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
pGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

const pMat = new THREE.ShaderMaterial({
  uniforms:{ uPixelRatio:{value:renderer.getPixelRatio()}, uDepth:{value:0} },
  vertexShader:`
    attribute float aSize; varying float vA;
    uniform float uPixelRatio, uDepth;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position,1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (280.0 / -mv.z);
      vA = mix(0.55, 0.15, uDepth);
    }`,
  fragmentShader:`
    varying float vA;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if(d > 0.5) discard;
      float edge = smoothstep(0.5, 0.35, d);
      float hl = smoothstep(0.4, 0.0, length(c - vec2(-0.15,-0.15))) * 0.5;
      gl_FragColor = vec4(vec3(0.75,0.88,1.0), (edge*0.3 + hl) * vA);
    }`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

const clock = new THREE.Clock();
function animate(){
  const t = clock.getElapsedTime();
  const maxScroll = document.body.scrollHeight - innerHeight;
  const depth = maxScroll > 0 ? Math.min(currentScroll/maxScroll, 1) : 0;
  bgMat.uniforms.uTime.value = t;
  bgMat.uniforms.uDepth.value = depth;
  pMat.uniforms.uDepth.value = depth;

  const pos = pGeo.attributes.position.array;
  for (let i=0;i<particleCount;i++){
    pos[i*3+1] += speeds[i];
    pos[i*3]   += Math.sin(t*0.5 + i) * 0.0014;
    if(pos[i*3+1] > 15){
      pos[i*3+1] = -15;
      pos[i*3]   = (Math.random()-0.5)*20;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  camera.position.y = -depth * 1.5;
  particles.rotation.y = Math.sin(t*0.05) * 0.1;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

/* =========================================================
   DEPTH INDICATOR
   ========================================================= */
const depthValueEl = document.querySelector('.depth-value');
(function updateDepth(){
  const maxScroll = document.body.scrollHeight - innerHeight;
  const d = maxScroll > 0 ? currentScroll/maxScroll : 0;
  depthValueEl.textContent = Math.round(d * 1000) + 'm';
  requestAnimationFrame(updateDepth);
})();

/* =========================================================
   NAV — Telegram-style sliding indicator
   ========================================================= */
const navPill = document.querySelector('.nav-pill');
const navIndicator = document.querySelector('.nav-indicator');
const navItems = [...document.querySelectorAll('.nav-item')];

function moveIndicator(el){
  if(!el) return;
  const prect = navPill.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  navIndicator.style.left  = (r.left - prect.left) + 'px';
  navIndicator.style.width = r.width + 'px';
}

// initial position after fonts load
requestAnimationFrame(() => moveIndicator(document.querySelector('.nav-item.active')));
addEventListener('load', () => moveIndicator(document.querySelector('.nav-item.active')));
addEventListener('resize', () => moveIndicator(document.querySelector('.nav-item.active')));

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const id = item.dataset.target;
    const target = document.getElementById(id);
    if(target){
      const y = target.getBoundingClientRect().top + scrollY - 20;
      scrollTo({ top:y, behavior:'smooth' });
    }
  });
  item.addEventListener('mouseenter', () => moveIndicator(item));
});
navPill.addEventListener('mouseleave', () => {
  moveIndicator(document.querySelector('.nav-item.active'));
});

// Observe sections to update active state
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting && e.intersectionRatio > 0.45){
      navItems.forEach(i => i.classList.remove('active'));
      const match = navItems.find(i => i.dataset.target === e.target.id);
      if(match){
        match.classList.add('active');
        moveIndicator(match);
      }
    }
  });
}, { threshold:[.45, .6] });
document.querySelectorAll('section.section').forEach(s => sectionObserver.observe(s));

/* =========================================================
   PRODUCTS — SVG jars + drag + flee buy + windows error
   ========================================================= */
const PRODUCTS = [
  { name:'Ossetra Classic',      sub:'Чёрная осетровая · 50g',   price:149,  color:{top:'#2a2416', mid:'#4a3a1f', bead:'#1a1208'}, bead:'dark' },
  { name:'Beluga Reserve',       sub:'Белужья премиум · 50g',    price:289,  color:{top:'#36302a', mid:'#5c4f3d', bead:'#1e1812'}, bead:'beluga' },
  { name:'Wild Keta',            sub:'Дикая кета · 100g',        price:39,   color:{top:'#7a1a0a', mid:'#d44a2a', bead:'#9c2814'}, bead:'red' },
  { name:'Nerka Pacific',        sub:'Нерка тихоокеанская · 100g', price:54, color:{top:'#5a0c08', mid:'#c02818', bead:'#8a1408'}, bead:'nerka' },
  { name:'Pink Salmon Select',   sub:'Горбуша отборная · 200g',  price:32,   color:{top:'#8a4020', mid:'#e88a58', bead:'#b8582c'}, bead:'pink' },
  { name:'Abyss Tasting Set',    sub:'Сет «Абисс» · 5×30g',      price:169,  color:{top:'#1a1a2a', mid:'#2a2a44', bead:'#d44a2a'}, bead:'mix' },
];

function jarSVG(p){
  // Unique gradient ids per jar to avoid conflicts
  const uid = Math.random().toString(36).slice(2,8);
  return `
  <svg class="product-jar-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="glass-${uid}" x1="0" x2="1">
        <stop offset="0" stop-color="rgba(255,255,255,.35)"/>
        <stop offset=".5" stop-color="rgba(255,255,255,.1)"/>
        <stop offset="1" stop-color="rgba(255,255,255,.25)"/>
      </linearGradient>
      <radialGradient id="cav-${uid}" cx=".3" cy=".25" r=".9">
        <stop offset="0" stop-color="${p.color.top}"/>
        <stop offset=".6" stop-color="${p.color.mid}"/>
        <stop offset="1" stop-color="${p.color.top}"/>
      </radialGradient>
      <radialGradient id="lid-${uid}" cx=".5" cy=".3" r=".8">
        <stop offset="0" stop-color="#c9b77a"/>
        <stop offset=".5" stop-color="#8a7540"/>
        <stop offset="1" stop-color="#3a2f14"/>
      </radialGradient>
      <pattern id="beads-${uid}" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.4" fill="${p.color.bead}"/>
        <circle cx="3.3" cy="3.3" r=".7" fill="rgba(255,255,255,.4)"/>
      </pattern>
    </defs>
    <!-- caviar fill -->
    <ellipse cx="80" cy="70" rx="58" ry="14" fill="url(#cav-${uid})"/>
    <path d="M22,70 L22,150 Q22,180 80,180 Q138,180 138,150 L138,70 Z" fill="url(#cav-${uid})"/>
    <!-- beads texture -->
    <path d="M22,70 L22,150 Q22,180 80,180 Q138,180 138,150 L138,70 Q138,84 80,84 Q22,84 22,70 Z"
          fill="url(#beads-${uid})" opacity=".85"/>
    <!-- glass highlight (front) -->
    <path d="M22,70 L22,150 Q22,180 80,180 Q138,180 138,150 L138,70"
          fill="url(#glass-${uid})" opacity=".35" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
    <!-- glass rim -->
    <ellipse cx="80" cy="70" rx="58" ry="10" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.2"/>
    <!-- lid -->
    <ellipse cx="80" cy="52" rx="60" ry="12" fill="url(#lid-${uid})"/>
    <rect x="20" y="48" width="120" height="14" rx="6" fill="url(#lid-${uid})"/>
    <ellipse cx="80" cy="48" rx="60" ry="8" fill="#d9c489" opacity=".55"/>
    <!-- label -->
    <rect x="38" y="110" width="84" height="46" rx="3" fill="rgba(255,255,255,.92)" stroke="rgba(0,0,0,.15)"/>
    <text x="80" y="128" text-anchor="middle" font-family="'Unbounded',sans-serif" font-size="10" font-weight="600" fill="#0a1a2e" letter-spacing=".1em">VA1FY</text>
    <text x="80" y="144" text-anchor="middle" font-family="'Manrope',sans-serif" font-size="7" fill="#4a5a6a" letter-spacing=".15em">PREMIUM CAVIAR</text>
    <!-- specular -->
    <path d="M30,80 Q26,120 32,165" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

const grid = document.getElementById('products-grid');
grid.innerHTML = PRODUCTS.map((p, i) => `
  <article class="product-card" data-idx="${i}">
    <div class="product-jar-wrap" data-drag>${jarSVG(p)}</div>
    <div class="product-info">
      <h3>${p.name}</h3>
      <div class="sub">${p.sub}</div>
      <div class="product-meta">
        <span>за банку</span>
        <strong><em>$</em>${p.price}</strong>
      </div>
      <button class="buy-btn" data-buy>Купить</button>
    </div>
  </article>
`).join('');

// Re-attach cursor hover on new elements
document.querySelectorAll('.product-card, .product-jar-wrap, .buy-btn').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// Parallax shine on card
document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (y - .5) * -6;
    const ry = (x - .5) * 6;
    if(!card.classList.contains('dragging')){
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
    card.style.setProperty('--mx', (x*100)+'%');
    card.style.setProperty('--my', (y*100)+'%');
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});

/* --- Drag jars between cards --- */
const allWraps = () => [...document.querySelectorAll('[data-drag]')];

function setupDrag(wrap){
  let svg = wrap.querySelector('.product-jar-svg');
  let dragging = false, sx=0, sy=0, ox=0, oy=0;

  wrap.addEventListener('pointerdown', e => {
    svg = wrap.querySelector('.product-jar-svg');
    if(!svg) return;
    dragging = true;
    svg.style.transition = 'none';
    svg.style.zIndex = '100';
    svg.style.position = 'relative';
    sx = e.clientX; sy = e.clientY;
    ox = 0; oy = 0;
    wrap.setPointerCapture(e.pointerId);
    wrap.style.zIndex = '50';
  });

  wrap.addEventListener('pointermove', e => {
    if(!dragging) return;
    ox = e.clientX - sx;
    oy = e.clientY - sy;
    const rot = Math.max(-25, Math.min(25, ox * 0.12));
    svg.style.transform = `translate(${ox}px, ${oy}px) rotate(${rot}deg) scale(1.08)`;

    // Highlight potential drop target
    allWraps().forEach(w => w.classList.remove('drop-target'));
    const target = findDropTarget(e.clientX, e.clientY, wrap);
    if(target) target.classList.add('drop-target');
  });

  const release = e => {
    if(!dragging) return;
    dragging = false;
    try { wrap.releasePointerCapture(e.pointerId); } catch {}
    const target = findDropTarget(e.clientX, e.clientY, wrap);
    allWraps().forEach(w => w.classList.remove('drop-target'));
    wrap.style.zIndex = '';

    if (target && target !== wrap){
      // Swap SVGs between wrap and target with smooth animation
      swapJars(wrap, target);
    } else {
      // Spring back
      svg.style.transition = 'transform .8s cubic-bezier(.34,1.56,.64,1)';
      svg.style.transform = '';
      setTimeout(() => { if(svg) svg.style.zIndex = ''; }, 850);
    }
  };
  wrap.addEventListener('pointerup', release);
  wrap.addEventListener('pointercancel', release);
}

function findDropTarget(x, y, exclude){
  for(const w of allWraps()){
    if(w === exclude) continue;
    const r = w.getBoundingClientRect();
    if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return w;
  }
  return null;
}

function swapJars(a, b){
  const aSvg = a.querySelector('.product-jar-svg');
  const bSvg = b.querySelector('.product-jar-svg');
  if(!aSvg || !bSvg) return;

  // Measure current positions
  const aRect = aSvg.getBoundingClientRect();
  const bRect = bSvg.getBoundingClientRect();

  // Reset transforms and move DOM
  aSvg.style.transition = 'none';
  bSvg.style.transition = 'none';
  aSvg.style.transform = '';
  bSvg.style.transform = '';

  a.appendChild(bSvg);
  b.appendChild(aSvg);

  // FLIP: compute delta from old to new and animate back to 0
  const aNew = aSvg.getBoundingClientRect();
  const bNew = bSvg.getBoundingClientRect();
  aSvg.style.transform = `translate(${aRect.left - aNew.left}px, ${aRect.top - aNew.top}px)`;
  bSvg.style.transform = `translate(${bRect.left - bNew.left}px, ${bRect.top - bNew.top}px)`;

  requestAnimationFrame(() => {
    aSvg.style.transition = 'transform .7s cubic-bezier(.34,1.56,.64,1)';
    bSvg.style.transition = 'transform .7s cubic-bezier(.34,1.56,.64,1)';
    aSvg.style.transform = '';
    bSvg.style.transform = '';
  });

  setTimeout(() => {
    aSvg.style.zIndex = '';
    bSvg.style.zIndex = '';
  }, 750);
}

document.querySelectorAll('[data-drag]').forEach(setupDrag);

/* =========================================================
   AVATAR CARD 3D TILT
   ========================================================= */
const avatarFrame = document.querySelector('.avatar-frame');
if (avatarFrame){
  const TILT = 18; // max degrees
  avatarFrame.addEventListener('mousemove', e => {
    avatarFrame.style.animation = 'none'; // pause float so JS transform isn't overridden
    const r = avatarFrame.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    const rotX = -y * TILT;
    const rotY =  x * TILT;
    avatarFrame.style.setProperty('--tx', ((x+0.5)*100)+'%');
    avatarFrame.style.setProperty('--ty', ((y+0.5)*100)+'%');
    avatarFrame.style.transform =
      `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
  });
  avatarFrame.addEventListener('mouseleave', () => {
    avatarFrame.style.animation = '';
    avatarFrame.style.transform = '';
  });
}

/* --- BUY button that flees then throws Windows error --- */
const winError = document.getElementById('win-error');

function playBeep(freq=800, dur=120){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur/1000);
    osc.start();
    osc.stop(ctx.currentTime + dur/1000 + 0.02);
  } catch {}
}

function windowsDing(){
  playBeep(900, 120);
  setTimeout(() => playBeep(650, 200), 140);
}

function showWinError(){
  winError.classList.add('active');
  windowsDing();
  document.body.style.overflow = 'hidden';
}
function closeWinError(){
  winError.classList.remove('active');
  document.body.style.overflow = '';
}
winError.querySelectorAll('[data-act]').forEach(b => {
  b.addEventListener('click', () => {
    playBeep(600, 60);
    closeWinError();
  });
});
winError.addEventListener('click', e => {
  if(e.target === winError) closeWinError();
});

document.querySelectorAll('[data-buy]').forEach(btn => {
  let clicks = 0;
  const maxClicks = 3;
  let anchored = false;
  let locked = false;
  const originalParent = btn.parentElement;

  function anchorCurrent(){
    const r = btn.getBoundingClientRect();
    // Move to body so parent card's CSS transform can't trap fixed positioning
    document.body.appendChild(btn);
    btn.style.margin     = '0';
    btn.style.width      = r.width  + 'px';
    btn.style.height     = r.height + 'px';
    btn.style.position   = 'fixed';
    btn.style.left       = r.left   + 'px';
    btn.style.top        = r.top    + 'px';
    btn.style.zIndex     = '9998';
    btn.style.transition = 'none';
    void btn.offsetWidth;
    btn.style.transition = 'left .55s cubic-bezier(.34,1.56,.64,1), top .55s cubic-bezier(.34,1.56,.64,1)';
    btn.classList.add('flee');
    anchored = true;
  }

  function placeRandomly(){
    const w   = btn.offsetWidth  || 180;
    const h   = btn.offsetHeight || 44;
    const pad = 60;
    const cx  = parseFloat(btn.style.left) || innerWidth  / 2;
    const cy  = parseFloat(btn.style.top)  || innerHeight / 2;
    let x, y, tries = 0;
    do {
      x = pad + Math.random() * (innerWidth  - w - pad * 2);
      y = pad + Math.random() * (innerHeight - h - pad * 2);
      tries++;
    } while (Math.hypot(x - cx, y - cy) < 300 && tries < 30);
    btn.style.left = x + 'px';
    btn.style.top  = y + 'px';
    btn.classList.add('wiggle');
    setTimeout(() => btn.classList.remove('wiggle'), 400);
  }

  function resetButton(){
    btn.classList.remove('flee', 'wiggle');
    btn.style.cssText = '';
    originalParent.appendChild(btn); // return to card
    anchored = false;
    clicks = 0;
    locked = false;
  }

  btn.addEventListener('click', e => {
    if (locked) return;
    e.stopPropagation();
    clicks++;

    if (clicks >= maxClicks){
      locked = true;
      // One last big jump, then error
      if (!anchored) anchorCurrent();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        placeRandomly();
        playBeep(400, 200);
        setTimeout(() => { resetButton(); showWinError(); }, 700);
      }));
      return;
    }

    playBeep(900 + clicks * 150, 70);

    if (!anchored){
      anchorCurrent();
      // Double-rAF: first frame locks position, second frame triggers transition to new spot
      requestAnimationFrame(() => requestAnimationFrame(placeRandomly));
    } else {
      placeRandomly();
    }
  });
});

/* =========================================================
   CLIP CARDS + MODAL
   ========================================================= */
const modal = document.getElementById('modal');
const modalIframe = document.getElementById('modal-iframe');
const modalClose = modal.querySelector('.modal-close');
const modalBackdrop = modal.querySelector('.modal-backdrop');

document.querySelectorAll('.clip-card').forEach(card => {
  const id = card.dataset.yt;
  // hqdefault exists for every YT video (480x360)
  card.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
  // Try to upgrade to maxres if available
  const hi = new Image();
  hi.onload = () => {
    if(hi.naturalWidth > 200){
      card.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/maxresdefault.jpg)`;
    }
  };
  hi.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  card.addEventListener('click', () => {
    modalIframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
});

function closeModal(){
  modal.classList.remove('active');
  modalIframe.src = '';
  document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
addEventListener('keydown', e => { if(e.key === 'Escape'){ closeModal(); closeWinError(); } });

/* =========================================================
   MUSIC — YouTube (if MUSIC_YT_ID set) or local music.mp3
   ========================================================= */
const audioEl = document.getElementById('bg-audio');
const musicBtn = document.getElementById('music-toggle');
const musicLabel = musicBtn.querySelector('.music-label');
audioEl.volume = 0.25;

let ytPlayer = null;
let ytReady = false;
let isPlaying = false;

if (MUSIC_YT_ID){
  // Load YouTube IFrame API
  const ytContainer = document.getElementById('yt-music');
  Object.assign(ytContainer.style, {
    position:'fixed', bottom:'-10px', right:'-10px',
    width:'1px', height:'1px', opacity:'0',
    pointerEvents:'none', overflow:'hidden'
  });

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('yt-music', {
      videoId: MUSIC_YT_ID,
      playerVars: { autoplay:0, controls:0, loop:1, playlist:MUSIC_YT_ID, playsinline:1 },
      events: {
        onReady: () => { ytReady = true; ytPlayer.setVolume(25); }
      }
    });
  };
}

musicBtn.addEventListener('click', async () => {
  if (MUSIC_YT_ID && ytReady){
    if (isPlaying){ ytPlayer.pauseVideo(); isPlaying = false; musicBtn.classList.remove('playing'); }
    else          { ytPlayer.playVideo();  isPlaying = true;  musicBtn.classList.add('playing'); }
    return;
  }
  if (MUSIC_YT_ID && !ytReady){
    musicLabel.textContent = 'загрузка…';
    setTimeout(() => musicLabel.textContent = 'Музыка', 1500);
    return;
  }
  try {
    if (audioEl.paused){ await audioEl.play(); musicBtn.classList.add('playing'); }
    else               { audioEl.pause();      musicBtn.classList.remove('playing'); }
  } catch {
    musicBtn.classList.remove('playing');
    musicLabel.textContent = 'нет music.mp3';
    setTimeout(() => musicLabel.textContent = 'Музыка', 2500);
  }
});

/* =========================================================
   SECTION REVEAL
   ========================================================= */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold:.08 });

document.querySelectorAll('.section:not(.section-hero)').forEach(s => {
  s.style.opacity = '0';
  s.style.transform = 'translateY(40px)';
  s.style.transition = 'opacity 1.2s cubic-bezier(.2,.8,.2,1), transform 1.2s cubic-bezier(.2,.8,.2,1)';
  revealObs.observe(s);
});

/* =========================================================
   FLOATING FISH
   ========================================================= */
(function(){
  const fish = document.getElementById('fish');
  const reviewModal = document.getElementById('review-modal');
  const reviewVideo = document.getElementById('review-video');
  const reviewClose = reviewModal.querySelector('.review-close');
  const reviewBackdrop = reviewModal.querySelector('.review-backdrop');

  // Fish position & velocity
  let fx = innerWidth  - 160;
  let fy = innerHeight - 120;
  let vx = -(1.4 + Math.random() * 0.8);
  let vy = -(0.6 + Math.random() * 0.6);
  let facingLeft = true; // true = swimming left (default SVG direction)

  // Target the fish occasionally drifts toward to feel "alive"
  let tx = innerWidth / 2, ty = innerHeight / 2;
  let targetTimer = 0;

  function pickNewTarget(){
    const pad = 120;
    tx = pad + Math.random() * (innerWidth  - pad * 2);
    ty = pad + Math.random() * (innerHeight - pad * 2);
    targetTimer = 180 + Math.random() * 240; // frames
  }
  pickNewTarget();

  const W = 110, H = 70;

  function fishLoop(){
    targetTimer--;
    if(targetTimer <= 0) pickNewTarget();

    // Gently steer toward target
    const dx = tx - fx, dy = ty - fy;
    const dist = Math.hypot(dx, dy);
    if(dist > 40){
      vx += (dx / dist) * 0.04;
      vy += (dy / dist) * 0.025;
    }

    // Speed cap — feels like a lazy fish
    const speed = Math.hypot(vx, vy);
    const maxSpeed = 2.4;
    if(speed > maxSpeed){ vx = vx/speed*maxSpeed; vy = vy/speed*maxSpeed; }

    // Light random wiggle
    vx += (Math.random() - 0.5) * 0.06;
    vy += (Math.random() - 0.5) * 0.04;

    fx += vx; fy += vy;

    // Bounce off walls
    if(fx < 0)             { fx = 0;               vx = Math.abs(vx); }
    if(fx > innerWidth-W)  { fx = innerWidth-W;    vx = -Math.abs(vx); }
    if(fy < 0)             { fy = 0;               vy = Math.abs(vy); }
    if(fy > innerHeight-H) { fy = innerHeight-H;   vy = -Math.abs(vy); }

    // Flip fish to face direction of travel
    const shouldFaceLeft = vx < 0;
    if(shouldFaceLeft !== facingLeft){
      facingLeft = shouldFaceLeft;
      fish.querySelector('svg').style.transform = facingLeft ? '' : 'scaleX(-1)';
    }

    // Subtle vertical tail-wag via skew
    const wag = Math.sin(performance.now() * 0.006) * 3;
    fish.style.left = fx + 'px';
    fish.style.top  = fy + 'px';
    fish.querySelector('.fish-body').style.transform = `rotate(${wag}deg)`;

    requestAnimationFrame(fishLoop);
  }
  fishLoop();

  // "Excited" idle nudge — fish occasionally wiggles on its own
  setInterval(() => {
    fish.classList.add('excited');
    setTimeout(() => fish.classList.remove('excited'), 450);
  }, 4000 + Math.random() * 3000);

  // Cursor hover — add to global hover listeners
  fish.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  fish.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));

  // Click — open review modal
  fish.addEventListener('click', () => {
    fish.classList.add('excited');
    setTimeout(() => fish.classList.remove('excited'), 450);
    reviewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    reviewVideo.play().then(() => {
      document.getElementById('rv-play-icon').style.display='none';
      document.getElementById('rv-pause-icon').style.display='';
    }).catch(()=>{});
  });

  // Custom video controls
  const rvPlay  = document.getElementById('rv-play');
  const rvPlayIcon  = document.getElementById('rv-play-icon');
  const rvPauseIcon = document.getElementById('rv-pause-icon');
  const rvMute  = document.getElementById('rv-mute');
  const rvSeek  = document.getElementById('rv-seek');
  const rvFill  = document.getElementById('rv-fill');
  const rvCur   = document.getElementById('rv-cur');
  const rvDur   = document.getElementById('rv-dur');

  function fmtTime(s){ const m=Math.floor(s/60); return m+':'+(String(Math.floor(s%60)).padStart(2,'0')); }

  reviewVideo.addEventListener('loadedmetadata', () => { rvDur.textContent = fmtTime(reviewVideo.duration); });
  reviewVideo.addEventListener('timeupdate', () => {
    const pct = reviewVideo.duration ? reviewVideo.currentTime / reviewVideo.duration * 100 : 0;
    rvFill.style.width = pct + '%';
    rvSeek.value = pct;
    rvCur.textContent = fmtTime(reviewVideo.currentTime);
  });
  reviewVideo.addEventListener('ended', () => { rvPlayIcon.style.display=''; rvPauseIcon.style.display='none'; });

  rvPlay.addEventListener('click', () => {
    if(reviewVideo.paused){ reviewVideo.play(); rvPlayIcon.style.display='none'; rvPauseIcon.style.display=''; }
    else { reviewVideo.pause(); rvPlayIcon.style.display=''; rvPauseIcon.style.display='none'; }
  });
  rvMute.addEventListener('click', () => { reviewVideo.muted = !reviewVideo.muted; rvMute.style.opacity = reviewVideo.muted ? '.4' : '1'; });
  rvSeek.addEventListener('input', () => {
    if(reviewVideo.duration) reviewVideo.currentTime = rvSeek.value / 100 * reviewVideo.duration;
  });

  function closeReview(){
    reviewModal.classList.remove('active');
    reviewVideo.pause();
    reviewVideo.currentTime = 0;
    rvPlayIcon.style.display=''; rvPauseIcon.style.display='none';
    document.body.style.overflow = '';
  }
  reviewClose.addEventListener('click', closeReview);
  reviewBackdrop.addEventListener('click', closeReview);
  addEventListener('keydown', e => { if(e.key === 'Escape') closeReview(); });

  addEventListener('resize', () => {
    fx = Math.min(fx, innerWidth  - W);
    fy = Math.min(fy, innerHeight - H);
  });
})();
