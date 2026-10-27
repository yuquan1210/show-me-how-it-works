import test from 'node:test';
import assert from 'node:assert/strict';
import {historyRefresh} from '../src/history-refresh.js';
const history=shas=>({kind:'git',name:'Project',branch:'main',commits:shas.map(sha=>({sha}))});
test('refresh retains the selected commit rather than jumping to new latest',()=>{
  assert.deepEqual(historyRefresh(history(['a','b']),history(['a','b','c']),'a','cancel'),{index:0,workflowId:'cancel',added:1});
  assert.deepEqual(historyRefresh(history(['a','b']),history(['a','b']),'b'),{index:1,workflowId:null,added:0});
});
test('unrelated, changed-branch, shortened and rewritten histories start a new review',()=>{
  for(const next of [history(['x','y']),history(['a']),history(['a','z']),{...history(['a','b']),branch:'other'},{...history(['a','b']),name:'Other'}])assert.equal(historyRefresh(history(['a','b']),next,'a'),null);
  assert.equal(historyRefresh(null,history(['a']),'a'),null);
});
