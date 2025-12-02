import crypto from "crypto";
import { publicKeyBody } from "../data/rsaKeys";

const encryptRequestContent = (req: Record<string, any>): string => {
  const debug = process.env.ENCRYPT_DEBUG === 'true';
  const raw = Buffer.from(publicKeyBody, 'base64');

  let keyObject: crypto.KeyObject | null = null;
  let lastErr: any = null;

  for (const type of ['spki', 'pkcs1'] as const) {
    try {
      keyObject = crypto.createPublicKey({ key: raw, format: 'der', type });
      if (debug) console.log(`[encrypt] createPublicKey ok with type=${type}`);
      break;
    } catch (error: any) {
      lastErr = error;
      console.error(`[encrypt] createPublicKey (${type}) failed:`, error?.message);
    }
  }

  if (!keyObject) {
    throw new Error('公钥构造失败 ' + (lastErr?.message || 'unknown'));
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
