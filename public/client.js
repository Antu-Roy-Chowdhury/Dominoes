const socket = io( { transports: ['polling'] });
let roomId, playerIdx;

function joinGame() {
  const name = document.getElementById('playerName').value || 'Player';
  roomId = new URLSearchParams(window.location.search).get('room') || prompt('Enter room ID or leave blank for new');
  if (!roomId) roomId = Math.random().toString(36).substring(2, 8);
  socket.emit('join', { roomId, name });
  console.log(`Joining room ${roomId} as ${name}`);
}

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('roomJoined', ({ roomId, url }) => {
    console.log(`Room joined: ${roomId}, URL: ${url}`);
    document.getElementById('roomLink').innerText = `Share: ${url}`;
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
});

socket.on('updateWaitingRoom', ({ players, waitingCount }) => {
    console.log('Waiting room update:', { players, waitingCount });
    const waitingMessage = document.getElementById('waitingMessage');
    const waitingPlayers = document.getElementById('waitingPlayers');
    
    // Update waiting message
    waitingMessage.innerText = waitingCount > 0 
      ? `Waiting for ${waitingCount} more player${waitingCount === 1 ? '' : 's'}...`
      : 'All players joined! Starting game...';
  
    // Update player list
    waitingPlayers.innerHTML = players.map(p => `<p>${p.name}</p>`).join('');
  });

socket.on('start', ({ hands, turn, players }) => {
  console.log('Game started:', { hands, turn, players });
  console.log('Received hands:', hands);
  console.log('Current turn:', turn);
  console.log('Players:', players);
  playerIdx = players.findIndex(p => p.id === socket.id);
  
  document.getElementById('waitingRoom').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';

  updateHand(hands[playerIdx]);
  updatePlayers(players);
  if (turn === playerIdx && hands[playerIdx].some(([a, b]) => a === 6 && b === 6)) {
    playTile([6, 6], 'left'); // Auto-play [6|6]
  }
});

socket.on('update', ({ board, hands, turn }) => {
    console.log('Game update:', { board, hands, turn });
  updateBoard(board);
  updateHand(hands[playerIdx]);
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

function playTile(tile, end) {
  socket.emit('play', { roomId, tile, end });
}