declare module "sharp" {
  type SharpInput = Buffer | ArrayBuffer | Uint8Array | string;

  interface JpegOptions {
    quality?: number;
    chromaSubsampling?: string;
  }

  interface SharpInstance {
    jpeg(options?: JpegOptions): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }

  interface SharpFactory {
    (input?: SharpInput): SharpInstance;
  }

  const sharp: SharpFactory;
  export default sharp;
}
