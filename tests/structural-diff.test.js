import test from 'node:test';
import assert from 'node:assert/strict';
import {changedFields, structuralDiffMarkup} from '../src/structural-diff.js';
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('diff preserves unchanged context and highlights only changed list members', () => {
  const before={Purpose:['Check stock then save'],Inputs:['Customer'],Calls:['Reserve items','Save order']};
  const after={Purpose:['Save directly'],Inputs:['Customer'],Calls:['Save order','Create express order']};
  assert.deepEqual(changedFields(before,after).map(f=>f.label),['Purpose','Calls']);
  const markup=structuralDiffMarkup(before,after,esc);
  assert.match(markup,/<del>Check stock then save<\/del>/);
  assert.match(markup,/<ins>Save directly<\/ins>/);
  assert.ok(markup.includes('<h4>Inputs</h4>'));
  assert.match(markup, /Before this commit/);
  assert.match(markup, /After this commit/);
  assert.ok(markup.includes('<p>Save order</p>'));
  assert.ok(!markup.includes('<ins>Save order</ins>'));
  assert.ok(!markup.includes('<del>Save order</del>'));
});
test('new entities have explicit absent state and escaped content', () => {
  const markup=structuralDiffMarkup(null,{Purpose:['<create> order']},esc);
  assert.match(markup,/Before · Not present/);
  assert.match(markup,/&lt;create&gt;/);
  assert.ok(!markup.includes('<create>'));
});
test('unchanged selections explain that the impact is elsewhere', () => {
  assert.match(structuralDiffMarkup({Purpose:['Check stock']},{Purpose:['Check stock']},esc),/No structural changes to this selection/);
});
