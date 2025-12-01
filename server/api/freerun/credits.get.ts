// Freedom-run credits handler stripped; forwards to external service only.
export default defineEventHandler(async (event) => {
  const external = process.env.FREERUN_API_BASE;
  if (!external) {
    return { success: false, message: '自由跑已迁出本仓库，请配置 FREERUN_API_BASE 指向外部服务', credits: null, records: [] };
  }
  const qs = event.node.req.url?.split('?')[1] || '';
  const res = await fetch(`${external.replace(/\/$/, '')}/api/freerun/credits${qs ? `?${qs}` : ''}`);
  const data = await res.json().catch(() => ({
    success: false,
    message: '外部服务响应解析失败',
    credits: null,
    records: [],
  }));
  return data;
});
