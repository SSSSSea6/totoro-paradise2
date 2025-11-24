import normalizeSession from '~/src/utils/normalizeSession';

export default defineNuxtPlugin(() => {
  const session = useSession();
  const STORAGE_KEY = 'totoroSession';

  if (process.client) {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && !session.value?.token) {
      try {
        const parsed = JSON.parse(cached);
        session.value = normalizeSession(parsed) as any;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  watch(
    () => session.value,
    (val) => {
      if (!process.client) return;
      if (val && (val as any).token) {
        const normalized = normalizeSession(val as any);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    { deep: true },
  );
});
