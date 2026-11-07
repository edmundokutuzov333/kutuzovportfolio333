import test from "node:test";
import assert from "node:assert/strict";
import { inspectArtworkBytes, isMp4Source } from "./project-media.mjs";

function mp4() {
  const bytes = new Uint8Array(28);
  new DataView(bytes.buffer).setUint32(0, 24);
  bytes.set(new TextEncoder().encode("ftypisom"), 4);
  bytes.set(new TextEncoder().encode("isommp42"), 16);
  return bytes;
}

test("classifies signed and encoded MP4 URLs without matching query text", () => {
  assert.equal(isMp4Source("https://example.com/video%2EMP4?download=1#t=2"), true);
  assert.equal(isMp4Source("https://example.com/image.webp?name=video.mp4"), false);
});
test("accepts a genuine MP4 response and verifies its manifest size", () => {
  assert.equal(inspectArtworkBytes("/clip.mp4", "video/mp4; charset=binary", mp4(), 28), "video");
  assert.throws(() => inspectArtworkBytes("/clip.mp4", "video/mp4", mp4(), 100), /expected 100/);
});
test("rejects HTML, MIME mismatches, truncated and forged video responses", () => {
  assert.throws(() => inspectArtworkBytes("/clip.mp4", "text/html", mp4()), /video\/mp4/);
  assert.throws(() => inspectArtworkBytes("/image.webp", "video/mp4", mp4()), /image bytes/);
  assert.throws(() => inspectArtworkBytes("/clip.mp4", "video/mp4", new Uint8Array(10)), /Truncated/);
  assert.throws(() => inspectArtworkBytes("/clip.mp4", "video/mp4", new TextEncoder().encode("<html>not an mp4 response</html>")), /Invalid/);
});
test("preserves image MIME and length verification", () => {
  assert.equal(inspectArtworkBytes("/image.webp", "image/webp", new Uint8Array([1,2,3]), 3), "image");
  assert.throws(() => inspectArtworkBytes("/image.webp", "text/html", new Uint8Array([1])), /image bytes/);
  assert.throws(() => inspectArtworkBytes("/image.webp", "image/webp", new Uint8Array()), /Empty/);
});
