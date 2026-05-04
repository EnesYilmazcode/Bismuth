// Credit
// https://github.com/seasick/openscad-web-gui/blob/main/src/lib/WorkspaceFile.ts

export default class WorkspaceFile extends File {
  public path?: string;

  constructor(
    fileBits: BlobPart[],
    fileName: string,
    options?: FilePropertyBag & { path?: string },
  ) {
    super(fileBits, fileName, options);

    this.path = options?.path || fileName;
  }
}
