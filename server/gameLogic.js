const tiles = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) tiles.push([i, j]);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function dealTiles(numPlayers) {
  const shuffled = shuffle([...tiles]);
  const hands = [];
  const tilesPerPlayer = 7;
  const totalTilesDealt = numPlayers * tilesPerPlayer;

  for (let i = 0; i < numPlayers; i++) {
    hands.push(shuffled.slice(i * tilesPerPlayer, (i + 1) * tilesPerPlayer));
  }

  const boneyard = shuffled.slice(totalTilesDealt);
  return { hands, boneyard };
}

function getStartingPlayer(hands) {
  // Find the player with the highest double
  for (let double = 6; double >= 0; double--) {
    const doubleTile = [double, double];
    const playerIdx = hands.findIndex(hand => hand.some(([a, b]) => a === doubleTile[0] && b === doubleTile[1]));
    if (playerIdx !== -1) {
      return playerIdx;
    }
  }
  return 0; // Default to player 0 if no doubles (shouldn't happen)
}

function calculateScores(hands) {
  return hands.map(hand => hand.reduce((sum, [a, b]) => sum + a + b, 0));
}

module.exports = { dealTiles, getStartingPlayer, calculateScores };