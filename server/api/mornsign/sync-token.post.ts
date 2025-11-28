import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

type SyncBody = {
  userId?: string;
  token?: string;
};

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = (await readBody<SyncBody>(event).catch(() => ({}))) || {};
  const { userId, token } = body;

  if (!userId || !token) {
    return { success: false, message: '缺少必要参数' };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('morning_sign_tasks')
    .update({ token })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('[mornsign] sync token failed', error);
    return { success: false, message: error.message };
  }

  return { success: true };
});
