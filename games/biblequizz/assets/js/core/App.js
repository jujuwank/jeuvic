/***********************************************************************
 * BIBELQUIZZ V1.0.3 - Point d'entrée
 *
 * Corrections principales V1.0.3 :
 * - Le bouton LANCER devient RÉPONSE à la fin du décompte.
 * - La bonne réponse n'est affichée qu'après clic sur RÉPONSE.
 * - Affichage Question X / total de la manche sur Arbitre et Joueur.
 * - Gestion Question suivante / Manche suivante / Résultats.
 * - Panneau d'informations complet sur l'écran Projection.
 * - Amélioration du design de la réponse révélée et du timer joueur.
 ***********************************************************************/

import { EventBus } from "../engine/EventBus.js";
import { BibelQuizzEngine } from "../engine/BibelQuizzEngine.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const formatTime = seconds => `00:${String(Math.max(0, seconds)).padStart(2, "0")}`;

const events = new EventBus();
const engine = new BibelQuizzEngine(events);
let currentPlayer = null;
let lastRenderedPlayerQuestionKey = null;
const CURRENT_PLAYER_KEY = "JEUVIC_BIBELQUIZZ_CURRENT_PLAYER_ID";

function questionInRound(state){
  return ((state.currentQuestionIndex % state.config.questionsPerRound) + 1);
}
function isLastQuestionOfRound(state){
  return questionInRound(state) >= state.config.questionsPerRound;
}
function isLastRound(state){
  return state.round >= state.config.rounds;
}
function questionProgressText(state){
  return `QUESTION ${questionInRound(state)} / ${state.config.questionsPerRound}`;
}
function roundProgressText(state){
  return `${state.round}/${state.config.rounds}`;
}

function initTabs(){
  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    $$(".screen").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    $(`#${tab.dataset.screen}`).classList.add("active");
  }));
}

function initActions(){
  $("#createGameBtn").addEventListener("click", () => {
    engine.createGame({
      rounds: Number($("#roundCount").value),
      questionsPerRound: Number($("#questionsPerRound").value),
      time: Number($("#questionTime").value),
      maxPlayers: Number($("#maxPlayers").value)
    });
  });

  $("#startGameFromLobbyBtn")?.addEventListener("click", () => engine.startTimer());

  $("#joinBtn").addEventListener("click", () => {
    const name = $("#playerName").value.trim();
    const player = engine.addPlayer(name);

    if(!player){
      alert("Impossible de rejoindre : nom invalide, déjà utilisé ou limite atteinte.");
      return;
    }

    currentPlayer = player;
    localStorage.setItem(CURRENT_PLAYER_KEY, player.id);
    $("#playerWaitingArea").classList.remove("hidden");
    $("#playerGameArea").classList.add("hidden");
    $("#playerName").disabled = true;
    $("#joinBtn").disabled = true;
    render(engine.getState());
  });

  $("#startTimerBtn").addEventListener("click", () => {
    const state = engine.getState();
    if(state.status === "locked" && !state.corrected){
      engine.correctQuestion();
      return;
    }
    engine.startTimer();
  });

  $("#skipQuestionBtn").addEventListener("click", () => engine.skipQuestion());

  $("#nextQuestionBtn").addEventListener("click", () => {
    if(!engine.getState().corrected) engine.correctQuestion();
    engine.nextQuestion();
  });

  $("#nextRoundBtn").addEventListener("click", () => {
    if(!engine.getState().corrected) engine.correctQuestion();
    engine.nextQuestion();
  });

  $("#resultsBtn").addEventListener("click", () => {
    if(!engine.getState().corrected) engine.correctQuestion();
    engine.endGame();
  });

  $("#endGameBtn").addEventListener("click", () => engine.endGame());

  const submitBtn = $("#submitAnswerBtn");
  if(submitBtn){
    submitBtn.classList.add("hidden");
    submitBtn.addEventListener("click", submitPlayerAnswer);
  }
}

function submitPlayerAnswer(){
  if(!currentPlayer) return;

  const question = engine.currentQuestion;
  let answer = $("#playerAnswer").value.trim();

  if(question.type === "qcm"){
    const selected = document.querySelector(".choice.selected");
    answer = selected ? selected.dataset.answer : "";
  }

  if(!answer){
    $("#playerMessage").textContent = "Réponse obligatoire.";
    return;
  }

  engine.submitAnswer(currentPlayer.id, answer);
  $("#playerMessage").textContent = "Réponse enregistrée. Tu peux encore modifier tant que le temps n'est pas écoulé.";
}

function saveCurrentPlayerAnswer(answer){
  if(!currentPlayer) return;
  engine.submitAnswer(currentPlayer.id, String(answer || "").trim());
}

function render(state){
  renderAdmin(state);
  renderPlayer(state);
  renderProjection(state);
}

function renderAdmin(state){
  updateAdminPanels(state);
  renderLobby(state);

  if(state.status === "setup") return;

  const q = state.question;

  $("#adminQuestionProgress").textContent = questionProgressText(state);
  $("#adminQuestion").textContent = state.status === "finished" ? "Résultats de la partie" : q.question;
  $("#adminDuration").textContent = `${state.config.time} s`;
  $("#adminTimer").textContent = formatTime(state.remainingTime);
  $("#roundInfo").textContent = roundProgressText(state);
  $("#questionPoints").textContent = q.points;
  $("#adminCorrectAnswer").textContent = state.corrected ? q.correctAnswer : "(cachée)";

  $("#adminOptions").innerHTML = q.type === "qcm" && state.status !== "finished"
    ? q.options.map((o,i)=>`<div class="option">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("")
    : "";

  $("#answersTable").innerHTML = state.players.map(player => {
    const answer = state.answers.get(player.id) || "—";
    const pts = player.lastPoints === undefined ? "—" : (player.lastPoints > 0 ? `+${player.lastPoints}` : "0");
    return `<tr><td>${escapeHtml(player.name)}</td><td>${escapeHtml(answer)}</td><td>${pts}</td></tr>`;
  }).join("") || `<tr><td colspan="3">Aucun participant.</td></tr>`;

  updateAdminButtons(state);
}

function updateAdminPanels(state){
  const setup = $("#setupPanel");
  const lobby = $("#adminLobbyPanel");
  const board = $("#adminBoard");

  setup?.classList.toggle("hidden", state.status !== "setup");
  lobby?.classList.toggle("hidden", state.status !== "lobby");
  board?.classList.toggle("hidden", state.status === "setup" || state.status === "lobby");
}

function renderLobby(state){
  const count = state.players.length;
  const adminCount = $("#adminLobbyPlayerCount");
  const playerCount = $("#playerWaitingCount");
  const projectionCount = $("#projectionWaitingCount");
  const adminPlayers = $("#adminLobbyPlayers");
  const startBtn = $("#startGameFromLobbyBtn");

  if(adminCount) adminCount.textContent = String(count);
  if(playerCount) playerCount.textContent = String(count);
  if(projectionCount) projectionCount.textContent = String(count);
  if(adminPlayers){
    adminPlayers.innerHTML = count
      ? state.players.map((p, i) => `<div class="lobby-player"><span>${i+1}</span>${escapeHtml(p.name)}</div>`).join("")
      : `<div class="empty-lobby">Aucun joueur inscrit pour le moment.</div>`;
  }
  if(startBtn){
    const disabled = count === 0;
    startBtn.disabled = disabled;
    startBtn.classList.toggle("disabled", disabled);
    startBtn.classList.toggle("ready", !disabled);
    startBtn.textContent = disabled ? "COMMENCER" : "COMMENCER LA PARTIE";
  }
}

function updateAdminButtons(state){
  const startBtn = $("#startTimerBtn");
  const skipBtn = $("#skipQuestionBtn");
  const nextQuestionBtn = $("#nextQuestionBtn");
  const nextRoundBtn = $("#nextRoundBtn");
  const resultsBtn = $("#resultsBtn");

  [startBtn, skipBtn, nextQuestionBtn, nextRoundBtn, resultsBtn].forEach(btn => btn?.classList.remove("hidden"));

  if(state.status === "finished"){
    [startBtn, skipBtn, nextQuestionBtn, nextRoundBtn, resultsBtn].forEach(btn => btn?.classList.add("hidden"));
    return;
  }

  startBtn.textContent = (state.status === "locked" && !state.corrected) ? "RÉPONSE" : "LANCER";
  const startDisabled = state.status === "running" || state.corrected;
  startBtn.disabled = startDisabled;
  startBtn.classList.toggle("disabled", startDisabled);

  const canMove = state.corrected || state.status === "locked";
  skipBtn.classList.toggle("hidden", state.corrected);
  nextQuestionBtn.classList.toggle("hidden", !canMove || isLastQuestionOfRound(state));
  nextRoundBtn.classList.toggle("hidden", !canMove || !isLastQuestionOfRound(state) || isLastRound(state));
  resultsBtn.classList.toggle("hidden", !canMove || !isLastQuestionOfRound(state) || !isLastRound(state));
}

function renderPlayer(state){
  const q = state.question;
  const questionKey = `${state.round}-${state.currentQuestionIndex}`;
  const locked = state.status === "locked" || state.status === "finished" || state.corrected;
  const questionChanged = questionKey !== lastRenderedPlayerQuestionKey;
  const playerWaiting = $("#playerWaitingArea");
  const playerGameArea = $("#playerGameArea");

  if(currentPlayer){
    const mustWait = state.status === "lobby";
    playerWaiting?.classList.toggle("hidden", !mustWait);
    playerGameArea?.classList.toggle("hidden", mustWait || state.status === "setup");
  }

  if(state.status === "setup" || state.status === "lobby") return;

  $("#playerQuestionProgress").textContent = questionProgressText(state);
  $("#playerQuestion").textContent = state.status === "finished" ? "Partie terminée" : q.question;
  $("#playerTimer").textContent = formatTime(state.remainingTime);

  if(questionChanged){
    resetPlayerInterface();
    lastRenderedPlayerQuestionKey = questionKey;
  }

  if(state.corrected){
    showPublicAnswer("#playerCorrectAnswer", q.correctAnswer);
  } else {
    hidePublicAnswer("#playerCorrectAnswer");
  }

  if(q.type === "qcm" && state.status !== "finished"){
    renderPlayerQcmOptions(q, locked, state);
  } else {
    renderPlayerDirectAnswer(locked, state);
  }

  if(currentPlayer){
    const freshPlayer = state.players.find(p => p.id === currentPlayer.id);
    if(freshPlayer) $("#playerScore").textContent = freshPlayer.score;
  }
}

function resetPlayerInterface(){
  const answerInput = $("#playerAnswer");
  if(answerInput){
    answerInput.value = "";
    answerInput.disabled = false;
  }

  $("#playerOptions").innerHTML = "";
  $("#playerMessage").textContent = "";
  hidePublicAnswer("#playerCorrectAnswer");
}

function renderPlayerDirectAnswer(locked, state){
  const answerInput = $("#playerAnswer");
  answerInput.classList.toggle("hidden", state.status === "finished");
  answerInput.disabled = locked;
  $("#playerOptions").innerHTML = "";

  answerInput.oninput = () => {
    if(locked) return;
    saveCurrentPlayerAnswer(answerInput.value);
    $("#playerMessage").textContent = answerInput.value.trim()
      ? "Réponse enregistrée automatiquement."
      : "";
  };
}

function renderPlayerQcmOptions(question, locked, state){
  const currentAnswer = currentPlayer ? state.answers.get(currentPlayer.id) : "";

  $("#playerAnswer").classList.add("hidden");
  $("#playerAnswer").oninput = null;

  $("#playerOptions").innerHTML = question.options
    .map((option, index) => {
      const letter = String.fromCharCode(65 + index);
      const selected = option === currentAnswer ? "selected" : "";
      const correctClass = state.corrected && option === question.correctAnswer ? "correct-choice" : "";
      return `
        <button
          class="choice ${selected} ${correctClass}"
          type="button"
          data-answer="${escapeHtml(option)}"
          ${locked ? "disabled" : ""}
        >
          <span class="choice-letter">${letter}.</span>
          <span class="choice-text">${escapeHtml(option)}</span>
        </button>
      `;
    })
    .join("");

  $$(".choice").forEach(choice => choice.addEventListener("click", () => {
    if(locked) return;

    $$(".choice").forEach(c => c.classList.remove("selected"));
    choice.classList.add("selected");

    saveCurrentPlayerAnswer(choice.dataset.answer);
    $("#playerMessage").textContent = "Choix enregistré automatiquement.";
  }));
}

function renderProjection(state){
  const q = state.question;
  const projectionWaiting = $("#projectionWaitingArea");
  const showWaiting = state.status === "setup" || state.status === "lobby";
  projectionWaiting?.classList.toggle("hidden", !showWaiting);
  $("#projectionQuestion")?.classList.toggle("hidden", showWaiting);
  $("#projectionTimer")?.classList.toggle("hidden", showWaiting);
  $("#projectionOptions")?.classList.toggle("hidden", showWaiting);
  $("#projectionInfoPanel")?.classList.toggle("hidden", showWaiting);
  hidePublicAnswer("#projectionCorrectAnswer");
  if(showWaiting){
    $("#projectionRanking").innerHTML = "";
    return;
  }

  $("#projectionInfoPanel").innerHTML = `
    <span>Question <b>${questionInRound(state)} / ${state.config.questionsPerRound}</b></span>
    <span>Manche <b>${state.round} / ${state.config.rounds}</b></span>
    <span>Temps <b>${formatTime(state.remainingTime)}</b></span>
  `;

  $("#projectionQuestion").textContent = state.status === "finished" ? "Classement final" : q.question;
  $("#projectionTimer").textContent = formatTime(state.remainingTime);

  if(state.corrected && state.status !== "finished"){
    showPublicAnswer("#projectionCorrectAnswer", q.correctAnswer);
  } else {
    hidePublicAnswer("#projectionCorrectAnswer");
  }

  $("#projectionOptions").innerHTML = q.type === "qcm" && state.status !== "finished"
    ? q.options.map((o,i)=>`<div class="option ${state.corrected && o === q.correctAnswer ? "correct-choice" : ""}">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("")
    : "";

  $("#projectionRanking").innerHTML = state.status === "finished"
    ? state.ranking.map((p,i)=>`<div class="rank-row"><span>${i+1}. ${escapeHtml(p.name)}</span><strong>${p.score} pts</strong></div>`).join("")
    : "";
}

function showPublicAnswer(selector, answer){
  const box = $(selector);
  if(!box) return;
  box.classList.remove("hidden");
  box.innerHTML = `<span>Bonne réponse</span><strong>${escapeHtml(answer)}</strong>`;
}

function hidePublicAnswer(selector){
  const box = $(selector);
  if(!box) return;
  box.classList.add("hidden");
  box.innerHTML = "";
}


function restoreCurrentPlayer(){
  const playerId = localStorage.getItem(CURRENT_PLAYER_KEY);
  if(!playerId) return;
  const player = engine.getState().players.find(p => p.id === playerId);
  if(!player) return;
  currentPlayer = player;
  $("#playerGameArea")?.classList.remove("hidden");
  $("#playerName").disabled = true;
  $("#joinBtn").disabled = true;
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

events.on("game:updated", render);
events.on("timer:tick", render);

restoreCurrentPlayer();

initTabs();
initActions();
render(engine.getState());
console.log("[BIBELQUIZZ 1.0.3] Application démarrée");
