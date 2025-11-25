import { runDueMorningTasks } from '../utils/morningSignScheduler';
import { isSupabaseConfigured } from '../utils/supabaseAdminClient';

export default defineNitroPlugin((nitroApp) => {
  if (!isSupabaseConfigured()) {
    console.warn('[morning-scheduler] Supabase env missing, scheduler disabled.');
    return;
  }

  const INTERVAL_MS = 5_000;
  const BATCH_LIMIT = 100;
  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await runDueMorningTasks(BATCH_LIMIT);
      if (result.processed > 0) {
        console.log(
          `[morning-scheduler] processed ${result.processed}, success: ${result.success}, failed: ${result.failed}`,
        );
      }
    } catch (error) {
      console.error('[morning-scheduler] execution failed', error);
    } finally {
      isRunning = false;
    }
  };

  const interval = setInterval(tick, INTERVAL_MS);
  nitroApp.hooks.hookOnce('close', () => clearInterval(interval));
  tick();
});
