// Minimal declarations for the two encoders, which ship no types.
//
// ⚠️ Hand-written rather than `declare module "gifenc"` with no shape: a bare
// `any` module would let a typo in an option name through silently, and the
// options are where GIF encoding goes wrong (a wrong `delay` unit produces a
// clip that plays in a blink).

declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number; repeat?: number; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  /** RGBA bytes → up to `maxColors` palette entries. */
  export function quantize(rgba: Uint8Array, maxColors: number): number[][];
  /** RGBA bytes → one palette index per pixel. */
  export function applyPalette(rgba: Uint8Array, palette: number[][]): Uint8Array;

  /** ⚠️ It is CommonJS, so under ESM the names above also arrive here. */
  const _default: {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  };
  export default _default;
}

declare module "upng-js" {
  type Image = { width: number; height: number; depth: number; ctype: number };
  const UPNG: {
    decode(buffer: ArrayBuffer | Buffer | Uint8Array): Image;
    /** One ArrayBuffer of RGBA bytes per frame. */
    toRGBA8(img: Image): ArrayBuffer[];
  };
  export default UPNG;
}

declare module "@ffmpeg-installer/ffmpeg" {
  export const path: string;
  export const version: string;
}
