/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : State.js
 * DESCRIPTION : Etat centralisé de JEUVIC.
 * VERSION : 0.3.0
 ***********************************************************************/

export class StateStore {
  constructor(initialState = {}) {
    this.data = {
      currentRoute: "home",
      currentRoom: null,
      currentGame: null,
      currentPlayer: null,
      rooms: [],
      players: [],
      eventsCount: 0,
      ...initialState
    };
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    return value;
  }

  update(values = {}) {
    this.data = { ...this.data, ...values };
    return this.data;
  }

  increment(key) {
    const currentValue = Number(this.data[key] || 0);
    this.data[key] = currentValue + 1;
    return this.data[key];
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.data));
  }
}
