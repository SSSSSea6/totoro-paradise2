import {
  runDueMorningTasks,
  fetchEarliestPendingPerUser,
  refreshTokenForUserTask,
} from '../utils/morningSignScheduler';
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
  const nextTokenRefreshInterval = () => 30 * 60 * 1000 + Math.random() * 10 * 60 * 1000; // 30-40min
  let isRunning = false;
  let lastTokenRefresh = 0;
  let currentTokenRefreshInterval = nextTokenRefreshInterval();
  let tokenRefreshTimers: ReturnType<typeof setTimeout>[] = [];
  let isPlanningRefresh = false;

  const scheduleTokenRefreshWave = async () => {
    tokenRefreshTimers.forEach((t) => clearTimeout(t));
    tokenRefreshTimers = [];

    const windowMs = currentTokenRefreshInterval;
    const perUserEarliest = await fetchEarliestPendingPerUser();
    if (perUserEarliest.size === 0) return;

    for (const task of perUserEarliest.values()) {
      const delay = Math.random() * windowMs;
      const timer = setTimeout(() => {
        refreshTokenForUserTask(task).catch((err) =>
          console.error('[morning-scheduler] staggered refresh failed', err),
        );
      }, delay);
      tokenRefreshTimers.push(timer);
    }
  };

  const tick = async () => {
    console.log('[scheduler] tick');
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await runDueMorningTasks(BATCH_LIMIT);
      if (result.processed > 0) {
        console.log(
          `[morning-scheduler] processed ${result.processed}, success: ${result.success}, failed: ${result.failed}`,
        );
      }

      const now = Date.now();
      if (!isPlanningRefresh && now - lastTokenRefresh >= currentTokenRefreshInterval) {
        isPlanningRefresh = true;
        lastTokenRefresh = now;
        await scheduleTokenRefreshWave();
        currentTokenRefreshInterval = nextTokenRefreshInterval();
        isPlanningRefresh = false;
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
