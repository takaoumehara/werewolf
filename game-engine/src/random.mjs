export function normalizeSeed(seed) {
  const value = Number(seed);
  if (!Number.isFinite(value)) throw new TypeError("seed must be a finite number");
  return (Math.trunc(value) >>> 0) || 0x9e3779b9;
}

export function seededShuffle(values, seed) {
  const result = [...values];
  let state = normalizeSeed(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
