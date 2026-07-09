/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Config.js
 * DESCRIPTION : Configuration centrale de l'application.
 * VERSION : 0.4.1
 ***********************************************************************/

import { Version } from "./Version.js";

export const Config = Object.freeze({
  APP_NAME: Version.name,
  VERSION: Version.version,
  CODENAME: Version.codename,

  MIN_PLAYERS: 2,
  MAX_PLAYERS: 50,
  DEFAULT_PLAYERS: 4,
  DEFAULT_STATUS: "En attente des joueurs",

  STORAGE_PREFIX: "jeuvic_",
  DEBUG: true,

  ROUTES: ["home", "games", "admin", "player"]
});
