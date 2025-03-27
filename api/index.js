const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { dealTiles, getStartingPlayer, calculateScores } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  path: '/socket.io',
  cors: {
    origin: [
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Resolve the path to the 'public' directory and log it for debugging
const publicPath = path.join(__dirname, '../public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Fallback route to serve index.html for the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const rooms = {};

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('join', ({ roomId, name, playerCount }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], hands: [], boneyard: [], board: [], turn: 0, scores: [], roundScores: [] };
      rooms[roomId].playerCount = parseInt(playerCount) || 2;
    }
    const room = rooms[roomId];
    room.players.push({ id: socket.id, name });

    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';
    socket.emit('roomJoined', { roomId, url: `${baseUrl}?room=${roomId}` });

    io.to(roomId).emit('updateWaitingRoom', {
      players: room.players,
      waitingCount: room.playerCount - room.players.length
    });

    if (room.players.length === room.playerCount) {
      const { hands, boneyard } = dealTiles(room.playerCount);
      room.hands = hands;
      room.boneyard = boneyard;
      room.board = [];
      room.turn = getStartingPlayer(hands);
      room.scores = new Array(room.playerCount).fill(0);
      io.to(roomId).emit('start', { hands, boneyard, turn: room.turn, players: room.players, board: room.board });
    }
  });

  socket.on('play', ({ roomId, tile, end, originalTile }) => {
    const room = rooms[roomId];
    room.board = end === 'left' ? [{ tile, originalTile }, ...room.board] : [...room.board, { tile, originalTile }];
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    room.hands[playerIdx] = room.hands[playerIdx].filter(t => t[0] !== originalTile[0] || t[1] !== originalTile[1]);
    room.turn = (room.turn + 1) % room.players.length;

    const scores = calculateScores(room.hands, room.board, room.boneyard, room.players.length);
    if (scores) {
      room.scores = room.scores.map((s, i) => s + scores[i]);
      const roundScores = scores;
      const short = room.hands.every(h => h.length > 0);
      const tempLeader = room.scores.indexOf(Math.min(...room.scores));
      io.to(roomId).emit('roundEnd', { scores: room.scores, roundScores, short, tempLeader, players: room.players });
      if (room.scores.some(s => s >= 100)) {
        io.to(roomId).emit('gameEnd', { scores: room.scores });
      }
    } else {
      io.to(roomId).emit('update', { board: room.board, hands: room.hands, boneyard: room.boneyard, turn: room.turn, players: room.players });
    }
  });

  socket.on('drawTile', ({ roomId }) => {
    const room = rooms[roomId];
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (room.boneyard.length > 0) {
      const tile = room.boneyard.pop();
      room.hands[playerIdx].push(tile);
      io.to(roomId).emit('update', { board: room.board, hands: room.hands, boneyard: room.boneyard, turn: room.turn, players: room.players });
    }
  });

  socket.on('skipTurn', ({ roomId }) => {
    const room = rooms[roomId];
    room.turn = (room.turn + 1) % room.players.length;
    io.to(roomId).emit('update', { board: room.board, hands: room.hands, boneyard: room.boneyard, turn: room.turn, players: room.players });
  });

  socket.on('reshuffle', ({ roomId }) => {
    const room = rooms[roomId];
    const { hands, boneyard } = dealTiles(room.players.length);
    room.hands = hands;
    room.boneyard = boneyard;
    io.to(roomId).emit('reshuffled', { hands, boneyard });
  });

  socket.on('startNewMatch', ({ roomId }) => {
    const room = rooms[roomId];
    const { hands, boneyard } = dealTiles(room.players.length);
    room.hands = hands;
    room.boneyard = boneyard;
    room.board = [];
    room.turn = getStartingPlayer(hands);
    io.to(roomId).emit('start', { hands, boneyard, turn: room.turn, players: room.players, board: room.board });
  });

  socket.on('chatMessage', ({ roomId, message, playerName }) => {
    io.to(roomId).emit('chatMessage', { playerName, message });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIdx = room.players.findIndex(p => p.id === socket.id);
      if (playerIdx !== -1) {
        room.players.splice(playerIdx, 1);
        io.to(roomId).emit('updateWaitingRoom', {
          players: room.players,
          waitingCount: room.playerCount - room.players.length
        });
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));