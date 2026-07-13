# Changelog — RÉVÉLATION

## 1.0.0
- Première intégration complète dans JEUVIC.
- Gestion des parties Firebase.
- Buzzers multijoueurs atomiques.
- Indices, pause/reprise et décompte final.
- Bonne/mauvaise réponse et scores.
- Panneau SCORE arbitre et projection.


## V1.0.1
- Ajout des boutons Passer et Réponse.
- États du jeu affichés en français.
- Bonne/Mauvaise réponse dans une modale zoomée avec flou 15 px.
- Classement affiché aux joueurs avec leur nom en évidence.
- Refonte mobile de l’interface joueur.
- Son des 5 dernières secondes synchronisé avec le décompte.

## V1.0.2 — Stabilisation du passage entre questions
- Correction du blocage après la première question.
- Le bouton `COMMENCER` devient `LANCER` pour chaque nouvelle question prête.
- Réinitialisation complète des timers, buzzers et états avant la question suivante.
- Vérification explicite de l’existence de la prochaine question.
- Compatibilité renforcée si Firestore renvoie la collection de questions sous forme d’objet indexé.


## V1.0.3
- La réponse correcte ne s’affiche plus automatiquement à zéro.
- Le bouton RÉPONSE est disponible uniquement après la fin complète du décompte.
- Le son fin.mp3 est seulement mis en pause lors d’un buzz.
- Après une mauvaise réponse, le son de fin reprend à l’endroit où il avait été mis en pause.
- Ajout des sons reponse-fausse.mp3 et reponse-juste.mp3.
- Les sons de validation peuvent se superposer aux autres audios.


## 1.0.4
- Intervalle standard entre indices fixé à 3 secondes.
- Banque Google Sheets officielle utilisée si le champ est vide.
- Ajout de l’audio buzzer.mp3 lors d’un buzz accepté.
- Réorganisation des commandes arbitre.
- Ajout du bouton Terminer la partie.
- Affichage des points de la question sur les interfaces arbitre, joueur et spectateur.
