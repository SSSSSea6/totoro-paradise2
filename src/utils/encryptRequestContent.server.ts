import crypto from 'crypto';
import rsaKeys from '../data/rsaKeys';

/**
 * 固定使用内置公钥，避免环境变量污染；同时对解析/模长/分块大小做严格校验，调试时打印关键信息。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  const pem = rsaKeys.publicKey.replace(/\\n/g, '\n').trim();

  let keyObject: crypto.KeyObject;
  try {
    keyObject = crypto.createPublicKey(pem);
  } catch (error: any) {
    console.error('[encrypt] createPublicKey failed:', error?.message);
    console.error('[encrypt] key (first 100 chars):', pem.slice(0, 100));
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
