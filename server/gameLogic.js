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
  const shuffled = shuffle([...tiles]); // Create a fresh copy of tiles
  const hands = [];
  const tilesPerPlayer = 7;
  const totalTilesDealt = numPlayers * tilesPerPlayer;

  // Deal 7 tiles to each player
  for (let i = 0; i < numPlayers; i++) {
    hands.push(shuffled.slice(i * tilesPerPlayer, (i + 1) * tilesPerPlayer));
  }

  // Remaining tiles go to the boneyard
  const boneyard = shuffled.slice(totalTilesDealt);

  return { hands, boneyard };
}

function getStartingPlayer(hands) {
  return hands.findIndex(hand => hand.some(([a, b]) => a === 6 && b === 6));
}

function calculateScores(hands) {
  return hands.map(hand => hand.reduce((sum, [a, b]) => sum + a + b, 0));
}

module.exports = { dealTiles, getStartingPlayer, calculateScores };