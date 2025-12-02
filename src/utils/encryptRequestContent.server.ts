import crypto from 'crypto';
import { publicKeyBody } from '../data/rsaKeys';

/**
 * 使用 DER 直接加载公钥，彻底绕过 PEM 换行/头尾解析问题。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  let keyObject: crypto.KeyObject;

  try {
    keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKeyBody, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch (error: any) {
    console.error('[encrypt] createPublicKey (DER spki) failed:', error?.message);
    throw new Error('公钥构造失败: ' + (error?.message || 'unknown'));
  }

  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;
  if (typeof modulusBits !== 'number' || !Number.isInteger(modulusBits) || modulusBits <= 0) {
    console.error('[encrypt] invalid modulusLength:', modulusBits);
    throw new Error('密钥模长无效');
  }

  const maxChunkSize = Math.floor(modulusBits / 8) - 11; // PKCS#1 v1.5 padding
  if (debug) {
    console.log(`[encrypt] ready. modulusBits=${modulusBits}, chunk=${maxChunkSize} bytes.`);
  }

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    chunks.push(
      crypto.publicEncrypt(
        {
          key: keyObject,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        chunk,
      ),
    );
  }

  return Buffer.concat(chunks).toString('base64');
};

export default encryptRequestContent;
