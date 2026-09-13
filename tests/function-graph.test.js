import { test } from "node:test";
import assert from "node:assert/strict";
import { functionItems } from "../src/function-graph.js";
import { createDemo, applyDemoChange } from "../src/demo.js";
import { analyzeFiles } from "../src/analyzer.js";
const layers = ["controller", "service", "repository", "external"];

test("every function is a separate entity with selection context and valid edges", () => {
  for (const model of [createDemo(), applyDemoChange(createDemo())]) {
    const items = functionItems(model, layers);
    assert.equal(
      items.length,
      model.nodes.reduce((n, c) => n + c.functionDetails.length, 0),
    );
    const ids = new Set(items.map((n) => n.id));
    assert.equal(ids.size, items.length);
    for (const item of items) {
      const parent = model.nodes.find((n) => n.id === item.parentId);
      assert.equal(
        parent.functionDetails[item.functionIndex].title,
        item.title,
      );
    }
    for (const edge of model.functionEdges)
      for (const id of edge) assert.ok(ids.has(id), id);
  }
});

test("resolves actual calls including import aliases without inventing object calls", () => {
  const model = analyzeFiles([
    {
      path: "controllers/orders.ts",
      text: "import {save as persist} from '../repositories/orders.js'; export function submit(){ return persist(); } export function other(x){ x.save(); }",
    },
    {
      path: "repositories/orders.ts",
      text: "export function save(){ return true; }",
    },
  ]);
  assert.deepEqual(model.functionEdges, [
    ["controllers/orders.ts#submit:0", "repositories/orders.ts#save:0"],
  ]);
});

test("same-named methods stay separate and no function list is truncated", () => {
  const model = analyzeFiles([
    {
      path: "app.ts",
      text:
        "class A { run() {} } class B { run() {} } " +
        Array.from({ length: 7 }, (_, i) => `function fn${i}(){}`).join(" "),
    },
  ]);
  const items = functionItems(model, layers);
  assert.equal(items.length, 9);
  assert.equal(new Set(items.map((n) => n.id)).size, 9);
});
