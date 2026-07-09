/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Storage.js
 * DESCRIPTION : Gestion simple du localStorage avec préfixe JEUVIC.
 * VERSION : 0.2.0
 ***********************************************************************/

export class StorageService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  key(name) {
    return `${this.config.STORAGE_PREFIX}${name}`;
  }

  save(name, value) {
    localStorage.setItem(this.key(name), JSON.stringify(value));
    this.logger.info(`Donnée sauvegardée : ${name}`);
  }

  load(name, fallback = null) {
    const raw = localStorage.getItem(this.key(name));
    if (!raw) return fallback;

    try {
      return JSON.parse(raw);
    } catch (error) {
      this.logger.warn(`Donnée illisible : ${name}`, error);
      return fallback;
    }
  }
}
