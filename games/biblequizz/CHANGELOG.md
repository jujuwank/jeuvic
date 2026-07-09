# CHANGELOG - BIBELQUIZZ

## V1.0.3 - Corrections bugs interfaces

### Interface Arbitre
- Correction du bouton **LANCER** : à la fin du décompte, il devient **RÉPONSE**.
- La bonne réponse est révélée uniquement après clic sur **RÉPONSE**.
- Affichage corrigé en **QUESTION X / nombre total de questions de la manche**.
- Gestion corrigée des boutons de navigation :
  - **QUESTION SUIVANTE** pendant une manche.
  - **MANCHE SUIVANTE** à la fin d'une manche s'il reste une manche.
  - **RÉSULTATS** à la fin de la dernière manche.
- Après affichage des résultats, les boutons **LANCER**, **PASSER** et **QUESTION SUIVANTE** sont masqués.

### Interface Joueur
- Affichage de la bonne réponse après clic sur **RÉPONSE** côté arbitre.
- Design amélioré pour la bonne réponse.
- Les textes des propositions QCM restent blancs tant qu'elles ne sont pas sélectionnées.
- Affichage corrigé en **QUESTION X / total de la manche**.
- Temps restant agrandi et coloré pour une meilleure visibilité.

### Interface Projection
- Affichage de la bonne réponse après clic sur **RÉPONSE** côté arbitre.
- Ajout d'un panneau d'informations :
  - question actuelle / total de la manche ;
  - manche actuelle / nombre total de manches ;
  - temps restant.

### Technique
- Ajout de `currentQuestionIndex` dans l'état du moteur.
- Le moteur ne corrige plus automatiquement la question à la fin du timer ; il verrouille la question puis attend l'action **RÉPONSE**.
- Nettoyage de la logique d'affichage des boutons côté arbitre.
