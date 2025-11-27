import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';
import type MornSignPoint from '~~/src/types/MornSignPoint';
import type SubmitMornSignRequest from '~~/src/types/requestTypes/SubmitMornSignRequest';
import type SubmitMorningExercisesResponse from '~~/src/types/responseTypes/SubmitMorningExercisesResponse';
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabaseAdminClient';
import type GetMornSignPaperResponse from '~~/src/types/responseTypes/GetMornSignPaperResponse';
import type BasicRequest from '~~/src/types/requestTypes/BasicRequest';

type MorningTaskRow = {
  id: number;
  user_id: string;
  token: string;
  device_info?: Record<string, any> | null;
  sign_point?: Record<string, any> | null;
  scheduled_time: string;
  status: string;
};

type ProcessResult = {
  processed: number;
  success: number;
  failed: number;
};

const isSuccessfulResponse = (res?: SubmitMorningExercisesResponse | null) => {
  if (!res) return false;
  // 仅当状态码和返回码都符合预期时才认为成功
  return res.status === '00' && res.code === '0';
};

const maskToken = (token?: string | null) => {
  if (!token) return token;
  if (token.length <= 10) return '***';
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
};

const buildRequestFromTask = (task: MorningTaskRow, signPoint?: Partial<MornSignPoint>): SubmitMornSignRequest => {
  const point = (signPoint || task.sign_point || {}) as Partial<MornSignPoint>;
  const deviceInfo = (task.device_info || {}) as Record<string, any>;

  if (!point.taskId || !point.pointId) {
    throw new Error('Missing sign point information on task.');
  }

  return {
    token: task.token,
    campusId: deviceInfo.campusId ?? '',
    schoolId: deviceInfo.schoolId ?? '',
    stuNumber: task.user_id,
    latitude: String(point.latitude ?? ''),
    longitude: String(point.longitude ?? ''),
    taskId: String(point.taskId ?? ''),
    pointId: String(point.pointId ?? ''),
    qrCode: point.qrCode,
    deviceType: deviceInfo.deviceType ?? '2',
    phoneNumber: deviceInfo.phoneNumber,
  };
};

export const runDueMorningTasks = async (limit = 100): Promise<ProcessResult> => {
  if (!isSupabaseConfigured()) {
    return { processed: 0, success: 0, failed: 0 };
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: tasks, error } = await supabase
    .from('morning_sign_tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch morning tasks: ${error.message}`);
  }

  let success = 0;
  let failed = 0;

  for (const task of tasks || []) {
    let resultLog = '';
    let status: 'success' | 'failed' = 'success';

    try {
      // 尝试刷新 token：如果上游返回了新 token，就更新任务使用它
      let freshToken = (task as MorningTaskRow).token;
      let refreshed = false;
      let latestPoint: Partial<MornSignPoint> | undefined;
      try {
        const loginRes = await TotoroApiWrapper.login({ token: (task as MorningTaskRow).token });
        if (loginRes?.token) {
          freshToken = loginRes.token;
          refreshed = true;
          // 同步更新任务记录中的 token，方便后续执行
          await supabase
            .from('morning_sign_tasks')
            .update({ token: freshToken })
            .eq('id', (task as MorningTaskRow).id);
        }
      } catch (loginErr) {
        console.warn('[morning-scheduler] refresh token failed, fallback to old token', loginErr);
      }

      // 尝试拉取最新签到点位，优先用最新数据
      try {
        const deviceInfo = (task as MorningTaskRow).device_info || {};
        const breq: BasicRequest = {
          token: freshToken,
          campusId: (deviceInfo as any).campusId,
          schoolId: (deviceInfo as any).schoolId,
          stuNumber: (task as MorningTaskRow).user_id,
        };
        const paper = (await TotoroApiWrapper.getMornSignPaper(breq)) as GetMornSignPaperResponse;
        if (paper?.signPointList?.length) {
          // 选和任务 pointId 相同的点，否则取第一个
          const match =
            paper.signPointList.find((p) => p.pointId === (task as MorningTaskRow).sign_point?.pointId) ||
            paper.signPointList[0];
          latestPoint = match;
        }
      } catch (paperErr) {
        console.warn('[morning-scheduler] refresh paper failed, fallback to task point', paperErr);
      }

      const taskWithToken = { ...(task as MorningTaskRow), token: freshToken };
      const req = buildRequestFromTask(taskWithToken, latestPoint);
      const res = await TotoroApiWrapper.submitMorningExercises(req);
      const ok = isSuccessfulResponse(res);
      status = ok ? 'success' : 'failed';
      resultLog = JSON.stringify({
        refreshed,
        usedLatestPoint: Boolean(latestPoint),
        pointId: req.pointId,
        maskedToken: maskToken(freshToken),
        req,
        res,
      });
    } catch (err) {
      status = 'failed';
      const error = err as Error;
      resultLog = JSON.stringify({
        maskedToken: maskToken((task as MorningTaskRow).token),
        error: error.stack || error.message,
        task,
      });
      console.error('[morning-scheduler] task failed', {
        taskId: (task as MorningTaskRow).id,
        message: error.message,
        stack: error.stack,
      });
    }

    const { error: updateError } = await supabase
      .from('morning_sign_tasks')
      .update({ status, result_log: resultLog })
      .eq('id', (task as MorningTaskRow).id);

    if (updateError) {
      console.error('[morning-scheduler] failed to update task status', updateError);
    }

    if (status === 'success') success += 1;
    else failed += 1;
  }

  return { processed: (tasks || []).length, success, failed };
};
