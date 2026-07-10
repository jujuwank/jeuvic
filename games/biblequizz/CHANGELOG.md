# JEUVIC V0.8.4 / BIBELQUIZZ V1.5.3

- Suppression du classement de l’interface arbitre.
- Ajout de la suppression protégée des parties depuis l’accueil.
- Mot de passe administrateur centralisé dans `Config.js`.
- Nombre de manches par défaut : 1.
- Temps par défaut : 20 secondes.

# BIBLEQUIZZ V1.5.1

- Réparation de l’enregistrement Firebase des réponses.
- Mise à jour optimiste des réponses joueur.
- Scores calculés à partir des réponses confirmées dans Firestore.
- Réponses arbitre synchronisées en temps réel.

# BIBLEQUIZZ V1.5.0

## Corrections

- Réponses des joueurs reçues en temps réel dans le tableau arbitre.
- Scores calculés une seule fois par question dans une transaction Firestore.
- Choix sélectionné conservé en surbrillance pendant le chronomètre.
- Couleurs de révélation : vert pour la bonne réponse, rouge pour le mauvais choix.
- Réponse directe colorée selon le résultat.

## Résultats de manche

- Le classement reste privé dans l'interface arbitre pendant la manche.
- À la dernière question d'une manche, l'arbitre peut afficher les résultats.
- Les joueurs et la projection ne voient le classement qu'après cette action.
- L'arbitre peut ensuite lancer la manche suivante.

## V1.5.2
- Flux de réponses Firebase entièrement séparé de l’état du chronomètre.
- Synchronisation arbitre/joueurs et score corrigés.
