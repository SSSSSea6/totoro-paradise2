import NodeRSA from './nodeRSA';
import rsaKeys from '../data/rsaKeys';

const encryptRequestContent = (req: Record<string, any>): string => {
  const rsa = new NodeRSA(rsaKeys.privateKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  // Some runtimes require Buffer input, otherwise NodeRSA throws “data must be a node Buffer”.
  return rsa.encrypt(Buffer.from(reqStr, 'utf-8'), 'base64');
};

export default encryptRequestContent;

