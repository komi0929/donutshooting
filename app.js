/* ======================================
   Honey Island Defense — App Controller
   Title Screen → Game → Result loop
   ====================================== */

(() => {
  'use strict';

  const container = document.getElementById('game-container');
  const overlay   = document.getElementById('transition-overlay');

  // ── Title Screen ────────────────────
  const titleScreen = document.getElementById('title-screen');
  const titleStart  = document.getElementById('title-start');
  const titleHigh   = document.getElementById('title-high');

  function showTitle() {
    document.body.classList.remove('game-active');
    if (titleScreen) titleScreen.classList.add('visible');
  }

  function hideTitle() {
    if (titleScreen) titleScreen.classList.remove('visible');
  }

  function startGame() {
    hideTitle();
    document.body.classList.add('game-active');
    if (typeof GameEngine !== 'undefined') {
      GameEngine.start(container);
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
      if (typeof GameEngine !== 'undefined') GameEngine.replay(container);
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
      showTitle();
    }, { passive: false });
  }

  // ── Init ────────────────────────────
  function init() {
    // Prevent default touch behaviors
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
