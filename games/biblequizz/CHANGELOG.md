# BIBLEQUIZZ V1.6.2

- Projection : progression Question X / Y corrigée et dissociée du grand chronomètre.
- Classement arbitre : bouton « Masquer classement » intégré dans le tiroir.
- Signature « Made by J.S.P » ajoutée au jeu.
- Design joueur modernisé et optimisé pour téléphone.

# BIBELQUIZZ V1.6.1

- Ajout de l’option **Regarder** dans la liste des parties en cours.
- Enregistrement des réponses dès l’affichage de la question, avant le lancement du chronomètre.
- Nouveau badge de score cumulé dans l’interface joueur.
- Classement privé de l’arbitre dans un tiroir animé ouvrable et refermable.
# BIBLEQUIZZ V1.6.0

## Stabilisation multijoueur
- Le chrono est calculé depuis `timerStartedAt` et `timerDurationMs`.
- Les trois interfaces affichent la même échéance sans dépendre des mises à jour réseau seconde par seconde.
- Une seule écriture Firestore est faite au lancement et une autre au verrouillage.
- Les réponses restent dans une sous-collection indépendante.
- Le score final utilise les réponses réellement enregistrées dans Firestore.
- Nouvelle présentation professionnelle des salles actives.
