const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { dealTiles, getStartingPlayer, calculateScores } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  path: '/socket.io',
  cors: {
    origin: 'https://dominoes-antu.vercel.app', // Allow your Vercel frontend
    methods: ['GET', 'POST']
  }
});

app.use(express.static('../public'));

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function canAnyPlayerPlay(room) {
  const leftTile = room.board[0]?.tile;
  const rightTile = room.board[room.board.length - 1]?.tile;
  const leftEnd = leftTile ? leftTile[0] : null;
  const rightEnd = rightTile ? rightTile[1] : null;

  return room.hands.some((hand, playerIdx) => {
    return hand.some(tile => {
      if (room.board.length === 0) return true;
      const canPlayLeft = leftTile[0] === leftTile[1]
        ? (tile[0] === leftEnd || tile[1] === leftEnd)
        : (tile[1] === leftEnd);
      const canPlayRight = rightTile[0] === rightTile[1]
        ? (tile[0] === rightEnd || tile[1] === rightEnd)
        : (tile[0] === rightEnd);
      return canPlayLeft || canPlayRight;
    });
  });
}

function startNewMatch(roomId) {
  const room = rooms[roomId];
  if (room) {
    const { hands, boneyard } = dealTiles(room.expectedPlayers);
    room.hands = hands;
    room.boneyard = boneyard;
    room.board = [];
    room.turn = room.tempLeader !== null ? room.tempLeader : getStartingPlayer(hands);

    io.to(roomId).emit('start', {
      hands: room.hands,
      boneyard: room.boneyard,
      turn: room.turn,
      players: room.players,
      board: room.board
    });
    console.log(`New match started in room ${roomId} with turn: ${room.turn}`);
  } else {
    console.error(`Room ${roomId} not found for new match`);
  }
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join', ({ roomId, name, playerCount }) => {
    console.log(`Player ${name} joining room ${roomId}${playerCount ? ` with ${playerCount} expected players` : ''}`);
    
    if (!rooms[roomId]) {
      if (!playerCount) {
        socket.emit('error', { message: 'Room does not exist. Please create a new room.' });
        return;
      }
      rooms[roomId] = {
        players: [],
        hands: [],
        board: [],
        turn: 0,
        scores: [],
        boneyard: [],
        expectedPlayers: parseInt(playerCount),
        tempLeader: null
      };
      console.log(`Created new room: ${roomId} for ${playerCount} players`);
    }

    const room = rooms[roomId];
    if (room.players.length < room.expectedPlayers) {
      socket.join(roomId);
      room.players.push({ id: socket.id, name });
      socket.emit('roomJoined', { roomId, url: `http://localhost:3000/?room=${roomId}` });
      console.log(`Room ${roomId} now has ${room.players.length} players`);

      io.to(roomId).emit('updateWaitingRoom', {
        players: room.players,
        waitingCount: room.expectedPlayers - room.players.length
      });

      if (room.players.length === room.expectedPlayers) {
        console.log(`Starting game in room ${roomId}`);
        const { hands, boneyard } = dealTiles(room.expectedPlayers);
        room.hands = hands;
        room.boneyard = boneyard;
        room.turn = room.tempLeader !== null ? room.tempLeader : getStartingPlayer(hands);
        room.scores = Array(room.expectedPlayers).fill(0);

        io.to(roomId).emit('start', {
          hands: room.hands,
          boneyard: room.boneyard,
          turn: room.turn,
          players: room.players,
          board: room.board
        });
      }
    } else {
      socket.emit('roomFull');
      console.log(`Room ${roomId} is full`);
    }
  });

  socket.on('play', ({ roomId, tile, end, originalTile }) => {
    console.log(`Player ${socket.id} played tile ${tile} (original: ${originalTile}) in room ${roomId} on ${end}`);
    const room = rooms[roomId];
    if (room.turn === room.players.findIndex(p => p.id === socket.id)) {
      const leftTile = room.board[0]?.tile;
      const rightTile = room.board[room.board.length - 1]?.tile;
      const leftEnd = leftTile ? leftTile[0] : null;
      const rightEnd = rightTile ? rightTile[1] : null;
      let canPlay = false;

      if (room.board.length === 0) {
        if (room.tempLeader !== null) {
          canPlay = tile[0] === tile[1];
        } else {
          canPlay = true;
        }
      } else if (end === 'left') {
        if (leftTile[0] === leftTile[1]) {
          canPlay = tile[0] === leftEnd || tile[1] === leftEnd;
        } else {
          canPlay = tile[1] === leftEnd;
        }
      } else if (end === 'right') {
        if (rightTile[0] === rightTile[1]) {
          canPlay = tile[0] === rightEnd || tile[1] === rightEnd;
        } else {
          canPlay = tile[0] === rightEnd;
        }
      }

      if (canPlay) {
        if (end === 'left') {
          room.board.unshift({ tile, end });
        } else {
          room.board.push({ tile, end });
        }

        const playerHand = room.hands[room.turn];
        const tileIndex = playerHand.findIndex(t =>
          (t[0] === originalTile[0] && t[1] === originalTile[1]) ||
          (t[0] === originalTile[1] && t[1] === originalTile[0])
        );
        if (tileIndex !== -1) {
          room.hands[room.turn].splice(tileIndex, 1);
          console.log(`Player ${room.turn} hand after play:`, room.hands[room.turn]);
        } else {
          console.error(`Tile ${originalTile} not found in player ${room.turn}'s hand:`, playerHand);
        }

        const emptyHand = room.hands.some(hand => hand.length === 0);
        const noLegalMoves = room.boneyard.length === 0 && !canAnyPlayerPlay(room);
        if (emptyHand || noLegalMoves) {
          const roundScores = calculateScores(room.hands);
          room.scores = room.scores.map((s, i) => s + roundScores[i]);
          const lowestScore = Math.min(...room.scores);
          const lowestScorerIdx = room.scores.indexOf(lowestScore);
          room.tempLeader = lowestScorerIdx;
          io.to(roomId).emit('roundEnd', { scores: room.scores, roundScores, short: noLegalMoves, tempLeader: room.tempLeader, players: room.players });
          if (room.scores.some(s => s >= 100)) {
            io.to(roomId).emit('gameEnd', { scores: room.scores });
          } else if (noLegalMoves) {
            // Automatically start a new match after a short
            setTimeout(() => startNewMatch(roomId), 6000); // Wait 6 seconds to allow popup to be visible
          }
        } else {
          room.turn = (room.turn + 1) % room.expectedPlayers;
          io.to(roomId).emit('update', {
            board: room.board,
            hands: room.hands,
            boneyard: room.boneyard,
            turn: room.turn,
            players: room.players
          });
        }
      } else {
        console.log(`Invalid move by player ${socket.id}`);
      }
    }
  });

  socket.on('drawTile', ({ roomId }) => {
    const room = rooms[roomId];
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (room.turn === playerIdx && room.boneyard.length > 0) {
      const randomIndex = Math.floor(Math.random() * room.boneyard.length);
      const tile = room.boneyard[randomIndex];
      room.boneyard.splice(randomIndex, 1);
      room.hands[playerIdx].push(tile);

      const emptyHand = room.hands.some(hand => hand.length === 0);
      const noLegalMoves = room.boneyard.length === 0 && !canAnyPlayerPlay(room);
      if (emptyHand || noLegalMoves) {
        const roundScores = calculateScores(room.hands);
        room.scores = room.scores.map((s, i) => s + roundScores[i]);
        const lowestScore = Math.min(...room.scores);
        const lowestScorerIdx = room.scores.indexOf(lowestScore);
        room.tempLeader = lowestScorerIdx;
        io.to(roomId).emit('roundEnd', { scores: room.scores, roundScores, short: noLegalMoves, tempLeader: room.tempLeader, players: room.players });
        if (room.scores.some(s => s >= 100)) {
          io.to(roomId).emit('gameEnd', { scores: room.scores });
        } else if (noLegalMoves) {
          setTimeout(() => startNewMatch(roomId), 6000);
        }
      } else {
        io.to(roomId).emit('update', {
          board: room.board,
          hands: room.hands,
          boneyard: room.boneyard,
          turn: room.turn,
          players: room.players
        });
      }
    }
  });

  socket.on('skipTurn', ({ roomId }) => {
    const room = rooms[roomId];
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (room.turn === playerIdx) {
      console.log(`Player ${room.players[playerIdx].name} skipped their turn`);
      room.turn = (room.turn + 1) % room.expectedPlayers;

      const emptyHand = room.hands.some(hand => hand.length === 0);
      const noLegalMoves = room.boneyard.length === 0 && !canAnyPlayerPlay(room);
      if (emptyHand || noLegalMoves) {
        const roundScores = calculateScores(room.hands);
        room.scores = room.scores.map((s, i) => s + roundScores[i]);
        const lowestScore = Math.min(...room.scores);
        const lowestScorerIdx = room.scores.indexOf(lowestScore);
        room.tempLeader = lowestScorerIdx;
        io.to(roomId).emit('roundEnd', { scores: room.scores, roundScores, short: noLegalMoves, tempLeader: room.tempLeader, players: room.players });
        if (room.scores.some(s => s >= 100)) {
          io.to(roomId).emit('gameEnd', { scores: room.scores });
        } else if (noLegalMoves) {
          setTimeout(() => startNewMatch(roomId), 6000);
        }
      } else {
        io.to(roomId).emit('update', {
          board: room.board,
          hands: room.hands,
          boneyard: room.boneyard,
          turn: room.turn,
          players: room.players
        });
      }
    }
  });

  socket.on('startNewMatch', ({ roomId }) => {
    startNewMatch(roomId);
  });

  socket.on('reshuffle', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      const { hands, boneyard } = dealTiles(room.expectedPlayers);
      room.hands = hands;
      room.boneyard = boneyard;
      io.to(roomId).emit('reshuffled', {
        hands: room.hands,
        boneyard: room.boneyard
      });
      console.log(`Tiles reshuffled in room ${roomId}`);
    }
  });

  socket.on('chatMessage', ({ roomId, message, playerName }) => {
    io.to(roomId).emit('chatMessage', { playerName, message });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));