import type { H3Event } from 'h3';
import { createError, getRequestHeader, readRawBody } from 'h3';

const RATE_LIMIT_MAX_REQUESTS = 8;
const RATE_LIMIT_WINDOW_MS = 1_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 400;
const CACHE_TTL_MS = 30_000;
const CACHEABLE_PATHS = new Set([
  '/app/platform/login/getAppFrontPage',
  '/app/platform/serverlist/getAppSlogan',
  '/app/platform/serverlist/getAppNotice',
]);

type RateLimitRecord = {
  count: number;
  expiresAt: number;
};

type CachedResponse = {
  body: string;
  status: number;
  headers: [string, string][];
  expiresAt: number;
};

const rateLimitMap = new Map<string, RateLimitRecord>();
const responseCache = new Map<string, CachedResponse>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getClientIdentifier = (event: H3Event) => {
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  return event.node.req.socket.remoteAddress ?? 'unknown';
};

const enforceRateLimit = (clientId: string) => {
  const now = Date.now();
  const bucket = rateLimitMap.get(clientId);
  if (!bucket || bucket.expiresAt < now) {
    rateLimitMap.set(clientId, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试',
    });
  }
};

const getCachedResponse = (key: string) => {
  const cached = responseCache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    if (cached) responseCache.delete(key);
    return null;
  }
  return cached;
};

const saveCachedResponse = (key: string, entry: CachedResponse) => {
  responseCache.set(key, entry);
};

const isAbortError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'AbortError';

const buildTimeoutError = () =>
  createError({
    statusCode: 504,
    statusMessage: 'Upstream Timeout',
    message: '访问龙猫服务器超时，请稍后再试',
  });

const buildNetworkError = (error: unknown) =>
  createError({
    statusCode: 502,
    statusMessage: 'Upstream Fetch Failed',
    message: '访问龙猫服务器失败，请稍后再试',
    cause: error,
  });

const fetchWithResilience = async (url: string, init: RequestInit) => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === MAX_RETRIES) {
        if (isAbortError(error)) throw buildTimeoutError();
        throw buildNetworkError(error);
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw createError({ statusCode: 500, statusMessage: 'Proxy Error' });
};

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event)) ?? '';
  const clientId = getClientIdentifier(event);
  enforceRateLimit(clientId);

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Host: 'app.xtotoro.com',
    Connection: 'keep-alive',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'TotoroSchool/1.2.14 (iPhone; iOS 17.4.1; Scale/3.00)',
    Cookie: event.node.req.headers.cookie,
    Accept: 'application/json',
  };

  const path = event.path.replace('/api/totoro/', '/app/');
  const targetUrl = `https://app.xtotoro.com${path}`;
  const requestBody = rawBody.length ? rawBody : undefined;

  const cacheKey = `${path}:${rawBody}`;
  const shouldCache = CACHEABLE_PATHS.has(path);
  if (shouldCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: cached.headers,
      });
    }
  }

  const upstreamResponse = await fetchWithResilience(targetUrl, {
    method: 'POST',
    headers: headers as HeadersInit,
    body: requestBody,
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-length');
  const bodyText = await upstreamResponse.text();
  const headerEntries = Array.from(responseHeaders.entries());

  if (shouldCache && upstreamResponse.status === 200) {
    saveCachedResponse(cacheKey, {
      body: bodyText,
      status: upstreamResponse.status,
      headers: headerEntries,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return new Response(bodyText, {
    status: upstreamResponse.status,
    headers: headerEntries,
  });
});
