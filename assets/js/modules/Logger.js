/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Logger.js
 * DESCRIPTION : Logger centralisé pour le développement.
 * VERSION : 0.3.0
 ***********************************************************************/

export class Logger {
  constructor(config) {
    this.config = config;
    this.prefix = `[${config.APP_NAME} ${config.VERSION}]`;
  }

  info(message, data = null) {
    if (!this.config.DEBUG) return;
    console.info(`${this.prefix} ✔ ${message}`, data ?? "");
  }

  success(message, data = null) {
    if (!this.config.DEBUG) return;
    console.log(`${this.prefix} ✅ ${message}`, data ?? "");
  }

  warn(message, data = null) {
    if (!this.config.DEBUG) return;
    console.warn(`${this.prefix} ⚠ ${message}`, data ?? "");
  }

  error(message, data = null) {
    console.error(`${this.prefix} ✖ ${message}`, data ?? "");
  }

  group(title, callback) {
    if (!this.config.DEBUG) return;
    console.group(`${this.prefix} ${title}`);
    callback();
    console.groupEnd();
  }
}
