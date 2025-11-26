import { Buffer as NodeBuffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const encryptRequestContent = (req: Record<string, any>): string => {
  // Force-use Node Buffer and explicit key format to avoid polyfill issues.
  const rsa = new NodeRSA(NodeBuffer.from(rsaKeys.privateKey, 'utf-8'), 'pkcs8-private-pem', {
    environment: 'node',
  });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  return rsa.encrypt(reqStr, 'base64');
};

export default encryptRequestContent;
