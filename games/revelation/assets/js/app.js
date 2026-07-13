const FIREBASE_CONFIG={apiKey:"AIzaSyAlU6jkI7sIj7DnPKJ7d4om7jd0XN2VVJQ",authDomain:"jeuvic-50898.firebaseapp.com",projectId:"jeuvic-50898",storageBucket:"jeuvic-50898.firebasestorage.app",messagingSenderId:"64826787331",appId:"1:64826787331:web:daa0e20dce72376148b036"};
const COLLECTION="revelation_rooms";
const ADMIN_PASSWORD="JuJu-admin";
const CLUE_INTERVAL_DEFAULT=3000;
const DEFAULT_GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/1MzyGu4FL8SBUzSc5NjB2bD9C933A-NVvB7Hif-juPn0/edit?gid=543973136#gid=543973136";
const MAX_PLAYERS_DEFAULT=15;
const COLORS=["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1","#14b8a6","#eab308","#8b5cf6","#fb7185","#0ea5e9"];
const SAMPLE_QUESTIONS=[
 {id:1,category:"Personnage",answer:"Noé",points:3,countdown:20,clues:["Je suis un homme de foi.","J’ai construit un grand bateau.","Des animaux sont entrés deux par deux.","Une pluie exceptionnelle est tombée.","Une colombe est revenue avec une feuille.","J’ai survécu au déluge."]},
 {id:2,category:"Personnage",answer:"Moïse",points:4,countdown:20,clues:["J’ai été sauvé des eaux.","J’ai grandi dans un palais.","J’ai vu un buisson ardent.","J’ai affronté Pharaon.","La mer s’est ouverte devant moi.","J’ai reçu les dix commandements."]},
 {id:3,category:"Personnage",answer:"David",points:4,countdown:25,clues:["J’étais berger.","Je jouais de la harpe.","J’ai affronté un géant.","Je suis devenu roi.","J’ai écrit de nombreux psaumes.","Je suis un ancêtre de Jésus."]}
];
let fb=null,db=null,room=null,unsubscribe=null,timerHandle=null,currentPlayerId=sessionStorage.getItem("revelationPlayerId")||"";
const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const mode=qs.get("mode")||"home";const code=(qs.get("code")||"").toUpperCase();
const escapeHtml=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const normalizeCode=v=>String(v||"").trim().toUpperCase();
const validCode=v=>/^(?=.*\d)[A-Z0-9]{4}$/.test(normalizeCode(v));
const nav=(m,c="")=>location.href=`index.html?mode=${m}${c?`&code=${encodeURIComponent(c)}`:""}`;
function shell(content){app.innerHTML=`<header class="topbar"><div class="brand"><b>R</b>ÉVÉLATION</div><div><span class="signature">Made by J.S.P</span> <button class="btn ghost" id="homeBtn">JEUVIC</button></div></header><main class="wrap">${content}</main><div id="scoreOverlay" class="score-overlay"><div class="score-modal"><div id="scoreModalContent"></div></div></div>`;document.getElementById("homeBtn")?.addEventListener("click",()=>location.href="../../index.html");}
async function initFirebase(){const appMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");fb=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");db=fb.getFirestore(appMod.initializeApp(FIREBASE_CONFIG));}
const roomRef=c=>fb.doc(db,COLLECTION,normalizeCode(c));
async function listRooms(){const snap=await fb.getDocs(fb.query(fb.collection(db,COLLECTION),fb.orderBy("updatedAt","desc"),fb.limit(30)));return snap.docs.map(d=>d.data()).filter(r=>r.status!=="finished");}
async function save(patch){if(!room?.code)return;await fb.setDoc(roomRef(room.code),{...patch,updatedAt:Date.now()},{merge:true});}
function subscribe(c,onData){unsubscribe?.();unsubscribe=fb.onSnapshot(roomRef(c),s=>{room=s.exists()?s.data():null;onData(room);});}
function ranking(players=[]){return [...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0));}
function rankingHtml(players=[]){return ranking(players).map((p,i)=>`<div class="ranking-row"><strong>${i+1}</strong><span><i class="dot" style="display:inline-block;background:${p.color};color:${p.color};vertical-align:middle;margin-right:8px"></i>${escapeHtml(p.name)}</span><b>${Number(p.score||0)} pts</b></div>`).join("")||'<p class="muted">Aucun joueur.</p>';}
async function parseSheet(url){url=String(url||"").trim()||DEFAULT_GOOGLE_SHEET_URL;const id=url.match(/\/d\/([\w-]+)/)?.[1];const gid=url.match(/[?&#]gid=(\d+)/)?.[1]||"0";if(!id)throw new Error("Lien Google Sheets invalide.");const csv=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`).then(r=>{if(!r.ok)throw new Error("Feuille inaccessible. Publie-la ou partage-la en lecture.");return r.text();});const lines=csv.split(/\r?\n/).filter(Boolean).map(parseCsvLine);const h=lines.shift().map(x=>x.trim().toLowerCase());const ix=n=>h.indexOf(n);return lines.map(row=>{const clues=[];for(let i=1;i<=6;i++){const v=row[ix(`indice ${i}`)];if(v)clues.push(v);}return{id:row[ix("id")],category:row[ix("catégorie")],answer:row[ix("réponse")],points:Number(row[ix("points")]||1),countdown:Number(row[ix("décompte (s)")]||20),clues,active:String(row[ix("actif")]||"OUI").toUpperCase()!=="NON"};}).filter(q=>q.active&&q.answer&&q.clues.length);}
function parseCsvLine(line){const out=[];let cur="",quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(c==='"')quote=!quote;else if(c===','&&!quote){out.push(cur);cur="";}else cur+=c;}out.push(cur);return out;}
async function renderHome(){shell(`<section class="hero"><p class="muted">JEUVIC présente</p><h1>RÉVÉLATION</h1><p>Indices progressifs, buzzers en temps réel et compétition chrétienne.</p></section><section class="grid two"><article class="card"><h2>Créer une partie</h2><p class="muted">Configure la banque d’indices et deviens arbitre.</p><button class="btn primary" id="newBtn">Nouvelle partie</button></article><article class="card"><h2>Rejoindre</h2><p class="muted">Joueur ou spectateur avec un code de partie.</p><button class="btn primary" id="joinBtn">Rejoindre une partie</button></article></section><section class="card" style="margin-top:20px"><h2>Parties en cours</h2><div id="rooms" class="rooms"><p class="muted">Chargement…</p></div></section>`);document.getElementById("newBtn").onclick=()=>nav("config");document.getElementById("joinBtn").onclick=()=>nav("role");const rooms=await listRooms();document.getElementById("rooms").innerHTML=rooms.map(r=>`<article class="room"><div><div class="code">${r.code}</div><strong>${escapeHtml(r.name||"Partie Révélation")}</strong><div class="muted">${(r.players||[]).length} joueur(s) · ${r.status}</div></div><div class="actions"><button class="btn primary" data-open="${r.code}">Ouvrir</button><button class="btn ghost" data-watch="${r.code}">Regarder</button><button class="btn bad" data-delete="${r.code}">Supprimer</button></div></article>`).join("")||'<p class="muted">Aucune partie en cours.</p>';document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>nav("referee",b.dataset.open));document.querySelectorAll("[data-watch]").forEach(b=>b.onclick=()=>nav("spectator",b.dataset.watch));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(prompt("Mot de passe administrateur")!==ADMIN_PASSWORD)return alert("Mot de passe incorrect.");await fb.deleteDoc(roomRef(b.dataset.delete));renderHome();});}
function renderConfig(){shell(`<section class="hero"><h1>Nouvelle partie</h1><p>Configuration de RÉVÉLATION</p></section><form class="card" id="configForm"><div class="grid two"><div class="field"><label>Nom de la partie</label><input id="name" value="Révélation" required></div><div class="field"><label>Code (4 caractères, minimum 1 chiffre)</label><input id="gameCode" maxlength="4" placeholder="RV4X" required></div><div class="field"><label>Nombre de questions</label><input id="questionCount" type="number" min="1" max="50" value="10"></div><div class="field"><label>Maximum de joueurs</label><input id="maxPlayers" type="number" min="2" max="30" value="${MAX_PLAYERS_DEFAULT}"></div><div class="field"><label>Intervalle entre indices (secondes)</label><input id="clueInterval" type="number" min="2" max="30" value="${CLUE_INTERVAL_DEFAULT/1000}"></div><div class="field"><label>Lien Google Sheets (facultatif)</label><input id="sheetUrl" placeholder="Laisser vide pour utiliser la banque officielle"><small class="field-help">Banque officielle utilisée automatiquement si ce champ reste vide.</small></div></div><div id="configMsg"></div><div class="actions"><button class="btn ghost" type="button" id="back">Retour</button><button class="btn primary" type="submit">Créer la partie</button></div></form>`);document.getElementById("back").onclick=()=>nav("home");document.getElementById("gameCode").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4));document.getElementById("configForm").onsubmit=async e=>{e.preventDefault();const c=normalizeCode(document.getElementById("gameCode").value);if(!validCode(c))return document.getElementById("configMsg").innerHTML='<p class="notice danger">Code invalide.</p>';try{const questions=await parseSheet(document.getElementById("sheetUrl").value.trim());if(!questions.length)throw new Error("Aucune question valide.");const count=Math.min(Number(document.getElementById("questionCount").value),questions.length);questions.sort(()=>Math.random()-.5);const data={code:c,name:document.getElementById("name").value.trim(),status:"lobby",createdAt:Date.now(),updatedAt:Date.now(),players:[],maxPlayers:Number(document.getElementById("maxPlayers").value),clueIntervalMs:Number(document.getElementById("clueInterval").value)*1000,questions:questions.slice(0,count),questionIndex:0,revealedCount:0,buzzLocked:false,buzzedPlayerId:"",lastWrongPlayerId:"",phase:"lobby",scoreVisible:false};await fb.setDoc(roomRef(c),data);nav("referee",c);}catch(err){document.getElementById("configMsg").innerHTML=`<p class="notice danger">${escapeHtml(err.message)}</p>`;}};}
function renderRole(){shell(`<section class="hero"><h1>Choisir un rôle</h1><p>Entre comme joueur ou ouvre l’écran spectateur.</p></section><section class="role-grid"><article class="card role" id="playerRole"><div class="icon">🔴</div><h2>Joueur</h2><p class="muted">Inscription avec nom et code.</p></article><article class="card role" id="spectatorRole"><div class="icon">📺</div><h2>Spectateur</h2><p class="muted">Projection avec le code de la partie.</p></article></section>`);document.getElementById("playerRole").onclick=()=>nav("join-player",code);document.getElementById("spectatorRole").onclick=()=>nav("join-spectator",code);}
function renderJoinPlayer(){shell(`<section class="hero"><h1>Rejoindre comme joueur</h1></section><form class="card" id="joinForm"><div class="field"><label>Nom</label><input id="playerName" required></div><div class="field"><label>Code de partie</label><input id="joinCode" value="${escapeHtml(code)}" maxlength="4" required></div><div id="joinMsg"></div><div class="actions"><button class="btn ghost" type="button" id="backRole">Retour</button><button class="btn primary" type="submit">Rejoindre</button></div></form>`);document.getElementById("backRole").onclick=()=>nav("role",document.getElementById("joinCode").value);document.getElementById("joinForm").onsubmit=async e=>{e.preventDefault();const c=normalizeCode(document.getElementById("joinCode").value);const name=document.getElementById("playerName").value.trim();try{const result=await fb.runTransaction(db,async tx=>{const ref=roomRef(c),snap=await tx.get(ref);if(!snap.exists())throw new Error("Partie introuvable.");const r=snap.data();if(r.status!=="lobby")throw new Error("Les inscriptions sont fermées.");if((r.players||[]).length>=Number(r.maxPlayers||15))throw new Error("Partie complète.");if((r.players||[]).some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error("Ce nom est déjà utilisé.");const id=crypto.randomUUID();const p={id,name,color:COLORS[(r.players||[]).length%COLORS.length],score:0,joinedAt:Date.now()};tx.update(ref,{players:[...(r.players||[]),p],updatedAt:Date.now()});return p;});currentPlayerId=result.id;sessionStorage.setItem("revelationPlayerId",result.id);nav("player",c);}catch(err){document.getElementById("joinMsg").innerHTML=`<p class="notice danger">${escapeHtml(err.message)}</p>`;}};}
function renderJoinSpectator(){shell(`<section class="hero"><h1>Accès spectateur</h1></section><form class="card" id="watchForm"><div class="field"><label>Code de partie</label><input id="watchCode" value="${escapeHtml(code)}" maxlength="4" required></div><div id="watchMsg"></div><div class="actions"><button class="btn ghost" type="button" id="backRole">Retour</button><button class="btn primary" type="submit">Ouvrir la projection</button></div></form>`);document.getElementById("backRole").onclick=()=>nav("role",document.getElementById("watchCode").value);document.getElementById("watchForm").onsubmit=async e=>{e.preventDefault();const c=normalizeCode(document.getElementById("watchCode").value);const s=await fb.getDoc(roomRef(c));if(!s.exists())return document.getElementById("watchMsg").innerHTML='<p class="notice danger">Partie introuvable.</p>';nav("spectator",c);};}
function getQuestions(){
  if(Array.isArray(room?.questions))return room.questions;
  if(room?.questions&&typeof room.questions==="object")return Object.keys(room.questions).sort((a,b)=>Number(a)-Number(b)).map(k=>room.questions[k]);
  return [];
}
function currentQuestion(){return getQuestions()[Number(room?.questionIndex||0)]||null;}
function remainingSeconds(){if(room?.phase!=="countdown"||!room.countdownEndsAt)return Number(currentQuestion()?.countdown||0);return Math.max(0,Math.ceil((Number(room.countdownEndsAt)-Date.now())/1000));}
function beginLocalClock(onTick){clearInterval(timerHandle);onTick();timerHandle=setInterval(onTick,250);}

/*=========================================================
  LIBELLÉS FRANÇAIS DES ÉTATS DU JEU
=========================================================*/
const PHASE_LABELS={
  lobby:"Salle d’attente",
  ready:"Question prête",
  clues:"Affichage des indices",
  countdown:"Décompte final",
  buzzed:"Réponse du joueur en attente",
  correct:"Bonne réponse validée",
  ended:"Question terminée",
  finished:"Partie terminée"
};
const phaseLabel=phase=>PHASE_LABELS[phase]||"Jeu en cours";

/*=========================================================
  AUDIO DES 5 DERNIÈRES SECONDES
=========================================================*/
let fiveSecondAudioKey="";
let buzzerAudioKey="";
function getEndSound(){return document.getElementById("endSound");}
function getWrongSound(){return document.getElementById("wrongAnswerSound");}
function getCorrectSound(){return document.getElementById("correctAnswerSound");}
function getBuzzerSound(){return document.getElementById("buzzerSound");}

/* Le son de fin n'est mis en pause que lorsqu'un joueur buzze. */
function pauseEndSound(){const audio=getEndSound();if(audio&&!audio.paused)audio.pause();}
function resumeEndSound(){const audio=getEndSound();if(audio&&audio.currentTime>0&&!audio.ended)audio.play().catch(()=>{});}
function playFeedbackSound(type){
  const audio=type==="correct"?getCorrectSound():getWrongSound();
  if(!audio)return;
  audio.currentTime=0;
  audio.play().catch(()=>{});
}

function maybePlayBuzzerAudio(){
  if(!room?.buzzedPlayerId||!room?.buzzedAt)return;
  const key=`${room.code}-${room.questionIndex}-${room.buzzedPlayerId}-${room.buzzedAt}`;
  if(buzzerAudioKey===key)return;
  buzzerAudioKey=key;
  const audio=getBuzzerSound();
  if(audio){audio.currentTime=0;audio.play().catch(()=>{});}
}
function maybePlayFiveSecondAudio(){
  if(!room||room.phase!=="countdown"||room.buzzedPlayerId)return;
  const seconds=remainingSeconds();
  const key=`${room.code}-${room.questionIndex}-${room.countdownEndsAt}`;
  if(seconds<=5&&seconds>0&&fiveSecondAudioKey!==key){
    fiveSecondAudioKey=key;
    const audio=getEndSound();
    if(audio){audio.currentTime=0;audio.play().catch(()=>{});}
  }
}

/*=========================================================
  PRÉPARATION ET LANCEMENT D’UNE QUESTION
=========================================================*/
async function prepareQuestion(questionIndex){
  const index=Number(questionIndex);
  const questions=Array.isArray(room?.questions)?room.questions:[];
  const question=questions[index];

  if(!question){
    console.error("[RÉVÉLATION] Question introuvable",{index,total:questions.length});
    throw new Error("La question suivante est introuvable.");
  }

  fiveSecondAudioKey="";

  // Réinitialise complètement l’état de la question précédente.
  await save({
    questionIndex:index,
    phase:"ready",
    revealedCount:0,
    nextClueAt:null,
    buzzLocked:false,
    buzzedPlayerId:"",
    buzzedAt:null,
    lastWrongPlayerId:"",
    pausedPhase:null,
    pausedCountdownRemaining:null,
    countdownEndsAt:null,
    answerVisible:false
  });
}

async function startQuestion(){
  const q=currentQuestion();
  if(!q){
    console.error("[RÉVÉLATION] Impossible de lancer : question absente",room);
    alert("Impossible de charger cette question. Recharge la page puis réessaie.");
    return;
  }

  fiveSecondAudioKey="";
  await save({
    status:"running",
    phase:"clues",
    revealedCount:1,
    nextClueAt:Date.now()+Number(room.clueIntervalMs||CLUE_INTERVAL_DEFAULT),
    buzzLocked:false,
    buzzedPlayerId:"",
    buzzedAt:null,
    lastWrongPlayerId:"",
    pausedPhase:null,
    pausedCountdownRemaining:null,
    countdownEndsAt:null,
    answerVisible:false
  });
}
async function refereeAutomation(){if(!room||room.status!=="running"||room.buzzLocked)return;const q=currentQuestion();if(!q)return;if(room.phase==="clues"&&Date.now()>=Number(room.nextClueAt||0)){if(Number(room.revealedCount||0)<q.clues.length){const next=Number(room.revealedCount||0)+1;await save({revealedCount:next,nextClueAt:Date.now()+Number(room.clueIntervalMs||CLUE_INTERVAL_DEFAULT)});if(next>=q.clues.length)await save({phase:"countdown",countdownEndsAt:Date.now()+Number(q.countdown||20)*1000});}else await save({phase:"countdown",countdownEndsAt:Date.now()+Number(q.countdown||20)*1000});}if(room.phase==="countdown"&&remainingSeconds()<=0){await save({phase:"ended",buzzLocked:true,buzzedPlayerId:"",answerVisible:false});}}

function refereeView(){
  if(!room)return '<p>Partie supprimée.</p>';
  const q=currentQuestion();
  const buzzed=(room.players||[]).find(p=>p.id===room.buzzedPlayerId);
  return `<section class="hero"><p class="code">${room.code}</p><h1>${escapeHtml(room.name)}</h1><p>Arbitre · Question ${Number(room.questionIndex||0)+1}/${getQuestions().length}</p></section>
  <div id="scoreDrawer" class="score-drawer ${room.scoreVisible?'open':''}"><div class="actions" style="justify-content:space-between"><h2>CLASSEMENT</h2><button class="btn ghost" id="hideScore">MASQUER</button></div>${rankingHtml(room.players)}</div>
  <section class="game-layout">
    <article class="card">
      <div class="actions referee-main-actions">
        <button class="btn primary" id="startGame" ${!['lobby','ready'].includes(room.phase)?'disabled':''}>${room.phase==='lobby'?'COMMENCER':'LANCER'}</button>
        <button class="btn ghost" id="answerBtn" ${!q||room.answerVisible||room.phase!=='ended'?'disabled':''}>RÉPONSE</button>
        <button class="btn next-question" id="nextBtn" ${!['ended','correct'].includes(room.phase)?'disabled':''}>QUESTION SUIVANTE</button>
        <button class="btn gold" id="scoreBtn">SCORE</button>
      </div>
      <h2>${q?escapeHtml(q.category||"Question"):"Partie terminée"}</h2>
      ${room.phase==='ready'?'<p class="notice">Question prête. Appuie sur <strong>LANCER</strong> pour afficher le premier indice.</p>':''}
      <div class="clues">${q?q.clues.map((c,i)=>`<div class="clue ${i<Number(room.revealedCount||0)?'':'hidden'}">${i+1}. ${escapeHtml(c)}</div>`).join(''):''}</div>
      ${room.phase==='countdown'?`<div class="countdown" id="countdown">${remainingSeconds()}</div>`:''}
      ${buzzed?`<div class="status-box"><p>Premier buzzer</p><div class="buzz-winner" style="color:${buzzed.color}">${escapeHtml(buzzed.name)}</div></div>`:''}
      ${room.answerVisible&&q?`<div class="answer-reveal"><small>Bonne réponse</small><h2>${escapeHtml(q.answer)}</h2></div>`:''}
    </article>
    <aside class="card">
      <h3>État du jeu</h3>
      <p class="notice game-status-line"><span>${escapeHtml(phaseLabel(room.phase))}</span><span class="status-separator">|</span><strong class="question-points">${Number(q?.points||0)} pts</strong></p>
      <h3>Joueur ayant buzzé</h3><p>${buzzed?escapeHtml(buzzed.name):'Aucun'}</p>
      <div class="actions referee-side-actions"><button class="btn secondary" id="skipBtn" ${room.status!=='running'?'disabled':''}>PASSER</button><button class="btn bad" id="finishBtn" ${room.status==='finished'?'disabled':''}>TERMINER LA PARTIE</button></div>
      <h3 style="margin-top:22px">Joueurs (${(room.players||[]).length})</h3>
      <div class="lobby-list">${(room.players||[]).map(p=>`<div class="player-row"><i class="dot" style="background:${p.color};color:${p.color}"></i><span>${escapeHtml(p.name)}</span><b>${p.score||0}</b></div>`).join('')||'<p class="muted">En attente de joueurs.</p>'}</div>
    </aside>
  </section>
  <div id="judgeOverlay" class="judge-overlay ${buzzed?'open':''}" aria-hidden="${buzzed?'false':'true'}">
    <div class="judge-modal">
      <p class="muted">Réponse orale de</p>
      <h2 style="color:${buzzed?.color||'#fff'}">${buzzed?escapeHtml(buzzed.name):''}</h2>
      <p>L’arbitre valide la réponse donnée par le joueur.</p>
      <div class="judge-actions"><button class="btn good" id="correctBtn">BONNE RÉPONSE</button><button class="btn bad" id="wrongBtn">MAUVAISE RÉPONSE</button></div>
    </div>
  </div>`;
}

function bindReferee(){
  document.getElementById("startGame")?.addEventListener("click",startQuestion);
  document.getElementById("scoreBtn")?.addEventListener("click",()=>save({scoreVisible:!room.scoreVisible}));
  document.getElementById("hideScore")?.addEventListener("click",()=>save({scoreVisible:false}));
  document.getElementById("answerBtn")?.addEventListener("click",async()=>{if(room.phase!=="ended")return;await save({answerVisible:true,buzzLocked:true,buzzedPlayerId:""});});
  document.getElementById("skipBtn")?.addEventListener("click",async()=>{
    const next=Number(room.questionIndex||0)+1;
    if(next>=getQuestions().length){
      await save({status:"finished",phase:"finished",scoreVisible:true,answerVisible:false,buzzLocked:true,buzzedPlayerId:""});
    }else{
      await prepareQuestion(next);
    }
  });
  document.getElementById("finishBtn")?.addEventListener("click",async()=>{
    if(!confirm("Terminer définitivement cette partie ?"))return;
    pauseEndSound();
    await save({status:"finished",phase:"finished",scoreVisible:true,answerVisible:false,buzzLocked:true,buzzedPlayerId:"",buzzedAt:null,countdownEndsAt:null,nextClueAt:null});
  });
  document.getElementById("correctBtn")?.addEventListener("click",async()=>{const p=(room.players||[]).find(x=>x.id===room.buzzedPlayerId),q=currentQuestion();if(!p||!q)return;playFeedbackSound("correct");await save({players:room.players.map(x=>x.id===p.id?{...x,score:Number(x.score||0)+Number(q.points||0)}:x),phase:"correct",answerVisible:true,buzzLocked:true,buzzedPlayerId:"",buzzedAt:null});});
  document.getElementById("wrongBtn")?.addEventListener("click",async()=>{const wrong=room.buzzedPlayerId;const q=currentQuestion();playFeedbackSound("wrong");const patch={buzzedPlayerId:"",buzzedAt:null,buzzLocked:false,lastWrongPlayerId:wrong,answerVisible:false};if(Number(room.revealedCount||0)>=q.clues.length){patch.phase="countdown";patch.countdownEndsAt=Date.now()+Math.max(1,Number(room.pausedCountdownRemaining||remainingSeconds()))*1000;}else{patch.phase="clues";patch.nextClueAt=Date.now()+Number(room.clueIntervalMs||CLUE_INTERVAL_DEFAULT);}await save(patch);resumeEndSound();});
  document.getElementById("nextBtn")?.addEventListener("click",async()=>{const next=Number(room.questionIndex||0)+1;if(next>=getQuestions().length){await save({status:"finished",phase:"finished",scoreVisible:true,answerVisible:false,buzzLocked:true,buzzedPlayerId:""});}else{await prepareQuestion(next);}});
  beginLocalClock(()=>{document.getElementById("countdown")&&(document.getElementById("countdown").textContent=remainingSeconds());if(room?.buzzedPlayerId){pauseEndSound();maybePlayBuzzerAudio();}else maybePlayFiveSecondAudio();refereeAutomation();});
}
function renderReferee(){shell('<div id="refereeRoot"></div>');subscribe(code,r=>{if(!r)return;document.getElementById("refereeRoot").innerHTML=refereeView();bindReferee();});}

function playerRankingHtml(players=[],playerId=""){return ranking(players).map((p,i)=>`<div class="ranking-row ${p.id===playerId?'current-player':''}"><strong>${i+1}</strong><span><i class="dot" style="display:inline-block;background:${p.color};color:${p.color};vertical-align:middle;margin-right:8px"></i>${escapeHtml(p.name)}</span><b>${Number(p.score||0)} pts</b></div>`).join("")||'<p class="muted">Aucun joueur.</p>';}
function renderPlayer(){shell('<div id="playerRoot"></div>');subscribe(code,r=>{if(!r)return;const p=(r.players||[]).find(x=>x.id===currentPlayerId);if(!p){document.getElementById("playerRoot").innerHTML='<section class="card"><h2>Session joueur introuvable</h2><button class="btn primary" id="rejoin">Se réinscrire</button></section>';document.getElementById("rejoin").onclick=()=>nav("join-player",code);return;}let state="BUZZER ACTIF";let disabled=false;if(r.status==='lobby'){state="En attente du lancement";disabled=true;}else if(r.phase==='ended'||r.phase==='correct'||r.phase==='finished'){state="Question terminée";disabled=true;}else if(r.buzzLocked){state=r.buzzedPlayerId===p.id?"Votre buzz est accepté":"Un autre joueur a buzzé";disabled=true;}else if(r.lastWrongPlayerId===p.id){state="Temporairement bloqué";disabled=true;}document.getElementById("playerRoot").innerHTML=`<section class="player-screen player-mobile-card"><div class="player-topline"><p class="code">${r.code}</p><div class="score-pill">${p.score||0} pts</div></div><div class="player-avatar" style="--player-color:${p.color}">${escapeHtml(p.name.charAt(0).toUpperCase())}</div><h1 style="color:${p.color}">${escapeHtml(p.name)}</h1><p class="notice player-state">${state}</p><button class="buzzer" id="buzz" ${disabled?'disabled':''}>BUZZ</button><p class="muted question-progress">Question ${Number(r.questionIndex||0)+1}/${(Array.isArray(r.questions)?r.questions.length:Object.keys(r.questions||{}).length)} <span class="question-points-inline">| ${Number(currentQuestion()?.points||0)} pts</span></p></section>`;document.getElementById("buzz")?.addEventListener("click",async()=>{const ref=roomRef(code);try{const ok=await fb.runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())return false;const rr=snap.data();if(rr.status!=='running'||rr.buzzLocked||['ended','correct','finished'].includes(rr.phase)||rr.lastWrongPlayerId===p.id)return false;tx.update(ref,{buzzLocked:true,buzzedPlayerId:p.id,buzzedAt:Date.now(),pausedPhase:rr.phase,pausedCountdownRemaining:rr.phase==='countdown'?Math.max(1,Math.ceil((rr.countdownEndsAt-Date.now())/1000)):null,updatedAt:Date.now()});return true;});if(!ok)alert("Buzz non accepté.");}catch(e){console.error(e);}});const overlay=document.getElementById("scoreOverlay");if(r.scoreVisible){document.getElementById("scoreModalContent").innerHTML=`<h1 style="text-align:center">CLASSEMENT</h1>${playerRankingHtml(r.players,p.id)}`;overlay.classList.add("open");}else overlay.classList.remove("open");if(r.buzzedPlayerId){pauseEndSound();maybePlayBuzzerAudio();}else maybePlayFiveSecondAudio();});}

function spectatorView(){if(!room)return '';const q=currentQuestion(),buzzed=(room.players||[]).find(p=>p.id===room.buzzedPlayerId);return `<section class="hero"><p class="code">${room.code}</p><h1>Question ${Number(room.questionIndex||0)+1}/${getQuestions().length} <span class="spectator-points">| ${Number(q?.points||0)} pts</span></h1></section><section class="card"><div class="clues">${q?q.clues.map((c,i)=>`<div class="clue ${i<Number(room.revealedCount||0)?'':'hidden'}">${escapeHtml(c)}</div>`).join(''):''}</div>${room.phase==='countdown'?`<div class="countdown" id="countdown">${remainingSeconds()}</div>`:''}${buzzed?`<div class="status-box"><p>A buzzé</p><div class="buzz-winner" style="color:${buzzed.color}">${escapeHtml(buzzed.name)}</div></div>`:''}${room.answerVisible&&q?`<div class="answer-reveal"><small>RÉPONSE</small><h1>${escapeHtml(q.answer)}</h1></div>`:''}</section>`;}
function renderSpectator(){shell('<div id="spectatorRoot"></div>');subscribe(code,r=>{if(!r)return;document.getElementById("spectatorRoot").innerHTML=spectatorView();const overlay=document.getElementById("scoreOverlay");if(r.scoreVisible){document.getElementById("scoreModalContent").innerHTML=`<h1 style="text-align:center">CLASSEMENT</h1>${rankingHtml(r.players)}`;overlay.classList.add("open");}else overlay.classList.remove("open");beginLocalClock(()=>{document.getElementById("countdown")&&(document.getElementById("countdown").textContent=remainingSeconds());if(room?.buzzedPlayerId){pauseEndSound();maybePlayBuzzerAudio();}else maybePlayFiveSecondAudio();});});}
async function start(){await initFirebase();if(mode==='home')renderHome();else if(mode==='config')renderConfig();else if(mode==='role')renderRole();else if(mode==='join-player')renderJoinPlayer();else if(mode==='join-spectator')renderJoinSpectator();else if(mode==='referee')renderReferee();else if(mode==='player')renderPlayer();else if(mode==='spectator')renderSpectator();else renderHome();}
start().catch(err=>{console.error(err);app.innerHTML=`<main class="wrap"><section class="card"><h2>Erreur de démarrage</h2><p>${escapeHtml(err.message)}</p></section></main>`;});
