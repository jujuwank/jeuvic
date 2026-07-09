# BIBELQUIZZ V1.0.3

BIBELQUIZZ est le premier jeu officiel de la plateforme JEUVIC.

## Nouveautés de cette version

Cette version corrige les premiers bugs relevés pendant le test de l'interface joueur et arbitre.

### Interface joueur

- Affichage QCM avec lettres : `A.`, `B.`, `C.`, `D.`.
- Surbrillance claire du dernier choix sélectionné.
- Réponse directe vidée automatiquement quand l'arbitre passe à la question suivante ou passe la question.
- Sauvegarde automatique de la réponse pendant la saisie.
- Le bouton `VALIDER` est masqué : la dernière réponse au moment de la fin du chrono est considérée comme officielle.

### Interface arbitre

- Le tableau des réponses se met à jour en temps réel.
- Le chrono ne peut être lancé qu'une seule fois par question.
- Le bouton `LANCER` est grisé après le lancement et réactivé uniquement à la question suivante.

## Lancement

Ouvrir `index.html` dans un navigateur moderne.

Pour éviter les restrictions liées aux modules JavaScript, il est recommandé de lancer le projet avec l'extension **Live Server** dans VS Code.


## Version V1.0.3

Cette version corrige les bugs listés par interface : Arbitre, Joueur et Projection. La révélation de la bonne réponse est maintenant contrôlée par le bouton **RÉPONSE** après le décompte.
