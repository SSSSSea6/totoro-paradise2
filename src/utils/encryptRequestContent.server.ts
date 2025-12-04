import crypto from 'crypto';
import { publicKeyBody } from '../data/rsaKeys';

const buildPublicKeyPem = (): string => {
  const envB64 = process.env.PUBLIC_KEY_BASE64;
  const envPem = process.env.PUBLIC_KEY;
  let pem = '';

  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
  } else if (envPem) {
    pem = envPem;
  } else {
    pem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBody}\n-----END PUBLIC KEY-----`;
  }

  if (!pem.includes('BEGIN PUBLIC KEY')) {
    pem = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
  }

  return pem.replace(/\\n/g, '\n').trim();
};

let cachedKey: ReturnType<typeof crypto.createPublicKey> | null = null;
let cachedChunkSize = 0;

const getKeyMaterial = () => {
  if (cachedKey && cachedChunkSize > 0) {
    return { key: cachedKey, maxChunkSize: cachedChunkSize };
  }

  try {
    const key = crypto.createPublicKey(buildPublicKeyPem());
    const modulusLength = key.asymmetricKeyDetails?.modulusLength;
    const keyBytes =
      typeof modulusLength === 'number'
        ? Math.ceil(modulusLength / 8)
        : typeof key.asymmetricKeySize === 'number'
          ? Math.ceil(key.asymmetricKeySize / 8)
          : 128;
    // PKCS#1 v1.5 padding reserves 11 bytes.
    const maxChunkSize = Math.max(1, keyBytes - 11);

    cachedKey = key;
    cachedChunkSize = maxChunkSize;
    return { key, maxChunkSize };
  } catch (e: any) {
    console.error('[encrypt] Public key init failed:', e);
    throw new Error(`RSA初始化失败: ${e?.message || e}`);
  }
};

/**
 * 使用 Node 内置 crypto 进行 RSA(PKCS#1 v1.5) 分块加密。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  const { key, maxChunkSize } = getKeyMaterial();

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  if (debug) {
    console.log(`[encrypt] chunk size=${maxChunkSize}, payload length=${buffer.length}`);
  }

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    try {
      const encryptedChunk = crypto.publicEncrypt(
        { key, padding: crypto.constants.RSA_PKCS1_PADDING },
        chunk,
      );
      chunks.push(encryptedChunk);
    } catch (err: any) {
      console.error('[encrypt] RSA encrypt failed:', err?.message || err);
      throw new Error(`加密计算失败: ${err?.message || err}`);
    }
  }

  return Buffer.concat(chunks).toString('base64');
};

export default encryptRequestContent;
