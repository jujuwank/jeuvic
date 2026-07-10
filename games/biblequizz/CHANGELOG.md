# BIBLEQUIZZ V1.6.0

## Stabilisation multijoueur
- Le chrono est calculé depuis `timerStartedAt` et `timerDurationMs`.
- Les trois interfaces affichent la même échéance sans dépendre des mises à jour réseau seconde par seconde.
- Une seule écriture Firestore est faite au lancement et une autre au verrouillage.
- Les réponses restent dans une sous-collection indépendante.
- Le score final utilise les réponses réellement enregistrées dans Firestore.
- Nouvelle présentation professionnelle des salles actives.
