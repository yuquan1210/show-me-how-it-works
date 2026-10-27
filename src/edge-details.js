// Keep dependency evidence separate from inferred business intent.
import { componentModel } from './components.js';
export function edgeDetails(model, level, fromId, toId) {
  if (level === "overview") return null;
  const view = componentModel(model);
  if(level!=='functions'){
    fromId=view.nodes.find(n=>n.id===fromId||n.implementationMembers?.includes(fromId))?.id||fromId;
    toId=view.nodes.find(n=>n.id===toId||n.implementationMembers?.includes(toId))?.id||toId;
  }
  const functions = view.nodes.flatMap((node) =>
    node.functionDetails.map((fn, index) => ({
      ...fn,
      parentId: node.id,
      parentTitle: node.title,
      index,
    })),
  );
  const entities = level === "functions" ? functions : view.nodes;
  const edges = level === "functions" ? model.functionEdges || [] : view.edges;
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
  const dependencyRecords = (model.coverage?.dependencies || []).filter(d => d.module === fromId && d.to === toId);
  const connection=view.componentConnections?.[JSON.stringify([fromId,toId])];
  const typeOnly = connection?.typeOnly || dependencyRecords.length > 0 && dependencyRecords.every(d => d.typeOnly);
  const reExport = dependencyRecords.some(d => d.kind === 're-export');
  const purpose =
    curated && fromId === "orders" && toId === "inventory"
      ? "Checks stock before checkout, holds the requested units to avoid overselling, and releases reservations if checkout fails."
      : calls.length
        ? [...new Set(calls.map(({ callee }) => callee.summary))].join(" ")
        : typeOnly ? 'This module depends on type declarations from the destination. This does not establish a runtime call.'
          : reExport ? 'This module re-exports the destination for other modules to use. Re-exporting does not establish a direct function call.'
            : connection?.indirect ? 'This component depends on the destination through supporting declarations or public exports. A direct function call has not been established.'
              : "This component imports or loads the destination module. A function call has not been resolved, so the reason for this dependency is not yet known.";
  const callees = [
    ...new Map(calls.map(({ callee }) => [callee.id, callee])).values(),
  ];
  return {
    from,
    to,
    calls,
    supportingPaths: connection?.paths || [],
    purpose,
    evidence: curated
      ? "Curated sample"
      : calls.length
        ? "Resolved calls · purpose inferred from callee behavior"
        : typeOnly ? 'Type-only dependency · no runtime call established'
          : reExport ? 'Re-export dependency · no direct call confirmed' : "Import dependency only · call purpose unknown",
    inputs: [...new Set(callees.flatMap((fn) => fn.inputs || []))],
    outputs: [...new Set(callees.flatMap((fn) => fn.outputs || []))],
    effects: [...new Set(callees.flatMap((fn) => fn.effects || []))],
    failures: curated && fromId === "orders" && toId === "inventory"
      ? ["Insufficient stock stops checkout. Reservations are released if checkout fails."]
      : ["Caller recovery is not established. A failed call may prevent downstream steps."],
  };
}
