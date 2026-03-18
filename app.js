/* ======================================
   ドーナツシューティング — App Controller
   Title Screen → Game → Result loop
   ====================================== */

(() => {
  'use strict';

  const canvas  = document.getElementById('canvas');
  const ctx     = canvas.getContext('2d');
  const overlay = document.getElementById('transition-overlay');

  // ── Helpers ──────────────────────────
  const _dpr = () => window.devicePixelRatio || 1;

  function resize() {
    const r = _dpr();
    canvas.width  = innerWidth  * r;
    canvas.height = innerHeight * r;
    canvas.style.width  = innerWidth  + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }

  function clear() {
    const r = _dpr();
    ctx.clearRect(0, 0, canvas.width / r, canvas.height / r);
  }

  // ── Title Screen ────────────────────
  const titleScreen = document.getElementById('title-screen');
  const titleStart  = document.getElementById('title-start');
  const titleHigh   = document.getElementById('title-high');

  function showTitle() {
    clear();
    document.body.classList.remove('game-active');
    if (titleScreen) titleScreen.classList.add('visible');
    // Show high score
    const hs = parseInt(localStorage.getItem('cyber_highscore') || '0', 10);
    if (titleHigh) titleHigh.textContent = hs.toLocaleString();
  }

  function hideTitle() {
    if (titleScreen) titleScreen.classList.remove('visible');
  }

  function startGame() {
    hideTitle();
    document.body.classList.add('game-active');
    clear();
    if (typeof GameEngine !== 'undefined') {
      GameEngine.start(canvas, ctx);
    }
  }

  // ── Event Handlers ──────────────────

  // Title start button
  if (titleStart) {
    titleStart.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startGame();
    }, { passive: false });
  }

  // Game replay button
  const replayBtn = document.getElementById('game-replay');
  if (replayBtn) {
    replayBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof GameEngine !== 'undefined') GameEngine.replay(canvas, ctx);
    }, { passive: false });
  }

  // Game exit button (result screen)
  const exitBtn = document.getElementById('game-exit');
  if (exitBtn) {
    exitBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof GameEngine !== 'undefined') GameEngine.stop();
      document.body.classList.remove('game-active');
      clear();
      showTitle();
    }, { passive: false });
  }

  // In-game exit button
  const exitIngame = document.getElementById('game-exit-ingame');
  if (exitIngame) {
    exitIngame.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof GameEngine !== 'undefined') GameEngine.stop();
      document.body.classList.remove('game-active');
      clear();
      showTitle();
    }, { passive: false });
  }

  // ── Init ────────────────────────────
  function init() {
    resize();
    addEventListener('resize', resize);

    // Prevent default touch behaviors
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) e.preventDefault();
    }, { passive: false });

    // Show title screen on load
    showTitle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
