import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDemo,
  applyDemoChange,
  applyLargeDemoChange,
} from "../src/demo.js";
import {
  connectionStatus,
  edgeKey,
  flowDepths,
} from "../src/graph-activity.js";
import { analyzeFiles, diffModels } from "../src/analyzer.js";

test("small and large demos have distinct change footprints and valid connections", () => {
  const base = createDemo();
  const small = applyDemoChange(base),
    large = applyLargeDemoChange(base);
  assert.equal(small.nodes.filter((n) => n.status !== "unchanged").length, 2);
  assert.equal(large.nodes.filter((n) => n.status === "added").length, 5);
  assert.equal(large.nodes.filter((n) => n.status === "modified").length, 6);
  assert.equal(large.nodes.filter((n) => n.status === "removed").length, 2);
  assert.ok(base.nodes.every((n) => n.status === "unchanged"));
  const ids = new Set(
    large.nodes.flatMap((n) => n.functionDetails.map((f) => f.id)),
  );
  assert.ok(large.functionEdges.every((e) => e.every((id) => ids.has(id))));
});

test("workflow waves start at entry points and exclude unrelated and removed nodes", () => {
  const model = createDemo();
  const depths = flowDepths(model.nodes, model.edges, model.workflows[0]);
  assert.equal(depths.get("order-api"), 0);
  assert.equal(depths.get("orders"), 1);
  assert.equal(depths.get("inventory"), 2);
  assert.equal(depths.has("auth-api"), false);
  const large = applyLargeDemoChange(model);
  const changedDepths = flowDepths(
    large.nodes,
    large.edges,
    large.workflows[0],
  );
  assert.equal(changedDepths.has("email"), false);
  assert.ok(changedDepths.has("notification-hub"));
});

test("cycles terminate and affected edges are distinct from removed edges", () => {
  const items = [
    { id: "a", layer: "controller" },
    { id: "b", layer: "service", status: "modified" },
  ];
  assert.equal(
    flowDepths(
      items,
      [
        ["a", "b"],
        ["b", "a"],
      ],
      null,
    ).get("b"),
    1,
  );
  assert.equal(connectionStatus({}, "architecture", ...items), "affected");
  assert.equal(
    connectionStatus(
      { edgeChanges: { [edgeKey("a", "b")]: "removed" } },
      "architecture",
      ...items,
    ),
    "removed",
  );
});

test("live diffs retain deleted connections for one scan", () => {
  const files = [
    {
      path: "a.ts",
      text: "import {run} from './b'; export function start(){ run(); }",
    },
    { path: "b.ts", text: "export function run(){}" },
  ];
  const afterFiles = [
    { ...files[0], text: "export function start(){}" },
    files[1],
  ];
  const changed = diffModels(analyzeFiles(files), analyzeFiles(afterFiles));
  assert.equal(changed.edgeChanges[edgeKey("a.ts", "b.ts")], "removed");
  assert.equal(changed.functionEdges.length, 1);
  const later = diffModels(changed, analyzeFiles(afterFiles));
  assert.equal(later.edges.length, 0);
});
