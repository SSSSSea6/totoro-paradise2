// 使用纯 JS 的 RSA 库，绕过 Koyeb/nuxt(unenv) 对 node:crypto 的阉割
import NodeRSA from './nodeRSA';
import { publicKeyBody } from '../data/rsaKeys';

/**
 * 纯 JS 加密：构造 PEM + NodeRSA + PKCS#1 v1.5 分块
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';

  // 标准 PEM 头尾
  const pem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBody}\n-----END PUBLIC KEY-----`;

  let key: any;
  try {
    key = new (NodeRSA as any)();
    key.importKey(pem, 'pkcs8-public-pem');
    key.setOptions({ encryptionScheme: 'pkcs1' }); // PKCS#1 v1.5
  } catch (e: any) {
    console.error('[encrypt] NodeRSA init failed:', e);
    throw new Error(`RSA初始化失败: ${e?.message || e}`);
  }

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  // 1024-bit RSA，PKCS#1 padding -> 最大 117 字节
  const maxChunkSize = 117;

  if (debug) {
    console.log(`[encrypt] NodeRSA ready. Chunk size: ${maxChunkSize}`);
  }

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    try {
      const encryptedChunk = key.encrypt(chunk, 'buffer');
      chunks.push(encryptedChunk);
    } catch (err: any) {
      console.error('[encrypt] NodeRSA encrypt failed:', err?.message);
      throw new Error(`加密计算失败: ${err?.message || err}`);
    }
  }

  return Buffer.concat(chunks).toString('base64');
};

export default encryptRequestContent;
