/* HONEY ISLAND DEFENSE — 3D Voxel Engine (Three.js) */
const GameEngine = (() => {
  'use strict';

  // === CONFIG ===
  const CFG = {
    honeyHP: 100,
    playerSpeed: 0.12,
    shootInterval: 280,
    windSpeed: 0.35,
    windPush: 3.5,
    spawnStart: 2200,
    spawnMin: 400,
    maxBees: 25,
    donutInterval: 5000,   // spawn donut every 5s
    donutPoints: 100,
    beePoints: 10,
    survivalPtsPerSec: 5,
    blastCharge: 3,        // donuts needed for 360 blast
    survivalGate: 30,      // 30s to qualify for ranking
  };

  // SFX
  const SFX = (() => {
    let ac = null, m = null;
    function e() { if (ac) return 1; try { ac = new (window.AudioContext || window.webkitAudioContext)(); m = ac.createGain(); m.gain.value = 0.2; m.connect(ac.destination); return 1; } catch (e) { return 0; } }
    function g(v) { const gn = ac.createGain(); gn.gain.value = v; gn.connect(m); return gn; }
    function puff() { if (!e()) return; const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * .08, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / d.length); const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800; const gn = g(.12); s.connect(f); f.connect(gn); gn.gain.exponentialRampToValueAtTime(.001, t + .1); s.start(t); }
    function buzz() { if (!e()) return; const t = ac.currentTime, o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(120, t + .2); const gn = g(.06); gn.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(gn); o.start(t); o.stop(t + .25); }
    function steal() { if (!e()) return; const t = ac.currentTime, o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(200, t + .3); const gn = g(.12); gn.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(gn); o.start(t); o.stop(t + .35); }
    function pickup() { if (!e()) return; const t = ac.currentTime; [523, 659, 784].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gn = g(.1); gn.gain.setValueAtTime(.001, t + i * .08); gn.gain.linearRampToValueAtTime(.1, t + i * .08 + .03); gn.gain.exponentialRampToValueAtTime(.001, t + i * .08 + .15); o.connect(gn); o.start(t + i * .08); o.stop(t + i * .08 + .2); }); }
    function blast() { if (!e()) return; const t = ac.currentTime; const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(400, t + .15); o.frequency.exponentialRampToValueAtTime(80, t + .4); const gn = g(.15); gn.gain.exponentialRampToValueAtTime(.001, t + .5); o.connect(gn); o.start(t); o.stop(t + .5); const n = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const nd = n.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length); const ns = ac.createBufferSource(); ns.buffer = n; const ng = g(.08); ns.connect(ng); ng.gain.exponentialRampToValueAtTime(.001, t + .35); ns.start(t); }
    function gameOver() { if (!e()) return; const t = ac.currentTime; [330, 262, 196].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gn = g(.15); gn.gain.setValueAtTime(.001, t + i * .3); gn.gain.linearRampToValueAtTime(.15, t + i * .3 + .05); gn.gain.exponentialRampToValueAtTime(.001, t + i * .3 + .5); o.connect(gn); o.start(t + i * .3); o.stop(t + i * .3 + .55); }); }
    return { puff, buzz, steal, pickup, blast, gameOver };
  })();

  // STATE
  let active = false, af, lt = 0;
  let scene, camera, renderer, clock;
  let islandGroup, honeyMesh, playerGroup, oceanMesh;
  let beeObjects = [], windObjects = [], donutObjects = [], particleObjects = [];
  let clouds = [];
  let player = null, touching = false, tx = 0, ty = 0;
  let lastShot = 0, lastSpawn = 0, lastDonut = 0;
  let honey = null, survTime = 0, diff = 1, score = 0;
  let blastGauge = 0, blastReady = false;
  let highScore = parseInt(localStorage.getItem('honey_highscore') || '0');
  let raycaster, pointer;
  let groundPlane;
  let palmTree;
  let containerEl;

  // HELPERS
  const rand = (a, b) => a + Math.random() * (b - a);
  const clp = (v, l, h) => v < l ? l : v > h ? h : v;

  // === MATERIALS ===
  const MAT = {};
  function initMaterials() {
    MAT.grass = new THREE.MeshLambertMaterial({ color: 0x6ab04c });
    MAT.grassDark = new THREE.MeshLambertMaterial({ color: 0x4a8a2c });
    MAT.dirt = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    MAT.dirtDark = new THREE.MeshLambertMaterial({ color: 0x6b4f10 });
    MAT.sand = new THREE.MeshLambertMaterial({ color: 0xf5deb3 });
    MAT.sandWet = new THREE.MeshLambertMaterial({ color: 0xd4b896 });
    MAT.wood = new THREE.MeshLambertMaterial({ color: 0x6b4f10 });
    MAT.leaf = new THREE.MeshLambertMaterial({ color: 0x4a8a2c, side: THREE.DoubleSide });
    MAT.honeyPot = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    MAT.honeyLiquid = new THREE.MeshLambertMaterial({ color: 0xFFD700, transparent: true, opacity: 0.85 });
    MAT.honeyRim = new THREE.MeshLambertMaterial({ color: 0x9B7B2C });
    MAT.bear = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    MAT.bearBelly = new THREE.MeshLambertMaterial({ color: 0xD2B48C });
    MAT.bearNose = new THREE.MeshLambertMaterial({ color: 0x222222 });
    MAT.bearEye = new THREE.MeshLambertMaterial({ color: 0x111111 });
    MAT.bearEyeWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
    MAT.bee = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    MAT.beeStripe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    MAT.beeWing = new THREE.MeshLambertMaterial({ color: 0xc8e6ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    MAT.beeEye = new THREE.MeshLambertMaterial({ color: 0x111111 });
    MAT.cloud = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    MAT.ocean = new THREE.MeshLambertMaterial({ color: 0x1a8ab0, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    MAT.donutDough = new THREE.MeshLambertMaterial({ color: 0xf5c77e });
    MAT.donutIcing = new THREE.MeshLambertMaterial({ color: 0xff8fab });
    MAT.donutIcingChoco = new THREE.MeshLambertMaterial({ color: 0x5c3317 });
    MAT.donutIcingMint = new THREE.MeshLambertMaterial({ color: 0xa8e6cf });
    MAT.flower1 = new THREE.MeshLambertMaterial({ color: 0xff8fab });
    MAT.flower2 = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    MAT.flower3 = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    MAT.windPuff = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    MAT.blastRing = new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  }

  // === VOXEL ISLAND ===
  function createIsland() {
    islandGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // Layer definitions: y-level, radius, material, offset
    const layers = [
      { y: -2, r: 5.5, mat: MAT.sandWet, noise: 0.8 },
      { y: -1, r: 5, mat: MAT.sand, noise: 0.6 },
      { y: 0, r: 4.2, mat: MAT.dirt, noise: 0.5 },
      { y: 1, r: 3.5, mat: MAT.grassDark, noise: 0.4 },
      { y: 2, r: 2.8, mat: MAT.grass, noise: 0.3 },
    ];

    for (const layer of layers) {
      for (let x = -6; x <= 6; x++) {
        for (let z = -6; z <= 6; z++) {
          const dist = Math.sqrt(x * x + z * z);
          const noisyR = layer.r + Math.sin(x * 1.3 + z * 0.7) * layer.noise + Math.cos(x * 0.5 + z * 1.7) * layer.noise * 0.5;
          if (dist <= noisyR) {
            const block = new THREE.Mesh(boxGeo, layer.mat);
            block.position.set(x, layer.y, z);
            block.castShadow = true;
            block.receiveShadow = true;
            islandGroup.add(block);
          }
        }
      }
    }

    // Top grass layer with some variation
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist <= 2.5 + Math.sin(x + z) * 0.3) {
          const top = new THREE.Mesh(boxGeo, MAT.grass);
          top.position.set(x, 3, z);
          top.castShadow = true;
          top.receiveShadow = true;
          islandGroup.add(top);
        }
      }
    }

    // Flowers on top
    const flowerGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const flowerMats = [MAT.flower1, MAT.flower2, MAT.flower3];
    const flowerPos = [[-1.5, 3.3, -1], [0.5, 3.3, -1.5], [1, 3.3, 0.5], [-0.5, 3.3, 1.5]];
    for (let i = 0; i < flowerPos.length; i++) {
      const f = new THREE.Mesh(flowerGeo, flowerMats[i % 3]);
      f.position.set(...flowerPos[i]);
      islandGroup.add(f);
    }

    scene.add(islandGroup);
    return islandGroup;
  }

  // === PALM TREE ===
  function createPalmTree() {
    palmTree = new THREE.Group();
    // Trunk — stacked boxes
    const trunkGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(trunkGeo, MAT.wood);
      seg.position.set(0, i + 0.5, 0);
      seg.rotation.y = i * 0.15;
      seg.castShadow = true;
      palmTree.add(seg);
    }
    // Leaves — flat boxes
    const leafGeo = new THREE.BoxGeometry(2.5, 0.15, 0.8);
    const leafAngles = [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
    for (const a of leafAngles) {
      const leaf = new THREE.Mesh(leafGeo, MAT.leaf);
      leaf.position.set(Math.cos(a) * 1.2, 5.2, Math.sin(a) * 1.2);
      leaf.rotation.y = a;
      leaf.rotation.z = 0.4;
      leaf.castShadow = true;
      palmTree.add(leaf);
    }
    palmTree.position.set(2, 2, -1);
    scene.add(palmTree);
  }

  // === HONEY POT ===
  function createHoneyPot() {
    const group = new THREE.Group();
    // Pot body — cylinder
    const potGeo = new THREE.CylinderGeometry(0.7, 0.8, 1.5, 8);
    const pot = new THREE.Mesh(potGeo, MAT.honeyPot);
    pot.position.y = 0.75;
    pot.castShadow = true;
    group.add(pot);
    // Rim
    const rimGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.2, 8);
    const rim = new THREE.Mesh(rimGeo, MAT.honeyRim);
    rim.position.y = 1.5;
    group.add(rim);
    // Honey liquid inside (visible from top)
    const honeyGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.1, 8);
    const honeyLiq = new THREE.Mesh(honeyGeo, MAT.honeyLiquid);
    honeyLiq.position.y = 1.4;
    honeyLiq.name = 'honeyLevel';
    group.add(honeyLiq);
    // Label — small box
    const labelGeo = new THREE.BoxGeometry(0.6, 0.3, 0.05);
    const labelMat = new THREE.MeshLambertMaterial({ color: 0xfff8dc });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 0.8, 0.82);
    group.add(label);

    group.position.set(0, 3, 0);
    honeyMesh = group;
    scene.add(group);
    return group;
  }

  // === PLAYER (Voxel Bear Cub) ===
  function createPlayerModel() {
    playerGroup = new THREE.Group();
    const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    // Body
    const body = box(1.2, 1, 1, MAT.bear);
    body.position.y = 0.5;
    body.castShadow = true;
    playerGroup.add(body);
    // Belly
    const belly = box(0.8, 0.6, 0.3, MAT.bearBelly);
    belly.position.set(0, 0.45, 0.4);
    playerGroup.add(belly);
    // Head
    const head = box(1, 0.8, 0.9, MAT.bear);
    head.position.y = 1.4;
    head.castShadow = true;
    playerGroup.add(head);
    // Ears
    const earGeo = new THREE.BoxGeometry(0.35, 0.35, 0.3);
    const earL = new THREE.Mesh(earGeo, MAT.bear);
    earL.position.set(-0.45, 1.9, 0);
    playerGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, MAT.bear);
    earR.position.set(0.45, 1.9, 0);
    playerGroup.add(earR);
    // Inner ears
    const iEarGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const iEarL = new THREE.Mesh(iEarGeo, MAT.bearBelly);
    iEarL.position.set(-0.45, 1.9, 0.15);
    playerGroup.add(iEarL);
    const iEarR = new THREE.Mesh(iEarGeo, MAT.bearBelly);
    iEarR.position.set(0.45, 1.9, 0.15);
    playerGroup.add(iEarR);
    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
    const eyeL = new THREE.Mesh(eyeGeo, MAT.bearEye);
    eyeL.position.set(-0.22, 1.5, 0.46);
    playerGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, MAT.bearEye);
    eyeR.position.set(0.22, 1.5, 0.46);
    playerGroup.add(eyeR);
    // Eye whites
    const ewGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const ewL = new THREE.Mesh(ewGeo, MAT.bearEyeWhite);
    ewL.position.set(-0.18, 1.53, 0.5);
    playerGroup.add(ewL);
    const ewR = new THREE.Mesh(ewGeo, MAT.bearEyeWhite);
    ewR.position.set(0.26, 1.53, 0.5);
    playerGroup.add(ewR);
    // Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.15), MAT.bearNose);
    nose.position.set(0, 1.35, 0.5);
    playerGroup.add(nose);
    // Blush
    const blushGeo = new THREE.BoxGeometry(0.2, 0.1, 0.05);
    const blushMat = new THREE.MeshLambertMaterial({ color: 0xff8fab, transparent: true, opacity: 0.5 });
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.4, 1.35, 0.46);
    playerGroup.add(blushL);
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.4, 1.35, 0.46);
    playerGroup.add(blushR);
    // Legs
    const legGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35);
    const legL = new THREE.Mesh(legGeo, MAT.bear);
    legL.position.set(-0.3, -0.1, 0);
    playerGroup.add(legL);
    const legR = new THREE.Mesh(legGeo, MAT.bear);
    legR.position.set(0.3, -0.1, 0);
    playerGroup.add(legR);

    playerGroup.position.set(-2, 3.5, 1);
    scene.add(playerGroup);
  }

  // === BEE MODEL ===
  function createBeeModel() {
    const group = new THREE.Group();
    const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    // Body
    const body = box(0.5, 0.5, 0.8, MAT.bee);
    group.add(body);
    // Stripes
    const s1 = box(0.52, 0.15, 0.82, MAT.beeStripe);
    s1.position.y = 0.1;
    group.add(s1);
    const s2 = box(0.52, 0.15, 0.82, MAT.beeStripe);
    s2.position.y = -0.1;
    group.add(s2);
    // Head
    const head = box(0.4, 0.4, 0.35, MAT.bee);
    head.position.z = 0.55;
    group.add(head);
    // Eyes
    const eye1 = box(0.1, 0.1, 0.05, MAT.beeEye);
    eye1.position.set(-0.12, 0.08, 0.75);
    group.add(eye1);
    const eye2 = box(0.1, 0.1, 0.05, MAT.beeEye);
    eye2.position.set(0.12, 0.08, 0.75);
    group.add(eye2);
    // Wings
    const wingGeo = new THREE.BoxGeometry(0.6, 0.05, 0.4);
    const wingL = new THREE.Mesh(wingGeo, MAT.beeWing);
    wingL.position.set(-0.4, 0.3, 0.1);
    wingL.rotation.z = 0.3;
    wingL.name = 'wingL';
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, MAT.beeWing);
    wingR.position.set(0.4, 0.3, 0.1);
    wingR.rotation.z = -0.3;
    wingR.name = 'wingR';
    group.add(wingR);
    // Stinger
    const stinger = box(0.1, 0.1, 0.25, MAT.beeStripe);
    stinger.position.z = -0.5;
    group.add(stinger);
    // Antennae
    const antGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
    const antL = new THREE.Mesh(antGeo, MAT.beeStripe);
    antL.position.set(-0.1, 0.35, 0.6);
    antL.rotation.z = 0.3;
    group.add(antL);
    const antR = new THREE.Mesh(antGeo, MAT.beeStripe);
    antR.position.set(0.1, 0.35, 0.6);
    antR.rotation.z = -0.3;
    group.add(antR);

    group.scale.set(0.8, 0.8, 0.8);
    return group;
  }

  // === DONUT ===
  function createDonutModel() {
    const group = new THREE.Group();
    // Torus-like shape from boxes
    const icings = [MAT.donutIcing, MAT.donutIcingChoco, MAT.donutIcingMint];
    const icingMat = icings[Math.floor(Math.random() * icings.length)];
    // Ring of boxes
    const segGeo = new THREE.BoxGeometry(0.3, 0.25, 0.3);
    const topGeo = new THREE.BoxGeometry(0.32, 0.08, 0.32);
    const ringR = 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const seg = new THREE.Mesh(segGeo, MAT.donutDough);
      seg.position.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
      seg.rotation.y = -a;
      seg.castShadow = true;
      group.add(seg);
      // Icing on top
      const top = new THREE.Mesh(topGeo, icingMat);
      top.position.set(Math.cos(a) * ringR, 0.15, Math.sin(a) * ringR);
      top.rotation.y = -a;
      group.add(top);
    }
    group.scale.set(0.9, 0.9, 0.9);
    return group;
  }

  // === CLOUDS ===
  function createClouds() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudDefs = [
      { x: -12, y: 12, z: -8, blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0.5, 1, 0], [1.5, 1, 0], [1, 0, 1]] },
      { x: 10, y: 14, z: -12, blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [0.5, 1, 0], [1.5, 1, 0], [2.5, 1, 0]] },
      { x: -5, y: 11, z: 15, blocks: [[0, 0, 0], [1, 0, 0], [0.5, 1, 0], [0, 0, 1], [1, 0, 1]] },
      { x: 15, y: 13, z: 5, blocks: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]] },
    ];
    for (const cd of cloudDefs) {
      const cg = new THREE.Group();
      for (const b of cd.blocks) {
        const block = new THREE.Mesh(boxGeo, MAT.cloud);
        block.position.set(b[0], b[1], b[2]);
        cg.add(block);
      }
      cg.position.set(cd.x, cd.y, cd.z);
      cg.userData = { baseX: cd.x, speed: rand(0.003, 0.008) };
      scene.add(cg);
      clouds.push(cg);
    }
  }

  // === OCEAN ===
  function createOcean() {
    const geo = new THREE.PlaneGeometry(80, 80, 40, 40);
    oceanMesh = new THREE.Mesh(geo, MAT.ocean);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.y = -2.5;
    oceanMesh.receiveShadow = true;
    scene.add(oceanMesh);
  }

  function animateOcean(time) {
    if (!oceanMesh) return;
    const pos = oceanMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i); // it's Y in geometry space = Z in world
      const wave = Math.sin(x * 0.3 + time * 1.5) * 0.3 +
        Math.sin(z * 0.4 + time * 1.2) * 0.2 +
        Math.sin((x + z) * 0.2 + time * 0.8) * 0.15;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
  }

  // === SCENE SETUP ===
  function initScene(container) {
    containerEl = container;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 14, 16);
    camera.lookAt(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    renderer.domElement.style.touchAction = 'none';

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    dirLight.position.set(8, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    scene.add(dirLight);

    // Hemisphere for sky color
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x1a6b8a, 0.3);
    scene.add(hemi);

    // Raycaster for input
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3.5);

    clock = new THREE.Clock();
    initMaterials();
  }

  // === INPUT ===
  function getWorldPos(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, target);
    return target;
  }

  function onPD(e) {
    if (!active) return;
    e.preventDefault();
    touching = true;
    const pos = getWorldPos(e.clientX, e.clientY);
    if (pos) { tx = pos.x; ty = pos.z; }
  }
  function onPM(e) {
    if (!active || !touching) return;
    e.preventDefault();
    const pos = getWorldPos(e.clientX, e.clientY);
    if (pos) { tx = pos.x; ty = pos.z; }
  }
  function onPU() { touching = false; }

  // === GAME LOGIC ===
  function updatePlayer(dt) {
    if (!player.alive || !playerGroup) return;
    if (touching) {
      const dx = tx - playerGroup.position.x;
      const dz = ty - playerGroup.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.2) {
        const m = Math.min(CFG.playerSpeed * dt * 60, d * 0.15);
        playerGroup.position.x += (dx / d) * m;
        playerGroup.position.z += (dz / d) * m;
        // Face direction
        playerGroup.rotation.y = Math.atan2(dx, dz);
      }
    }
    // Clamp to island area
    playerGroup.position.x = clp(playerGroup.position.x, -4, 4);
    playerGroup.position.z = clp(playerGroup.position.z, -4, 4);
    // Bobbing
    playerGroup.position.y = 3.5 + Math.sin(performance.now() / 500) * 0.1;
  }

  function autoShoot(now) {
    if (!player.alive || now - lastShot < CFG.shootInterval) return;
    if (beeObjects.length === 0) return;
    lastShot = now;

    // Find nearest bee
    let nearest = null, nd = Infinity;
    for (const b of beeObjects) {
      const dx = b.mesh.position.x - playerGroup.position.x;
      const dz = b.mesh.position.z - playerGroup.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nd) { nd = d; nearest = b; }
    }
    if (!nearest) return;

    const dx = nearest.mesh.position.x - playerGroup.position.x;
    const dz = nearest.mesh.position.z - playerGroup.position.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;

    // Create wind puff
    const puffGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const puff = new THREE.Mesh(puffGeo, MAT.windPuff.clone());
    puff.position.copy(playerGroup.position);
    puff.position.y += 0.8;
    scene.add(puff);

    windObjects.push({
      mesh: puff,
      vx: (dx / d) * CFG.windSpeed,
      vz: (dz / d) * CFG.windSpeed,
      born: now,
      life: 1,
    });
    SFX.puff();
  }

  function updateWinds(dt, now) {
    for (let i = windObjects.length - 1; i >= 0; i--) {
      const w = windObjects[i];
      w.mesh.position.x += w.vx * dt * 60;
      w.mesh.position.z += w.vz * dt * 60;
      w.mesh.scale.multiplyScalar(1.02);
      w.life -= 0.015 * dt * 60;
      w.mesh.material.opacity = w.life * 0.5;

      if (w.life <= 0 || now - w.born > 2000) {
        scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        windObjects.splice(i, 1);
      }
    }
  }

  // === BEES ===
  function spawnBee() {
    const speedMult = 1 + diff * 0.05;
    const angle = rand(0, Math.PI * 2);
    const dist = rand(14, 18);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = rand(4, 7);

    const mesh = createBeeModel();
    mesh.position.set(x, y, z);
    scene.add(mesh);

    beeObjects.push({
      mesh,
      speed: rand(0.03, 0.06) * speedMult,
      phase: rand(0, Math.PI * 2),
      knockVx: 0, knockVz: 0,
      stunTime: 0,
      dmg: rand(2, 4),
      targetY: rand(4, 6),
    });
  }

  function updateBees(dt, now) {
    for (const b of beeObjects) {
      // Wing animation
      const wingL = b.mesh.getObjectByName('wingL');
      const wingR = b.mesh.getObjectByName('wingR');
      if (wingL) wingL.rotation.z = 0.3 + Math.sin(now / 40 + b.phase) * 0.5;
      if (wingR) wingR.rotation.z = -0.3 - Math.sin(now / 40 + b.phase) * 0.5;

      if (b.stunTime > 0) {
        b.stunTime -= dt * 1000;
        b.mesh.position.x += b.knockVx * dt * 60;
        b.mesh.position.z += b.knockVz * dt * 60;
        b.knockVx *= 0.92;
        b.knockVz *= 0.92;
        // Spin when stunned
        b.mesh.rotation.z = Math.sin(now / 100) * 0.5;
        continue;
      }

      b.mesh.rotation.z = 0;
      // Move toward honey pot (center)
      const tx = 0, tz = 0;
      const dx = tx - b.mesh.position.x;
      const dz = tz - b.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.5) {
        const wobX = Math.sin(now / 400 + b.phase) * 0.02;
        const wobZ = Math.cos(now / 350 + b.phase) * 0.015;
        b.mesh.position.x += (dx / d) * b.speed * dt * 60 + wobX;
        b.mesh.position.z += (dz / d) * b.speed * dt * 60 + wobZ;
        // Face direction
        b.mesh.rotation.y = Math.atan2(dx, dz);
      }
      // Vertical wobble
      b.mesh.position.y = b.targetY + Math.sin(now / 600 + b.phase) * 0.3;
    }
  }

  // === DONUTS ===
  function spawnDonut() {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(2, 5);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const mesh = createDonutModel();
    mesh.position.set(x, 4.5, z);
    scene.add(mesh);

    donutObjects.push({
      mesh,
      life: 10000, // 10 seconds to collect
      born: performance.now(),
    });
  }

  function updateDonuts(dt, now) {
    for (let i = donutObjects.length - 1; i >= 0; i--) {
      const d = donutObjects[i];
      // Spin and bob
      d.mesh.rotation.y += 0.02 * dt * 60;
      d.mesh.position.y = 4.5 + Math.sin(now / 500 + i) * 0.3;

      // Check player collection
      if (playerGroup) {
        const dx = d.mesh.position.x - playerGroup.position.x;
        const dz = d.mesh.position.z - playerGroup.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1.5) {
          // Collected!
          score += CFG.donutPoints;
          blastGauge = Math.min(blastGauge + 1, CFG.blastCharge);
          if (blastGauge >= CFG.blastCharge) blastReady = true;
          updateHUD();
          SFX.pickup();
          scene.remove(d.mesh);
          donutObjects.splice(i, 1);
          continue;
        }
      }

      // Timeout
      if (now - d.born > d.life) {
        scene.remove(d.mesh);
        donutObjects.splice(i, 1);
      }
    }
  }

  // === 360 BLAST ===
  function triggerBlast() {
    if (!blastReady || !playerGroup) return;
    blastReady = false;
    blastGauge = 0;
    updateHUD();
    SFX.blast();

    // Visual ring
    const ringGeo = new THREE.RingGeometry(0.5, 1, 24);
    const ring = new THREE.Mesh(ringGeo, MAT.blastRing.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(playerGroup.position);
    ring.position.y += 1;
    scene.add(ring);

    const blastData = { mesh: ring, scale: 1, life: 1 };
    particleObjects.push(blastData);

    // Push ALL bees away
    for (const b of beeObjects) {
      const dx = b.mesh.position.x - playerGroup.position.x;
      const dz = b.mesh.position.z - playerGroup.position.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const force = Math.max(1, 8 / d);
      b.knockVx = (dx / d) * force * 0.5;
      b.knockVz = (dz / d) * force * 0.5;
      b.stunTime = 800;
      score += CFG.beePoints;
    }
    updateHUD();
  }

  function updateParticles(dt) {
    for (let i = particleObjects.length - 1; i >= 0; i--) {
      const p = particleObjects[i];
      p.scale += 0.3 * dt * 60;
      p.life -= 0.03 * dt * 60;
      p.mesh.scale.set(p.scale, p.scale, p.scale);
      p.mesh.material.opacity = p.life * 0.4;

      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particleObjects.splice(i, 1);
      }
    }
  }

  // === COLLISIONS ===
  function checkCollisions(now) {
    // Winds push bees
    for (let wi = windObjects.length - 1; wi >= 0; wi--) {
      const w = windObjects[wi];
      for (const b of beeObjects) {
        const dx = b.mesh.position.x - w.mesh.position.x;
        const dz = b.mesh.position.z - w.mesh.position.z;
        const dy = b.mesh.position.y - w.mesh.position.y;
        const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
        if (dist < 1.5) {
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          b.knockVx = (dx / d) * CFG.windPush * 0.15;
          b.knockVz = (dz / d) * CFG.windPush * 0.15;
          b.stunTime = 500;
          score += CFG.beePoints;
          updateHUD();
          SFX.buzz();
          scene.remove(w.mesh);
          w.mesh.geometry.dispose();
          w.mesh.material.dispose();
          windObjects.splice(wi, 1);
          break;
        }
      }
    }

    // Bees reach honey
    for (let i = beeObjects.length - 1; i >= 0; i--) {
      const b = beeObjects[i];
      if (b.stunTime > 0) continue;
      const dx = b.mesh.position.x;
      const dz = b.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.8 && b.mesh.position.y < 5.5) {
        honey.hp = Math.max(0, honey.hp - b.dmg);
        updateHUD();
        SFX.steal();
        // Remove this bee (it ate some honey and leaves)
        scene.remove(b.mesh);
        beeObjects.splice(i, 1);
        if (honey.hp <= 0) {
          honey.hp = 0;
          SFX.gameOver();
          setTimeout(endGame, 1200);
        }
      }
    }

    // Remove bees that got knocked too far away
    for (let i = beeObjects.length - 1; i >= 0; i--) {
      const b = beeObjects[i];
      const dx = b.mesh.position.x;
      const dz = b.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 25) {
        scene.remove(b.mesh);
        beeObjects.splice(i, 1);
      }
    }
  }

  // === HUD ===
  function updateHUD() {
    const scoreEl = document.getElementById('hud-score');
    const timeEl = document.getElementById('hud-time');
    const gaugeEl = document.getElementById('hud-gauge-fill');
    const blastBtn = document.getElementById('hud-blast-btn');

    if (scoreEl) scoreEl.textContent = score;
    if (timeEl) timeEl.textContent = survTime.toFixed(1) + 's';
    if (gaugeEl) gaugeEl.style.width = (blastGauge / CFG.blastCharge * 100) + '%';
    if (blastBtn) {
      blastBtn.classList.toggle('ready', blastReady);
      blastBtn.textContent = blastReady ? '💨 BLAST!' : `🍩 ${blastGauge}/${CFG.blastCharge}`;
    }
  }

  // === DIFFICULTY ===
  function updateDiff(dt, now) {
    survTime += dt;
    score += Math.round(CFG.survivalPtsPerSec * dt);
    diff = 1 + Math.floor(survTime / 12);

    const spawnInt = Math.max(CFG.spawnMin, CFG.spawnStart - diff * 180);
    if (now - lastSpawn > spawnInt && beeObjects.length < CFG.maxBees) {
      spawnBee();
      lastSpawn = now;
      if (diff >= 3 && Math.random() < 0.3) spawnBee();
      if (diff >= 5 && Math.random() < 0.25) spawnBee();
    }

    // Spawn donuts
    if (now - lastDonut > CFG.donutInterval) {
      spawnDonut();
      lastDonut = now;
    }

    updateHUD();
  }

  // === CAMERA ===
  function updateCamera(time) {
    const camAngle = time * 0.05;
    const camDist = 16;
    const camHeight = 14;
    camera.position.x = Math.sin(camAngle) * camDist;
    camera.position.z = Math.cos(camAngle) * camDist;
    camera.position.y = camHeight;
    camera.lookAt(0, 2, 0);
  }

  // === GAME OVER ===
  function endGame() {
    active = false;
    cancelAnimationFrame(af);
    const isNew = score > highScore;
    if (isNew) {
      highScore = score;
      localStorage.setItem('honey_highscore', String(highScore));
    }

    const ro = document.getElementById('game-result');
    if (ro) {
      const rs = document.getElementById('result-score');
      const rh = document.getElementById('result-high');
      const rn = document.getElementById('result-new');
      const rk = document.getElementById('result-kills');
      const rw = document.getElementById('result-wave');
      const rt = document.getElementById('result-time');
      if (rs) rs.textContent = score;
      if (rh) rh.textContent = highScore;
      if (rn) rn.style.display = isNew ? 'block' : 'none';
      if (rk) rk.textContent = beeObjects.length;
      if (rw) rw.textContent = Math.floor(diff);
      if (rt) rt.textContent = survTime.toFixed(1) + 's';
      ro.classList.add('visible');
    }

    const qualified = survTime >= CFG.survivalGate;
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.onGameOver(score, Math.floor(diff), 0, qualified);
    }
  }

  // === MAIN LOOP ===
  function loop() {
    if (!active) return;
    af = requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    const elapsed = clock.elapsedTime;

    updatePlayer(dt);
    autoShoot(now);
    updateWinds(dt, now);
    updateBees(dt, now);
    updateDonuts(dt, now);
    checkCollisions(now);
    updateParticles(dt);
    updateDiff(dt, now);
    updateCamera(elapsed);
    animateOcean(elapsed);

    // Animate palm tree leaves
    if (palmTree) {
      palmTree.children.forEach((child, i) => {
        if (i >= 5) { // leaves
          child.rotation.z = 0.4 + Math.sin(elapsed * 1.5 + i) * 0.1;
        }
      });
    }

    // Animate clouds
    for (const c of clouds) {
      c.position.x = c.userData.baseX + Math.sin(elapsed * c.userData.speed * 20) * 8;
    }

    // Honey pot bob
    if (honeyMesh) {
      honeyMesh.position.y = 3 + Math.sin(elapsed * 1.2) * 0.08;
    }

    renderer.render(scene, camera);
  }

  // === START / STOP ===
  function start(container) {
    // Clean up any previous renderer
    cleanup();

    initScene(container);
    createOcean();
    createIsland();
    createPalmTree();
    createHoneyPot();
    createPlayerModel();
    createClouds();

    active = true;
    lastShot = 0;
    lastSpawn = 0;
    lastDonut = 0;
    lt = 0;
    survTime = 0;
    diff = 1;
    score = 0;
    blastGauge = 0;
    blastReady = false;
    honey = { hp: CFG.honeyHP, maxHp: CFG.honeyHP };
    player = { alive: true };
    tx = -2;
    ty = 1;
    touching = false;

    // Events
    renderer.domElement.addEventListener('pointerdown', onPD, { passive: false });
    renderer.domElement.addEventListener('pointermove', onPM, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPU);
    renderer.domElement.addEventListener('pointercancel', onPU);

    // Blast button
    const blastBtn = document.getElementById('hud-blast-btn');
    if (blastBtn) {
      blastBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); triggerBlast(); };
    }

    const ro = document.getElementById('game-result');
    if (ro) ro.classList.remove('visible');
    const na = document.getElementById('lb-name-input-area');
    if (na) na.classList.remove('visible');

    // Handle resize
    window._honeyResizeHandler = () => {
      if (!renderer || !camera) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', window._honeyResizeHandler);

    updateHUD();
    clock.start();
    af = requestAnimationFrame(loop);
  }

  function cleanup() {
    if (renderer) {
      renderer.domElement.removeEventListener('pointerdown', onPD);
      renderer.domElement.removeEventListener('pointermove', onPM);
      renderer.domElement.removeEventListener('pointerup', onPU);
      renderer.domElement.removeEventListener('pointercancel', onPU);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      renderer = null;
    }
    if (window._honeyResizeHandler) {
      window.removeEventListener('resize', window._honeyResizeHandler);
    }
    // Clean scene objects
    if (scene) {
      while (scene.children.length > 0) {
        const obj = scene.children[0];
        scene.remove(obj);
      }
    }
    beeObjects = [];
    windObjects = [];
    donutObjects = [];
    particleObjects = [];
    clouds = [];
    scene = null;
    camera = null;
    islandGroup = null;
    honeyMesh = null;
    playerGroup = null;
    oceanMesh = null;
    palmTree = null;
  }

  function stop() {
    active = false;
    cancelAnimationFrame(af);
    cleanup();
    const ro = document.getElementById('game-result');
    if (ro) ro.classList.remove('visible');
  }

  function replay(container) {
    stop();
    start(container);
  }

  return {
    start,
    stop,
    end: endGame,
    replay,
    get active() { return active; },
    get score() { return score; },
    get survTime() { return survTime; },
  };
})();
