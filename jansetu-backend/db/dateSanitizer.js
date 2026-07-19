function sanitizeRecordDates(obj) {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeRecordDates);
  
  if (obj.year && obj.year.low !== undefined && obj.month && obj.month.low !== undefined) {
    // Looks like a Neo4j Date/DateTime
    const { year, month, day, hour, minute, second } = obj;
    try {
      return new Date(year.low, month.low - 1, day.low, hour?.low || 0, minute?.low || 0, second?.low || 0).toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }

  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      newObj[key] = sanitizeRecordDates(obj[key]);
    }
  }
  return newObj;
}
module.exports = { sanitizeRecordDates };
