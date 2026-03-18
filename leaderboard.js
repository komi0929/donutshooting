/* ======================================
   Honey Island Defense — Leaderboard v2
   30s game, score-based ranking
   ====================================== */
const Leaderboard = (() => {
  'use strict';
  const SUPABASE_URL = 'https://mounixlvppmueddrdbxc.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdW5peGx2cHBtdWVkZHJkYnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjE0MzMsImV4cCI6MjA4OTAzNzQzM30.Q8m649yPOJzgHqofe89NJ9199fj0FNieST5uvaJbRIQ';
  let db = null, currentTab = 'alltime', lastScore = 0;

  function init() {
    if (db) return;
    if (typeof supabase === 'undefined') return;
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  async function fetchTop10() {
    init(); if (!db) return [];
    const { data, error } = await db.from('leaderboard').select('*').order('score', { ascending: false }).limit(10);
    return error ? [] : data;
  }
  async function fetchTodayTop10() {
    init(); if (!db) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data, error } = await db.from('leaderboard').select('*').gte('created_at', today.toISOString()).order('score', { ascending: false }).limit(10);
    return error ? [] : data;
  }
  async function isTop10(score) {
    init(); if (!db) return true;
    const { data, error } = await db.from('leaderboard').select('score').order('score', { ascending: false }).limit(10);
    if (error || !data) return true;
    return data.length < 10 || score > data[data.length - 1].score;
  }
  async function submit(name, score, wave, hits) {
    init(); if (!db) return null;
    const { data, error } = await db.from('leaderboard').insert([{ name, score, wave, hits }]).select();
    return error ? null : data;
  }

  function showPanel() {
    const p = document.getElementById('leaderboard-panel');
    if (p) { p.classList.add('visible'); refreshBoard(); }
  }
  function hidePanel() {
    const p = document.getElementById('leaderboard-panel');
    if (p) p.classList.remove('visible');
  }
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    refreshBoard();
  }

  async function refreshBoard() {
    const list = document.getElementById('lb-list');
    if (!list) return;
    list.innerHTML = '<div class="lb-loading">読み込み中...</div>';
    const data = currentTab === 'today' ? await fetchTodayTop10() : await fetchTop10();
    if (!data || data.length === 0) {
      list.innerHTML = '<div class="lb-loading">まだ記録がありません</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = data.map((row, i) => {
      const rank = i < 3 ? medals[i] : `${i + 1}`;
      const isMe = row.score === lastScore;
      const date = new Date(row.created_at);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      return `<div class="lb-card${isMe ? ' lb-me' : ''}${i < 3 ? ' lb-top' : ''}">
        <span class="lb-card-rank${i < 3 ? ` lb-rank-${i + 1}` : ''}">${rank}</span>
        <div class="lb-card-info">
          <span class="lb-card-name">${escapeHtml(row.name)}</span>
          <span class="lb-card-date">${dateStr}</span>
        </div>
        <div class="lb-card-score">
          <span class="lb-card-pts">${row.score}</span>
          <span class="lb-card-sub">🐝${row.wave || 0} 🍩${row.hits || 0}</span>
        </div>
      </div>`;
    }).join('');
  }

  function escapeHtml(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  }

  async function onGameOver(score, beesRepelled, donutsCollected) {
    lastScore = score;
    const nameInput = document.getElementById('lb-name-input-area');
    if (!nameInput) return;
    const qualified = await isTop10(score);
    if (qualified && score > 0) {
      nameInput.classList.add('visible');
      const input = document.getElementById('lb-name');
      if (input) { input.value = ''; input.focus(); }
    } else {
      nameInput.classList.remove('visible');
    }
  }

  async function submitFromUI() {
    const input = document.getElementById('lb-name');
    const btn = document.getElementById('lb-submit-btn');
    if (!input || !btn) return;
    const name = input.value.trim();
    if (!name || name.length < 1 || name.length > 8) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      return;
    }
    btn.disabled = true; btn.textContent = '送信中...';
    const scoreEl = document.getElementById('result-score');
    const beesEl = document.getElementById('result-bees');
    const donutsEl = document.getElementById('result-donuts');
    const score = parseInt(scoreEl?.textContent || '0', 10);
    const bees = parseInt(beesEl?.textContent || '0', 10);
    const donuts = parseInt(donutsEl?.textContent || '0', 10);
    // wave = bees repelled, hits = donuts collected
    await submit(name, score, bees, donuts);
    btn.textContent = '登録完了！';
    const nameArea = document.getElementById('lb-name-input-area');
    if (nameArea) setTimeout(() => { nameArea.classList.remove('visible'); showPanel(); }, 600);
  }

  function bindEvents() {
    document.querySelectorAll('.lb-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    const submitBtn = document.getElementById('lb-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', submitFromUI);
    const nameInput = document.getElementById('lb-name');
    if (nameInput) nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFromUI(); });
    const closeBtn = document.getElementById('lb-close');
    if (closeBtn) closeBtn.addEventListener('click', hidePanel);
    const rankBtn = document.getElementById('game-ranking-btn');
    if (rankBtn) rankBtn.addEventListener('click', showPanel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindEvents);
  else bindEvents();

  return { fetchTop10, fetchTodayTop10, isTop10, submit, showPanel, hidePanel, onGameOver, refreshBoard };
})();
