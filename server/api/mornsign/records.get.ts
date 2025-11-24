import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { records: [] };
  }
  const userId = getQuery(event).userId as string;
  if (!userId) {
    return { records: [] };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('morning_sign_tasks')
    .select('id, scheduled_time, status, result_log, created_at')
    .eq('user_id', userId)
    .order('scheduled_time', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[records] fetch failed', error);
    return { records: [] };
  }

  return { records: data || [] };
});
