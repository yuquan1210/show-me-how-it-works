import ts from 'typescript';
import { isAnalysisInput, isSource } from './source-files.js';

// A virtual filesystem keeps resolution identical in the browser and history exporter.
// No config can cause a read outside the supplied snapshot.
const root = '/__project__/';
const normalize = path => {
  const parts = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return '/' + parts.join('/');
};
const directory = path => path.slice(0, path.lastIndexOf('/'));

export function createProjectProgram(files) {
  const entries = files.filter(f => isAnalysisInput(f.path));
  const snapshot = new Map(entries.map(f => [normalize(root + f.path), f]));
  const directories = new Set([directory(root)]);
  for (const path of snapshot.keys()) {
    for (let dir = directory(path); dir; dir = directory(dir)) directories.add(dir);
  }
  const defaults = {
    allowJs: true, noLib: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
  };
  const warnings = [];
  const configurations = new Map();
  const sourceFiles = entries.filter(f => isSource(f.path));
  const filesystemEntries = path => {
    const prefix = normalize(path) + '/';
    return {
      files: [...snapshot.keys()].filter(p => directory(p) === normalize(path)).map(p => p.slice(prefix.length)),
      directories: [...directories].filter(p => directory(p) === normalize(path)).map(p => p.slice(prefix.length)),
    };
  };
  const fileHost = {
    fileExists: path => snapshot.has(normalize(path)),
    readFile: path => snapshot.get(normalize(path))?.text,
    directoryExists: path => directories.has(normalize(path)),
    getCurrentDirectory: () => directory(root),
    realpath: normalize,
    useCaseSensitiveFileNames: true,
    // TypeScript's bundled matcher supplies its own include/exclude semantics.
    // Membership selects referenced-project settings; it does not hide source.
    readDirectory: (path, extensions, excludes, includes, depth) =>
      ts.matchFiles(normalize(path), extensions, excludes, includes, true, directory(root), depth, filesystemEntries, normalize),
  };
  const readConfig = config => {
    if (!configurations.has(config)) {
      const source = ts.readJsonConfigFile(config, fileHost.readFile);
      const parsed = ts.parseJsonSourceFileConfigFileContent(source, fileHost, directory(config), undefined, config);
      for (const error of parsed.errors.filter(e => ![18002, 18003].includes(e.code))) {
        const path = snapshot.get(error.file?.fileName)?.path || snapshot.get(config).path;
        warnings.push(`${path}: project configuration could not be fully applied (TypeScript ${error.code}).`);
      }
      configurations.set(config, {
        options: {...defaults, ...parsed.options, allowJs: true, noLib: true},
        members: new Set(parsed.fileNames.map(normalize)),
        references: (parsed.projectReferences || []).map(ref => normalize(ts.resolveProjectReferencePath(ref))),
      });
    }
    return configurations.get(config);
  };
  const referencedConfigs = (config, chain = new Set()) => {
    if (chain.has(config)) {
      warnings.push(`${snapshot.get(config).path}: circular project references were not followed.`);
      return [];
    }
    const next = new Set([...chain, config]);
    return readConfig(config).references.flatMap(reference => {
      if (!snapshot.has(reference)) {
        warnings.push(`${snapshot.get(config).path}: a referenced project configuration is missing from the snapshot.`);
        return [];
      }
      return [reference, ...referencedConfigs(reference, next)];
    });
  };
  const settingsByFile = new Map();
  const optionsFor = containingFile => {
    const file = normalize(containingFile);
    if (settingsByFile.has(file)) return settingsByFile.get(file);
    let dir = directory(file);
    while (dir.startsWith(directory(root))) {
      const config = ['tsconfig.json', 'jsconfig.json']
        .map(name => dir + '/' + name).find(fileHost.fileExists);
      if (config) {
        const matches = [...new Set(referencedConfigs(config))].filter(ref => ref !== config && readConfig(ref).members.has(file));
        if (matches.length > 1) {
          warnings.push(`${snapshot.get(file)?.path || file}: multiple referenced projects include this file; nearest project settings were used.`);
        }
        const options = readConfig(matches.length === 1 ? matches[0] : config).options;
        settingsByFile.set(file, options);
        return options;
      }
      dir = directory(dir);
    }
    return defaults;
  };
  const resolutions = new Map();
  const resolveModule = (specifier, containingFile) => {
    const from = normalize(containingFile.startsWith(root) ? containingFile : root + containingFile);
    const key = JSON.stringify([from, specifier]);
    if (!resolutions.has(key)) {
      const result = ts.resolveModuleName(specifier, from, optionsFor(from), fileHost).resolvedModule;
      resolutions.set(key, result && snapshot.has(normalize(result.resolvedFileName)) ? result : undefined);
    }
    return resolutions.get(key);
  };
  const host = {
    ...fileHost,
    useCaseSensitiveFileNames: () => true,
    getSourceFile: (path, languageVersion) => {
      const file = snapshot.get(normalize(path));
      return file && isSource(file.path) ? ts.createSourceFile(normalize(path), file.text, languageVersion, true) : undefined;
    },
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getDirectories: () => [],
    getCanonicalFileName: normalize,
    getNewLine: () => '\n',
    resolveModuleNames: (names, containingFile) => names.map(name => resolveModule(name, containingFile)),
  };
  // Parse every applicable config, including files that have no imports.
  for (const file of sourceFiles) optionsFor(root + file.path);
  const program = ts.createProgram(sourceFiles.map(f => normalize(root + f.path)), defaults, host);
  return {
    program,
    warnings,
    getSourceFile: path => program.getSourceFile(normalize(root + path)),
    originalPath: path => snapshot.get(normalize(path))?.path,
    resolveImport: (specifier, path) => {
      const resolved = resolveModule(specifier, path);
      return resolved && snapshot.get(normalize(resolved.resolvedFileName))?.path;
    },
    importBoundary: (specifier, path) => {
      const options = optionsFor(root + path);
      const alias = Object.keys(options.paths || {}).some(pattern => {
        const star = pattern.indexOf('*');
        return star < 0 ? pattern === specifier : specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1));
      });
      if (specifier.startsWith('.') || specifier.startsWith('/') || alias)
        return {status: 'unresolved', reason: alias ? 'Configured alias has no matching implementation in this snapshot.' : 'Local module is missing or unsupported in this snapshot.'};
      return {status: 'external', reason: 'Package, runtime module, or unconfigured bare import; its implementation is outside the analyzed snapshot.'};
    },
  };
}
