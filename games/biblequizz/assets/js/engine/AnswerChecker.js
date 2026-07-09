/***********************************************************************
 * BIBELQUIZZ - Correcteur de réponses
 ***********************************************************************/
import { Config } from "../core/Config.js";

export class AnswerChecker {
  static normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word && !Config.ignoredWords.includes(word))
      .join(" ")
      .trim();
  }

  static similarity(a, b) {
    const s1 = this.normalize(a);
    const s2 = this.normalize(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const distance = this.levenshtein(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  static levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  }

  static isCorrect(playerAnswer, question) {
    const candidates = [question.correctAnswer, ...(question.acceptedAnswers || [])];
    return candidates.some(answer => this.similarity(playerAnswer, answer) >= Config.minSimilarity);
  }
}
