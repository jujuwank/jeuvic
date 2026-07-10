/***********************************************************************
 * BIBELQUIZZ - GoogleSheetsQuestionStore
 *
 * Lit une banque de questions Google Sheets publiée en CSV.
 * Colonnes supportées : Question, Type, A, B, C, D, Reponse/Réponse,
 * Temps/Durée, Points, Actif, Catégorie.
 ***********************************************************************/

export class GoogleSheetsQuestionStore {
  /*---------------------------------------------------------
    Transforme un lien Google Sheets normal en lien CSV si besoin.
  ---------------------------------------------------------*/
  static normalizeCsvUrl(url){
    const value = String(url || "").trim();
    if(!value) return "";
    if(value.includes("output=csv") || value.includes("format=csv")) return value;

    const match = value.match(/\/spreadsheets\/d\/([^/]+)/);
    if(!match) return value;

    const sheetId = match[1];
    const gid = (value.match(/[?&]gid=([^&#]+)/) || [null, "0"])[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  /*---------------------------------------------------------
    Charge et convertit les lignes CSV en questions BIBELQUIZZ.
  ---------------------------------------------------------*/
  async loadQuestions(sheetUrl){
    const csvUrl = GoogleSheetsQuestionStore.normalizeCsvUrl(sheetUrl);
    if(!csvUrl) return [];

    const response = await fetch(csvUrl, { cache: "no-store" });
    if(!response.ok) throw new Error(`Google Sheets inaccessible (${response.status})`);

    const csv = await response.text();
    const rows = this.parseCsv(csv);
    if(rows.length < 2) return [];

    const headers = rows[0].map(this.normalizeHeader);

    return rows.slice(1)
      .map(row => this.rowToQuestion(headers, row))
      .filter(Boolean);
  }

  normalizeHeader(value){
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  getCell(headers, row, names){
    for(const name of names){
      const index = headers.indexOf(name);
      if(index >= 0) return String(row[index] || "").trim();
    }
    return "";
  }

  rowToQuestion(headers, row){
    const active = this.getCell(headers, row, ["actif", "active"]);
    if(active && !["oui", "yes", "true", "1", "x"].includes(active.toLowerCase())) return null;

    const question = this.getCell(headers, row, ["question", "texte"]);
    const correctAnswer = this.getCell(headers, row, ["reponse", "bonnereponse", "correctanswer", "correct"]);
    if(!question || !correctAnswer) return null;

    const options = ["a", "b", "c", "d"].map(key => this.getCell(headers, row, [key, `proposition${key}`, `option${key}`])).filter(Boolean);
    const typeRaw = this.getCell(headers, row, ["type"]);
    const type = options.length >= 2 || typeRaw.toLowerCase() === "qcm" ? "qcm" : "direct";

    return {
      id: crypto.randomUUID(),
      category: this.getCell(headers, row, ["categorie", "category", "theme"]),
      type,
      question,
      options,
      correctAnswer: this.resolveCorrectAnswer(correctAnswer, options),
      time: this.toPositiveNumber(this.getCell(headers, row, ["temps", "tempss", "duree", "durees", "duration", "durationseconds"]), 45),
      points: this.toPositiveNumber(this.getCell(headers, row, ["points", "point"]), 1)
    };
  }

  resolveCorrectAnswer(answer, options){
    const value = String(answer || "").trim();
    const letterIndex = { A:0, B:1, C:2, D:3 }[value.toUpperCase()];
    return letterIndex !== undefined && options[letterIndex] ? options[letterIndex] : value;
  }

  toPositiveNumber(value, fallback){
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  /*---------------------------------------------------------
    Parseur CSV simple compatible avec les cellules entre guillemets.
  ---------------------------------------------------------*/
  parseCsv(csv){
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for(let i = 0; i < csv.length; i++){
      const char = csv[i];
      const next = csv[i + 1];

      if(char === '"' && inQuotes && next === '"'){
        cell += '"';
        i++;
      } else if(char === '"'){
        inQuotes = !inQuotes;
      } else if(char === "," && !inQuotes){
        row.push(cell);
        cell = "";
      } else if((char === "\n" || char === "\r") && !inQuotes){
        if(char === "\r" && next === "\n") i++;
        row.push(cell);
        if(row.some(value => String(value).trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if(row.some(value => String(value).trim() !== "")) rows.push(row);
    return rows;
  }
}
