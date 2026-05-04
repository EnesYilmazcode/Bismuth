import OpenSCADError from '@/lib/OpenSCADError';
import OpenSCADWrapper from './openSCAD';
import {
  FileSystemWorkerMessageData,
  OpenSCADWorkerMessageData,
  OpenSCADWorkerResponseData,
  WorkerMessage,
  WorkerResponseMessage,
} from './types';

// Credit
// https://github.com/seasick/openscad-web-gui/blob/main/src/worker.mts

const openscad = new OpenSCADWrapper();

// Handle messages from the main thread
self.onmessage = async (
  event: MessageEvent<WorkerMessage & { id: string }>,
) => {
  const { id, type, data } = event.data;

  try {
    let result:
      | OpenSCADWorkerResponseData
      | FileSystemWorkerMessageData
      | boolean
      | null = null;
    switch (type) {
      case 'preview':
        result = await openscad.preview(data as OpenSCADWorkerMessageData);
        break;
      case 'export':
        result = await openscad.exportFile(data as OpenSCADWorkerMessageData);
        break;
      case 'fs.read':
        result = await openscad.readFile(data as FileSystemWorkerMessageData);
        break;
      case 'fs.write':
        result = await openscad.writeFile(data as FileSystemWorkerMessageData);
        break;
      case 'fs.unlink':
        result = await openscad.unlinkFile(data as FileSystemWorkerMessageData);
        break;
    }

    const response: WorkerResponseMessage = {
      id,
      type,
      data: result,
    };

    self.postMessage(response);
  } catch (error) {
    let err: Error | OpenSCADError;
    if (error instanceof OpenSCADError) {
      err = {
        name: 'OpenSCADError',
        message: error.message,
        code: error.code,
        stdErr: error.stdErr,
      };
    } else {
      err = error instanceof Error ? error : new Error('Unknown error');
    }
    const response: WorkerResponseMessage = {
      id,
      type,
      data: null,
      err,
    };
    self.postMessage(response);
  }
};
