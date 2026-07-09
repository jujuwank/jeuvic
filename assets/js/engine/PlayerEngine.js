/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : PlayerEngine.js
 * VERSION : 0.3.0
 * DESCRIPTION : Gestion métier des joueurs.
 ***********************************************************************/

import { Player } from "../models/Player.js";
import { Helpers } from "../utils/Helpers.js";

export class PlayerEngine {
  constructor(eventBus, logger) {
    this.events = eventBus;
    this.logger = logger;
  }

  createPlayer(name) {
    return new Player({ id: Helpers.createId("player"), name });
  }

  addPlayer(room, name) {
    if (!room) throw new Error("Aucune salle active.");
    if (room.status !== "waiting") throw new Error("La partie n'accepte plus de joueurs.");
    if (room.isFull) throw new Error("La salle est complète.");
    if (!name || !name.trim()) throw new Error("Le nom du joueur est obligatoire.");

    const exists = room.players.some(player => player.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) throw new Error("Ce nom est déjà utilisé.");

    const player = this.createPlayer(name);
    room.players.push(player);
    this.logger.success(`Joueur ajouté : ${player.name}`);
    this.events.emit("PLAYER_JOINED", { room, player });
    return player;
  }

  removePlayer(room, playerId) {
    const player = room.players.find(item => item.id === playerId);
    room.players = room.players.filter(item => item.id !== playerId);
    this.events.emit("PLAYER_LEFT", { room, player });
    return player;
  }

  toggleReady(room, playerId) {
    const player = room.players.find(item => item.id === playerId);
    if (!player) throw new Error("Joueur introuvable.");
    player.setReady(!player.isReady);
    this.events.emit("PLAYER_READY_CHANGED", { room, player });
    return player;
  }
}
