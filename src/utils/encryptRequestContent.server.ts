// sssssea6/totoro-paradise2/totoro-paradise2-56d476fc4dd56da1d8091e1167a7bf1f0bc15510/src/utils/encryptRequestContent.server.ts

import crypto from 'crypto';
import { publicKeyBody } from '../data/rsaKeys';

/**
 * 使用 DER 格式直接加载公钥，彻底规避 PEM 换行符/空格解析失败的问题
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';

  let keyObject: crypto.KeyObject;
  try {
    // 核心修改：使用 Buffer + der + spki 格式，不依赖文本解析
    keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKeyBody, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch (error: any) {
    console.error('[encrypt] createPublicKey (DER) failed:', error?.message);
    throw new Error('公钥构造失败: ' + (error?.message || 'unknown'));
  }

  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;

  if (typeof modulusBits !== 'number' || !Number.isInteger(modulusBits) || modulusBits <= 0) {
    console.error('[encrypt] invalid modulusLength:', modulusBits);
    throw new Error('密钥模长无效');
  }

  // PKCS#1 v1.5 padding overhead is 11 bytes
  const maxChunkSize = Math.floor(modulusBits / 8) - 11;

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