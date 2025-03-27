# Dominoes
Dominoes is a family of tile-based games played with gaming pieces. I have tried to create this game with basic coding and simplest algorithm.  

## Features

- **Multiplayer Gameplay:** Play with 2 to 4 players in real-time.
- **Real-Time Chat:** Communicate with other players during the game.
- **Room System:** Create or join rooms using unique room IDs.
- **Game Mechanics:**
  - Deal tiles, play on the board, draw from the boneyard, or skip turns.
  - Reshuffle tiles if you have 5 or more pairs in your hand.
  - Automatic scoring and round-end detection.
- **Responsive Design:** Clean and intuitive UI with animations for tile plays.
- **Deployment Ready:** Deployed on Vercel for global access (with some limitations due to serverless environment).

## Demo

The game is deployed on Vercel: [Play Dominoes Online](https://dominoes-antu.vercel.app/)

**Note:** Due to Vercel’s serverless environment, Socket.IO uses HTTP polling, which may introduce slight latency. For a better experience, consider deploying the server on a platform that supports WebSockets (e.g., Render, Heroku).

## Screenshots

*Coming soon!*

## Project Structure
```
dominoes-game/
├── node_modules/.....
├── api/
│   ├── index.js  (previously server.js)
│   └── gameLogic.js
├── public/
│   ├── client.js
│   ├── index.html
│   └── style.css
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

## Prerequisites

- **Node.js** (v20.x or later)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, etc.)

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/<your-username>/dominoes-game.git
   cd dominoes-game
   ```
# Usage

## Join or Create a Room:

Enter your name and select the number of players (2–4).
Click Join Room to create a new room or join an existing one using a room ID (via URL query parameter, e.g., ?room=abc123).
Share the room link with friends to invite them.

## Gameplay:

Wait for all players to join. The game starts automatically when the required number of players is reached.
Play tiles on the board by clicking them. Choose the side (left or right) if applicable.
Draw from the boneyard or skip your turn if you can’t play.
Reshuffle your tiles if you have 5 or more pairs (e.g., [1|1], [2|2]).
Chat with other players using the in-game chat feature.

## Scoring and Winning:

The game ends when a player’s score reaches 100 or more.
The player with the lowest score wins.
