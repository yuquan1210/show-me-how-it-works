// Runtime boundaries are a separate perspective, never a semantic zoom level.
export function architectureGraph(model) {
  const groups = new Map(), owners = new Map();
  for (const n of model.nodes) {
    let id, title, type;
    if (model.kind === "demo") {
      [id, title, type] = n.id === "db"
        ? ["data", "Application database", "Data store"]
        : n.layer === "external"
          ? [n.id, n.title, "External system"]
          : ["backend", "Commerce backend", "Application"];
    } else {
      const path = n.source || n.id;
      const frontend = /(^|\/)(frontend|client|web|ui)(\/|$)/i.test(path);
      const backend = /(^|\/)(backend|server|api)(\/|$)/i.test(path);
      [id, title, type] = frontend
        ? ["frontend", "Frontend", "Inferred application"]
        : backend ? ["backend", "Backend", "Inferred application"]
          : ["unassigned", "Unassigned runtime", "Boundary unknown"];
    }
    const key = "runtime:" + id;
    if (!groups.has(key)) groups.set(key, {
      id: key, title, type, runtime: true, group: true, members: [], functions: [],
      layer: type === "External system" ? "external" : "service",
      icon: type === "Data store" ? "database" : type === "External system" ? "cloud" : "box",
      status: "unchanged",
    });
    const g = groups.get(key);
    g.members.push(n.id);
    if (n.status !== "unchanged") g.status = "modified";
    owners.set(n.id, key);
  }
  return {
    items: [...groups.values()].map(g => ({...g, summary: `${g.members.length} components · ${model.kind === "demo" ? "Curated sample boundary" : g.type === "Boundary unknown" ? "Runtime cannot be determined" : "Inferred from folder names"}`})),
    edges: [...new Map(model.edges.flatMap(([a,b]) => {
      const from = owners.get(a), to = owners.get(b);
      return from && to && from !== to ? [[JSON.stringify([from,to]), [from,to]]] : [];
    })).values()],
  };
}
