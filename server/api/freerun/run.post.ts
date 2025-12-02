import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';
import freeRunRoutes from '~~/src/data/freeRunRoutes';
import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

const freerunDebug = process.env.FREERUN_DEBUG === 'true';
const safe = (obj: any) => {
  if (!freerunDebug) return obj;
  try {
    const cloned = JSON.parse(JSON.stringify(obj));
    if (cloned?.token) cloned.token = '[redacted]';
    if (cloned?.body?.token) cloned.body.token = '[redacted]';
    return cloned;
  } catch {
    return obj;
  }
};
const dlog = (...args: any[]) => {
  if (freerunDebug) console.log('[freerun:debug]', ...args);
};

type GeoPoint = { longitude: number; latitude: number };

const formatPointToAMap = (point: GeoPoint) => [Number(point.longitude), Number(point.latitude)];
const toRad = (deg: number) => (deg * Math.PI) / 180;
const metersToLatDelta = (meters: number) => meters / 111000;
const metersToLngDelta = (lat: number, meters: number) =>
  meters / (111000 * Math.cos(toRad(lat)) || 1);

const addDeviation = (point: [number, number], std = 1 / 70000) => {
  const normalRandom = (mean: number, stdDev: number) => {
    let u = 0;
    let v = 0;
    let w = 0;
    let c = 0;
    let result = mean;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      w = u * u + v * v;
      c = Math.sqrt((-2 * Math.log(w)) / w);
      result = mean + u * c * stdDev;
    } while (w === 0 || w >= 1 || result < mean - 3 * stdDev || result > mean + 3 * stdDev);
    return result;
  };
  return point.map((p) => normalRandom(p, std)) as [number, number];
};

const jitterPoint = (point: GeoPoint, maxMeters = 12): GeoPoint => ({
  longitude: point.longitude + (Math.random() * 2 - 1) * metersToLngDelta(point.latitude, maxMeters),
  latitude: point.latitude + (Math.random() * 2 - 1) * metersToLatDelta(maxMeters),
});

const jitterRoute = (points: GeoPoint[], maxMeters = 12) => points.map((p) => jitterPoint(p, maxMeters));

const smoothRoute = (points: GeoPoint[], windowSize = 5) => {
  if (points.length <= 2) return points;
  const half = Math.max(1, Math.floor(windowSize / 2));
  return points.map((p, idx) => {
    const start = Math.max(0, idx - half);
    const end = Math.min(points.length - 1, idx + half);
    const slice = points.slice(start, end + 1);
    const lng = slice.reduce((sum, cur) => sum + Number(cur.longitude), 0) / slice.length;
    const lat = slice.reduce((sum, cur) => sum + Number(cur.latitude), 0) / slice.length;
    return { longitude: lng, latitude: lat };
  });
};

const distanceBetweenPoints = (a: [number, number], b: [number, number]) => {
  const d1 = 0.0174532925194329;
  let [d2, d3] = a;
  let [d4, d5] = b;
  d2 *= d1;
  d3 *= d1;
  d4 *= d1;
  d5 *= d1;
  const d6 = Math.sin(d2);
  const d7 = Math.sin(d3);
  const d8 = Math.cos(d2);
  const d9 = Math.cos(d3);
  const d10 = Math.sin(d4);
  const d11 = Math.sin(d5);
  const d12 = Math.cos(d4);
  const d13 = Math.cos(d5);
  const s11 = d9 * d8;
  const s12 = d9 * d6;
  const s13 = d7;
  const s21 = d13 * d12;
  const s22 = d13 * d10;
  const s23 = d11;
  const d14 =
    (s11 - s21) * (s11 - s21) + (s12 - s22) * (s12 - s22) + (s13 - s23) * (s13 - s23);
  return Math.asin(Math.sqrt(d14) / 2) * 1.2740015798544e7;
};

const distanceOfLine = (line: [number, number][]) => {
  let distance = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    distance += distanceBetweenPoints(line[i], line[i + 1]);
  }
  return distance;
};

const interpolateRoute = (points: GeoPoint[], stepMeters = 8) => {
  if (points.length < 2) return points;
  const dense: GeoPoint[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    dense.push(a);
    const segmentMeters = distanceBetweenPoints(formatPointToAMap(a), formatPointToAMap(b));
    const steps = Math.max(1, Math.floor(segmentMeters / stepMeters));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      dense.push({
        longitude: a.longitude + (b.longitude - a.longitude) * t,
        latitude: a.latitude + (b.latitude - a.latitude) * t,
      });
    }
  }
  dense.push(points[points.length - 1]!);
  return dense;
};

const prepareRoutePoints = (points: GeoPoint[]) => {
  const jittered = jitterRoute(points, 12);
  const dense = interpolateRoute(jittered, 8);
  return smoothRoute(dense, 5);
};

// 从阳光跑抓包提取的一条实际路线（田径场将军路），作为兜底点位
const DEFAULT_ROUTE_POINTS: GeoPoint[] = [
  { longitude: 118.794753, latitude: 31.93722 },
  { longitude: 118.794865, latitude: 31.937302 },
  { longitude: 118.795005, latitude: 31.937329 },
  { longitude: 118.795128, latitude: 31.937315 },
  { longitude: 118.795327, latitude: 31.937192 },
  { longitude: 118.795386, latitude: 31.937051 },
  { longitude: 118.79545, latitude: 31.936669 },
  { longitude: 118.795509, latitude: 31.936205 },
  { longitude: 118.795488, latitude: 31.936123 },
  { longitude: 118.795418, latitude: 31.935995 },
  { longitude: 118.795354, latitude: 31.935936 },
  { longitude: 118.79523, latitude: 31.935872 },
  { longitude: 118.795069, latitude: 31.935849 },
  { longitude: 118.794941, latitude: 31.935886 },
  { longitude: 118.794774, latitude: 31.935972 },
  { longitude: 118.794683, latitude: 31.936113 },
  { longitude: 118.794619, latitude: 31.936705 },
  { longitude: 118.79457, latitude: 31.936988 },
  { longitude: 118.794592, latitude: 31.937101 },
  { longitude: 118.794629, latitude: 31.937183 },
  { longitude: 118.794774, latitude: 31.93727 },
];

const generateRoute = (distanceKm: number, routePoints?: GeoPoint[]) => {
  const basePoints =
    routePoints && routePoints.length >= 2 ? routePoints : DEFAULT_ROUTE_POINTS;
  const prepared = prepareRoutePoints(basePoints);
  const route = prepared.map(formatPointToAMap);

  const targetM = distanceKm * 1000;
  const points: [number, number][] = [addDeviation(route[0])];
  let dist = 0;
  let idx = 1;
  while (dist < targetM) {
    const pt = addDeviation(route[idx % route.length]);
    points.push(pt);
    dist = distanceOfLine(points);
    idx += 1;
  }

  return {
    mockRoute: points.map((xy) => ({
      longitude: xy[0].toFixed(6),
      latitude: xy[1].toFixed(6),
    })),
    distanceKm: dist / 1000,
    usedMapPreview: prepared.slice(0, 5),
  };
};

const formatHHmmss = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatLocalDateTime = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};

const extractTaskId = (paper: any) =>
  paper?.taskId ?? paper?.obj?.taskId ?? paper?.body?.taskId ?? paper?.resultMap?.taskId;

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const {
    token,
    stuNumber,
    campusId,
    schoolId,
    km = 1.01,
    // phoneNumber 在自由跑主体包保持为空匹配抓包
    phoneNumber = '',
    routeId,
    useSunRunMap = true,
  } = body || {};
  dlog('req.body', safe(body));

  if (!token || !stuNumber || !campusId || !schoolId) {
    return { success: false, message: '缺少必要参数' };
  }

  const baseKm = Number(km) || 1.01;
  if (baseKm < 0.5 || baseKm > 3.2) {
    return { success: false, message: '长度不合法，仅支持 0.5~3.2km' };
  }

  const maybeConsumeFreeRunCredit = async (consumeKm: number) => {
    if (!isSupabaseConfigured()) return { ok: true, remaining: null as number | null };
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('free_run_credits')
      .select('credits')
      .eq('user_id', stuNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { ok: false, message: `公里查询失败: ${error.message}` };
    }

    const currentCredits = data?.credits ?? 0;
    if (currentCredits < consumeKm) {
      return {
        ok: false,
        message: `自由跑公里数不足（需 ${consumeKm} km，剩余 ${Number(currentCredits).toFixed(2)} km）`,
      };
    }

    const nextCredits = Number((currentCredits - consumeKm).toFixed(2));
    const { error: updateError } = await supabase
      .from('free_run_credits')
      .upsert({
        user_id: stuNumber,
        credits: nextCredits,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      return { ok: false, message: `公里扣减失败: ${updateError.message}` };
    }

    return { ok: true, remaining: nextCredits };
  };

  const quota = await maybeConsumeFreeRunCredit(baseKm);
  if (!quota.ok) {
    return { success: false, message: quota.message };
  }

  let taskId: string | undefined;
  let freeError: any = null;
  let freePaper: any = null;
  let sunrunPaper: any = null;
  const paperReq = { token, stuNumber, campusId, schoolId };

  try {
    freePaper = await TotoroApiWrapper.getFreerunPaper(paperReq);
  } catch (e: any) {
    freeError = e;
    console.error('[freerun] getFreerunPaper failed:', e);

    let errorDetail = e?.message || 'Unknown Error';
    let remoteBody = '';
    if (e?.response) {
      try {
        remoteBody = await e.response.text();
      } catch {}
      errorDetail = `Status: ${e.response.status} | Body: ${remoteBody.slice(0, 100)}`;
    }

    return {
      success: false,
      message: '调试模式：请求龙猫服务器失败',
      error: errorDetail,
      debugStep: 'getFreerunPaper',
      tip: '如果是 404/500/Timeout，可能是 IP 被墙；如果是 file not found，是密钥丢失。',
    };
  }
  taskId = extractTaskId(freePaper);
  dlog('freePaper taskId', taskId, 'freePaper', safe(freePaper), 'error', freeError ? String(freeError) : undefined);

  const getSunPaper = async () => {
    try {
      return await TotoroApiWrapper.getSunRunPaper({
        token,
        campusId,
        schoolId,
        stuNumber,
      });
    } catch (e) {
      console.error('[freerun] getSunRunPaper failed', e);
      return null;
    }
  };

  const getSunPaperNew = async () => {
    try {
      return await TotoroApiWrapper.getSunRunPaperNew({
        token,
        campusId,
        schoolId,
        stuNumber,
      });
    } catch (e) {
      console.error('[freerun] getSunRunPaperNew failed', e);
      return null;
    }
  };

  if (!taskId) {
    sunrunPaper = await getSunPaper();
    if (!sunrunPaper) sunrunPaper = await getSunPaperNew();
    taskId = extractTaskId(sunrunPaper);
    dlog('sunrunPaper taskId', taskId, 'sunrunPaper.pointList', (sunrunPaper as any)?.pointList?.length);
  }

  const selectedRoute = freeRunRoutes.find((r) => r.id === routeId) || freeRunRoutes[0];
  let mapPoints: GeoPoint[] | undefined = selectedRoute?.basePoints;
  dlog('selectedRoute', selectedRoute?.id, 'mapPoints init', mapPoints?.length);

  if ((!mapPoints || mapPoints.length === 0) && useSunRunMap) {
    if (!sunrunPaper) {
      sunrunPaper = await getSunPaper();
      if (!sunrunPaper?.pointList?.length) {
        sunrunPaper = await getSunPaperNew();
      }
    }
    mapPoints = (sunrunPaper as any)?.pointList || DEFAULT_ROUTE_POINTS;
    dlog('mapPoints from sunrun', (sunrunPaper as any)?.pointList?.length);
  }

  if (!mapPoints || !mapPoints.length) {
    return {
      success: false,
      message: '获取阳光跑地图失败，未发送提交包',
      freePaper,
      sunrunPaper,
      hasTaskId: Boolean(taskId),
      hasMapPoints: false,
      paperReq,
    };
  }

  if (!taskId) {
    return {
      success: false,
      message: '获取自由跑任务失败，未发送提交包',
      error: freeError ? String(freeError) : undefined,
      freePaper,
      sunrunPaper,
      hasTaskId: false,
      hasMapPoints: Boolean(mapPoints?.length),
      paperReq,
    };
  }

  const start = new Date();
  const extraKm = parseFloat((0.02 + Math.random() * 0.08).toFixed(2));
  let targetKm = parseFloat((baseKm + extraKm).toFixed(2));
  // 保持不超出总上限 3.2km
  if (targetKm > 3.2) targetKm = 3.2;
  if (Number.isInteger(targetKm)) targetKm += 0.01;
  const paceSecondsPerKm = Math.floor(5 * 60 + Math.random() * (4 * 60)); // 5~9 分/公里，秒级随机
  const usedSeconds = Math.max(60, Math.round(paceSecondsPerKm * targetKm));
  const end = new Date(start.getTime() + usedSeconds * 1000);
  const startTime = start.toTimeString().slice(0, 8); // HH:MM:SS
  const endTime = end.toTimeString().slice(0, 8);
  const evaluateDate = formatLocalDateTime(end);
  const usedTime = formatHHmmss(usedSeconds);
  const avgSpeed = (targetKm / (usedSeconds / 3600)).toFixed(2);
  const routeResult = generateRoute(targetKm || 1, mapPoints);

  const runReq = {
    fitDegree: '',
    steps: '0',
    phoneInfo: '$CN11/iPhone16,2/26.1',
    sensorString: '',
    usedTime,
    pointList: '',
    evaluateDate,
    LocalSubmitReason: '',
    runType: '1',
    km: routeResult.distanceKm.toFixed(2),
    endTime,
    flag: '1',
    avgSpeed,
    stuNumber,
    headImage: '',
    warnFlag: '',
    version: '1.2.16',
    runTimeType: '1',
    routeId: '',
    mac: 'ios',
    token,
    warnType: '',
    ifLocalSubmit: '0',
    startTime,
    faceData: '',
    phoneNumber: '',
    baseStation: '',
    taskId: taskId || 'sunrunTaskPaper-free',
  };
  dlog('runReq ready', safe(runReq));

  try {
    const exercisesRes = await TotoroApiWrapper.freeRunExercises(runReq);
    dlog('exercisesRes', safe(exercisesRes));
    if (!exercisesRes?.scantronId) {
      return { success: false, message: '提交主体失败', res: exercisesRes };
    }
    await TotoroApiWrapper.sunRunExercisesDetail({
      pointList: routeResult.mockRoute,
      scantronId: exercisesRes.scantronId,
      breq: { stuNumber, token },
    });
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdminClient();
      supabase
        .from('free_run_records')
        .insert({
          user_id: stuNumber,
          distance_km: routeResult.distanceKm,
          scantron_id: exercisesRes.scantronId,
          created_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn('[freerun] log record failed', error.message);
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: '自由跑提交成功',
      scantronId: exercisesRes.scantronId,
      runReq,
      routeDistanceKm: routeResult.distanceKm,
      usedMapPoints: routeResult.usedMapPreview,
      selectedRouteId: selectedRoute?.id,
    };
  } catch (error) {
    console.error('[freerun] submit failed', error);
    return { success: false, message: '提交失败', error: (error as any)?.message };
  }
});
