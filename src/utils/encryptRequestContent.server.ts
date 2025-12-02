import crypto from 'crypto';
import { publicKeyBody } from '../data/rsaKeys';

/**
 * 终极兼容版：直接拼 PEM + 固定分块大小，兼容所有 Node 版本/精简容器。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  // 按 64 字符换行，拼成标准 PEM
  const chunkedBody = publicKeyBody.match(/.{1,64}/g)?.join('\n') || publicKeyBody;
  const pem = `-----BEGIN PUBLIC KEY-----\n${chunkedBody}\n-----END PUBLIC KEY-----\n`;

  // 1024-bit RSA => 128 bytes; PKCS#1 padding overhead 11 bytes => 可用 117 字节
  const maxChunkSize = 117;

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    try {
      const encryptedChunk = crypto.publicEncrypt(
        {
          key: pem,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        chunk,
      );
      chunks.push(encryptedChunk);
    } catch (err: any) {
      console.error('[encrypt] publicEncrypt failed:', err?.message);
      throw new Error(`加密失败(Core): ${err?.message || 'unknown'}`);
    }
  }

  return Buffer.concat(chunks).toString('base64');
};

export default encryptRequestContent;
