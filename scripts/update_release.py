from pathlib import Path
import base64
import gzip
import re
import subprocess

ROOT = Path(".")
ORDER = [
    "kr-01a", "kr-01b", "kr-02", "kr-03",
    "kr-04q1", "kr-04q2", "kr-04q3", "kr-04q4", "kr-04b",
    "kr-05a", "kr-05b", "kr-06a", "kr-06b",
    "kr-07q1", "kr-07q2", "kr-07q3", "kr-07q4", "kr-07b",
    "kr-08q1", "kr-08q2", "kr-08q3", "kr-08q4", "kr-08b",
]


def fail(message):
    raise SystemExit(message)


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)


def append_to_array(source, marker, item, label):
    start = source.find(marker)
    if start < 0:
        fail(f"{label}: declaration not found")
    end = source.find("];", start)
    if end < 0:
        fail(f"{label}: array terminator not found")
    current = source[start:end].rstrip()
    if item.splitlines()[0].strip() in current:
        fail(f"{label}: item appears to be already present")
    return source[:end] + ",\n" + item.strip() + "\n" + source[end:]


def replace_function(source, name, replacement):
    pattern = re.compile(r"(?m)^function\s+" + re.escape(name) + r"\s*\(")
    match = pattern.search(source)
    if not match:
        fail(f"JavaScript function not found: {name}")
    next_match = re.search(r"(?m)^function\s+", source[match.end():])
    end = match.end() + next_match.start() if next_match else len(source)
    return source[:match.start()] + replacement.strip() + "\n" + source[end:].lstrip("\n")


def remove_function(source, name):
    pattern = re.compile(r"(?m)^function\s+" + re.escape(name) + r"\s*\(")
    match = pattern.search(source)
    if not match:
        return source
    next_match = re.search(r"(?m)^function\s+", source[match.end():])
    end = match.end() + next_match.start() if next_match else len(source)
    return source[:match.start()] + source[end:].lstrip("\n")


# Rebuild the static site from its existing ordered gzip/Base64 fragments.
paths = [Path("site") / (name + ".b64") for name in ORDER]
original_chunks = [path.read_text(encoding="utf-8").strip() for path in paths]
raw = "".join(original_chunks)
html = gzip.decompress(base64.b64decode(raw, validate=True)).decode("utf-8")

if 'id:"sj-100"' in html or "Комсомольский-на-Амуре государственный университет (КнАГУ)" in html:
    fail("Requested update is already present; refusing to apply duplicate cards")

# 1. Add the verified SJ-100 history and production references to the source list.
sources = """
{title:"ПАО «Яковлев» — первый полёт импортозамещённого SJ-100, построенного по серийным технологиям",kind:"официальный производитель",note:"5 сентября 2025 года машина №97004 выполнила первый полёт с заводского аэродрома в Комсомольске-на-Амуре; сертификационные испытания продолжались.",url:"https://yakovlev.ru/press-centre/releases/v-komsomolske-na-amure-sovershil-pervyy-polet-importozameshchennyy-sj-100-postroennyy-po-seriynym-te/"},
{title:"ПАО «Яковлев» — Производственный центр в Комсомольске-на-Амуре",kind:"официальная страница предприятия",note:"История площадки, окончательная сборка Superjet/SJ-100, лётные испытания и модернизация производства.",url:"https://yakovlev.ru/structure/production-center/"}
"""
html = append_to_array(html, "const SOURCES=[", sources, "SOURCES")

# 2. Add SJ-100 to the aircraft collection and its hangar/aircraft cards.
sj_aircraft = """
{id:"sj-100",name:"SJ-100",year:2025,type:"ближнемагистральный пассажирский реактивный самолёт",group:"civil",era:"e10",designer:"ПАО «Яковлев» / филиал «Региональные самолёты»",short:"Импортозамещённая версия Superjet-100 с российскими системами и двигателями ПД-8.",details:"SJ-100 — глубоко обновлённая версия семейства Superjet-100, в которой зарубежные агрегаты заменяются российскими системами, оборудованием и комплектующими. 5 сентября 2025 года самолёт №97004, построенный по серийным технологиям на производственной площадке ПАО «Яковлев» в Комсомольске-на-Амуре, впервые поднялся в воздух с заводского аэродрома. Машина оснащена российскими системами и двигателями ПД-8. Полёт прошёл в рамках программы испытаний и сертификации: поставки серийных самолётов возможны после завершения необходимых проверок и одобрения их результатов Росавиацией. SJ-100 относится к классу ближнемагистральных узкофюзеляжных лайнеров примерно на 100 пассажиров.",features:["пассажирский лайнер класса 100 мест","2 двигателя ПД-8","ближнемагистральные маршруты","российские авионика и системы"],significance:"Показывает современный этап развития гражданского авиастроения и промышленной кооперации Комсомольска-на-Амуре: часть планера производит КнААЗ, окончательная сборка ведётся на площадке «Яковлева».",image:"https://images.news.ru/2026/05/14/orN7BHkezbpB9Qa7gryyT0aeRPB4guWZy8gyaHyI_780.jpg",sources:[17,18],ttx:{crew:"2 пилота",engine:"2 × ПД-8"}}
"""
html = append_to_array(html, "const AIRCRAFT=[", sj_aircraft, "AIRCRAFT")

# 3. Add KnAGU as an aviation education/engineering centre, using a photograph of its
# aerodynamics laboratory. The university's own pages document the programme since 1956.
knagu_section = """
<div class="centers-section"><div class="centers-section-head"><h3>Образование и подготовка авиационных инженеров</h3><span>ИНЖЕНЕРНАЯ ШКОЛА / ДАЛЬНИЙ ВОСТОК</span></div><div class="centers-grid">
<article class="center-card featured"><div class="center-photo"><img alt="Лаборатория аэродинамики и аэромеханики летательных аппаратов КнАГУ" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="https://pl-llc.ru/upload/medialibrary/f14/9jhzfajdhhctmijwgwzjkck6l4hwg3u1.png"/></div><div class="center-top"><span class="center-type">АВИАЦИОННОЕ ОБРАЗОВАНИЕ / ИНЖЕНЕРНАЯ ШКОЛА</span><span class="center-city">КОМСОМОЛЬСК-НА-АМУРЕ</span></div><h4>Комсомольский-на-Амуре государственный университет (КнАГУ)</h4><p>Авиационное направление университета ведёт историю с 1956 года, когда в Комсомольском-на-Амуре вечернем политехническом институте открыли подготовку по самолётостроению. Сегодня кафедра «Авиастроение» готовит бакалавров по направлению 24.03.04 «Авиастроение», инженеров по специальности 24.05.07 «Самолёто- и вертолётостроение», а также аспирантов. В лабораториях есть самолёты и агрегаты, аэродинамические трубы, стенды систем воздушного судна, лаборатории гидроприводов и сборочных процессов, CAD/CAE-комплексы. Университет тесно связан с промышленностью Комсомольска и Арсеньева: студенты проходят практику, в частности, на КнААЗ и в ПАО «Яковлев».</p><div class="center-programs"><span>Авиация с 1956 года</span><span>24.03.04 «Авиастроение»</span><span>24.05.07 «Самолёто- и вертолётостроение»</span><span>CAD / CAE</span></div><a class="center-link" href="https://knastu.ru/page/1794" rel="noreferrer" target="_blank">КНАГУ / КАФЕДРА «АВИАСТРОЕНИЕ» →</a></article>
</div></div>
"""
knagu_anchor = '<div class="centers-section"><div class="centers-section-head"><h3>Крупнейшие конструкторские школы</h3>'
if html.count(knagu_anchor) != 1:
    fail("Could not find the design-centres section to insert the KnAGU card")
html = html.replace(knagu_anchor, knagu_section + "\n" + knagu_anchor, 1)

# 4. Distinguish KnAAZ's airframe component work from Yakovlev's final assembly.
kn_aaz_old = "Один из главных центров российского самолётостроения на Дальнем Востоке. Предприятие выпускает серийные боевые самолёты семейства «Су», а в 2026 году на площадке продолжается расширение производственной инфраструктуры."
kn_aaz_new = "Один из главных центров российского самолётостроения на Дальнем Востоке. КнААЗ выпускает серийные Су-35С и Су-57, а в кооперации по SJ-100 производит агрегаты крыла и фюзеляжные отсеки. Окончательная сборка пассажирского лайнера выполняется на отдельной площадке ПАО «Яковлев» в Комсомольске-на-Амуре."
html = replace_once(html, kn_aaz_old, kn_aaz_new, "KnAAZ description")
html = replace_once(html, "<span>SSJ-100</span>", "<span>АГРЕГАТЫ SJ-100</span>", "KnAAZ programme badge")

# 5. Add Yakovlev's actual final-assembly/flight-test production centre to the production section.
yakovlev_card = """
<article class="center-card"><div class="center-photo"><img alt="Пассажирский Superjet у ангара производственного центра «Яковлев»" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="https://images.news.ru/2026/05/14/orN7BHkezbpB9Qa7gryyT0aeRPB4guWZy8gyaHyI_780.jpg"/></div><div class="center-top"><span class="center-type">ГРАЖДАНСКАЯ АВИАЦИЯ / ОКОНЧАТЕЛЬНАЯ СБОРКА</span><span class="center-city">КОМСОМОЛЬСК-НА-АМУРЕ</span></div><h4>Производственный центр ПАО «Яковлев»</h4><p>История площадки начинается 1 февраля 2005 года, когда в Комсомольске-на-Амуре был создан филиал «Гражданских самолётов Сухого», позднее вошедший в ПАО «Яковлев». Это одна из двух площадок окончательной сборки гражданских лайнеров компании: здесь собирают фюзеляж SJ-100, монтируют авиационное оборудование и пассажирский салон, а заводская лётно-испытательная станция выполняет первые полёты. Площадка модернизируется под импортозамещённый SJ-100; заявленная проектная мощность обновлённого предприятия — не менее 20 самолётов в год.</p><div class="center-programs"><span>SJ-100</span><span>Superjet-100</span><span>Окончательная сборка</span><span>Лётные испытания</span></div><a class="center-link" href="https://yakovlev.ru/structure/production-center/" rel="noreferrer" target="_blank">ЯКОВЛЕВ / ПРОИЗВОДСТВЕННЫЙ ЦЕНТР →</a></article>
"""
yakovlev_anchor = '<article class="center-card"><div class="center-photo"><img alt="Казанский авиационный завод'
if html.count(yakovlev_anchor) != 1:
    fail("Could not find the production-centres list to insert the Yakovlev card")
html = html.replace(yakovlev_anchor, yakovlev_card + "\n" + yakovlev_anchor, 1)

# 6. Update the game introduction and create local, hand-drawn aircraft profiles.
battle_intro_old = "Выбери изученный боевой самолёт и удерживай оборону. Самолёт находится внизу поля, танки непрерывно входят сверху."
battle_intro_new = "Выбери изученный боевой самолёт и удерживай оборону. Сверху появляются танки, дроны и случайные усиления: собирай бонусы, расширяй залп и уклоняйся от беспилотников — столкновение завершает вылет."
html = replace_once(html, battle_intro_old, battle_intro_new, "Battle introduction")

sprite_object = """
const BATTLE_SPRITES={
  "il-2":{wing:"straight",tail:"classic",engines:1,propeller:true,accent:"#d8b56d",body:"#899078"},
  "yak-3":{wing:"tapered",tail:"compact",engines:1,propeller:true,accent:"#e0c27c",body:"#8b997d"},
  "mig-15":{wing:"swept",tail:"classic",engines:1,accent:"#d3d9d3",body:"#a8b2b3"},
  "mig-21":{wing:"delta",tail:"single",engines:1,accent:"#e0bd70",body:"#a7b0a9"},
  "mig-29":{wing:"twin",tail:"twin",engines:2,accent:"#c7d1c9",body:"#82918c"},
  "su-27":{wing:"wide",tail:"twin",engines:2,accent:"#d7c27c",body:"#8e9e94"},
  "su-34":{wing:"wide",tail:"twin",engines:2,nose:"broad",accent:"#e0c37a",body:"#8c998f"},
  "su-35":{wing:"wide",tail:"twin",engines:2,accent:"#c6d6cf",body:"#82958d"},
  "su-57":{wing:"stealth",tail:"canted",engines:2,accent:"#e2b96d",body:"#7d8988"}
};
"""
start = html.find("const BATTLE_SPRITES={")
if start < 0:
    fail("BATTLE_SPRITES object was not found")
end = html.find("};", start)
if end < 0:
    fail("BATTLE_SPRITES object terminator was not found")
html = html[:start] + sprite_object.strip() + html[end + 2:]

battle_state = """
let battle={
  running:false,raf:0,last:0,lastFire:0,lastSpawn:0,startedAt:0,score:0,kills:0,wave:1,
  selected:null,playerX:0,keys:{left:false,right:false},bullets:[],tanks:[],powerups:[],drones:[],
  buffs:{tripleUntil:0,damageUntil:0,rapidUntil:0},nextPowerupAt:0,nextDroneAt:0,
  canvas:null,ctx:null,field:null,rafBound:false,trainingOnly:false,images:{}
};
"""
start = html.find("let battle={")
if start < 0:
    fail("Battle state was not found")
end = html.find("};", start)
if end < 0:
    fail("Battle state terminator was not found")
html = html[:start] + battle_state.strip() + html[end + 2:]

# The selection strip now renders the same in-project canvas aircraft silhouettes as the game.
battle_selection = r"""
function battleRenderSelection(){
  const host=$("#battleAircraftSelect"),statsHost=$("#battleStats"),startBtn=$("#battleStartBtn");if(!host)return;
  const list=battleStudiedAircraft();
  if(!battle.selected||!list.some(a=>a.id===battle.selected))battle.selected=list.length?list[0].id:null;
  host.innerHTML=list.map(a=>{
    const s=BATTLE_STATS[a.id],learned=openId(a.id);
    const thumb='<canvas class="battle-aircraft-icon" data-battle-icon="'+a.id+'" width="112" height="72" aria-hidden="true"></canvas>';
    return '<button type="button" class="battle-plane-option '+(battle.selected===a.id?'active':'')+'" data-battle-aircraft="'+a.id+'"><span class="battle-plane-thumb">'+thumb+'</span><span><strong>'+a.name+'</strong><small>'+(learned?'ИЗУЧЕН':'УЧЕБНЫЙ')+' · '+s.era+' · '+s.damage+' урона</small></span></button>';
  }).join('');
  $$('[data-battle-aircraft]').forEach(b=>b.onclick=()=>battleSelect(b.dataset.battleAircraft));
  $$('[data-battle-icon]').forEach(canvas=>battleLoadThumbnail(canvas,canvas.dataset.battleIcon));
  if(startBtn){startBtn.type='button';startBtn.disabled=!list.length;startBtn.style.opacity=list.length?1:.55;}
  const meta=battleSelectedMeta();
  if(statsHost&&meta){const {a,s}=meta;statsHost.innerHTML='<div class="battle-grade">'+(battle.trainingOnly?'УЧЕБНЫЙ РЕЖИМ':s.grade)+'</div><div class="battle-stat-grid"><div class="battle-stat"><b>РАЗМЕР</b><span>'+s.size+' px</span></div><div class="battle-stat"><b>ТЕМП ОГНЯ</b><span>'+(1000/s.fire).toFixed(1)+' выстр./с</span></div><div class="battle-stat"><b>УРОН</b><span>'+s.damage+'</span></div><div class="battle-stat"><b>СКОРОСТЬ СНАРЯДА</b><span>'+s.bullet+' px/с</span></div><div class="battle-stat"><b>ЭПОХА</b><span>'+s.era+'</span></div></div><div class="battle-corner-note">'+a.name+': чем современнее машина, тем выше темп огня, скорость снаряда и урон. Усиления временно повышают эти параметры.</div>';}
  battleSetSelectionNote();
}
"""
html = replace_function(html, "battleRenderSelection", battle_selection)

# Selection-overlay controls are reset when choosing an aircraft / returning to the menu.
selection_note = r"""
function battleSetSelectionNote(){
  const overlayText=$("#battleOverlayText"),status=$("#battleStatus"),title=$("#battleOverlay h3"),start=$("#battleStartBtn");
  const meta=battleSelectedMeta();
  if(title)title.textContent="Готовность";
  if(start)start.textContent="НАЧАТЬ БОЙ →";
  if(overlayText)overlayText.textContent=battle.trainingOnly
    ? "Учебный запуск: Ил-2 доступен сразу. После изучения машин в «Авиапарке» они появятся в выборе."
    : meta?"Выбран "+meta.a.name+". Нажми «НАЧАТЬ БОЙ».":"Выбери изученный самолёт.";
  if(status)status.textContent=battle.trainingOnly
    ? "Учебный Ил-2 доступен для первого боя."
    : meta?"Выбран "+meta.a.name+". Нажми «НАЧАТЬ БОЙ».":"Выбери изученный самолёт.";
}
"""
html = replace_function(html, "battleSetSelectionNote", selection_note)

thumbnail = r"""
function battleLoadThumbnail(canvas,id){
  if(!canvas||!canvas.getContext)return;
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  battleDrawPlaneGlyph(ctx,id,canvas.width/2,canvas.height/2,55);
}
"""
html = replace_function(html, "battleLoadThumbnail", thumbnail)

plane_loader = r"""
function battleLoadPlaneImage(){
  // Battle aircraft are drawn locally; no remote image, proxy or CORS access is required.
  battle.images={};
}
"""
html = replace_function(html, "battleLoadPlaneImage", plane_loader)

clear_entities = r"""
function battleClearEntities(){
  battle.bullets.length=0;battle.tanks.length=0;battle.powerups.length=0;battle.drones.length=0;
  battle.buffs={tripleUntil:0,damageUntil:0,rapidUntil:0};
}
"""
html = replace_function(html, "battleClearEntities", clear_entities)

spawn_entities = r"""
function battleSpawnTank(){
  const {w}=battleCanvasSize(),elapsed=(performance.now()-battle.startedAt)/1000;
  const hp=5+Math.floor(elapsed/16)+Math.floor(battle.kills/25);
  const size=Math.max(44,Math.min(64,52+Math.floor(battle.wave/4)));
  battle.tanks.push({x:size/2+20+Math.random()*(Math.max(40,w-size-40)),y:-size,hp,maxHp:hp,speed:48+Math.min(60,elapsed*1.1)+Math.random()*20,size});
}
function battleSpawnPowerup(){
  const {w}=battleCanvasSize(),types=["triple","damage","rapid"],type=types[Math.floor(Math.random()*types.length)];
  battle.powerups.push({x:28+Math.random()*Math.max(20,w-56),y:-24,r:17,speed:75+Math.random()*32,type,rotation:Math.random()*Math.PI*2});
}
function battleSpawnDrone(){
  const {w}=battleCanvasSize(),size=36+Math.random()*8;
  battle.drones.push({x:42+Math.random()*Math.max(20,w-84),y:-size,r:size*.48,size,speed:105+Math.min(70,battle.wave*5)+Math.random()*24,vx:(Math.random()-.5)*100,phase:Math.random()*Math.PI*2,hp:1});
}
"""
html = replace_function(html, "battleSpawnTank", spawn_entities)

create_bullet = r"""
function battleCreateBullet(now){
  const {h}=battleCanvasSize(),meta=battleSelectedMeta();if(!meta)return;
  const triple=now<(battle.buffs.tripleUntil||0),damageBoost=now<(battle.buffs.damageUntil||0);
  const angles=triple?[-.19,0,.19]:[0],speed=meta.s.bullet,damage=meta.s.damage*(damageBoost?1.8:1);
  const y=h-meta.s.size*.78-meta.s.size*.42;
  for(const angle of angles){
    battle.bullets.push({x:battle.playerX+Math.sin(angle)*5,y,vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed,speed,damage,r:triple?4.5:4});
  }
}
"""
html = replace_function(html, "battleCreateBullet", create_bullet)

move_entities = r"""
function battleMove(dt){
  const {w,h}=battleCanvasSize(),meta=battleSelectedMeta();if(!meta)return;
  const now=performance.now(),step=dt/1000,playerY=h-meta.s.size*.78;
  const dir=(battle.keys.left?-1:0)+(battle.keys.right?1:0);if(dir)battle.playerX+=dir*meta.s.move*step;
  battle.playerX=Math.max(meta.s.size/2+10,Math.min(w-meta.s.size/2-10,battle.playerX));

  for(let i=battle.bullets.length-1;i>=0;i--){
    const b=battle.bullets[i];b.x+=b.vx*step;b.y+=b.vy*step;
    if(b.y< -40||b.x< -30||b.x>w+30){battle.bullets.splice(i,1);continue;}
    let hit=false;
    for(let j=battle.tanks.length-1;j>=0;j--){
      const t=battle.tanks[j];
      if(battleTankHit(t,b)){t.hp-=b.damage;battle.bullets.splice(i,1);if(t.hp<=0)battleDestroyTank(j);hit=true;break;}
    }
    if(hit)continue;
    for(let j=battle.drones.length-1;j>=0;j--){
      const d=battle.drones[j];
      if(Math.hypot(d.x-b.x,d.y-b.y)<d.r+b.r+2){
        battle.drones.splice(j,1);battle.bullets.splice(i,1);battle.score+=15;
        if(battle.score>battleSafeBest())battleSaveBest();
        break;
      }
    }
  }

  for(let i=battle.powerups.length-1;i>=0;i--){
    const p=battle.powerups[i];p.y+=p.speed*step;p.rotation+=step*1.6;
    if(Math.hypot(p.x-battle.playerX,p.y-playerY)<p.r+meta.s.size*.35){
      const key=p.type==="triple"?"tripleUntil":p.type==="damage"?"damageUntil":"rapidUntil";
      battle.buffs[key]=Math.max(now,battle.buffs[key]||0)+12000;
      const labels={triple:"ТРОЙНОЙ ЗАЛП",damage:"УСИЛЕННЫЙ УРОН",rapid:"СКОРОСТРЕЛЬНОСТЬ"};
      const status=$("#battleStatus");if(status)status.textContent="Получено усиление: "+labels[p.type]+" · 12 секунд";
      battle.powerups.splice(i,1);continue;
    }
    if(p.y>h+30)battle.powerups.splice(i,1);
  }

  for(let i=battle.drones.length-1;i>=0;i--){
    const d=battle.drones[i];d.y+=d.speed*step;d.x+=d.vx*step;
    if(d.x<28||d.x>w-28)d.vx*=-1;
    d.x=Math.max(28,Math.min(w-28,d.x));
    if(Math.hypot(d.x-battle.playerX,d.y-playerY)<d.r+meta.s.size*.31){
      battleGameOver();return;
    }
    if(d.y>h+d.size)battle.drones.splice(i,1);
  }

  for(let i=battle.tanks.length-1;i>=0;i--){
    const t=battle.tanks[i];t.y+=t.speed*step;if(t.y>h+t.size)battle.tanks.splice(i,1);
  }
}
"""
html = replace_function(html, "battleMove", move_entities)

draw_entities = r"""
function battleDrawPlaneGlyph(ctx,id,x,y,size){
  if(!ctx)return;
  const spec=BATTLE_SPRITES[id]||BATTLE_SPRITES["su-27"];
  const wingShapes={
    straight:[[-5,-18],[-43,-5],[-45,8],[-12,4],[-8,22],[-3,27]],
    tapered:[[-5,-20],[-41,-4],[-38,8],[-11,5],[-7,21],[-3,26]],
    swept:[[-5,-24],[-45,-2],[-38,10],[-11,7],[-7,21],[-3,27]],
    delta:[[-5,-24],[-45,-4],[-34,15],[-10,8],[-4,26]],
    twin:[[-5,-24],[-46,-3],[-38,11],[-12,7],[-7,22],[-3,27]],
    wide:[[-5,-24],[-48,-1],[-43,12],[-14,8],[-7,23],[-3,28]],
    stealth:[[-5,-27],[-47,-2],[-36,15],[-13,9],[-6,22],[-3,28]]
  };
  const points=wingShapes[spec.wing]||wingShapes.swept;
  const body=spec.body||"#8c9991",accent=spec.accent||"#d9bf79",outline="#26352f";
  ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
  ctx.shadowColor="rgba(0,0,0,.38)";ctx.shadowBlur=5;ctx.shadowOffsetY=2;

  function polygon(poly,fill,stroke){
    ctx.beginPath();ctx.moveTo(poly[0][0],poly[0][1]);
    for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0],poly[i][1]);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke||outline;ctx.lineWidth=1.5;ctx.stroke();
  }

  polygon(points,body,outline);
  ctx.save();ctx.scale(-1,1);polygon(points,body,outline);ctx.restore();

  // Horizontal stabilisers and vertical fins vary between propeller fighters and twin-tail jets.
  if(spec.tail==="twin"||spec.tail==="canted"){
    polygon([[-5,19],[-27,29],[-24,36],[-5,31]],body,outline);
    ctx.save();ctx.scale(-1,1);polygon([[-5,19],[-27,29],[-24,36],[-5,31]],body,outline);ctx.restore();
    const finColor=spec.tail==="canted"?accent:body;
    polygon([[-4,17],[-17,24],[-14,31],[-4,28]],finColor,outline);
    ctx.save();ctx.scale(-1,1);polygon([[-4,17],[-17,24],[-14,31],[-4,28]],finColor,outline);ctx.restore();
  }else{
    polygon([[-4,20],[-23,29],[-19,34],[-3,29]],body,outline);
    ctx.save();ctx.scale(-1,1);polygon([[-4,20],[-23,29],[-19,34],[-3,29]],body,outline);ctx.restore();
  }

  // Engine nacelles on twin-engine aircraft.
  if(spec.engines===2){
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*8,17);
      ctx.beginPath();ctx.roundRect(-3,-4,6,23,2);ctx.fillStyle="#4b5653";ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=1.2;ctx.stroke();
      ctx.fillStyle="#d1a35f";ctx.fillRect(-2,14,4,4);
      ctx.restore();
    }
  }else if(spec.engines===1&&!spec.propeller){
    ctx.beginPath();ctx.ellipse(0,15,3.2,12,0,0,Math.PI*2);ctx.fillStyle="#56615c";ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=1.1;ctx.stroke();
  }

  // Fuselage: wide nose for the Su-34, long faceted nose for delta/stealth profiles.
  const nose=spec.nose==="broad";
  polygon(nose
    ? [[0,-45],[6,-40],[8,-29],[7,-13],[6,20],[9,34],[0,42],[-9,34],[-6,20],[-7,-13],[-8,-29],[-6,-40]]
    : [[0,-46],[4.7,-37],[5.4,-15],[4.5,20],[7,34],[0,42],[-7,34],[-4.5,20],[-5.4,-15],[-4.7,-37]],accent,outline);

  // Cockpit, canopy and nose highlight.
  ctx.beginPath();ctx.moveTo(0,-36);ctx.quadraticCurveTo(4,-31,3.2,-21);ctx.lineTo(0,-15);ctx.lineTo(-3.2,-21);ctx.quadraticCurveTo(-4,-31,0,-36);ctx.closePath();
  ctx.fillStyle="#a9c7c8";ctx.fill();ctx.strokeStyle="#526b6b";ctx.lineWidth=1.1;ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-41);ctx.lineTo(0,-36);ctx.strokeStyle="#f0dfab";ctx.lineWidth=1.3;ctx.stroke();

  // Identification panels and wing roots.
  ctx.strokeStyle="rgba(28,43,38,.68)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(-10,2);ctx.lineTo(-4,5);ctx.moveTo(10,2);ctx.lineTo(4,5);ctx.moveTo(0,5);ctx.lineTo(0,29);ctx.stroke();
  ctx.fillStyle="#d8e0d6";ctx.fillRect(-25,2,6,2);ctx.fillRect(19,2,6,2);
  ctx.fillStyle="#b84f42";ctx.fillRect(-24,2,2,2);ctx.fillRect(22,2,2,2);

  if(spec.propeller){
    ctx.shadowBlur=0;ctx.strokeStyle="#e1d7b4";ctx.lineWidth=2.2;
    ctx.beginPath();ctx.moveTo(0,-48);ctx.lineTo(0,-55);ctx.moveTo(-4,-51);ctx.lineTo(4,-51);ctx.stroke();
    ctx.beginPath();ctx.arc(0,-48,2,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();
  }
  ctx.restore();
}

function battleDrawPlane(ctx){
  const {h}=battleCanvasSize(),meta=battleSelectedMeta();if(!meta)return;
  const s=meta.s.size,x=battle.playerX,y=h-s*.78;
  battleDrawPlaneGlyph(ctx,meta.a.id,x,y,s*1.12);
}
function battleDrawPowerup(ctx,p){
  const colors={triple:"#7ec9e3",damage:"#f0a15f",rapid:"#b7d58b"};
  const labels={triple:"3×",damage:"DMG",rapid:"FAST"};
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
  ctx.shadowColor=colors[p.type];ctx.shadowBlur=13;
  ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fillStyle="rgba(17,29,25,.94)";ctx.fill();
  ctx.lineWidth=2.5;ctx.strokeStyle=colors[p.type];ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle=colors[p.type];ctx.font="bold 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(labels[p.type],0,0);
  ctx.restore();
}
function battleDrawDrone(ctx,d){
  ctx.save();ctx.translate(d.x,d.y);
  ctx.shadowColor="rgba(233,82,66,.62)";ctx.shadowBlur=12;
  ctx.strokeStyle="#e46d5e";ctx.fillStyle="#39443f";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-d.size*.42,-d.size*.28);ctx.lineTo(d.size*.42,d.size*.28);ctx.moveTo(-d.size*.42,d.size*.28);ctx.lineTo(d.size*.42,-d.size*.28);ctx.stroke();
  for(const side of [-1,1]){
    for(const vertical of [-1,1]){
      ctx.beginPath();ctx.arc(side*d.size*.38,vertical*d.size*.28,d.size*.16,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(side*d.size*.38,vertical*d.size*.28,d.size*.1,0,Math.PI*2);ctx.stroke();
    }
  }
  ctx.beginPath();ctx.arc(0,0,d.size*.2,0,Math.PI*2);ctx.fillStyle="#b8493e";ctx.fill();ctx.strokeStyle="#f1b0a2";ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,d.size*.06,0,Math.PI*2);ctx.fillStyle="#ffe3b1";ctx.fill();
  ctx.restore();
}
"""
html = replace_function(html, "battleDrawPlane", draw_entities)

draw_frame = r"""
function battleDraw(){
  const c=battle.canvas,ctx=battle.ctx;if(!c||!ctx)return;
  const {w,h}=battleCanvasSize();ctx.clearRect(0,0,w,h);battleDrawBackground(ctx,w,h);
  for(const t of battle.tanks)battleDrawTank(ctx,t);
  for(const d of battle.drones)battleDrawDrone(ctx,d);
  for(const p of battle.powerups)battleDrawPowerup(ctx,p);
  ctx.fillStyle="#ffe28b";
  for(const b of battle.bullets){ctx.beginPath();ctx.arc(b.x,b.y,Math.max(2,b.r),0,Math.PI*2);ctx.fill();}
  battleDrawPlane(ctx);battleUpdateHud();
}
"""
html = replace_function(html, "battleDraw", draw_frame)

hud = r"""
function battleUpdateHud(){
  const score=$("#battleScore"),wave=$("#battleWave"),now=performance.now(),active=[];
  if(score)score.textContent="СЧЁТ "+battle.score;
  if(battle.buffs.tripleUntil>now)active.push("3 ПУЛИ");
  if(battle.buffs.damageUntil>now)active.push("УРОН +");
  if(battle.buffs.rapidUntil>now)active.push("ОГОНЬ +");
  if(wave)wave.textContent="ВОЛНА "+battle.wave+" · ЛУЧШИЙ "+battleSafeBest()+(active.length?" · "+active.join(" / "):"");
}
"""
html = replace_function(html, "battleUpdateHud", hud)

game_over = r"""
function battleGameOver(){
  battle.running=false;if(battle.raf)cancelAnimationFrame(battle.raf);
  if(battle.score>battleSafeBest())battleSaveBest();
  const overlay=$("#battleOverlay"),title=$("#battleOverlay h3"),message=$("#battleOverlayText"),button=$("#battleStartBtn"),status=$("#battleStatus");
  if(title)title.textContent="ВЫЛЕТ ЗАВЕРШЁН";
  if(message)message.textContent="Дрон столкнулся с самолётом. Итоговый счёт: "+battle.score+". Уклоняйся от беспилотников и попробуй пройти дальше.";
  if(button)button.textContent="НАЧАТЬ ЗАНОВО →";
  if(status)status.textContent="Столкновение с дроном — вылет завершён. Нажми «НАЧАТЬ ЗАНОВО».";
  if(overlay)overlay.classList.remove("hidden");
}
"""
html = replace_function(html, "battleStart", game_over + "\nfunction battleStart(){}") if False else html
# Insert the game-over routine immediately before battleStart without replacing its existing body.
if "\nfunction battleStart(" not in html:
    fail("battleStart function not found")
html = html.replace("\nfunction battleStart(", "\n" + game_over.strip() + "\nfunction battleStart(", 1)

battle_start = r"""
function battleStart(){
  const list=battleStudiedAircraft();if(!list.length){battle.trainingOnly=false;battleRenderSelection();return;}
  if(!battle.selected||!list.some(a=>a.id===battle.selected))battle.selected=list[0].id;
  const meta=battleSelectedMeta();if(!meta)return;
  try{
    if(battle.raf)cancelAnimationFrame(battle.raf);
    battle.score=0;battle.kills=0;battle.wave=1;battle.running=true;
    battle.startedAt=performance.now();battle.last=battle.startedAt;
    battle.lastFire=battle.startedAt-meta.s.fire;battle.lastSpawn=battle.startedAt-900;
    battleClearEntities();battleResizeCanvas();battle.playerX=battleCanvasSize().w/2;
    battle.nextPowerupAt=battle.startedAt+3500+Math.random()*2500;
    battle.nextDroneAt=battle.startedAt+6500+Math.random()*2500;
    battleLoadPlaneImage();
    const o=$("#battleOverlay"),title=$("#battleOverlay h3"),button=$("#battleStartBtn");
    if(o)o.classList.add("hidden");if(title)title.textContent="Готовность";if(button)button.textContent="НАЧАТЬ БОЙ →";
    const status=$("#battleStatus");if(status)status.textContent="Бой идёт: "+meta.a.name+". Собирай падающие усиления и уклоняйся от дронов.";
    battleSpawnTank();battleDraw();battle.raf=requestAnimationFrame(battleLoop);
  }catch(err){
    battle.running=false;const status=$("#battleStatus");
    if(status)status.textContent="Ошибка запуска: "+(err&&err.message?err.message:"неизвестная ошибка");
    console.error(err);
  }
}
"""
html = replace_function(html, "battleStart", battle_start)

battle_loop = r"""
function battleLoop(now){
  if(!battle.running)return;
  const dt=Math.min(40,Math.max(1,(now-battle.last)||16));battle.last=now;
  const meta=battleSelectedMeta();if(!meta){battle.running=false;return;}
  const rapid=now<(battle.buffs.rapidUntil||0),fireDelay=meta.s.fire*(rapid?.58:1);
  if(now-battle.lastFire>=fireDelay){battleCreateBullet(now);battle.lastFire=now;}
  const elapsed=(now-battle.startedAt)/1000,spawnInterval=Math.max(360,980-elapsed*8-battle.kills*8);
  if(now-battle.lastSpawn>=spawnInterval){battleSpawnTank();battle.lastSpawn=now;}
  if(now>=battle.nextPowerupAt){battleSpawnPowerup();battle.nextPowerupAt=now+8200+Math.random()*4200;}
  if(now>=battle.nextDroneAt){battleSpawnDrone();battle.nextDroneAt=now+7800+Math.random()*3200;}
  battleMove(dt);if(!battle.running)return;
  battleDraw();battle.raf=requestAnimationFrame(battleLoop);
}
"""
html = replace_function(html, "battleLoop", battle_loop)

battle_reset = r"""
function battleReset(){
  battleStop(true);battleClearEntities();battle.score=0;battle.kills=0;battle.wave=1;
  battleResizeCanvas();battleDraw();battleRenderSelection();battleUpdateHud();
}
"""
html = replace_function(html, "battleReset", battle_reset)

# Remove the old external-image proxy and white-background image processing helpers.
for obsolete in ["battleProxyUrl", "battleRotation", "battleRemoveWhiteBackground"]:
    html = remove_function(html, obsolete)

# Add a style rule for the new canvas thumbnails.
style_anchor = "</style>"
if style_anchor not in html:
    fail("Could not find the document style block")
html = html.replace(style_anchor, ".battle-plane-thumb canvas{display:block;width:100%;height:100%;}\\n" + style_anchor, 1)

# 7. Update release metadata and image attributions.
image_licenses = Path("IMAGE_LICENSES.md").read_text(encoding="utf-8")
image_licenses += """
\\n## Дополнения v23\\n
- КнАГУ — фотография лаборатории аэродинамики и аэромеханики летательных аппаратов: https://pl-llc.ru/portfolio/laboratoriya-aerodinamika-i-aeromekhanika-letatelnykh-apparatov-v-knagu/
- SJ-100 / производственный центр «Яковлев» — фотография самолёта у ангара, публикация News.ru: https://news.ru/russia/dvigatel-dlya-importozameshennogo-sj-100-proshel-vse-ispytaniya
- Самолёты в «Авиабитве» v23 нарисованы собственными Canvas-векторными силуэтами; загрузка внешних PNG/JPG для игровых иконок больше не используется.
"""
Path("IMAGE_LICENSES.md").write_text(image_licenses, encoding="utf-8")

readme = Path("README.md").read_text(encoding="utf-8")
readme = readme.replace("**v22**", "**v23**").replace("## Версия v22", "## Версия v23")
readme = readme.replace("- 17 самолётов с фото;", "- 18 самолётов с фото;")
readme = readme.replace("включает исследовательские центры, конструкторские школы и производственные площадки, включая КнААЗ в Комсомольске-на-Амуре.", "включает исследовательские центры, КнАГУ, конструкторские школы, КнААЗ и производственный центр ПАО «Яковлев» в Комсомольске-на-Амуре.")
readme = readme.replace("с Canvas, волнами, HP танков, очками и выбором изученных боевых самолётов.", "с собственными Canvas-иконками самолётов, волнами, танками, дронами и случайными усилениями (тройной залп, повышенный урон и скорострельность).")
Path("README.md").write_text(readme, encoding="utf-8")

index = Path("index.html").read_text(encoding="utf-8")
index = index.replace("ЗАГРУЗКА РЕЛИЗА V22", "ЗАГРУЗКА РЕЛИЗА V23")
Path("index.html").write_text(index, encoding="utf-8")

# Confirm the new cards, citations, sprites and mechanics are present.
checks = [
    'id:"sj-100"',
    "Комсомольский-на-Амуре государственный университет (КнАГУ)",
    "Производственный центр ПАО «Яковлев»",
    "battleDrawPlaneGlyph",
    "battleSpawnPowerup",
    "battleSpawnDrone",
    "battleGameOver",
    "tripleUntil",
    "damageUntil",
    "rapidUntil",
]
for check in checks:
    if check not in html:
        fail("Validation failed; missing " + check)

if "images.weserv.nl" in html:
    fail("Old image proxy remains embedded in the release")
if "const BATTLE_SPRITES={" not in html:
    fail("Local aircraft sprite registry is missing")
sprite_start = html.index("const BATTLE_SPRITES={")
sprite_end = html.index("};", sprite_start)
if "http://" in html[sprite_start:sprite_end] or "https://" in html[sprite_start:sprite_end]:
    fail("External image URL remains in the battle sprite registry")

# Syntax-check the page's final inline script with Node.js before writing fragments.
scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, flags=re.S | re.I)
if not scripts:
    fail("No inline JavaScript was found for syntax checking")
Path("/tmp/aeroletopis-release.js").write_text(scripts[-1], encoding="utf-8")
subprocess.run(["node", "--check", "/tmp/aeroletopis-release.js"], check=True)

# Recompress, retaining all existing fragment boundaries except for the final remainder.
payload = base64.b64encode(gzip.compress(html.encode("utf-8"), compresslevel=9, mtime=0)).decode("ascii")
sizes = [len(chunk) for chunk in original_chunks[:-1]]
sizes.append(len(payload) - sum(sizes))
if sizes[-1] <= 0:
    fail("Compressed payload does not fit the existing fragment layout")
offset = 0
for path, size in zip(paths, sizes):
    path.write_text(payload[offset:offset + size] + "\n", encoding="utf-8")
    offset += size
if offset != len(payload):
    fail("Not all compressed payload bytes were written")

# Decode again from the actual files and verify exact HTML round-trip.
written = "".join(path.read_text(encoding="utf-8").strip() for path in paths)
round_trip = gzip.decompress(base64.b64decode(written, validate=True)).decode("utf-8")
if round_trip != html:
    fail("Compressed release failed round-trip validation")

print("Updated release archive successfully")
print("HTML characters:", len(html))
print("Compressed payload characters:", len(payload))
print("New aircraft: SJ-100; new centres: KnAGU and Yakovlev Production Center")
print("Battle: local vector aircraft, triple/damage/rapid-fire power-ups, lethal drones")
print("JavaScript syntax: OK")
