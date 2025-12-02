import crypto from 'crypto';
import rsaKeys from '../data/rsaKeys';

/**
 * 构建公钥 PEM：优先环境变量，其次内置公钥。
 */
const buildPublicKeyPem = (): string => {
  const envB64 = process.env.PUBLIC_KEY_BASE64;
  const envPem = process.env.PUBLIC_KEY;
  let pem = '';
  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
  } else if (envPem) {
    pem = envPem;
  } else {
    pem = rsaKeys.publicKey;
  }
  return pem.replace(/\\n/g, '\n').trim();
};

/**
 * 分块加密（RSA PKCS#1 v1.5），并在 ENCRYPT_DEBUG=true 时输出关键信息。
 * 对异常情况打印详细日志，帮助定位 Koyeb 上可能的公钥/环境问题。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  const keyPem = buildPublicKeyPem();

  let keyObject: crypto.KeyObject;
  try {
    keyObject = crypto.createPublicKey(keyPem);
  } catch (error: any) {
    console.error('[encrypt] createPublicKey failed:', error?.message);
    console.error('[encrypt] key (first 100 chars):', keyPem.slice(0, 100));
    throw new Error('公钥解析失败');
  }

  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;
  if (typeof modulusBits !== 'number' || !Number.isInteger(modulusBits) || modulusBits <= 0) {
    console.error('[encrypt] invalid modulusLength:', modulusBits);
    console.error('[encrypt] keyDetails:', JSON.stringify(keyObject.asymmetricKeyDetails));
    throw new Error('密钥模长无效');
  }

  const maxChunkSize = Math.floor(modulusBits / 8) - 11; // PKCS#1 v1.5 padding
  if (maxChunkSize <= 0) {
    console.error('[encrypt] invalid chunk size:', maxChunkSize);
    throw new Error('分块大小无效');
  }

  if (debug) {
    console.log(`[encrypt] ready. modulusBits=${modulusBits}, chunk=${maxChunkSize} bytes.`);
  }

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    const encryptedChunk = crypto.publicEncrypt(
      {
        key: keyObject,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      chunk,
    );
    chunks.push(encryptedChunk);
  }

  return Buffer.concat(chunks).toString('base64');
};

export default encryptRequestContent;
