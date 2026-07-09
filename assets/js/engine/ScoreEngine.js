/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : ScoreEngine.js
 * VERSION : 0.3.0
 * DESCRIPTION : Gestion centralisée des scores.
 ***********************************************************************/

export class ScoreEngine {
  constructor(eventBus, logger) {
    this.events = eventBus;
    this.logger = logger;
  }

  addPoints(room, playerId, points = 1) {
    const player = room.players.find(item => item.id === playerId);
    if (!player) throw new Error("Joueur introuvable.");
    player.addScore(points);
    this.events.emit("SCORE_UPDATED", { room, player });
    return player;
  }

  removePoints(room, playerId, points = 1) {
    const player = room.players.find(item => item.id === playerId);
    if (!player) throw new Error("Joueur introuvable.");
    player.removeScore(points);
    this.events.emit("SCORE_UPDATED", { room, player });
    return player;
  }

  getRanking(room) {
    return [...room.players].sort((a, b) => b.score - a.score);
  }
}
