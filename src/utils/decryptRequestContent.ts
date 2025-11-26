import decryptServer from './decryptRequestContent.server';
import decryptClient from './decryptRequestContent.client';

const decryptRequestContent = (req: string): Record<string, unknown> => {
  if (process.server) {
    return decryptServer(req);
  }
  return decryptClient(req);
};

export default decryptRequestContent;

