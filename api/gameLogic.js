function dealTiles(playerCount) {
  const tiles = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
  tiles.sort(() => Math.random() - 0.5);
  const hands = Array(playerCount).fill().map(() => []);
  for (let i = 0; i < 7 * playerCount; i++) {
    hands[i % playerCount].push(tiles[i]);
  }
  const boneyard = tiles.slice(7 * playerCount);
  return { hands, boneyard };
}

function getStartingPlayer(hands) {
  let maxDouble = -1;
  let startingPlayer = 0;
  hands.forEach((hand, idx) => {
    hand.forEach(tile => {
      if (tile[0] === tile[1] && tile[0] > maxDouble) {
        maxDouble = tile[0];
        startingPlayer = idx;
      }
    });
  });
  return startingPlayer;
}

function calculateScores(hands, board, boneyard, playerCount) {
  if (hands.some(h => h.length === 0)) {
    console.log('Round ended: A player has no tiles left');
    const scores = hands.map(h => h.reduce((sum, t) => sum + t[0] + t[1], 0));
    const winner = hands.findIndex(h => h.length === 0);
    const total = scores.reduce((sum, s) => sum + s, 0);
    return scores.map((s, i) => i === winner ? total - s : 0);
  }

  if (boneyard.length === 0 && hands.every(h => h.length > 0)) {
    console.log('Boneyard is empty, checking if players can play...');
    console.log('Board:', board);
    console.log('Hands:', hands);
    const canPlay = hands.map((h, idx) => {
      const canPlayTile = h.some(t => {
        if (board.length === 0) return true;
        const left = board[0].tile[0];
        const right = board[board.length - 1].tile[1];
        const canMatch = t[0] === left || t[1] === left || t[0] === right || t[1] === right;
        console.log(`Player ${idx} tile ${t}: can match ${left} or ${right}? ${canMatch}`);
        return canMatch;
      });
      console.log(`Player ${idx} can play: ${canPlayTile}`);
      return canPlayTile;
    });

    if (!canPlay.some(Boolean)) {
      console.log('No players can play, ending round with a short');
      const scores = hands.map(h => h.reduce((sum, t) => sum + t[0] + t[1], 0));
      const minScore = Math.min(...scores);
      const winner = scores.indexOf(minScore);
      const total = scores.reduce((sum, s) => sum + s, 0);
      return scores.map((s, i) => i === winner ? total - s : 0);
    }
  }

  console.log('Round continues');
  return null;
}

module.exports = { dealTiles, getStartingPlayer, calculateScores };