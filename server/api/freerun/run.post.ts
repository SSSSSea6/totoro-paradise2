// Freedom-run handler stripped from repo. It only forwards to external service.
export default defineEventHandler(async (event) => {
  const external = process.env.FREERUN_API_BASE;
  if (!external) {
    return { success: false, message: '自由跑已迁出本仓库，请配置 FREERUN_API_BASE 指向外部服务' };
  }
  const payload = await readBody(event).catch(() => ({}));
  const res = await fetch(${external.replace(/\/$/, '')}/api/freerun/run, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({ success: false, message: '外部服务响应解析失败' }));
  return data;
});

