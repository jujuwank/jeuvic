/***********************************************************************
 * BIBELQUIZZ - Configuration globale
 *
 * Modifie les constantes ici pour adapter les durées, limites, Firebase
 * et textes sans toucher à la logique du jeu.
 ***********************************************************************/
export const TRANSITION_DURATION = 3000;

// Paramètres administrateur et valeurs par défaut de création de partie.
export const ADMIN_PASSWORD = "JuJu-admin";
export const DEFAULT_ROUNDS = 1;
export const DEFAULT_QUESTION_TIME = 20;

// Code partie : 4 caractères A-Z/0-9, avec au moins un chiffre.
export const GAME_CODE_LENGTH = 4;
export const GAME_CODE_PATTERN = /^(?=.*\d)[A-Z0-9]{4}$/;

export const Config = {
  appName: "JEUVIC / BIBELQUIZZ",
  version: "1.6.0",

  // Alias conservés pour lire la configuration depuis l'objet Config si besoin.
  transitionDuration: TRANSITION_DURATION,
  adminPassword: ADMIN_PASSWORD,
  defaultRounds: DEFAULT_ROUNDS,
  defaultQuestionTime: DEFAULT_QUESTION_TIME,
  gameCodeLength: GAME_CODE_LENGTH,
  gameCodePattern: GAME_CODE_PATTERN,

  maxPlayers: 15,

  // Google Sheets : l'arbitre peut aussi coller le lien dans la configuration de la partie.
  defaultQuestionsSheetUrl: "",
  minSimilarity: 0.75,
  ignoredWords: ["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "the", "a", "an", "der", "die", "das", "ein", "eine"],

  /*=========================================================
    FIREBASE / FIRESTORE

    Configuration Web Firebase du projet JEUVIC.
    Le mode cloud est actif : les parties sont partagées
    entre arbitre, joueurs et projection via Firestore.
  =========================================================*/
  firebase: {
    enabled: true,
    provider: "firestore",
    collectionPath: "bibelquizz_rooms",
    config: {
      apiKey: "AIzaSyAlU6jkI7sIj7DnPKJ7d4om7jd0XN2VVJQ",
      authDomain: "jeuvic-50898.firebaseapp.com",
      projectId: "jeuvic-50898",
      storageBucket: "jeuvic-50898.firebasestorage.app",
      messagingSenderId: "64826787331",
      appId: "1:64826787331:web:daa0e20dce72376148b036",
      measurementId: "G-0SEC4WSJJ1"
    }
  }};
