/* HONEY ISLAND DEFENSE v2 — 30s Timed 3D Voxel Game */
const GameEngine=(()=>{'use strict';

// === CONFIG ===
const CFG={
  gameDuration:30,honeyHP:100,playerSpeed:0.12,
  shootInterval:250,windSpeed:0.35,windPush:3.5,
  spawnStart:1800,spawnMin:350,maxBees:30,
  donutInterval:4000,donutPoints:100,beePoints:15,
  beePenalty:50,blastCharge:3,
};

// SFX
const SFX=(()=>{let ac=null,m=null;
function e(){if(ac)return 1;try{ac=new(window.AudioContext||window.webkitAudioContext)();m=ac.createGain();m.gain.value=0.2;m.connect(ac.destination);return 1}catch(e){return 0}}
function g(v){const gn=ac.createGain();gn.gain.value=v;gn.connect(m);return gn}
function puff(){if(!e())return;const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*.08,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.max(0,1-i/d.length);const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=800;const gn=g(.12);s.connect(f);f.connect(gn);gn.gain.exponentialRampToValueAtTime(.001,t+.1);s.start(t)}
function buzz(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(120,t+.2);const gn=g(.06);gn.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(gn);o.start(t);o.stop(t+.25)}
function steal(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(200,t+.3);const gn=g(.12);gn.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(gn);o.start(t);o.stop(t+.35)}
function pickup(){if(!e())return;const t=ac.currentTime;[523,659,784].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.1);gn.gain.setValueAtTime(.001,t+i*.08);gn.gain.linearRampToValueAtTime(.1,t+i*.08+.03);gn.gain.exponentialRampToValueAtTime(.001,t+i*.08+.15);o.connect(gn);o.start(t+i*.08);o.stop(t+i*.08+.2)})}
function blast(){if(!e())return;const t=ac.currentTime;const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(400,t+.15);o.frequency.exponentialRampToValueAtTime(80,t+.4);const gn=g(.15);gn.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(gn);o.start(t);o.stop(t+.5)}
function gameOver(){if(!e())return;const t=ac.currentTime;[523,659,784,1047].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.12);gn.gain.setValueAtTime(.001,t+i*.12);gn.gain.linearRampToValueAtTime(.12,t+i*.12+.03);gn.gain.exponentialRampToValueAtTime(.001,t+i*.12+.4);o.connect(gn);o.start(t+i*.12);o.stop(t+i*.12+.45)})}
return{puff,buzz,steal,pickup,blast,gameOver}})();

// STATE
let active=false,af;
let scene,camera,renderer,clock;
let islandGroup,honeyMesh,playerGroup,oceanMesh;
let beeObjects=[],windObjects=[],donutObjects=[],particles=[];
let clouds=[],waterFoam=[];
let player=null,touching=false,tx=0,ty=0;
let lastShot=0,lastSpawn=0,lastDonut=0;
let honey=null,survTime=0,diff=1,score=0;
let blastGauge=0,blastReady=false;
let highScore=parseInt(localStorage.getItem('honey_highscore2')||'0');
let raycaster,pointer,groundPlane;
let palmTrees=[],containerEl;
let beesRepelled=0,donutsCollected=0;

const rand=(a,b)=>a+Math.random()*(b-a);
const clp=(v,l,h)=>v<l?l:v>h?h:v;

// === MATERIALS ===
const MAT={};
function initMaterials(){
  const L=THREE.MeshLambertMaterial,P=THREE.MeshPhongMaterial;
  // Island layers
  MAT.grass=new L({color:0x5da840});MAT.grassLight=new L({color:0x7bc95a});
  MAT.grassDark=new L({color:0x3d7a28});MAT.grassTop=new L({color:0x6ab04c});
  MAT.dirt=new L({color:0x7a5c30});MAT.dirtDark=new L({color:0x5a4420});
  MAT.sand=new L({color:0xe8d5a3});MAT.sandWet=new L({color:0xc4aa78});
  MAT.sandLight=new L({color:0xf0e0c0});MAT.stone=new L({color:0x888888});
  MAT.stoneDark=new L({color:0x666666});
  // Tree
  MAT.wood=new L({color:0x5a3a18});MAT.woodLight=new L({color:0x7a5430});
  MAT.leaf=new L({color:0x3d8a28,side:THREE.DoubleSide});
  MAT.leafLight=new L({color:0x5aaa3a,side:THREE.DoubleSide});
  // Honey
  MAT.honeyPot=new L({color:0x7a5020});MAT.honeyPotLight=new L({color:0x9a6a30});
  MAT.honeyLiquid=new P({color:0xFFD700,transparent:true,opacity:0.85,shininess:80});
  MAT.honeyRim=new L({color:0x8B7B3C});MAT.honeyDrip=new P({color:0xeec900,transparent:true,opacity:0.7});
  // Bear
  MAT.bear=new L({color:0x8B6914});MAT.bearLight=new L({color:0xa07820});
  MAT.bearBelly=new L({color:0xD2B48C});MAT.bearNose=new L({color:0x222222});
  MAT.bearEye=new L({color:0x111111});MAT.bearEyeW=new L({color:0xffffff});
  MAT.blush=new L({color:0xff8fab,transparent:true,opacity:0.5});
  // Bee
  MAT.bee=new L({color:0xFFD700});MAT.beeStripe=new L({color:0x1a1a1a});
  MAT.beeWing=new L({color:0xd0e8ff,transparent:true,opacity:0.35,side:THREE.DoubleSide});
  MAT.beeEye=new L({color:0x111111});MAT.beeEyeW=new L({color:0xffffff});
  // Environment
  MAT.cloud=new L({color:0xe8e8e8});MAT.cloudDark=new L({color:0xc8c8c8});
  MAT.ocean=new P({color:0x1a8ab0,transparent:true,opacity:0.82,shininess:60,side:THREE.DoubleSide});
  MAT.oceanDeep=new L({color:0x0e5a7a});
  MAT.foam=new L({color:0xffffff,transparent:true,opacity:0.4});
  // Items
  MAT.donutDough=new L({color:0xf5c77e});
  MAT.donutIcing=new L({color:0xff8fab});MAT.donutIcingC=new L({color:0x5c3317});MAT.donutIcingM=new L({color:0xa8e6cf});
  MAT.sprinkle1=new L({color:0xff4444});MAT.sprinkle2=new L({color:0x44aaff});MAT.sprinkle3=new L({color:0xffdd44});
  // Effects
  MAT.windPuff=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5});
  MAT.blastRing=new THREE.MeshBasicMaterial({color:0x87ceeb,transparent:true,opacity:0.4,side:THREE.DoubleSide});
  MAT.flower1=new L({color:0xff8fab});MAT.flower2=new L({color:0xffd700});MAT.flower3=new L({color:0xff6b6b});MAT.flowerW=new L({color:0xffffff});
}

// === DETAILED VOXEL ISLAND ===
function createIsland(){
  islandGroup=new THREE.Group();
  const B=new THREE.BoxGeometry(1,1,1);
  // Heightmap-based island for more organic shape
  const size=14,half=size/2;
  function height(x,z){
    const d=Math.sqrt(x*x+z*z);
    const base=5.5-d*0.9;
    const noise=Math.sin(x*0.8+z*0.3)*0.6+Math.cos(x*0.3+z*1.1)*0.4+Math.sin(x*1.5-z*0.7)*0.3;
    return Math.floor(base+noise);
  }
  for(let x=-half;x<=half;x++){
    for(let z=-half;z<=half;z++){
      const h=height(x,z);
      if(h<-2)continue;
      for(let y=-3;y<=h;y++){
        let mat;
        if(y===h&&h>=2) mat=Math.random()>0.3?MAT.grassTop:MAT.grassLight;
        else if(y===h&&h>=0) mat=MAT.grass;
        else if(y===h) mat=Math.random()>0.5?MAT.sand:MAT.sandLight;
        else if(y>=h-1&&h>=1) mat=Math.random()>0.5?MAT.grassDark:MAT.dirt;
        else if(y>=h-2) mat=Math.random()>0.5?MAT.dirt:MAT.dirtDark;
        else mat=Math.random()>0.3?MAT.sandWet:MAT.stone;
        const block=new THREE.Mesh(B,mat);
        block.position.set(x,y,z);
        block.castShadow=true;block.receiveShadow=true;
        islandGroup.add(block);
      }
    }
  }
  // Scattered stones on beach
  const stoneGeo=new THREE.BoxGeometry(0.4,0.3,0.4);
  for(let i=0;i<12;i++){
    const a=rand(0,Math.PI*2),d=rand(4,6);
    const s=new THREE.Mesh(stoneGeo,Math.random()>0.5?MAT.stone:MAT.stoneDark);
    s.position.set(Math.cos(a)*d,-2.5+rand(0,0.3),Math.sin(a)*d);
    s.rotation.y=rand(0,Math.PI);
    islandGroup.add(s);
  }
  // Flowers on grass
  const flGeo=new THREE.BoxGeometry(0.25,0.25,0.25);
  const fMats=[MAT.flower1,MAT.flower2,MAT.flower3,MAT.flowerW];
  for(let i=0;i<20;i++){
    const a=rand(0,Math.PI*2),d=rand(0.5,3);
    const fx=Math.cos(a)*d,fz=Math.sin(a)*d;
    const h=height(Math.round(fx),Math.round(fz));
    if(h<1)continue;
    const fl=new THREE.Mesh(flGeo,fMats[Math.floor(Math.random()*fMats.length)]);
    fl.position.set(fx,h+0.6,fz);
    islandGroup.add(fl);
    // Stem
    const stem=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.06),MAT.grassDark);
    stem.position.set(fx,h+0.35,fz);
    islandGroup.add(stem);
  }
  scene.add(islandGroup);
}

// === PALM TREES (multiple, detailed) ===
function createPalmTrees(){
  const positions=[[2.5,0,-1.5],[-1.5,0,2],[-2.5,0,-2]];
  const trunkG=new THREE.BoxGeometry(0.4,0.8,0.4);
  const leafG=new THREE.BoxGeometry(2,0.1,0.6);
  const coconutG=new THREE.SphereGeometry(0.2,6,6);
  const coconutMat=new THREE.MeshLambertMaterial({color:0x5a3a18});

  for(const[px,,pz] of positions){
    const h=5+Math.floor(rand(-1,1));
    const tree=new THREE.Group();
    // Slightly curved trunk
    for(let i=0;i<h;i++){
      const seg=new THREE.Mesh(trunkG,i%2===0?MAT.wood:MAT.woodLight);
      seg.position.set(Math.sin(i*0.15)*0.3,i*0.8+0.4,0);
      seg.rotation.y=i*0.2;seg.castShadow=true;
      tree.add(seg);
    }
    // Leaves — more of them, varied sizes
    const topY=h*0.8+0.5;
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2+rand(-0.2,0.2);
      const len=rand(1.8,3);
      const lGeo=new THREE.BoxGeometry(len,0.1,rand(0.4,0.7));
      const leaf=new THREE.Mesh(lGeo,i%2===0?MAT.leaf:MAT.leafLight);
      leaf.position.set(Math.cos(a)*len*0.4,topY+rand(-0.3,0.3),Math.sin(a)*len*0.4);
      leaf.rotation.y=a;leaf.rotation.z=rand(0.2,0.6);leaf.castShadow=true;
      tree.add(leaf);
    }
    // Coconuts
    for(let i=0;i<2;i++){
      const c=new THREE.Mesh(coconutG,coconutMat);
      c.position.set(rand(-0.3,0.3),topY-0.4,rand(-0.3,0.3));
      tree.add(c);
    }
    const baseH=3;
    tree.position.set(px,baseH,pz);tree.scale.set(0.9,0.9,0.9);
    scene.add(tree);palmTrees.push(tree);
  }
}

// === HONEY POT (detailed) ===
function createHoneyPot(){
  const g=new THREE.Group();
  // Pot body — wider at bottom
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,1.5,8),MAT.honeyPot);
  body.position.y=0.75;body.castShadow=true;g.add(body);
  // Lighter stripe
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.78,0.3,8),MAT.honeyPotLight);
  stripe.position.y=0.6;g.add(stripe);
  // Rim
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.2,8),MAT.honeyRim);
  rim.position.y=1.5;g.add(rim);
  // Honey liquid
  const hl=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.12,8),MAT.honeyLiquid);
  hl.position.y=1.42;hl.name='honeyLevel';g.add(hl);
  // Honey drip
  const drip=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.4,0.12),MAT.honeyDrip);
  drip.position.set(0.6,1.1,0.2);drip.name='honeyDrip';g.add(drip);
  // Label
  const label=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.25,0.04),new THREE.MeshLambertMaterial({color:0xfff8dc}));
  label.position.set(0,0.8,0.82);g.add(label);
  g.position.set(0,3,0);
  honeyMesh=g;scene.add(g);
}

// === PLAYER (Detailed Bear) ===
function createPlayerModel(){
  playerGroup=new THREE.Group();
  const bx=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const bp=(w,h,d,m,x,y,z)=>{const mesh=bx(w,h,d,m);mesh.position.set(x,y,z);return mesh;};
  // Body
  const body=bx(1.1,1,0.9,MAT.bear);body.position.y=0.5;body.castShadow=true;playerGroup.add(body);
  // Belly patch
  playerGroup.add(bp(0.7,0.55,0.25,MAT.bearBelly,0,0.45,0.35));
  // Head
  const head=bx(0.9,0.75,0.8,MAT.bear);head.position.y=1.35;head.castShadow=true;playerGroup.add(head);
  // Snout
  playerGroup.add(bp(0.35,0.25,0.2,MAT.bearBelly,0,1.2,0.45));
  // Ears
  [[-0.38,1.8,0],[0.38,1.8,0]].forEach(p=>{
    playerGroup.add(bp(0.3,0.3,0.25,MAT.bear,p[0],p[1],p[2]));
    playerGroup.add(bp(0.18,0.18,0.08,MAT.bearBelly,p[0],p[1],p[2]+0.12));
  });
  // Eyes
  [[-0.2,1.45,0.42],[0.2,1.45,0.42]].forEach(p=>{
    playerGroup.add(bp(0.13,0.15,0.08,MAT.bearEye,p[0],p[1],p[2]));
    playerGroup.add(bp(0.06,0.06,0.04,MAT.bearEyeW,p[0]+0.03,p[1]+0.03,p[2]+0.04));
  });
  // Nose
  playerGroup.add(bp(0.18,0.1,0.12,MAT.bearNose,0,1.28,0.52));
  // Blush
  [[-0.35,1.3,0.42],[0.35,1.3,0.42]].forEach(p=>{
    playerGroup.add(bp(0.15,0.08,0.04,MAT.blush,p[0],p[1],p[2]));
  });
  // Arms
  [[-0.7,0.5,0],[0.7,0.5,0]].forEach(p=>{
    playerGroup.add(bp(0.25,0.6,0.25,MAT.bearLight,p[0],p[1],p[2]));
  });
  // Legs
  [[-0.28,-0.1,0.1],[0.28,-0.1,0.1]].forEach(p=>{
    playerGroup.add(bp(0.3,0.35,0.35,MAT.bear,p[0],p[1],p[2]));
  });
  playerGroup.position.set(-2,3.5,1);
  scene.add(playerGroup);
}

// === BEE (Detailed) ===
function createBeeModel(){
  const g=new THREE.Group();
  const bx=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const bp=(w,h,d,m,x,y,z)=>{const mesh=bx(w,h,d,m);mesh.position.set(x,y,z);return mesh;};
  // Abdomen (rear, larger)
  g.add(bp(0.45,0.4,0.5,MAT.bee,0,0,-0.2));
  // Stripes on abdomen
  for(let i=-1;i<=1;i++){
    g.add(bp(0.47,0.08,0.52,MAT.beeStripe,0,i*0.12,-0.2));
  }
  // Thorax (middle)
  g.add(bp(0.35,0.35,0.3,MAT.bee,0,0.05,0.2));
  // Head
  const head=bx(0.3,0.3,0.28,MAT.bee);head.position.set(0,0.08,0.45);g.add(head);
  // Eyes (larger, compound-style)
  [[-0.12,0.14,0.6],[0.12,0.14,0.6]].forEach(p=>{
    g.add(bp(0.12,0.12,0.06,MAT.beeEyeW,p[0],p[1],p[2]));
    g.add(bp(0.07,0.07,0.04,MAT.beeEye,p[0],p[1]+0.01,p[2]+0.03));
  });
  // Wings (4 wings)
  const wG=new THREE.BoxGeometry(0.5,0.04,0.35);
  ['wingL1','wingR1','wingL2','wingR2'].forEach((n,i)=>{
    const w=new THREE.Mesh(wG,MAT.beeWing);
    const side=i%2===0?-1:1;const row=i<2?0:1;
    w.position.set(side*0.35,0.25-row*0.08,0.1-row*0.15);
    w.rotation.z=side*0.3;w.name=n;g.add(w);
  });
  // Stinger
  g.add(bp(0.08,0.08,0.2,MAT.beeStripe,0,-0.05,-0.55));
  // Antennae
  [[-0.08,0.28,0.55],[0.08,0.28,0.55]].forEach((p,i)=>{
    const ant=bx(0.04,0.25,0.04,MAT.beeStripe);
    ant.position.set(...p);ant.rotation.z=(i===0?1:-1)*0.3;ant.rotation.x=-0.3;g.add(ant);
  });
  // Legs (6)
  for(let i=0;i<3;i++){
    [[-0.2,-0.2,0.1-i*0.15],[0.2,-0.2,0.1-i*0.15]].forEach(p=>{
      g.add(bp(0.04,0.15,0.04,MAT.beeStripe,p[0],p[1],p[2]));
    });
  }
  g.scale.set(0.85,0.85,0.85);return g;
}

// === DONUT ===
function createDonutModel(){
  const g=new THREE.Group();
  const icings=[MAT.donutIcing,MAT.donutIcingC,MAT.donutIcingM];
  const icM=icings[Math.floor(Math.random()*icings.length)];
  const sG=new THREE.BoxGeometry(0.28,0.22,0.28);
  const tG=new THREE.BoxGeometry(0.3,0.07,0.3);
  const spG=new THREE.BoxGeometry(0.06,0.04,0.06);
  const spM=[MAT.sprinkle1,MAT.sprinkle2,MAT.sprinkle3];
  for(let i=0;i<10;i++){
    const a=(i/10)*Math.PI*2;const r=0.5;
    const seg=new THREE.Mesh(sG,MAT.donutDough);
    seg.position.set(Math.cos(a)*r,0,Math.sin(a)*r);seg.rotation.y=-a;seg.castShadow=true;g.add(seg);
    const top=new THREE.Mesh(tG,icM);
    top.position.set(Math.cos(a)*r,0.14,Math.sin(a)*r);top.rotation.y=-a;g.add(top);
    // Sprinkles
    if(Math.random()>0.5){
      const sp=new THREE.Mesh(spG,spM[Math.floor(Math.random()*3)]);
      sp.position.set(Math.cos(a)*r+rand(-0.05,0.05),0.2,Math.sin(a)*r+rand(-0.05,0.05));
      sp.rotation.y=rand(0,Math.PI);g.add(sp);
    }
  }
  return g;
}

// === DETAILED CLOUDS ===
function createClouds(){
  const B=new THREE.BoxGeometry(1,1,1);
  const defs=[
    {x:-14,y:12,z:-10,s:1.2},{x:12,y:14,z:-14,s:1.5},{x:-6,y:11,z:16,s:1},{x:16,y:13,z:6,s:1.3},{x:-10,y:15,z:8,s:0.9},{x:8,y:12,z:12,s:1.1},
  ];
  for(const cd of defs){
    const cg=new THREE.Group();
    // Generate cloud shape procedurally
    const w=Math.floor(rand(3,6)),h=Math.floor(rand(1,3)),d=Math.floor(rand(2,4));
    for(let x=0;x<w;x++){
      for(let z=0;z<d;z++){
        const maxY=h-Math.abs(x-w/2)*0.5-Math.abs(z-d/2)*0.3;
        for(let y=0;y<maxY;y++){
          if(Math.random()>0.2){
            const b=new THREE.Mesh(B,y===Math.floor(maxY)-1?MAT.cloud:MAT.cloudDark);
            b.position.set(x-w/2,y,z-d/2);cg.add(b);
          }
        }
      }
    }
    cg.position.set(cd.x,cd.y,cd.z);cg.scale.set(cd.s,cd.s*0.6,cd.s);
    cg.userData={baseX:cd.x,speed:rand(0.004,0.01),baseZ:cd.z};
    scene.add(cg);clouds.push(cg);
  }
}

// === OCEAN (detailed with foam) ===
function createOcean(){
  // Main ocean
  const geo=new THREE.PlaneGeometry(100,100,60,60);
  oceanMesh=new THREE.Mesh(geo,MAT.ocean);
  oceanMesh.rotation.x=-Math.PI/2;oceanMesh.position.y=-2.8;
  oceanMesh.receiveShadow=true;scene.add(oceanMesh);
  // Deep ocean underneath
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(100,100),MAT.oceanDeep);
  deep.rotation.x=-Math.PI/2;deep.position.y=-4;scene.add(deep);
  // Foam ring around island
  const foamGeo=new THREE.RingGeometry(5.5,7,24);
  const foam=new THREE.Mesh(foamGeo,MAT.foam);
  foam.rotation.x=-Math.PI/2;foam.position.y=-2.3;foam.name='foam';
  scene.add(foam);waterFoam.push(foam);
}

function animateOcean(time){
  if(!oceanMesh)return;
  const pos=oceanMesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getY(i);
    const wave=Math.sin(x*0.25+time*1.8)*0.4+Math.sin(z*0.3+time*1.4)*0.3+Math.sin((x+z)*0.15+time*0.9)*0.2+Math.cos(x*0.4-z*0.2+time*2.2)*0.15;
    pos.setZ(i,wave);
  }
  pos.needsUpdate=true;
  // Foam animation
  for(const f of waterFoam){f.rotation.z=time*0.05;f.material.opacity=0.3+Math.sin(time*2)*0.1;}
}

// === SCENE SETUP ===
function initScene(container){
  containerEl=container;scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87ceeb);scene.fog=new THREE.FogExp2(0xa0d8ef,0.012);
  camera=new THREE.PerspectiveCamera(40,container.clientWidth/container.clientHeight,0.1,120);
  camera.position.set(0,16,18);camera.lookAt(0,2,0);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(container.clientWidth,container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',zIndex:'1',touchAction:'none'});
  // Lights
  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  const dl=new THREE.DirectionalLight(0xfff5e6,1.1);
  dl.position.set(10,18,12);dl.castShadow=true;
  dl.shadow.mapSize.set(1024,1024);dl.shadow.camera.near=0.5;dl.shadow.camera.far=50;
  dl.shadow.camera.top=15;dl.shadow.camera.bottom=-15;dl.shadow.camera.left=-15;dl.shadow.camera.right=15;
  scene.add(dl);scene.add(new THREE.HemisphereLight(0x87ceeb,0x1a6b8a,0.3));
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-3.5);
  clock=new THREE.Clock();initMaterials();
}

// === INPUT ===
function getWorldPos(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  pointer.x=((cx-r.left)/r.width)*2-1;pointer.y=-((cy-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const t=new THREE.Vector3();raycaster.ray.intersectPlane(groundPlane,t);return t;
}
function onPD(e){if(!active)return;e.preventDefault();touching=true;const p=getWorldPos(e.clientX,e.clientY);if(p){tx=p.x;ty=p.z;}}
function onPM(e){if(!active||!touching)return;e.preventDefault();const p=getWorldPos(e.clientX,e.clientY);if(p){tx=p.x;ty=p.z;}}
function onPU(){touching=false;}

// === GAME LOGIC ===
function updatePlayer(dt){
  if(!player.alive||!playerGroup)return;
  if(touching){const dx=tx-playerGroup.position.x,dz=ty-playerGroup.position.z,d=Math.hypot(dx,dz);
    if(d>0.2){const m=Math.min(CFG.playerSpeed*dt*60,d*0.15);playerGroup.position.x+=(dx/d)*m;playerGroup.position.z+=(dz/d)*m;playerGroup.rotation.y=Math.atan2(dx,dz);}}
  playerGroup.position.x=clp(playerGroup.position.x,-5,5);playerGroup.position.z=clp(playerGroup.position.z,-5,5);
  playerGroup.position.y=3.5+Math.sin(performance.now()/500)*0.1;
}

function autoShoot(now){
  if(!player.alive||now-lastShot<CFG.shootInterval||beeObjects.length===0)return;
  lastShot=now;let near=null,nd=Infinity;
  for(const b of beeObjects){const dx=b.mesh.position.x-playerGroup.position.x,dz=b.mesh.position.z-playerGroup.position.z;const d=Math.hypot(dx,dz);if(d<nd){nd=d;near=b;}}
  if(!near)return;
  const dx=near.mesh.position.x-playerGroup.position.x,dz=near.mesh.position.z-playerGroup.position.z,d=Math.hypot(dx,dz)||1;
  const p=new THREE.Mesh(new THREE.SphereGeometry(0.2,6,6),MAT.windPuff.clone());
  p.position.copy(playerGroup.position);p.position.y+=0.8;scene.add(p);
  windObjects.push({mesh:p,vx:(dx/d)*CFG.windSpeed,vz:(dz/d)*CFG.windSpeed,born:now,life:1});SFX.puff();
}

function updateWinds(dt,now){
  for(let i=windObjects.length-1;i>=0;i--){const w=windObjects[i];
    w.mesh.position.x+=w.vx*dt*60;w.mesh.position.z+=w.vz*dt*60;w.mesh.scale.multiplyScalar(1.02);w.life-=0.015*dt*60;w.mesh.material.opacity=w.life*0.5;
    if(w.life<=0||now-w.born>2000){scene.remove(w.mesh);w.mesh.geometry.dispose();w.mesh.material.dispose();windObjects.splice(i,1);}}
}

function spawnBee(){
  const sm=1+diff*0.06;const a=rand(0,Math.PI*2),d=rand(14,20);
  const mesh=createBeeModel();mesh.position.set(Math.cos(a)*d,rand(4,7),Math.sin(a)*d);scene.add(mesh);
  beeObjects.push({mesh,speed:rand(0.035,0.07)*sm,phase:rand(0,Math.PI*2),knockVx:0,knockVz:0,stunTime:0,dmg:CFG.beePenalty,targetY:rand(4,6)});
}

function updateBees(dt,now){
  for(const b of beeObjects){
    ['wingL1','wingR1','wingL2','wingR2'].forEach(n=>{const w=b.mesh.getObjectByName(n);if(w)w.rotation.z=(n.includes('L')?1:-1)*(0.3+Math.sin(now/35+b.phase)*0.6);});
    if(b.stunTime>0){b.stunTime-=dt*1000;b.mesh.position.x+=b.knockVx*dt*60;b.mesh.position.z+=b.knockVz*dt*60;b.knockVx*=0.92;b.knockVz*=0.92;b.mesh.rotation.z=Math.sin(now/100)*0.5;continue;}
    b.mesh.rotation.z=0;const dx=-b.mesh.position.x,dz=-b.mesh.position.z,d=Math.hypot(dx,dz);
    if(d>0.5){b.mesh.position.x+=(dx/d)*b.speed*dt*60+Math.sin(now/400+b.phase)*0.02;b.mesh.position.z+=(dz/d)*b.speed*dt*60+Math.cos(now/350+b.phase)*0.015;b.mesh.rotation.y=Math.atan2(dx,dz);}
    b.mesh.position.y=b.targetY+Math.sin(now/600+b.phase)*0.3;
  }
}

function spawnDonut(){
  const a=rand(0,Math.PI*2),d=rand(2,5);const mesh=createDonutModel();
  mesh.position.set(Math.cos(a)*d,4.5,Math.sin(a)*d);scene.add(mesh);
  donutObjects.push({mesh,born:performance.now(),life:8000});
}

function updateDonuts(dt,now){
  for(let i=donutObjects.length-1;i>=0;i--){const d=donutObjects[i];
    d.mesh.rotation.y+=0.025*dt*60;d.mesh.position.y=4.5+Math.sin(now/500+i)*0.3;
    if(playerGroup){const dx=d.mesh.position.x-playerGroup.position.x,dz=d.mesh.position.z-playerGroup.position.z;
      if(Math.hypot(dx,dz)<1.5){score+=CFG.donutPoints;donutsCollected++;blastGauge=Math.min(blastGauge+1,CFG.blastCharge);if(blastGauge>=CFG.blastCharge)blastReady=true;updateHUD();SFX.pickup();scene.remove(d.mesh);donutObjects.splice(i,1);continue;}}
    if(now-d.born>d.life){scene.remove(d.mesh);donutObjects.splice(i,1);}
  }
}

function triggerBlast(){
  if(!blastReady||!playerGroup)return;blastReady=false;blastGauge=0;updateHUD();SFX.blast();
  const rg=new THREE.Mesh(new THREE.RingGeometry(0.5,1,24),MAT.blastRing.clone());
  rg.rotation.x=-Math.PI/2;rg.position.copy(playerGroup.position);rg.position.y+=1;scene.add(rg);
  particles.push({mesh:rg,scale:1,life:1});
  for(const b of beeObjects){const dx=b.mesh.position.x-playerGroup.position.x,dz=b.mesh.position.z-playerGroup.position.z,d=Math.hypot(dx,dz)||1;
    const force=Math.max(1,8/d);b.knockVx=(dx/d)*force*0.5;b.knockVz=(dz/d)*force*0.5;b.stunTime=800;score+=CFG.beePoints;beesRepelled++;}
  updateHUD();
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.scale+=0.3*dt*60;p.life-=0.03*dt*60;p.mesh.scale.set(p.scale,p.scale,p.scale);p.mesh.material.opacity=p.life*0.4;
    if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}
}

function checkCollisions(now){
  for(let wi=windObjects.length-1;wi>=0;wi--){const w=windObjects[wi];
    for(const b of beeObjects){const dx=b.mesh.position.x-w.mesh.position.x,dz=b.mesh.position.z-w.mesh.position.z,dy=b.mesh.position.y-w.mesh.position.y;
      if(Math.sqrt(dx*dx+dz*dz+dy*dy)<1.5){const d=Math.hypot(dx,dz)||1;b.knockVx=(dx/d)*CFG.windPush*0.15;b.knockVz=(dz/d)*CFG.windPush*0.15;b.stunTime=500;score+=CFG.beePoints;beesRepelled++;updateHUD();SFX.buzz();scene.remove(w.mesh);w.mesh.geometry.dispose();w.mesh.material.dispose();windObjects.splice(wi,1);break;}}}
  // Bees reach honey — PENALTY
  for(let i=beeObjects.length-1;i>=0;i--){const b=beeObjects[i];if(b.stunTime>0)continue;
    if(Math.hypot(b.mesh.position.x,b.mesh.position.z)<1.8&&b.mesh.position.y<5.5){
      score=Math.max(0,score-CFG.beePenalty);honey.hp=Math.max(0,honey.hp-3);updateHUD();SFX.steal();scene.remove(b.mesh);beeObjects.splice(i,1);}}
  // Remove far bees
  for(let i=beeObjects.length-1;i>=0;i--){if(Math.hypot(beeObjects[i].mesh.position.x,beeObjects[i].mesh.position.z)>30){scene.remove(beeObjects[i].mesh);beeObjects.splice(i,1);}}
}

// === HUD ===
function updateHUD(){
  const s=document.getElementById('hud-score'),t=document.getElementById('hud-time'),gf=document.getElementById('hud-gauge-fill'),bb=document.getElementById('hud-blast-btn'),tb=document.getElementById('hud-timer-bar');
  const remaining=Math.max(0,CFG.gameDuration-survTime);
  if(s)s.textContent=score;if(t)t.textContent=Math.ceil(remaining)+'s';
  if(gf)gf.style.width=(blastGauge/CFG.blastCharge*100)+'%';
  if(bb){bb.classList.toggle('ready',blastReady);bb.textContent=blastReady?'💨 BLAST!':`🍩 ${blastGauge}/${CFG.blastCharge}`;}
  if(tb)tb.style.width=(remaining/CFG.gameDuration*100)+'%';
  // Honey HP bar in HUD
  const hp=document.getElementById('hud-honey');
  if(hp&&honey)hp.style.width=(honey.hp/honey.maxHp*100)+'%';
}

function updateDiff(dt,now){
  survTime+=dt;diff=1+Math.floor(survTime/8);
  // Check game end
  if(survTime>=CFG.gameDuration){SFX.gameOver();setTimeout(endGame,800);active=false;return;}
  const spawnInt=Math.max(CFG.spawnMin,CFG.spawnStart-diff*200);
  if(now-lastSpawn>spawnInt&&beeObjects.length<CFG.maxBees){spawnBee();lastSpawn=now;if(diff>=2&&Math.random()<0.35)spawnBee();if(diff>=3&&Math.random()<0.3)spawnBee();}
  if(now-lastDonut>CFG.donutInterval){spawnDonut();lastDonut=now;}
  updateHUD();
}

function updateCamera(time){
  const a=time*0.08,d=17,h=15;
  camera.position.set(Math.sin(a)*d,h,Math.cos(a)*d);camera.lookAt(0,2,0);
}

// === GAME OVER ===
function endGame(){
  active=false;cancelAnimationFrame(af);
  const isNew=score>highScore;if(isNew){highScore=score;localStorage.setItem('honey_highscore2',String(highScore));}
  const ro=document.getElementById('game-result');
  if(ro){
    const el=id=>document.getElementById(id);
    const rs=el('result-score'),rh=el('result-high'),rn=el('result-new'),rb=el('result-bees'),rd=el('result-donuts'),rt=el('result-time'),rp=el('result-honey');
    if(rs)rs.textContent=score;if(rh)rh.textContent=highScore;if(rn)rn.style.display=isNew?'block':'none';
    if(rb)rb.textContent=beesRepelled;if(rd)rd.textContent=donutsCollected;
    if(rt)rt.textContent='30s';if(rp)rp.textContent=Math.ceil(honey.hp)+'%';
    ro.classList.add('visible');
  }
  if(typeof Leaderboard!=='undefined')Leaderboard.onGameOver(score,beesRepelled,donutsCollected);
}

// === MAIN LOOP ===
function loop(){
  if(!active)return;af=requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),0.05),now=performance.now(),el=clock.elapsedTime;
  updatePlayer(dt);autoShoot(now);updateWinds(dt,now);updateBees(dt,now);updateDonuts(dt,now);checkCollisions(now);updateParticles(dt);updateDiff(dt,now);updateCamera(el);animateOcean(el);
  // Animate trees
  for(const t of palmTrees){t.children.forEach((c,i)=>{if(i>=5)c.rotation.z=0.3+Math.sin(el*1.5+i)*0.12;});}
  for(const c of clouds){c.position.x=c.userData.baseX+Math.sin(el*c.userData.speed*20)*10;}
  if(honeyMesh)honeyMesh.position.y=3+Math.sin(el*1.2)*0.08;
  renderer.render(scene,camera);
}

// === START/STOP ===
function start(container){
  cleanup();initScene(container);createOcean();createIsland();createPalmTrees();createHoneyPot();createPlayerModel();createClouds();
  active=true;lastShot=0;lastSpawn=0;lastDonut=0;survTime=0;diff=1;score=0;blastGauge=0;blastReady=false;beesRepelled=0;donutsCollected=0;
  honey={hp:CFG.honeyHP,maxHp:CFG.honeyHP};player={alive:true};tx=-2;ty=1;touching=false;
  renderer.domElement.addEventListener('pointerdown',onPD,{passive:false});renderer.domElement.addEventListener('pointermove',onPM,{passive:false});
  renderer.domElement.addEventListener('pointerup',onPU);renderer.domElement.addEventListener('pointercancel',onPU);
  const bb=document.getElementById('hud-blast-btn');if(bb)bb.onclick=e=>{e.preventDefault();e.stopPropagation();triggerBlast();};
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');
  const na=document.getElementById('lb-name-input-area');if(na)na.classList.remove('visible');
  window._honeyResize=()=>{if(!renderer||!camera)return;camera.aspect=containerEl.clientWidth/containerEl.clientHeight;camera.updateProjectionMatrix();renderer.setSize(containerEl.clientWidth,containerEl.clientHeight);};
  window.addEventListener('resize',window._honeyResize);
  updateHUD();clock.start();af=requestAnimationFrame(loop);
}

function cleanup(){
  if(renderer){renderer.domElement.removeEventListener('pointerdown',onPD);renderer.domElement.removeEventListener('pointermove',onPM);renderer.domElement.removeEventListener('pointerup',onPU);renderer.domElement.removeEventListener('pointercancel',onPU);
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);renderer.dispose();renderer=null;}
  if(window._honeyResize)window.removeEventListener('resize',window._honeyResize);
  if(scene){while(scene.children.length>0)scene.remove(scene.children[0]);}
  beeObjects=[];windObjects=[];donutObjects=[];particles=[];clouds=[];waterFoam=[];palmTrees=[];
  scene=null;camera=null;islandGroup=null;honeyMesh=null;playerGroup=null;oceanMesh=null;
}

function stop(){active=false;cancelAnimationFrame(af);cleanup();const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');}
function replay(c){stop();start(c);}

return{start,stop,end:endGame,replay,get active(){return active},get score(){return score}};
})();
