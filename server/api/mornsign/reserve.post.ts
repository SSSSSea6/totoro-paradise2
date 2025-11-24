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

  // 防止同一天重复预约
  const dayStart = new Date(scheduledTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { count: existingCount, error: existingError } = await supabase
    .from('morning_sign_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('scheduled_time', dayStart.toISOString())
    .lt('scheduled_time', dayEnd.toISOString());

  if (!existingError && (existingCount ?? 0) > 0) {
    return { success: false, message: '今天已预约过，请勿重复预约' };
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
    scheduled_time: scheduledTime,
    status: 'pending',
  });

  if (insertError) {
    return { success: false, message: `预约失败: ${insertError.message}` };
  }

  return { success: true, message: '预约成功' };
});
