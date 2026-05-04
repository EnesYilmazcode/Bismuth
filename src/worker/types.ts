import { Parameter } from '@shared/types';
import WorkspaceFile from '../lib/WorkspaceFile.ts';

// Credit
// https://github.com/seasick/openscad-web-gui/blob/main/src/worker/types.ts

export const enum WorkerMessageType {
  PREVIEW = 'preview',
  EXPORT = 'export',
  FS_READ = 'fs.read',
  FS_WRITE = 'fs.write',
  FS_UNLINK = 'fs.unlink',
}

type WorkerMessageDataMap = {
  [WorkerMessageType.PREVIEW]: OpenSCADWorkerMessageData;
  [WorkerMessageType.EXPORT]: OpenSCADWorkerMessageData;
  [WorkerMessageType.FS_READ]: FileSystemWorkerMessageData;
  [WorkerMessageType.FS_WRITE]: FileSystemWorkerMessageData;
  [WorkerMessageType.FS_UNLINK]: FileSystemWorkerMessageData;
};

export type WorkerMessage = {
  id?: string | number;
  type: WorkerMessageType;
  data: WorkerMessageDataMap[WorkerMessage['type']];
};

export type WorkerResponseMessage = {
  id: string | number;
  type: WorkerMessageType;
  data:
    | OpenSCADWorkerResponseData
    | FileSystemWorkerMessageData
    | boolean
    | null;
  err?: Error;
};

export type OpenSCADWorkerMessageData = {
  code: string;
  fileType: string;
  params: Parameter[];
};

export type OpenSCADWorkerResponseData = {
  log: {
    stdErr: string[];
    stdOut: string[];
  };
  fileType: string;
  output: Uint8Array;
  exitCode: number;
  duration: number;
  extraOutputs?: Record<string, Uint8Array>;
};

export type FileSystemWorkerMessageData = {
  path: string;
  content?: WorkspaceFile | ArrayBuffer; // Content is only necessary when writing
  type?: string; // MIME type, needed if content is ArrayBuffer
};
