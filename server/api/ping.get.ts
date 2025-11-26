export default defineEventHandler(() => {
  return { ok: true, timestamp: new Date().toISOString() };
});
