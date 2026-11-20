const BATTLE_PROFILES = {
  "ilya-muromets": {size:80, move:270, turn:850, hp:4, fire:760, damage:6.8, bullet:650, spread:.115},
  "il-2":          {size:72, move:315, turn:1400, hp:4, fire:400, damage:6, bullet:720},
  "yak-3":         {size:65, move:365, turn:2550, hp:2, fire:240, damage:3.6, bullet:765},
  "mig-15":        {size:69, move:345, turn:2000, hp:3, fire:430, damage:7, bullet:800},
  "mig-21":        {size:72, move:420, turn:1550, hp:2, fire:320, damage:5.1, bullet:920},
  "mig-29":        {size:76, move:380, turn:2250, hp:3, fire:290, damage:4.8, bullet:850},
  "mig-31":        {size:86, move:440, turn:1190, hp:3, fire:465, damage:9.1, bullet:980},
  "su-25":         {size:83, move:295, turn:1150, hp:5, fire:620, damage:5.4, bullet:750, spread:.09},
  "su-27":         {size:80, move:375, turn:1780, hp:4, fire:375, damage:6.5, bullet:865},
  "su-34":         {size:86, move:310, turn:1050, hp:5, fire:570, damage:10.2, bullet:805},
  "su-35":         {size:80, move:395, turn:2400, hp:3, fire:590, damage:5.1, bullet:875, spread:.065},
  "su-57":         {size:78, move:410, turn:2130, hp:3, fire:270, damage:4.6, bullet:940}
};
const BATTLE_STARTER = "il-2";
const BATTLE_FLEET = AIRCRAFT.filter(({id}) => Object.hasOwn(BATTLE_PROFILES, id))
  .sort((a,b)=>Number(b.id===BATTLE_STARTER)-Number(a.id===BATTLE_STARTER));
const BATTLE_SPRITE_ROOT = "site/assets/air-battle/";
const BATTLE_EFFECTS = {
  bullet:"effects/bullet.png", drone:"effects/drone.png",
  explosion:"effects/explosion.png", tank:"effects/tank.png"
};
const BATTLE_POWERUPS = {
  triple:{file:"triple.png", label:"ТРОЙНОЙ ЗАЛП"},
  damage:{file:"damage.png", label:"УРОН ×1,8"},
  rapid:{file:"fire-rate.png", label:"ТЕМП ОГНЯ ↑"}
};
const BATTLE_BEST_KEY = "kr-battle-best";
const battle = {
  selected:BATTLE_STARTER, mode:"ready", width:0, height:0,
  best:0, score:0, wave:1, kills:0, health:0,
  keys:new Set(), targetX:null, activePointer:null,
  playerX:0, velocity:0, bank:0, hitUntil:0,
  time:0, last:0, raf:0, nextShot:0, nextTank:0, nextDrone:0, nextPowerup:0,
  bullets:[], tanks:[], drones:[], powerups:[], explosions:[], buffs:{},
  images:new Map()
};

function battleAircraftPath(id) {
  return 'aircraft/'+id+'.png';
}
function battleUnlocked(id) {
  return id===BATTLE_STARTER || openId(id);
}
function battleProfile() {
  return BATTLE_PROFILES[battle.selected];
}
function battlePlaneY() {
  return battle.height-battleProfile().size*.7;
}
function battleClampX(x) {
  const pad=Math.min(battleProfile().size*.58,battle.width/2);
  return Math.max(pad,Math.min(battle.width-pad,x));
}
function battleImage(path) {
  if (!battle.images.has(path)) {
    const image=new Image();
    image.decoding="async";
    image.onload=()=>{if(battle.mode!=="running" && battle.width) battleDraw();};
    image.onerror=()=>console.warn("Не удалось загрузить игровой спрайт",path);
    image.src=BATTLE_SPRITE_ROOT+path;
    battle.images.set(path,image);
  }
  return battle.images.get(path);
}

function battleRenderSelection() {
  const host=$("#battleAircraftSelect");
  const scroll=host.scrollTop, horizontalScroll=host.scrollLeft;
  host.innerHTML=BATTLE_FLEET.map(a=>{
    const locked=!battleUnlocked(a.id), selected=a.id===battle.selected;
    const condition=locked?"Открыть карточку":a.id===BATTLE_STARTER?"Стартовый":"Доступен";
    return `<button type="button" class="battle-plane-option ${selected?"active":""}" data-battle-aircraft="${a.id}" aria-pressed="${selected}">
      <span class="battle-plane-thumb"><img class="battle-aircraft-icon" alt="" src="${BATTLE_SPRITE_ROOT+battleAircraftPath(a.id)}"></span>
      <span><strong>${a.name}</strong><small>${condition} · ${a.year}</small></span>
    </button>`;
  }).join("");
  host.scrollTop=scroll;
  host.scrollLeft=horizontalScroll;
  const a=BATTLE_FLEET.find(a=>a.id===battle.selected), s=battleProfile();
  $("#battlePlaneName").textContent=a.name;
  $("#battlePlaneTier").textContent=a.type;
  const stats=[
    ["СКОРОСТЬ",s.move+" ед./с"],["МАНЁВРЕННОСТЬ",s.turn+" ед./с²"],
    ["ПРОЧНОСТЬ",s.hp],["УРОН СНАРЯДА",s.damage],
    ["ТЕМП ЗАЛПОВ",(1000/s.fire).toFixed(1)+"/с"],["СКОРОСТЬ СНАРЯДА",s.bullet+" ед./с"]
  ];
  $("#battleStats").innerHTML=`<div class="battle-grade">ИГРОВЫЕ ХАРАКТЕРИСТИКИ</div>
    <div class="battle-stat-grid">${stats.map(([label,value])=>`<div class="battle-stat"><b>${label}</b><span>${value}</span></div>`).join("")}</div>
    <div class="battle-corner-note">${s.spread?"Парный залп":"Одиночный выстрел"} · ${a.type}</div>`;
}

function battleResize() {
  const w=battle.field.clientWidth,h=battle.field.clientHeight;
  if (!w || !h || !battle.ctx) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if (w===battle.width && h===battle.height && dpr===battle.dpr) return;
  if (battle.width && battle.height) {
    for (const group of [battle.tanks,battle.drones,battle.bullets,battle.powerups,battle.explosions]) {
      for (const entity of group) {
        entity.x*=w/battle.width;
        entity.y*=h/battle.height;
      }
    }
  }
  const playerRatio=battle.width?battle.playerX/battle.width:.5;
  Object.assign(battle,{width:w,height:h,dpr});
  battle.playerX=battleClampX(playerRatio*w);
  battle.targetX=null;
  battle.canvas.width=Math.round(w*dpr);
  battle.canvas.height=Math.round(h*dpr);
  battle.ctx.setTransform(dpr,0,0,dpr,0,0);
  battleDraw();
}

function battleSetOverlay(title,message,button) {
  $("#battleOverlay h3").textContent=title;
  $("#battleOverlayText").textContent=message;
  $("#battleStartBtn").textContent=button;
  $("#battleOverlay").classList.toggle("hidden",battle.mode==="running");
}
function battleSetStatus(text) {
  $("#battleStatus").textContent=text;
}
function battleHud() {
  const active=Object.keys(BATTLE_POWERUPS).filter(id=>battle.buffs[id]>battle.time);
  const text="ВОЛНА "+battle.wave+" · ПРОЧНОСТЬ "+battle.health+"/"+battleProfile().hp+" · РЕКОРД "+battle.best+
    (active.length?" · "+active.map(id=>BATTLE_POWERUPS[id].label).join(" / "):"");
  const wave=$("#battleWave"),score=$("#battleScore");
  if(wave.textContent!==text) wave.textContent=text;
  const scoreText="СЧЁТ "+battle.score;
  if(score.textContent!==scoreText) score.textContent=scoreText;
}
function battleClearInput() {
  battle.keys.clear();
  battle.targetX=null;
  battle.activePointer=null;
}
function battleReset() {
  cancelAnimationFrame(battle.raf);
  Object.assign(battle,{
    mode:"ready", score:0, kills:0, wave:1, health:battleProfile().hp,
    playerX:battle.width/2, velocity:0, bank:0, time:0, hitUntil:0,
    nextShot:0, nextTank:900, nextDrone:6500, nextPowerup:4000,
    bullets:[], tanks:[], drones:[], powerups:[], explosions:[], buffs:{}
  });
  battleClearInput();
  battleSetOverlay("Готовность","Огонь автоматический. Управляй самолётом и собирай усиления.","НАЧАТЬ БОЙ →");
  battleSetStatus("Выбран "+BATTLE_FLEET.find(a=>a.id===battle.selected).name+".");
  if (battle.ctx) battleDraw();
  $("#battleStartBtn").disabled=!battle.ctx;
}
function battlePause() {
  if (battle.mode!=="running") return;
  cancelAnimationFrame(battle.raf);
  battle.mode="paused";
  battleClearInput();
  battleSetOverlay("Пауза","Вылет продолжится с того же места.","ПРОДОЛЖИТЬ →");
  battleSetStatus("Вылет приостановлен.");
}
function battleStart() {
  if (!battle.ctx || battle.mode==="running") return;
  if(battle.mode!=="paused") {
    battleReset();
    battleSpawnTank();
  }
  battle.mode="running";
  $("#battleOverlay").classList.add("hidden");
  battleSetStatus("Вылет начат. Собирай усиления и уклоняйся от дронов.");
  battle.field.focus({preventScroll:true});
  battle.last=performance.now();
  battle.raf=requestAnimationFrame(battleLoop);
}
function battleFinish() {
  battle.mode="finished";
  battleClearInput();
  const result="Столкновение с дроном. Итоговый счёт — "+battle.score+".";
  battleSetOverlay("Вылет завершён",result,"НАЧАТЬ ЗАНОВО →");
  battleSetStatus(result);
}

function battleSpawnTank() {
  const size=Math.min(60,43+battle.wave);
  const hp=6+Math.floor(battle.time/18000)+Math.floor(battle.kills/18);
  battle.tanks.push({
    x:size/2+Math.random()*Math.max(0,battle.width-size), y:-size,
    size,hp,maxHp:hp,speed:52+Math.min(58,battle.time/1600)+Math.random()*20
  });
}
function battleSpawnDrone() {
  const size=36+Math.random()*8;
  battle.drones.push({
    x:28+Math.random()*Math.max(0,battle.width-56), y:-size,size,
    speed:108+Math.min(76,battle.wave*5)+Math.random()*24,
    vx:(Math.random()-.5)*100, phase:Math.random()*Math.PI*2
  });
}
function battleSpawnPowerup() {
  const types=Object.keys(BATTLE_POWERUPS);
  battle.powerups.push({
    x:24+Math.random()*Math.max(0,battle.width-48), y:-24,
    speed:75+Math.random()*32, type:types[Math.floor(Math.random()*types.length)]
  });
}
function battleFire() {
  const s=battleProfile(), triple=battle.buffs.triple>battle.time;
  const spread=s.spread||.17;
  const angles=triple?[-Math.max(.17,spread),0,Math.max(.17,spread)]:s.spread?[-spread,spread]:[0];
  const damage=s.damage*(battle.buffs.damage>battle.time?1.8:1);
  for(const angle of angles) {
    battle.bullets.push({
      x:battle.playerX+Math.sin(angle)*18, y:battlePlaneY()-s.size*.38,
      vx:Math.sin(angle)*s.bullet, vy:-Math.cos(angle)*s.bullet, damage
    });
  }
}
function battleExplode(x,y,size) {
  battle.explosions.push({x,y,size,time:battle.time,rotation:Math.random()*Math.PI*2});
}
function battleAward(points) {
  battle.score+=points;
  battle.kills++;
  battle.wave=1+Math.floor(battle.kills/15);
  if(battle.score>battle.best) {
    battle.best=battle.score;
    writeMuseumStorage(BATTLE_BEST_KEY,String(battle.best));
  }
}
function battleMovePlayer(step) {
  const s=battleProfile();
  const left=battle.keys.has("arrowleft")||battle.keys.has("a");
  const right=battle.keys.has("arrowright")||battle.keys.has("d");
  let targetVelocity=(Number(right)-Number(left))*s.move;
  if (!left && !right && battle.targetX!==null) {
    const distance=battle.targetX-battle.playerX;
    targetVelocity=Math.sign(distance)*Math.min(Math.abs(distance)*12,s.move);
  }
  const delta=targetVelocity-battle.velocity, maxDelta=s.turn*step;
  battle.velocity+=Math.sign(delta)*Math.min(Math.abs(delta),maxDelta);
  const next=battle.playerX+battle.velocity*step;
  battle.playerX=battleClampX(next);
  if(battle.playerX!==next) battle.velocity=0;
  const banking=battle.velocity/s.move*.25;
  battle.bank+=(banking-battle.bank)*Math.min(1,step*12);
}
function battleMoveBullets(step) {
  for(let i=battle.bullets.length-1;i>=0;i--) {
    const b=battle.bullets[i];
    b.x+=b.vx*step;
    b.y+=b.vy*step;
    if(b.y<-28 || b.x<-24 || b.x>battle.width+24) {
      battle.bullets.splice(i,1);
      continue;
    }
    const ti=battle.tanks.findIndex(t=>Math.abs(t.x-b.x)<t.size*.44+3 && Math.abs(t.y-b.y)<t.size*.56+5);
    if(ti>=0) {
      const tank=battle.tanks[ti];
      tank.hp-=b.damage;
      battle.bullets.splice(i,1);
      if(tank.hp<=0) {
        battle.tanks.splice(ti,1);
        battleExplode(tank.x,tank.y,tank.size*1.9);
        battleAward(10);
      }
      continue;
    }
    const di=battle.drones.findIndex(d=>Math.hypot(d.x-b.x,d.y-b.y)<d.size*.54);
    if(di>=0) {
      const [drone]=battle.drones.splice(di,1);
      battle.bullets.splice(i,1);
      battleExplode(drone.x,drone.y,drone.size*1.9);
      battleAward(15);
    }
  }
}
function battleMove(dt) {
  const step=dt/1000, planeY=battlePlaneY(), s=battleProfile();
  battleMovePlayer(step);
  battle.explosions=battle.explosions.filter(e=>battle.time-e.time<650);
  for(const t of battle.tanks) t.y+=t.speed*step;
  battle.tanks=battle.tanks.filter(t=>t.y<battle.height+t.size);
  battleMoveBullets(step);
  battle.powerups=battle.powerups.filter(p=>{
    p.y+=p.speed*step;
    if(Math.hypot(p.x-battle.playerX,p.y-planeY)<s.size*.37+15) {
      battle.buffs[p.type]=battle.time+12000;
      battleSetStatus("Усиление: "+BATTLE_POWERUPS[p.type].label+" · 12 секунд.");
      return false;
    }
    return p.y<battle.height+32;
  });
  for(let i=battle.drones.length-1;i>=0;i--) {
    const d=battle.drones[i];
    d.y+=d.speed*step;
    d.x+=d.vx*step;
    d.phase+=step*1.25;
    if(d.x<22 || d.x>battle.width-22) {
      d.x=Math.max(22,Math.min(battle.width-22,d.x));
      d.vx*=-1;
    }
    if(Math.hypot(d.x-battle.playerX,d.y-planeY)<s.size*.28+d.size*.34) {
      battle.drones.splice(i,1);
      battleExplode(d.x,d.y,d.size*1.65);
      if(battle.time>=battle.hitUntil) {
        battle.hitUntil=battle.time+900;
        battle.health--;
        if(!battle.health) {
          battleExplode(battle.playerX,planeY,s.size*1.8);
          battleFinish();
          return;
        }
        battleSetStatus("Столкновение. Осталось прочности: "+battle.health+".");
      }
    } else if(d.y>battle.height+d.size) {
      battle.drones.splice(i,1);
    }
  }
}
function battleLoop(now) {
  if(battle.mode!=="running") return;
  const dt=Math.max(0,Math.min(32,now-battle.last));
  battle.last=now;
  battle.time+=dt;
  const rapid=battle.buffs.rapid>battle.time;
  if(battle.time>=battle.nextShot) {
    battleFire();
    battle.nextShot=battle.time+battleProfile().fire*(rapid?.58:1);
  }
  if(battle.time>=battle.nextTank) {
    battleSpawnTank();
    battle.nextTank=battle.time+Math.max(410,1040-battle.time/160-battle.kills*7);
  }
  if(battle.time>=battle.nextDrone) {
    battleSpawnDrone();
    battle.nextDrone=battle.time+Math.max(3300,7500-battle.wave*300)+Math.random()*1600;
  }
  if(battle.time>=battle.nextPowerup) {
    battleSpawnPowerup();
    battle.nextPowerup=battle.time+7700+Math.random()*3900;
  }
  battleMove(dt);
  battleDraw();
  if(battle.mode==="running") battle.raf=requestAnimationFrame(battleLoop);
}
function battleDrawSprite(path,x,y,width,height,rotation=0,alpha=1) {
  const image=battleImage(path);
  if(!image.complete || !image.naturalWidth) return false;
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  const ctx=battle.ctx;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(x,y);
  ctx.rotate(rotation);
  ctx.drawImage(image,-w/2,-h/2,w,h);
  ctx.restore();
  return true;
}
function battleMarker(x,y,r,color) {
  const ctx=battle.ctx;
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();
}
function battleDraw() {
  const {ctx,width:w,height:h,time}=battle;
  if(!ctx || !w || !h) return;
  ctx.fillStyle="#1b251d";
  ctx.fillRect(0,0,w,h);
  const gradient=ctx.createLinearGradient(0,0,0,h);
  gradient.addColorStop(0,"rgba(106,126,91,.23)");
  gradient.addColorStop(1,"rgba(0,0,0,.19)");
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(210,216,187,.06)";
  ctx.beginPath();
  for(let x=0;x<w;x+=38) {ctx.moveTo(x,0);ctx.lineTo(x,h);}
  for(let y=0;y<h;y+=38) {ctx.moveTo(0,y);ctx.lineTo(w,y);}
  ctx.stroke();
  for(const t of battle.tanks) {
    const size=t.size*1.3;
    if(!battleDrawSprite(BATTLE_EFFECTS.tank,t.x,t.y,size,size)) battleMarker(t.x,t.y,t.size*.42,"#82917d");
    const barWidth=t.size*.8,y=t.y-t.size*.59;
    ctx.fillStyle="#161d18";
    ctx.fillRect(t.x-barWidth/2,y,barWidth,4);
    ctx.fillStyle="#dfebc8";
    ctx.fillRect(t.x-barWidth/2,y,barWidth*t.hp/t.maxHp,4);
  }
  for(const d of battle.drones) {
    const size=d.size*1.2;
    if(!battleDrawSprite(BATTLE_EFFECTS.drone,d.x,d.y,size,size,Math.sin(d.phase)*.1)) battleMarker(d.x,d.y,d.size*.4,"#c375ab");
  }
  for(const p of battle.powerups) {
    const path="powerups/"+BATTLE_POWERUPS[p.type].file;
    if(!battleDrawSprite(path,p.x,p.y,49,49,Math.sin(time/320)*.1)) battleMarker(p.x,p.y,13,"#a8d8a7");
  }
  for(const b of battle.bullets) {
    if(!battleDrawSprite(BATTLE_EFFECTS.bullet,b.x,b.y,26,30,Math.atan2(b.vx,-b.vy))) battleMarker(b.x,b.y,3,"#ffe28b");
  }
  for(const e of battle.explosions) {
    const progress=Math.min(1,(time-e.time)/650),size=e.size*(.58+progress*.57);
    if(!battleDrawSprite(BATTLE_EFFECTS.explosion,e.x,e.y,size,size,e.rotation,1-progress)) {
      ctx.save();
      ctx.globalAlpha=1-progress;
      battleMarker(e.x,e.y,size*.32,"#ef913e");
      ctx.restore();
    }
  }
  if(battle.health>0) {
    const size=battleProfile().size*1.16,y=battlePlaneY();
    const alpha=time<battle.hitUntil && Math.floor(time/95)%2===0?.55:1;
    if(!battleDrawSprite(battleAircraftPath(battle.selected),battle.playerX,y,size,size,battle.bank,alpha)) {
      ctx.save();
      ctx.translate(battle.playerX,y);
      ctx.rotate(battle.bank);
      ctx.fillStyle="#dae1d5";
      ctx.beginPath();
      ctx.moveTo(0,-17);
      ctx.lineTo(15,12);
      ctx.lineTo(0,7);
      ctx.lineTo(-15,12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  battleHud();
}
function battleEnter() {
  if(!battle.images.size && battle.ctx) {
    const paths=[
      ...BATTLE_FLEET.map(a=>battleAircraftPath(a.id)),
      ...Object.values(BATTLE_EFFECTS),
      ...Object.values(BATTLE_POWERUPS).map(p=>"powerups/"+p.file)
    ];
    paths.forEach(battleImage);
  }
  battleRenderSelection();
  battleResize();
  battleDraw();
}
function battleInit() {
  battle.field=$("#battleField");
  battle.canvas=$("#battleCanvas");
  battle.ctx=battle.canvas.getContext("2d");
  const record=Number(readMuseumStorage(BATTLE_BEST_KEY));
  battle.best=Number.isFinite(record)?Math.max(0,Math.floor(record)):0;
  battleReset();
  if(!battle.ctx) {
    battleSetStatus("Браузер не смог открыть игровое поле.");
    return;
  }
  $("#battleStartBtn").addEventListener("click",battleStart);
  $("#battleResetBtn").addEventListener("click",battleReset);
  $("#battleAircraftSelect").addEventListener("click",e=>{
    const option=e.target.closest("[data-battle-aircraft]");
    if(!option) return;
    const id=option.dataset.battleAircraft;
    if(!battleUnlocked(id)) {
      battlePause();
      dialog.addEventListener("close",()=>{
        battleRenderSelection();
        if($("#battleModule").classList.contains("active")) {
          $('[data-battle-aircraft="'+id+'"]').focus({preventScroll:true});
        }
      },{once:true});
      openAircraft(id);
      return;
    }
    if(id===battle.selected) return;
    battle.selected=id;
    battleReset();
    battleRenderSelection();
    $('[data-battle-aircraft="'+id+'"]').focus({preventScroll:true});
  });
  const setTarget=e=>{
    battle.targetX=battleClampX(e.clientX-battle.canvas.getBoundingClientRect().left);
  };
  battle.field.addEventListener("pointerdown",e=>{
    if(battle.mode!=="running" || !e.isPrimary || e.button!==0) return;
    battle.activePointer=e.pointerId;
    battle.field.setPointerCapture(e.pointerId);
    setTarget(e);
  });
  battle.field.addEventListener("pointermove",e=>{
    if(battle.mode==="running" && (e.pointerType==="mouse" || e.pointerId===battle.activePointer)) setTarget(e);
  });
  battle.field.addEventListener("lostpointercapture",e=>{
    if(e.pointerId===battle.activePointer) battle.activePointer=null;
  });
  battle.field.addEventListener("pointerleave",()=>{
    if(battle.activePointer===null) battle.targetX=null;
  });
  const movement=["arrowleft","arrowright","a","d"];
  window.addEventListener("keydown",e=>{
    if(battle.mode!=="running" || dialog.open || e.ctrlKey || e.altKey || e.metaKey) return;
    const key=e.key.toLowerCase();
    if(movement.includes(key)) {
      battle.keys.add(key);
      battle.targetX=null;
      e.preventDefault();
    }
    if(key==="escape") {
      e.preventDefault();
      battlePause();
      $("#battleStartBtn").focus({preventScroll:true});
    }
  });
  window.addEventListener("keyup",e=>battle.keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur",battlePause);
  document.addEventListener("visibilitychange",()=>{if(document.hidden) battlePause();});
  new ResizeObserver(battleResize).observe(battle.field);
  window.addEventListener("resize",battleResize);
}
