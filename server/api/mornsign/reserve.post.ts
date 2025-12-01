import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { token, userId, signPoint, scheduledTime, deviceInfo } = body || {};

  if (!token || !userId || !signPoint || !scheduledTime) {
    return { success: false, message: '缺少必要参数' };
  }

  const supabase = getSupabaseAdminClient();

  const parsed = new Date(scheduledTime);
  if (Number.isNaN(parsed.getTime())) {
    return { success: false, message: '预约时间无效' };
  }
  const scheduledIso = parsed.toISOString();

  // 同一天仅可预约一次（按预约时间所在日）
  const startOfDay = new Date(parsed);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: existsTask, error: existsError } = await supabase
    .from('morning_sign_tasks')
    .select('id')
    .eq('user_id', userId)
    .gte('scheduled_time', startOfDay.toISOString())
    .lte('scheduled_time', endOfDay.toISOString())
    .limit(1)
    .maybeSingle();

  if (!existsError && existsTask) {
    return { success: false, message: '同一天只能预约一次' };
  }

  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (creditError && creditError.code !== 'PGRST116') {
    return { success: false, message: '读取余额失败' };
  }

  const credits = creditData?.credits ?? 0;
  if (credits < 1) {
    return { success: false, message: '余额不足' };
  }

  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ credits: credits - 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (deductError) {
    return { success: false, message: '扣费失败，请重试' };
  }

  const { error: insertError } = await supabase.from('morning_sign_tasks').insert({
    user_id: userId,
    token,
    device_info: deviceInfo || null,
    sign_point: signPoint,
    scheduled_time: scheduledIso,
    status: 'pending',
  });

  if (insertError) {
    return { success: false, message: `预约失败: ${insertError.message}` };
  }

  return { success: true, message: '预约成功', scheduledTime: scheduledIso };
});
