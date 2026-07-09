/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Helpers.js
 * DESCRIPTION : Fonctions utilitaires génériques.
 * VERSION : 0.3.0
 ***********************************************************************/

export const Helpers = Object.freeze({
  createId(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  },

  createRoomCode(prefix = "JV") {
    const number = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${number}`;
  },

  generateGameCode(prefix = "JV") {
    return this.createRoomCode(prefix);
  },

  getElement(selector) {
    return document.querySelector(selector);
  },

  getElements(selector) {
    return Array.from(document.querySelectorAll(selector));
  },

  safeText(value, fallback = "") {
    return String(value ?? fallback).trim();
  }
});
