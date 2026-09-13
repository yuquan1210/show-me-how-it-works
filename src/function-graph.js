// Functions are first-class graph entities; component ownership is metadata.
export function functionItems(model, layers) {
  const rows = {};
  return model.nodes.flatMap((parent) =>
    parent.functionDetails.map((fn, functionIndex) => {
      const row = rows[parent.layer] || 0;
      rows[parent.layer] = row + 1;
      return {
        ...fn,
        id: fn.id,
        parentId: parent.id,
        parentTitle: parent.title,
        functionIndex,
        isFunction: true,
        layer: parent.layer,
        status:
          parent.status === "removed" ? "removed" : fn.status || parent.status,
        icon: "braces",
        functions: [],
        x: layers.indexOf(parent.layer) * 290,
        y: 68 + row * 132,
      };
    }),
  );
}
