/* HONEY ISLAND DEFENSE v3 — Premium 3D Voxel Game */
const GameEngine=(()=>{'use strict';

// === CONFIG ===
const CFG={
  gameDuration:30,honeyHP:100,playerSpeed:0.14,
  shootInterval:180,windSpeed:0.4,windPush:4,
  spawnStart:1400,spawnMin:280,maxBees:28,
  donutInterval:4500,donutPoints:100,beePoints:10,
  tapRepelPoints:25,beePenalty:50,tapRepelRadius:2.8,
};
const BS=0.4; // block size — fine voxels
const IR=12;  // island radius in blocks

// SFX
const SFX=(()=>{let ac=null,m=null;
function e(){if(ac)return 1;try{ac=new(window.AudioContext||window.webkitAudioContext)();m=ac.createGain();m.gain.value=0.2;m.connect(ac.destination);return 1}catch(e){return 0}}
function g(v){const gn=ac.createGain();gn.gain.value=v;gn.connect(m);return gn}
function puff(){if(!e())return;const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*.08,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.max(0,1-i/d.length);const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=800;const gn=g(.12);s.connect(f);f.connect(gn);gn.gain.exponentialRampToValueAtTime(.001,t+.1);s.start(t)}
function buzz(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(120,t+.2);const gn=g(.06);gn.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(gn);o.start(t);o.stop(t+.25)}
function steal(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(200,t+.3);const gn=g(.12);gn.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(gn);o.start(t);o.stop(t+.35)}
function pickup(){if(!e())return;const t=ac.currentTime;[523,659,784].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.1);gn.gain.setValueAtTime(.001,t+i*.08);gn.gain.linearRampToValueAtTime(.1,t+i*.08+.03);gn.gain.exponentialRampToValueAtTime(.001,t+i*.08+.15);o.connect(gn);o.start(t+i*.08);o.stop(t+i*.08+.2)})}
function gameOver(){if(!e())return;const t=ac.currentTime;[523,659,784,1047].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.12);gn.gain.setValueAtTime(.001,t+i*.12);gn.gain.linearRampToValueAtTime(.12,t+i*.12+.03);gn.gain.exponentialRampToValueAtTime(.001,t+i*.12+.4);o.connect(gn);o.start(t+i*.12);o.stop(t+i*.12+.45)})}
return{puff,buzz,steal,pickup,gameOver}})();

// STATE
let active=false,af;
let scene,camera,renderer,clock;
let islandGroup,honeyMesh,playerGroup,oceanMesh;
let beeObjects=[],windObjects=[],donutObjects=[],particles=[];
let clouds=[],waterFoam=[];
let player=null,touching=false,tx=0,ty=0;
let lastShot=0,lastSpawn=0,lastDonut=0;
let honey=null,survTime=0,diff=1,score=0;
let highScore=parseInt(localStorage.getItem('honey_highscore2')||'0');
let raycaster,pointer,groundPlane;
let palmTrees=[],containerEl,bgIslands=[];
let beesRepelled=0,donutsCollected=0;
let shakeTime=0;

const rand=(a,b)=>a+Math.random()*(b-a);
const clp=(v,l,h)=>v<l?l:v>h?h:v;

// === HEIGHTMAP ===
function heightAt(bx,bz){
  const wx=bx*BS,wz=bz*BS,d=Math.sqrt(wx*wx+wz*wz);
  const base=3.2-d*0.5;
  const n=Math.sin(wx*1.2+wz*0.5)*0.22+Math.cos(wx*0.5+wz*1.4)*0.18+Math.sin(wx*2.1-wz*0.8)*0.1;
  return Math.floor((base+n)/BS);
}
function surfaceY(wx,wz){
  const bx=Math.round(wx/BS),bz=Math.round(wz/BS);
  const h=heightAt(bx,bz);
  return h<-6?-2.5:h*BS+BS*0.5;
}

// === MATERIALS ===
const MAT={};
function initMaterials(){
  const L=THREE.MeshLambertMaterial,P=THREE.MeshPhongMaterial;
  MAT.grass=new L({color:0x5da840});MAT.grassLight=new L({color:0x7bc95a});
  MAT.grassDark=new L({color:0x3d7a28});MAT.grassTop=new L({color:0x6ab04c});
  MAT.dirt=new L({color:0x7a5c30});MAT.dirtDark=new L({color:0x5a4420});
  MAT.sand=new L({color:0xe8d5a3});MAT.sandWet=new L({color:0xc4aa78});
  MAT.sandLight=new L({color:0xf0e0c0});MAT.stone=new L({color:0x888888});
  MAT.stoneDark=new L({color:0x666666});
  MAT.wood=new L({color:0x5a3a18});MAT.woodLight=new L({color:0x7a5430});
  MAT.leaf=new L({color:0x3d8a28,side:THREE.DoubleSide});
  MAT.leafLight=new L({color:0x5aaa3a,side:THREE.DoubleSide});
  MAT.honeyPot=new L({color:0xd4a017});MAT.honeyPotLight=new L({color:0xe8b830});
  MAT.honeyLiquid=new P({color:0xFFD700,transparent:true,opacity:0.85,shininess:80});
  MAT.honeyRim=new L({color:0x8B7B3C});MAT.honeyDrip=new P({color:0xeec900,transparent:true,opacity:0.7});
  MAT.bear=new L({color:0x8B6914});MAT.bearLight=new L({color:0xa07820});
  MAT.bearBelly=new L({color:0xD2B48C});MAT.bearNose=new L({color:0x222222});
  MAT.bearEye=new L({color:0x111111});MAT.bearEyeW=new L({color:0xffffff});
  MAT.blush=new L({color:0xff8fab,transparent:true,opacity:0.5});
  MAT.bee=new L({color:0xFFD700});MAT.beeStripe=new L({color:0x1a1a1a});
  MAT.beeWing=new L({color:0xd0e8ff,transparent:true,opacity:0.35,side:THREE.DoubleSide});
  MAT.beeEye=new L({color:0x111111});MAT.beeEyeW=new L({color:0xffffff});
  MAT.cloud=new L({color:0xf5f5f5});MAT.cloudBright=new L({color:0xffffff});
  MAT.ocean=new P({color:0x1a8ab0,transparent:true,opacity:0.82,shininess:60,side:THREE.DoubleSide});
  MAT.oceanDeep=new L({color:0x0e5a7a});
  MAT.foam=new L({color:0xffffff,transparent:true,opacity:0.4});
  MAT.donutDough=new L({color:0xf5c77e});
  MAT.donutIcing=new L({color:0xff8fab});MAT.donutIcingC=new L({color:0x5c3317});MAT.donutIcingM=new L({color:0xa8e6cf});
  MAT.sprinkle1=new L({color:0xff4444});MAT.sprinkle2=new L({color:0x44aaff});MAT.sprinkle3=new L({color:0xffdd44});
  MAT.windPuff=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5});
  MAT.flower1=new L({color:0xff8fab});MAT.flower2=new L({color:0xffd700});MAT.flower3=new L({color:0xff6b6b});MAT.flowerW=new L({color:0xffffff});
  MAT.bgGrass=new L({color:0x4a9030});MAT.bgDirt=new L({color:0x6a4c20});
}

// === ISLAND (InstancedMesh, fine blocks) ===
function createIsland(){
  islandGroup=new THREE.Group();
  const B=new THREE.BoxGeometry(BS,BS,BS);
  const buckets=new Map();
  for(let bx=-IR;bx<=IR;bx++){
    for(let bz=-IR;bz<=IR;bz++){
      const h=heightAt(bx,bz);
      if(h<-6)continue;
      const wx=bx*BS,wz=bz*BS,d=Math.sqrt(wx*wx+wz*wz);
      const depth=Math.max(3,Math.floor((7-d*0.7)/BS));
      const minY=Math.max(-12,h-depth);
      for(let by=minY;by<=h;by++){
        let mat;
        if(by===h&&h>=5) mat=Math.random()>0.3?MAT.grassTop:MAT.grassLight;
        else if(by===h&&h>=2) mat=MAT.grass;
        else if(by===h) mat=Math.random()>0.5?MAT.sand:MAT.sandLight;
        else if(by>=h-2&&h>=3) mat=Math.random()>0.5?MAT.grassDark:MAT.dirt;
        else if(by>=h-4) mat=Math.random()>0.5?MAT.dirt:MAT.dirtDark;
        else mat=Math.random()>0.3?MAT.stone:MAT.stoneDark;
        if(!buckets.has(mat))buckets.set(mat,[]);
        buckets.get(mat).push(bx*BS,by*BS,bz*BS);
      }
    }
  }
  const dummy=new THREE.Object3D();
  for(const[mat,coords]of buckets){
    const count=coords.length/3;
    const im=new THREE.InstancedMesh(B,mat,count);
    for(let i=0;i<count;i++){
      dummy.position.set(coords[i*3],coords[i*3+1],coords[i*3+2]);
      dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);
    }
    im.instanceMatrix.needsUpdate=true;im.castShadow=true;im.receiveShadow=true;
    islandGroup.add(im);
  }
  // Grass tufts
  const tG=new THREE.BoxGeometry(BS*0.3,BS*0.9,BS*0.15);
  for(let i=0;i<50;i++){
    const a=rand(0,Math.PI*2),d=rand(0.3,3.5);
    const gx=Math.cos(a)*d,gz=Math.sin(a)*d,sy=surfaceY(gx,gz);
    if(sy<0.5)continue;
    const t=new THREE.Mesh(tG,Math.random()>0.5?MAT.grassDark:MAT.leaf);
    t.position.set(gx,sy+BS*0.35,gz);t.rotation.y=rand(0,Math.PI);islandGroup.add(t);
  }
  // Flowers
  const flG=new THREE.BoxGeometry(BS*0.5,BS*0.5,BS*0.5);
  const fMats=[MAT.flower1,MAT.flower2,MAT.flower3,MAT.flowerW];
  for(let i=0;i<12;i++){
    const a=rand(0,Math.PI*2),d=rand(0.5,2.8);
    const fx=Math.cos(a)*d,fz=Math.sin(a)*d,sy=surfaceY(fx,fz);
    if(sy<1)continue;
    const fl=new THREE.Mesh(flG,fMats[Math.floor(Math.random()*fMats.length)]);
    fl.position.set(fx,sy+BS*0.2,fz);islandGroup.add(fl);
    const stem=new THREE.Mesh(new THREE.BoxGeometry(0.04,BS*0.8,0.04),MAT.grassDark);
    stem.position.set(fx,sy,fz);islandGroup.add(stem);
  }
  scene.add(islandGroup);
}

// === BACKGROUND ISLANDS ===
function createBackgroundIslands(){
  const bB=new THREE.BoxGeometry(0.7,0.7,0.7);
  const defs=[[-16,-2,-14,3],[18,-2,-12,4],[-14,-2,16,2],[20,-2,10,3],[-18,-2,6,2],[14,-2,18,3]];
  for(const[px,py,pz,mh]of defs){
    const ig=new THREE.Group();
    for(let x=-2;x<=2;x++){for(let z=-2;z<=2;z++){
      const d=Math.sqrt(x*x+z*z);if(d>2.3)continue;
      const h=Math.floor(mh-d*0.8);
      for(let y=-1;y<=h;y++){
        ig.add(Object.assign(new THREE.Mesh(bB,y===h?MAT.bgGrass:y>0?MAT.bgDirt:MAT.stone),{position:new THREE.Vector3(x*0.7,y*0.7,z*0.7)}));
      }
    }}
    ig.position.set(px,py,pz);scene.add(ig);bgIslands.push(ig);
  }
}

// === PALM TREES ===
function createPalmTrees(){
  const positions=[[2.2,0,-1.3],[-1.8,0,2.2]];
  const trunkG=new THREE.BoxGeometry(0.3,0.6,0.3);
  const coconutG=new THREE.SphereGeometry(0.16,6,6);
  const coconutMat=new THREE.MeshLambertMaterial({color:0x5a3a18});
  for(const[px,,pz]of positions){
    const baseH=surfaceY(px,pz);
    const h=5+Math.floor(rand(-1,1));
    const tree=new THREE.Group();
    for(let i=0;i<h;i++){
      const seg=new THREE.Mesh(trunkG,i%2===0?MAT.wood:MAT.woodLight);
      seg.position.set(Math.sin(i*0.12)*0.15,i*0.6+0.3,0);
      seg.rotation.y=i*0.15;seg.castShadow=true;tree.add(seg);
    }
    const topY=h*0.6+0.3;
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2+rand(-0.15,0.15);
      const len=rand(1.4,2.4);
      const lGeo=new THREE.BoxGeometry(len,0.06,rand(0.25,0.4));
      const leaf=new THREE.Mesh(lGeo,i%2===0?MAT.leaf:MAT.leafLight);
      leaf.position.set(Math.cos(a)*len*0.35,topY+rand(-0.15,0.15),Math.sin(a)*len*0.35);
      leaf.rotation.y=a;leaf.rotation.z=rand(0.15,0.45);leaf.castShadow=true;tree.add(leaf);
    }
    for(let i=0;i<3;i++){
      const c=new THREE.Mesh(coconutG,coconutMat);
      c.position.set(rand(-0.2,0.2),topY-0.25,rand(-0.2,0.2));tree.add(c);
    }
    tree.position.set(px,baseH,pz);tree.scale.set(0.85,0.85,0.85);
    scene.add(tree);palmTrees.push(tree);
  }
}

// === HONEY POT (bigger, cute face) ===
function createHoneyPot(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.95,2,8),MAT.honeyPot);
  body.position.y=1;body.castShadow=true;g.add(body);
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.93,0.35,8),MAT.honeyPotLight);
  stripe.position.y=0.7;g.add(stripe);
  const stripe2=new THREE.Mesh(new THREE.CylinderGeometry(0.68,0.85,0.3,8),MAT.honeyPotLight);
  stripe2.position.y=1.3;g.add(stripe2);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.82,0.82,0.22,8),MAT.honeyRim);
  rim.position.y=2;g.add(rim);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.75,0.15,8),MAT.honeyRim);
  lid.position.y=2.15;g.add(lid);
  const hl=new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.58,0.12,8),MAT.honeyLiquid);
  hl.position.y=1.92;hl.name='honeyLevel';g.add(hl);
  // Honey drips
  const dripGeo=new THREE.BoxGeometry(0.1,0.4,0.1);
  for(let i=0;i<5;i++){
    const a=(i/5)*Math.PI*2+0.2;
    const drip=new THREE.Mesh(dripGeo,MAT.honeyDrip);
    drip.position.set(Math.cos(a)*0.75,1.3+rand(-0.3,0.2),Math.sin(a)*0.75);g.add(drip);
  }
  // Cute face — eyes
  const eyeG=new THREE.BoxGeometry(0.13,0.17,0.07);
  const eyeWG=new THREE.BoxGeometry(0.06,0.06,0.04);
  [[-0.24,1.15,0.78],[0.24,1.15,0.78]].forEach(p=>{
    g.add(Object.assign(new THREE.Mesh(eyeG,MAT.bearEye),{position:new THREE.Vector3(...p)}));
    g.add(Object.assign(new THREE.Mesh(eyeWG,MAT.bearEyeW),{position:new THREE.Vector3(p[0]+0.03,p[1]+0.05,p[2]+0.04)}));
  });
  // Smile
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.22,0.05,0.05),MAT.bearEye),{position:new THREE.Vector3(0,0.95,0.8)}));
  // Blush
  [[-0.35,1.02,0.78],[0.35,1.02,0.78]].forEach(p=>{
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.13,0.07,0.04),MAT.blush),{position:new THREE.Vector3(...p)}));
  });
  // Label
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.55,0.3,0.04),new THREE.MeshLambertMaterial({color:0xfff8dc})),{position:new THREE.Vector3(0,0.9,0.97)}));
  g.position.set(0,surfaceY(0,0)+0.05,0);
  g.scale.set(1.15,1.15,1.15);
  honeyMesh=g;scene.add(g);
}

// === PLAYER (Bear with tool) ===
function createPlayerModel(){
  playerGroup=new THREE.Group();
  const bx=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  const bp=(w,h,d,m,x,y,z)=>{const mesh=bx(w,h,d,m);mesh.position.set(x,y,z);return mesh;};
  playerGroup.add(bp(1.1,1,0.9,MAT.bear,0,0.5,0));
  playerGroup.add(bp(0.7,0.55,0.25,MAT.bearBelly,0,0.45,0.35));
  const head=bp(0.9,0.75,0.8,MAT.bear,0,1.35,0);head.castShadow=true;playerGroup.add(head);
  playerGroup.add(bp(0.35,0.25,0.2,MAT.bearBelly,0,1.2,0.45));
  [[-0.38,1.8,0],[0.38,1.8,0]].forEach(p=>{
    playerGroup.add(bp(0.3,0.3,0.25,MAT.bear,p[0],p[1],p[2]));
    playerGroup.add(bp(0.18,0.18,0.08,MAT.bearBelly,p[0],p[1],p[2]+0.12));
  });
  [[-0.2,1.45,0.42],[0.2,1.45,0.42]].forEach(p=>{
    playerGroup.add(bp(0.13,0.15,0.08,MAT.bearEye,p[0],p[1],p[2]));
    playerGroup.add(bp(0.06,0.06,0.04,MAT.bearEyeW,p[0]+0.03,p[1]+0.03,p[2]+0.04));
  });
  playerGroup.add(bp(0.18,0.1,0.12,MAT.bearNose,0,1.28,0.52));
  [[-0.35,1.3,0.42],[0.35,1.3,0.42]].forEach(p=>playerGroup.add(bp(0.15,0.08,0.04,MAT.blush,p[0],p[1],p[2])));
  [[-0.7,0.5,0],[0.7,0.5,0]].forEach(p=>playerGroup.add(bp(0.25,0.6,0.25,MAT.bearLight,p[0],p[1],p[2])));
  [[-0.28,-0.1,0.1],[0.28,-0.1,0.1]].forEach(p=>playerGroup.add(bp(0.3,0.35,0.35,MAT.bear,p[0],p[1],p[2])));
  // Tool — fan/net
  playerGroup.add(bp(0.07,0.65,0.07,MAT.wood,0.82,0.7,0.15));
  playerGroup.add(bp(0.45,0.35,0.04,MAT.bearBelly,0.9,1.1,0.15));
  playerGroup.position.set(-1.5,surfaceY(-1.5,1)+0.8,1);
  scene.add(playerGroup);
}

// === BEE ===
function createBeeModel(){
  const g=new THREE.Group();
  const bp=(w,h,d,m,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);return mesh;};
  g.add(bp(0.45,0.4,0.5,MAT.bee,0,0,-0.2));
  for(let i=-1;i<=1;i++)g.add(bp(0.47,0.08,0.52,MAT.beeStripe,0,i*0.12,-0.2));
  g.add(bp(0.35,0.35,0.3,MAT.bee,0,0.05,0.2));
  g.add(bp(0.3,0.3,0.28,MAT.bee,0,0.08,0.45));
  [[-0.12,0.14,0.6],[0.12,0.14,0.6]].forEach(p=>{
    g.add(bp(0.12,0.12,0.06,MAT.beeEyeW,p[0],p[1],p[2]));
    g.add(bp(0.07,0.07,0.04,MAT.beeEye,p[0],p[1]+0.01,p[2]+0.03));
  });
  const wG=new THREE.BoxGeometry(0.5,0.04,0.35);
  ['wingL1','wingR1','wingL2','wingR2'].forEach((n,i)=>{
    const w=new THREE.Mesh(wG,MAT.beeWing);
    const side=i%2===0?-1:1;const row=i<2?0:1;
    w.position.set(side*0.35,0.25-row*0.08,0.1-row*0.15);
    w.rotation.z=side*0.3;w.name=n;g.add(w);
  });
  g.add(bp(0.08,0.08,0.2,MAT.beeStripe,0,-0.05,-0.55));
  [[-0.08,0.28,0.55],[0.08,0.28,0.55]].forEach((p,i)=>{
    const ant=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.25,0.04),MAT.beeStripe);
    ant.position.set(...p);ant.rotation.z=(i===0?1:-1)*0.3;ant.rotation.x=-0.3;g.add(ant);
  });
  for(let i=0;i<3;i++){
    [[-0.2,-0.2,0.1-i*0.15],[0.2,-0.2,0.1-i*0.15]].forEach(p=>g.add(bp(0.04,0.15,0.04,MAT.beeStripe,p[0],p[1],p[2])));
  }
  g.scale.set(0.8,0.8,0.8);return g;
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
    const a=(i/10)*Math.PI*2,r=0.5;
    const seg=new THREE.Mesh(sG,MAT.donutDough);
    seg.position.set(Math.cos(a)*r,0,Math.sin(a)*r);seg.rotation.y=-a;seg.castShadow=true;g.add(seg);
    const top=new THREE.Mesh(tG,icM);
    top.position.set(Math.cos(a)*r,0.14,Math.sin(a)*r);top.rotation.y=-a;g.add(top);
    if(Math.random()>0.5){
      const sp=new THREE.Mesh(spG,spM[Math.floor(Math.random()*3)]);
      sp.position.set(Math.cos(a)*r+rand(-0.05,0.05),0.2,Math.sin(a)*r+rand(-0.05,0.05));g.add(sp);
    }
  }
  return g;
}

// === CLOUDS (fluffier, whiter) ===
function createClouds(){
  const B=new THREE.BoxGeometry(0.8,0.8,0.8);
  const defs=[{x:-14,y:12,z:-10,s:1.3},{x:12,y:14,z:-14,s:1.6},{x:-6,y:11,z:16,s:1.1},{x:16,y:13,z:6,s:1.4},{x:-10,y:15,z:8,s:1},{x:8,y:12,z:12,s:1.2},{x:0,y:16,z:-18,s:1.5},{x:-18,y:13,z:-5,s:1.1}];
  for(const cd of defs){
    const cg=new THREE.Group();
    const w=Math.floor(rand(4,7)),h=Math.floor(rand(2,3)),d=Math.floor(rand(3,5));
    for(let x=0;x<w;x++){for(let z=0;z<d;z++){
      const maxY=h-Math.abs(x-w/2)*0.4-Math.abs(z-d/2)*0.25;
      for(let y=0;y<maxY;y++){
        if(Math.random()>0.15){
          const b=new THREE.Mesh(B,y>=Math.floor(maxY)-1?MAT.cloudBright:MAT.cloud);
          b.position.set(x-w/2,y,z-d/2);cg.add(b);
        }
      }
    }}
    cg.position.set(cd.x,cd.y,cd.z);cg.scale.set(cd.s,cd.s*0.5,cd.s);
    cg.userData={baseX:cd.x,speed:rand(0.003,0.008),baseZ:cd.z};
    scene.add(cg);clouds.push(cg);
  }
}

// === OCEAN ===
function createOcean(){
  const geo=new THREE.PlaneGeometry(120,120,70,70);
  oceanMesh=new THREE.Mesh(geo,MAT.ocean);
  oceanMesh.rotation.x=-Math.PI/2;oceanMesh.position.y=-2.5;
  oceanMesh.receiveShadow=true;scene.add(oceanMesh);
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(120,120),MAT.oceanDeep);
  deep.rotation.x=-Math.PI/2;deep.position.y=-4;scene.add(deep);
  const foamGeo=new THREE.RingGeometry(4,5.5,32);
  const foam=new THREE.Mesh(foamGeo,MAT.foam);
  foam.rotation.x=-Math.PI/2;foam.position.y=-1.8;foam.name='foam';
  scene.add(foam);waterFoam.push(foam);
}

function animateOcean(time){
  if(!oceanMesh)return;
  const pos=oceanMesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getY(i);
    const wave=Math.sin(x*0.25+time*1.8)*0.35+Math.sin(z*0.3+time*1.4)*0.25+Math.sin((x+z)*0.15+time*0.9)*0.2+Math.cos(x*0.4-z*0.2+time*2.2)*0.12;
    pos.setZ(i,wave);
  }
  pos.needsUpdate=true;
  for(const f of waterFoam){f.rotation.z=time*0.05;f.material.opacity=0.3+Math.sin(time*2)*0.1;}
}

// === SCENE SETUP ===
function initScene(container){
  containerEl=container;scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87ceeb);scene.fog=new THREE.FogExp2(0xa0d8ef,0.008);
  const aspect=container.clientWidth/container.clientHeight;
  const fov=aspect<1?55:40;
  camera=new THREE.PerspectiveCamera(fov,aspect,0.1,150);
  const camD=aspect<1?22:18;
  camera.position.set(0,aspect<1?18:16,camD);camera.lookAt(0,2,0);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(container.clientWidth,container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',zIndex:'1',touchAction:'none'});
  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  const dl=new THREE.DirectionalLight(0xfff5e6,1.1);
  dl.position.set(10,18,12);dl.castShadow=true;
  dl.shadow.mapSize.set(1024,1024);dl.shadow.camera.near=0.5;dl.shadow.camera.far=50;
  dl.shadow.camera.top=15;dl.shadow.camera.bottom=-15;dl.shadow.camera.left=-15;dl.shadow.camera.right=15;
  scene.add(dl);scene.add(new THREE.HemisphereLight(0x87ceeb,0x1a6b8a,0.35));
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-3);
  clock=new THREE.Clock();initMaterials();
}

// === INPUT (tap-to-repel bees) ===
function getWorldPos(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  pointer.x=((cx-r.left)/r.width)*2-1;pointer.y=-((cy-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const t=new THREE.Vector3();raycaster.ray.intersectPlane(groundPlane,t);return t;
}
function onPD(e){
  if(!active)return;e.preventDefault();touching=true;
  const p=getWorldPos(e.clientX,e.clientY);if(!p)return;
  // Check tap-to-repel on bees
  let tappedBee=null,minD=CFG.tapRepelRadius;
  for(const b of beeObjects){
    const dx=b.mesh.position.x-p.x,dz=b.mesh.position.z-p.z;
    const d=Math.hypot(dx,dz);
    if(d<minD){minD=d;tappedBee=b;}
  }
  if(tappedBee&&tappedBee.stunTime<=0){
    const dx=tappedBee.mesh.position.x,dz=tappedBee.mesh.position.z;
    const d=Math.hypot(dx,dz)||1;
    tappedBee.knockVx=(dx/d)*1.2;tappedBee.knockVz=(dz/d)*1.2;
    tappedBee.stunTime=1500;score+=CFG.tapRepelPoints;beesRepelled++;
    shakeTime=150;updateHUD();SFX.buzz();
    // Particle burst
    const pg=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),MAT.windPuff.clone());
    pg.position.copy(tappedBee.mesh.position);scene.add(pg);
    particles.push({mesh:pg,scale:1,life:1});
  }else{tx=p.x;ty=p.z;}
}
function onPM(e){if(!active||!touching)return;e.preventDefault();const p=getWorldPos(e.clientX,e.clientY);if(p){tx=p.x;ty=p.z;}}
function onPU(){touching=false;}

// === GAME LOGIC ===
function updatePlayer(dt){
  if(!player.alive||!playerGroup)return;
  if(touching){const dx=tx-playerGroup.position.x,dz=ty-playerGroup.position.z,d=Math.hypot(dx,dz);
    if(d>0.2){const m=Math.min(CFG.playerSpeed*dt*60,d*0.15);playerGroup.position.x+=(dx/d)*m;playerGroup.position.z+=(dz/d)*m;playerGroup.rotation.y=Math.atan2(dx,dz);}}
  playerGroup.position.x=clp(playerGroup.position.x,-3.5,3.5);playerGroup.position.z=clp(playerGroup.position.z,-3.5,3.5);
  const potR=1.3;const distPot=Math.hypot(playerGroup.position.x,playerGroup.position.z);
  if(distPot<potR&&distPot>0.01){const ang=Math.atan2(playerGroup.position.z,playerGroup.position.x);playerGroup.position.x=Math.cos(ang)*potR;playerGroup.position.z=Math.sin(ang)*potR;}
  const sy=surfaceY(playerGroup.position.x,playerGroup.position.z);
  playerGroup.position.y=sy+0.8+Math.sin(performance.now()/500)*0.08;
}

function autoShoot(now){
  if(!player.alive||now-lastShot<CFG.shootInterval||beeObjects.length===0)return;
  lastShot=now;let near=null,nd=Infinity;
  for(const b of beeObjects){if(b.stunTime>0)continue;const dx=b.mesh.position.x-playerGroup.position.x,dz=b.mesh.position.z-playerGroup.position.z;const d=Math.hypot(dx,dz);if(d<nd){nd=d;near=b;}}
  if(!near)return;
  const dx=near.mesh.position.x-playerGroup.position.x,dz=near.mesh.position.z-playerGroup.position.z,d=Math.hypot(dx,dz)||1;
  const p=new THREE.Mesh(new THREE.SphereGeometry(0.18,6,6),MAT.windPuff.clone());
  p.position.copy(playerGroup.position);p.position.y+=0.8;scene.add(p);
  windObjects.push({mesh:p,vx:(dx/d)*CFG.windSpeed,vz:(dz/d)*CFG.windSpeed,born:now,life:1});SFX.puff();
}

function updateWinds(dt,now){
  for(let i=windObjects.length-1;i>=0;i--){const w=windObjects[i];
    w.mesh.position.x+=w.vx*dt*60;w.mesh.position.z+=w.vz*dt*60;w.mesh.scale.multiplyScalar(1.02);w.life-=0.015*dt*60;w.mesh.material.opacity=w.life*0.5;
    if(w.life<=0||now-w.born>2000){scene.remove(w.mesh);w.mesh.geometry.dispose();w.mesh.material.dispose();windObjects.splice(i,1);}}
}

function spawnBee(){
  const sm=1+diff*0.07;const a=rand(0,Math.PI*2),d=rand(10,16);
  const mesh=createBeeModel();mesh.position.set(Math.cos(a)*d,rand(5,8),Math.sin(a)*d);scene.add(mesh);
  beeObjects.push({mesh,speed:rand(0.038,0.075)*sm,phase:rand(0,Math.PI*2),knockVx:0,knockVz:0,stunTime:0,targetY:rand(4.5,6.5)});
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
  const a=rand(0,Math.PI*2),d=rand(1.5,3.5);const mesh=createDonutModel();
  const dx=Math.cos(a)*d,dz=Math.sin(a)*d;
  const sy=surfaceY(dx,dz);
  mesh.position.set(dx,sy+2.5,dz);scene.add(mesh);
  donutObjects.push({mesh,born:performance.now(),life:8000,baseY:sy+2.5});
}

function updateDonuts(dt,now){
  for(let i=donutObjects.length-1;i>=0;i--){const d=donutObjects[i];
    d.mesh.rotation.y+=0.025*dt*60;d.mesh.position.y=(d.baseY||6)+Math.sin(now/500+i)*0.3;
    if(playerGroup){const dx=d.mesh.position.x-playerGroup.position.x,dz=d.mesh.position.z-playerGroup.position.z;
      if(Math.hypot(dx,dz)<1.5){score+=CFG.donutPoints;donutsCollected++;updateHUD();SFX.pickup();scene.remove(d.mesh);donutObjects.splice(i,1);continue;}}
    if(now-d.born>d.life){scene.remove(d.mesh);donutObjects.splice(i,1);}
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.scale+=0.3*dt*60;p.life-=0.03*dt*60;p.mesh.scale.set(p.scale,p.scale,p.scale);p.mesh.material.opacity=p.life*0.4;
    if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}
}

function checkCollisions(now){
  for(let wi=windObjects.length-1;wi>=0;wi--){const w=windObjects[wi];
    for(const b of beeObjects){const dx=b.mesh.position.x-w.mesh.position.x,dz=b.mesh.position.z-w.mesh.position.z,dy=b.mesh.position.y-w.mesh.position.y;
      if(Math.sqrt(dx*dx+dz*dz+dy*dy)<1.5){const d=Math.hypot(dx,dz)||1;b.knockVx=(dx/d)*CFG.windPush*0.15;b.knockVz=(dz/d)*CFG.windPush*0.15;b.stunTime=600;score+=CFG.beePoints;beesRepelled++;updateHUD();SFX.buzz();scene.remove(w.mesh);w.mesh.geometry.dispose();w.mesh.material.dispose();windObjects.splice(wi,1);break;}}}
  // Bees reach honey
  for(let i=beeObjects.length-1;i>=0;i--){const b=beeObjects[i];if(b.stunTime>0)continue;
    if(Math.hypot(b.mesh.position.x,b.mesh.position.z)<1.8&&b.mesh.position.y<6){
      score=Math.max(0,score-CFG.beePenalty);honey.hp=Math.max(0,honey.hp-4);shakeTime=200;updateHUD();SFX.steal();scene.remove(b.mesh);beeObjects.splice(i,1);}}
  // Remove far bees
  for(let i=beeObjects.length-1;i>=0;i--){if(Math.hypot(beeObjects[i].mesh.position.x,beeObjects[i].mesh.position.z)>30){scene.remove(beeObjects[i].mesh);beeObjects.splice(i,1);}}
}

// === HUD ===
function updateHUD(){
  const s=document.getElementById('hud-score'),t=document.getElementById('hud-time'),tb=document.getElementById('hud-timer-bar');
  const remaining=Math.max(0,CFG.gameDuration-survTime);
  if(s)s.textContent=score;if(t)t.textContent=Math.ceil(remaining)+'s';
  if(tb)tb.style.width=(remaining/CFG.gameDuration*100)+'%';
  const hp=document.getElementById('hud-honey');
  if(hp&&honey)hp.style.width=(honey.hp/honey.maxHp*100)+'%';
  const dn=document.getElementById('hud-donuts');
  if(dn)dn.textContent='🍩 ×'+donutsCollected;
}

function updateDiff(dt,now){
  survTime+=dt;diff=1+Math.floor(survTime/6);
  if(survTime>=CFG.gameDuration){SFX.gameOver();setTimeout(endGame,800);active=false;return;}
  const spawnInt=Math.max(CFG.spawnMin,CFG.spawnStart-diff*180);
  if(now-lastSpawn>spawnInt&&beeObjects.length<CFG.maxBees){spawnBee();lastSpawn=now;if(diff>=2&&Math.random()<0.4)spawnBee();if(diff>=4&&Math.random()<0.35)spawnBee();}
  if(now-lastDonut>CFG.donutInterval){spawnDonut();lastDonut=now;}
  updateHUD();
}

function updateCamera(time){
  const aspect=containerEl?containerEl.clientWidth/containerEl.clientHeight:1;
  const a=time*0.08;
  const d=aspect<1?22:17,h=aspect<1?18:15;
  // Screen shake
  let sx=0,sy=0;
  if(shakeTime>0){sx=Math.sin(time*80)*shakeTime*0.0003;sy=Math.cos(time*90)*shakeTime*0.0002;}
  camera.position.set(Math.sin(a)*d+sx,h+sy,Math.cos(a)*d);camera.lookAt(0,2,0);
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
  if(shakeTime>0)shakeTime=Math.max(0,shakeTime-dt*1000);
  for(const t of palmTrees){t.children.forEach((c,i)=>{if(i>=5)c.rotation.z=0.3+Math.sin(el*1.5+i)*0.1;});}
  for(const c of clouds){c.position.x=c.userData.baseX+Math.sin(el*c.userData.speed*20)*10;}
  if(honeyMesh){const hy=surfaceY(0,0)+0.05;honeyMesh.position.y=hy+Math.sin(el*1.2)*0.06;}
  renderer.render(scene,camera);
}

// === START/STOP ===
function start(container){
  cleanup();initScene(container);createOcean();createIsland();createBackgroundIslands();createPalmTrees();createHoneyPot();createPlayerModel();createClouds();
  active=true;lastShot=0;lastSpawn=0;lastDonut=0;survTime=0;diff=1;score=0;beesRepelled=0;donutsCollected=0;shakeTime=0;
  honey={hp:CFG.honeyHP,maxHp:CFG.honeyHP};player={alive:true};tx=-1.5;ty=1;touching=false;
  renderer.domElement.addEventListener('pointerdown',onPD,{passive:false});renderer.domElement.addEventListener('pointermove',onPM,{passive:false});
  renderer.domElement.addEventListener('pointerup',onPU);renderer.domElement.addEventListener('pointercancel',onPU);
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');
  const na=document.getElementById('lb-name-input-area');if(na)na.classList.remove('visible');
  window._honeyResize=()=>{if(!renderer||!camera)return;const a=containerEl.clientWidth/containerEl.clientHeight;camera.aspect=a;camera.fov=a<1?55:40;camera.updateProjectionMatrix();renderer.setSize(containerEl.clientWidth,containerEl.clientHeight);};
  window.addEventListener('resize',window._honeyResize);
  updateHUD();clock.start();af=requestAnimationFrame(loop);
}

function cleanup(){
  if(renderer){renderer.domElement.removeEventListener('pointerdown',onPD);renderer.domElement.removeEventListener('pointermove',onPM);renderer.domElement.removeEventListener('pointerup',onPU);renderer.domElement.removeEventListener('pointercancel',onPU);
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);renderer.dispose();renderer=null;}
  if(window._honeyResize)window.removeEventListener('resize',window._honeyResize);
  if(scene){while(scene.children.length>0)scene.remove(scene.children[0]);}
  beeObjects=[];windObjects=[];donutObjects=[];particles=[];clouds=[];waterFoam=[];palmTrees=[];bgIslands=[];
  scene=null;camera=null;islandGroup=null;honeyMesh=null;playerGroup=null;oceanMesh=null;
}

function stop(){active=false;cancelAnimationFrame(af);cleanup();const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');}
function replay(c){stop();start(c);}

return{start,stop,end:endGame,replay,get active(){return active},get score(){return score}};
})();
