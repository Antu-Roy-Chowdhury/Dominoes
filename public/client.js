const socket = io({ transports: ['polling'] });
let roomId, playerIdx;

function joinGame() {
  const name = document.getElementById('playerName').value || 'Player';
  roomId = new URLSearchParams(window.location.search).get('room');
  
  if (roomId) {
    document.getElementById('playerCount').style.display = 'none';
    socket.emit('join', { roomId, name });
  } else {
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
  document.getElementById('joinSection').style.display = 'none';
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
  document.getElementById('roundScoresPopup').style.display = 'none'; // Hide popup on new match

  updateHand(hands[playerIdx], turn, board, hands[playerIdx], true);
  updateBoneyard(boneyard);
  updateBoard(board);
  updatePlayers(players);
  updateTurnMessage(turn, players);
});

socket.on('update', ({ board, hands, boneyard, turn, players }) => {
  console.log('Game update:', { board, hands, boneyard, turn, players });
  console.log('Player hand before update:', hands[playerIdx]);
  updateBoard(board);
  updateHand(hands[playerIdx], turn, board, hands[playerIdx], false);
  updateBoneyard(boneyard);
  updateTurnMessage(turn, players);
  const canPlay = hands[playerIdx].some(tile => canPlayTile(tile, board));
  document.getElementById('drawTile').style.display = (turn === playerIdx && !canPlay && boneyard.length > 0) ? 'block' : 'none';
  document.getElementById('skipTurn').style.display = (turn === playerIdx && !canPlay && boneyard.length === 0) ? 'block' : 'none';
});

socket.on('roundEnd', ({ scores, roundScores, short, tempLeader }) => {
  document.getElementById('scores').style.display = 'block';
  document.getElementById('scores').innerHTML = scores.map((s, i) => `Player ${i + 1}: ${s}`).join('<br>');
  if (short) {
    alert('Round ended due to a short! No players can make a legal move.');
  }

  // Show round scores in a popup for 5 seconds
  const popup = document.getElementById('roundScoresPopup');
  const content = document.getElementById('roundScoresContent');
  content.innerHTML = roundScores.map((s, i) => `Player ${i + 1} (${players[i].name}): ${s} points`).join('<br>');
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 5000);

  // Add event listener to start new match
  document.getElementById('startNewMatch').onclick = () => {
    socket.emit('startNewMatch', { roomId });
  };
});

socket.on('gameEnd', ({ scores }) => {
  const winner = scores.indexOf(Math.min(...scores));
  alert(`Game Over! Winner: Player ${winner + 1}`);
});

function updateHand(hand, turn, board, currentHand, isFirstTurn) {
  const handDiv = document.getElementById('hand');
  const isMyTurn = turn === playerIdx;
  handDiv.innerHTML = hand.map(t => {
    const canPlay = isFirstTurn ? (t[0] === t[1]) : canPlayTile(t, board); // First turn: must play a double
    return `
      <div class="tile ${isMyTurn ? 'active' : 'inactive'} ${isMyTurn && canPlay ? 'playable' : 'non-playable'}" 
           ${isMyTurn && canPlay ? `onclick="playTile([${t}], getBoard())"` : ''}>
        ${t[0]}|${t[1]}
      </div>
    `;
  }).join('');
  console.log('Updated hand:', hand);
}

function updateBoard(board) {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = board.map(b => `<div class="tile played">${b.tile[0]}|${b.tile[1]}</div>`).join('');
  console.log('Updated board:', board);
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

function updateTurnMessage(turn, players) {
  const turnMessage = document.getElementById('turnMessage');
  turnMessage.innerText = `${players[turn].name}'s turn`;
}

function canPlayTile(tile, board) {
  if (board.length === 0) return true;
  const leftTile = board[0].tile;
  const rightTile = board[board.length - 1].tile;
  const leftEnd = leftTile[0];
  const rightEnd = rightTile[1];

  const canPlayLeft = leftTile[0] === leftTile[1]
    ? (tile[0] === leftEnd || tile[1] === leftEnd)
    : (tile[0] === leftEnd || tile[1] === leftEnd); // Allow either number to match
  const canPlayRight = rightTile[0] === rightTile[1]
    ? (tile[0] === rightEnd || tile[1] === rightEnd)
    : (tile[0] === rightEnd || tile[1] === rightEnd); // Allow either number to match

  return canPlayLeft || canPlayRight;
}

function playTile(tile, board) {
  if (board.length === 0) {
    socket.emit('play', { roomId, tile, end: 'right' });
    return;
  }

  const leftTile = board[0].tile;
  const rightTile = board[board.length - 1].tile;
  const leftEnd = leftTile[0];
  const rightEnd = rightTile[1];

  // Check if the tile can be played on both ends
  const canPlayLeft = leftTile[0] === leftTile[1]
    ? (tile[0] === leftEnd || tile[1] === leftEnd)
    : (tile[0] === leftEnd || tile[1] === leftEnd);
  const canPlayRight = rightTile[0] === rightTile[1]
    ? (tile[0] === rightEnd || tile[1] === rightEnd)
    : (tile[0] === rightEnd || tile[1] === rightEnd);

  // Orient the tile based on the chosen end
  const orientTile = (end) => {
    let orientedTile = [...tile];
    if (end === 'left') {
      if (leftTile[0] === leftTile[1]) {
        if (tile[0] === leftEnd) orientedTile = [tile[1], tile[0]]; // [6|3] -> [3|6]
      } else {
        if (tile[0] === leftEnd) orientedTile = [tile[1], tile[0]]; // [1|3] -> [3|1]
      }
    } else if (end === 'right') {
      if (rightTile[0] === rightTile[1]) {
        if (tile[1] === rightEnd) orientedTile = [tile[1], tile[0]]; // [5|6] -> [6|5]
      } else {
        if (tile[1] === rightEnd) orientedTile = [tile[1], tile[0]]; // [5|6] -> [6|5]
      }
    }
    return orientedTile;
  };

  // If the tile can be played on both ends, let the player choose
  if (canPlayLeft && canPlayRight) {
    const choice = prompt('Tile can be played on both ends. Type "left" or "right" to choose:');
    if (choice && (choice.toLowerCase() === 'left' || choice.toLowerCase() === 'right')) {
      const end = choice.toLowerCase();
      const orientedTile = orientTile(end);
      socket.emit('play', { roomId, tile: orientedTile, end });
    } else {
      console.log('Invalid choice, defaulting to right');
      const orientedTile = orientTile('right');
      socket.emit('play', { roomId, tile: orientedTile, end: 'right' });
    }
  } else if (canPlayLeft) {
    const orientedTile = orientTile('left');
    socket.emit('play', { roomId, tile: orientedTile, end: 'left' });
  } else if (canPlayRight) {
    const orientedTile = orientTile('right');
    socket.emit('play', { roomId, tile: orientedTile, end: 'right' });
  } else {
    console.log('Cannot play this tile');
  }
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

function skipTurn() {
  socket.emit('skipTurn', { roomId });
}