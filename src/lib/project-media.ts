export function isVideoSource(source: string): boolean {
  try {
    return /\.(mp4|webm|mov)$/i.test(decodeURIComponent(new URL(source, "https://assets.invalid").pathname));
  } catch {
    return false;
  }
}
