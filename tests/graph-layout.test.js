import { test } from "node:test";
import assert from "node:assert/strict";
import {
  layoutGraph,
  systemGraph,
  functionLayout,
  focusGraph,
  routeEdge,
} from "../src/graph-layout.js";
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
test("dependencies are ordered, cycles terminate, and highlighting preserves positions", () => {
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
  const same = layoutGraph(
    items,
    [
      ["entry", "middle"],
      ["middle", "end"],
    ],
    { previous: pos },
  );
  assert.deepEqual(same, layout);
  assert.equal(new Set(added.map((n) => `${n.x},${n.y}`)).size, 4);
});

test("workflow focus collapses unrelated nodes and removes their connections", () => {
  const model = createDemo();
  const result = focusGraph(
    { items: model.nodes, edges: model.edges },
    model.workflows[0],
  );
  assert.equal(result.items.length, 8);
  assert.equal(result.hidden, 4);
  assert.ok(
    result.edges.every(
      ([a, b]) =>
        result.items.some((n) => n.id === a) &&
        result.items.some((n) => n.id === b),
    ),
  );
});

test("function boundaries contain separate nodes without overlap", () => {
  const items = Array.from({ length: 9 }, (_, i) => ({
    id: `f${i}`,
    parentId: i < 6 ? "a" : "b",
    parentTitle: i < 6 ? "A" : "B",
  }));
  const result = functionLayout(items, [["f0", "f6"]]);
  assert.equal(result.groups.length, 2);
  assert.equal(result.items.length, 9);
  for (const n of result.items) {
    const g = result.groups.find((g) => g.id === n.parentId);
    assert.ok(n.x >= g.x && n.x + 234 <= g.x + g.width);
    assert.ok(n.y >= g.y && n.y + 116 <= g.y + g.height);
  }
});

test("long connections route around an intervening card", () => {
  const a = { id: "a", x: 24, y: 54 },
    b = { id: "b", x: 712, y: 54 },
    obstacle = { id: "c", x: 368, y: 54 };
  const d = routeEdge(a, b, [a, obstacle, b]);
  assert.ok(d.includes(" 34"), d);
  assert.ok(d.startsWith("M258 112"));
  assert.ok(d.endsWith("712 112"));
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
