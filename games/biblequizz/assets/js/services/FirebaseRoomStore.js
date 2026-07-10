/***********************************************************************
 * BIBELQUIZZ V1.5.2 - FirebaseRoomStore / Firestore
 *
 * Architecture stabilisée :
 * - l'état général de la partie reste dans bibelquizz_rooms/{code}
 * - chaque réponse joueur est enregistrée séparément dans la sous-
 *   collection answers/{playerId}
 *
 * Cette séparation empêche les écritures du chronomètre/arbitre
 * d'écraser les réponses envoyées par les téléphones des joueurs.
 ***********************************************************************/
import { Config } from "../core/Config.js";
import { AnswerChecker } from "../engine/AnswerChecker.js";

let firebaseAppModule = null;
let firebaseFirestoreModule = null;
let firebaseAnalyticsModule = null;

export class FirebaseRoomStore {
  constructor(){
    this.enabled = Boolean(Config.firebase?.enabled);
    this.ready = false;
    this.db = null;
    this.unsubscribeRoomState = null;
    this.unsubscribeAnswersState = null;
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
  roomDoc(code){ return firebaseFirestoreModule.doc(this.db, this.collectionPath, this.normalizeCode(code)); }
  roomsCollection(){ return firebaseFirestoreModule.collection(this.db, this.collectionPath); }
  answersCollection(code){ return firebaseFirestoreModule.collection(this.roomDoc(code), "answers"); }
  answerDoc(code, playerId){ return firebaseFirestoreModule.doc(this.answersCollection(code), playerId); }

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
    Sauvegarde de l'état arbitre. Les réponses ne sont jamais
    réécrites ici : elles vivent dans la sous-collection answers.
  ---------------------------------------------------------*/
  async saveRoom(room){
    if(!this.ready || !room?.code) return;
    const ref = this.roomDoc(room.code);

    await firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      const latest = snapshot.exists() ? snapshot.data() : null;
      const { answers: _ignoredAnswers, ...roomWithoutAnswers } = room;
      let payload = {
        ...roomWithoutAnswers,
        code:this.normalizeCode(room.code),
        updatedAt:Date.now()
      };

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
              currentAnswer: changedQuestion
                ? ""
                : (oldPlayer.currentAnswer || incoming.currentAnswer || "")
            });
            incomingPlayers.delete(id);
          }else{
            mergedPlayers.push(oldPlayer);
          }
        }
        mergedPlayers.push(...incomingPlayers.values());
        payload.players = mergedPlayers;
      }

      transaction.set(ref, payload, { merge:true });
    });
  }

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
    Réponse joueur atomique et indépendante de l'état principal.
  ---------------------------------------------------------*/
  async submitAnswer(code, playerId, answer, questionKey){
    if(!this.ready) return false;
    const roomRef = this.roomDoc(code);
    const answerRef = this.answerDoc(code, playerId);

    return firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      if(!snapshot.exists()) return false;
      const room = snapshot.data();
      if(!["waiting", "running"].includes(room.status) || room.corrected) return false;

      const activeQuestionKey = `${Number(room.round || 1)}-${Number(room.currentQuestionIndex || 0)}`;
      if(activeQuestionKey !== questionKey) return false;

      transaction.set(answerRef, {
        playerId,
        answer:String(answer || "").trim(),
        questionKey,
        submittedAt:Date.now()
      }, { merge:true });

      console.info(`[PLAYER→FIREBASE] ${playerId} = ${answer}`);
      return true;
    });
  }

  /*---------------------------------------------------------
    Calcule les scores avec les réponses réellement présentes
    dans la sous-collection pour la question courante.
  ---------------------------------------------------------*/
  async scoreQuestion(code, questionKey, question){
    if(!this.ready) return null;
    const ref = this.roomDoc(code);
    const answerSnapshot = await firebaseFirestoreModule.getDocs(this.answersCollection(code));
    const answerMap = new Map();

    answerSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      if(data.questionKey === questionKey){
        answerMap.set(data.playerId || docSnapshot.id, String(data.answer || ""));
      }
    });

    return firebaseFirestoreModule.runTransaction(this.db, async transaction => {
      const snapshot = await transaction.get(ref);
      if(!snapshot.exists()) return null;
      const room = snapshot.data();
      const scoredKeys = Array.isArray(room.scoredQuestionKeys) ? room.scoredQuestionKeys : [];
      if(scoredKeys.includes(questionKey)) return room;

      const players = (room.players || []).map(player => {
        const answer = answerMap.get(player.id) || "";
        const correct = AnswerChecker.isCorrect(answer, question);
        const lastPoints = correct ? Number(question?.points || 0) : 0;
        console.info(`[SCORE] ${player.name}: "${answer}" => ${correct ? `+${lastPoints}` : "0"}`);
        return {
          ...player,
          currentAnswer:answer,
          lastPoints,
          score:Number(player.score || 0) + lastPoints
        };
      });

      const payload = {
        players,
        corrected:true,
        status:"locked",
        scoredQuestionKeys:[...scoredKeys, questionKey],
        updatedAt:Date.now()
      };
      transaction.update(ref, payload);
      return { ...room, ...payload, answers:Object.fromEntries(answerMap) };
    });
  }

  async deleteRoom(code){
    if(!this.ready) return;
    const answers = await firebaseFirestoreModule.getDocs(this.answersCollection(code));
    await Promise.all(answers.docs.map(docSnapshot => firebaseFirestoreModule.deleteDoc(docSnapshot.ref)));
    await firebaseFirestoreModule.deleteDoc(this.roomDoc(code));
  }

  /*---------------------------------------------------------
    Écoute simultanément l'état de la partie et les réponses.
    Le callback reçoit toujours un état fusionné cohérent.
  ---------------------------------------------------------*/
  subscribeRoom(code, callback){
    if(!this.ready) return () => {};
    this.unsubscribe();

    let latestRoom = null;
    let latestAnswers = new Map();

    const publish = () => {
      if(!latestRoom){
        callback(null);
        return;
      }

      const questionKey = `${Number(latestRoom.round || 1)}-${Number(latestRoom.currentQuestionIndex || 0)}`;
      const currentAnswers = {};
      for(const [playerId, data] of latestAnswers){
        if(data.questionKey === questionKey) currentAnswers[playerId] = data.answer;
      }

      const players = (latestRoom.players || []).map(player => ({
        ...player,
        currentAnswer: currentAnswers[player.id] ?? player.currentAnswer ?? ""
      }));

      callback({ ...latestRoom, players, answers:currentAnswers });
    };

    this.unsubscribeRoomState = firebaseFirestoreModule.onSnapshot(
      this.roomDoc(code),
      snapshot => {
        latestRoom = snapshot.exists() ? snapshot.data() : null;
        publish();
      },
      error => console.error("[Firebase] Erreur écoute partie", error)
    );

    this.unsubscribeAnswersState = firebaseFirestoreModule.onSnapshot(
      this.answersCollection(code),
      snapshot => {
        latestAnswers = new Map(snapshot.docs.map(docSnapshot => [docSnapshot.id, docSnapshot.data()]));
        console.info(`[ARBITRE←FIREBASE] ${latestAnswers.size} réponse(s) reçue(s)`);
        publish();
      },
      error => console.error("[Firebase] Erreur écoute réponses", error)
    );

    return () => this.unsubscribe();
  }

  unsubscribe(){
    if(this.unsubscribeRoomState){
      this.unsubscribeRoomState();
      this.unsubscribeRoomState = null;
    }
    if(this.unsubscribeAnswersState){
      this.unsubscribeAnswersState();
      this.unsubscribeAnswersState = null;
    }
  }
}
