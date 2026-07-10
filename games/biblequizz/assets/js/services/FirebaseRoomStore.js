/***********************************************************************
 * BIBELQUIZZ V1.5.0 - FirebaseRoomStore / Firestore
 *
 * Les écritures sensibles utilisent des transactions afin d'éviter
 * qu'un téléphone joueur écrase l'état envoyé par l'arbitre.
 ***********************************************************************/
import { Config } from "../core/Config.js";

let firebaseAppModule = null;
let firebaseFirestoreModule = null;
let firebaseAnalyticsModule = null;

export class FirebaseRoomStore {
  constructor(){
    this.enabled = Boolean(Config.firebase?.enabled);
    this.ready = false;
    this.db = null;
    this.unsubscribeRoom = null;
    this.collectionPath = Config.firebase?.collectionPath || "bibelquizz_rooms";
  }

  async init(){
    if(!this.enabled) return false;

    const firebaseConfig = Config.firebase?.config || {};
    if(!firebaseConfig.apiKey || !firebaseConfig.projectId){
      console.warn("[Firebase] Configuration incomplète. Mode localStorage utilisé.");
      this.enabled = false;
      return false;
    }

    try{
      firebaseAppModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
      firebaseFirestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const app = firebaseAppModule.initializeApp(firebaseConfig);
      this.db = firebaseFirestoreModule.getFirestore(app);

      if(firebaseConfig.measurementId){
        try{
          firebaseAnalyticsModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js");
          firebaseAnalyticsModule.getAnalytics(app);
        }catch(error){
          console.warn("[Firebase] Analytics non initialisé.", error);
        }
      }

      this.ready = true;
      console.info("[Firebase] Firestore connecté.");
      return true;
    }catch(error){
      console.error("[Firebase] Initialisation impossible. Mode localStorage utilisé.", error);
      this.enabled = false;
      this.ready = false;
      return false;
    }
  }

  normalizeCode(code){ return String(code || "").trim().toUpperCase(); }

  roomDoc(code){
    return firebaseFirestoreModule.doc(this.db, this.collectionPath, this.normalizeCode(code));
  }

  roomsCollection(){ return firebaseFirestoreModule.collection(this.db, this.collectionPath); }

  async getRoom(code){
    if(!this.ready) return null;
    const snapshot = await firebaseFirestoreModule.getDoc(this.roomDoc(code));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async getActiveRooms(){
    if(!this.ready) return [];
    const q = firebaseFirestoreModule.query(
      this.roomsCollection(),
      firebaseFirestoreModule.orderBy("updatedAt", "desc"),
      firebaseFirestoreModule.limit(30)
    );
    const snapshot = await firebaseFirestoreModule.getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  /*---------------------------------------------------------
    Sauvegarde arbitre : fusionne les joueurs présents dans la
    dernière version Firestore pour éviter les pertes d'inscription.
  ---------------------------------------------------------*/
  async saveRoom(room){
    if(!this.ready || !room?.code) return;
    const ref = this.roomDoc(room.code);

    await firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      const latest = snapshot.exists() ? snapshot.data() : null;
      let payload = { ...room, code:this.normalizeCode(room.code), updatedAt:Date.now() };

      if(latest){
        const latestPlayers = new Map((latest.players || []).map(player => [player.id, player]));
        const incomingPlayers = new Map((room.players || []).map(player => [player.id, player]));
        const mergedPlayers = [];
        const changedQuestion = Number(latest.currentQuestionIndex) !== Number(room.currentQuestionIndex);

        for(const [id, oldPlayer] of latestPlayers){
          const incoming = incomingPlayers.get(id);
          if(incoming){
            mergedPlayers.push({
              ...oldPlayer,
              ...incoming,
              // Pendant une même question, une réponse déjà enregistrée ne
              // doit pas être effacée par une copie arbitre arrivée plus tard.
              // Lors du changement de question, l'effacement est volontaire.
              currentAnswer: changedQuestion
                ? (incoming.currentAnswer || "")
                : (incoming.currentAnswer || oldPlayer.currentAnswer || "")
            });
            incomingPlayers.delete(id);
          }else{
            mergedPlayers.push(oldPlayer);
          }
        }
        mergedPlayers.push(...incomingPlayers.values());

        const answers = changedQuestion
          ? (room.answers || [])
          : [...new Map([...(latest.answers || []), ...(room.answers || [])]).entries()];

        payload = { ...payload, players:mergedPlayers, answers };
      }

      transaction.set(ref, payload, { merge:true });
    });
  }

  /*---------------------------------------------------------
    Inscription atomique d'un joueur. Elle vérifie à nouveau que
    la partie est toujours dans le lobby au moment de l'écriture.
  ---------------------------------------------------------*/
  async addPlayer(code, player, maxPlayers){
    if(!this.ready) return { ok:false, reason:"NOT_READY" };
    const ref = this.roomDoc(code);

    return firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      if(!snapshot.exists()) return { ok:false, reason:"NOT_FOUND" };
      const room = snapshot.data();
      if(room.status !== "lobby") return { ok:false, reason:"CLOSED" };
      const players = Array.isArray(room.players) ? room.players : [];
      if(players.length >= Number(maxPlayers || 15)) return { ok:false, reason:"FULL" };
      if(players.some(item => String(item.name).toLowerCase() === String(player.name).toLowerCase())){
        return { ok:false, reason:"NAME_EXISTS" };
      }
      transaction.update(ref, { players:[...players, player], updatedAt:Date.now() });
      return { ok:true, player };
    });
  }

  /*---------------------------------------------------------
    Enregistre une réponse sans réécrire toute la partie.
  ---------------------------------------------------------*/
  async submitAnswer(code, playerId, answer){
    if(!this.ready) return false;
    const ref = this.roomDoc(code);

    return firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      if(!snapshot.exists()) return false;
      const room = snapshot.data();
      if(room.status !== "running") return false;
      const players = (room.players || []).map(player =>
        player.id === playerId ? { ...player, currentAnswer:answer } : player
      );
      const answersMap = new Map(Array.isArray(room.answers) ? room.answers : []);
      answersMap.set(playerId, answer);
      transaction.update(ref, {
        players,
        answers:[...answersMap.entries()],
        updatedAt:Date.now()
      });
      return true;
    });
  }

  /*---------------------------------------------------------
    Corrige et comptabilise une question dans une transaction.
    Les réponses les plus récentes de Firestore sont utilisées.
  ---------------------------------------------------------*/
  async scoreQuestion(code, questionKey, question){
    if(!this.ready) return null;
    const ref = this.roomDoc(code);

    return firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      if(!snapshot.exists()) return null;
      const room = snapshot.data();
      const scoredKeys = Array.isArray(room.scoredQuestionKeys) ? room.scoredQuestionKeys : [];
      if(scoredKeys.includes(questionKey)) return room;

      const answerMap = new Map(Array.isArray(room.answers) ? room.answers : []);
      const players = (room.players || []).map(player => {
        const answer = answerMap.get(player.id) || player.currentAnswer || "";
        const correct = this.isCorrectAnswer(answer, question);
        const lastPoints = correct ? Number(question?.points || 0) : 0;
        return { ...player, currentAnswer:answer, lastPoints, score:Number(player.score || 0) + lastPoints };
      });

      const payload = {
        players,
        corrected:true,
        status:"locked",
        scoredQuestionKeys:[...scoredKeys, questionKey],
        updatedAt:Date.now()
      };
      transaction.update(ref, payload);
      return { ...room, ...payload };
    });
  }

  normalizeAnswer(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  isCorrectAnswer(answer, question){
    const actual = this.normalizeAnswer(answer);
    if(!actual) return false;
    const candidates = [question?.correctAnswer, ...(question?.acceptedAnswers || [])];
    return candidates.some(candidate => this.normalizeAnswer(candidate) === actual);
  }

  async deleteRoom(code){
    if(!this.ready) return;
    await firebaseFirestoreModule.deleteDoc(this.roomDoc(code));
  }

  subscribeRoom(code, callback){
    if(!this.ready) return () => {};
    this.unsubscribe();
    this.unsubscribeRoom = firebaseFirestoreModule.onSnapshot(
      this.roomDoc(code),
      snapshot => callback(snapshot.exists() ? snapshot.data() : null),
      error => console.error("[Firebase] Erreur écoute partie", error)
    );
    return this.unsubscribeRoom;
  }

  unsubscribe(){
    if(this.unsubscribeRoom){
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
  }
}
