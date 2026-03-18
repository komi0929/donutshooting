/* DONUT DEFENSE — 3D Polygon Edition */
const GameEngine=(()=>{'use strict';
const CFG={donutR:55,donutHP:100,playerR:16,playerSpeed:5,shootInterval:260,bulletSpeed:8,bulletR:4,bulletLifetime:800,spawnStart:2000,spawnMin:400,maxEnemies:30,powerUpChance:0.15,powerUpDur:5000,powerUpR:16,shakeDecay:0.88,starCount:40};
const CLR={pink:'#ff8fab',hot:'#ff4081',choco:'#3d1a0e',cream:'#fff5e6',vanilla:'#ffecd2',caramel:'#d4a574',mint:'#a8e6cf',berry:'#dda0dd',gold:'#ffd700',bg:'#2a1a0e',white:'#fff5e6'};
const ENEMIES={ant:{r:12,speed:1.2,hp:1,dmg:3,color:'#8B4513',accent:'#5c3a21'},fly:{r:10,speed:2.8,hp:1,dmg:2,color:'#2d8B2d',accent:'#1a5c1a'},mouse:{r:18,speed:0.9,hp:3,dmg:8,color:'#888',accent:'#666'},wasp:{r:20,speed:1.0,hp:5,dmg:5,color:'#FFD700',accent:'#FF8C00'}};
const POWERUPS=[{type:'shield',color:'#7b3f00',label:'CHOCO',icon:'🍫'},{type:'speed',color:'#a8e6cf',label:'SPEED',icon:'🍦'},{type:'multishot',color:'#ff8fab',label:'TRIPLE',icon:'✨'},{type:'heal',color:'#ff6b6b',label:'+DONUT',icon:'🍓'}];

// SFX
const SFX=(()=>{let ac=null,m=null;
function e(){if(ac)return 1;try{ac=new(window.AudioContext||window.webkitAudioContext)();m=ac.createGain();m.gain.value=0.25;m.connect(ac.destination);return 1}catch(e){return 0}}
function g(v){const gn=ac.createGain();gn.gain.value=v;gn.connect(m);return gn}
function shoot(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator(),gn=g(.1);o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(440,t+.05);gn.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(gn);o.start(t);o.stop(t+.07)}
function hit(){if(!e())return;const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*.03,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.4;const s=ac.createBufferSource();s.buffer=b;const gn=g(.08);s.connect(gn);gn.gain.exponentialRampToValueAtTime(.001,t+.03);s.start(t)}
function kill(){if(!e())return;const t=ac.currentTime,b=ac.createBuffer(1,ac.sampleRate*.15,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=ac.createBufferSource();s.buffer=b;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(2e3,t);f.frequency.exponentialRampToValueAtTime(200,t+.15);const gn=g(.15);s.connect(f);f.connect(gn);gn.gain.exponentialRampToValueAtTime(.001,t+.15);s.start(t)}
function donutHit(){if(!e())return;const t=ac.currentTime,o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(60,t+.3);const gn=g(.18);gn.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(gn);o.start(t);o.stop(t+.35)}
function powerUp(){if(!e())return;const t=ac.currentTime;[523,659,784].forEach((f,i)=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;const gn=g(.12);const s=t+i*.07;gn.gain.setValueAtTime(.001,s);gn.gain.linearRampToValueAtTime(.12,s+.02);gn.gain.exponentialRampToValueAtTime(.001,s+.12);o.connect(gn);o.start(s);o.stop(s+.13)})}
function gameOver(){if(!e())return;const t=ac.currentTime;[440,311].forEach((f,i)=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f,t+i*.25);o.frequency.exponentialRampToValueAtTime(f*.5,t+i*.25+.4);const gn=g(.15);gn.gain.setValueAtTime(.001,t+i*.25);gn.gain.linearRampToValueAtTime(.15,t+i*.25+.05);gn.gain.exponentialRampToValueAtTime(.001,t+i*.25+.5);o.connect(gn);o.start(t+i*.25);o.stop(t+i*.25+.55)})}
return{shoot,hit,kill,donutHit,powerUp,gameOver}})();

// STATE
let active=false,_c,_x,W,H,af,lt=0;
let player=null,tx,ty,touching=false;
let bullets=[],enemies=[],particles=[],powerUps=[],texts=[];
let lastShot=0,lastSpawn=0,spawnInt;
let kills=0,combo=0,lastKill=0,comboTimer=0;
let shake={x:0,y:0,i:0},flash=0,pulse=0;
let activePow={};
let donut=null,survTime=0,diff=1,stars=[];
let chunks=[];// donut shatter chunks
let highScore=parseFloat(localStorage.getItem('donut_hightime')||'0');
const isMob='ontouchstart'in window||navigator.maxTouchPoints>0;

// HELPERS
const rand=(a,b)=>a+Math.random()*(b-a);
const dst=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clp=(v,l,h)=>v<l?l:v>h?h:v;
const lrp=(a,b,t)=>a+(b-a)*t;

// === 3D POLYGON DRAWING ===
function drawPoly3D(ctx,x,y,sides,r,rot,baseColor,lightColor,shadowColor){
  for(let i=0;i<sides;i++){
    const a1=rot+(Math.PI*2/sides)*i,a2=rot+(Math.PI*2/sides)*(i+1);
    const x1=x+Math.cos(a1)*r,y1=y+Math.sin(a1)*r;
    const x2=x+Math.cos(a2)*r,y2=y+Math.sin(a2)*r;
    // Face shading based on angle
    const faceAngle=(a1+a2)/2;
    const light=Math.cos(faceAngle-Math.PI/4)*.5+.5;
    ctx.fillStyle=light>.6?lightColor:light>.3?baseColor:shadowColor;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=.5;ctx.stroke();
  }
}

function draw3DTorus(ctx,cx,cy,R,r,hpRatio,now){
  const segments=32,tubeSegs=12;
  const faces=[];
  for(let i=0;i<segments;i++){
    const a1=(Math.PI*2/segments)*i,a2=(Math.PI*2/segments)*(i+1);
    for(let j=0;j<tubeSegs;j++){
      const b1=(Math.PI*2/tubeSegs)*j,b2=(Math.PI*2/tubeSegs)*(j+1);
      const cr1=R+r*Math.cos(b1),cr2=R+r*Math.cos(b2);
      const x1=cx+cr1*Math.cos(a1),y1=cy+cr1*Math.sin(a1)*.45;
      const x2=cx+cr2*Math.cos(a1),y2=cy+cr2*Math.sin(a1)*.45;
      const x3=cx+cr2*Math.cos(a2),y3=cy+cr2*Math.sin(a2)*.45;
      const x4=cx+cr1*Math.cos(a2),y4=cy+cr1*Math.sin(a2)*.45;
      const z=(Math.cos(b1)+Math.cos(b2))/2;
      const light=z*.4+.6;
      // Skip segments that are "bitten" based on HP
      const segRatio=i/segments;
      if(segRatio>hpRatio)continue;
      faces.push({x1,y1,x2,y2,x3,y3,x4,y4,z:Math.sin(a1)+z,light,tubeZ:z});
    }
  }
  faces.sort((a,b)=>a.z-b.z);
  for(const f of faces){
    const pink=Math.floor(255*f.light);
    const g=Math.floor(143*f.light);
    const b=Math.floor(171*f.light);
    if(f.tubeZ>.3){// icing (pink)
      ctx.fillStyle=`rgb(${pink},${g},${b})`;
    }else{// dough (golden)
      ctx.fillStyle=`rgb(${Math.floor(212*f.light)},${Math.floor(165*f.light)},${Math.floor(116*f.light)})`;
    }
    ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.lineTo(f.x3,f.y3);ctx.lineTo(f.x4,f.y4);ctx.closePath();ctx.fill();
    ctx.strokeStyle=`rgba(255,255,255,${f.light*.1})`;ctx.lineWidth=.3;ctx.stroke();
  }
  // Sprinkles on top
  const sprColors=['#ffb347','#a8e6cf','#dda0dd','#87CEEB','#ff4081','#ffd700'];
  for(let i=0;i<18;i++){
    const a=(Math.PI*2/18)*i+now/3000;
    if(a/(Math.PI*2)%1>hpRatio)continue;
    const cr=R+r*.3;
    const sx=cx+cr*Math.cos(a),sy=cy+cr*Math.sin(a)*.45-r*.6;
    ctx.save();ctx.translate(sx,sy);ctx.rotate(a);
    ctx.fillStyle=sprColors[i%sprColors.length];
    ctx.fillRect(-3,-.8,6,1.6);
    ctx.restore();
  }
}

function draw3DPlayer(ctx,x,y,r,angle,now){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  // Body (octagon, 3D shaded)
  drawPoly3D(ctx,0,0,8,r,now/1000,'#fff5e6','#ffffff','#d4a574');
  // Chef hat (pentagon on top)
  drawPoly3D(ctx,0,-r*.7,5,r*.5,0,'#ffffff','#ffffff','#e0e0e0');
  // Hat band
  ctx.fillStyle=CLR.pink;ctx.fillRect(-r*.4,-r*.45,r*.8,r*.15);
  // Eyes
  ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-r*.2,r*.05,1.5,0,Math.PI*2);ctx.arc(r*.2,r*.05,1.5,0,Math.PI*2);ctx.fill();
  // Piping bag (weapon)
  ctx.fillStyle='#d4a574';
  ctx.beginPath();ctx.moveTo(r*.3,r*.1);ctx.lineTo(r*1.2,-r*.1);ctx.lineTo(r*1.2,r*.1);ctx.closePath();ctx.fill();
  ctx.fillStyle=CLR.pink;
  ctx.beginPath();ctx.arc(r*1.3,0,r*.15,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function draw3DEnemy(ctx,x,y,r,type,angle,now,hp,maxHp){
  const t=ENEMIES[type];
  ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
  const p=1+Math.sin(now/300)*.05;
  if(type==='ant'){
    // Body segments (3 circles, 3D shaded)
    const segs=[{dy:r*.6,s:.5},{dy:0,s:.7},{dy:-r*.7,s:.5}];
    segs.forEach(sg=>{
      drawPoly3D(ctx,0,sg.dy,8,r*sg.s*p,now/800,t.color,t.accent,'#2a1508');
    });
    // Legs
    ctx.strokeStyle=t.accent;ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){const ly=-r*.3+i*r*.4;
    ctx.beginPath();ctx.moveTo(-r*.3,ly);ctx.lineTo(-r*1.1,ly+Math.sin(now/200+i)*3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*.3,ly);ctx.lineTo(r*1.1,ly+Math.sin(now/200+i+1)*3);ctx.stroke();}
    // Eyes
    ctx.fillStyle='#ff3333';ctx.beginPath();ctx.arc(-r*.2,-r*.5,2,0,Math.PI*2);ctx.arc(r*.2,-r*.5,2,0,Math.PI*2);ctx.fill();
    // Antennae
    ctx.strokeStyle=t.accent;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-r*.15,-r*.8);ctx.quadraticCurveTo(-r*.4,-r*1.4,-r*.2,-r*1.3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*.15,-r*.8);ctx.quadraticCurveTo(r*.4,-r*1.4,r*.2,-r*1.3);ctx.stroke();
  }else if(type==='fly'){
    // Body
    drawPoly3D(ctx,0,0,6,r*p,now/600,t.color,t.accent,'#0a3a0a');
    // Wings (translucent polygons)
    ctx.globalAlpha=.3+Math.sin(now/50)*.2;
    ctx.fillStyle='rgba(200,230,255,0.5)';
    ctx.beginPath();ctx.ellipse(-r*.8,-r*.2,r*1.2,r*.4,-.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(r*.8,-r*.2,r*1.2,r*.4,.3,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    // Compound eyes
    ctx.fillStyle='#ff0000';
    ctx.beginPath();ctx.arc(-r*.3,-r*.3,r*.25,0,Math.PI*2);ctx.arc(r*.3,-r*.3,r*.25,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#440000';
    ctx.beginPath();ctx.arc(-r*.3,-r*.3,r*.12,0,Math.PI*2);ctx.arc(r*.3,-r*.3,r*.12,0,Math.PI*2);ctx.fill();
  }else if(type==='mouse'){
    // Body (large ellipse)
    drawPoly3D(ctx,0,0,10,r*p,now/900,t.color,t.accent,'#444');
    // Ears
    ctx.fillStyle='#ffb6c1';
    ctx.beginPath();ctx.ellipse(-r*.6,-r*.7,r*.35,r*.5,-.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(r*.6,-r*.7,r*.35,r*.5,.3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=t.accent;ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(-r*.6,-r*.7,r*.35,r*.5,-.3,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(r*.6,-r*.7,r*.35,r*.5,.3,0,Math.PI*2);ctx.stroke();
    // Eyes
    ctx.fillStyle='#111';ctx.beginPath();ctx.arc(-r*.25,-r*.15,2.5,0,Math.PI*2);ctx.arc(r*.25,-r*.15,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-r*.22,-r*.18,1,0,Math.PI*2);ctx.arc(r*.22,-r*.18,1,0,Math.PI*2);ctx.fill();
    // Nose
    ctx.fillStyle='#ffb6c1';ctx.beginPath();ctx.arc(0,-r*.05,r*.12,0,Math.PI*2);ctx.fill();
    // Tail
    ctx.strokeStyle=t.accent;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,r);ctx.quadraticCurveTo(r*.5,r*1.5,-r*.3,r*1.8);ctx.stroke();
  }else if(type==='wasp'){
    // Abdomen (striped)
    for(let s=0;s<5;s++){const sy=r*.1+s*r*.25;
    ctx.fillStyle=s%2===0?'#FFD700':'#1a1a1a';
    ctx.beginPath();ctx.ellipse(0,sy,r*.6*p,r*.13,0,0,Math.PI*2);ctx.fill();}
    // Thorax
    drawPoly3D(ctx,0,-r*.2,6,r*.5*p,now/700,'#FFD700','#FFF8DC','#B8860B');
    // Wings
    ctx.globalAlpha=.25+Math.sin(now/40)*.15;
    ctx.fillStyle='rgba(200,230,255,0.4)';
    ctx.beginPath();ctx.ellipse(-r*.9,-r*.3,r*1,r*.35,-.2,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(r*.9,-r*.3,r*1,r*.35,.2,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    // Eyes (angry)
    ctx.fillStyle='#ff0000';ctx.beginPath();ctx.arc(-r*.2,-r*.4,r*.15,0,Math.PI*2);ctx.arc(r*.2,-r*.4,r*.15,0,Math.PI*2);ctx.fill();
    // Stinger
    ctx.fillStyle='#333';ctx.beginPath();ctx.moveTo(-r*.08,r*1.1);ctx.lineTo(r*.08,r*1.1);ctx.lineTo(0,r*1.5);ctx.closePath();ctx.fill();
  }
  ctx.restore();
  // HP bar
  if(maxHp>1){ctx.globalAlpha=.7;const bw=r*2,bh=3,bx=x-bw/2,by=y-r-12;
  ctx.fillStyle='#1a0e05';ctx.fillRect(bx,by,bw,bh);ctx.fillStyle=CLR.hot;ctx.fillRect(bx,by,bw*(hp/maxHp),bh);ctx.globalAlpha=1;}
}

// === DONUT SHATTER CHUNKS ===
function spawnChunks(x,y,count,r){
  for(let i=0;i<count;i++){
    const a=rand(0,Math.PI*2),spd=rand(2,6);
    const size=rand(r*.15,r*.35);
    chunks.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,rot:rand(0,Math.PI*2),
      vr:rand(-.15,.15),size,alpha:1,life:1,decay:rand(.008,.02),
      color:Math.random()>.5?CLR.pink:CLR.caramel,
      sides:Math.floor(rand(3,6))});
  }
}
function updateChunks(){for(let i=chunks.length-1;i>=0;i--){const c=chunks[i];c.x+=c.vx;c.y+=c.vy;c.vy+=.08;c.vx*=.99;c.rot+=c.vr;c.life-=c.decay;c.alpha=c.life;if(c.life<=0)chunks.splice(i,1);}}
function drawChunks(ctx){for(const c of chunks){ctx.globalAlpha=c.alpha;drawPoly3D(ctx,c.x,c.y,c.sides,c.size*c.life,c.rot,c.color,CLR.cream,'#5a2d1a');}ctx.globalAlpha=1;}

// BACKGROUND
function initStars(){stars=[];for(let i=0;i<CFG.starCount;i++)stars.push({x:rand(0,W),y:rand(0,H),size:rand(.5,2),alpha:rand(.1,.4),phase:rand(0,Math.PI*2),color:['#ff8fab','#ffecd2','#a8e6cf','#dda0dd','#ffb347'][i%5]});}
function drawBg(ctx,now){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);const dpr=window.devicePixelRatio||1;ctx.clearRect(0,0,_c.width,_c.height);ctx.fillStyle=CLR.bg;ctx.fillRect(0,0,_c.width,_c.height);ctx.restore();
  const gr=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.6);gr.addColorStop(0,'rgba(90,45,26,0.4)');gr.addColorStop(.5,'rgba(61,26,14,0.2)');gr.addColorStop(1,'rgba(42,26,14,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
  for(const s of stars){ctx.globalAlpha=s.alpha*(.5+Math.sin(now/2e3+s.phase)*.5);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
}

// DONUT
function createDonut(){return{x:W/2,y:H/2,hp:CFG.donutHP,maxHp:CFG.donutHP,r:CFG.donutR};}
function drawDonut(ctx,now){if(!donut)return;const hp=donut.hp/donut.maxHp;
  // Shadow
  ctx.globalAlpha=.15;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(donut.x,donut.y+donut.r*.8,donut.r*1.2,donut.r*.25,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // 3D Torus
  draw3DTorus(ctx,donut.x,donut.y,donut.r*.65,donut.r*.35,hp,now);
  // HP ring
  ctx.strokeStyle='rgba(255,245,230,0.15)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(donut.x,donut.y,donut.r+12,0,Math.PI*2);ctx.stroke();
  const hc=hp>.5?CLR.mint:hp>.25?'#ffb347':CLR.hot;
  ctx.shadowColor=hc;ctx.shadowBlur=8;ctx.strokeStyle=hc;ctx.lineWidth=4;ctx.beginPath();ctx.arc(donut.x,donut.y,donut.r+12,-Math.PI/2,-Math.PI/2+Math.PI*2*hp);ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle=CLR.white;ctx.font='bold 14px "Outfit",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.7;ctx.fillText(`${Math.ceil(donut.hp)}%`,donut.x,donut.y+donut.r+28);ctx.globalAlpha=1;
}

// PLAYER
function createPlayer(){return{x:W/2,y:H/2+CFG.donutR+60,trail:[],alive:true,angle:0};}
function updatePlayer(dt){if(!player.alive)return;const sp=activePow.speed?CFG.playerSpeed*1.6:CFG.playerSpeed;
  if(touching){const dx=tx-player.x,dy=ty-player.y,d=Math.hypot(dx,dy);if(d>3){const m=Math.min(sp,d*.15);player.x+=(dx/d)*m;player.y+=(dy/d)*m;}}
  player.x=clp(player.x,CFG.playerR,W-CFG.playerR);player.y=clp(player.y,CFG.playerR,H-CFG.playerR);
  let near=null,nd=Infinity;for(const e of enemies){const d=dst(player,e);if(d<nd){nd=d;near=e;}}
  if(near)player.angle=Math.atan2(near.y-player.y,near.x-player.x);
  player.trail.unshift({x:player.x,y:player.y});if(player.trail.length>8)player.trail.pop();}
function drawPlayer(ctx,now){if(!player.alive)return;
  const tc=['#ff8fab','#a8e6cf','#ffecd2','#dda0dd'];
  for(let i=1;i<player.trail.length;i++){const t=1-i/player.trail.length,p=player.trail[i];ctx.globalAlpha=t*.3;ctx.fillStyle=tc[i%tc.length];ctx.beginPath();ctx.arc(p.x,p.y,2+t*2,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;draw3DPlayer(ctx,player.x,player.y,CFG.playerR,player.angle,now);
  if(activePow.shield){ctx.globalAlpha=.25+Math.sin(now/200)*.1;ctx.shadowColor='#7b3f00';ctx.shadowBlur=15;ctx.strokeStyle='#7b3f00';ctx.lineWidth=3;ctx.beginPath();ctx.arc(player.x,player.y,CFG.playerR+12,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}ctx.globalAlpha=1;}

// BULLETS
function autoShoot(now){if(!player.alive||now-lastShot<CFG.shootInterval)return;lastShot=now;
  let near=null,nd=Infinity;for(const e of enemies){const d=dst(player,e);if(d<nd){nd=d;near=e;}}if(!near)return;
  const a=Math.atan2(near.y-player.y,near.x-player.x);fire(a);SFX.shoot();
  if(activePow.multishot){fire(a-.22);fire(a+.22);}}
function fire(a){bullets.push({x:player.x,y:player.y,vx:Math.cos(a)*CFG.bulletSpeed,vy:Math.sin(a)*CFG.bulletSpeed,born:performance.now(),r:CFG.bulletR});}
function updateBullets(now){for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx;b.y+=b.vy;if(b.x<-20||b.x>W+20||b.y<-20||b.y>H+20||now-b.born>CFG.bulletLifetime)bullets.splice(i,1);}}
function drawBullets(ctx){const sc=['#ff8fab','#a8e6cf','#ffb347','#dda0dd','#ffecd2','#ff4081'];
  for(let i=0;i<bullets.length;i++){const b=bullets[i],c=sc[i%sc.length];
  const tx2=b.x-b.vx*3,ty2=b.y-b.vy*3;ctx.globalAlpha=.5;ctx.strokeStyle=c;ctx.lineWidth=b.r;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(tx2,ty2);ctx.stroke();
  ctx.globalAlpha=1;ctx.shadowColor=c;ctx.shadowBlur=8;ctx.fillStyle=c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=CLR.white;ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(b.x,b.y,b.r*.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}

// ENEMIES
function spawnEnemy(){const roll=Math.random();let tk;
  if(survTime<15)tk=roll<.7?'ant':'fly';
  else if(survTime<40)tk=roll<.35?'ant':roll<.65?'fly':roll<.85?'mouse':'wasp';
  else tk=roll<.2?'ant':roll<.4?'fly':roll<.7?'mouse':'wasp';
  const t=ENEMIES[tk],sm=1+diff*.08,side=Math.floor(Math.random()*4);let x,y;
  switch(side){case 0:x=rand(0,W);y=-30;break;case 1:x=W+30;y=rand(0,H);break;case 2:x=rand(0,W);y=H+30;break;case 3:x=-30;y=rand(0,H);break;}
  enemies.push({x,y,hp:t.hp,maxHp:t.hp,r:t.r,speed:t.speed*sm,dmg:t.dmg,typeKey:tk,phase:rand(0,Math.PI*2)});}
function updateEnemies(dt,now){for(const e of enemies){const dx=donut.x-e.x,dy=donut.y-e.y,d=Math.hypot(dx,dy);if(d>1){e.x+=(dx/d)*e.speed+Math.sin(now/500+e.phase)*.4;e.y+=(dy/d)*e.speed;}}}
function drawEnemies(ctx,now){for(const e of enemies){const a=Math.atan2(donut.y-e.y,donut.x-e.x);draw3DEnemy(ctx,e.x,e.y,e.r,e.typeKey,a,now,e.hp,e.maxHp);}ctx.globalAlpha=1;}

// COLLISIONS
function checkCollisions(now){
  for(let bi=bullets.length-1;bi>=0;bi--){const b=bullets[bi];
  for(let ei=enemies.length-1;ei>=0;ei--){const e=enemies[ei];
  if(dst(b,e)<e.r+b.r+3){bullets.splice(bi,1);e.hp--;spawnSparks(b.x,b.y,CLR.pink,4);SFX.hit();
  if(e.hp<=0)killEnemy(ei,e,now);break;}}}
  for(let ei=enemies.length-1;ei>=0;ei--){const e=enemies[ei];
  if(dst(e,donut)<donut.r+e.r-8){donut.hp=Math.max(0,donut.hp-e.dmg);
  addText(donut.x+rand(-30,30),donut.y+rand(-30,30),`-${e.dmg}%`,CLR.hot);
  spawnChunks(e.x,e.y,4+e.dmg,donut.r);shake.i=Math.max(shake.i,6+e.dmg);flash=.3;SFX.donutHit();enemies.splice(ei,1);
  if(donut.hp<=0){donut.hp=0;spawnChunks(donut.x,donut.y,20,donut.r);shake.i=20;SFX.gameOver();setTimeout(endGame,1200);}}}
  for(let i=powerUps.length-1;i>=0;i--){if(dst(player,powerUps[i])<CFG.playerR+CFG.powerUpR+4){collectPU(powerUps[i],now);powerUps.splice(i,1);}}}
function killEnemy(i,e,now){spawnExplosion(e.x,e.y,ENEMIES[e.typeKey].color,10);shake.i=Math.max(shake.i,3);SFX.kill();kills++;
  if(now-lastKill<2e3)combo++;else combo=1;lastKill=now;comboTimer=1;
  if(combo>1)addText(e.x,e.y+5,`${combo}x`,CLR.gold);
  enemies.splice(i,1);if(Math.random()<CFG.powerUpChance)dropPU(e.x,e.y);}

// POWERUPS
function dropPU(x,y){const t=POWERUPS[Math.floor(Math.random()*POWERUPS.length)];powerUps.push({x,y,...t,born:performance.now(),lifetime:8e3});}
function collectPU(pu,now){if(pu.type==='heal'){donut.hp=Math.min(donut.hp+10,donut.maxHp);addText(donut.x,donut.y-donut.r-10,'+10%',CLR.mint);}else{activePow[pu.type]=now+CFG.powerUpDur;}addText(pu.x,pu.y-20,pu.label,pu.color);spawnExplosion(pu.x,pu.y,pu.color,8);SFX.powerUp();}
function updatePU(now){for(const k of Object.keys(activePow)){if(now>activePow[k])delete activePow[k];}for(let i=powerUps.length-1;i>=0;i--){if(now-powerUps[i].born>powerUps[i].lifetime)powerUps.splice(i,1);}}
function drawPU(ctx,now){for(const p of powerUps){const age=now-p.born,fo=p.lifetime-age<2e3?(p.lifetime-age)/2e3:1,bob=Math.sin(now/300)*4;
  ctx.globalAlpha=fo;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.fillStyle=p.color+'33';ctx.strokeStyle=p.color;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(p.x,p.y+bob,CFG.powerUpR,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle=p.color;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.icon,p.x,p.y+bob);
  ctx.font='bold 8px "Outfit",sans-serif';ctx.globalAlpha=fo*.8;ctx.fillText(p.label,p.x,p.y+bob+CFG.powerUpR+12);}ctx.globalAlpha=1;}

// PARTICLES
function spawnExplosion(x,y,color,n){for(let i=0;i<n;i++){const a=(Math.PI*2/n)*i+rand(-.3,.3),s=rand(2,5);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rand(1.5,3.5),color,alpha:1,life:1,decay:rand(.015,.035)});}}
function spawnSparks(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),s=rand(1,3);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:rand(1,2),color,alpha:.8,life:1,decay:rand(.03,.06)});}}
function updateParticles(){if(particles.length>120)particles.splice(0,particles.length-120);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.96;p.vy*=.96;p.life-=p.decay;p.alpha=p.life;if(p.life<=0)particles.splice(i,1);}}
function drawParticles(ctx){for(const p of particles){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function addText(x,y,text,color){texts.push({x,y,text,color,alpha:1,vy:-1.5,life:1,scale:1.6});}
function updateTexts(){for(let i=texts.length-1;i>=0;i--){const f=texts[i];f.y+=f.vy;f.life-=.018;f.alpha=f.life;if(f.scale>1)f.scale=lrp(f.scale,1,.12);if(f.life<=0)texts.splice(i,1);}}
function drawTexts(ctx){for(const f of texts){ctx.globalAlpha=f.alpha;ctx.save();ctx.translate(f.x,f.y);const s=f.scale||1;ctx.scale(s,s);ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineWidth=3;ctx.font='bold 16px "Outfit",sans-serif';ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeText(f.text,0,0);ctx.fillStyle=f.color;ctx.fillText(f.text,0,0);ctx.restore();}ctx.globalAlpha=1;}

// VFX
function updateShake(){shake.x=(Math.random()-.5)*shake.i;shake.y=(Math.random()-.5)*shake.i;shake.i*=CFG.shakeDecay;if(shake.i<.5)shake.i=0;}
function drawFlash(ctx){if(flash<=0)return;ctx.globalAlpha=flash*.5;ctx.fillStyle=CLR.hot;ctx.fillRect(0,0,W,H);flash*=.9;if(flash<.01)flash=0;}
function drawPulse(ctx){if(pulse>0){ctx.globalAlpha=pulse;ctx.fillStyle=CLR.white;ctx.fillRect(0,0,W,H);pulse*=.88;if(pulse<.01)pulse=0;}}
function drawVignette(ctx){const gr=ctx.createRadialGradient(W/2,H/2,W*.25,W/2,H/2,W*.75);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,0.4)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}

// SAFE AREA
let safeT=0,safeB=0;
function detectSafe(){const p=document.createElement('div');p.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';document.body.appendChild(p);const cs=getComputedStyle(p);safeT=parseInt(cs.paddingTop)||0;safeB=parseInt(cs.paddingBottom)||0;document.body.removeChild(p);}

// HUD
function drawHUD(ctx,now){ctx.globalAlpha=1;const st=safeT+8,sb=safeB+8;
  const ts=survTime.toFixed(1)+'s';ctx.textAlign='center';ctx.shadowColor=CLR.gold;ctx.shadowBlur=8;ctx.fillStyle=CLR.gold;ctx.font='bold 28px "Outfit",sans-serif';ctx.fillText(ts,W/2,st+36);ctx.shadowBlur=0;
  ctx.fillStyle=CLR.white;ctx.font='bold 10px "Outfit",sans-serif';ctx.globalAlpha=.5;ctx.fillText('SURVIVAL TIME',W/2,st+14);ctx.globalAlpha=1;
  if(combo>1){const cx=W-12,cy=st+36;ctx.textAlign='right';
  if(comboTimer>0){ctx.globalAlpha=.4;ctx.strokeStyle=CLR.pink+'88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx-18,cy-10,16,-Math.PI/2,-Math.PI/2+Math.PI*2*comboTimer);ctx.stroke();}
  ctx.globalAlpha=1;ctx.fillStyle=CLR.pink;ctx.font='bold 18px "Outfit",sans-serif';ctx.fillText(`${combo}x`,cx,cy);ctx.font='9px "Outfit",sans-serif';ctx.globalAlpha=.7;ctx.fillText('COMBO',cx,cy+14);}
  let px=60;ctx.textAlign='left';ctx.font='bold 10px "Outfit",sans-serif';
  for(const[k,exp]of Object.entries(activePow)){const rem=(exp-now)/CFG.powerUpDur;const pu=POWERUPS.find(p=>p.type===k);if(!pu)continue;ctx.globalAlpha=.8;ctx.fillStyle=pu.color;ctx.fillText(`${pu.icon} ${pu.label}`,px,st+58);ctx.fillStyle=pu.color+'44';ctx.fillRect(px,st+62,60,3);ctx.fillStyle=pu.color;ctx.fillRect(px,st+62,60*rem,3);px+=78;}
  ctx.globalAlpha=.5;ctx.textAlign='left';ctx.fillStyle=CLR.white;ctx.font='9px "Outfit",sans-serif';ctx.fillText(`HITS: ${kills}`,16,H-sb-10);ctx.globalAlpha=1;}

// DIFFICULTY
function updateDiff(dt){survTime+=dt/1e3;diff=1+Math.floor(survTime/15);
  const now=performance.now();if(combo>0&&now-lastKill<2e3)comboTimer=1-(now-lastKill)/2e3;else{comboTimer=0;if(now-lastKill>=2e3)combo=0;}
  spawnInt=Math.max(CFG.spawnMin,CFG.spawnStart-diff*150);
  if(now-lastSpawn>spawnInt&&enemies.length<CFG.maxEnemies){spawnEnemy();lastSpawn=now;if(diff>=3&&Math.random()<.3)spawnEnemy();if(diff>=5&&Math.random()<.2)spawnEnemy();}}

// GAME OVER
function endGame(){active=false;cancelAnimationFrame(af);
  const isNew=survTime>highScore;if(isNew){highScore=survTime;localStorage.setItem('donut_hightime',String(highScore));}
  const ro=document.getElementById('game-result');if(ro){
  const rs=document.getElementById('result-score'),rh=document.getElementById('result-high'),rn=document.getElementById('result-new'),rk=document.getElementById('result-kills'),rw=document.getElementById('result-wave');
  if(rs)rs.textContent=survTime.toFixed(1)+'s';if(rh)rh.textContent=highScore.toFixed(1)+'s';if(rn)rn.style.display=isNew?'block':'none';if(rk)rk.textContent=kills;if(rw)rw.textContent=Math.floor(diff);ro.classList.add('visible');}
  if(typeof Leaderboard!=='undefined')Leaderboard.onGameOver(Math.round(survTime*10),Math.floor(diff),kills);}

// MAIN LOOP
function loop(ts){if(!active)return;const now=performance.now();const rawDt=lt?ts-lt:16;lt=ts;
  updatePlayer(rawDt);autoShoot(now);updateBullets(now);updateEnemies(rawDt,now);checkCollisions(now);updatePU(now);updateParticles();updateChunks();updateTexts();updateShake();updateDiff(rawDt);
  _x.save();_x.translate(shake.x,shake.y);drawBg(_x,now);drawDonut(_x,now);drawChunks(_x);drawPU(_x,now);drawBullets(_x);drawEnemies(_x,now);drawPlayer(_x,now);drawParticles(_x);drawTexts(_x);drawFlash(_x);drawPulse(_x);drawVignette(_x);drawHUD(_x,now);_x.restore();
  af=requestAnimationFrame(loop);}

// INPUT
function onPD(e){if(!active)return;e.preventDefault();touching=true;const r=_c.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;}
function onPM(e){if(!active||!touching)return;e.preventDefault();const r=_c.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;}
function onPU(){touching=false;}

// START/STOP
function start(canvas,ctx){_c=canvas;_x=ctx;const dpr=window.devicePixelRatio||1;W=canvas.width/dpr;H=canvas.height/dpr;
  active=true;kills=0;combo=0;lastKill=0;lastShot=0;lastSpawn=0;lt=0;
  bullets=[];enemies=[];particles=[];powerUps=[];texts=[];chunks=[];
  activePow={};shake={x:0,y:0,i:0};flash=0;pulse=0;comboTimer=0;survTime=0;diff=1;spawnInt=CFG.spawnStart;
  donut=createDonut();player=createPlayer();tx=player.x;ty=player.y;touching=false;
  detectSafe();initStars();
  _c.addEventListener('pointerdown',onPD,{passive:false});_c.addEventListener('pointermove',onPM,{passive:false});_c.addEventListener('pointerup',onPU);_c.addEventListener('pointercancel',onPU);
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');
  const na=document.getElementById('lb-name-input-area');if(na)na.classList.remove('visible');
  af=requestAnimationFrame(loop);}
function stop(){active=false;cancelAnimationFrame(af);bullets=[];enemies=[];particles=[];powerUps=[];texts=[];chunks=[];
  if(_c){_c.removeEventListener('pointerdown',onPD);_c.removeEventListener('pointermove',onPM);_c.removeEventListener('pointerup',onPU);_c.removeEventListener('pointercancel',onPU);}
  const ro=document.getElementById('game-result');if(ro)ro.classList.remove('visible');}
function replay(c,x){stop();start(c,x);}
return{start,stop,end:endGame,replay,get active(){return active},get score(){return survTime}};
})();
