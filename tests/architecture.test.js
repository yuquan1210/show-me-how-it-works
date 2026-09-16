import test from "node:test";
import assert from "node:assert/strict";
import { architectureGraph } from "../src/architecture.js";
import { behaviorCard, parseBehaviorAnswer, plainBehavior } from "../src/behavior.js";
import { createDemo } from "../src/demo.js";
import { analyzeFiles } from "../src/analyzer.js";

test("sample architecture distinguishes backend, owned data store and external providers", () => {
  const graph = architectureGraph(createDemo());
  assert.equal(graph.items.length, 4);
  assert.equal(graph.items.find(n => n.id === "runtime:data").type, "Data store");
  assert.ok(graph.edges.some(([a,b]) => a === "runtime:backend" && b === "runtime:payment"));
  assert.equal(graph.items.flatMap(n => n.members).length, 12);
});
test("imported boundaries are conservative and do not invent data stores", () => {
  const nodes = ["client/cart.ts", "server/orders.ts", "src/repositories/save.ts"].map(id => ({id, source:id, status:"unchanged"}));
  const graph = architectureGraph({nodes, kind:"local", edges:[[nodes[0].id,nodes[1].id]]});
  assert.deepEqual(graph.items.map(n => n.title), ["Frontend", "Backend", "Unassigned runtime"]);
  assert.equal(graph.edges.length, 1);
});
test("behavior cards surface unknown failure and side effects explicitly", () => {
  const card = behaviorCard({});
  assert.equal(card.length, 5);
  assert.match(card.at(-1)[1][0], /not established/);
  assert.ok(card.every(([,values]) => values.every(v => !plainBehavior(v).includes("omitted"))));
});
test("AI answers require structured plain-language cards, with code withheld", () => {
  assert.throws(() => parseBehaviorAnswer("Here is some prose"));
  assert.throws(() => parseBehaviorAnswer("[]"));
  const card = parseBehaviorAnswer(JSON.stringify({answer:"Checks stock.", changes:"const n = reserve();"}));
  assert.equal(card[0][1], "Checks stock.");
  assert.match(card[1][1], /omitted/);
  assert.match(plainBehavior("```js\nreturn stock;\n```"), /omitted/);
});
test("computed calls and object keys never leak source expressions into behavior labels", () => {
  const model = analyzeFiles([{path:"src/run.ts",text:"export function run() { if ((() => true)()) return { [(() => 'key')()]: 1 }; return (() => 3)(); }"}]);
  const fn = model.nodes[0].functionDetails[0];
  assert.doesNotMatch(JSON.stringify([fn.summary, fn.decisions, fn.outputs]), /=>|\(\)/);
});
