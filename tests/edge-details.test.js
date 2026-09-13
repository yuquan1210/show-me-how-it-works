import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../src/demo.js";
import { analyzeFiles } from "../src/analyzer.js";
import { edgeDetails } from "../src/edge-details.js";

test("component purpose explains checkout inventory calls", () => {
  const d = edgeDetails(createDemo(), "architecture", "orders", "inventory");
  assert.match(d.purpose, /avoid overselling/);
  assert.equal(d.calls.length, 3);
  assert.ok(
    d.calls.every(
      ({ caller, callee }) =>
        caller.parentId === "orders" && callee.parentId === "inventory",
    ),
  );
});
test("function edge explains only its callee, and unknown/system edges are excluded", () => {
  const model = createDemo();
  const d = edgeDetails(model, "functions", "orders#1", "inventory#1");
  assert.equal(d.calls.length, 1);
  assert.match(d.purpose, /Holds units/);
  assert.deepEqual(d.outputs, ["Reservation"]);
  assert.equal(edgeDetails(model, "overview", "orders", "inventory"), null);
  assert.equal(edgeDetails(model, "functions", "orders#1", "db#0"), null);
});
test("import-only dependencies do not claim function calls or purpose", () => {
  const model = analyzeFiles([
    { path: "a.ts", text: "import './b'; export function run(){}" },
    { path: "b.ts", text: "export function save(){}" },
  ]);
  const d = edgeDetails(model, "architecture", "a.ts", "b.ts");
  assert.equal(d.calls.length, 0);
  assert.match(d.evidence, /purpose unknown/);
  assert.deepEqual(d.inputs, []);
});
test("local resolved function purposes are explicitly inferred", () => {
  const model = analyzeFiles([
    {
      path: "a.ts",
      text: "import {save} from './b'; export function run(){return save(1)}",
    },
    { path: "b.ts", text: "export function save(value){return value}" },
  ]);
  const d = edgeDetails(model, "architecture", "a.ts", "b.ts");
  assert.equal(d.calls.length, 1);
  assert.match(d.evidence, /inferred/);
  assert.deepEqual(d.inputs, ["Value"]);
});
