import { Buffer as NodeBuffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const rsa = new NodeRSA(NodeBuffer.from(rsaKeys.privateKey, 'utf-8'), 'pkcs8-private-pem', {
    environment: 'node',
  });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipherBuffer = NodeBuffer.from(req, 'base64');
  const decrypted = rsa.decrypt(cipherBuffer, 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
