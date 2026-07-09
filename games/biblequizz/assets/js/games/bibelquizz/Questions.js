/***********************************************************************
 * BIBELQUIZZ - Questions de démonstration
 * Remplacement futur : lecture aléatoire depuis Google Sheets.
 ***********************************************************************/
export const demoQuestions = [
  { id: 1, type: "direct", points: 3, category: "Ancien Testament", question: "Qui a construit l'arche ?", correctAnswer: "Noé", acceptedAnswers: ["Noe", "Noah", "Noé"], options: [], verse: "Genèse 6" },
  { id: 2, type: "qcm", points: 2, category: "Nouveau Testament", question: "Combien d'apôtres Jésus a-t-il choisis ?", correctAnswer: "12", acceptedAnswers: ["douze", "twelve", "zwölf"], options: ["7", "10", "12", "40"], verse: "Luc 6:13" },
  { id: 3, type: "direct", points: 1, category: "Personnages", question: "Qui a vaincu Goliath ?", correctAnswer: "David", acceptedAnswers: ["David"], options: [], verse: "1 Samuel 17" },
  { id: 4, type: "qcm", points: 3, category: "Ancien Testament", question: "Quel prophète a été jeté dans la fosse aux lions ?", correctAnswer: "Daniel", acceptedAnswers: ["Daniel"], options: ["Élie", "Daniel", "Élisée", "Jonas"], verse: "Daniel 6" },
  { id: 5, type: "direct", points: 2, category: "Évangiles", question: "Dans quelle ville Jésus est-il né ?", correctAnswer: "Bethléem", acceptedAnswers: ["Bethleem", "Bethlehem", "Betlehem"], options: [], verse: "Matthieu 2:1" },
  { id: 6, type: "qcm", points: 1, category: "Bible", question: "Quel est le premier livre de la Bible ?", correctAnswer: "Genèse", acceptedAnswers: ["Genese", "Genesis"], options: ["Exode", "Genèse", "Psaumes", "Matthieu"], verse: "Genèse 1:1" }
];
