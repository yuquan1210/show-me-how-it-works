import { test } from "node:test";
import assert from "node:assert/strict";
import { zoomStep, frameBounds } from "../src/camera.js";

test("detail lock preserves every level while allowing zoom in and out", () => {
  for (const mode of ["overview", "architecture", "functions"]) {
    assert.deepEqual(zoomStep(mode, 1, 1.5, true), { mode, relativeScale: 1.5 });
    assert.deepEqual(zoomStep(mode, 1, 0.5, true), { mode, relativeScale: 0.5 });
    assert.deepEqual(zoomStep(mode, 1, 0.01, true), { mode, relativeScale: 0.25 });
    assert.deepEqual(zoomStep(mode, 1, 100, true), { mode, relativeScale: 3 });
  }
  assert.equal(zoomStep("architecture", 1, 1.5, false).mode, "functions");
});

test("semantic transitions reset framing instead of retaining extreme scales", () => {
  assert.deepEqual(zoomStep("architecture", 1, 0.7), {
    mode: "overview",
    relativeScale: 1,
  });
  assert.deepEqual(zoomStep("architecture", 1, 1.4), {
    mode: "functions",
    relativeScale: 1,
  });
  assert.equal(zoomStep("functions", 1, 1.05).mode, "functions");
  assert.equal(zoomStep("overview", 1, 0.95).mode, "overview");
});
test("system overview cannot be zoomed away into invisibility", () => {
  assert.equal(zoomStep("overview", 0.82, 0.1).relativeScale, 0.82);
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
