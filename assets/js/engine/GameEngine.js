/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : GameEngine.js
 * VERSION : 0.3.0
 * DESCRIPTION : Façade principale du moteur de jeu JEUVIC.
 ***********************************************************************/

import { RoomEngine } from "./RoomEngine.js";
import { PlayerEngine } from "./PlayerEngine.js";
import { ScoreEngine } from "./ScoreEngine.js";

export class GameEngine {
  constructor({ eventBus, logger }) {
    this.rooms = new RoomEngine(eventBus, logger);
    this.players = new PlayerEngine(eventBus, logger);
    this.scores = new ScoreEngine(eventBus, logger);
    logger.success("GameEngine initialisé");
  }
}
