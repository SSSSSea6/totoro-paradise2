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

  // 调试：降低调度频率，取消 5s tick，改为每 1 分钟一次
  const INTERVAL_MS = 60_000;
  const BATCH_LIMIT = 100;
  // 调试：token 刷新周期固定 1 分钟
  const nextTokenRefreshInterval = () => 60 * 1000;
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

    console.info('[morning-scheduler] planning token refresh wave', {
      users: perUserEarliest.size,
      windowMs,
    });

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

  const runLoop = async () => {
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

  const interval = setInterval(runLoop, INTERVAL_MS);
  nitroApp.hooks.hookOnce('close', () => clearInterval(interval));
  runLoop();
});
