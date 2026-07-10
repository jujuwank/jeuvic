/***********************************************************************
 * BIBELQUIZZ V1.5.0 - Moteur principal synchronisé
 *
 * Firebase est la source de vérité commune aux interfaces arbitre,
 * joueur et projection. localStorage reste disponible comme secours.
 ***********************************************************************/
import { demoQuestions } from "../games/bibelquizz/Questions.js";
import { AnswerChecker } from "./AnswerChecker.js";
import { Config, TRANSITION_DURATION, GAME_CODE_PATTERN } from "../core/Config.js";
import { GoogleSheetsQuestionStore } from "../services/GoogleSheetsQuestionStore.js";

const ROOMS_KEY = "JEUVIC_BIBELQUIZZ_ROOMS_V140";
const ACTIVE_STATUSES = new Set(["lobby", "transition", "waiting", "running", "locked", "round_results"]);

export class BibelQuizzEngine {
  constructor(eventBus, roomStore = null){
    this.events = eventBus;
    this.store = roomStore;
    this.cloudEnabled = false;
    this.activeCode = null;
    this.players = [];
    this.questions = [...demoQuestions].sort(() => Math.random() - 0.5);
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.config = this.defaultConfig();
    this.timer = null;
    this.remainingTime = 45;
    this.status = "setup";
    this.transitionTimer = null;
    this.answers = new Map();
    this.corrected = false;
    this.scoredQuestionKeys = [];
    this.questionStore = new GoogleSheetsQuestionStore();
    this.actionPending = false;
  }

  defaultConfig(){
    return {
      rounds: 3,
      questionsPerRound: 3,
      time: 45,
      maxPlayers: Config.maxPlayers,
      questionsSheetUrl: Config.defaultQuestionsSheetUrl
    };
  }

  async init(){
    this.cloudEnabled = Boolean(this.store && await this.store.init());
    this.events.emit("storage:ready", { cloudEnabled: this.cloudEnabled });
  }

  /*=========================================================
    OUTILS
  =========================================================*/
  normalizeCode(code){ return String(code || "").trim().toUpperCase(); }
  isValidGameCode(code){ return GAME_CODE_PATTERN.test(this.normalizeCode(code)); }
  isJoinable(){ return this.status === "lobby"; }

  serializeRoom(){
    // Firestore refuse les propriétés dont la valeur est undefined.
    const players = this.players.map(player => {
      const cleanPlayer = { ...player };
      if(cleanPlayer.lastPoints === undefined) delete cleanPlayer.lastPoints;
      return cleanPlayer;
    });

    return {
      code: this.activeCode,
      players,
      questions: this.questions,
      currentQuestionIndex: this.currentQuestionIndex,
      round: this.round,
      config: this.config,
      remainingTime: this.remainingTime,
      status: this.status,
      answers: [...this.answers.entries()],
      corrected: this.corrected,
      scoredQuestionKeys: this.scoredQuestionKeys,
      updatedAt: Date.now()
    };
  }

  async runAction(action){
    if(this.actionPending) return false;
    this.actionPending = true;
    try{
      await action();
      return true;
    }catch(error){
      console.error("[BIBELQUIZZ] Action impossible", error);
      this.events.emit("game:error", { message: error?.message || "Action impossible" });
      return false;
    }finally{
      this.actionPending = false;
    }
  }

  /*=========================================================
    GESTION DES PARTIES
  =========================================================*/
  createDraftGame(){
    this.resetRuntime();
    this.activeCode = null;
    this.status = "setup";
    this.events.emit("game:updated", this.getState());
  }

  async createGame(config, code){
    const normalizedCode = this.normalizeCode(code);
    if(!this.isValidGameCode(normalizedCode)) return { ok:false, reason:"INVALID_CODE" };
    if(await this.hasRoom(normalizedCode)) return { ok:false, reason:"CODE_EXISTS" };

    this.activeCode = normalizedCode;
    this.config = { ...this.defaultConfig(), ...config };
    await this.prepareQuestionsForGame(this.config);
    this.players = [];
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.answers = new Map();
    this.corrected = false;
    this.scoredQuestionKeys = [];
    this.remainingTime = this.getCurrentQuestionTime();
    this.status = "lobby";
    await this.saveRoom();
    this.subscribeToRoom(this.activeCode);
    this.events.emit("game:updated", this.getState());
    return { ok:true, code:this.activeCode };
  }

  async loadGame(code){
    const room = await this.getRoom(code);
    if(!room) return false;
    this.applyRoom(room);
    this.subscribeToRoom(this.activeCode);
    this.events.emit("game:updated", this.getState());
    return true;
  }

  async getActiveRooms(){
    const rooms = this.cloudEnabled
      ? await this.store.getActiveRooms()
      : Object.values(this.readRooms());

    return rooms
      .filter(room => ACTIVE_STATUSES.has(room.status))
      .sort((a,b)=>(b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async hasRoom(code){ return Boolean(await this.getRoom(code)); }

  async getRoom(code){
    const normalizedCode = this.normalizeCode(code);
    if(!normalizedCode) return null;
    if(this.cloudEnabled) return await this.store.getRoom(normalizedCode);
    return this.readRooms()[normalizedCode] || null;
  }

  async removeCurrentRoom(){
    const code = this.activeCode;
    if(!code) return;
    if(this.cloudEnabled) await this.store.deleteRoom(code);
    else {
      const rooms = this.readRooms();
      delete rooms[code];
      this.writeRooms(rooms);
    }
    this.store?.unsubscribe?.();
    this.resetRuntime();
    this.activeCode = null;
  }

  subscribeToRoom(code){
    if(!this.cloudEnabled || !code) return;
    this.store.subscribeRoom(code, room => {
      if(!room){
        this.events.emit("game:missing", { code });
        return;
      }
      this.applyRoom(room);
      this.events.emit("game:updated", this.getState());
    });
  }

  /*=========================================================
    JOUEURS
  =========================================================*/
  async addPlayer(name, code = this.activeCode){
    const normalizedCode = this.normalizeCode(code);
    if(!await this.loadGame(normalizedCode)) return { ok:false, reason:"NOT_FOUND" };
    if(!this.isJoinable()) return { ok:false, reason:"CLOSED" };
    if(!name?.trim()) return { ok:false, reason:"INVALID_NAME" };
    if(this.players.length >= this.config.maxPlayers) return { ok:false, reason:"FULL" };
    const exists = this.players.some(p => p.name.toLowerCase() === name.trim().toLowerCase());
    if(exists) return { ok:false, reason:"NAME_EXISTS" };

    const player = { id: crypto.randomUUID(), name:name.trim(), score:0, currentAnswer:"" };
    if(this.cloudEnabled && this.store?.addPlayer){
      const result = await this.store.addPlayer(normalizedCode, player, this.config.maxPlayers);
      if(!result.ok) return result;
      await this.loadGame(normalizedCode);
      return result;
    }
    this.players.push(player);
    await this.saveRoom();
    this.events.emit("game:updated", this.getState());
    return { ok:true, player };
  }

  get currentQuestion(){
    if(!this.questions.length) return demoQuestions[0];
    return this.questions[Math.min(this.currentQuestionIndex, this.questions.length - 1)];
  }

  getCurrentQuestionTime(){
    const value = Number(this.currentQuestion?.time);
    return Number.isFinite(value) && value > 0 ? value : Number(this.config.time || 45);
  }

  getCurrentQuestionKey(){ return `${this.round}-${this.currentQuestionIndex}`; }

  shuffleQuestions(questions){
    const copy = [...questions];
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async prepareQuestionsForGame(config){
    const totalNeeded = Number(config.rounds || 1) * Number(config.questionsPerRound || 1);
    let questions = [];

    try{
      questions = await this.questionStore.loadQuestions(config.questionsSheetUrl);
    }catch(error){
      console.warn("[Google Sheets] Chargement impossible, questions de démonstration utilisées.", error);
    }

    const source = questions.length ? questions : demoQuestions;
    const shuffled = this.shuffleQuestions(source);

    // Si la feuille contient moins de questions que demandé, on complète
    // avec une nouvelle copie mélangée afin que la partie puisse continuer.
    const selected = [];
    while(selected.length < Math.max(totalNeeded, 1)){
      selected.push(...this.shuffleQuestions(shuffled));
    }
    this.questions = selected.slice(0, Math.max(totalNeeded, 1));
  }

  /*=========================================================
    DEROULEMENT DU JEU
  =========================================================*/
  async beginGame(){
    return this.runAction(async () => {
      if(this.status !== "lobby" || this.players.length <= 0) return;
      this.status = "transition";
      this.remainingTime = this.getCurrentQuestionTime();
      await this.saveRoom();
      this.events.emit("game:updated", this.getState());
      this.scheduleTransitionEnd();
    });
  }

  scheduleTransitionEnd(){
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(async () => {
      if(this.status !== "transition") return;
      this.status = "waiting";
      this.remainingTime = this.getCurrentQuestionTime();
      await this.saveRoom();
      this.events.emit("game:updated", this.getState());
    }, TRANSITION_DURATION);
  }

  async startTimer(){
    return this.runAction(async () => {
      if(this.status !== "waiting" || this.corrected || this.players.length <= 0) return;
      this.status = "running";
      this.remainingTime = this.getCurrentQuestionTime();
      await this.saveRoom();
      clearInterval(this.timer);
      this.timer = setInterval(async () => {
        this.remainingTime = Math.max(0, this.remainingTime - 1);
        await this.saveRoom();
        this.events.emit("timer:tick", this.getState());
        if(this.remainingTime <= 0) await this.stopTimer();
      }, 1000);
      this.events.emit("game:updated", this.getState());
    });
  }

  async stopTimer(){
    clearInterval(this.timer);
    this.timer = null;
    if(this.status === "finished") return;
    this.status = "locked";
    await this.saveRoom();
    this.events.emit("game:updated", this.getState());
  }

  async submitAnswer(playerId, answer){
    if(this.status !== "running") return false;
    const player = this.players.find(p => p.id === playerId);
    if(!player) return false;
    const normalizedAnswer = String(answer || "").trim();
    if(this.cloudEnabled && this.store?.submitAnswer){
      const saved = await this.store.submitAnswer(this.activeCode, playerId, normalizedAnswer);
      if(!saved) return false;
      player.currentAnswer = normalizedAnswer;
      this.answers.set(playerId, normalizedAnswer);
      // Mise à jour immédiate de l'interface locale, sans attendre le snapshot Firebase.
      this.events.emit("game:updated", this.getState());
      return true;
    }
    player.currentAnswer = normalizedAnswer;
    this.answers.set(playerId, normalizedAnswer);
    await this.saveRoom();
    this.events.emit("game:updated", this.getState());
    return true;
  }

  async correctQuestion(){
    return this.runAction(async () => {
      if(this.corrected || this.status === "finished" || this.status === "round_results") return;
      clearInterval(this.timer);
      this.timer = null;

      // En mode Firebase, le calcul se fait dans une transaction à partir
      // des réponses les plus récentes afin d'éviter toute perte de points.
      if(this.cloudEnabled && this.store?.scoreQuestion){
        const room = await this.store.scoreQuestion(
          this.activeCode,
          this.getCurrentQuestionKey(),
          this.currentQuestion
        );
        if(room) this.applyRoom(room);
      }else{
        this.corrected = true;
        this.status = "locked";
        this.scoreCurrentQuestion();
        await this.saveRoom();
      }
      this.events.emit("game:updated", this.getState());
    });
  }

  scoreCurrentQuestion(){
    const key = this.getCurrentQuestionKey();
    if(this.scoredQuestionKeys.includes(key)) return;

    this.players.forEach(player => {
      const answer = this.answers.get(player.id) || player.currentAnswer || "";
      const correct = AnswerChecker.isCorrect(answer, this.currentQuestion);
      player.lastPoints = correct ? Number(this.currentQuestion.points || 0) : 0;
      player.score = Number(player.score || 0) + player.lastPoints;
    });

    this.scoredQuestionKeys.push(key);
  }

  async skipQuestion(){
    return this.runAction(async () => {
      if(["setup", "lobby", "transition", "finished"].includes(this.status)) return;
      clearInterval(this.timer);
      clearTimeout(this.transitionTimer);
      this.timer = null;
      this.players.forEach(player => { player.lastPoints = 0; });
      await this.moveToNextQuestion(false);
    });
  }

  async nextQuestion(){
    return this.runAction(async () => {
      if(["setup", "lobby", "transition", "running", "finished"].includes(this.status)) return;
      if(!this.corrected){
        this.corrected = true;
        this.scoreCurrentQuestion();
      }
      await this.moveToNextQuestion(false);
    });
  }

  async moveToNextQuestion(shouldScore){
    clearInterval(this.timer);
    clearTimeout(this.transitionTimer);
    this.timer = null;
    if(shouldScore) this.scoreCurrentQuestion();

    this.currentQuestionIndex += 1;
    this.round = Math.floor(this.currentQuestionIndex / Number(this.config.questionsPerRound || 1)) + 1;
    this.answers.clear();
    this.players.forEach(player => {
      player.currentAnswer = "";
      delete player.lastPoints;
    });
    this.corrected = false;

    if(this.round > Number(this.config.rounds || 1) || this.currentQuestionIndex >= this.questions.length){
      await this.finishGameInternal();
      return;
    }

    this.remainingTime = this.getCurrentQuestionTime();
    this.status = "transition";
    await this.saveRoom();
    this.events.emit("game:updated", this.getState());
    this.scheduleTransitionEnd();
  }

  async showRoundResults(){
    return this.runAction(async () => {
      if(!this.corrected || this.status === "finished") return;
      this.status = "round_results";
      await this.saveRoom();
      this.events.emit("game:updated", this.getState());
    });
  }

  async endGame(){
    return this.runAction(async () => this.finishGameInternal());
  }

  async finishGameInternal(){
    clearInterval(this.timer);
    clearTimeout(this.transitionTimer);
    this.timer = null;

    // La question courante est comptabilisée une seule fois si elle a été révélée
    // ou si l'arbitre termine explicitement la partie pendant/après la question.
    if(!this.scoredQuestionKeys.includes(this.getCurrentQuestionKey())){
      this.scoreCurrentQuestion();
    }

    this.corrected = true;
    this.status = "finished";
    await this.saveRoom();
    this.events.emit("game:updated", this.getState());
  }

  getRanking(){
    return [...this.players].sort((a,b) => Number(b.score || 0) - Number(a.score || 0));
  }

  getState(){
    return {
      code: this.activeCode,
      status: this.status,
      config: this.config,
      players: this.players,
      question: this.currentQuestion,
      questionNumber: this.currentQuestionIndex + 1,
      currentQuestionIndex: this.currentQuestionIndex,
      round: this.round,
      remainingTime: this.remainingTime,
      answers: this.answers,
      corrected: this.corrected,
      ranking: this.getRanking(),
      cloudEnabled: this.cloudEnabled,
      joinable: this.isJoinable(),
      actionPending: this.actionPending
    };
  }

  /*=========================================================
    PERSISTANCE
  =========================================================*/
  async saveRoom(){
    if(!this.activeCode) return;
    const room = this.serializeRoom();
    if(this.cloudEnabled) await this.store.saveRoom(room);
    else {
      const rooms = this.readRooms();
      rooms[this.activeCode] = room;
      this.writeRooms(rooms);
    }
  }

  readRooms(){
    try{ return JSON.parse(localStorage.getItem(ROOMS_KEY)) || {}; }
    catch{ return {}; }
  }

  writeRooms(rooms){ localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)); }

  applyRoom(data){
    this.activeCode = this.normalizeCode(data.code);
    this.players = Array.isArray(data.players) ? data.players : [];
    this.questions = Array.isArray(data.questions) && data.questions.length ? data.questions : this.questions;
    this.currentQuestionIndex = Number(data.currentQuestionIndex || 0);
    this.round = Number(data.round || 1);
    this.config = { ...this.defaultConfig(), ...(data.config || {}) };
    this.remainingTime = Number(data.remainingTime ?? this.getCurrentQuestionTime());
    this.status = data.status || "lobby";
    this.answers = new Map(Array.isArray(data.answers) ? data.answers : []);
    this.corrected = Boolean(data.corrected);
    this.scoredQuestionKeys = Array.isArray(data.scoredQuestionKeys) ? data.scoredQuestionKeys : [];
  }

  resetRuntime(){
    clearInterval(this.timer);
    clearTimeout(this.transitionTimer);
    this.players = [];
    this.questions = [...demoQuestions].sort(() => Math.random() - 0.5);
    this.currentQuestionIndex = 0;
    this.round = 1;
    this.config = this.defaultConfig();
    this.remainingTime = 45;
    this.status = "setup";
    this.answers = new Map();
    this.corrected = false;
    this.scoredQuestionKeys = [];
    this.actionPending = false;
  }
}
