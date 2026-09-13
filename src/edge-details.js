// Keep dependency evidence separate from inferred business intent.
export function edgeDetails(model, level, fromId, toId) {
  if (level === "overview") return null;
  const functions = model.nodes.flatMap((node) =>
    node.functionDetails.map((fn, index) => ({
      ...fn,
      parentId: node.id,
      parentTitle: node.title,
      index,
    })),
  );
  const entities = level === "functions" ? functions : model.nodes;
  const edges = level === "functions" ? model.functionEdges || [] : model.edges;
  if (!edges.some(([a, b]) => a === fromId && b === toId)) return null;
  const from = entities.find((n) => n.id === fromId);
  const to = entities.find((n) => n.id === toId);
  if (!from || !to) return null;
  const calls = (model.functionEdges || []).flatMap(([a, b]) => {
    const caller = functions.find((n) => n.id === a);
    const callee = functions.find((n) => n.id === b);
    if (!caller || !callee) return [];
    const matches =
      level === "functions"
        ? a === fromId && b === toId
        : caller.parentId === fromId && callee.parentId === toId;
    return matches ? [{ caller, callee }] : [];
  });
  const curated = model.kind === "demo";
  const purpose =
    curated && fromId === "orders" && toId === "inventory"
      ? "Checks stock before checkout, holds the requested units to avoid overselling, and releases reservations if checkout fails."
      : calls.length
        ? [...new Set(calls.map(({ callee }) => callee.summary))].join(" ")
        : "This component imports the destination module. A function call has not been resolved, so the reason for this dependency is not yet known.";
  const callees = [
    ...new Map(calls.map(({ callee }) => [callee.id, callee])).values(),
  ];
  return {
    from,
    to,
    calls,
    purpose,
    evidence: curated
      ? "Curated sample"
      : calls.length
        ? "Resolved calls · purpose inferred from callee behavior"
        : "Import dependency only · call purpose unknown",
    inputs: [...new Set(callees.flatMap((fn) => fn.inputs || []))],
    outputs: [...new Set(callees.flatMap((fn) => fn.outputs || []))],
    effects: [...new Set(callees.flatMap((fn) => fn.effects || []))],
  };
}
