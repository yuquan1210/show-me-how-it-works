import test from 'node:test';
import assert from 'node:assert/strict';
import {createPitchDemoHistory, revealExpressCheckout} from '../src/demo-scenarios.js';
import {historyDelta} from '../src/history.js';

test('demo refresh reveals express checkout once with checkout-only impact', () => {
  const before = createPitchDemoHistory();
  const next = revealExpressCheckout(before);
  assert.equal(next.commits.length, before.commits.length + 1);
  assert.equal(before.commits.some(c=>c.message==='Add express checkout'), false);
  assert.equal(revealExpressCheckout(next), next);
  const commit = next.commits.at(-1);
  assert.equal(commit.message, 'Add express checkout');
  assert.deepEqual(commit.demoAffectedWorkflows, ['checkout','checkout-out-of-stock','checkout-payment-declined']);
  const delta = historyDelta(before.commits.at(-1).model, commit.model);
  assert.deepEqual(delta.nodes.filter(n=>n.status!=='unchanged').map(n=>n.id).sort(), ['order-api','orders']);
  assert.ok(commit.model.functionEdges.some(([a,b])=>a==='orders#express' && b==='order-store#0'));
  assert.equal(commit.model.functionEdges.some(([a,b])=>a==='orders#express' && b.startsWith('inventory#')), false);
});
