const socket = io({ transports: ['polling'] });
let roomId, playerIdx;

function joinGame() {
  const name = document.getElementById('playerName').value || 'Player';
  roomId = new URLSearchParams(window.location.search).get('room');

  // If roomId exists in the URL, this is a subsequent player joining an existing room
  if (roomId) {
    document.getElementById('playerCount').style.display = 'none'; // Hide player count dropdown
    socket.emit('join', { roomId, name }); // Join the existing room
  } else {
    // First player: show player count and create a new room
    const playerCount = document.getElementById('playerCount').value;
    roomId = Math.random().toString(36).substring(2, 8);
    socket.emit('join', { roomId, name, playerCount });
  }
  console.log(`Joining room ${roomId} as ${name}`);
}

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('roomJoined', ({ roomId, url }) => {
  console.log(`Room joined: ${roomId}, URL: ${url}`);
  document.getElementById('roomLink').innerText = `Share: ${url}`;
  document.getElementById('joinSection').style.display = 'none'; // Hide join section after joining
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
});

socket.on('updateWaitingRoom', ({ players, waitingCount }) => {
  console.log('Waiting room update:', { players, waitingCount });
  const waitingMessage = document.getElementById('waitingMessage');
  const waitingPlayers = document.getElementById('waitingPlayers');
  
  waitingMessage.innerText = waitingCount > 0 
    ? `Waiting for ${waitingCount} more player${waitingCount === 1 ? '' : 's'}...`
    : 'All players joined! Starting game...';

  waitingPlayers.innerHTML = players.map(p => `<p>${p.name}</p>`).join('');
});

socket.on('start', ({ hands, boneyard, turn, players }) => {
  console.log('Game started:', { hands, boneyard, turn, players });
  console.log('Received hands:', hands);
  console.log('Current turn:', turn);
  console.log('Players:', players);
  playerIdx = players.findIndex(p => p.id === socket.id);
  
  document.getElementById('waitingRoom').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';

  updateHand(hands[playerIdx]);
  updateBoneyard(boneyard);
  updatePlayers(players);
  if (turn === playerIdx && hands[playerIdx].some(([a, b]) => a === 6 && b === 6)) {
    playTile([6, 6], 'left');
  }
});

socket.on('update', ({ board, hands, boneyard, turn }) => {
  console.log('Game update:', { board, hands, boneyard, turn });
  updateBoard(board);
  updateHand(hands[playerIdx]);
  updateBoneyard(boneyard);
  const canPlay = hands[playerIdx].some(tile => canPlayTile(tile, board));
  document.getElementById('drawTile').style.display = (turn === playerIdx && !canPlay && boneyard.length > 0) ? 'block' : 'none';
});

socket.on('roundEnd', ({ scores }) => {
  document.getElementById('scores').style.display = 'block';
  document.getElementById('scores').innerHTML = scores.map((s, i) => `Player ${i + 1}: ${s}`).join('<br>');
});

socket.on('gameEnd', ({ scores }) => {
  const winner = scores.indexOf(Math.min(...scores));
  alert(`Game Over! Winner: Player ${winner + 1}`);
});

function updateHand(hand) {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = hand.map(t => `<div class="tile" onclick="playTile([${t}], 'left')">${t[0]}|${t[1]}</div>`).join('');
}

function updateBoard(board) {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = board.map(b => `<div class="tile played">${b.tile[0]}|${b.tile[1]}</div>`).join('');
}

function updatePlayers(players) {
  document.getElementById('players').innerHTML = players.map(p => `<p>${p.name}</p>`).join('');
}

function updateBoneyard(boneyard) {
  const boneyardDiv = document.getElementById('boneyard');
  const boneyardTiles = document.getElementById('boneyardTiles');
  boneyardDiv.style.display = boneyard.length > 0 ? 'block' : 'none';
  boneyardTiles.innerHTML = boneyard.length > 0 ? `<p>${boneyard.length} tiles remaining</p>` : '';
}

function canPlayTile(tile, board) {
  if (board.length === 0) return true;
  const leftEnd = board[0].tile[0];
  const rightEnd = board[board.length - 1].tile[1];
  return tile[0] === leftEnd || tile[1] === leftEnd || tile[0] === rightEnd || tile[1] === rightEnd;
}

function playTile(tile, end) {
  socket.emit('play', { roomId, tile, end });
}

function drawTile() {
  socket.emit('drawTile', { roomId });
}