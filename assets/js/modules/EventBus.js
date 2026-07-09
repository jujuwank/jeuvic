/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : EventBus.js
 * DESCRIPTION : Bus d'événements interne de JEUVIC.
 * VERSION : 0.2.0
 ***********************************************************************/

export class EventBus {
  constructor(state, logger) {
    this.events = new Map();
    this.state = state;
    this.logger = logger;
  }

  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    this.events.get(eventName).push(callback);
    this.logger.info(`Listener ajouté : ${eventName}`);
  }

  emit(eventName, payload = {}) {
    this.state.increment("eventsCount");
    this.logger.info(`Event émis : ${eventName}`, payload);

    const listeners = this.events.get(eventName) || [];
    listeners.forEach(callback => callback(payload));
  }
}
