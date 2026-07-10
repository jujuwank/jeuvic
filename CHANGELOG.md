# JEUVIC V0.8.2

- Correction du stockage Firestore des réponses (objet au lieu de tableaux imbriqués non supportés).
- Réponses visibles en temps réel dans l’interface arbitre.
- Comptabilisation des points réparée.
- Sélection QCM conservée pendant la synchronisation réseau.
- Compatibilité avec les anciennes parties enregistrées.

# JEUVIC V0.8.1

## BIBLEQUIZZ V1.5.0

- Synchronisation en temps réel des réponses joueurs vers l'interface arbitre.
- Comptabilisation atomique des points dans Firestore à partir des réponses les plus récentes.
- Conservation visuelle du choix QCM pendant le décompte.
- Révélation joueur : bonne réponse en vert, mauvais choix en rouge.
- Réponse directe : champ vert si correct, rouge si incorrect, avec affichage de la bonne réponse.
- Prise en charge du même comportement pour Vrai/Faux.
- Classement privé visible uniquement par l'arbitre pendant la manche.
- Classement public affiché uniquement après action de l'arbitre en fin de manche.
- Nouvel état synchronisé `round_results`, puis bouton « Manche suivante ».

## V0.8.3
- Réponses Firestore déplacées dans une sous-collection indépendante.
- Affichage temps réel des réponses dans l’interface arbitre stabilisé.
- Surbrillance QCM conservée pendant tout le décompte.
- Calcul des points basé sur les réponses réellement enregistrées.
- Journaux de diagnostic ajoutés dans la console navigateur.
