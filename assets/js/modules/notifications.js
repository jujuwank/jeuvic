/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : notifications.js
 * DESCRIPTION : Notifications temporaires simples.
 * VERSION : 0.1.0
 ***********************************************************************/

window.JEUVIC = window.JEUVIC || {};

JEUVIC.Notifications = {
  info(message){ console.info(`[JEUVIC] ${message}`); },
  success(message){ console.log(`[JEUVIC SUCCESS] ${message}`); },
  error(message){ console.error(`[JEUVIC ERROR] ${message}`); }
};
