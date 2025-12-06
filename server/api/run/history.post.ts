import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';

export default defineEventHandler(async (e) => {
  try {
    const body = await readBody<{
      session: { stuNumber: string; token: string };
      startDate?: string;
      endDate?: string;
    }>(e);
    if (!body?.session?.stuNumber || !body?.session?.token) {
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

    const monthIds: string[] = [];
    const cursor = new Date(start);
    cursor.setDate(1);
    while (cursor <= end) {
      monthIds.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const doneDates = new Set<string>();
    for (const monthId of monthIds) {
      try {
        const res = await TotoroApiWrapper.getSunRunSport({
          stuNumber: body.session.stuNumber,
          runType: '0',
          monthId,
          pageNumber: '1',
          rowNumber: '200',
          token: body.session.token,
        });
        res.runList?.forEach((r) => {
          const datePart = r.runTime?.split(' ')?.[0];
          if (!datePart) return;
          const d = new Date(`${datePart}T00:00:00+08:00`);
          if (d >= start && d <= end) {
            doneDates.add(datePart);
          }
        });
      } catch (err) {
        console.warn('[history] fetch month failed', monthId, (err as Error).message);
      }
    }

    return { dates: Array.from(doneDates) };
  } catch (err) {
    return { message: (err as Error).message };
  }
});
