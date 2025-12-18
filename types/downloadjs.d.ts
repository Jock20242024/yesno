declare module 'downloadjs' {
  function download(data: string | Blob, filename?: string, mimeType?: string): void;
  export default download;
}
