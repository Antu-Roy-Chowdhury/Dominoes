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

socket.on('start', ({ hands, boneyard, turn, players, board }) => {
  console.log('Game started:', { hands, boneyard, turn, players, board });
  console.log('Received hands:', hands);
  console.log('Current turn:', turn);
  console.log('Players:', players);
  playerIdx = players.findIndex(p => p.id === socket.id);
  
  document.getElementById('waitingRoom').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';

  updateHand(hands[playerIdx], turn);
  updateBoneyard(boneyard);
  updateBoard(board);
  updatePlayers(players);
  updateTurnMessage(turn, players);
});

socket.on('update', ({ board, hands, boneyard, turn, players }) => {
  console.log('Game update:', { board, hands, boneyard, turn, players });
  updateBoard(board);
  updateHand(hands[playerIdx], turn);
  updateBoneyard(boneyard);
  updateTurnMessage(turn, players);
  const canPlay = hands[playerIdx].some(tile => canPlayTile(tile, board));
  document.getElementById('drawTile').style.display = (turn === playerIdx && !canPlay && boneyard.length > 0) ? 'block' : 'none';
  document.getElementById('skipTurn').style.display = (turn === playerIdx && !canPlay && boneyard.length === 0) ? 'block' : 'none';
});

function skipTurn() {
  socket.emit('skipTurn', { roomId });
}

socket.on('roundEnd', ({ scores, short }) => {
  document.getElementById('scores').style.display = 'block';
  document.getElementById('scores').innerHTML = scores.map((s, i) => `Player ${i + 1}: ${s}`).join('<br>');
  if (short) {
    alert('Round ended due to a short! No players can make a legal move.');
  }
});

socket.on('gameEnd', ({ scores }) => {
  const winner = scores.indexOf(Math.min(...scores));
  alert(`Game Over! Winner: Player ${winner + 1}`);
});

function updateHand(hand, turn) {
  const handDiv = document.getElementById('hand');
  const isMyTurn = turn === playerIdx;
  handDiv.innerHTML = hand.map(t => `
    <div class="tile ${isMyTurn ? 'active' : 'inactive'}" 
         ${isMyTurn ? `onclick="playTile([${t}], getBoard())"` : ''}>
      ${t[0]}|${t[1]}
    </div>
  `).join('');
  console.log('Updated hand:', hand);
}

function updateTurnMessage(turn, players) {
  const turnMessage = document.getElementById('turnMessage');
  turnMessage.innerText = `${players[turn].name}'s turn`;
}

function updateBoard(board) {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = board.map(b => `<div class="tile played">${b.tile[0]}|${b.tile[1]}</div>`).join('');
  console.log('Updated board:', board); // Log to verify the board state
}

function updatePlayers(players) {
  document.getElementById('players').innerHTML = players.map(p => `<p>${p.name}</p>`).join('');
}

function updateBoneyard(boneyard) {
  const boneyardDiv = document.getElementById('boneyard');
  const boneyardTiles = document.getElementById('boneyardTiles');
  boneyardDiv.style.display = boneyard.length > 0 ? 'block' : 'none';
  boneyardTiles.innerHTML = boneyard.length > 0 ? `<p>${boneyard.length} tiles remaining</p>` : '';
  console.log('Boneyard count:', boneyard.length);
}

function canPlayTile(tile, board) {
  if (board.length === 0) return true; // First tile can always be played

  // Get the left and right ends of the board
  const leftTile = board[0].tile;
  const rightTile = board[board.length - 1].tile;
  const leftEnd = leftTile[0]; // Leftmost number
  const rightEnd = rightTile[1]; // Rightmost number

  // Check if the tile can be played on the left end
  const canPlayLeft = (leftTile[0] === leftTile[1]) // If left tile is a double (e.g., [2|2])
    ? (tile[0] === leftEnd || tile[1] === leftEnd) // Can play [2|any] or [any|2]
    : (tile[1] === leftEnd); // Otherwise, must match the left end with the tile's second number (e.g., [5|4] -> [any|5])

  // Check if the tile can be played on the right end
  const canPlayRight = (rightTile[0] === rightTile[1]) // If right tile is a double (e.g., [2|2])
    ? (tile[0] === rightEnd || tile[1] === rightEnd) // Can play [2|any] or [any|2]
    : (tile[0] === rightEnd); // Otherwise, must match the right end with the tile's first number (e.g., [5|4] -> [4|any])

  return canPlayLeft || canPlayRight;
}

function playTile(tile, board) {
  if (board.length === 0) {
    socket.emit('play', { roomId, tile, end: 'right' }); // First tile goes to the right
    return;
  }

  // Determine which end to play on
  const leftTile = board[0].tile;
  const rightTile = board[board.length - 1].tile;
  const leftEnd = leftTile[0];
  const rightEnd = rightTile[1];

  let end = null;
  let orientedTile = [...tile];
  // Check left end
  if (leftTile[0] === leftTile[1]) { // Double on left (e.g., [6|6])
    if (tile[0] === leftEnd) {
      end = 'left';
      orientedTile = [tile[0], tile[1]]; // [6|3] stays as [6|3]
    } else if (tile[1] === leftEnd) {
      end = 'left';
      orientedTile = [tile[1], tile[0]]; // [6|3] becomes [3|6] to connect 6 to 6
    }
  } else if (tile[1] === leftEnd) {
    end = 'left';
    orientedTile = [tile[0], tile[1]]; // Keep orientation
  }

  // Check right end
  if (rightTile[0] === rightTile[1]) { // Double on right (e.g., [6|6])
    if (tile[0] === rightEnd) {
      end = 'right';
      orientedTile = [tile[0], tile[1]]; // [6|3] stays as [6|3]
    } else if (tile[1] === rightEnd) {
      end = 'right';
      orientedTile = [tile[1], tile[0]]; // [6|3] becomes [3|6]
    }
  } else if (tile[0] === rightEnd) {
    end = 'right';
    orientedTile = [tile[0], tile[1]]; // Keep orientation
  }

  if (end) {
    socket.emit('play', { roomId, tile: orientedTile, end });
  } else {
    console.log('Cannot play this tile');
  }
}

function updateHand(hand) {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = hand.map(t => `<div class="tile" onclick="playTile([${t}], getBoard())">${t[0]}|${t[1]}</div>`).join('');
}

function getBoard() {
  const boardDiv = document.getElementById('board');
  const tiles = boardDiv.getElementsByClassName('tile');
  return Array.from(tiles).map(tile => {
    const [left, right] = tile.innerText.split('|').map(Number);
    return { tile: [left, right] };
  });
}

function drawTile() {
  socket.emit('drawTile', { roomId });
}