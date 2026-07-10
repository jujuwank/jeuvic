/***********************************************************************
 * BIBELQUIZZ V1.5.2 - Interfaces séparées + Firebase + Google Sheets
 *
 * Parcours principal :
 * - JEUVIC ouvre BIBELQUIZZ sur l'accueil du jeu.
 * - Nouvelle partie => configuration arbitre + saisie du code.
 * - Le lien unique mène au choix du rôle, puis chacun saisit le code.
 ***********************************************************************/
import { EventBus } from "../engine/EventBus.js";
import { BibelQuizzEngine } from "../engine/BibelQuizzEngine.js";
import { FirebaseRoomStore } from "../services/FirebaseRoomStore.js";
import { ADMIN_PASSWORD, DEFAULT_ROUNDS, DEFAULT_QUESTION_TIME } from "./Config.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const formatTime = seconds => `00:${String(Math.max(0, seconds)).padStart(2, "0")}`;
const CURRENT_PLAYER_KEY = "JEUVIC_BIBELQUIZZ_CURRENT_PLAYER_V121";

const events = new EventBus();
const roomStore = new FirebaseRoomStore();
const engine = new BibelQuizzEngine(events, roomStore);
let currentRole = "home";
let currentPlayer = null;
let lastRenderedPlayerQuestionKey = null;

/*=========================================================
  OUTILS D'AFFICHAGE
=========================================================*/
function showScreen(id){
  $$(".screen").forEach(screen => screen.classList.remove("active"));
  $(`#${id}`)?.classList.add("active");
}
function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function questionInRound(state){ return ((state.currentQuestionIndex % state.config.questionsPerRound) + 1); }
function isLastQuestionOfRound(state){ return questionInRound(state) >= state.config.questionsPerRound; }
function isLastRound(state){ return state.round >= state.config.rounds; }
function questionProgressText(state){ return `QUESTION ${questionInRound(state)} / ${state.config.questionsPerRound}`; }
function roundProgressText(state){ return `${state.round}/${state.config.rounds}`; }
function transitionTitle(state){ return `MANCHE ${state.round} — QUESTION ${questionInRound(state)} / ${state.config.questionsPerRound}`; }
function transitionText(){ return "Préparez-vous..."; }
function getBaseUrl(){ return window.location.href.split("?")[0].split("#")[0]; }
function normalizeCodeInput(value){ return String(value || "").trim().toUpperCase(); }
function sharedAccessLink(code = engine.getState().code){ return `${getBaseUrl()}?role=choose&code=${encodeURIComponent(code || "")}`; }

/*=========================================================
  ROUTAGE PAR URL
=========================================================*/
async function initFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const code = normalizeCodeInput(params.get("code"));
  const role = params.get("role");

  if(role === "admin" && code && await engine.loadGame(code)){
    currentRole = "admin";
    showAdminByStatus(engine.getState());
    return;
  }
  if(role === "player"){
    currentRole = "player-join";
    if(code) $("#playerGameCode").value = code;
    showScreen("playerJoinScreen");
    return;
  }
  if(role === "projection"){
    currentRole = "projection-join";
    if(code) $("#projectionGameCode").value = code;
    showScreen("projectionJoinScreen");
    return;
  }
  if(role === "choose"){
    currentRole = "choose";
    showScreen("roleChoiceScreen");
    await renderRoleChoice(code);
    return;
  }

  renderHome();
  showScreen("homeScreen");
}

/*=========================================================
  ACTIONS UTILISATEUR
=========================================================*/
function initActions(){
  $("#newGameBtn")?.addEventListener("click", () => {
    currentRole = "admin";
    engine.createDraftGame();
    $("#adminGameCode").value = "";
    $("#roundCount").value = DEFAULT_ROUNDS;
    $("#questionTime").value = DEFAULT_QUESTION_TIME;
    $("#adminCodeError").textContent = "";
    history.replaceState(null, "", `?role=admin`);
    showScreen("adminSetupScreen");
  });

  $("#createGameBtn")?.addEventListener("click", async () => {
    const code = normalizeCodeInput($("#adminGameCode").value);
    $("#adminGameCode").value = code;
    $("#adminCodeError").textContent = "";

    const result = await engine.createGame({
      rounds: Number($("#roundCount").value),
      questionsPerRound: Number($("#questionsPerRound").value),
      time: Number($("#questionTime").value),
      maxPlayers: Number($("#maxPlayers").value),
      questionsSheetUrl: $("#questionsSheetUrl").value.trim()
    }, code);

    if(!result.ok){
      $("#adminCodeError").textContent = result.reason === "CODE_EXISTS"
        ? "Ce code est déjà utilisé par une partie en cours."
        : "Code invalide : 4 caractères A-Z/0-9 avec au moins un chiffre.";
      return;
    }

    currentRole = "admin";
    history.replaceState(null, "", `?code=${result.code}&role=admin`);
    showAdminByStatus(engine.getState());
  });

  $("#choosePlayerModeBtn")?.addEventListener("click", () => {
    const code = normalizeCodeInput(new URLSearchParams(location.search).get("code"));
    location.href = `${getBaseUrl()}?role=player&code=${encodeURIComponent(code)}`;
  });
  $("#chooseSpectatorModeBtn")?.addEventListener("click", () => {
    const code = normalizeCodeInput(new URLSearchParams(location.search).get("code"));
    location.href = `${getBaseUrl()}?role=projection&code=${encodeURIComponent(code)}`;
  });

  $("#joinBtn")?.addEventListener("click", async () => {
    const name = $("#playerName").value.trim();
    const code = normalizeCodeInput($("#playerGameCode").value);
    $("#playerGameCode").value = code;
    $("#joinError").textContent = "";
    if(!await engine.hasRoom(code)){ $("#joinError").textContent = "Code incorrect ou partie introuvable."; return; }
    const result = await engine.addPlayer(name, code);
    if(!result.ok){
      const messages = {
        CLOSED: "La partie a déjà commencé. Les inscriptions des joueurs sont fermées.",
        FULL: "Le nombre maximal de joueurs est atteint.",
        NAME_EXISTS: "Ce nom est déjà utilisé dans cette partie.",
        INVALID_NAME: "Entre un nom de joueur valide.",
        NOT_FOUND: "Code incorrect ou partie introuvable."
      };
      $("#joinError").textContent = messages[result.reason] || "Impossible de rejoindre la partie.";
      return;
    }
    const player = result.player;
    currentRole = "player";
    currentPlayer = player;
    localStorage.setItem(CURRENT_PLAYER_KEY, JSON.stringify({ code, playerId: player.id }));
    history.replaceState(null, "", `?code=${code}&role=player`);
    showScreen("playerGameScreen");
    render(engine.getState());
  });

  $("#openProjectionBtn")?.addEventListener("click", async () => {
    const code = normalizeCodeInput($("#projectionGameCode").value);
    $("#projectionGameCode").value = code;
    $("#projectionError").textContent = "";
    if(!await engine.loadGame(code)){ $("#projectionError").textContent = "Code incorrect ou partie introuvable."; return; }
    currentRole = "projection";
    history.replaceState(null, "", `?code=${code}&role=projection`);
    showScreen("projectionScreen");
    render(engine.getState());
  });

  $("#copySharedLinkBtn")?.addEventListener("click", () => copyText($("#sharedAccessLink").value));
  ["#adminGameCode", "#playerGameCode", "#projectionGameCode"].forEach(selector => {
    $(selector)?.addEventListener("input", event => { event.target.value = normalizeCodeInput(event.target.value); });
  });
  $("#startGameFromLobbyBtn")?.addEventListener("click", async () => engine.beginGame());
  $("#startTimerBtn")?.addEventListener("click", async () => {
    const state = engine.getState();
    if(state.status === "locked" && !state.corrected){ await engine.correctQuestion(); return; }
    await engine.startTimer();
  });
  $("#skipQuestionBtn")?.addEventListener("click", async () => engine.skipQuestion());
  $("#nextQuestionBtn")?.addEventListener("click", async () => { if(!engine.getState().corrected) await engine.correctQuestion(); await engine.nextQuestion(); });
  $("#nextRoundBtn")?.addEventListener("click", async () => engine.nextQuestion());
  $("#resultsBtn")?.addEventListener("click", async () => {
    const state = engine.getState();
    if(!state.corrected) await engine.correctQuestion();
    if(isLastRound(engine.getState())) await engine.endGame();
    else await engine.showRoundResults();
  });
  $("#endGameBtn")?.addEventListener("click", async () => {
    if(engine.getState().status === "finished"){
      await engine.removeCurrentRoom();
      currentRole = "home";
      currentPlayer = null;
      localStorage.removeItem(CURRENT_PLAYER_KEY);
      history.replaceState(null, "", getBaseUrl());
      showScreen("homeScreen");
      await renderHome();
      return;
    }
    await engine.endGame();
  });
  $("#playerHomeBtn")?.addEventListener("click", () => {
    currentRole = "home";
    currentPlayer = null;
    localStorage.removeItem(CURRENT_PLAYER_KEY);
    location.href = getBaseUrl();
  });
}

function copyText(text){
  navigator.clipboard?.writeText(text);
  alert("Lien copié.");
}

/*=========================================================
  RAFRAICHISSEMENT LOCAL DES ROLES
=========================================================*/
function refreshCurrentRoom(){
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("code") || engine.getState().code || "").trim().toUpperCase();
  if(code) engine.loadGame(code);
}
setInterval(() => {
  // En mode Firebase, la synchronisation temps réel se fait via onSnapshot.
  // Le rafraîchissement périodique est conservé seulement pour le fallback localStorage.
  if(!engine.cloudEnabled && ["admin", "player", "projection"].includes(currentRole)) refreshCurrentRoom();
}, 1000);

/*=========================================================
  RENDU GLOBAL
=========================================================*/
function render(state){
  if(currentRole === "admin") renderAdmin(state);
  if(currentRole === "player") renderPlayer(state);
  if(currentRole === "projection") renderProjection(state);
  if(currentRole === "home") renderHome();
}

async function renderRoleChoice(code){
  const playerButton = $("#choosePlayerModeBtn");
  const message = $("#roleChoiceMessage");
  if(!code){
    playerButton?.classList.remove("hidden");
    if(message) message.textContent = "Choisis ton rôle, puis saisis le code de la partie.";
    return;
  }

  const room = await engine.getRoom(code);
  if(!room){
    playerButton?.classList.add("hidden");
    if(message) message.textContent = "Cette partie est introuvable ou a déjà été supprimée.";
    return;
  }

  const joinOpen = room.status === "lobby";
  playerButton?.classList.toggle("hidden", !joinOpen);
  if(message){
    message.textContent = joinOpen
      ? `Partie ${code} : les joueurs et les spectateurs peuvent encore rejoindre.`
      : `Partie ${code} déjà commencée : seul le mode Spectateur / Projection est disponible.`;
  }
}

async function renderHome(){
  const list = $("#activeGamesList");
  if(!list) return;
  const rooms = await engine.getActiveRooms();
  list.innerHTML = rooms.length
    ? rooms.map(room => `<div class="lobby-player"><span>${room.code}</span><div><strong>${room.status}</strong><br><small>${room.players?.length || 0} joueur(s)</small></div><div class="game-list-actions"><button class="btn secondary small" data-admin-code="${room.code}">Ouvrir</button><button class="btn danger small" data-delete-code="${room.code}">Supprimer</button></div></div>`).join("")
    : `<div class="empty-lobby">Aucune partie en cours.</div>`;
  $$(`[data-admin-code]`).forEach(btn => btn.addEventListener("click", async () => {
    const code = btn.dataset.adminCode;
    if(await engine.loadGame(code)){
      currentRole = "admin";
      history.replaceState(null, "", `?code=${code}&role=admin`);
      showAdminByStatus(engine.getState());
      render(engine.getState());
    }
  }));
  $$(`[data-delete-code]`).forEach(btn => btn.addEventListener("click", async () => {
    const code = btn.dataset.deleteCode;
    const password = window.prompt(`Mot de passe administrateur pour supprimer la partie ${code} :`);
    if(password === null) return;
    if(password !== ADMIN_PASSWORD){
      alert("Mot de passe incorrect.");
      return;
    }
    if(!window.confirm(`Confirmer la suppression définitive de la partie ${code} ?`)) return;
    const deleted = await engine.deleteRoomByCode(code);
    alert(deleted ? "La partie a été terminée et supprimée." : "Partie introuvable.");
    await renderHome();
  }));
}

function showAdminByStatus(state){
  if(state.status === "setup") showScreen("adminSetupScreen");
  else if(state.status === "lobby") showScreen("adminLobbyScreen");
  else showScreen("adminGameScreen");
}

/*=========================================================
  RENDU ARBITRE
=========================================================*/
function renderAdmin(state){
  showAdminByStatus(state);
  if(state.status === "setup") return;
  renderLobby(state);
  if(state.status === "lobby") return;

  const q = state.question;
  $("#adminQuestionProgress").textContent = state.status === "transition" ? transitionTitle(state) : questionProgressText(state);
  $("#adminQuestion").textContent = state.status === "transition" ? transitionText() : (state.status === "finished" ? "Classement final" : q.question);
  $("#adminDuration").textContent = `${state.question?.time || state.config.time} s`;
  $("#adminTimer").textContent = formatTime(state.remainingTime);
  $("#roundInfo").textContent = roundProgressText(state);
  $("#questionPoints").textContent = q.points;
  $("#adminCorrectAnswer").textContent = state.corrected ? q.correctAnswer : "(cachée)";
  $("#adminOptions").innerHTML = q.type === "qcm" && state.status !== "finished" && state.status !== "transition"
    ? q.options.map((o,i)=>`<div class="option">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("") : "";
  $("#answersTable").innerHTML = state.players.map(player => {
    const answer = state.answers.get(player.id) || player.currentAnswer || "—";
    const pts = player.lastPoints === undefined ? "—" : (player.lastPoints > 0 ? `+${player.lastPoints}` : "0");
    return `<tr><td>${escapeHtml(player.name)}</td><td>${escapeHtml(answer)}</td><td>${pts}</td></tr>`;
  }).join("") || `<tr><td colspan="3">Aucun participant.</td></tr>`;
  updateAdminButtons(state);
}

function renderLobby(state){
  const count = state.players.length;
  $("#adminLobbyCode").textContent = state.code || "----";
  $("#sharedAccessLink").value = sharedAccessLink(state.code);
  $("#adminLobbyPlayerCount").textContent = String(count);
  $("#playerWaitingCount").textContent = String(count);
  $("#projectionWaitingCount").textContent = String(count);
  $("#adminLobbyPlayers").innerHTML = count
    ? state.players.map((p, i) => `<div class="lobby-player"><span>${i+1}</span>${escapeHtml(p.name)}</div>`).join("")
    : `<div class="empty-lobby">Aucun joueur inscrit pour le moment.</div>`;
  const startBtn = $("#startGameFromLobbyBtn");
  const disabled = count === 0;
  startBtn.disabled = disabled;
  startBtn.classList.toggle("disabled", disabled);
  startBtn.textContent = disabled ? "COMMENCER" : "COMMENCER LA PARTIE";
}

function updateAdminButtons(state){
  const startBtn = $("#startTimerBtn"), skipBtn = $("#skipQuestionBtn"), nextQuestionBtn = $("#nextQuestionBtn"), nextRoundBtn = $("#nextRoundBtn"), resultsBtn = $("#resultsBtn"), endBtn = $("#endGameBtn");
  [startBtn, skipBtn, nextQuestionBtn, nextRoundBtn, resultsBtn].forEach(btn => btn?.classList.remove("hidden"));
  endBtn.textContent = state.status === "finished" ? "ACCUEIL" : "TERMINER LA PARTIE";

  if(state.status === "finished"){
    [startBtn, skipBtn, nextQuestionBtn, nextRoundBtn, resultsBtn].forEach(btn => btn?.classList.add("hidden"));
    return;
  }

  if(state.status === "round_results"){
    [startBtn, skipBtn, nextQuestionBtn, resultsBtn].forEach(btn => btn?.classList.add("hidden"));
    nextRoundBtn.classList.remove("hidden");
    nextRoundBtn.textContent = "MANCHE SUIVANTE";
    return;
  }

  startBtn.textContent = (state.status === "locked" && !state.corrected) ? "RÉPONSE" : "LANCER";
  const startDisabled = state.status === "running" || state.status === "transition" || state.corrected;
  startBtn.disabled = startDisabled;
  startBtn.classList.toggle("disabled", startDisabled);

  const canMove = state.corrected || state.status === "locked";
  skipBtn.classList.toggle("hidden", state.status === "transition");
  nextQuestionBtn.classList.toggle("hidden", !canMove || isLastQuestionOfRound(state));
  nextRoundBtn.classList.add("hidden");
  resultsBtn.classList.toggle("hidden", !canMove || !isLastQuestionOfRound(state));
  resultsBtn.textContent = isLastRound(state) ? "RÉSULTATS FINAUX" : "AFFICHER LES RÉSULTATS";
}


/*=========================================================
  RENDU JOUEUR
=========================================================*/
function renderPlayer(state){
  const saved = JSON.parse(localStorage.getItem(CURRENT_PLAYER_KEY) || "null");
  if(!currentPlayer && saved && saved.code === state.code){ currentPlayer = state.players.find(p => p.id === saved.playerId) || null; }
  showScreen("playerGameScreen");
  const playerWaiting = $("#playerWaitingArea"), playerGameArea = $("#playerGameArea");
  const mustWait = state.status === "lobby" || state.status === "setup";
  playerWaiting.classList.toggle("hidden", !mustWait);
  playerGameArea.classList.toggle("hidden", mustWait);
  $("#playerWaitingCount").textContent = String(state.players.length);
  if(mustWait) return;

  const q = state.question;
  const questionKey = `${state.round}-${state.currentQuestionIndex}`;
  const locked = state.status === "locked" || state.status === "round_results" || state.status === "finished" || state.corrected;
  if(questionKey !== lastRenderedPlayerQuestionKey){ resetPlayerInterface(); lastRenderedPlayerQuestionKey = questionKey; }
  $("#playerQuestionProgress").textContent = state.status === "transition" ? transitionTitle(state) : questionProgressText(state);
  $("#playerQuestion").textContent = state.status === "transition" ? transitionText() : (state.status === "finished" ? "Partie terminée" : (state.status === "round_results" ? `Résultats de la manche ${state.round}` : q.question));
  $("#playerTimer").textContent = formatTime(state.remainingTime);
  state.corrected ? showPublicAnswer("#playerCorrectAnswer", q.correctAnswer) : hidePublicAnswer("#playerCorrectAnswer");

  if(state.status === "transition"){
    $("#playerOptions").innerHTML = ""; $("#playerAnswer").classList.add("hidden");
  } else if(["qcm", "vrai_faux", "true_false"].includes(q.type) && !["finished", "round_results"].includes(state.status)) renderPlayerQcmOptions(q, locked, state);
  else renderPlayerDirectAnswer(locked, state);
  const freshPlayer = currentPlayer ? state.players.find(p => p.id === currentPlayer.id) : null;
  if(freshPlayer) $("#playerScore").textContent = freshPlayer.score;
  const ranking = $("#playerFinalRanking");
  const homeButton = $("#playerHomeBtn");
  const publicRankingVisible = state.status === "round_results" || state.status === "finished";
  ranking.classList.toggle("hidden", !publicRankingVisible);
  homeButton.classList.toggle("hidden", state.status !== "finished");
  ranking.innerHTML = publicRankingVisible
    ? `<h3>${state.status === "finished" ? "Classement final" : `Résultats de la manche ${state.round}`}</h3>` +
      state.ranking.map((player, index) => `<div class="rank-row"><span>${index + 1}. ${escapeHtml(player.name)}</span><strong>${player.score} pts</strong></div>`).join("")
    : "";
}

function resetPlayerInterface(){
  const answerInput = $("#playerAnswer");
  answerInput.value = ""; answerInput.disabled = false;
  $("#playerOptions").innerHTML = ""; $("#playerMessage").textContent = ""; hidePublicAnswer("#playerCorrectAnswer");
}
async function saveCurrentPlayerAnswer(answer){ if(currentPlayer) await engine.submitAnswer(currentPlayer.id, String(answer || "").trim()); }
function renderPlayerDirectAnswer(locked, state){
  const answerInput = $("#playerAnswer");
  const freshPlayer = currentPlayer ? state.players.find(player => player.id === currentPlayer.id) : null;
  answerInput.classList.toggle("hidden", state.status === "finished" || state.status === "round_results");
  answerInput.disabled = locked;
  answerInput.classList.remove("answer-correct", "answer-wrong");
  if(state.corrected && freshPlayer){
    const receivedPoints = Number(freshPlayer.lastPoints || 0);
    answerInput.classList.add(receivedPoints > 0 ? "answer-correct" : "answer-wrong");
  }
  $("#playerOptions").innerHTML = "";
  if(document.activeElement !== answerInput){
    answerInput.value = state.answers.get(currentPlayer?.id) || freshPlayer?.currentAnswer || answerInput.value || "";
  }
  answerInput.oninput = () => {
    if(locked) return;
    saveCurrentPlayerAnswer(answerInput.value);
    $("#playerMessage").textContent = answerInput.value.trim() ? "Réponse enregistrée automatiquement." : "";
  };
}
function renderPlayerQcmOptions(question, locked, state){
  const freshPlayer = currentPlayer ? state.players.find(player => player.id === currentPlayer.id) : null;
  const currentAnswer = currentPlayer ? (state.answers.get(currentPlayer.id) || freshPlayer?.currentAnswer || "") : "";
  $("#playerAnswer").classList.add("hidden"); $("#playerAnswer").oninput = null;
  $("#playerOptions").innerHTML = question.options.map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    const selected = option === currentAnswer ? "selected" : "";
    const correctClass = state.corrected && option === question.correctAnswer ? "correct-choice" : "";
    const wrongClass = state.corrected && option === currentAnswer && option !== question.correctAnswer ? "wrong-choice" : "";
    return `<button class="choice ${selected} ${correctClass} ${wrongClass}" type="button" data-answer="${escapeHtml(option)}" ${locked ? "disabled" : ""}><span class="choice-letter">${letter}.</span><span class="choice-text">${escapeHtml(option)}</span></button>`;
  }).join("");
  const playerChoices = document.querySelectorAll("#playerOptions .choice");
  playerChoices.forEach(choice => choice.addEventListener("click", async () => {
    if(locked) return;
    playerChoices.forEach(c => c.classList.remove("selected"));
    choice.classList.add("selected");
    $("#playerMessage").textContent = "Enregistrement...";
    const saved = await engine.submitAnswer(currentPlayer.id, choice.dataset.answer);
    $("#playerMessage").textContent = saved ? "Choix enregistré." : "Échec de l’enregistrement. Réessaie.";
  }));
}

/*=========================================================
  RENDU PROJECTION
=========================================================*/
function renderProjection(state){
  showScreen("projectionScreen");
  const q = state.question;
  const showWaiting = state.status === "setup" || state.status === "lobby";
  const showTransition = state.status === "transition";
  $("#projectionWaitingArea").classList.toggle("hidden", !showWaiting);
  $("#projectionQuestion").classList.toggle("hidden", showWaiting);
  $("#projectionTimer").classList.toggle("hidden", showWaiting);
  $("#projectionOptions").classList.toggle("hidden", showWaiting);
  $("#projectionInfoPanel").classList.toggle("hidden", showWaiting);
  $("#projectionWaitingCount").textContent = String(state.players.length);
  if(showWaiting){ $("#projectionRanking").innerHTML = ""; return; }
  $("#projectionInfoPanel").innerHTML = `<span>Question <b>${questionInRound(state)} / ${state.config.questionsPerRound}</b></span><span>Manche <b>${state.round} / ${state.config.rounds}</b></span><span>Temps <b>${formatTime(state.remainingTime)}</b></span>`;
  $("#projectionQuestion").textContent = showTransition ? transitionText() : (state.status === "finished" ? "Classement final" : (state.status === "round_results" ? `Résultats de la manche ${state.round}` : q.question));
  $("#projectionTimer").textContent = showTransition ? "" : formatTime(state.remainingTime);
  state.corrected && state.status !== "finished" ? showPublicAnswer("#projectionCorrectAnswer", q.correctAnswer) : hidePublicAnswer("#projectionCorrectAnswer");
  $("#projectionOptions").innerHTML = ["qcm", "vrai_faux", "true_false"].includes(q.type) && !["finished", "round_results"].includes(state.status) && !showTransition
    ? q.options.map((o,i)=>`<div class="option ${state.corrected && o === q.correctAnswer ? "correct-choice" : ""}">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("") : "";
  const publicRankingVisible = state.status === "round_results" || state.status === "finished";
  $("#projectionRanking").innerHTML = publicRankingVisible
    ? state.ranking.map((p,i)=>`<div class="rank-row"><span>${i+1}. ${escapeHtml(p.name)}</span><strong>${p.score} pts</strong></div>`).join("") : "";
}

function showPublicAnswer(selector, answer){ const box = $(selector); if(!box) return; box.classList.remove("hidden"); box.innerHTML = `<span>Bonne réponse</span><strong>${escapeHtml(answer)}</strong>`; }
function hidePublicAnswer(selector){ const box = $(selector); if(!box) return; box.classList.add("hidden"); box.innerHTML = ""; }

events.on("game:updated", render);
events.on("timer:tick", render);
events.on("storage:ready", payload => console.log(`[BIBELQUIZZ] Mode ${payload.cloudEnabled ? "Firebase" : "localStorage"}`));
events.on("game:error", payload => alert(payload.message || "Une erreur est survenue."));
events.on("game:missing", () => {
  if(["player", "projection"].includes(currentRole)) return;
  currentRole = "home";
  history.replaceState(null, "", getBaseUrl());
  showScreen("homeScreen");
  renderHome();
});

async function startApplication(){
  await engine.init();
  initActions();
  await initFromUrl();
  console.log("[BIBELQUIZZ 1.5.2] Firebase + Google Sheets démarrés");
}

startApplication();
