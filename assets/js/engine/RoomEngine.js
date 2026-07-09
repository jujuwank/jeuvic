/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : RoomEngine.js
 * VERSION : 0.3.0
 * DESCRIPTION : Création et cycle de vie des salles de jeu.
 ***********************************************************************/

import { Room } from "../models/Room.js";
import { Helpers } from "../utils/Helpers.js";

export class RoomEngine {
  constructor(eventBus, logger) {
    this.events = eventBus;
    this.logger = logger;
  }

  createRoom({ name, gameId, gameName, mode, maxPlayers, roundTime }) {
    const room = new Room({
      id: Helpers.createId("room"),
      code: Helpers.createRoomCode(),
      name,
      gameId,
      gameName,
      mode,
      maxPlayers,
      roundTime
    });

    this.logger.success(`Salle créée : ${room.code}`);
    this.events.emit("ROOM_CREATED", { room });
    return room;
  }

  startRoom(room) {
    if (!room.canStart) throw new Error("Il faut au moins 2 joueurs pour lancer la partie.");
    room.status = "started";
    this.events.emit("ROOM_STARTED", { room });
    return room;
  }

  pauseRoom(room) { room.status = "paused"; this.events.emit("ROOM_PAUSED", { room }); return room; }
  resumeRoom(room) { room.status = "started"; this.events.emit("ROOM_RESUMED", { room }); return room; }
  finishRoom(room) { room.status = "finished"; this.events.emit("ROOM_FINISHED", { room }); return room; }
  closeRoom(room) { room.status = "closed"; this.events.emit("ROOM_CLOSED", { room }); return room; }
}
