# JEUVIC Game Engine V0.3.0

## Principe

Le moteur est découpé en petites responsabilités :

- `RoomEngine` : cycle de vie des salles.
- `PlayerEngine` : gestion des joueurs.
- `ScoreEngine` : gestion des scores.
- `GameEngine` : façade qui rassemble les moteurs.

## État centralisé

La salle active est stockée dans :

```js
JEUVIC.state.get("currentRoom")
```

Le joueur courant est stocké dans :

```js
JEUVIC.state.get("currentPlayer")
```

## Événements principaux

- `ROOM_CREATED`
- `ROOM_STARTED`
- `ROOM_PAUSED`
- `ROOM_RESUMED`
- `ROOM_FINISHED`
- `PLAYER_JOINED`
- `PLAYER_LEFT`
- `PLAYER_READY_CHANGED`
- `SCORE_UPDATED`

L'interface écoute ces événements pour se rafraîchir automatiquement.
