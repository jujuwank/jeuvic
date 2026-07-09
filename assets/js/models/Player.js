/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Player.js
 * VERSION : 0.3.0
 * DESCRIPTION : Modèle représentant un joueur dans une salle de jeu.
 ***********************************************************************/

export class Player {
  constructor({ id, name, avatar = "🙂", team = null }) {
    this.id = id;
    this.name = name.trim();
    this.avatar = avatar;
    this.team = team;
    this.score = 0;
    this.isReady = false;
    this.isConnected = true;
    this.createdAt = new Date().toISOString();
  }

  setReady(value) { this.isReady = Boolean(value); }
  addScore(points) { this.score += Number(points); }
  removeScore(points) { this.score = Math.max(0, this.score - Number(points)); }
  resetScore() { this.score = 0; }
}
