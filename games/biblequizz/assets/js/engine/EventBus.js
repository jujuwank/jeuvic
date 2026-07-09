/***********************************************************************
 * JEUVIC - EventBus minimal
 ***********************************************************************/
export class EventBus {
  constructor(){ this.listeners = {}; }
  on(eventName, callback){
    if(!this.listeners[eventName]) this.listeners[eventName] = [];
    this.listeners[eventName].push(callback);
  }
  emit(eventName, payload){
    (this.listeners[eventName] || []).forEach(callback => callback(payload));
  }
}
