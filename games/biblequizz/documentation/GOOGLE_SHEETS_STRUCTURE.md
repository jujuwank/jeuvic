# Structure Google Sheets - BIBELQUIZZ V1.3.0

Publie la feuille en CSV, puis colle le lien dans la configuration de la partie.

## Colonnes recommandées

| Question | Type | A | B | C | D | Réponse | Temps | Points | Actif | Catégorie |
|---|---|---|---|---|---|---|---:|---:|---|---|
| Qui a construit l'arche ? | QCM | Abraham | Noé | Moïse | David | B | 30 | 2 | Oui | Ancien Testament |
| Qui a baptisé Jésus ? | Direct | | | | | Jean-Baptiste | 45 | 3 | Oui | Nouveau Testament |

## Règles

- `Question` et `Réponse` sont obligatoires.
- `Réponse` peut contenir la lettre A/B/C/D ou le texte exact de la bonne réponse.
- `Temps` définit la durée de cette question en secondes.
- `Points` définit le nombre de points de cette question.
- `Actif = Oui` garde la question. Si la colonne est vide, la question est aussi acceptée.
- Les questions sont mélangées aléatoirement à chaque nouvelle partie.

## Publication CSV

Dans Google Sheets :

1. Fichier → Partager → Publier sur le Web.
2. Choisir la feuille des questions.
3. Choisir le format CSV.
4. Copier le lien et le coller dans BIBELQUIZZ.
