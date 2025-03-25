const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { dealTiles, getStartingPlayer, calculateScores } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    transports: ['polling', 'websocket'], // Allow polling as fallback
    path: '/api/socket.io' // Explicitly set the path
  });

app.use(express.static('public'));

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('join', ({ roomId, name }) => {
    console.log(`Player ${name} joining room ${roomId}`);
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], hands: [], board: [], turn: 0, scores: [0, 0, 0, 0] };
      console.log(`Created new room: ${roomId}`);
    }
    const room = rooms[roomId];
    if (room.players.length < 4) {
      socket.join(roomId);
      room.players.push({ id: socket.id, name });
      socket.emit('roomJoined', { roomId, url: `http://localhost:3000/?room=${roomId}` });
      console.log(`Room ${roomId} now has ${room.players.length} players`);
      io.to(roomId).emit('updateWaitingRoom', {
        players: room.players,
        waitingCount: 4 - room.players.length
      });
      if (room.players.length >= 1) {
        console.log(`Starting game in room ${roomId}`);
        room.hands = dealTiles();
        room.turn = getStartingPlayer(room.hands);
        io.to(roomId).emit('start', { hands: room.hands, turn: room.turn, players: room.players });
      }
    } else {
      socket.emit('roomFull');
      console.log(`Room ${roomId} is full`);
    }
  });

  socket.on('play', ({ roomId, tile, end }) => {
    console.log(`Room ${roomId} is full`);
    const room = rooms[roomId];
    if (room.turn === room.players.findIndex(p => p.id === socket.id)) {
      // Validate move (simplified here)
      room.board.push({ tile, end });
      room.hands[room.turn] = room.hands[room.turn].filter(t => t[0] !== tile[0] || t[1] !== tile[1]);
      room.turn = (room.turn + 1) % 4;

      if (room.hands[room.turn].length === 0 || !room.hands.some(h => h.length)) {
        const roundScores = calculateScores(room.hands);
        room.scores = room.scores.map((s, i) => s + roundScores[i]);
        io.to(roomId).emit('roundEnd', { scores: room.scores });
        if (room.scores.some(s => s >= 100)) {
          io.to(roomId).emit('gameEnd', { scores: room.scores });
        }
      } else {
        io.to(roomId).emit('update', { board: room.board, hands: room.hands, turn: room.turn });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));