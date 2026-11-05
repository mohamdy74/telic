/** CRC-32 (IEEE 802.3, reflected). */
export function crc32(bytes: Uint8Array): number {
  void bytes; // RED stub
  return 0;
}

/** STORE-method ZIP archive: local headers + central directory + EOCD, UTF-8 names. */
export function zipFiles(
  files: { name: string; data: Uint8Array }[],
  at: Date = new Date(),
): Uint8Array {
  void files; // RED stub
  void at;
  return new Uint8Array(0);
}
