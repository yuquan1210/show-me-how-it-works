// Layered dependency layout with bounded stage height and barycentric ordering.
export function layoutGraph(
  items,
  edges,
  { compact = false, previous = new Map() } = {},
) {
  if (!items.length) return [];
  // Reuse a complete view while highlighting, inspecting, or applying metadata changes.
  if (items.every((n) => previous.has(n.id)) && previous.size === items.length)
    return items.map((n) => ({ ...n, ...previous.get(n.id) }));
  const ids = new Set(items.map((n) => n.id));
  const incoming = new Map(items.map((n) => [n.id, []]));
  const outgoing = new Map(items.map((n) => [n.id, []]));
  for (const [a, b] of edges)
    if (ids.has(a) && ids.has(b) && a !== b) {
      incoming.get(b).push(a);
      outgoing.get(a).push(b);
    }
  const degree = new Map(items.map((n) => [n.id, incoming.get(n.id).length]));
  const rank = new Map(items.map((n) => [n.id, 0])),
    visited = new Set();
  const queue = items.filter((n) => !degree.get(n.id)).map((n) => n.id);
  while (visited.size < items.length) {
    if (!queue.length) queue.push(items.find((n) => !visited.has(n.id)).id);
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    for (const b of outgoing.get(id))
      if (!visited.has(b)) {
        rank.set(b, Math.max(rank.get(b), rank.get(id) + 1));
        degree.set(b, degree.get(b) - 1);
        if (!degree.get(b)) queue.push(b);
      }
  }
  const stages = [];
  for (const n of items) (stages[rank.get(n.id)] ||= []).push(n);
  const order = new Map();
  for (const stage of stages) stage?.forEach((n, i) => order.set(n.id, i));
  for (let sweep = 0; sweep < 4; sweep++) {
    const forward = sweep % 2 === 0;
    const indices = stages.map((_, i) => i);
    if (!forward) indices.reverse();
    for (const i of indices) {
      const stage = stages[i];
      if (!stage) continue;
      const bary = (n) => {
        const neighbors = (forward ? incoming : outgoing).get(n.id);
        return neighbors.length
          ? neighbors.reduce((s, id) => s + (order.get(id) || 0), 0) /
              neighbors.length
          : order.get(n.id) || 0;
      };
      stage.sort((a, b) => bary(a) - bary(b));
      stage.forEach((n, j) => order.set(n.id, j));
    }
  }
  const maxRows = Math.max(3, Math.ceil(Math.sqrt(items.length)));
  const defaultHeight = compact ? 116 : 172;
  const stageData = stages.filter(Boolean).map((stage) => {
    const columns = Math.ceil(stage.length / maxRows),
      rows = Math.ceil(stage.length / columns);
    const cellWidth = Math.max(...stage.map((n) => n.width || 234));
    const cellHeight = Math.max(...stage.map((n) => n.height || defaultHeight));
    return {
      stage,
      columns,
      rows,
      cellWidth,
      cellHeight,
      height: rows * (cellHeight + 44) - 44,
    };
  });
  const totalHeight = Math.max(...stageData.map((s) => s.height));
  let x = 24;
  const result = new Map();
  for (const s of stageData) {
    s.stage.forEach((n, i) =>
      result.set(n.id, {
        ...n,
        x: x + Math.floor(i / s.rows) * (s.cellWidth + 70),
        y:
          54 +
          (totalHeight - s.height) / 2 +
          (i % s.rows) * (s.cellHeight + 44),
      }),
    );
    x += s.columns * (s.cellWidth + 70) + 40;
  }
  return items.map((n) => result.get(n.id));
}

export function functionLayout(items, edges, options = {}) {
  const groups = new Map();
  for (const fn of items) {
    if (!groups.has(fn.parentId))
      groups.set(fn.parentId, {
        id: fn.parentId,
        title: fn.parentTitle,
        children: [],
      });
    groups.get(fn.parentId).children.push(fn);
  }
  const owners = new Map(items.map((n) => [n.id, n.parentId]));
  const links = [
    ...new Map(
      edges.flatMap(([a, b]) => {
        const x = owners.get(a),
          y = owners.get(b);
        return x && y && x !== y ? [[JSON.stringify([x, y]), [x, y]]] : [];
      }),
    ).values(),
  ];
  const parents = [...groups.values()].map((g) => {
    const columns = g.children.length > 4 ? 2 : 1;
    return {
      ...g,
      columns,
      width: columns * 260 + 24,
      height: Math.ceil(g.children.length / columns) * 140 + 48,
    };
  });
  const laid = layoutGraph(parents, links);
  return {
    items: laid.flatMap((g) =>
      g.children.map((n, i) => ({
        ...n,
        x: g.x + 24 + (i % g.columns) * 260,
        y: g.y + 40 + Math.floor(i / g.columns) * 140,
      })),
    ),
    groups: laid,
  };
}

export function focusGraph(graph, workflow) {
  if (!workflow) return { ...graph, hidden: 0 };
  const items = graph.items.filter((n) =>
    n.group
      ? (n.focusMembers || n.members).some((id) => workflow.nodes.includes(id))
      : n.isComponent ? (n.implementationMembers.length ? n.implementationMembers : n.members).some(id=>workflow.nodes.includes(id))
        : workflow.nodes.includes(n.sourceModule || n.parentId || n.id),
  );
  const ids = new Set(items.map((n) => n.id));
  return {
    items,
    edges: graph.edges.filter(([a, b]) => ids.has(a) && ids.has(b)),
    hidden: graph.items.length - items.length,
  };
}

// Use the shortest clear orthogonal candidate; route long skips through free gutters.
export function routeEdge(source, target, items, { compact = false } = {}) {
  const sx = source.x + 234,
    sy = source.y + 58,
    tx = target.x,
    ty = target.y + 58;
  const obstacles = items
    .filter((n) => n.id !== source.id && n.id !== target.id)
    .map((n) => ({
      left: n.x - 8,
      right: n.x + 242,
      top: n.y - 8,
      bottom: n.y + (compact ? 116 : 172) + 8,
    }));
  const clear = (points) =>
    points.slice(1).every((b, i) => {
      const a = points[i];
      return !obstacles.some((r) =>
        a[0] === b[0]
          ? a[0] > r.left &&
            a[0] < r.right &&
            Math.max(a[1], b[1]) > r.top &&
            Math.min(a[1], b[1]) < r.bottom
          : a[1] > r.top &&
            a[1] < r.bottom &&
            Math.max(a[0], b[0]) > r.left &&
            Math.min(a[0], b[0]) < r.right,
      );
    });
  const candidates = [];
  if (tx > sx)
    candidates.push([
      [sx, sy],
      [(sx + tx) / 2, sy],
      [(sx + tx) / 2, ty],
      [tx, ty],
    ]);
  const lanes = [
    Math.min(source.y, target.y) - 20,
    ...items.flatMap((n) => [n.y - 20, n.y + (compact ? 116 : 172) + 20]),
  ];
  for (const y of lanes)
    candidates.push([
      [sx, sy],
      [sx + 20, sy],
      [sx + 20, y],
      [tx - 20, y],
      [tx - 20, ty],
      [tx, ty],
    ]);
  const valid = candidates.filter(clear);
  const length = (p) =>
    p
      .slice(1)
      .reduce(
        (sum, b, i) =>
          sum + Math.abs(b[0] - p[i][0]) + Math.abs(b[1] - p[i][1]),
        0,
      );
  valid.sort((a, b) => length(a) - length(b));
  const points = valid[0] || candidates.at(-1);
  return points.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ");
}

const technical =
  /^(src|app|apps|lib|server|client|api|features|modules|packages|controllers?|services?|repositories|repository|routes?|models?|components?|utils?|handlers?)$/i;
function areaName(node, demo) {
  if (demo) {
    if (["auth-api", "users", "customers", "identity-store"].includes(node.id))
      return "Identity";
    if (["catalog-api", "inventory", "stock-store"].includes(node.id))
      return "Catalog & inventory";
    if (
      [
        "order-api",
        "orders",
        "order-store",
        "deduplicate",
        "fulfillment",
        "audit-store",
      ].includes(node.id)
    )
      return "Checkout & fulfillment";
    if (node.id === "payment") return "Payments";
    if (["email", "notification-hub"].includes(node.id)) return "Notifications";
    return "Shared storage";
  }
  const parts = (node.source || node.id).split("/");
  const folder = parts.slice(0, -1).find((p) => !technical.test(p));
  if(!folder&&node.isComponent)return node.title;
  const base =
    folder ||
    parts
      .at(-1)
      .replace(/\.[^.]+$/, "")
      .replace(
        /[._-]?(controller|service|repository|routes?|model|handler)s?$/i,
        "",
      );
  return (base || node.title)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}
export function systemGraph(model) {
  const groups = new Map(),
    owners = new Map();
  for (const n of model.nodes) {
    const title = areaName(n, model.kind === "demo"),
      id = "system:" + title;
    if (!groups.has(id))
      groups.set(id, {
        id,
        title,
        layer: n.layer,
        icon: "box",
        group: true,
        members: [],
        focusMembers: [],
        componentIds: [],
        functions: [],
        status: "unchanged",
      });
    const group = groups.get(id);
    group.members.push(...(n.isComponent ? n.members : [n.id]));
    group.focusMembers.push(...(n.isComponent ? n.implementationMembers.length ? n.implementationMembers : n.members : [n.id]));
    group.componentIds.push(n.id);
    if (n.status !== "unchanged") group.status = "modified";
    owners.set(n.id, id);
  }
  const edges = [
    ...new Map(
      model.edges.flatMap(([a, b]) => {
        const from = owners.get(a),
          to = owners.get(b);
        return from && to && from !== to
          ? [[JSON.stringify([from, to]), [from, to]]]
          : [];
      }),
    ).values(),
  ];
  return {
    items: [...groups.values()].map((n) => ({
      ...n,
      members: [...new Set(n.members)], focusMembers: [...new Set(n.focusMembers)],
      status: n.componentIds.every(id => model.nodes.find(m => m.id === id)?.status === "added") ? "added"
        : n.componentIds.every(id => model.nodes.find(m => m.id === id)?.status === "removed") ? "removed" : n.status,
      impact: model.nodes.some(m=>n.componentIds.includes(m.id) && m.impact==="possible") && model.nodes.filter(m=>n.componentIds.includes(m.id) && m.status!=="unchanged").every(m=>m.impact==="possible") ? "possible" : "within",
      summary: `${n.componentIds.length} components · ${model.kind === "demo" ? "Application area" : "Inferred from paths"}`,
    })),
    edges,
  };
}
