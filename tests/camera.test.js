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

test('framing avoids floating windows at their current positions', async () => {
  const {frameAroundPanels} = await import('../src/camera.js');
  const bounds = {left:-40, top:10, right:1104, bottom:650};
  const viewport = {width:1440, height:1000};
  for (const panels of [
    [{left:76, top:92, right:326, bottom:800}, {left:1004, top:90, right:1424, bottom:200}],
    [{left:530, top:120, right:790, bottom:600}, {left:100, top:800, right:1340, bottom:980}],
  ]) {
    const f = frameAroundPanels(bounds, viewport, panels);
    const r = {left:f.x+bounds.left*f.scale, top:f.y+bounds.top*f.scale, right:f.x+bounds.right*f.scale, bottom:f.y+bounds.bottom*f.scale};
    assert.ok(r.left>=0 && r.top>=0 && r.right<=viewport.width && r.bottom<=viewport.height);
    for (const panel of panels)
      assert.ok(r.right<=panel.left || r.left>=panel.right || r.bottom<=panel.top || r.top>=panel.bottom);
  }
});
