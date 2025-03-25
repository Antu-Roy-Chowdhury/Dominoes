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

function dealTiles() {
  const shuffled = shuffle([...tiles]);
  return [shuffled.slice(0, 7), shuffled.slice(7, 14), shuffled.slice(14, 21), shuffled.slice(21)];
}

function getStartingPlayer(hands) {
  return hands.findIndex(hand => hand.some(([a, b]) => a === 6 && b === 6));
}

function calculateScores(hands) {
  return hands.map(hand => hand.reduce((sum, [a, b]) => sum + a + b, 0));
}

module.exports = { dealTiles, getStartingPlayer, calculateScores };