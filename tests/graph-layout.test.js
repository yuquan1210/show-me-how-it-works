import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph, systemGraph } from "../src/graph-layout.js";
import { createDemo, applyLargeDemoChange } from "../src/demo.js";

test("a skewed service-only project packs across rows and columns", () => {
  const items = Array.from({ length: 48 }, (_, i) => ({
    id: `service-${i}`,
    layer: "service",
  }));
  const layout = layoutGraph(items, []);
  assert.ok(new Set(layout.map((n) => n.x)).size > 4);
  assert.ok(new Set(layout.map((n) => n.y)).size < 12);
  assert.equal(new Set(layout.map((n) => `${n.x},${n.y}`)).size, 48);
});
test("dependencies are ordered, cycles terminate, and additions preserve positions", () => {
  const items = [{ id: "end" }, { id: "middle" }, { id: "entry" }];
  const layout = layoutGraph(items, [
    ["entry", "middle"],
    ["middle", "end"],
  ]);
  const pos = new Map(layout.map((n) => [n.id, { x: n.x, y: n.y }]));
  assert.ok(pos.get("entry").x < pos.get("middle").x);
  const added = layoutGraph([...items, { id: "new" }], [["end", "entry"]], {
    previous: pos,
  });
  for (const n of layout)
    assert.deepEqual(
      added.find((m) => m.id === n.id),
      n,
    );
  assert.equal(new Set(added.map((n) => `${n.x},${n.y}`)).size, 4);
});
test("system view groups application areas rather than imposing technical layers", () => {
  const graph = systemGraph(createDemo());
  assert.ok(graph.items.some((n) => n.title === "Identity"));
  assert.ok(graph.items.some((n) => n.title === "Catalog & inventory"));
  assert.ok(graph.items.every((n) => n.members.length));
  const ids = new Set(graph.items.map((n) => n.id));
  assert.ok(graph.edges.every((e) => e.every((id) => ids.has(id))));
  const large = systemGraph(applyLargeDemoChange(createDemo()));
  assert.equal(large.items.length, graph.items.length);
});
test("local domain folders group components across technical layers", () => {
  const graph = systemGraph({
    kind: "local",
    nodes: [
      { id: "a", source: "src/orders/services/create.ts", status: "unchanged" },
      {
        id: "b",
        source: "src/orders/repositories/save.ts",
        status: "unchanged",
      },
    ],
    edges: [["a", "b"]],
  });
  assert.equal(graph.items.length, 1);
  assert.equal(graph.items[0].title, "Orders");
});
