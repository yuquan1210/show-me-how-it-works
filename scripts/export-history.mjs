import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzeFiles, isSource } from '../src/analyzer.js';

const [repoArg, outputArg] = process.argv.slice(2);
if (!repoArg || !outputArg) {
  console.error('Usage: node scripts/export-history.mjs /path/to/repo /path/to/project.history.json');
  process.exit(1);
}
const repo = resolve(repoArg), output = resolve(outputArg);
const git = (...args) => execFileSync('git',['-C',repo,...args],{encoding:'utf8',maxBuffer:64*1024*1024});
const digest = s => createHash('sha256').update(s || '').digest('hex');
try {
  const shas = git('rev-list','--first-parent','--reverse','HEAD').trim().split('\n').filter(Boolean);
  if(shas.length > 5000) throw new Error('This exporter supports up to 5,000 commits. Export from a smaller history clone.');
  const name = basename(git('rev-parse','--show-toplevel').trim());
  const history = {format:'show-me-history',version:1,kind:'git',name,branch:git('rev-parse','--abbrev-ref','HEAD').trim(),commits:[]};
  let bytes = 0;
  for(const sha of shas) {
    const [date,...subject] = git('show','-s','--format=%cI%n%s',sha).trimEnd().split('\n');
    const files = [], skipped = [];
    for(const record of git('ls-tree','-r','-z',sha).split('\0').filter(Boolean)) {
      const tab = record.indexOf('\t'), path = record.slice(tab+1);
      const [mode,type,blob] = record.slice(0,tab).split(' ');
      if(!isSource(path) || type !== 'blob' || !['100644','100755'].includes(mode)) continue;
      if(Number(git('cat-file','-s',blob)) > 600000) {skipped.push(path);continue;}
      files.push({path,text:git('cat-file','blob',blob)});
    }
    const model = analyzeFiles(files,name);
    model.updated = Date.parse(date);
    for(const n of model.nodes) {
      n.fingerprint = digest(n.fingerprint);
      for(const f of n.functionDetails) {f.fingerprint=digest(f.raw);delete f.raw;}
    }
    const commit = {sha,date,message:subject.join(' '),model,skippedFiles:skipped.length};
    bytes += Buffer.byteLength(JSON.stringify(commit));
    if(bytes > 80*1024*1024) throw new Error('History exceeds the 80 MB import limit. Use a smaller history clone.');
    history.commits.push(commit);
    console.error(`Mapped ${history.commits.length}/${shas.length} commits`);
  }
  // Exclusive create avoids accidentally overwriting a user file.
  writeFileSync(output,JSON.stringify(history),{flag:'wx'});
  console.error(`Exported ${history.commits.length} commits to ${output}. Source bodies are excluded; labels, paths and commit subjects remain. The repository was not modified.`);
} catch(e) {console.error(e.message);process.exitCode=1;}
