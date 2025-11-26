import { runDueMorningTasks } from '../utils/morningSignScheduler';
import { isSupabaseConfigured } from '../utils/supabaseAdminClient';

export default defineNitroPlugin((nitroApp) => {
  // 简单的构建提示，方便在日志中确认是否为最新部署
  const pkgVersion = process.env.npm_package_version || 'unknown';
  const buildTag = process.env.BUILD_ID || new Date().toISOString();
  console.log(`[build-info] version=${pkgVersion} build=${buildTag}`);

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
