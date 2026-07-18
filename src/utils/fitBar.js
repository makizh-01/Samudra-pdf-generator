/** Text-based fit bar used inside the DOCX industry table (14 blocks). */
module.exports = function fitBar(pct, blocks = 14) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const full = Math.round((p / 100) * blocks);
  return '▰'.repeat(full) + '▱'.repeat(blocks - full);
};
