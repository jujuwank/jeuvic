/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : UI.js
 * VERSION : 0.4.1
 * DESCRIPTION : Couche interface utilisateur de JEUVIC.
 ***********************************************************************/

export class UI {
  constructor(app) {
    this.app = app;
  }

  init() {
    this.renderGames();
    this.fillGameSelect();
    this.updateCoreInfos();
    this.app.logger.info("UI initialisée");
  }

  renderGames() {
    const gamesList = document.getElementById("gamesList");
    if (!gamesList) return;

    gamesList.innerHTML = this.app.constants.GAMES.map(game => `
      <article class="jv-card jv-game-card ${game.enabled ? "is-enabled" : "is-disabled"}">
        <section class="jv-game-card-top">
          <span class="jv-game-icon">${game.icon}</span>
          <span class="jv-game-status">${game.enabled ? `V${game.version}` : "Bientôt"}</span>
        </section>
        <h3>${game.name}</h3>
        <p>${game.description}</p>
        <small class="jv-game-category">${game.category || "Jeu"}</small>
        <button
          class="jv-btn ${game.enabled ? "jv-btn-primary" : "jv-btn-secondary"} jv-btn-block"
          data-launch-game="${game.id}"
          ${game.enabled ? "" : "disabled"}
        >
          ${game.enabled ? "Lancer" : "Bientôt disponible"}
        </button>
      </article>
    `).join("");

    gamesList.querySelectorAll("[data-launch-game]").forEach(button => {
      button.addEventListener("click", () => this.app.launchGame(button.dataset.launchGame));
    });
  }

  fillGameSelect() {
    const gameType = document.getElementById("gameType");
    if (!gameType) return;
    gameType.innerHTML = this.app.constants.GAMES.map(game => `
      <option value="${game.id}">${game.name}</option>
    `).join("");
  }

  updateCoreInfos() {
    const versionBadge = document.getElementById("versionBadge");
    const eventCount = document.getElementById("eventCount");
    if (versionBadge) versionBadge.textContent = `Version ${this.app.config.VERSION}`;
    if (eventCount) eventCount.textContent = this.app.state.get("eventsCount");
  }

  notify(message, type = "info") {
    const zone = document.getElementById("notificationZone");
    if (!zone) return;
    zone.innerHTML = `<p class="jv-notice jv-notice-${type}">${message}</p>`;
    window.setTimeout(() => { zone.innerHTML = ""; }, 3500);
  }

  renderRoom(room) {
    this.renderGamePreview(room);
    this.renderPlayers(room);
    this.updateCoreInfos();
  }

  renderGamePreview(room) {
    const preview = document.getElementById("gamePreview");
    if (!preview || !room) return;

    preview.classList.remove("jv-empty");
    preview.innerHTML = `
      <section class="jv-preview">
        <p>Code partie</p>
        <h2>${room.code}</h2>
        <p><strong>Nom :</strong> ${room.name}</p>
        <p><strong>Jeu :</strong> ${room.gameName}</p>
        <p><strong>Joueurs :</strong> ${room.playersCount} / ${room.maxPlayers}</p>
        <p><strong>Mode :</strong> ${room.mode}</p>
        <p><strong>Statut :</strong> ${this.getStatusLabel(room.status)}</p>
        <button class="jv-btn jv-btn-primary jv-btn-block" id="launchSelectedGameBtn">Ouvrir le jeu</button>
        <section class="jv-actions-stack">
          <button class="jv-btn jv-btn-primary" id="startRoomBtn">Lancer</button>
          <button class="jv-btn jv-btn-secondary" id="pauseRoomBtn">Pause</button>
          <button class="jv-btn jv-btn-secondary" id="resumeRoomBtn">Reprendre</button>
          <button class="jv-btn jv-btn-danger" id="finishRoomBtn">Terminer</button>
        </section>
      </section>
    `;

    document.getElementById("launchSelectedGameBtn")?.addEventListener("click", () => this.app.launchGame(room.gameId));
    document.getElementById("startRoomBtn")?.addEventListener("click", () => this.app.startRoom());
    document.getElementById("pauseRoomBtn")?.addEventListener("click", () => this.app.pauseRoom());
    document.getElementById("resumeRoomBtn")?.addEventListener("click", () => this.app.resumeRoom());
    document.getElementById("finishRoomBtn")?.addEventListener("click", () => this.app.finishRoom());
  }

  renderPlayers(room) {
    const playersList = document.getElementById("playersList");
    if (!playersList) return;
    if (!room || room.players.length === 0) {
      playersList.innerHTML = `<p class="jv-empty">Aucun joueur inscrit.</p>`;
      return;
    }

    playersList.innerHTML = room.players.map(player => `
      <article class="jv-player-row">
        <span>${player.avatar} ${player.name}</span>
        <strong>${player.score} pts</strong>
        <button class="jv-btn jv-btn-sm jv-btn-secondary" data-ready-player="${player.id}">${player.isReady ? "Pas prêt" : "Prêt"}</button>
        <button class="jv-btn jv-btn-sm jv-btn-primary" data-score-plus="${player.id}">+1</button>
        <button class="jv-btn jv-btn-sm jv-btn-danger" data-remove-player="${player.id}">Retirer</button>
      </article>
    `).join("");

    playersList.querySelectorAll("[data-ready-player]").forEach(button => {
      button.addEventListener("click", () => this.app.togglePlayerReady(button.dataset.readyPlayer));
    });
    playersList.querySelectorAll("[data-score-plus]").forEach(button => {
      button.addEventListener("click", () => this.app.addPlayerPoint(button.dataset.scorePlus));
    });
    playersList.querySelectorAll("[data-remove-player]").forEach(button => {
      button.addEventListener("click", () => this.app.removePlayer(button.dataset.removePlayer));
    });
  }

  getStatusLabel(status) {
    const labels = { waiting: "En attente", started: "Lancée", paused: "En pause", finished: "Terminée", closed: "Fermée" };
    return labels[status] || status;
  }
}
