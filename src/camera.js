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

// Frame inside a clear rectangle rather than underneath floating controls.
export function frameAroundPanels(bounds, viewport, panels, gap = 12) {
  const obstacles = panels.map(r => ({
    left: Math.max(0, r.left - gap), right: Math.min(viewport.width, r.right + gap),
    top: Math.max(0, r.top - gap), bottom: Math.min(viewport.height, r.bottom + gap),
  })).filter(r => r.right > r.left && r.bottom > r.top);
  const xs = [...new Set([0, viewport.width, ...obstacles.flatMap(r => [r.left, r.right])])].sort((a,b) => a-b);
  let best = null;
  for (let i = 0; i < xs.length - 1; i++) for (let j = i + 1; j < xs.length; j++) {
    const left = xs[i], right = xs[j];
    const blocked = obstacles.filter(r => r.left < right && r.right > left).sort((a,b) => a.top-b.top);
    let top = 0;
    const consider = bottom => {
      const width = right-left, height = bottom-top;
      if (width <= 56 || height <= 160) return;
      const frame = frameBounds(bounds, {width, height});
      const area = width*height;
      if (!best || frame.scale > best.scale + 1e-6 || Math.abs(frame.scale-best.scale) < 1e-6 && area > best.area)
        best = {...frame, x:frame.x+left, y:frame.y+top, area};
    };
    for (const r of blocked) {consider(r.top); top = Math.max(top, r.bottom);}
    consider(viewport.height);
  }
  if (!best) return frameBounds(bounds, viewport);
  return {scale:best.scale, x:best.x, y:best.y};
}
