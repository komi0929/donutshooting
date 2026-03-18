/* HONEY ISLAND DEFENSE — Protect the Honey from Bees! */
const GameEngine=(()=>{'use strict';

// === CONFIG ===
const CFG={
  islandR:70,honeyHP:100,playerR:14,playerSpeed:5.5,
  shootInterval:200,windSpeed:10,windR:6,windLife:600,windPush:8,
  spawnStart:2200,spawnMin:500,maxBees:20,
  shakeDecay:0.9,starCount:0,
};

// Colors — ocean & island palette
const C={
  sky:'#87CEEB',ocean:'#1a6b8a',oceanDeep:'#0e4d6b',oceanLight:'#2d9ac2',
  sand:'#f5deb3',sandDark:'#d4b896',sandLight:'#fff3d9',
  grass:'#6ab04c',grassDark:'#4a8a2c',grassLight:'#8cd664',
  honey:'#FFD700',honeyDark:'#DAA520',honeyLight:'#FFF8DC',
  bee:'#FFD700',beeStripe:'#1a1a1a',beeWing:'rgba(200,230,255,0.35)',
  wood:'#8B6914',woodDark:'#6b4f10',
  white:'#fff',pink:'#ff8fab',red:'#ff4444',
};

// SFX
const SFX=(()=>{let ac=null,m=null;
function e(){if(ac)return 1;try{ac=new(window.AudioContext||window.webkitAudioContext)();m=ac.createGain();m.gain.value=0.2;m.connect(ac.destination);return 1}catch(e){return 0}}
function g(v){const gn=ac.createGain();gn.gain.value=v;gn.connect(m);return gn}
function puff(){if(!e())return;const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*.08,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.max(0,1-i/d.length);const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=800;const gn=g(.12);s.connect(f);f.connect(gn);gn.gain.exponentialRampToValueAtTime(.001,t+.1);s.start(t)}
function buzz(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(120,t+.2);const gn=g(.06);gn.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(gn);o.start(t);o.stop(t+.25)}
function steal(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(200,t+.3);const gn=g(.12);gn.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(gn);o.start(t);o.stop(t+.35)}
function gameOver(){if(!e())return;const t=ac.currentTime;[330,262].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.15);gn.gain.setValueAtTime(.001,t+i*.3);gn.gain.linearRampToValueAtTime(.15,t+i*.3+.05);gn.gain.exponentialRampToValueAtTime(.001,t+i*.3+.5);o.connect(gn);o.start(t+i*.3);o.stop(t+i*.3+.55)})}
return{puff,buzz,steal,gameOver}})();

// STATE
let active=false,_c,_x,W,H,af,lt=0;
let player=null,tx,ty,touching=false;
let winds=[],bees=[],particles=[],texts=[];
let lastShot=0,lastSpawn=0;
let shake={x:0,y:0,i:0},flash=0;
let honey=null,survTime=0,diff=1;
let waves=[]; // ocean waves
let highScore=parseFloat(localStorage.getItem('honey_hightime')||'0');
const isMob='ontouchstart'in window||navigator.maxTouchPoints>0;

// HELPERS
const rand=(a,b)=>a+Math.random()*(b-a);
const dst=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clp=(v,l,h)=>v<l?l:v>h?h:v;
const lrp=(a,b,t)=>a+(b-a)*t;

// === OCEAN BACKGROUND ===
function initWaves(){
  waves=[];
  for(let i=0;i<8;i++){
    waves.push({y:H*0.3+i*(H*0.1),amp:rand(3,8),freq:rand(0.005,0.015),speed:rand(0.0005,0.002),phase:rand(0,Math.PI*2),alpha:0.08+i*0.02});
  }
}

function drawOcean(ctx,now){
  // Sky gradient
  const skyGr=ctx.createLinearGradient(0,0,0,H*0.4);
  skyGr.addColorStop(0,'#bae6fd');skyGr.addColorStop(1,'#7dd3fc');
  ctx.fillStyle=skyGr;ctx.fillRect(0,0,W,H*0.4);
  // Ocean gradient
  const oceanGr=ctx.createLinearGradient(0,H*0.3,0,H);
  oceanGr.addColorStop(0,C.oceanLight);oceanGr.addColorStop(0.3,C.ocean);oceanGr.addColorStop(1,C.oceanDeep);
  ctx.fillStyle=oceanGr;ctx.fillRect(0,H*0.3,W,H*0.7);
  // Animated waves
  for(const w of waves){
    ctx.beginPath();ctx.moveTo(0,w.y);
    for(let x=0;x<=W;x+=8){
      const y=w.y+Math.sin(x*w.freq+now*w.speed+w.phase)*w.amp;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
    ctx.fillStyle=`rgba(255,255,255,${w.alpha})`;ctx.fill();
  }
  // Sun reflection sparkles
  for(let i=0;i<6;i++){
    const sx=W*0.3+i*W*0.08+Math.sin(now/1500+i)*15;
    const sy=H*0.35+Math.sin(now/800+i*1.5)*5;
    const sparkle=Math.sin(now/400+i*2)*.5+.5;
    ctx.globalAlpha=sparkle*0.4;
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(sx,sy,1.5+sparkle,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // Clouds
  drawClouds(ctx,now);
}

function drawClouds(ctx,now){
  ctx.globalAlpha=0.6;ctx.fillStyle='#fff';
  const clouds=[{x:W*0.15,y:H*0.08,s:1},{x:W*0.55,y:H*0.12,s:0.7},{x:W*0.85,y:H*0.06,s:0.9}];
  for(const cl of clouds){
    const cx=((cl.x+now*0.01)%( W+100))-50;
    ctx.beginPath();
    ctx.arc(cx,cl.y,20*cl.s,0,Math.PI*2);
    ctx.arc(cx+18*cl.s,cl.y-5*cl.s,15*cl.s,0,Math.PI*2);
    ctx.arc(cx+30*cl.s,cl.y,18*cl.s,0,Math.PI*2);
    ctx.arc(cx+12*cl.s,cl.y+3*cl.s,12*cl.s,0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}

// === ISLAND ===
function drawIsland(ctx,now){
  const ix=W/2,iy=H/2;
  const bob=Math.sin(now/2000)*3;// gentle bob on water
  ctx.save();ctx.translate(0,bob);

  // Water ring/splash around island
  ctx.globalAlpha=0.15;ctx.strokeStyle='#fff';ctx.lineWidth=2;
  ctx.beginPath();
  for(let a=0;a<Math.PI*2;a+=0.05){
    const r=CFG.islandR+12+Math.sin(a*6+now/500)*3;
    const px=ix+Math.cos(a)*r,py=iy+Math.sin(a)*r*0.5;
    a===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.stroke();ctx.globalAlpha=1;

  // Island shadow on water
  ctx.fillStyle='rgba(0,40,60,0.2)';
  ctx.beginPath();ctx.ellipse(ix,iy+15,CFG.islandR+5,CFG.islandR*0.35,0,0,Math.PI*2);ctx.fill();

  // Beach/sand base
  ctx.fillStyle=C.sand;
  ctx.beginPath();ctx.ellipse(ix,iy,CFG.islandR,CFG.islandR*0.5,0,0,Math.PI*2);ctx.fill();
  // Sand texture rings
  ctx.strokeStyle=C.sandDark;ctx.lineWidth=0.5;ctx.globalAlpha=0.3;
  ctx.beginPath();ctx.ellipse(ix,iy,CFG.islandR*0.9,CFG.islandR*0.45,0,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.ellipse(ix,iy,CFG.islandR*0.7,CFG.islandR*0.35,0,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=1;

  // Grass on top
  ctx.fillStyle=C.grass;
  ctx.beginPath();ctx.ellipse(ix,iy-5,CFG.islandR*0.65,CFG.islandR*0.32,0,0,Math.PI*2);ctx.fill();
  // Grass highlights
  ctx.fillStyle=C.grassLight;ctx.globalAlpha=0.4;
  ctx.beginPath();ctx.ellipse(ix-10,iy-10,CFG.islandR*0.3,CFG.islandR*0.15,-.2,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;

  // Small palm tree
  const px=ix+CFG.islandR*0.35,py=iy-CFG.islandR*0.15;
  ctx.strokeStyle=C.wood;ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+3,py-30,px-2,py-45);ctx.stroke();
  // Palm leaves
  const leafAngs=[-0.8,-0.3,0.2,0.7,1.2];
  ctx.strokeStyle=C.grassDark;ctx.lineWidth=2;
  for(const la of leafAngs){
    const lx=px-2+Math.cos(la)*25,ly=py-45+Math.sin(la)*12+Math.sin(now/1000+la)*2;
    ctx.beginPath();ctx.moveTo(px-2,py-45);ctx.quadraticCurveTo(px-2+Math.cos(la)*12,py-50+Math.sin(la)*5,lx,ly);ctx.stroke();
  }

  // Small flowers on grass
  const flowers=[{x:ix-20,y:iy-8,c:'#ff8fab'},{x:ix-5,y:iy-15,c:'#ffd700'},{x:ix+15,y:iy-5,c:'#ff6b6b'}];
  for(const fl of flowers){ctx.fillStyle=fl.c;ctx.beginPath();ctx.arc(fl.x,fl.y+bob,2.5,0,Math.PI*2);ctx.fill();}

  ctx.restore();
}

// === HONEY POT ===
function createHoney(){return{x:W/2,y:H/2,hp:CFG.honeyHP,maxHp:CFG.honeyHP};}

function drawHoney(ctx,now){
  if(!honey)return;
  const hx=honey.x,hy=honey.y-8;
  const bob=Math.sin(now/2000)*3;
  const hpR=honey.hp/honey.maxHp;
  ctx.save();ctx.translate(0,bob);

  // Honey pot (cute jar shape)
  const pw=22,ph=24;
  // Pot body
  ctx.fillStyle=C.wood;
  ctx.beginPath();
  ctx.moveTo(hx-pw,hy);ctx.lineTo(hx-pw+3,hy+ph);
  ctx.quadraticCurveTo(hx,hy+ph+6,hx+pw-3,hy+ph);
  ctx.lineTo(hx+pw,hy);ctx.closePath();ctx.fill();
  // Pot highlight
  ctx.fillStyle=C.woodDark;ctx.globalAlpha=0.3;
  ctx.fillRect(hx-pw+5,hy+2,3,ph-2);ctx.globalAlpha=1;
  // Honey inside (level based on HP)
  const honeyH=ph*hpR;
  const honeyTop=hy+ph-honeyH;
  ctx.fillStyle=C.honey;
  ctx.beginPath();
  ctx.moveTo(hx-pw+3,hy+ph);ctx.quadraticCurveTo(hx,hy+ph+6,hx+pw-3,hy+ph);
  ctx.lineTo(hx+pw-2,honeyTop);
  ctx.quadraticCurveTo(hx,honeyTop-3,hx-pw+2,honeyTop);
  ctx.closePath();ctx.fill();
  // Honey shine
  ctx.fillStyle=C.honeyLight;ctx.globalAlpha=0.4;
  ctx.beginPath();ctx.ellipse(hx-5,honeyTop+(ph*hpR)/2,6,honeyH*0.3,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;
  // Pot rim
  ctx.fillStyle='#9B7B2C';
  ctx.fillRect(hx-pw-2,hy-3,pw*2+4,6);
  ctx.fillStyle=C.woodDark;
  ctx.fillRect(hx-pw-2,hy-3,pw*2+4,2);
  // Pot label "HONEY"
  ctx.fillStyle=C.sandLight;ctx.font='bold 7px "Outfit",sans-serif';ctx.textAlign='center';
  ctx.fillText('HONEY',hx,hy+ph*0.55);

  // Dripping honey effect
  if(hpR<0.8){
    const drip=Math.sin(now/500)*2;
    ctx.fillStyle=C.honey;ctx.globalAlpha=0.7;
    ctx.beginPath();ctx.ellipse(hx+pw-5,hy+ph+2+drip,2,3+drip,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.restore();

  // HP bar below
  const bw=50,bh=5,bx=hx-bw/2,by=hy+bob+ph+16;
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(bx,by,bw,bh);
  const hc=hpR>0.5?C.honey:hpR>0.25?'#ff8c00':C.red;
  ctx.fillStyle=hc;ctx.fillRect(bx,by,bw*hpR,bh);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=0.5;ctx.strokeRect(bx,by,bw,bh);
  // Percentage
  ctx.fillStyle=C.white;ctx.font='bold 10px "Outfit",sans-serif';ctx.textAlign='center';
  ctx.globalAlpha=0.7;ctx.fillText(`${Math.ceil(honey.hp)}%`,hx,by+bh+12);ctx.globalAlpha=1;
}

// === PLAYER (cute bear cub) ===
function createPlayer(){return{x:W/2-40,y:H/2,trail:[],alive:true,angle:0};}

function updatePlayer(dt){
  if(!player.alive)return;
  if(touching){const dx=tx-player.x,dy=ty-player.y,d=Math.hypot(dx,dy);
    if(d>3){const m=Math.min(CFG.playerSpeed,d*.15);player.x+=(dx/d)*m;player.y+=(dy/d)*m;}}
  player.x=clp(player.x,CFG.playerR,W-CFG.playerR);player.y=clp(player.y,CFG.playerR,H-CFG.playerR);
  // Aim at nearest bee
  let near=null,nd=Infinity;for(const b of bees){const d=dst(player,b);if(d<nd){nd=d;near=b;}}
  if(near)player.angle=Math.atan2(near.y-player.y,near.x-player.x);
  player.trail.unshift({x:player.x,y:player.y});if(player.trail.length>6)player.trail.pop();
}

function drawPlayer(ctx,now){
  if(!player.alive)return;
  const x=player.x,y=player.y,r=CFG.playerR;
  const bob=Math.sin(now/2000)*3;
  ctx.save();ctx.translate(x,y+bob);

  // Body (round, brown — bear cub)
  ctx.fillStyle='#8B6914';
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  // Belly
  ctx.fillStyle='#D2B48C';
  ctx.beginPath();ctx.arc(0,r*0.15,r*0.6,0,Math.PI*2);ctx.fill();
  // Ears
  ctx.fillStyle='#8B6914';
  ctx.beginPath();ctx.arc(-r*0.65,-r*0.65,r*0.35,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(r*0.65,-r*0.65,r*0.35,0,Math.PI*2);ctx.fill();
  // Inner ears
  ctx.fillStyle='#D2B48C';
  ctx.beginPath();ctx.arc(-r*0.65,-r*0.65,r*0.2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(r*0.65,-r*0.65,r*0.2,0,Math.PI*2);ctx.fill();
  // Eyes
  ctx.fillStyle='#222';
  ctx.beginPath();ctx.arc(-r*0.25,-r*0.15,2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(r*0.25,-r*0.15,2,0,Math.PI*2);ctx.fill();
  // Eye shine
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-r*0.22,-r*0.18,0.8,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(r*0.22,-r*0.18,0.8,0,Math.PI*2);ctx.fill();
  // Nose
  ctx.fillStyle='#333';
  ctx.beginPath();ctx.ellipse(0,-r*0.02,2.5,2,0,0,Math.PI*2);ctx.fill();
  // Mouth
  ctx.strokeStyle='#333';ctx.lineWidth=0.8;
  ctx.beginPath();ctx.arc(-2,r*0.05,2.5,0,Math.PI);ctx.stroke();
  ctx.beginPath();ctx.arc(2,r*0.05,2.5,0,Math.PI);ctx.stroke();
  // Blush
  ctx.fillStyle='rgba(255,139,171,0.3)';
  ctx.beginPath();ctx.ellipse(-r*0.5,r*0.1,3,2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(r*0.5,r*0.1,3,2,0,0,Math.PI*2);ctx.fill();

  ctx.restore();

  // Direction indicator (fan/wind direction)
  ctx.save();ctx.translate(x,y+bob);ctx.rotate(player.angle);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(r+4,0);ctx.lineTo(r+18,0);ctx.stroke();
  ctx.setLineDash([]);
  // Small fan icon
  ctx.fillStyle='rgba(135,206,235,0.5)';
  for(let i=0;i<3;i++){
    const fa=i*Math.PI*2/3+now/500;
    ctx.beginPath();ctx.ellipse(r+22,0,6,2.5,fa,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

// === WIND PUFFS (projectiles that push bees) ===
function autoShoot(now){
  if(!player.alive||now-lastShot<CFG.shootInterval)return;
  if(bees.length===0)return;
  lastShot=now;
  let near=null,nd=Infinity;for(const b of bees){const d=dst(player,b);if(d<nd){nd=d;near=b;}}
  if(!near)return;
  const a=Math.atan2(near.y-player.y,near.x-player.x);
  winds.push({x:player.x,y:player.y,vx:Math.cos(a)*CFG.windSpeed,vy:Math.sin(a)*CFG.windSpeed,born:now,r:CFG.windR,alpha:0.7});
  SFX.puff();
}

function updateWinds(now){
  for(let i=winds.length-1;i>=0;i--){
    const w=winds[i];w.x+=w.vx;w.y+=w.vy;w.r+=0.15;w.alpha-=0.012;
    if(w.x<-30||w.x>W+30||w.y<-30||w.y>H+30||now-w.born>CFG.windLife||w.alpha<=0)winds.splice(i,1);
  }
}

function drawWinds(ctx,now){
  for(const w of winds){
    ctx.globalAlpha=w.alpha*0.6;
    // Swirl effect
    const gr=ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,w.r);
    gr.addColorStop(0,'rgba(255,255,255,0.6)');gr.addColorStop(0.5,'rgba(135,206,235,0.3)');gr.addColorStop(1,'rgba(135,206,235,0)');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(w.x,w.y,w.r,0,Math.PI*2);ctx.fill();
    // Swirl lines
    ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1;
    for(let s=0;s<3;s++){
      const sa=now/300+s*2.1,sr=w.r*0.6;
      ctx.beginPath();ctx.arc(w.x+Math.cos(sa)*sr*0.3,w.y+Math.sin(sa)*sr*0.3,sr*0.4,sa,sa+1.5);ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
}

// === BEES ===
function spawnBee(){
  const speedMult=1+diff*0.06;
  const side=Math.floor(Math.random()*4);let x,y;
  switch(side){case 0:x=rand(0,W);y=-30;break;case 1:x=W+30;y=rand(H*0.2,H);break;case 2:x=rand(0,W);y=H+30;break;case 3:x=-30;y=rand(H*0.2,H);break;}
  const baseSpeed=rand(0.8,1.5)*speedMult;
  bees.push({x,y,speed:baseSpeed,phase:rand(0,Math.PI*2),knockVx:0,knockVy:0,stunTime:0,dmg:rand(2,4)});
}

function updateBees(dt,now){
  for(const b of bees){
    // Apply knockback
    if(b.stunTime>0){b.stunTime-=dt;b.x+=b.knockVx;b.y+=b.knockVy;b.knockVx*=0.92;b.knockVy*=0.92;continue;}
    // Move toward honey with wobble
    const dx=honey.x-b.x,dy=honey.y-b.y,d=Math.hypot(dx,dy);
    if(d>1){
      const wobX=Math.sin(now/400+b.phase)*1.5;
      const wobY=Math.cos(now/350+b.phase)*0.8;
      b.x+=(dx/d)*b.speed+wobX;
      b.y+=(dy/d)*b.speed+wobY;
    }
    // Clamp to screen
    b.x=clp(b.x,-50,W+50);b.y=clp(b.y,-50,H+50);
  }
}

function drawBees(ctx,now){
  for(const b of bees){
    const angle=Math.atan2(honey.y-b.y,honey.x-b.x);
    const wobble=Math.sin(now/150+b.phase)*0.15;
    const stunned=b.stunTime>0;
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle+Math.PI/2+wobble);
    if(stunned){ctx.globalAlpha=0.5+Math.sin(now/50)*0.3;}

    const r=8;
    // Wings (flapping)
    const wingFlap=Math.sin(now/40+b.phase)*0.4;
    ctx.fillStyle=C.beeWing;
    ctx.beginPath();ctx.ellipse(-r*0.9,-r*0.3,r*0.9,r*0.35,-0.2+wingFlap,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(r*0.9,-r*0.3,r*0.9,r*0.35,0.2-wingFlap,0,Math.PI*2);ctx.fill();
    // Body
    ctx.fillStyle=C.bee;
    ctx.beginPath();ctx.ellipse(0,0,r*0.6,r,0,0,Math.PI*2);ctx.fill();
    // Stripes
    ctx.fillStyle=C.beeStripe;
    for(let s=-1;s<=1;s++){
      ctx.fillRect(-r*0.6,s*r*0.35-1.5,r*1.2,3);
    }
    // Head
    ctx.fillStyle=C.bee;
    ctx.beginPath();ctx.arc(0,-r*0.9,r*0.4,0,Math.PI*2);ctx.fill();
    // Eyes
    ctx.fillStyle='#111';
    ctx.beginPath();ctx.arc(-r*0.15,-r*0.95,1.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(r*0.15,-r*0.95,1.5,0,Math.PI*2);ctx.fill();
    // Antennae
    ctx.strokeStyle='#333';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.moveTo(-r*0.1,-r*1.2);ctx.quadraticCurveTo(-r*0.3,-r*1.6,-r*0.15,-r*1.5);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*0.1,-r*1.2);ctx.quadraticCurveTo(r*0.3,-r*1.6,r*0.15,-r*1.5);ctx.stroke();
    // Stinger
    ctx.fillStyle='#333';
    ctx.beginPath();ctx.moveTo(-2,r);ctx.lineTo(2,r);ctx.lineTo(0,r+5);ctx.closePath();ctx.fill();

    // Dizzy stars when stunned
    if(stunned){
      ctx.fillStyle=C.honey;
      for(let i=0;i<3;i++){
        const sa=now/200+i*2.1,sr=r+5;
        ctx.beginPath();ctx.arc(Math.cos(sa)*sr,Math.sin(sa)*sr-r*0.5,1.5,0,Math.PI*2);ctx.fill();
      }
    }

    ctx.restore();ctx.globalAlpha=1;
  }
}

// === COLLISIONS ===
function checkCollisions(now){
  // Winds push bees
  for(let wi=winds.length-1;wi>=0;wi--){
    const w=winds[wi];
    for(const b of bees){
      if(dst(w,b)<w.r+10){
        const dx=b.x-w.x,dy=b.y-w.y,d=Math.hypot(dx,dy)||1;
        b.knockVx=(dx/d)*CFG.windPush;b.knockVy=(dy/d)*CFG.windPush;
        b.stunTime=400;// stunned for 400ms
        spawnPuffParticles(b.x,b.y);
        winds.splice(wi,1);
        SFX.buzz();
        break;
      }
    }
  }
  // Bees reach honey
  for(let i=bees.length-1;i>=0;i--){
    const b=bees[i];
    if(b.stunTime>0)continue;
    if(dst(b,honey)<CFG.islandR*0.4){
      honey.hp=Math.max(0,honey.hp-b.dmg);
      addText(honey.x+rand(-20,20),honey.y+rand(-20,20),`-${Math.round(b.dmg)}%`,'#ff4444');
      shake.i=Math.max(shake.i,4);flash=0.15;
      SFX.steal();
      // Bee flies away satisfied (remove)
      spawnHoneyDrops(b.x,b.y);
      bees.splice(i,1);
      if(honey.hp<=0){honey.hp=0;SFX.gameOver();setTimeout(endGame,1200);}
    }
  }
  // Remove bees that flew too far from screen
  for(let i=bees.length-1;i>=0;i--){
    const b=bees[i];
    if(b.x<-100||b.x>W+100||b.y<-100||b.y>H+100)bees.splice(i,1);
  }
}

// === PARTICLES ===
function spawnPuffParticles(x,y){
  for(let i=0;i<6;i++){
    const a=rand(0,Math.PI*2),s=rand(1,3);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rand(2,5),color:'rgba(200,230,255,0.6)',alpha:0.7,life:1,decay:rand(.02,.04)});
  }
}
function spawnHoneyDrops(x,y){
  for(let i=0;i<4;i++){
    const a=rand(0,Math.PI*2),s=rand(1,3);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,r:rand(2,4),color:C.honey,alpha:1,life:1,decay:rand(.015,.03)});
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.vx*=.96;
    p.life-=p.decay;p.alpha=p.life;
    if(p.life<=0)particles.splice(i,1);
  }
}
function drawParticles(ctx){
  for(const p of particles){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}

function addText(x,y,text,color){texts.push({x,y,text,color,alpha:1,vy:-1.5,life:1,scale:1.4});}
function updateTexts(){for(let i=texts.length-1;i>=0;i--){const f=texts[i];f.y+=f.vy;f.life-=.02;f.alpha=f.life;if(f.scale>1)f.scale=lrp(f.scale,1,.12);if(f.life<=0)texts.splice(i,1);}}
function drawTexts(ctx){for(const f of texts){ctx.globalAlpha=f.alpha;ctx.save();ctx.translate(f.x,f.y);const s=f.scale||1;ctx.scale(s,s);ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=3;ctx.font='bold 14px "Outfit",sans-serif';ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeText(f.text,0,0);ctx.fillStyle=f.color;ctx.fillText(f.text,0,0);ctx.restore();}ctx.globalAlpha=1;}

// VFX
function updateShake(){shake.x=(Math.random()-.5)*shake.i;shake.y=(Math.random()-.5)*shake.i;shake.i*=CFG.shakeDecay;if(shake.i<.3)shake.i=0;}
function drawFlash(ctx){if(flash<=0)return;ctx.globalAlpha=flash;ctx.fillStyle='rgba(255,200,0,0.15)';ctx.fillRect(0,0,W,H);flash*=.88;if(flash<.01)flash=0;ctx.globalAlpha=1;}

// SAFE AREA
let safeT=0,safeB=0;
function detectSafe(){const p=document.createElement('div');p.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';document.body.appendChild(p);const cs=getComputedStyle(p);safeT=parseInt(cs.paddingTop)||0;safeB=parseInt(cs.paddingBottom)||0;document.body.removeChild(p);}

// HUD
function drawHUD(ctx,now){
  ctx.globalAlpha=1;const st=safeT+8;
  // Survival time
  const ts=survTime.toFixed(1)+'s';ctx.textAlign='center';
  ctx.shadowColor=C.honey;ctx.shadowBlur=6;ctx.fillStyle=C.honey;
  ctx.font='bold 26px "Outfit",sans-serif';ctx.fillText(ts,W/2,st+34);ctx.shadowBlur=0;
  ctx.fillStyle=C.white;ctx.font='bold 10px "Outfit",sans-serif';ctx.globalAlpha=.6;
  ctx.fillText('🍯 SURVIVAL TIME',W/2,st+14);ctx.globalAlpha=1;
  // Bee count
  ctx.textAlign='right';ctx.fillStyle=C.white;ctx.globalAlpha=.5;
  ctx.font='9px "Outfit",sans-serif';ctx.fillText(`🐝 ${bees.length}`,W-16,st+20);
  ctx.globalAlpha=1;
}

// DIFFICULTY
function updateDiff(dt,now){
  survTime+=dt/1e3;diff=1+Math.floor(survTime/12);
  const spawnInt=Math.max(CFG.spawnMin,CFG.spawnStart-diff*180);
  if(now-lastSpawn>spawnInt&&bees.length<CFG.maxBees){
    spawnBee();lastSpawn=now;
    if(diff>=3&&Math.random()<.3)spawnBee();
    if(diff>=5&&Math.random()<.25)spawnBee();
  }
}

// GAME OVER
function endGame(){
  active=false;cancelAnimationFrame(af);
  const isNew=survTime>highScore;if(isNew){highScore=survTime;localStorage.setItem('honey_hightime',String(highScore));}
  const ro=document.getElementById('game-result');if(ro){
    const rs=document.getElementById('result-score'),rh=document.getElementById('result-high'),rn=document.getElementById('result-new'),rk=document.getElementById('result-kills'),rw=document.getElementById('result-wave');
    if(rs)rs.textContent=survTime.toFixed(1)+'s';if(rh)rh.textContent=highScore.toFixed(1)+'s';if(rn)rn.style.display=isNew?'block':'none';if(rk)rk.textContent=bees.length;if(rw)rw.textContent=Math.floor(diff);
    ro.classList.add('visible');}
  if(typeof Leaderboard!=='undefined')Leaderboard.onGameOver(Math.round(survTime*10),Math.floor(diff),0);
}

// MAIN LOOP
function loop(ts){
  if(!active)return;const now=performance.now();const rawDt=lt?ts-lt:16;lt=ts;
  updatePlayer(rawDt);autoShoot(now);updateWinds(now);updateBees(rawDt,now);checkCollisions(now);
  updateParticles();updateTexts();updateShake();updateDiff(rawDt,now);
  _x.save();_x.translate(shake.x,shake.y);
  drawOcean(_x,now);drawIsland(_x,now);drawHoney(_x,now);drawWinds(_x,now);drawBees(_x,now);drawPlayer(_x,now);drawParticles(_x);drawTexts(_x);drawFlash(_x);drawHUD(_x,now);
  _x.restore();
  af=requestAnimationFrame(loop);
}

// INPUT
function onPD(e){if(!active)return;e.preventDefault();touching=true;const r=_c.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;}
function onPM(e){if(!active||!touching)return;e.preventDefault();const r=_c.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;}
function onPU(){touching=false;}

// START/STOP
function start(canvas,ctx){
  _c=canvas;_x=ctx;const dpr=window.devicePixelRatio||1;W=canvas.width/dpr;H=canvas.height/dpr;
  active=true;lastShot=0;lastSpawn=0;lt=0;
  winds=[];bees=[];particles=[];texts=[];
  shake={x:0,y:0,i:0};flash=0;survTime=0;diff=1;
  honey=createHoney();player=createPlayer();tx=player.x;ty=player.y;touching=false;
  detectSafe();initWaves();
  _c.addEventListener('pointerdown',onPD,{passive:false});_c.addEventListener('pointermove',onPM,{passive:false});_c.addEventListener('pointerup',onPU);_c.addEventListener('pointercancel',onPU);
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');
  const na=document.getElementById('lb-name-input-area');if(na)na.classList.remove('visible');
  af=requestAnimationFrame(loop);
}
function stop(){active=false;cancelAnimationFrame(af);winds=[];bees=[];particles=[];texts=[];
  if(_c){_c.removeEventListener('pointerdown',onPD);_c.removeEventListener('pointermove',onPM);_c.removeEventListener('pointerup',onPU);_c.removeEventListener('pointercancel',onPU);}
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');}
function replay(c,x){stop();start(c,x);}
return{start,stop,end:endGame,replay,get active(){return active},get score(){return survTime}};
})();
