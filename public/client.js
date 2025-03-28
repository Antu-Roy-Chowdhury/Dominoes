const socket = io('/', { transports: ['polling'] }); // Updated for Railway deployment
let roomId, playerIdx, players, currentTurn;

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

function copyRoomLink() {
  const url = document.getElementById('roomLink').href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Room link copied to clipboard!');
  });
}

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('roomJoined', ({ roomId, url }) => {
  console.log(`Room joined: ${roomId}, URL: ${url}`);
  const roomLink = document.getElementById('roomLink');
  roomLink.href = url;
  roomLink.innerText = url;
  document.getElementById('copyLink').style.display = 'inline-block';
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
  this.players = players;
  currentTurn = turn;
  
  document.getElementById('waitingRoom').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';
  document.getElementById('roundScoresPopup').style.display = 'none';

  const chatInput = document.getElementById('chatInput');
  const chatButton = document.querySelector('#chatInputContainer button');
  chatInput.disabled = false;
  chatInput.placeholder = 'Type a message...';
  chatButton.disabled = false;

  updateHand(hands[playerIdx], turn, board, hands[playerIdx], true);
  updateBoneyard(boneyard);
  updateBoard(board);
  updatePlayers(players);
  updateTurnMessage(turn, players);

  const pairs = hands[playerIdx].filter(tile => tile[0] === tile[1]).length;
  document.getElementById('reshuffleButton').style.display = pairs >= 5 ? 'block' : 'none';
});

socket.on('update', ({ board, hands, boneyard, turn, players }) => {
  console.log('Game update:', { board, hands, boneyard, turn, players });
  console.log('Player hand before update:', hands[playerIdx]);
  this.players = players;
  currentTurn = turn;
  updateBoard(board);
  updateHand(hands[playerIdx], turn, board, hands[playerIdx], false);
  updateBoneyard(boneyard);
  updateTurnMessage(turn, players);
  const canPlay = hands[playerIdx].some(tile => canPlayTile(tile, board));
  document.getElementById('drawTile').style.display = (turn === playerIdx && !canPlay && boneyard.length > 0) ? 'block' : 'none';
  document.getElementById('skipTurn').style.display = (turn === playerIdx && !canPlay && boneyard.length === 0) ? 'block' : 'none';
});

socket.on('roundEnd', ({ scores, roundScores, short, tempLeader, players }) => {
  document.getElementById('scores').style.display = 'block';
  document.getElementById('scores').innerHTML = scores.map((s, i) => `${players[i].name}: ${s}`).join('<br>');
  if (short) {
    alert('Round ended due to a short! No players can make a legal move. Starting new match...');
  }

  const popup = document.getElementById('roundScoresPopup');
  const content = document.getElementById('roundScoresContent');
  content.innerHTML = roundScores.map((s, i) => `${players[i].name}: ${s} points`).join('<br>');
  popup.style.display = 'block';
  if (!short) {
    setTimeout(() => {
      popup.style.display = 'none';
    }, 5000);
  }

  if (!short) {
    document.getElementById('startNewMatch').onclick = () => {
      socket.emit('startNewMatch', { roomId });
    };
  } else {
    document.getElementById('startNewMatch').style.display = 'none';
  }
});

socket.on('gameEnd', ({ scores }) => {
  const winner = scores.indexOf(Math.min(...scores));
  alert(`Game Over! Winner: ${players[winner].name}`);
});

socket.on('reshuffled', ({ hands, boneyard }) => {
  updateHand(hands[playerIdx], currentTurn, getBoard(), hands[playerIdx], true);
  updateBoneyard(boneyard);
  document.getElementById('reshuffleButton').style.display = 'none';
});

socket.on('chatMessage', ({ playerName, message }) => {
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.innerHTML += `<p><strong>${playerName}:</strong> ${message}</p>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function updateHand(hand, turn, board, currentHand, isFirstTurn) {
  const handDiv = document.getElementById('hand');
  const isMyTurn = turn === playerIdx;
  handDiv.innerHTML = hand.map(t => {
    const canPlay = isFirstTurn ? (t[0] === t[1]) : canPlayTile(t, board);
    return `
      <div class="tile ${isMyTurn ? 'active' : 'inactive'} ${isMyTurn && canPlay ? 'playable' : 'non-playable'}" 
           data-tile="[${t}]">
        ${t[0]}|${t[1]}
      </div>
    `;
  }).join('');
  console.log('Updated hand:', hand);

  // Add touch event listeners for mobile
  const tiles = handDiv.getElementsByClassName('tile');
  Array.from(tiles).forEach(tile => {
    if (tile.classList.contains('playable')) {
      tile.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling on touch
        const tileData = JSON.parse(tile.getAttribute('data-tile'));
        playTile(tileData, board);
      });
      tile.addEventListener('click', (e) => {
        const tileData = JSON.parse(tile.getAttribute('data-tile'));
        playTile(tileData, board);
      });
    }
  });
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
    : (tile[0] === leftEnd || tile[1] === leftEnd);
  const canPlayRight = rightTile[0] === rightTile[1]
    ? (tile[0] === rightEnd || tile[1] === rightEnd)
    : (tile[0] === rightEnd || tile[1] === rightEnd);

  return canPlayLeft || canPlayRight;
}

function playTile(tile, board) {
  if (board.length === 0) {
    socket.emit('play', { roomId, tile, end: 'right', originalTile: tile });
    return;
  }

  const leftTile = board[0].tile;
  const rightTile = board[board.length - 1].tile;
  const leftEnd = leftTile[0];
  const rightEnd = rightTile[1];

  const canPlayLeft = leftTile[0] === leftTile[1]
    ? (tile[0] === leftEnd || tile[1] === leftEnd)
    : (tile[0] === leftEnd || tile[1] === leftEnd);
  const canPlayRight = rightTile[0] === rightTile[1]
    ? (tile[0] === rightEnd || tile[1] === rightEnd)
    : (tile[0] === rightEnd || tile[1] === rightEnd);

  const orientTile = (end) => {
    let orientedTile = [...tile];
    if (end === 'left') {
      if (leftTile[0] === leftTile[1]) {
        if (tile[0] === leftEnd) orientedTile = [tile[1], tile[0]];
      } else {
        if (tile[0] === leftEnd) orientedTile = [tile[1], tile[0]];
      }
    } else if (end === 'right') {
      if (rightTile[0] === rightTile[1]) {
        if (tile[1] === rightEnd) orientedTile = [tile[1], tile[0]];
      } else {
        if (tile[1] === rightEnd) orientedTile = [tile[1], tile[0]];
      }
    }
    return orientedTile;
  };

  if (canPlayLeft && canPlayRight) {
    const overlay = document.getElementById('sideChoiceOverlay');
    const tileDisplay = document.getElementById('sideChoiceTile');
    tileDisplay.innerText = `Tile: ${tile[0]}|${tile[1]}`;
    overlay.style.display = 'block';

    const playLeft = () => {
      const orientedTile = orientTile('left');
      socket.emit('play', { roomId, tile: orientedTile, end: 'left', originalTile: tile });
      overlay.style.display = 'none';
    };
    const playRight = () => {
      const orientedTile = orientTile('right');
      socket.emit('play', { roomId, tile: orientedTile, end: 'right', originalTile: tile });
      overlay.style.display = 'none';
    };
    const cancel = () => {
      overlay.style.display = 'none';
    };

    document.getElementById('playLeft').onclick = playLeft;
    document.getElementById('playLeft').ontouchstart = (e) => {
      e.preventDefault();
      playLeft();
    };
    document.getElementById('playRight').onclick = playRight;
    document.getElementById('playRight').ontouchstart = (e) => {
      e.preventDefault();
      playRight();
    };
    document.getElementById('cancelChoice').onclick = cancel;
    document.getElementById('cancelChoice').ontouchstart = (e) => {
      e.preventDefault();
      cancel();
    };
  } else if (canPlayLeft) {
    const orientedTile = orientTile('left');
    socket.emit('play', { roomId, tile: orientedTile, end: 'left', originalTile: tile });
  } else if (canPlayRight) {
    const orientedTile = orientTile('right');
    socket.emit('play', { roomId, tile: orientedTile, end: 'right', originalTile: tile });
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

function requestReshuffle() {
  socket.emit('reshuffle', { roomId });
}

function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (message && players && typeof playerIdx !== 'undefined') {
    const playerName = players[playerIdx].name;
    socket.emit('chatMessage', { roomId, message, playerName });
    chatInput.value = '';
  } else {
    alert('Chat is not available yet. Please wait for the game to start.');
  }
}

// Add Enter key listener for chat input on mobile
document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});