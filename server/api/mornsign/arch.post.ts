import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';
import type MorningScoreRequest from '~~/src/types/requestTypes/MorningScoreRequest';

export default defineEventHandler(async (event) => {
  const body = await readBody<MorningScoreRequest>(event).catch(() => null);

  if (!body?.token || !body?.stuNumber || !body?.schoolId) {
    return { success: false, message: '缺少必要参数' };
  }

  try {
    const res = await TotoroApiWrapper.getMornSignArchDetail(body);
    return { success: res.status === '00' && res.code === '0', data: res };
  } catch (error) {
    console.error('[mornsign] getMornSignArchDetail failed', error);
    return { success: false, message: '获取晨操成绩失败' };
  }
});
