// Technical layers describe nodes; they do not dictate their position.
export function layoutGraph(
  items,
  edges,
  { compact = false, previous = new Map() } = {},
) {
  const ids = new Set(items.map((n) => n.id));
  const incoming = new Map(items.map((n) => [n.id, 0]));
  const outgoing = new Map(items.map((n) => [n.id, []]));
  for (const [a, b] of edges)
    if (ids.has(a) && ids.has(b) && a !== b) {
      incoming.set(b, incoming.get(b) + 1);
      outgoing.get(a).push(b);
    }
  const byId = new Map(items.map((n) => [n.id, n]));
  const compare = (a, b) => {
    const x = byId.get(a),
      y = byId.get(b);
    return (
      (x.parentId || "").localeCompare(y.parentId || "") || a.localeCompare(b)
    );
  };
  const queue = items
    .filter((n) => !incoming.get(n.id))
    .map((n) => n.id)
    .sort(compare);
  const ordered = [],
    seen = new Set();
  while (ordered.length < items.length) {
    if (!queue.length)
      queue.push(
        items
          .map((n) => n.id)
          .filter((id) => !seen.has(id))
          .sort(compare)[0],
      );
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(byId.get(id));
    for (const next of outgoing.get(id)) {
      incoming.set(next, incoming.get(next) - 1);
      if (!incoming.get(next)) queue.push(next);
    }
  }
  const rowHeight = compact ? 148 : 194;
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt((items.length * rowHeight * 1.6) / 300)),
  );
  const occupied = new Set();
  const positions = new Map();
  // Preserve existing boxes, including removed comparison boxes. New boxes use free slots.
  for (const n of items)
    if (previous.has(n.id)) {
      const pos = previous.get(n.id);
      positions.set(n.id, pos);
      occupied.add(`${pos.x},${pos.y}`);
    }
  let slot = 0;
  for (const n of ordered) {
    if (positions.has(n.id)) continue;
    let pos;
    do {
      const row = Math.floor(slot / columns),
        column = slot % columns;
      // Snake ordering keeps the end of one row near the start of the next.
      pos = {
        x: (row % 2 ? columns - column - 1 : column) * 300,
        y: 36 + row * rowHeight,
      };
      slot++;
    } while (occupied.has(`${pos.x},${pos.y}`));
    positions.set(n.id, pos);
    occupied.add(`${pos.x},${pos.y}`);
  }
  return items.map((n) => ({ ...n, ...positions.get(n.id) }));
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
        functions: [],
        status: "unchanged",
      });
    const group = groups.get(id);
    group.members.push(n.id);
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
      summary: `${n.members.length} components · ${model.kind === "demo" ? "Application area" : "Inferred from paths"}`,
    })),
    edges,
  };
}
