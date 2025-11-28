import { createHash } from 'crypto';
import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';
import type MornSignPoint from '~~/src/types/MornSignPoint';
import type SubmitMornSignRequest from '~~/src/types/requestTypes/SubmitMornSignRequest';
import type SubmitMorningExercisesResponse from '~~/src/types/responseTypes/SubmitMorningExercisesResponse';
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabaseAdminClient';

type SessionInfo = {
  token: string;
  campusId: string;
  schoolId: string;
  stuNumber: string;
  phoneNumber?: string;
  refreshed: boolean;
};

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

const pseudoRandomFromHash = (hex: string, offset = 0) => {
  const slice = hex.slice(offset, offset + 8) || '0';
  const val = parseInt(slice, 16);
  return (val / 0xffffffff) * 2 - 1; // [-1, 1]
};

const jitterLocation = (point: Partial<MornSignPoint>, hexSeed: string) => {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { lat, lng };
  const maxMeters = 8; // 控制在几米范围内抖动
  const degLat = maxMeters / 111000;
  const degLng = maxMeters / (111000 * Math.cos((lat * Math.PI) / 180) || 1);
  const randLat = pseudoRandomFromHash(hexSeed, 0);
  const randLng = pseudoRandomFromHash(hexSeed, 8);
  return {
    lat: lat + randLat * degLat,
    lng: lng + randLng * degLng,
  };
};

const generateFakeDeviceInfo = (deviceInfo: Record<string, any>, userId: string) => {
  // 与阳光跑保持一致：iPhone UA、空基站、学号哈希 MAC、固定版本
  const hex = createHash('sha256').update(userId || 'anon').digest('hex');
  const sunRunMac = hex.substring(0, 32);
  return {
    phoneInfo: deviceInfo.phoneInfo || '$CN11/iPhone15,4/17.4.1',
    baseStation: deviceInfo.baseStation ?? '',
    mac: deviceInfo.mac || sunRunMac,
    appVersion: deviceInfo.appVersion || '2.0.3',
    deviceType: deviceInfo.deviceType || '2',
    headImage: deviceInfo.headImage || '',
  };
};

const haversineDistanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const refreshSession = async (
  task: MorningTaskRow,
  deviceInfo: Record<string, any>,
): Promise<SessionInfo> => {
  const base: SessionInfo = {
    token: task.token,
    campusId: deviceInfo.campusId ?? '',
    schoolId: deviceInfo.schoolId ?? '',
    stuNumber: task.user_id,
    phoneNumber: deviceInfo.phoneNumber || '',
    refreshed: false,
  };

  try {
    const loginRes = (await TotoroApiWrapper.login({ token: task.token })) as any;
    const ok = loginRes?.status === '00' && loginRes?.code === '0';
    if (!ok) return base;
    return {
      token: loginRes.token || base.token,
      campusId: loginRes.campusId || base.campusId,
      schoolId: loginRes.schoolId || base.schoolId,
      stuNumber: loginRes.stuNumber || base.stuNumber,
      phoneNumber: loginRes.phoneNumber || base.phoneNumber,
      refreshed: true,
    };
  } catch (error) {
    console.warn('[morning-scheduler] refresh login failed, use cached token', error);
    return base;
  }
};

const pickLatestPoint = (
  paper: { signPointList?: MornSignPoint[]; signType?: string },
  cachedPoint: Partial<MornSignPoint>,
) => {
  const list = paper.signPointList || [];
  const withSignType = (p: Partial<MornSignPoint>) => ({ ...p, signType: paper.signType });

  const match = list.find((p) => p.pointId === cachedPoint.pointId);
  if (match) return { point: withSignType(match), usedLatestPoint: true };

  if (list.length === 0 || !cachedPoint.latitude || !cachedPoint.longitude) {
    return { point: withSignType(cachedPoint), usedLatestPoint: false };
  }

  const anchor = {
    lat: Number(cachedPoint.latitude),
    lng: Number(cachedPoint.longitude),
  };
  const nearest = list.reduce((best, candidate) => {
    const dist = haversineDistanceMeters(anchor, {
      lat: Number(candidate.latitude),
      lng: Number(candidate.longitude),
    });
    if (!best) return { candidate, dist };
    return dist < best.dist ? { candidate, dist } : best;
  }, null as { candidate: MornSignPoint; dist: number } | null);

  if (!nearest) return { point: withSignType(cachedPoint), usedLatestPoint: false };
  return { point: withSignType(nearest.candidate), usedLatestPoint: true };
};

const buildRequestFromTask = (
  task: MorningTaskRow,
  {
    session,
    point: overridePoint,
  }: { session: SessionInfo; point: Partial<MornSignPoint> },
): SubmitMornSignRequest => {
  const point = overridePoint;
  const deviceInfo = (task.device_info || {}) as Record<string, any>;

  if (!point.taskId || !point.pointId) {
    throw new Error('Missing sign point information on task.');
  }

  const fake = generateFakeDeviceInfo(deviceInfo, task.user_id);
  const seedHex = createHash('md5').update(task.user_id || '').digest('hex');
  const { lat, lng } = jitterLocation(point, seedHex);

  return {
    token: session.token,
    campusId: session.campusId ?? '',
    schoolId: session.schoolId ?? '',
    stuNumber: session.stuNumber,
    phoneNumber: session.phoneNumber || deviceInfo.phoneNumber || '',
    latitude: String(lat ?? point.latitude ?? ''),
    longitude: String(lng ?? point.longitude ?? ''),
    taskId: String(point.taskId ?? ''),
    pointId: String(point.pointId ?? ''),
    qrCode: point.qrCode,
    deviceType: fake.deviceType,
    headImage: fake.headImage,
    baseStation: fake.baseStation,
    phoneInfo: fake.phoneInfo,
    mac: fake.mac,
    appVersion: fake.appVersion,
    signType: (point as any).signType || deviceInfo.signType || '0',
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
      const deviceInfo = (task.device_info || {}) as Record<string, any>;
      const basePoint = (task.sign_point || {}) as Partial<MornSignPoint>;

      // 刷新一次登录，拿到最新 token/学籍信息
      const session = await refreshSession(task as MorningTaskRow, deviceInfo);

      // 优先拉最新签到点，避免用到过期的二维码或点位
      let pointToUse = basePoint;
      let usedLatestPoint = false;
      let refreshed = session.refreshed;
      try {
        const paper = await TotoroApiWrapper.getMornSignPaper({
          token: session.token,
          campusId: session.campusId,
          schoolId: session.schoolId,
          stuNumber: session.stuNumber,
        });
        const picked = pickLatestPoint(paper as any, basePoint);
        pointToUse = picked.point;
        usedLatestPoint = picked.usedLatestPoint;

        const need = Number(paper.dayNeedSignCount || 0);
        const done = Number(paper.dayCompSignCount || 0);
        if (Number.isFinite(need) && Number.isFinite(done) && done >= need) {
          status = 'failed';
          resultLog = JSON.stringify({
            refreshed,
            usedLatestPoint,
            pointId: pointToUse.pointId,
            maskedToken: maskToken((task as MorningTaskRow).token),
            message: '日签到次数已满，跳过提交',
            paperMeta: { need, done, startTime: paper.startTime, endTime: paper.endTime },
          });
          const { error: updateError } = await supabase
            .from('morning_sign_tasks')
            .update({ status, result_log: resultLog })
            .eq('id', (task as MorningTaskRow).id);
          if (updateError) {
            console.error('[morning-scheduler] failed to update task status', updateError);
          }
          continue;
        }
      } catch (paperErr) {
        console.warn('[morning-scheduler] getMornSignPaper failed, fallback to cached point', paperErr);
      }

      const req = buildRequestFromTask(task as MorningTaskRow, {
        session,
        point: pointToUse,
      });
      const res = await TotoroApiWrapper.submitMorningExercises(req);
      const ok = isSuccessfulResponse(res);
      status = ok ? 'success' : 'failed';
      resultLog = JSON.stringify({
        refreshed,
        usedLatestPoint,
        pointId: req.pointId,
        maskedToken: maskToken((task as MorningTaskRow).token),
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
