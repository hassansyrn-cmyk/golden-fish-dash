const BOSS_GAMMA_LUT = Uint8Array.from({ length: 256 }, (_, channel) =>
  Math.min(255, Math.round(255 * Math.pow(channel / 255, 0.60))),
);

/** Transform the top video frame in place using the stacked lower-frame matte. */
export function transformBossVideoPixels(pixels: Uint8ClampedArray, alphaOffset: number): void {
  for (let index = 0; index < alphaOffset; index += 4) {
    const matte = pixels[alphaOffset + index];
    if (matte <= 48) {
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
      pixels[index + 3] = 0;
      continue;
    }
    pixels[index] = BOSS_GAMMA_LUT[pixels[index]];
    pixels[index + 1] = BOSS_GAMMA_LUT[pixels[index + 1]];
    pixels[index + 2] = BOSS_GAMMA_LUT[pixels[index + 2]];
    pixels[index + 3] = 255;
  }
}
