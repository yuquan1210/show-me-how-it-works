const excluded =
  /(^|\/)(node_modules|\.git|dist|build|coverage|__tests__|tests?|\.next|vendor)(\/|$)|\.(test|spec|config)\.[cm]?[jt]sx?$|\.d\.ts$/i;

export const isSource = path => /\.[cm]?[jt]sx?$/.test(path) && !excluded.test(path);

// Read compiler configuration as analysis metadata, never as a graph component.
export const isProjectConfig = path =>
  /(^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i.test(path) && !excluded.test(path);

export const isAnalysisInput = path => isSource(path) || isProjectConfig(path);
