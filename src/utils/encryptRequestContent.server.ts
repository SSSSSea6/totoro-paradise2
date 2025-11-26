import crypto from 'crypto';
import rsaKeys from '../data/rsaKeys';

const buildPrivateKeyPem = (): string => {
  const envB64 = process.env.PRIVATE_KEY_BASE64;
  const envPem = process.env.PRIVATE_KEY;
  let pem = '';
  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
  } else if (envPem) {
    pem = envPem;
  } else {
    pem = rsaKeys.privateKey;
  }
  return pem.replace(/\\n/g, '\n').trim();
};

const encryptRequestContent = (req: Record<string, any>): string => {
  const keyPem = buildPrivateKeyPem();
  const keyObject = crypto.createPrivateKey(keyPem);
  const keySize = keyObject.asymmetricKeySize; // in bytes
  const maxChunkSize = keySize - 11; // PKCS#1 v1.5 padding overhead

  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const chunks: Buffer[] = [];

  for (let offset = 0; offset < buffer.length; offset += maxChunkSize) {
    const chunk = buffer.slice(offset, offset + maxChunkSize);
    const encryptedChunk = crypto.privateEncrypt(
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
