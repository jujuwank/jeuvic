# JEUVIC Core V0.2.0

## Principe

Le Core sert à centraliser l'application.

Au lieu d'avoir des fonctions globales dispersées, toute l'application passe par l'objet :

```javascript
JEUVIC
```

## Structure actuelle

```text
JEUVIC.config
JEUVIC.constants
JEUVIC.state
JEUVIC.logger
JEUVIC.events
JEUVIC.storage
JEUVIC.router
JEUVIC.ui
JEUVIC.helpers
```

## EventBus

Le système d'événements permet aux modules de communiquer sans dépendre directement les uns des autres.

Exemple :

```javascript
JEUVIC.events.emit("ROOM_CREATED", { room });
```

## State

L'état global contient les informations importantes de l'application :

```javascript
currentRoute
currentRoom
currentGame
currentPlayer
rooms
players
eventsCount
```

## Logger

Le logger affiche dans la console les étapes du démarrage et les actions importantes.

Exemple :

```text
[JEUVIC 0.2.0] ✔ Application démarrée
```
