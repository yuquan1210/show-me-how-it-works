import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFiles, diffModels, isSource } from "../src/analyzer.js";

const files = [
  {
    path: "controllers/orders.ts",
    text: "import {createOrder} from '../services/orders.js'; export async function submitOrder(customerId: string, items: string[]) { if (!items.length) throw new Error('Empty'); return await createOrder(items); }",
  },
  {
    path: "services/orders.ts",
    text: "import {save} from '../repositories/orders'; export const createOrder = (items: string[]) => { return save({items}); };",
  },
  {
    path: "repositories/orders.ts",
    text: 'export function save(order) { return {id: 1, status: "confirmed"}; }',
  },
  { path: "tests/orders.test.ts", text: "export function fakeTest() {}" },
];
test("extracts functions and relative dependencies, excluding test files", () => {
  const m = analyzeFiles(files);
  assert.equal(m.nodes.length, 3);
  assert.deepEqual(m.edges, [
    ["controllers/orders.ts", "services/orders.ts"],
    ["services/orders.ts", "repositories/orders.ts"],
  ]);
  assert.equal(m.nodes[0].layer, "controller");
  assert.equal(m.nodes[2].layer, "repository");
  assert.deepEqual(m.nodes[0].functionDetails[0].inputs, [
    "Customer Id",
    "Items",
  ]);
  assert.match(m.nodes[0].functionDetails[0].decisions.join(" "), /error/);
});
test("workflow follows dependencies without looping", () => {
  const m = analyzeFiles(
    [
      ...files,
      {
        path: "services/orders.ts",
        text: "import '../controllers/orders'; export function createOrder() { return true; }",
      },
    ].filter((f, i, a) => a.findLastIndex((x) => x.path === f.path) === i),
  );
  assert.equal(m.workflows[0].nodes.length, 2);
});
test("diff identifies additions, edits, and removals", () => {
  const a = analyzeFiles(files),
    b = analyzeFiles([
      { ...files[0], text: files[0].text + "\nexport function cancel() {}" },
      files[1],
      {
        path: "services/new.ts",
        text: "export function check() { return true; }",
      },
    ]);
  const d = diffModels(a, b);
  assert.equal(
    d.nodes.find((n) => n.id === "controllers/orders.ts").status,
    "modified",
  );
  assert.equal(d.nodes.find((n) => n.id === "services/new.ts").status, "added");
  assert.equal(
    d.nodes.find((n) => n.id === "repositories/orders.ts").status,
    "removed",
  );
  assert.equal(
    d.nodes.find((n) => n.id === "services/orders.ts").status,
    "unchanged",
  );
});
test("unsupported, configuration, dependency, and generated declaration files stay hidden", () => {
  for (const f of [
    "node_modules/pkg/index.js",
    "src/order.spec.ts",
    "vite.config.ts",
    "src/types.d.ts",
    "app.py",
    "dist/app.js",
  ])
    assert.equal(isSource(f), false, f);
  assert.equal(isSource("src/services/orders.ts"), true);
});
test("reports incomplete syntax and handles projects with no functions", () => {
  assert.equal(
    analyzeFiles([{ path: "empty.ts", text: "const x = 1;" }]).nodes.length,
    0,
  );
  const m = analyzeFiles([
    { path: "broken.ts", text: "export function run( { return 1;" },
  ]);
  assert.deepEqual(m.errors, ["broken.ts"]);
});
