export const edgeKey = (a, b) => JSON.stringify([a, b]);

export function connectionStatus(model, level, from, to) {
  const explicit =
    model[level === "functions" ? "functionEdgeChanges" : "edgeChanges"]?.[
      edgeKey(from.id, to.id)
    ];
  if (explicit) return explicit;
  if ([from.status, to.status].includes("removed")) return "removed";
  if ([from.status, to.status].includes("added")) return "added";
  if ([from.status, to.status].includes("modified")) return "affected";
  return "unchanged";
}

// Shortest-path waves: branches run together, cycles never loop indefinitely.
export function flowDepths(items, edges, workflow) {
  const visible = items.filter(
    (n) =>
      n.status !== "removed" &&
      (!workflow ||
        workflow.nodes.includes(n.parentId || n.id) ||
        (n.group && n.members?.some((id) => workflow.nodes.includes(id)))),
  );
  const ids = new Set(visible.map((n) => n.id));
  const links = edges.filter(([a, b]) => ids.has(a) && ids.has(b));
  let roots = visible.filter((n) => !links.some(([, b]) => b === n.id));
  const entries = roots.filter((n) => n.layer === "controller");
  if (entries.length) roots = entries;
  if (!roots.length)
    roots = visible.filter((n) => n.layer === "controller").slice(0, 1);
  const depths = new Map(roots.map((n) => [n.id, 0]));
  const queue = roots.map((n) => n.id);
  for (let i = 0; i < queue.length; i++) {
    for (const [a, b] of links)
      if (a === queue[i] && !depths.has(b)) {
        depths.set(b, depths.get(a) + 1);
        queue.push(b);
      }
  }
  return depths;
}
