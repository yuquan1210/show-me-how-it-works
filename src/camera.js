export const detailLevels = ["overview", "architecture", "functions"];

// Detail changes are relative to the framing of each view, never to an
// absolute CSS scale. Function layouts can be larger than system layouts.
export function zoomStep(mode, relativeScale, multiplier, levelLocked = false) {
  const index = detailLevels.indexOf(mode);
  const nextScale = relativeScale * multiplier;
  if (levelLocked)
    return { mode, relativeScale: Math.max(0.25, Math.min(3, nextScale)) };
  if (nextScale > 1.28 && index < detailLevels.length - 1)
    return { mode: detailLevels[index + 1], relativeScale: 1 };
  if (nextScale < 0.78 && index > 0)
    return { mode: detailLevels[index - 1], relativeScale: 1 };
  return {
    mode,
    relativeScale: Math.max(index === 0 ? 0.82 : 0.78, Math.min(3, nextScale)),
  };
}

export function frameBounds(bounds, viewport) {
  const left = 28,
    top = 60,
    right = 28,
    bottom = 100;
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const availableWidth = Math.max(1, viewport.width - left - right);
  const availableHeight = Math.max(1, viewport.height - top - bottom);
  const scale = Math.min(1.2, availableWidth / width, availableHeight / height);
  return {
    scale,
    x: left + (availableWidth - width * scale) / 2 - bounds.left * scale,
    y: top + (availableHeight - height * scale) / 2 - bounds.top * scale,
  };
}
