const FIREBASE_CONFIG={apiKey:"AIzaSyAlU6jkI7sIj7DnPKJ7d4om7jd0XN2VVJQ",authDomain:"jeuvic-50898.firebaseapp.com",projectId:"jeuvic-50898",storageBucket:"jeuvic-50898.firebasestorage.app",messagingSenderId:"64826787331",appId:"1:64826787331:web:daa0e20dce72376148b036"};
const COLLECTION="proverbes_rooms";
const ADMIN_PASSWORD="JuJu-admin";
const MAX_PLAYERS_DEFAULT=100;
const WRONG_GUESS_LETTER_COOLDOWN=2;
const WRONG_GUESS_PLAYER_COOLDOWN=2;
const REVEAL_LETTER_DELAY_MS=260;
const LETTER_DISPLAY_DELAY_MS=2000;
const AUDIO_CORRECT_LETTER="assets/audios/lettre-correct.mp3";
const AUDIO_WRONG_LETTER="assets/audios/lettre-fausse.mp3";
const COLORS=["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
const PHRASES=[
 {id:1,category:"Proverbe biblique",phrase:"La crainte de Dieu est le commencement de la sagesse",points:5},
 {id:2,category:"Dicton",phrase:"Qui va à la chasse perd sa place",points:3},
 {id:3,category:"Proverbe africain",phrase:"Seul on va plus vite ensemble on va plus loin",points:4},
 {id:4,category:"Proverbe biblique",phrase:"Un ami aime en tout temps",points:3},
 {id:5,category:"Expression",phrase:"Après la pluie vient le beau temps",points:4}
];

/* =========================================================
   GOOGLE SHEETS — banque de phrases configurable
========================================================= */
const DEFAULT_GOOGLE_SHEET_URL="";

function parseCsv(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===','&&!quoted){row.push(cell);cell="";continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell);cell="";
      if(row.some(v=>String(v).trim()!==""))rows.push(row);
      row=[];continue;
    }
    cell+=ch;
  }
  row.push(cell);if(row.some(v=>String(v).trim()!==""))rows.push(row);
  return rows;
}
function sheetCsvUrl(url){
  const value=String(url||"").trim();
  if(!value)return "";
  const id=value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1]||value.match(/^[a-zA-Z0-9_-]{20,}$/)?.[0];
  if(!id)throw new Error("Lien Google Sheets invalide.");
  const gid=value.match(/[?&#]gid=(\d+)/)?.[1]||"0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
function normalizeHeader(value){return norm(value).replace(/[^A-Z0-9]/g,"");}
async function loadPhrasesFromSheet(url){
  const csvUrl=sheetCsvUrl(url);
  if(!csvUrl)return [...PHRASES];
  const response=await fetch(csvUrl,{cache:"no-store"});
  if(!response.ok)throw new Error(`Impossible de lire Google Sheets (${response.status}). Vérifie le partage public.`);
  const rows=parseCsv(await response.text());
  if(rows.length<2)throw new Error("La feuille Google Sheets ne contient aucune phrase.");
  const headers=rows[0].map(normalizeHeader);
  const idx=(...names)=>names.map(normalizeHeader).map(n=>headers.indexOf(n)).find(i=>i>=0)??-1;
  const iId=idx("ID"),iActive=idx("Actif"),iCategory=idx("Catégorie","Categorie"),iDifficulty=idx("Difficulté","Difficulte"),iPhrase=idx("Phrase / Proverbe","Phrase","Proverbe"),iPoints=idx("Points"),iTime=idx("Temps max (s)","Temps max","Temps");
  if(iPhrase<0)throw new Error('Colonne obligatoire introuvable : "Phrase / Proverbe".');
  const data=rows.slice(1).map((r,index)=>({
    id:iId>=0?(r[iId]||index+1):index+1,
    active:iActive<0||norm(r[iActive]||"OUI")!=="NON",
    category:iCategory>=0?(r[iCategory]||"Autre"):"Autre",
    difficulty:iDifficulty>=0?(r[iDifficulty]||""):"",
    phrase:String(r[iPhrase]||"").trim(),
    points:Math.max(0,Number(iPoints>=0?r[iPoints]:1)||1),
    maxTime:Math.max(0,Number(iTime>=0?r[iTime]:0)||0)
  })).filter(x=>x.active&&x.phrase);
  if(!data.length)throw new Error("Aucune phrase active et valide trouvée dans Google Sheets.");
  return data;
}

let fb,db,room=null,unsubscribe=null,currentPlayerId=sessionStorage.getItem("proverbesPlayerId")||"";
const app=document.getElementById("app");
const params=new URLSearchParams(location.search),mode=params.get("mode")||"home",code=(params.get("code")||"").toUpperCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
const nav=(m,c="")=>location.href=`index.html?mode=${encodeURIComponent(m)}${c?`&code=${encodeURIComponent(c)}`:""}`;
const randomCode=()=>Array.from({length:4},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
const shell=html=>app.innerHTML=`<main class="wrap">${html}</main>`;
async function initFirebase(){const imports=await Promise.all([import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")]);fb={...imports[0],...imports[1]};db=fb.getFirestore(fb.initializeApp(FIREBASE_CONFIG));}
const roomRef=c=>fb.doc(db,COLLECTION,c);
async function save(patch){if(!room?.code)return;await fb.updateDoc(roomRef(room.code),{...patch,updatedAt:Date.now()});}
function subscribe(c,cb){unsubscribe?.();unsubscribe=fb.onSnapshot(roomRef(c),snap=>{room=snap.exists()?{...snap.data(),code:snap.id}:null;cb(room);});}
function currentPhrase(){return room?.phrases?.[Number(room.phraseIndex||0)]||null;}
function alphabet(){return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");}
function uniqueLetters(text){return [...new Set(norm(text).replace(/[^A-Z]/g,"").split(""))];}
function phraseMask(phrase,found=[],draft=null,compare=false,lastEvent=null){
  const chars=[...String(phrase||"")];
  const parts=[];let current=[];let wordIndex=0;
  const flush=()=>{
    if(!current.length)return;
    const count=current.length;
    parts.push(`<span class="word-group" data-word="${wordIndex++}" style="--word-length:${count}">${current.join("")}</span>`);
    current=[];
  };
  chars.forEach((ch,i)=>{
    if(ch===" "){flush();parts.push('<span class="word-space" aria-hidden="true"></span>');return;}
    if(!/[A-Za-zÀ-ÿ]/.test(ch)){current.push(`<span class="char punct">${esc(ch)}</span>`);return;}
    const n=norm(ch),known=found.includes(n);
    const isNew=Boolean(lastEvent?.hit&&lastEvent?.letter===n&&(lastEvent.positions||[]).includes(i));
    const occurrence=isNew?(lastEvent.positions||[]).indexOf(i):-1;
    const delay=occurrence>=0?occurrence*REVEAL_LETTER_DELAY_MS:0;
    if(draft){
      const val=draft[i]||"";
      const cls=known?"locked":compare?(norm(val)===n?"locked":"wrong"):"";
      current.push(`<input class="draft-input ${cls}${isNew?' new-letter':''}" maxlength="1" inputmode="text" autocomplete="off" data-pos="${i}" value="${esc(known?ch:val)}" ${known||compare?"disabled":""}${isNew?` style="--reveal-delay:${delay}ms"`:""}>`);
    }else{
      current.push(`<span class="char${isNew?' new-letter':''}"${isNew?` style="--reveal-delay:${delay}ms"`:""}>${known?esc(ch.toUpperCase()):""}</span>`);
    }
  });
  flush();
  return parts.join("");
}
function validationPhraseHtml(phrase,guess){
  const chars=[...String(phrase||"")];
  const parts=[];let current=[];
  const flush=()=>{if(current.length){parts.push(`<span class="word-group validation-word">${current.join("")}</span>`);current=[];}};
  chars.forEach((ch,i)=>{
    if(ch===" "){flush();parts.push('<span class="word-space"></span>');return;}
    if(!/[A-Za-zÀ-ÿ]/.test(ch)){current.push(`<span class="validation-char neutral">${esc(ch)}</span>`);return;}
    const value=guess?.[i]||"-";
    const cls=value!=="-"&&norm(value)===norm(ch)?"ok":value==="-"?"neutral":"bad";
    current.push(`<span class="validation-char ${cls}">${esc(value)}</span>`);
  });flush();return parts.join("");
}
const audioState={lastEventId:null};
function playAudio(src){try{const a=new Audio(src);a.preload="auto";a.play().catch(()=>{});return a;}catch{return null;}}
function handleLetterAudio(r){const ev=r?.lastLetterEvent;if(!ev||audioState.lastEventId===ev.id)return;audioState.lastEventId=ev.id;if(ev.hit){(ev.positions||[]).forEach((_,idx)=>setTimeout(()=>playAudio(AUDIO_CORRECT_LETTER),idx*REVEAL_LETTER_DELAY_MS));}else{setTimeout(()=>playAudio(AUDIO_WRONG_LETTER),2000);}}
function ranking(players=[]){return [...players].sort((a,b)=>Number(b.score||0)-Number(a.score||0));}
function rankingHtml(players=[]){return ranking(players).map((p,i)=>`<div class="player-row"><i class="dot" style="background:${p.color}"></i><span>${i+1}. ${esc(p.name)}</span><b class="score">${p.score||0} pts</b></div>`).join("");}
function activeRoomsQuery(){return fb.query(fb.collection(db,COLLECTION),fb.where("status","in",["lobby","running"]));}
async function renderHome(){shell(`<section class="hero"><h1>PROVERBES</h1><p>La phrase cachée — jeu multijoueur JEUVIC</p></section><section class="card"><div class="actions"><button class="btn primary" id="new">NOUVELLE PARTIE</button><button class="btn secondary" id="join">REJOINDRE / REGARDER</button></div><h2>Parties en cours</h2><div class="rooms" id="rooms"><p class="notice">Chargement…</p></div></section>`);document.getElementById("new").onclick=()=>nav("config");document.getElementById("join").onclick=()=>nav("role");fb.onSnapshot(activeRoomsQuery(),snap=>{document.getElementById("rooms").innerHTML=snap.docs.map(d=>{const r=d.data();return `<div class="room"><div><b>${esc(r.name)}</b><div class="code">${d.id}</div><small>${r.status==="running"?"En cours":"En attente"} · ${(r.players||[]).length} joueur(s)</small></div><div class="actions"><button class="btn secondary" data-open="${d.id}">OUVRIR</button><button class="btn secondary" data-watch="${d.id}">REGARDER</button><button class="btn bad" data-delete="${d.id}">SUPPRIMER</button></div></div>`}).join("")||'<p class="notice">Aucune partie en cours.</p>';document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>nav("referee",b.dataset.open));document.querySelectorAll("[data-watch]").forEach(b=>b.onclick=()=>nav("spectator",b.dataset.watch));document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(prompt("Mot de passe administrateur")!==ADMIN_PASSWORD)return;await fb.deleteDoc(roomRef(b.dataset.delete));});});}
function renderConfig(){
  shell(`<section class="hero"><h1>Nouvelle partie</h1></section><form class="card form-grid" id="form">
    <label>Nom de la partie<input class="input" id="name" value="Proverbes — La phrase cachée" required></label>
    <label>Code<input class="input" id="roomCode" maxlength="4" value="${randomCode()}" required></label>
    <label>Nombre maximal de joueurs<input class="input" id="max" type="number" min="2" max="100" value="${MAX_PLAYERS_DEFAULT}"></label>
    <label>Nombre de phrases<input class="input" id="count" type="number" min="1" max="1000" value="${PHRASES.length}"></label>
    <label class="full">Lien Google Sheets <small class="notice">(facultatif — les exemples intégrés sont utilisés si le champ est vide)</small>
      <input class="input" id="sheetUrl" type="url" value="${esc(DEFAULT_GOOGLE_SHEET_URL)}" placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=...">
    </label>
    <div class="full sheet-test-row"><button class="btn secondary" type="button" id="testSheet">TESTER LE LIEN</button><span class="notice" id="sheetStatus"></span></div>
    <div class="full actions"><button class="btn primary" id="createBtn">CRÉER LA PARTIE</button><button class="btn secondary" type="button" id="back">RETOUR</button></div>
  </form>`);
  document.getElementById("back").onclick=()=>nav("home");
  document.getElementById("testSheet").onclick=async()=>{
    const status=document.getElementById("sheetStatus"),url=document.getElementById("sheetUrl").value.trim();
    status.textContent="Test en cours…";
    try{const loaded=await loadPhrasesFromSheet(url);status.textContent=`✓ ${loaded.length} phrase(s) disponible(s)`;}catch(err){status.textContent=`✕ ${err.message}`;}
  };
  document.getElementById("form").onsubmit=async e=>{
    e.preventDefault();
    const createBtn=document.getElementById("createBtn");
    const c=document.getElementById("roomCode").value.trim().toUpperCase();
    if(!/^(?=.*\d)[A-Z0-9]{4}$/.test(c))return alert("Le code doit contenir 4 caractères et au moins un chiffre.");
    try{
      createBtn.disabled=true;createBtn.textContent="CHARGEMENT…";
      const sheetUrl=document.getElementById("sheetUrl").value.trim();
      const source=await loadPhrasesFromSheet(sheetUrl);
      const requested=Math.max(1,Number(document.getElementById("count").value)||source.length);
      const selected=[...source].sort(()=>Math.random()-.5).slice(0,Math.min(requested,source.length));
      await fb.setDoc(roomRef(c),{name:document.getElementById("name").value.trim(),status:"lobby",phase:"waiting",createdAt:Date.now(),updatedAt:Date.now(),maxPlayers:Number(document.getElementById("max").value),googleSheetUrl:sheetUrl,phrases:selected,phraseIndex:0,foundLetters:[],usedLetters:[],players:[],validationLock:false,activeValidation:null,validationCounter:0,revealIndex:0,scoreVisible:false,lastLetterEvent:null});
      nav("referee",c);
    }catch(err){alert(err.message);createBtn.disabled=false;createBtn.textContent="CRÉER LA PARTIE";}
  };
}
function renderRole(){shell(`<section class="hero"><h1>Choisir un rôle</h1></section><section class="role-grid"><article class="card role" id="player"><h2>JOUEUR</h2><p>Rejoins la partie et propose la phrase.</p></article><article class="card role" id="spectator"><h2>SPECTATEUR</h2><p>Observe la phrase et les lettres trouvées.</p></article></section>`);document.getElementById("player").onclick=()=>nav("join-player",code);document.getElementById("spectator").onclick=()=>nav("join-spectator",code);}
function renderJoinPlayer(){shell(`<section class="hero"><h1>Rejoindre la partie</h1></section><form class="card form-grid" id="joinForm"><label>Nom du joueur<input class="input" id="playerName" required></label><label>Code de la partie<input class="input" id="joinCode" maxlength="4" value="${esc(code)}" required></label><div class="full actions"><button class="btn primary">REJOINDRE</button><button class="btn secondary" type="button" id="backRole">RETOUR</button></div></form>`);document.getElementById("backRole").onclick=()=>nav("role",document.getElementById("joinCode").value);document.getElementById("joinForm").onsubmit=async e=>{e.preventDefault();const c=document.getElementById("joinCode").value.trim().toUpperCase(),name=document.getElementById("playerName").value.trim();try{const id=crypto.randomUUID();const ref=roomRef(c);await fb.runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error("Partie introuvable.");const r=snap.data();if(r.status!=="lobby")throw new Error("Les inscriptions sont fermées.");if((r.players||[]).length>=Number(r.maxPlayers||100))throw new Error("Partie complète.");tx.update(ref,{players:[...(r.players||[]),{id,name,color:COLORS[(r.players||[]).length%COLORS.length],score:0,wrongAtLetterCount:-999,wrongAtValidationCount:-999}],updatedAt:Date.now()});});currentPlayerId=id;sessionStorage.setItem("proverbesPlayerId",id);nav("player",c);}catch(err){alert(err.message);}};}
function renderJoinSpectator(){shell(`<section class="hero"><h1>Accès spectateur</h1></section><form class="card" id="specForm"><input class="input" id="specCode" maxlength="4" value="${esc(code)}" placeholder="Code de la partie"><div class="actions" style="margin-top:16px"><button class="btn primary">REGARDER</button><button type="button" class="btn secondary" id="backRole">RETOUR</button></div></form>`);document.getElementById("backRole").onclick=()=>nav("role",document.getElementById("specCode").value);document.getElementById("specForm").onsubmit=async e=>{e.preventDefault();const c=document.getElementById("specCode").value.trim().toUpperCase();if(!(await fb.getDoc(roomRef(c))).exists())return alert("Partie introuvable.");nav("spectator",c);};}
function refereeHtml(){const p=currentPhrase(),players=room.players||[],active=room.activeValidation,proposer=players.find(x=>x.id===active?.playerId);return `<section class="hero"><h1 class="game-title">PROVERBES</h1><p>Arbitre · Phrase ${Number(room.phraseIndex||0)+1}/${room.phrases.length}</p></section><section class="grid two"><article class="card"><div class="actions"><button class="btn primary" id="start" ${room.status!=="lobby"?"disabled":""}>COMMENCER</button><button class="btn secondary" id="next" ${room.phase!=="solved"?"disabled":""}>PHRASE SUIVANTE</button><button class="btn secondary" id="pass">PASSER</button><button class="btn secondary" id="scoreBtn">SCORE</button></div><h2>${esc(p?.category||"")}</h2><div class="phrase ${room.phase==="solved"?"reveal":""}">${phraseMask(p?.phrase||"",room.phase==="solved"?uniqueLetters(p?.phrase||""):room.foundLetters||[],null,false,room.lastLetterEvent)}</div><div class="keyboard">${alphabet().map(l=>`<button class="key ${(room.foundLetters||[]).includes(l)?"hit":""} ${(room.usedLetters||[]).includes(l)&&!(room.foundLetters||[]).includes(l)?"miss":""}" data-letter="${l}" ${(room.usedLetters||[]).includes(l)||room.status!=="running"||room.validationLock||room.phase==="solved"||room.pendingLetter?"disabled":""}>${l}</button>`).join("")}</div></article><aside class="card referee-side"><div class="status">${room.phase==="solved"?"Phrase trouvée":room.validationLock?"Proposition en attente":room.pendingLetter?"Vérification de la lettre…":room.status==="running"?"Choix d’une lettre":"En attente"} | ${Number(p?.points||0)} pts</div>${active?`<div class="validation-card side-validation"><h3>Proposition de ${esc(proposer?.name||"")}</h3><div class="validation-phrase">${validationPhraseHtml(p.phrase,active.guess)}</div><div class="actions validation-actions" style="margin-top:16px"><button class="btn good" id="accept">VALIDER</button><button class="btn bad" id="reject">REFUSER</button></div></div>`:""}<h3>Joueurs (${players.length})</h3>${rankingHtml(players)}<div class="actions" style="margin-top:18px"><button class="btn bad" id="finish">TERMINER</button></div></aside></section><div class="overlay ${room.scoreVisible?"open":""}" id="scoreOverlay"><div class="modal"><h2>CLASSEMENT</h2>${rankingHtml(players)}<button class="btn secondary" id="hideScore">MASQUER</button></div></div>`;}
function renderReferee(){shell('<div id="root"></div>');subscribe(code,r=>{if(!r)return nav("home");handleLetterAudio(r);document.getElementById("root").innerHTML=refereeHtml();document.getElementById("start")?.addEventListener("click",()=>save({status:"running",phase:"playing"}));document.querySelectorAll("[data-letter]").forEach(b=>b.onclick=async()=>{const l=b.dataset.letter,p=currentPhrase(),positions=[...p.phrase].map((ch,i)=>norm(ch)===l?i:-1).filter(i=>i>=0),hit=positions.length>0;const used=[...new Set([...(room.usedLetters||[]),l])];if(hit){await save({usedLetters:used,pendingLetter:{letter:l,positions,createdAt:Date.now()}});setTimeout(async()=>{try{const snap=await fb.getDoc(roomRef(code));if(!snap.exists())return;const latest=snap.data();if(latest.pendingLetter?.letter!==l)return;const event={id:`${Date.now()}-${l}`,letter:l,hit:true,positions,createdAt:Date.now()};await fb.updateDoc(roomRef(code),{foundLetters:[...new Set([...(latest.foundLetters||[]),l])],lastLetterEvent:event,pendingLetter:null,updatedAt:Date.now()});}catch(err){console.error("Affichage différé de la lettre :",err);}},LETTER_DISPLAY_DELAY_MS);}else{const event={id:`${Date.now()}-${l}`,letter:l,hit:false,positions:[],createdAt:Date.now()};await save({usedLetters:used,lastLetterEvent:event,pendingLetter:null});}});document.getElementById("accept")?.addEventListener("click",async()=>{const a=room.activeValidation;if(!a)return;await save({players:room.players.map(p=>p.id===a.playerId?{...p,score:Number(p.score||0)+Number(currentPhrase()?.points||0)}:p),phase:"solved",validationLock:true,revealIndex:0});});document.getElementById("reject")?.addEventListener("click",async()=>{const a=room.activeValidation;if(!a)return;await save({players:room.players.map(p=>p.id===a.playerId?{...p,wrongAtLetterCount:(room.foundLetters||[]).length,wrongAtValidationCount:Number(room.validationCounter||0)}:p),validationLock:false,activeValidation:null});});document.getElementById("next")?.addEventListener("click",async()=>{const n=Number(room.phraseIndex||0)+1;if(n>=room.phrases.length)return save({status:"finished",phase:"finished",scoreVisible:true});await save({phraseIndex:n,foundLetters:[],usedLetters:[],validationLock:false,activeValidation:null,phase:"playing",lastLetterEvent:null,pendingLetter:null});});document.getElementById("pass")?.addEventListener("click",async()=>{if(!confirm("Passer cette phrase sans attribuer de points ?"))return;const n=Number(room.phraseIndex||0)+1;if(n>=room.phrases.length)return save({status:"finished",phase:"finished",scoreVisible:true,lastLetterEvent:null,pendingLetter:null});await save({phraseIndex:n,foundLetters:[],usedLetters:[],validationLock:false,activeValidation:null,phase:"playing",lastLetterEvent:null,pendingLetter:null});});document.getElementById("scoreBtn")?.addEventListener("click",()=>save({scoreVisible:true}));document.getElementById("hideScore")?.addEventListener("click",()=>save({scoreVisible:false}));document.getElementById("finish")?.addEventListener("click",()=>confirm("Terminer la partie ?")&&save({status:"finished",phase:"finished",scoreVisible:true,pendingLetter:null}));});}
function canValidate(p){if(!p)return false;const lettersSince=(room.foundLetters||[]).length-Number(p.wrongAtLetterCount??-999),othersSince=Number(room.validationCounter||0)-Number(p.wrongAtValidationCount??-999);return lettersSince>=WRONG_GUESS_LETTER_COOLDOWN||othersSince>=WRONG_GUESS_PLAYER_COOLDOWN;}
function playerHtml(){const p=(room.players||[]).find(x=>x.id===currentPlayerId),phrase=currentPhrase();if(!p)return `<section class="card"><h2>Session introuvable</h2></section>`;const draft=JSON.parse(sessionStorage.getItem(`proverbDraft_${room.code}_${p.id}_${Number(room.phraseIndex||0)}`)||"{}");const blocked=!canValidate(p),disabled=room.status!=="running"||room.validationLock||room.phase==="solved"||blocked;return `<section class="hero"><h1 class="player-name" style="--player-color:${p.color}">${esc(p.name)}</h1><p>Score : <b class="score">${p.score||0} pts</b> · Phrase ${Number(room.phraseIndex||0)+1}/${room.phrases.length} · ${Number(phrase?.points||0)} pts</p></section><section class="card"><div class="draft-grid">${phraseMask(phrase?.phrase||"",room.foundLetters||[],draft,false,room.lastLetterEvent)}</div>${blocked?`<div class="cooldown">Nouvelle validation après ${WRONG_GUESS_LETTER_COOLDOWN} nouvelles lettres ou ${WRONG_GUESS_PLAYER_COOLDOWN} propositions d’autres joueurs.</div>`:""}<button class="btn primary" id="validate" ${disabled?"disabled":""}>VALIDER MA PHRASE</button><p class="notice">Tes lettres personnelles ne sont visibles que par toi.</p></section><div class="overlay ${room.scoreVisible?"open":""}"><div class="modal"><h2>CLASSEMENT</h2>${ranking(room.players).map((x,i)=>`<div class="player-row" style="${x.id===p.id?'outline:2px solid '+p.color:''}"><i class="dot" style="background:${x.color}"></i><span>${i+1}. ${esc(x.name)}</span><b class="score">${x.score||0} pts</b></div>`).join("")}</div></div>`;}
function renderPlayer(){shell('<div id="root"></div>');subscribe(code,r=>{if(!r)return;handleLetterAudio(r);document.getElementById("root").innerHTML=playerHtml();const p=(r.players||[]).find(x=>x.id===currentPlayerId),phrase=currentPhrase(),key=`proverbDraft_${r.code}_${p?.id}_${Number(r.phraseIndex||0)}`;const editable=[...document.querySelectorAll(".draft-input:not(.locked):not(:disabled)")];editable.forEach((inp,index)=>{inp.onfocus=()=>inp.select();inp.oninput=()=>{inp.value=norm(inp.value).replace(/[^A-Z]/g,"").slice(-1);const d=JSON.parse(sessionStorage.getItem(key)||"{}");d[inp.dataset.pos]=inp.value;sessionStorage.setItem(key,JSON.stringify(d));if(inp.value&&editable.length){editable[(index+1)%editable.length].focus();editable[(index+1)%editable.length].select();}};inp.onkeydown=e=>{if(e.key==="Backspace"&&!inp.value&&editable.length){e.preventDefault();const prev=editable[(index-1+editable.length)%editable.length];prev.focus();prev.select();}};});document.getElementById("validate")?.addEventListener("click",async()=>{const draft=JSON.parse(sessionStorage.getItem(key)||"{}");const guess=[...phrase.phrase].map((ch,i)=>ch===" "?" ":draft[i]||((r.foundLetters||[]).includes(norm(ch))?ch:"")).join("");try{await fb.runTransaction(db,async tx=>{const ref=roomRef(code),snap=await tx.get(ref),rr=snap.data(),pp=(rr.players||[]).find(x=>x.id===p.id);if(rr.validationLock)throw new Error("Une proposition est déjà en cours.");const lettersSince=(rr.foundLetters||[]).length-Number(pp.wrongAtLetterCount??-999),othersSince=Number(rr.validationCounter||0)-Number(pp.wrongAtValidationCount??-999);if(lettersSince<WRONG_GUESS_LETTER_COOLDOWN&&othersSince<WRONG_GUESS_PLAYER_COOLDOWN)throw new Error("Tu dois encore patienter.");tx.update(ref,{validationLock:true,activeValidation:{playerId:p.id,guess,submittedAt:Date.now()},validationCounter:Number(rr.validationCounter||0)+1,updatedAt:Date.now()});});}catch(e){alert(e.message);}});});}
function spectatorHtml(){const p=currentPhrase(),active=room.activeValidation;return `<section class="hero"><h1 class="game-title">PROVERBES</h1><p>Phrase ${Number(room.phraseIndex||0)+1}/${room.phrases.length} | ${Number(p?.points||0)} pts</p></section><section class="card"><h2 style="text-align:center">${esc(p?.category||"")}</h2><div class="phrase ${room.phase==="solved"?"reveal":""}">${phraseMask(p?.phrase||"",room.phase==="solved"?uniqueLetters(p?.phrase||""):room.foundLetters||[],null,false,room.lastLetterEvent)}</div><div class="keyboard">${alphabet().map(l=>`<span class="key ${(room.foundLetters||[]).includes(l)?"hit":""} ${(room.usedLetters||[]).includes(l)&&!(room.foundLetters||[]).includes(l)?"miss":""}">${l}</span>`).join("")}</div>${active?`<div class="validation-card"><h3>Proposition de ${(room.players||[]).find(x=>x.id===active.playerId)?.name||""}</h3><div class="validation-phrase">${validationPhraseHtml(p.phrase,active.guess)}</div></div>`:""}${room.phase==="solved"?`<h2 class="winner">${esc(p.phrase)}</h2>`:""}</section><div class="overlay ${room.scoreVisible?"open":""}"><div class="modal"><h2>CLASSEMENT</h2>${rankingHtml(room.players||[])}</div></div>`;}
function renderSpectator(){shell('<div id="root"></div>');subscribe(code,r=>{if(!r)return;handleLetterAudio(r);document.getElementById("root").innerHTML=spectatorHtml();});}
async function start(){await initFirebase();if(mode==="home")renderHome();else if(mode==="config")renderConfig();else if(mode==="role")renderRole();else if(mode==="join-player")renderJoinPlayer();else if(mode==="join-spectator")renderJoinSpectator();else if(mode==="referee")renderReferee();else if(mode==="player")renderPlayer();else if(mode==="spectator")renderSpectator();else renderHome();}
start().catch(e=>{console.error(e);shell(`<section class="card"><h2>Erreur</h2><p>${esc(e.message)}</p></section>`);});
