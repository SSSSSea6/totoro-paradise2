import { runDueMorningTasks } from '../utils/morningSignScheduler';
import { isSupabaseConfigured } from '../utils/supabaseAdminClient';

export default defineNitroPlugin((nitroApp) => {
  if (!isSupabaseConfigured()) {
    console.warn('[morning-scheduler] Supabase env missing, scheduler disabled.');
    return;
  }

  const tick = async () => {
    try {
      const result = await runDueMorningTasks();
      if (result.processed > 0) {
        console.log(
          `[morning-scheduler] processed ${result.processed}, success: ${result.success}, failed: ${result.failed}`,
        );
      }
    } catch (error) {
      console.error('[morning-scheduler] execution failed', error);
    }
  };

  const interval = setInterval(tick, 60_000);
  nitroApp.hooks.hookOnce('close', () => clearInterval(interval));
  tick();
});
