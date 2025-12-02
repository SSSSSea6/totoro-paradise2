import crypto from 'crypto';
import rsaKeys from '../data/rsaKeys';

type KeySource = 'env-b64' | 'env-pem' | 'internal';

/**
 * 构建公钥 PEM：优先环境变量，其次内置公钥。返回 PEM 及来源，便于出现异常时回退。
 */
const buildPublicKeyPem = (): { pem: string; source: KeySource } => {
  const envB64 = process.env.PUBLIC_KEY_BASE64;
  const envPem = process.env.PUBLIC_KEY;
  let pem = '';
  let source: KeySource = 'internal';
  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
    source = 'env-b64';
  } else if (envPem) {
    pem = envPem;
    source = 'env-pem';
  } else {
    pem = rsaKeys.publicKey;
    source = 'internal';
  }
  return { pem: pem.replace(/\\n/g, '\n').trim(), source };
};

/**
 * 分块加密（RSA PKCS#1 v1.5），并在 ENCRYPT_DEBUG=true 时输出关键信息。
 * 对异常情况打印详细日志，若环境变量公钥无效会自动回退到内置公钥。
 */
const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  let { pem, source } = buildPublicKeyPem();

  const createKeyObject = (pemText: string) => {
    try {
      return crypto.createPublicKey(pemText);
    } catch (error: any) {
      console.error('[encrypt] createPublicKey failed:', error?.message);
      console.error('[encrypt] key (first 100 chars):', pemText.slice(0, 100));
      return null;
    }
  };

  let keyObject = createKeyObject(pem);
  if (!keyObject && source !== 'internal') {
    // 回退内置公钥
    pem = rsaKeys.publicKey.replace(/\\n/g, '\n').trim();
    keyObject = createKeyObject(pem);
    source = 'internal';
  }
  if (!keyObject) {
    throw new Error('公钥解析失败');
  }

  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;
  if (typeof modulusBits !== 'number' || !Number.isInteger(modulusBits) || modulusBits <= 0) {
    console.error('[encrypt] invalid modulusLength:', modulusBits);
    console.error('[encrypt] keyDetails:', JSON.stringify(keyObject.asymmetricKeyDetails));
    // 回退内置公钥再试
    if (source !== 'internal') {
      const fallbackPem = rsaKeys.publicKey.replace(/\\n/g, '\n').trim();
      const fallbackKey = createKeyObject(fallbackPem);
      const fallbackBits =
        fallbackKey?.asymmetricKeyDetails?.modulusLength ??
        (fallbackKey as any)?.asymmetricKeySize ??
        0;
      if (fallbackKey && typeof fallbackBits === 'number' && fallbackBits > 0) {
        return encryptWithKey(fallbackKey, req, debug);
      }
    }
    throw new Error('密钥模长无效');
  }

  return encryptWithKey(keyObject, req, debug);
};

const encryptWithKey = (
  keyObject: crypto.KeyObject,
  req: Record<string, any>,
  debug: boolean,
): string => {
  const modulusBits =
    keyObject.asymmetricKeyDetails?.modulusLength ?? (keyObject as any).asymmetricKeySize ?? 0;
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
