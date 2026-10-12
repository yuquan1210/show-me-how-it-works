// Magnification is independent of the manually selected detail level.
export function zoomStep(mode, relativeScale, multiplier) {
  return {mode,relativeScale:Math.max(0.1,Math.min(8,relativeScale*multiplier))};
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
