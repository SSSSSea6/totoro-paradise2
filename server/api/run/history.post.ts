import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';

export default defineEventHandler(async (e) => {
  try {
    const body = await readBody<{
      session: { stuNumber: string; token: string; schoolId: string; campusId: string };
      startDate?: string;
      endDate?: string;
    }>(e);
    if (!body?.session?.stuNumber || !body?.session?.token || !body?.session?.schoolId) {
      return { message: '缺少 session 信息' };
    }
    if (!body.startDate || !body.endDate) {
      return { message: '缺少 startDate / endDate' };
    }
    const start = new Date(`${body.startDate}T00:00:00+08:00`);
    const end = new Date(`${body.endDate}T23:59:59+08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { message: '日期范围不合法' };
    }

    const basicReq = {
      stuNumber: body.session.stuNumber,
      schoolId: body.session.schoolId,
      campusId: body.session.campusId ?? '',
      token: body.session.token,
    };

    // 获取学期和月列表，再按月查询 getSunrunArch（官方阳光跑记录）
    const doneDates = new Set<string>();
    const termResp = await TotoroApiWrapper.getSchoolTerm(basicReq);
    const terms = termResp?.data ?? [];
    for (const term of terms) {
      const termId = term.termId || term.id;
      if (!termId) continue;
      const monthResp = await TotoroApiWrapper.getSchoolMonthByTerm(termId, basicReq);
      const months = monthResp?.data ?? [];
      for (const m of months) {
        const monthId = m.monthId || m.id || m.monthCode;
        if (!monthId) continue;
        try {
          const arch = await TotoroApiWrapper.getSunRunArch(monthId, termId, basicReq);
          arch.data?.forEach((s) => {
            const datePart = s.runTime?.split(' ')?.[0] || s.runTime;
            if (!datePart) return;
            const d = new Date(`${datePart}T00:00:00+08:00`);
            if (d >= start && d <= end) {
              doneDates.add(datePart);
            }
          });
        } catch (err) {
          console.warn('[history] arch fetch failed', monthId, (err as Error).message);
        }
      }
    }

    return { dates: Array.from(doneDates) };
  } catch (err) {
    return { message: (err as Error).message };
  }
});
