import crypto from 'crypto';
import rsaKeys from '../data/rsaKeys';

const buildPublicKeyPem = (): string => {
  // 优先使用环境变量，其次内置公钥
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

const encryptRequestContent = (req: Record<string, any>): string => {
  // 与官方客户端一致：使用公钥 PKCS#1 v1.5 分块加密
  const keyPem = buildPublicKeyPem();
  const keyObject = crypto.createPublicKey(keyPem);
  // Node 22 移除了 asymmetricKeySize，这里改为 modulusLength 获取密钥位数
  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;
  const keySizeBytes = Math.floor(modulusBits / 8);
  if (!keySizeBytes) {
    throw new Error('Failed to determine RSA key size for request encryption');
  }
  const maxChunkSize = keySizeBytes - 11; // PKCS#1 v1.5 padding

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
