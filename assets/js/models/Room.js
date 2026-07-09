/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Room.js
 * VERSION : 0.3.0
 * DESCRIPTION : Modèle représentant une salle/partie JEUVIC.
 ***********************************************************************/

export class Room {
  constructor({ id, code, name, gameId, gameName, mode, maxPlayers, roundTime }) {
    this.id = id;
    this.code = code;
    this.name = name.trim();
    this.gameId = gameId;
    this.gameName = gameName;
    this.mode = mode;
    this.maxPlayers = Number(maxPlayers);
    this.roundTime = roundTime;
    this.status = "waiting";
    this.players = [];
    this.createdAt = new Date().toISOString();
  }

  get playersCount() { return this.players.length; }
  get isFull() { return this.players.length >= this.maxPlayers; }
  get canStart() { return this.players.length >= 2; }
  get readyPlayersCount() { return this.players.filter(player => player.isReady).length; }
}
