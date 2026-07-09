/***********************************************************************
 * BIBELQUIZZ V1.0.3 - Moteur principal du jeu
 *
 * Stabilisation :
 * - sauvegarde automatique de session dans localStorage ;
 * - reprise après rafraîchissement sans retour à la configuration ;
 * - état WAITING utilisé comme salle d'attente/lobby avant lancement ;
 * - aucun écran ne change vers CONFIG sans action explicite.
 ***********************************************************************/
import { demoQuestions } from "../games/bibelquizz/Questions.js";
import { AnswerChecker } from "./AnswerChecker.js";
import { Config } from "../core/Config.js";

const SESSION_KEY = "JEUVIC_BIBELQUIZZ_SESSION_V103";

export class BibelQuizzEngine {
  constructor(eventBus){
    this.events = eventBus;
    this.players = [];
    this.questions = [...demoQuestions].sort(() => Math.random() - 0.5);
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.config = { rounds: 3, questionsPerRound: 3, time: 45, maxPlayers: Config.maxPlayers };
    this.timer = null;
    this.remainingTime = 45;
    this.status = "setup"; // setup | lobby | waiting | running | locked | finished
    this.answers = new Map();
    this.corrected = false;
    this.restoreSession();
  }

  createGame(config){
    this.config = { ...this.config, ...config };
    this.players = [];
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.answers = new Map();
    this.corrected = false;
    this.remainingTime = this.config.time;
    this.status = "lobby";
    this.saveSession();
    this.events.emit("game:updated", this.getState());
  }

  addPlayer(name){
    if(!name || this.players.length >= this.config.maxPlayers) return null;
    const exists = this.players.some(p => p.name.toLowerCase() === name.toLowerCase());
    if(exists) return null;
    const player = { id: crypto.randomUUID(), name, score: 0, currentAnswer: "" };
    this.players.push(player);
    this.saveSession();
    this.events.emit("game:updated", this.getState());
    return player;
  }

  get currentQuestion(){
    return this.questions[this.currentQuestionIndex % this.questions.length];
  }

  startTimer(){
    if(this.status !== "lobby" && this.status !== "waiting") return;
    if(this.corrected) return;
    if(this.players.length <= 0) return;

    this.status = "running";
    this.remainingTime = this.config.time;
    this.saveSession();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.remainingTime--;
      this.saveSession();
      this.events.emit("timer:tick", this.getState());
      if(this.remainingTime <= 0){ this.stopTimer(); }
    }, 1000);
    this.events.emit("game:updated", this.getState());
  }

  stopTimer(){
    clearInterval(this.timer);
    this.timer = null;
    this.status = "locked";
    this.saveSession();
    this.events.emit("game:updated", this.getState());
  }

  submitAnswer(playerId, answer){
    if(this.status === "locked" || this.status === "finished" || this.status === "setup" || this.status === "lobby") return false;
    const player = this.players.find(p => p.id === playerId);
    if(!player) return false;
    player.currentAnswer = answer;
    this.answers.set(playerId, answer);
    this.saveSession();
    this.events.emit("game:updated", this.getState());
    return true;
  }

  correctQuestion(){
    if(this.corrected) return;
    this.corrected = true;
    this.players.forEach(player => {
      const answer = this.answers.get(player.id) || "";
      const correct = AnswerChecker.isCorrect(answer, this.currentQuestion);
      player.lastPoints = correct ? this.currentQuestion.points : 0;
      player.score += player.lastPoints;
    });
    this.saveSession();
    this.events.emit("game:updated", this.getState());
  }

  skipQuestion(){
    clearInterval(this.timer);
    this.timer = null;
    this.players.forEach(p => p.lastPoints = 0);
    this.nextQuestion();
  }

  nextQuestion(){
    clearInterval(this.timer);
    this.timer = null;
    this.currentQuestionIndex++;
    const totalQuestionIndex = this.currentQuestionIndex;
    this.round = Math.floor(totalQuestionIndex / this.config.questionsPerRound) + 1;
    this.answers.clear();
    this.players.forEach(p => { p.currentAnswer = ""; p.lastPoints = undefined; });
    this.corrected = false;
    this.remainingTime = this.config.time;
    if(this.round > this.config.rounds){ this.endGame(); return; }
    this.status = "waiting";
    this.saveSession();
    this.events.emit("game:updated", this.getState());
  }

  endGame(){
    clearInterval(this.timer);
    this.timer = null;
    this.status = "finished";
    this.saveSession();
    this.events.emit("game:updated", this.getState());
  }

  resetSession(){
    clearInterval(this.timer);
    localStorage.removeItem(SESSION_KEY);
    this.players = [];
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.config = { rounds: 3, questionsPerRound: 3, time: 45, maxPlayers: Config.maxPlayers };
    this.remainingTime = 45;
    this.status = "setup";
    this.answers = new Map();
    this.corrected = false;
    this.events.emit("game:updated", this.getState());
  }

  getRanking(){ return [...this.players].sort((a,b)=>b.score-a.score); }

  getState(){
    return {
      status:this.status,
      config:this.config,
      players:this.players,
      question:this.currentQuestion,
      questionNumber:this.currentQuestionIndex+1,
      currentQuestionIndex:this.currentQuestionIndex,
      round:this.round,
      remainingTime:this.remainingTime,
      answers:this.answers,
      corrected:this.corrected,
      ranking:this.getRanking()
    };
  }

  saveSession(){
    try{
      const data = {
        players:this.players,
        questions:this.questions,
        currentQuestionIndex:this.currentQuestionIndex,
        round:this.round,
        config:this.config,
        remainingTime:this.remainingTime,
        status:this.status,
        answers:[...this.answers.entries()],
        corrected:this.corrected,
        savedAt:Date.now()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    }catch(error){
      console.warn("[BIBELQUIZZ] Session non sauvegardée", error);
    }
  }

  restoreSession(){
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      this.players = Array.isArray(data.players) ? data.players : [];
      this.questions = Array.isArray(data.questions) && data.questions.length ? data.questions : this.questions;
      this.currentQuestionIndex = Number(data.currentQuestionIndex || 0);
      this.round = Number(data.round || 1);
      this.config = { ...this.config, ...(data.config || {}) };
      this.remainingTime = Number(data.remainingTime || this.config.time);
      this.status = data.status || "lobby";
      this.answers = new Map(Array.isArray(data.answers) ? data.answers : []);
      this.corrected = Boolean(data.corrected);

      // Après un rafraîchissement, on ne relance pas un ancien intervalle automatiquement.
      // Si le chrono était en cours, la question est verrouillée pour éviter les incohérences.
      if(this.status === "running") this.status = "locked";
    }catch(error){
      console.warn("[BIBELQUIZZ] Session non restaurée", error);
      localStorage.removeItem(SESSION_KEY);
    }
  }
}
