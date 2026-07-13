# BIBLEQUIZZ V1.7.1

- Le document Google Sheets fourni devient la banque de questions par défaut.
- Nouveau sélecteur « Banque par défaut / Banque personnalisée ».
- Champ personnalisé activé uniquement lorsque ce mode est sélectionné.
- Test du lien Google Sheets avec message de succès ou erreur.
- Les questions sont chargées puis mélangées au démarrage de la partie.

# BIBLEQUIZZ V1.6.3

- Résultats joueur limités au titre, au score cumulé et au classement.
- Suppression du chrono, de la bonne réponse, de la saisie et du bouton Accueil sur l’écran final.
- Ajout du retour vers le choix Joueur / Spectateur.
- Accueil des parties élargi et signature J.S.P rendue plus discrète.

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

## V1.6.4
- Mobile UX Pass complet pour les écrans joueur, arbitre et projection.
- QCM en cartes tactiles pleine largeur, question et chrono mieux hiérarchisés.
- Formulaires, attente, score et classement final restructurés sur téléphone.
- Table arbitre rendue scrollable et panneau classement adapté au mobile.


## V1.7.1
- Ajout de « Points : X » dans la carte de question du joueur.
- Ajout de « Points : X » sous les informations Question/Manche de la projection.
- Valeur lue dynamiquement depuis la question Google Sheets active.
