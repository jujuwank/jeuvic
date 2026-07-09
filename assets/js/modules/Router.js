/***********************************************************************
 * PROJET : JEUVIC
 * FICHIER : Router.js
 * DESCRIPTION : Navigation simple par ancres internes.
 * VERSION : 0.2.0
 ***********************************************************************/

export class Router {
  constructor(app) {
    this.app = app;
  }

  init() {
    document.addEventListener("click", event => {
      const routeElement = event.target.closest("[data-route]");
      if (!routeElement) return;

      event.preventDefault();
      this.goTo(routeElement.dataset.route);
    });

    this.app.logger.info("Router initialisé");
  }

  goTo(routeName) {
    if (!this.app.config.ROUTES.includes(routeName)) {
      this.app.logger.warn(`Route inconnue : ${routeName}`);
      return;
    }

    this.app.state.set("currentRoute", routeName);
    this.app.events.emit("ROUTE_CHANGED", { routeName });

    const target = document.getElementById(routeName);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }
}
