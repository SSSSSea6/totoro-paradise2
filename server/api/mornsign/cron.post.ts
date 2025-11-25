import { runDueMorningTasks } from '../../utils/morningSignScheduler';
import { isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event).catch(() => ({}));
  const limit = body?.limit && Number.isFinite(Number(body.limit)) ? Number(body.limit) : 100;

  const result = await runDueMorningTasks(limit);
  return { success: true, ...result };
});
