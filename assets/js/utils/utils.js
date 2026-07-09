/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : utils.js
 * DESCRIPTION : Fonctions utilitaires réutilisables.
 * VERSION : 0.1.0
 ***********************************************************************/

window.JEUVIC = window.JEUVIC || {};

JEUVIC.Utils = {
  generateGameCode(){
    const number = Math.floor(1000 + Math.random() * 9000);
    return `JV-${number}`;
  },
  sanitizeText(value){
    return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char]));
  }
};
