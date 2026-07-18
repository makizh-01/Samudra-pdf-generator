/** Date formatting helpers for report placeholders. */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

module.exports = {
  // "5th May 2026"
  long(d) {
    const dt = d ? new Date(d) : new Date();
    return `${ordinal(dt.getDate())} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  },
  // "05.05.2026"
  short(d) {
    const dt = d ? new Date(d) : new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  },
};
