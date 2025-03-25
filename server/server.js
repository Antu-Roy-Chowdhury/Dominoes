const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { dealTiles, getStartingPlayer, calculateScores } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  path: '/socket.io'
});

app.use(express.static('public'));

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join', ({ roomId, name, playerCount }) => {
    console.log(`Player ${name} joining room ${roomId}${playerCount ? ` with ${playerCount} expected players` : ''}`);
    
    // If the room doesn't exist, create it (first player)
    if (!rooms[roomId]) {
      if (!playerCount) {
        // If no playerCount is provided, this is an invalid request (should only happen for first player)
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
        expectedPlayers: parseInt(playerCount)
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
        room.turn = getStartingPlayer(hands);
        room.scores = Array(room.expectedPlayers).fill(0);
        io.to(roomId).emit('start', {
          hands: room.hands,
          boneyard: room.boneyard,
          turn: room.turn,
          players: room.players
        });
      }
    } else {
      socket.emit('roomFull');
      console.log(`Room ${roomId} is full`);
    }
  });

  socket.on('play', ({ roomId, tile, end }) => {
    console.log(`Player ${socket.id} played tile ${tile} in room ${roomId}`);
    const room = rooms[roomId];
    if (room.turn === room.players.findIndex(p => p.id === socket.id)) {
      room.board.push({ tile, end });
      room.hands[room.turn] = room.hands[room.turn].filter(t => t[0] !== tile[0] || t[1] !== tile[1]);
      room.turn = (room.turn + 1) % room.expectedPlayers;

      if (room.hands[room.turn].length === 0 || !room.hands.some(h => h.length)) {
        const roundScores = calculateScores(room.hands);
        room.scores = room.scores.map((s, i) => s + roundScores[i]);
        io.to(roomId).emit('roundEnd', { scores: room.scores });
        if (room.scores.some(s => s >= 100)) {
          io.to(roomId).emit('gameEnd', { scores: room.scores });
        }
      } else {
        io.to(roomId).emit('update', {
          board: room.board,
          hands: room.hands,
          boneyard: room.boneyard,
          turn: room.turn
        });
      }
    }
  });

  socket.on('drawTile', ({ roomId }) => {
    const room = rooms[roomId];
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (room.turn === playerIdx && room.boneyard.length > 0) {
      const tile = room.boneyard.shift();
      room.hands[playerIdx].push(tile);
      io.to(roomId).emit('update', {
        board: room.board,
        hands: room.hands,
        boneyard: room.boneyard,
        turn: room.turn
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));