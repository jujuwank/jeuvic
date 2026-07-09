/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : App.js
 * VERSION : 0.4.1
 * DESCRIPTION : Point d'entrée principal de JEUVIC en ES Modules.
 ***********************************************************************/

import { Config } from "./Config.js";
import { Constants } from "./Constants.js";
import { StateStore } from "./State.js";
import { Logger } from "../modules/Logger.js";
import { EventBus } from "../modules/EventBus.js";
import { Router } from "../modules/Router.js";
import { UI } from "../modules/UI.js";
import { StorageService } from "../modules/Storage.js";
import { Helpers } from "../utils/Helpers.js";
import { GameEngine } from "../engine/GameEngine.js";

class JeuvicApplication {
  constructor() {
    this.config = Config;
    this.constants = Constants;
    this.helpers = Helpers;
    this.state = new StateStore();
    this.logger = new Logger(this.config);
    this.events = new EventBus(this.state, this.logger);
    this.storage = new StorageService(this.config, this.logger);
    this.router = new Router(this);
    this.ui = new UI(this);
    this.engine = new GameEngine({ eventBus: this.events, logger: this.logger });
  }

  start() {
    this.logger.group("Démarrage JEUVIC", () => {
      this.registerEvents();
      this.ui.init();
      this.router.init();
      this.bindForms();
      this.events.emit("APP_STARTED", { version: this.config.VERSION });
      this.logger.success("Application démarrée");
    });
  }

  registerEvents() {
    ["APP_STARTED", "ROUTE_CHANGED", "ROOM_CREATED", "PLAYER_JOINED", "PLAYER_LEFT", "PLAYER_READY_CHANGED", "SCORE_UPDATED", "ROOM_STARTED", "ROOM_PAUSED", "ROOM_RESUMED", "ROOM_FINISHED"].forEach(eventName => {
      this.events.on(eventName, payload => {
        const room = payload?.room || this.state.get("currentRoom");
        if (room) this.ui.renderRoom(room);
      });
    });
  }

  bindForms() {
    document.getElementById("gameForm")?.addEventListener("submit", event => this.createRoom(event));
    document.getElementById("joinGameBtn")?.addEventListener("click", () => this.joinRoom());
    this.logger.info("Formulaires connectés");
  }

  createRoom(event) {
    event.preventDefault();
    const selectedGame = this.constants.GAMES.find(game => game.id === document.getElementById("gameType").value);
    const room = this.engine.rooms.createRoom({
      name: document.getElementById("gameName").value,
      gameId: selectedGame.id,
      gameName: selectedGame.name,
      mode: document.getElementById("gameMode").value,
      maxPlayers: Number(document.getElementById("playersCount").value),
      roundTime: document.getElementById("roundTime")?.value || "60 secondes"
    });
    this.state.set("currentRoom", room);
    this.storage.save("currentRoom", room);
    this.ui.notify(`Partie créée : ${room.code}`, "success");
  }

  joinRoom() {
    const room = this.state.get("currentRoom");
    const joinCode = document.getElementById("joinCode").value.trim().toUpperCase();
    const playerName = document.getElementById("playerName").value.trim();
    try {
      if (!room) throw new Error("Aucune partie n’a encore été créée.");
      if (joinCode !== room.code) throw new Error("Code incorrect.");
      const player = this.engine.players.addPlayer(room, playerName);
      this.state.set("currentPlayer", player);
      this.storage.save("currentRoom", room);
      this.ui.notify(`${player.name} a rejoint la partie.`, "success");
    } catch (error) {
      this.ui.notify(error.message, "error");
      document.getElementById("joinMessage").textContent = error.message;
    }
  }

  /**
   * Lance un jeu officiel depuis le catalogue JEUVIC.
   * Pour V0.4.1, BibleQuizz reste autonome dans /games/biblequizz/.
   */
  launchGame(gameId) {
    const game = this.constants.GAMES.find(item => item.id === gameId);
    if (!game) {
      this.ui.notify("Jeu introuvable.", "error");
      return;
    }

    if (!game.enabled || !game.launchPath) {
      this.ui.notify(`${game.name} sera disponible prochainement.`, "info");
      return;
    }

    window.location.href = game.launchPath;
  }

  startRoom() { this.executeRoomAction(() => this.engine.rooms.startRoom(this.state.get("currentRoom"))); }
  pauseRoom() { this.executeRoomAction(() => this.engine.rooms.pauseRoom(this.state.get("currentRoom"))); }
  resumeRoom() { this.executeRoomAction(() => this.engine.rooms.resumeRoom(this.state.get("currentRoom"))); }
  finishRoom() { this.executeRoomAction(() => this.engine.rooms.finishRoom(this.state.get("currentRoom"))); }

  togglePlayerReady(playerId) { this.executeRoomAction(room => this.engine.players.toggleReady(room, playerId)); }
  removePlayer(playerId) { this.executeRoomAction(room => this.engine.players.removePlayer(room, playerId)); }
  addPlayerPoint(playerId) { this.executeRoomAction(room => this.engine.scores.addPoints(room, playerId, 1)); }

  executeRoomAction(action) {
    const room = this.state.get("currentRoom");
    try {
      if (!room) throw new Error("Aucune salle active.");
      action(room);
      this.storage.save("currentRoom", room);
    } catch (error) {
      this.logger.error(error.message);
      this.ui.notify(error.message, "error");
    }
  }
}

const JEUVIC = new JeuvicApplication();
window.JEUVIC = JEUVIC;
document.addEventListener("DOMContentLoaded", () => JEUVIC.start());
