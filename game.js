/* DONUT DEFENSE — Protect the Strawberry Donut! */
const GameEngine = (() => {
  'use strict';

  // === CONFIG ===
  const CFG = {
    donutR: 60,          // Donut visual radius
    donutHP: 100,        // Donut max HP (percentage)
    playerR: 18,         // Player hitbox radius
    playerSpeed: 5,
    shootInterval: 280,
    bulletSpeed: 8,
    bulletR: 4,
    bulletLifetime: 800,
    spawnIntervalStart: 2000,
    spawnIntervalMin: 400,
    maxEnemies: 30,
    invincibleTime: 500,
    powerUpChance: 0.15,
    powerUpDuration: 5000,
    powerUpR: 16,
    shakeDecay: 0.88,
    starCount: 40,
    hitstopDuration: 33,
  };

  // Donut palette
  const CLR = {
    pink: '#ff8fab', hot: '#ff4081', choco: '#3d1a0e', cream: '#fff5e6',
    vanilla: '#ffecd2', caramel: '#d4a574', mint: '#a8e6cf', berry: '#dda0dd',
    gold: '#ffd700', bg: '#2a1a0e', bgLight: '#3d2a1a', white: '#fff5e6',
  };

  // Enemy definitions
  const ENEMY_TYPES = {
    ant:   { r: 14, speed: 1.2, hp: 1, dmg: 3,  score: 10, img: 'enemy_ant' },
    fly:   { r: 12, speed: 2.8, hp: 1, dmg: 2,  score: 15, img: 'enemy_fly' },
    mouse: { r: 20, speed: 0.9, hp: 3, dmg: 8,  score: 30, img: 'enemy_mouse' },
    wasp:  { r: 22, speed: 1.0, hp: 5, dmg: 5,  score: 25, img: 'enemy_wasp' },
  };

  const POWERUP_TYPES = [
    { type: 'shield',    color: '#7b3f00',  label: 'CHOCO',    icon: '🍫' },
    { type: 'speed',     color: '#a8e6cf',  label: 'SPEED UP', icon: '🍦' },
    { type: 'multishot', color: '#ff8fab',  label: 'SPRINKLE', icon: '✨' },
    { type: 'heal',      color: '#ff6b6b',  label: '+DONUT',   icon: '🍓' },
  ];

  // === WEB AUDIO SFX ===
  const SFX = (() => {
    let actx = null, master = null;
    function ensure() {
      if (actx) return true;
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.25; master.connect(actx.destination); return true; } catch (e) { return false; }
    }
    function g(vol) { const gn = actx.createGain(); gn.gain.value = vol; gn.connect(master); return gn; }
    function shoot() { if (!ensure()) return; const t = actx.currentTime, o = actx.createOscillator(), gn = g(0.10); o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.05); gn.gain.setValueAtTime(0.10, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06); o.connect(gn); o.start(t); o.stop(t + 0.07); }
    function hit() { if (!ensure()) return; const t = actx.currentTime, buf = actx.createBuffer(1, actx.sampleRate * 0.03, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4; const s = actx.createBufferSource(); s.buffer = buf; const gn = g(0.08); s.connect(gn); gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.03); s.start(t); }
    function kill() { if (!ensure()) return; const t = actx.currentTime, dur = 0.15, buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = actx.createBufferSource(); s.buffer = buf; const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(200, t + dur); const gn = g(0.15); s.connect(f); f.connect(gn); gn.gain.setValueAtTime(0.15, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); s.start(t); }
    function donutHit() { if (!ensure()) return; const t = actx.currentTime, o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.3); const gn = g(0.18); gn.gain.setValueAtTime(0.18, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(gn); o.start(t); o.stop(t + 0.35); }
    function powerUp() { if (!ensure()) return; const t = actx.currentTime; [523, 659, 784].forEach((freq, i) => { const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = freq; const gn = g(0.12); const s = t + i * 0.07; gn.gain.setValueAtTime(0.001, s); gn.gain.linearRampToValueAtTime(0.12, s + 0.02); gn.gain.exponentialRampToValueAtTime(0.001, s + 0.12); o.connect(gn); o.start(s); o.stop(s + 0.13); }); }
    function gameOver() { if (!ensure()) return; const t = actx.currentTime; [440, 311].forEach((freq, i) => { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t + i * 0.25); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + i * 0.25 + 0.4); const gn = g(0.15); gn.gain.setValueAtTime(0.001, t + i * 0.25); gn.gain.linearRampToValueAtTime(0.15, t + i * 0.25 + 0.05); gn.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.5); o.connect(gn); o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.55); }); }
    function comboBlip(c) { if (!ensure()) return; const t = actx.currentTime, o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = 600 + Math.min(c, 10) * 80; const gn = g(0.07); gn.gain.setValueAtTime(0.07, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(gn); o.start(t); o.stop(t + 0.09); }
    return { shoot, hit, kill, donutHit, powerUp, gameOver, comboBlip };
  })();

  // === SPRITE LOADER ===
  const sprites = {};
  const SPRITE_LIST = ['donut', 'player', 'enemy_ant', 'enemy_fly', 'enemy_mouse', 'enemy_wasp'];
  let spritesLoaded = 0;
  function loadSprites(cb) {
    spritesLoaded = 0;
    SPRITE_LIST.forEach(name => {
      const img = new Image();
      img.onload = () => { sprites[name] = img; spritesLoaded++; if (spritesLoaded >= SPRITE_LIST.length && cb) cb(); };
      img.onerror = () => { sprites[name] = null; spritesLoaded++; if (spritesLoaded >= SPRITE_LIST.length && cb) cb(); };
      img.src = `assets/${name}.png`;
    });
  }

  // === STATE ===
  let active = false, _canvas, _ctx, W, H, animFrame, lastTime = 0;
  let player = null, targetX, targetY, touching = false;
  let bullets = [], enemies = [], particles = [], powerUps = [], floatingTexts = [];
  let lastShot = 0, lastSpawn = 0, spawnInterval;
  let score = 0, kills = 0, combo = 0, lastKillTime = 0, comboTimer = 0;
  let shake = { x: 0, y: 0, intensity: 0 }, flashAlpha = 0, screenPulse = 0;
  let activePowers = {};
  let stars = [], hitstopUntil = 0;
  // Donut Defense specific
  let donut = null; // { x, y, hp, maxHp, r, visualR }
  let survivalTime = 0; // seconds survived
  let gameStartTime = 0;
  let difficulty = 1; // increases over time
  let highScore = parseFloat(localStorage.getItem('donut_hightime') || '0');
  // Quality
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let fpsHistory = [], quality = 'HIGH';

  // === HELPERS ===
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function glow(ctx, color, blur) { const b = quality === 'LOW' ? Math.min(blur, 4) : blur; ctx.shadowColor = color; ctx.shadowBlur = b; }
  function noGlow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

  function detectQuality(rawDt) {
    fpsHistory.push(1000 / Math.max(rawDt, 1)); if (fpsHistory.length > 30) fpsHistory.shift();
    if (fpsHistory.length < 20) return;
    const avg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    if (avg < 30 && quality !== 'LOW') quality = 'LOW';
    else if (avg < 45 && quality === 'HIGH') quality = 'MEDIUM';
    else if (avg > 55 && quality === 'LOW') quality = 'MEDIUM';
    else if (avg > 58 && quality === 'MEDIUM') quality = 'HIGH';
  }

  // === BACKGROUND ===
  function initStars() {
    stars = [];
    for (let i = 0; i < CFG.starCount; i++) {
      stars.push({
        x: rand(0, W), y: rand(0, H),
        size: rand(0.5, 2), alpha: rand(0.1, 0.4),
        phase: rand(0, Math.PI * 2),
        color: ['#ff8fab', '#ffecd2', '#a8e6cf', '#dda0dd', '#ffb347'][i % 5],
      });
    }
  }

  function drawBackground(ctx, now) {
    // Warm gradient bg
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    ctx.fillStyle = CLR.bg;
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    ctx.restore();

    // Radial warm glow from center
    const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    gr.addColorStop(0, 'rgba(90,45,26,0.4)');
    gr.addColorStop(0.5, 'rgba(61,26,14,0.2)');
    gr.addColorStop(1, 'rgba(42,26,14,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    // Sparkle particles
    for (const s of stars) {
      const twinkle = 0.5 + Math.sin(now / 2000 + s.phase) * 0.5;
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // === DONUT (Center piece) ===
  function createDonut() {
    return { x: W / 2, y: H / 2, hp: CFG.donutHP, maxHp: CFG.donutHP, r: CFG.donutR, visualR: CFG.donutR };
  }

  function drawDonut(ctx, now) {
    if (!donut) return;
    const hpRatio = donut.hp / donut.maxHp;
    // Scale donut based on HP
    donut.visualR = lerp(donut.visualR, CFG.donutR * (0.3 + hpRatio * 0.7), 0.08);
    const r = donut.visualR;
    const pulse = 1 + Math.sin(now / 800) * 0.02;

    ctx.save();
    ctx.translate(donut.x, donut.y);

    // Glow under donut
    const glowR = r * 1.6;
    const glGr = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, glowR);
    glGr.addColorStop(0, 'rgba(255,143,171,0.15)');
    glGr.addColorStop(1, 'rgba(255,143,171,0)');
    ctx.fillStyle = glGr;
    ctx.fillRect(-glowR, -glowR, glowR * 2, glowR * 2);

    // Draw donut sprite
    if (sprites.donut) {
      const size = r * 2 * pulse;
      ctx.globalAlpha = 0.3 + hpRatio * 0.7;
      // Damage flash
      if (flashAlpha > 0.1) ctx.filter = 'brightness(2) saturate(0.3)';
      ctx.drawImage(sprites.donut, -size / 2, -size / 2, size, size);
      ctx.filter = 'none';
    } else {
      // Fallback circle
      ctx.globalAlpha = 0.3 + hpRatio * 0.7;
      glow(ctx, CLR.pink, 20);
      ctx.fillStyle = CLR.caramel;
      ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CLR.pink;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CLR.bg;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3 * pulse, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
    }
    ctx.globalAlpha = 1;

    // HP ring around donut
    ctx.strokeStyle = 'rgba(255,245,230,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke();
    const hpColor = hpRatio > 0.5 ? CLR.mint : hpRatio > 0.25 ? '#ffb347' : CLR.hot;
    glow(ctx, hpColor, 8);
    ctx.strokeStyle = hpColor;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio); ctx.stroke();
    noGlow(ctx);

    // HP text
    ctx.fillStyle = CLR.white;
    ctx.font = 'bold 14px "Outfit",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.7;
    ctx.fillText(`${Math.ceil(donut.hp)}%`, 0, r + 26);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // === PLAYER ===
  function createPlayer() {
    return { x: W / 2, y: H / 2 + CFG.donutR + 60, trail: [], alive: true, angle: 0 };
  }

  function updatePlayer(dt) {
    if (!player.alive) return;
    const speed = activePowers.speed ? CFG.playerSpeed * 1.6 : CFG.playerSpeed;
    if (touching) {
      const dx = targetX - player.x, dy = targetY - player.y, d = Math.hypot(dx, dy);
      if (d > 3) { const m = Math.min(speed, d * 0.15); player.x += (dx / d) * m; player.y += (dy / d) * m; }
    }
    player.x = clamp(player.x, CFG.playerR, W - CFG.playerR);
    player.y = clamp(player.y, CFG.playerR, H - CFG.playerR);
    // Calculate angle towards nearest enemy
    let nearest = null, nearDist = Infinity;
    for (const e of enemies) { const d = dist(player, e); if (d < nearDist) { nearDist = d; nearest = e; } }
    if (nearest) player.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    // Trail
    player.trail.unshift({ x: player.x, y: player.y });
    if (player.trail.length > 8) player.trail.pop();
  }

  function drawPlayer(ctx, now) {
    if (!player.alive) return;
    // Trail
    const trailColors = ['#ff8fab', '#a8e6cf', '#ffecd2', '#dda0dd'];
    for (let i = 1; i < player.trail.length; i++) {
      const t = 1 - i / player.trail.length, p = player.trail[i];
      ctx.globalAlpha = t * 0.3;
      ctx.fillStyle = trailColors[i % trailColors.length];
      ctx.beginPath(); ctx.arc(p.x, p.y, 2 + t * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player sprite
    const r = CFG.playerR;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle + Math.PI / 2);
    if (sprites.player) {
      const size = r * 2.5;
      ctx.drawImage(sprites.player, -size / 2, -size / 2, size, size);
    } else {
      // Fallback
      glow(ctx, CLR.pink, 15);
      ctx.fillStyle = CLR.cream;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CLR.pink;
      ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.4, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
    }
    ctx.restore();
    ctx.globalAlpha = 1; noGlow(ctx);

    // Shield visual
    if (activePowers.shield) {
      ctx.globalAlpha = 0.25 + Math.sin(now / 200) * 0.1;
      glow(ctx, '#7b3f00', 15);
      ctx.strokeStyle = '#7b3f00'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(player.x, player.y, r + 12, 0, Math.PI * 2); ctx.stroke();
      noGlow(ctx);
    }
    ctx.globalAlpha = 1;
  }

  // === BULLETS ===
  function autoShoot(now) {
    if (!player.alive) return;
    if (now - lastShot < CFG.shootInterval) return;
    lastShot = now;
    let nearest = null, nearDist = Infinity;
    for (const e of enemies) { const d = dist(player, e); if (d < nearDist) { nearDist = d; nearest = e; } }
    if (!nearest) return;
    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    fireBullet(angle); SFX.shoot();
    if (activePowers.multishot) { fireBullet(angle - 0.22); fireBullet(angle + 0.22); }
  }

  function fireBullet(angle) {
    bullets.push({ x: player.x, y: player.y, vx: Math.cos(angle) * CFG.bulletSpeed, vy: Math.sin(angle) * CFG.bulletSpeed, born: performance.now(), r: CFG.bulletR });
  }

  function updateBullets(now) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.x += b.vx; b.y += b.vy;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20 || now - b.born > CFG.bulletLifetime) bullets.splice(i, 1);
    }
  }

  function drawBullets(ctx) {
    const sColors = ['#ff8fab', '#a8e6cf', '#ffb347', '#dda0dd', '#ffecd2', '#ff4081'];
    for (let bi = 0; bi < bullets.length; bi++) {
      const b = bullets[bi], sc = sColors[bi % sColors.length];
      const tx = b.x - b.vx * 3, ty = b.y - b.vy * 3;
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = sc; ctx.lineWidth = b.r;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 1;
      glow(ctx, sc, 8); ctx.fillStyle = sc;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = CLR.white; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; noGlow(ctx);
  }

  // === ENEMIES ===
  function spawnEnemy() {
    // Pick type based on difficulty
    let typeKey;
    const roll = Math.random();
    if (survivalTime < 15) typeKey = roll < 0.7 ? 'ant' : 'fly';
    else if (survivalTime < 40) typeKey = roll < 0.35 ? 'ant' : roll < 0.65 ? 'fly' : roll < 0.85 ? 'mouse' : 'wasp';
    else typeKey = roll < 0.2 ? 'ant' : roll < 0.4 ? 'fly' : roll < 0.7 ? 'mouse' : 'wasp';

    const type = ENEMY_TYPES[typeKey];
    const speedMult = 1 + difficulty * 0.08;
    // Spawn from screen edges
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
      case 0: x = rand(0, W); y = -30; break;
      case 1: x = W + 30; y = rand(0, H); break;
      case 2: x = rand(0, W); y = H + 30; break;
      case 3: x = -30; y = rand(0, H); break;
    }
    enemies.push({
      x, y, hp: type.hp, maxHp: type.hp, r: type.r,
      speed: type.speed * speedMult, dmg: type.dmg,
      score: type.score, typeKey, phase: rand(0, Math.PI * 2),
    });
  }

  function updateEnemies(dt, now) {
    for (const e of enemies) {
      // Move towards donut (center)
      const dx = donut.x - e.x, dy = donut.y - e.y, d = Math.hypot(dx, dy);
      if (d > 1) {
        const wobble = Math.sin(now / 500 + e.phase) * 0.4;
        e.x += (dx / d) * e.speed + wobble;
        e.y += (dy / d) * e.speed;
      }
    }
  }

  function drawEnemies(ctx, now) {
    for (const e of enemies) {
      ctx.globalAlpha = 1;
      const pulse = 1 + Math.sin(now / 300 + e.phase) * 0.05;
      const r = e.r * pulse;
      const type = ENEMY_TYPES[e.typeKey];
      const sprKey = type.img;

      ctx.save();
      ctx.translate(e.x, e.y);
      // Rotate to face donut
      const angle = Math.atan2(donut.y - e.y, donut.x - e.x);
      ctx.rotate(angle + Math.PI / 2);

      if (sprites[sprKey]) {
        const size = r * 2.5;
        ctx.drawImage(sprites[sprKey], -size / 2, -size / 2, size, size);
      } else {
        // Fallback colored circle
        glow(ctx, CLR.hot, 10);
        ctx.fillStyle = CLR.hot + '88';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = CLR.hot; ctx.lineWidth = 2;
        ctx.stroke();
        noGlow(ctx);
      }
      ctx.restore();

      // HP bar for multi-HP enemies
      if (e.maxHp > 1) {
        ctx.globalAlpha = 0.7;
        const bw = e.r * 2, bh = 3, bx = e.x - bw / 2, by = e.y - e.r - 10;
        ctx.fillStyle = '#1a0e05'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = CLR.hot; ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
      }
    }
    ctx.globalAlpha = 1; noGlow(ctx);
  }

  // === COLLISIONS ===
  function checkCollisions(now) {
    // Bullets vs enemies
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (dist(b, e) < e.r + b.r + 3) {
          bullets.splice(bi, 1);
          e.hp--;
          spawnHitSparks(b.x, b.y, CLR.pink, 4);
          SFX.hit();
          if (e.hp <= 0) {
            killEnemy(ei, e, now);
            hitstopUntil = now + CFG.hitstopDuration;
          }
          break;
        }
      }
    }

    // Enemies vs donut
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (dist(e, donut) < donut.visualR + e.r - 5) {
        // Enemy reached the donut!
        donut.hp = Math.max(0, donut.hp - e.dmg);
        addFloatingText(donut.x + rand(-30, 30), donut.y + rand(-30, 30), `-${e.dmg}%`, CLR.hot);
        spawnBiteParticles(e.x, e.y);
        addShake(6 + e.dmg);
        flashAlpha = 0.3;
        SFX.donutHit();
        enemies.splice(ei, 1);

        if (donut.hp <= 0) {
          donut.hp = 0;
          spawnExplosion(donut.x, donut.y, CLR.pink, 30);
          addShake(20);
          SFX.gameOver();
          setTimeout(endGame, 1200);
        }
      }
    }

    // Player vs power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
      if (dist(player, powerUps[i]) < CFG.playerR + CFG.powerUpR + 4) {
        collectPowerUp(powerUps[i], now);
        powerUps.splice(i, 1);
      }
    }
  }

  function killEnemy(index, enemy, now) {
    spawnExplosion(enemy.x, enemy.y, CLR.pink, 10);
    addShake(3); SFX.kill();
    kills++;
    if (now - lastKillTime < 2000) { combo++; } else { combo = 1; }
    lastKillTime = now; comboTimer = 1;
    if (combo > 1) {
      addFloatingText(enemy.x, enemy.y + 5, `${combo}x`, CLR.gold);
      SFX.comboBlip(combo);
      if (combo >= 3) screenPulse = 0.1;
    }
    enemies.splice(index, 1);
    if (Math.random() < CFG.powerUpChance) dropPowerUp(enemy.x, enemy.y);
  }

  // === POWER-UPS ===
  function dropPowerUp(x, y) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerUps.push({ x, y, ...type, born: performance.now(), lifetime: 8000 });
  }

  function collectPowerUp(pu, now) {
    if (pu.type === 'heal') {
      donut.hp = Math.min(donut.hp + 10, donut.maxHp);
      addFloatingText(donut.x, donut.y - donut.visualR - 10, '+10% HP', CLR.mint);
    } else {
      activePowers[pu.type] = now + CFG.powerUpDuration;
    }
    addFloatingText(pu.x, pu.y - 20, pu.label, pu.color);
    spawnExplosion(pu.x, pu.y, pu.color, 8);
    SFX.powerUp();
  }

  function updatePowerUps(now) {
    for (const key of Object.keys(activePowers)) { if (now > activePowers[key]) delete activePowers[key]; }
    for (let i = powerUps.length - 1; i >= 0; i--) { if (now - powerUps[i].born > powerUps[i].lifetime) powerUps.splice(i, 1); }
  }

  function drawPowerUps(ctx, now) {
    for (const p of powerUps) {
      const age = now - p.born, fadeOut = p.lifetime - age < 2000 ? (p.lifetime - age) / 2000 : 1;
      const bob = Math.sin(now / 300) * 4;
      const cx = p.x, cy = p.y + bob;
      ctx.globalAlpha = fadeOut;
      // Glow circle
      glow(ctx, p.color, 12);
      ctx.fillStyle = p.color + '33'; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, CFG.powerUpR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      noGlow(ctx);
      ctx.fillStyle = p.color; ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, cx, cy);
      ctx.font = 'bold 8px "Outfit",sans-serif';
      ctx.globalAlpha = fadeOut * 0.8;
      ctx.fillText(p.label, cx, cy + CFG.powerUpR + 12);
    }
    ctx.globalAlpha = 1; noGlow(ctx);
  }

  // === PARTICLES ===
  function spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i + rand(-0.3, 0.3), s = rand(2, 5);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(1.5, 3.5), color, alpha: 1, life: 1, decay: rand(0.015, 0.035) });
    }
  }

  function spawnHitSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 3);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(1, 2), color, alpha: 0.8, life: 1, decay: rand(0.03, 0.06) });
    }
  }

  function spawnBiteParticles(x, y) {
    // Crumb particles when donut is bitten
    const colors = [CLR.caramel, CLR.pink, CLR.vanilla, '#d4a574'];
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 4);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 4), color: colors[i % colors.length], alpha: 1, life: 1, decay: rand(0.01, 0.025) });
    }
  }

  function updateParticles() {
    if (particles.length > 120) particles.splice(0, particles.length - 120);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay; p.alpha = p.life;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles(ctx) {
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      glow(ctx, p.color, 4); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
    }
    noGlow(ctx); ctx.globalAlpha = 1;
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, alpha: 1, vy: -1.5, life: 1, scale: 1.6 });
  }

  function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i]; f.y += f.vy; f.life -= 0.018; f.alpha = f.life;
      if (f.scale > 1) f.scale = lerp(f.scale, 1, 0.12);
      if (f.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function drawFloatingTexts(ctx) {
    for (const f of floatingTexts) {
      ctx.globalAlpha = f.alpha; ctx.save();
      ctx.translate(f.x, f.y); const s = f.scale || 1; ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
      ctx.font = 'bold 16px "Outfit",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      glow(ctx, f.color, 8); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      noGlow(ctx); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // === VISUAL EFFECTS ===
  function addShake(i) { shake.intensity = Math.max(shake.intensity, i); }
  function updateShake() {
    shake.x = (Math.random() - 0.5) * shake.intensity;
    shake.y = (Math.random() - 0.5) * shake.intensity;
    shake.intensity *= CFG.shakeDecay;
    if (shake.intensity < 0.5) shake.intensity = 0;
  }

  function drawDamageFlash(ctx) {
    if (flashAlpha <= 0) return;
    ctx.globalAlpha = flashAlpha * 0.5;
    ctx.fillStyle = CLR.hot; ctx.fillRect(0, 0, W, H);
    flashAlpha *= 0.90; if (flashAlpha < 0.01) flashAlpha = 0;
  }

  function drawScreenPulse(ctx) {
    if (screenPulse > 0) {
      ctx.globalAlpha = screenPulse; ctx.fillStyle = CLR.white; ctx.fillRect(0, 0, W, H);
      screenPulse *= 0.88; if (screenPulse < 0.01) screenPulse = 0;
    }
  }

  function drawVignette(ctx) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }

  // === SAFE AREA ===
  let safeTop = 0, safeBottom = 0;
  function detectSafeArea() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    safeTop = parseInt(cs.paddingTop) || 0;
    safeBottom = parseInt(cs.paddingBottom) || 0;
    document.body.removeChild(probe);
    if (safeTop < 5 && isMobile) {
      const isStandalone = window.matchMedia('(display-mode:standalone)').matches || window.navigator.standalone;
      if (isStandalone) {
        const h = screen.height, r = window.devicePixelRatio || 1, ph = Math.max(h, screen.width) * r;
        if (ph >= 2556) safeTop = 59; else if (ph >= 2436) safeTop = 47; else if (ph >= 1334) safeTop = 20;
      }
      if (safeBottom < 20) { const has = screen.height >= 812 && window.devicePixelRatio >= 2; if (has) safeBottom = 34; }
    }
  }

  // === HUD ===
  function drawHUD(ctx, now) {
    ctx.globalAlpha = 1; noGlow(ctx);
    const st = safeTop + 8, sb = safeBottom + 8;

    // SURVIVAL TIME (big, center top)
    const timeStr = survivalTime.toFixed(1) + 's';
    ctx.textAlign = 'center';
    glow(ctx, CLR.gold, 8); ctx.fillStyle = CLR.gold;
    ctx.font = 'bold 28px "Outfit",sans-serif';
    ctx.fillText(timeStr, W / 2, st + 36);
    noGlow(ctx);
    ctx.fillStyle = CLR.white; ctx.font = 'bold 10px "Outfit",sans-serif'; ctx.globalAlpha = 0.5;
    ctx.fillText('SURVIVAL TIME', W / 2, st + 14);
    ctx.globalAlpha = 1;

    // Combo — top right
    if (combo > 1) {
      const cx = W - 12, cy = st + 36; ctx.textAlign = 'right';
      if (comboTimer > 0) {
        ctx.globalAlpha = 0.4; ctx.strokeStyle = CLR.pink + '88'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx - 18, cy - 10, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * comboTimer); ctx.stroke();
      }
      ctx.globalAlpha = 1; glow(ctx, CLR.pink, 8); ctx.fillStyle = CLR.pink;
      ctx.font = 'bold 18px "Outfit",sans-serif'; ctx.fillText(`${combo}x`, cx, cy);
      ctx.font = '9px "Outfit",sans-serif'; ctx.globalAlpha = 0.7; ctx.fillText('COMBO', cx, cy + 14);
      noGlow(ctx);
    }

    // Active powers — top left
    let piX = 60; ctx.textAlign = 'left'; ctx.font = 'bold 10px "Outfit",sans-serif';
    for (const [key, expiry] of Object.entries(activePowers)) {
      const remaining = (expiry - now) / CFG.powerUpDuration;
      const pu = POWERUP_TYPES.find(p => p.type === key); if (!pu) continue;
      ctx.globalAlpha = 0.8; glow(ctx, pu.color, 6); ctx.fillStyle = pu.color;
      ctx.fillText(`${pu.icon} ${pu.label}`, piX, st + 58);
      noGlow(ctx); ctx.fillStyle = pu.color + '44'; ctx.fillRect(piX, st + 62, 60, 3);
      ctx.fillStyle = pu.color; ctx.fillRect(piX, st + 62, 60 * remaining, 3); piX += 78;
    }

    // Kills — bottom left
    ctx.globalAlpha = 0.5; ctx.textAlign = 'left'; ctx.fillStyle = CLR.white;
    ctx.font = '9px "Outfit",sans-serif'; ctx.fillText(`HITS: ${kills}`, 16, H - sb - 10);

    ctx.globalAlpha = 1;
  }

  // === DIFFICULTY ===
  function updateDifficulty(dt) {
    survivalTime += dt / 1000;
    difficulty = 1 + Math.floor(survivalTime / 15);

    // Combo decay
    const now = performance.now();
    if (combo > 0 && now - lastKillTime < 2000) { comboTimer = 1 - (now - lastKillTime) / 2000; }
    else { comboTimer = 0; if (now - lastKillTime >= 2000) combo = 0; }

    // Spawn enemies
    spawnInterval = Math.max(CFG.spawnIntervalMin, CFG.spawnIntervalStart - difficulty * 150);
    if (now - lastSpawn > spawnInterval && enemies.length < CFG.maxEnemies) {
      spawnEnemy(); lastSpawn = now;
      // Extra spawns at higher difficulty
      if (difficulty >= 3 && Math.random() < 0.3) spawnEnemy();
      if (difficulty >= 5 && Math.random() < 0.2) spawnEnemy();
    }
  }

  // === GAME OVER ===
  function endGame() {
    active = false;
    cancelAnimationFrame(animFrame);
    const isNew = survivalTime > highScore;
    if (isNew) { highScore = survivalTime; localStorage.setItem('donut_hightime', String(highScore)); }

    const ro = document.getElementById('game-result');
    if (ro) {
      const rs = document.getElementById('result-score');
      const rh = document.getElementById('result-high');
      const rn = document.getElementById('result-new');
      const rk = document.getElementById('result-kills');
      const rw = document.getElementById('result-wave');
      if (rs) rs.textContent = survivalTime.toFixed(1) + 's';
      if (rh) rh.textContent = highScore.toFixed(1) + 's';
      if (rn) rn.style.display = isNew ? 'block' : 'none';
      if (rk) rk.textContent = kills;
      if (rw) rw.textContent = Math.floor(difficulty);
      ro.classList.add('visible');
    }
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.onGameOver(Math.round(survivalTime * 10), Math.floor(difficulty), kills);
    }
  }

  // === MAIN LOOP ===
  function gameLoop(timestamp) {
    if (!active) return;
    const now = performance.now();
    if (now < hitstopUntil) { animFrame = requestAnimationFrame(gameLoop); return; }
    const rawDt = lastTime ? timestamp - lastTime : 16; lastTime = timestamp;
    detectQuality(rawDt);

    updatePlayer(rawDt);
    autoShoot(now);
    updateBullets(now);
    updateEnemies(rawDt, now);
    checkCollisions(now);
    updatePowerUps(now);
    updateParticles();
    updateFloatingTexts();
    updateShake();
    updateDifficulty(rawDt);

    // Draw
    _ctx.save(); _ctx.translate(shake.x, shake.y);
    drawBackground(_ctx, now);
    drawDonut(_ctx, now);
    drawPowerUps(_ctx, now);
    drawBullets(_ctx);
    drawEnemies(_ctx, now);
    drawPlayer(_ctx, now);
    drawParticles(_ctx);
    drawFloatingTexts(_ctx);
    drawDamageFlash(_ctx);
    drawScreenPulse(_ctx);
    drawVignette(_ctx);
    drawHUD(_ctx, now);
    _ctx.restore();

    animFrame = requestAnimationFrame(gameLoop);
  }

  // === INPUT ===
  function onPointerDown(e) { if (!active) return; e.preventDefault(); touching = true; const r = _canvas.getBoundingClientRect(); targetX = e.clientX - r.left; targetY = e.clientY - r.top; }
  function onPointerMove(e) { if (!active || !touching) return; e.preventDefault(); const r = _canvas.getBoundingClientRect(); targetX = e.clientX - r.left; targetY = e.clientY - r.top; }
  function onPointerUp() { touching = false; }

  // === START / STOP / REPLAY ===
  function start(canvas, ctx) {
    _canvas = canvas; _ctx = ctx;
    const dpr = window.devicePixelRatio || 1;
    W = canvas.width / dpr; H = canvas.height / dpr;

    // Load sprites then start
    loadSprites(() => {
      active = true;
      score = 0; kills = 0; combo = 0; lastKillTime = 0; lastShot = 0; lastSpawn = 0; lastTime = 0;
      bullets = []; enemies = []; particles = []; powerUps = []; floatingTexts = [];
      activePowers = {}; shake = { x: 0, y: 0, intensity: 0 };
      flashAlpha = 0; screenPulse = 0; hitstopUntil = 0; comboTimer = 0;
      survivalTime = 0; difficulty = 1;
      spawnInterval = CFG.spawnIntervalStart;

      donut = createDonut();
      player = createPlayer();
      targetX = player.x; targetY = player.y; touching = false;

      detectSafeArea();
      fpsHistory = []; quality = isMobile ? 'MEDIUM' : 'HIGH';
      initStars();
      gameStartTime = performance.now();

      _canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      _canvas.addEventListener('pointermove', onPointerMove, { passive: false });
      _canvas.addEventListener('pointerup', onPointerUp);
      _canvas.addEventListener('pointercancel', onPointerUp);

      const ro = document.getElementById('game-result'); if (ro) ro.classList.remove('visible');
      const nameArea = document.getElementById('lb-name-input-area'); if (nameArea) nameArea.classList.remove('visible');

      animFrame = requestAnimationFrame(gameLoop);
    });
  }

  function stop() {
    active = false; cancelAnimationFrame(animFrame);
    bullets = []; enemies = []; particles = []; powerUps = []; floatingTexts = [];
    if (_canvas) {
      _canvas.removeEventListener('pointerdown', onPointerDown);
      _canvas.removeEventListener('pointermove', onPointerMove);
      _canvas.removeEventListener('pointerup', onPointerUp);
      _canvas.removeEventListener('pointercancel', onPointerUp);
    }
    const ro = document.getElementById('game-result'); if (ro) ro.classList.remove('visible');
  }

  function replay(canvas, ctx) { stop(); start(canvas, ctx); }

  return {
    start, stop, end: endGame, replay,
    get active() { return active; },
    get score() { return survivalTime; },
  };
})();
