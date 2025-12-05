import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

type SyncBody = {
  userId?: string;
  token?: string;
};

const maskToken = (token?: string) => {
  if (!token) return token;
  if (token.length <= 8) return `${token.slice(0, 2)}***${token.slice(-2)}`;
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
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
  const { data, error } = await supabase
    .from('morning_sign_tasks')
    .update({ token })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[mornsign] sync token failed', error);
    return { success: false, message: error.message };
  }

  const updated = data?.length || 0;
  console.info('[mornsign] sync token ok', {
    userId,
    updated,
    maskedToken: maskToken(token),
  });

  return { success: true };
});
