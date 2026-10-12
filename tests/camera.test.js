import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomStep, frameBounds } from "../src/camera.js";

test("zoom preserves every manually selected level in both directions", () => {
  for (const mode of ["overview", "architecture", "functions"]) {
    assert.deepEqual(zoomStep(mode, 1, 1.5), { mode, relativeScale: 1.5 });
    assert.deepEqual(zoomStep(mode, 1, 0.5), { mode, relativeScale: 0.5 });
    assert.deepEqual(zoomStep(mode, 1, 0.01), { mode, relativeScale: 0.1 });
    assert.deepEqual(zoomStep(mode, 1, 100), { mode, relativeScale: 8 });
  }
});
test("both graph layouts fit their real bounds with viewport padding", () => {
  for (const bottom of [260, 900]) {
    const bounds = { left: 0, top: 10, right: 1104, bottom };
    const viewport = { width: 1000, height: 640 };
    const f = frameBounds(bounds, viewport);
    assert.ok(f.x >= 28 - 0.001);
    assert.ok(f.y + bounds.top * f.scale >= 60 - 0.001);
    assert.ok(f.x + bounds.right * f.scale <= 972 + 0.001);
    assert.ok(f.y + bounds.bottom * f.scale <= 540 + 0.001);
  }
});
