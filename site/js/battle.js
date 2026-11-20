const BATTLE_PROFILES = {
  "ilya-muromets": {size:80, move:270, turn:850, hp:108, fire:760, damage:6.8, bullet:650, spread:.115, bombDamage:32, bombRadius:132},
  "il-2":          {size:72, move:315, turn:1400, hp:100, fire:400, damage:6, bullet:720, bombDamage:31, bombRadius:124},
  "yak-3":         {size:65, move:365, turn:2550, hp:62, fire:240, damage:3.6, bullet:765, bombDamage:19, bombRadius:91},
  "mig-15":        {size:69, move:345, turn:2000, hp:82, fire:430, damage:7, bullet:800, bombDamage:23, bombRadius:104},
  "mig-21":        {size:72, move:420, turn:1550, hp:68, fire:320, damage:5.1, bullet:920, bombDamage:22, bombRadius:98},
  "mig-29":        {size:76, move:380, turn:2250, hp:88, fire:290, damage:4.8, bullet:850, bombDamage:25, bombRadius:108},
  "mig-31":        {size:86, move:440, turn:1190, hp:112, fire:465, damage:9.1, bullet:980, bombDamage:30, bombRadius:113},
  "su-25":         {size:83, move:295, turn:1150, hp:142, fire:620, damage:5.4, bullet:750, spread:.09, bombDamage:40, bombRadius:137},
  "su-27":         {size:80, move:375, turn:1780, hp:116, fire:375, damage:6.5, bullet:865, bombDamage:29, bombRadius:118},
  "su-34":         {size:86, move:310, turn:1050, hp:148, fire:570, damage:10.2, bullet:805, bombDamage:44, bombRadius:145},
  "su-35":         {size:80, move:395, turn:2400, hp:96, fire:590, damage:5.1, bullet:875, spread:.065, bombDamage:28, bombRadius:107},
  "su-57":         {size:78, move:410, turn:2130, hp:92, fire:270, damage:4.6, bullet:940, bombDamage:27, bombRadius:112}
};
const BATTLE_STARTER = "il-2";
const BATTLE_FLEET = AIRCRAFT.filter(({id}) => Object.hasOwn(BATTLE_PROFILES, id))
  .sort((a,b)=>Number(b.id===BATTLE_STARTER)-Number(a.id===BATTLE_STARTER));
const BATTLE_SPRITE_ROOT = "site/assets/air-battle/";
const BATTLE_GROUND = ["backgrounds/meadow-01.webp","backgrounds/meadow-02.webp"];
const BATTLE_SCROLL_PX_PER_MS = .08;
const BATTLE_EFFECTS = {
  bullet:"effects/bullet.png", drone:"effects/drone.png",
  explosion:"effects/explosion.png", tank:"effects/tank.png",
  bombs:"powerups/bombs.webp"
};
const BATTLE_POWERUPS = {
  triple:{file:"triple.png", label:"ТРОЙНОЙ ЗАЛП"},
  damage:{file:"damage.png", label:"УРОН ×1,8"},
  rapid:{file:"fire-rate.png", label:"ТЕМП ОГНЯ ↑"}
};
const BATTLE_BOSSES=[
  {name:"Скат", sprite:"bosses/ray.webp", hp:96, shotDamage:22, size:115, cadence:3400, color:"#55e8ff", attacks:["aim","fan"]},
  {name:"Фантом", sprite:"bosses/phantom.webp", hp:135, shotDamage:30, size:125, cadence:3100, color:"#ff789f", attacks:["fan","curtain","aim"]},
  {name:"Улей", sprite:"bosses/hive.webp", hp:170, shotDamage:38, size:135, cadence:2850, color:"#a7ef80", attacks:["curtain","aim","fan"]}
];
const BATTLE_ATTACK_LABELS={aim:"Прицельная очередь",fan:"Веер",curtain:"Огневая завеса"};
const BATTLE_BOMB_LIMIT=5;
const BATTLE_DRONE_DAMAGE=50;
const BATTLE_WAVE_KILLS=15;
const BATTLE_BEST_KEY = "kr-battle-best";
const battle = {
  selected:BATTLE_STARTER, mode:"ready", width:0, height:0,
  best:0, score:0, wave:1, waveKills:0, kills:0, health:0,
  keys:new Set(), targetX:null, activePointer:null,
  playerX:0, velocity:0, bank:0, hitUntil:0, shotGuardUntil:0,
  time:0, last:0, raf:0, nextShot:0, nextTank:0, nextDrone:0, nextPowerup:0,
  bullets:[], tanks:[], drones:[], powerups:[], balloons:[], enemyShots:[], explosions:[], buffs:{},
  boss:null, blast:null, bombs:0, lastBomb:-Infinity, nextBalloon:0,
  images:new Map(), groundStrip:null
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
    ["ПРОЧНОСТЬ",s.hp],["УРОН БОМБЫ",s.bombDamage],["РАДИУС БОМБЫ",s.bombRadius+" ед."],["УРОН СНАРЯДА",s.damage],
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
    for (const group of [battle.tanks,battle.drones,battle.bullets,battle.powerups,battle.balloons,battle.enemyShots,battle.explosions,
      [battle.boss,battle.blast].filter(Boolean)]) {
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
  const stage=battle.boss?"БОСС «"+battle.boss.profile.name+"»":battle.waveKills+"/"+BATTLE_WAVE_KILLS;
  const text="ВОЛНА "+battle.wave+" · "+stage+" · ПРОЧНОСТЬ "+battle.health+"/"+battleProfile().hp+" · РЕКОРД "+battle.best+
    (active.length?" · "+active.map(id=>BATTLE_POWERUPS[id].label).join(" / "):"");
  const wave=$("#battleWave"),score=$("#battleScore");
  if(wave.textContent!==text) wave.textContent=text;
  const scoreText="СЧЁТ "+battle.score;
  if(score.textContent!==scoreText) score.textContent=scoreText;
  const button=$("#battleBombBtn"), count=String(battle.bombs);
  const label=button.querySelector("span");
  if(label.textContent!==count) label.textContent=count;
  button.disabled=battle.mode!=="running" || !battleBombReady();
  button.hidden=battle.mode!=="running";
}
function battleClearInput() {
  battle.keys.clear();
  battle.targetX=null;
  battle.activePointer=null;
}
function battleReset() {
  cancelAnimationFrame(battle.raf);
  Object.assign(battle,{
    mode:"ready", score:0, kills:0, wave:1, waveKills:0, health:battleProfile().hp,
    playerX:battle.width/2, velocity:0, bank:0, time:0, hitUntil:0, shotGuardUntil:0,
    nextShot:0, nextTank:900, nextDrone:6500, nextPowerup:4000,
    bullets:[], tanks:[], drones:[], powerups:[], balloons:[], enemyShots:[], explosions:[], buffs:{},
    bombs:2, lastBomb:-Infinity, nextBalloon:4500, boss:null, blast:null
  });
  battleClearInput();
  battleSetOverlay("Готовность","Огонь автоматический. Пробел или кнопка с иконкой сбрасывает бомбу.","НАЧАТЬ БОЙ →");
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
  battleHud();
}
function battleStart() {
  if (!battle.ctx || battle.mode==="running") return;
  if(battle.mode!=="paused") {
    battleReset();
    battleSpawnTank();
  }
  battle.mode="running";
  $("#battleOverlay").classList.add("hidden");
  battleSetStatus("Пробел — сбросить бомбу. Шарики пополняют запас.");
  battle.field.focus({preventScroll:true});
  battle.last=performance.now();
  battle.raf=requestAnimationFrame(battleLoop);
}
function battleFinish(reason) {
  battle.health=0;
  battle.mode="finished";
  battleClearInput();
  battleExplode(battle.playerX,battlePlaneY(),battleProfile().size*1.8);
  const result=reason+" Итоговый счёт — "+battle.score+".";
  battleSetOverlay("Вылет завершён",result,"НАЧАТЬ ЗАНОВО →");
  battleSetStatus(result);
}
function battleDamagePlayer(damage,reason) {
  battle.health=Math.max(0,battle.health-damage);
  battle.hitUntil=battle.time+360;
  if(!battle.health) battleFinish(reason+" Самолёт сбит.");
  else battleSetStatus(reason+" −"+damage+" · Прочность "+battle.health+"/"+battleProfile().hp+".");
}
function battleBombReady() {
  const cooldown=battle.buffs.rapid>battle.time?820:1500;
  return battle.bombs>0 && battle.time-battle.lastBomb>=cooldown;
}
function battleDropBomb() {
  if(battle.mode!=="running" || !battleBombReady()) return;
  const s=battleProfile(), x=battle.playerX, y=battlePlaneY();
  const radius=s.bombRadius*(battle.buffs.triple>battle.time?1.35:1);
  const damage=s.bombDamage*(battle.buffs.damage>battle.time?1.8:1);
  battle.bombs--;
  battle.lastBomb=battle.time;
  battle.blast={x,y,radius,time:battle.time};
  const targets=[...battle.tanks,...battle.drones];
  if(battle.boss) targets.push(battle.boss);
  for(const target of targets) {
    if(Math.hypot(x-target.x,y-target.y)<=radius+target.size*.35) battleDamageTarget(target,damage);
  }
}
function battleSpawnBalloon() {
  const pad=30;
  battle.balloons.push({x:pad+Math.random()*Math.max(0,battle.width-2*pad),y:-30,speed:84});
}

function battleSpawnTank() {
  const size=Math.min(60,43+battle.wave);
  const hp=15+Math.floor((battle.wave-1)*1.25);
  battle.tanks.push({
    x:size/2+Math.random()*Math.max(0,battle.width-size), y:-size,
    size,hp,maxHp:hp,points:10,speed:52+Math.min(58,battle.time/1600)+Math.random()*20
  });
}
function battleSpawnDrones() {
  const count=Math.min(6,battle.wave);
  const laneWidth=battle.width/count;
  for(let i=0;i<count;i++) {
    const size=36+Math.random()*8;
    battle.drones.push({
      x:(i+.25+Math.random()*.5)*laneWidth, y:-size-i*30, size,
      speed:103+Math.min(60,battle.wave*5)+Math.random()*20,
      vx:(Math.random()-.5)*100, phase:Math.random()*Math.PI*2, hp:1, points:15
    });
  }
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
function battleDamageTarget(target,damage) {
  if(target.hp<=0) return;
  target.hp-=damage;
  if(target.hp>0) return;
  battleExplode(target.x,target.y,target.size*1.85);
  battle.score+=target.points;
  battle.kills++;
  if(!battle.boss) battle.waveKills++;
  if(battle.score>battle.best) {
    battle.best=battle.score;
    writeMuseumStorage(BATTLE_BEST_KEY,String(battle.best));
  }
}
function battleAdvanceWave() {
  if(battle.boss?battle.boss.hp>0:battle.waveKills<BATTLE_WAVE_KILLS) return;
  const defeated=battle.boss;
  battle.wave++;
  battle.waveKills=0;
  battle.boss=null;
  if(defeated || battle.wave%5===0) {
    battle.tanks=[];
    battle.drones=[];
    battle.enemyShots=[];
    battle.bullets=[];
  }
  if(battle.wave%5===0) {
    battleSpawnBoss();
    battleSetStatus("Босс «"+battle.boss.profile.name+"». Следи за предупреждениями об атаках.");
  } else if(defeated) {
    battle.nextTank=battle.time+900;
    battle.nextDrone=battle.time+2300;
    battleSetStatus("Босс «"+defeated.profile.name+"» побеждён. Волна "+battle.wave+".");
  }
}
function battleSpawnBoss() {
  const round=battle.wave/5-1;
  const profile=BATTLE_BOSSES[round%BATTLE_BOSSES.length];
  const hp=profile.hp+Math.floor(round/BATTLE_BOSSES.length)*50;
  battle.boss={
    profile, hp, maxHp:hp, size:profile.size, points:100+battle.wave*5,
    x:battle.width/2, y:-profile.size, born:battle.time,
    nextAttack:battle.time+2700, attackIndex:0
  };
}
function battleBossAttack(boss,kind) {
  const {x,y,profile}=boss;
  const shots=battle.enemyShots, payload={damage:profile.shotDamage,color:profile.color};
  if(kind==="curtain") {
    const lanes=Math.max(4,Math.round(battle.width/58));
    const gap=(Math.floor(boss.attackIndex/2)+1)%(lanes-1);
    for(let lane=0;lane<lanes;lane++) {
      if(lane===gap || lane===gap+1) continue;
      shots.push({x:(lane+.5)*battle.width/lanes,y:y+21,vx:0,vy:225,r:9,...payload});
    }
    return;
  }
  const aim=Math.atan2(battle.playerX-x,Math.max(20,battlePlaneY()-y));
  const angles=kind==="aim"?[aim-.13,aim,aim+.13]:[-.68,-.44,-.22,0,.22,.44,.68];
  const speed=kind==="aim"?260:204;
  for(const angle of angles) {
    shots.push({x,y:y+20,vx:Math.sin(angle)*speed,vy:Math.cos(angle)*speed,r:7,...payload});
  }
}
function battleMoveBoss(step) {
  const b=battle.boss;
  if(!b || b.hp<=0) return;
  const elapsed=battle.time-b.born;
  const top=Math.min(153,battle.height*.28);
  const dive=Math.pow((1-Math.cos(elapsed/1950))/2,5);
  const targetY=top+Math.max(0,battlePlaneY()-58-top)*dive;
  b.x=battle.width/2+Math.sin(elapsed/1390)*Math.max(0,battle.width-b.size)*.37;
  b.y+=Math.max(-155*step,Math.min(155*step,targetY-b.y));
  if(battle.time>=b.nextAttack) {
    battleBossAttack(b,b.profile.attacks[b.attackIndex%b.profile.attacks.length]);
    b.attackIndex++;
    b.nextAttack=battle.time+b.profile.cadence;
  }
}
function battleMoveEnemyShots(step) {
  const y=battlePlaneY(), radius=battleProfile().size*.25;
  battle.enemyShots=battle.enemyShots.filter(shot=>{
    shot.x+=shot.vx*step;
    shot.y+=shot.vy*step;
    if(Math.hypot(shot.x-battle.playerX,shot.y-y)<shot.r+radius) {
      if(battle.mode==="running" && battle.time>=battle.shotGuardUntil) {
        battle.shotGuardUntil=battle.time+720;
        battleDamagePlayer(shot.damage,"Попадание выстрела босса.");
      }
      return false;
    }
    return shot.y<battle.height+26 && shot.x>-26 && shot.x<battle.width+26;
  });
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
    const tank=battle.tanks.find(t=>t.hp>0 && Math.abs(t.x-b.x)<t.size*.44+3 && Math.abs(t.y-b.y)<t.size*.56+5);
    const drone=tank?null:battle.drones.find(d=>d.hp>0 && Math.hypot(d.x-b.x,d.y-b.y)<d.size*.54);
    const boss=battle.boss;
    const bossHit=boss && boss.hp>0 && Math.hypot(boss.x-b.x,boss.y-b.y)<boss.size*.44;
    const target=tank||drone||(bossHit?boss:null);
    if(target) {
      battle.bullets.splice(i,1);
      battleDamageTarget(target,b.damage);
    }
  }
}
function battleMove(dt) {
  const step=dt/1000, planeY=battlePlaneY(), s=battleProfile();
  battleMovePlayer(step);
  battle.explosions=battle.explosions.filter(e=>battle.time-e.time<650);

  for(const t of battle.tanks) t.y+=t.speed*step;
  for(const d of battle.drones) {
    if(battle.wave>=3) {
      const maxSpeed=Math.min(155,65+battle.wave*10);
      const targetVx=Math.max(-maxSpeed,Math.min(maxSpeed,(battle.playerX-d.x)*1.45));
      d.vx+=(targetVx-d.vx)*Math.min(1,step*2.5);
    }
    d.y+=d.speed*step;
    d.x+=d.vx*step;
    d.phase+=step*1.25;
    if(d.x<22 || d.x>battle.width-22) {
      d.x=Math.max(22,Math.min(battle.width-22,d.x));
      d.vx*=-1;
    }
  }
  battleMoveBoss(step);
  battleMoveBullets(step);
  battle.tanks=battle.tanks.filter(t=>t.hp>0 && t.y<battle.height+t.size);
  battle.drones=battle.drones.filter(d=>d.hp>0 && d.y<battle.height+d.size);
  battleAdvanceWave();

  battle.powerups=battle.powerups.filter(p=>{
    p.y+=p.speed*step;
    if(Math.hypot(p.x-battle.playerX,p.y-planeY)<s.size*.37+15) {
      battle.buffs[p.type]=battle.time+12000;
      battleSetStatus("Усиление: "+BATTLE_POWERUPS[p.type].label+" · 12 секунд.");
      return false;
    }
    return p.y<battle.height+32;
  });
  battle.balloons=battle.balloons.filter(p=>{
    p.y+=p.speed*step;
    if(Math.hypot(p.x-battle.playerX,p.y-planeY)<s.size*.32+18 && battle.bombs<BATTLE_BOMB_LIMIT) {
      battle.bombs++;
      battleSetStatus("Подобрана бомба. Запас: "+battle.bombs+"/"+BATTLE_BOMB_LIMIT+".");
      return false;
    }
    return p.y<battle.height+32;
  });
  const collided=enemy=>Math.hypot(enemy.x-battle.playerX,enemy.y-planeY)<s.size*.28+enemy.size*.39;
  if(battle.boss && collided(battle.boss)) {
    battleFinish("Самолёт уничтожен при столкновении с корпусом босса.");
    return;
  }
  for(let i=battle.drones.length-1;i>=0;i--) {
    const drone=battle.drones[i];
    if(!collided(drone)) continue;
    battle.drones.splice(i,1);
    battleExplode(drone.x,drone.y,drone.size*1.65);
    battleDamagePlayer(BATTLE_DRONE_DAMAGE,"Столкновение с дроном.");
    if(battle.mode!=="running") return;
  }
  battleMoveEnemyShots(step);
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
  if(!battle.boss && battle.time>=battle.nextTank) {
    battleSpawnTank();
    battle.nextTank=battle.time+Math.max(410,1040-battle.time/160-battle.kills*7);
  }
  if(!battle.boss && battle.time>=battle.nextDrone) {
    battleSpawnDrones();
    battle.nextDrone=battle.time+2900+5200/battle.wave;
  }
  if(battle.time>=battle.nextPowerup) {
    battleSpawnPowerup();
    battle.nextPowerup=battle.time+7700+Math.random()*3900;
  }
  if(battle.time>=battle.nextBalloon) {
    battleSpawnBalloon();
    battle.nextBalloon=battle.time+7200+Math.random()*2600;
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
function battleCreateGroundStrip() {
  const tiles=BATTLE_GROUND.map(battleImage);
  if(tiles.some(image=>!image.complete || !image.naturalWidth)) return null;

  const {naturalWidth:width,naturalHeight:height}=tiles[0];
  const overlap=Math.round(height*.16), stride=height-overlap;
  const strip=document.createElement("canvas");
  strip.width=width;
  strip.height=stride*tiles.length;
  const ctx=strip.getContext("2d");

  const seam=document.createElement("canvas");
  seam.width=width;
  seam.height=overlap;
  const mask=seam.getContext("2d");
  const fade=mask.createLinearGradient(0,0,0,overlap);
  fade.addColorStop(0,"#000");
  fade.addColorStop(1,"transparent");

  // Continue the previous tile over the start of this one, including across the loop boundary.
  tiles.forEach((tile,index)=>{
    const y=index*stride, previous=tiles[(index+tiles.length-1)%tiles.length];
    ctx.drawImage(tile,0,0,width,stride,0,y,width,stride);
    mask.globalCompositeOperation="copy";
    mask.drawImage(previous,0,stride,width,overlap,0,0,width,overlap);
    mask.globalCompositeOperation="destination-in";
    mask.fillStyle=fade;
    mask.fillRect(0,0,width,overlap);
    ctx.drawImage(seam,0,y);
  });
  return strip;
}
function battleDrawGround(ctx,w,h,time) {
  const ground=battle.groundStrip??=battleCreateGroundStrip();
  if(!ground) {
    ctx.fillStyle="#1b251d";
    ctx.fillRect(0,0,w,h);
    return;
  }

  const dpr=battle.dpr;
  const height=Math.ceil(Math.max(h,w*ground.height/ground.width)*dpr)/dpr;
  const width=height*ground.width/ground.height;
  const x=(w-width)/2;
  const offset=(Math.round(time*BATTLE_SCROLL_PX_PER_MS*dpr)/dpr)%height;
  ctx.drawImage(ground,x,offset-height,width,height);
  ctx.drawImage(ground,x,offset,width,height);
  ctx.fillStyle="rgba(11,23,13,.18)";
  ctx.fillRect(0,0,w,h);
}
function battleDrawBoss(ctx,b,time) {
  const {x,y,size,profile}=b;
  if(!battleDrawSprite(profile.sprite,x,y,size,size)) battleMarker(x,y,size*.4,profile.color);
  const barWidth=size*.94, barY=y-size*.58;
  ctx.fillStyle="#161d18";
  ctx.fillRect(x-barWidth/2,barY,barWidth,6);
  ctx.fillStyle=profile.color;
  ctx.fillRect(x-barWidth/2,barY,barWidth*b.hp/b.maxHp,6);
  if(b.nextAttack-time<=580) {
    ctx.save();
    ctx.strokeStyle=profile.color;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(x,y,size*.47,0,Math.PI*2);
    ctx.stroke();
    ctx.fillStyle="#141916";
    ctx.fillRect(x-71,y+size*.55,142,19);
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.font="600 11px system-ui";
    ctx.fillText(BATTLE_ATTACK_LABELS[profile.attacks[b.attackIndex%profile.attacks.length]],x,y+size*.55+13);
    ctx.restore();
  }
}
function battleDrawBlast(ctx,time) {
  if(!battle.blast) return;
  const {x,y,radius}=battle.blast, progress=(time-battle.blast.time)/480;
  if(progress>=1) {
    battle.blast=null;
    return;
  }
  ctx.save();
  ctx.globalAlpha=(1-progress)*.8;
  ctx.strokeStyle="#ffd77d";
  ctx.fillStyle="rgba(255,181,64,.18)";
  ctx.lineWidth=4*(1-progress)+1;
  ctx.beginPath();
  ctx.arc(x,y,radius*(.36+.64*progress),0,Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function battleDraw() {
  const {ctx,width:w,height:h,time}=battle;
  if(!ctx || !w || !h) return;
  battleDrawGround(ctx,w,h,time);
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
  if(battle.boss) battleDrawBoss(ctx,battle.boss,time);
  for(const p of battle.balloons) {
    if(!battleDrawSprite(BATTLE_EFFECTS.bombs,p.x,p.y,45,54,Math.sin(time/375)*.12)) battleMarker(p.x,p.y,13,"#ffb939");
  }
  for(const shot of battle.enemyShots) {
    battleMarker(shot.x,shot.y,shot.r,shot.color);
    battleMarker(shot.x,shot.y,shot.r*.46,"#fff5d9");
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
  battleDrawBlast(ctx,time);
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
      ...BATTLE_GROUND,
      ...BATTLE_BOSSES.map(b=>b.sprite),
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
  $("#battleBombBtn").addEventListener("click",battleDropBomb);
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
    if(battle.mode!=="running" || !e.isPrimary || e.button!==0 || e.target.closest("button")) return;
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
    if(e.code==="Space" || e.key===" ") {
      e.preventDefault();
      if(!e.repeat) battleDropBomb();
      return;
    }
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
