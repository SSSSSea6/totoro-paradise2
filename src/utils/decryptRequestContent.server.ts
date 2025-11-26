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

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const keyPem = buildPrivateKeyPem();
  const keyObject = crypto.createPrivateKey(keyPem);
  const keySize = keyObject.asymmetricKeySize; // in bytes

  const buffer = Buffer.from(req, 'base64');
  if (buffer.length % keySize !== 0) {
    throw new Error('Invalid ciphertext length for RSA block size');
  }

  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += keySize) {
    const chunk = buffer.slice(offset, offset + keySize);
    const decryptedChunk = crypto.privateDecrypt(
      {
        key: keyObject,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      chunk,
    );
    chunks.push(decryptedChunk);
  }

  const plaintext = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(plaintext);
};

export default decryptRequestContent;
