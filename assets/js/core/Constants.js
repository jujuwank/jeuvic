/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Constants.js
 * DESCRIPTION : Constantes métiers de la plateforme.
 * VERSION : 0.4.1
 ***********************************************************************/

export const Constants = Object.freeze({
  GAMES: [
    {
      id: "biblequizz",
      name: "BibleQuizz",
      icon: "📖",
      description: "Jeu biblique officiel intégré à JEUVIC. Questions, manches, arbitre, joueur et projection.",
      category: "Quiz biblique",
      version: "1.0.3",
      enabled: true,
      launchPath: "games/biblequizz/index.html"
    },
    {
      id: "revelation",
      name: "Révélation",
      icon: "🔍",
      description: "Jeu chrétien d’indices progressifs avec buzzer, arbitre et projection en temps réel.",
      category: "Indices & rapidité",
      version: "1.0.4",
      enabled: true,
      launchPath: "games/revelation/index.html"
    },
    {
      id: "proverbes",
      name: "Proverbes",
      icon: "💬",
      description: "Jeu multijoueur de phrase cachée : lettres, propositions privées et validation par l’arbitre.",
      category: "Phrase cachée",
      version: "1.0.0",
      enabled: true,
      launchPath: "games/proverbes/index.html"
    },
    {
      id: "quiz",
      name: "Quiz",
      icon: "🧠",
      description: "Jeu de questions-réponses configurable par l’arbitre.",
      category: "Quiz général",
      version: "Bientôt",
      enabled: false,
      launchPath: ""
    },
    {
      id: "mot-mystere",
      name: "Mot Mystère",
      icon: "🔤",
      description: "Les joueurs doivent deviner un mot caché.",
      category: "Réflexion",
      version: "Bientôt",
      enabled: false,
      launchPath: ""
    },
    {
      id: "blind-test",
      name: "Blind Test",
      icon: "🎵",
      description: "Reconnaître rapidement un son, une musique ou une voix.",
      category: "Audio",
      version: "Bientôt",
      enabled: false,
      launchPath: ""
    },
    {
      id: "bingo",
      name: "Bingo",
      icon: "🎲",
      description: "Jeu de tirage avec grille et validation par l’arbitre.",
      category: "Animation",
      version: "Bientôt",
      enabled: false,
      launchPath: ""
    }
  ],

  ROOM_STATUS: Object.freeze({
    WAITING: "En attente des joueurs",
    READY: "Prête",
    STARTED: "Lancée",
    PAUSED: "En pause",
    FINISHED: "Terminée",
    ARCHIVED: "Archivée"
  })
});
