const FETCH_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchScanResult = async (uuid: string) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await $fetch<string>(
        `https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&f=url`,
        { timeout: FETCH_TIMEOUT_MS },
      );
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF_MS * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError;
};

export default defineEventHandler(async (event) => {
  const uuid = event.context.params?.uuid;
  if (!uuid) {
    return { message: '二维码无效，请刷新后重试', code: null };
  }

  try {
    const scanResult = await fetchScanResult(uuid);
    const reg = /:\/\/oauth\?code=(\w+)&/;
    const res = reg.exec(scanResult);
    if (!res) {
      return { message: '尚未确认，请在手机端点击确认', code: null };
    }
    return { message: null, code: res[1] };
  } catch (error) {
    console.error('[scan-qr] 拉取微信授权码失败', { uuid, error });
    return {
      message: '微信服务响应超时，请稍后重试',
      code: null,
    };
  }
});
