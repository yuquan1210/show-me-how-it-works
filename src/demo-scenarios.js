// Hand-authored pitch scenarios only. No scenario inference for imported projects.
import { createDemo } from './demo.js';
import { createDemoHistory } from './history.js';

const scenarios = [
  {
    id: 'checkout', parent: 'checkout', name: 'Checkout · payment approved',
    condition: 'Items are in stock and payment is approved.',
    description: 'Reserve items, take payment, save the order and send a receipt.',
    functions: ['order-api#0', 'orders#0', 'orders#1', 'orders#2', 'inventory#0', 'inventory#1', 'stock-store#0', 'stock-store#1', 'payment#0', 'order-store#0', 'email#0', 'db#0', 'db#1'],
  },
  {
    id: 'checkout-out-of-stock', parent: 'checkout', name: 'Checkout · item out of stock',
    condition: 'The requested quantity exceeds available stock.',
    description: 'Check availability and stop checkout. No reservation, payment or order.',
    functions: ['order-api#0', 'orders#0', 'inventory#0', 'stock-store#0', 'db#0'],
  },
  {
    id: 'checkout-payment-declined', parent: 'checkout', name: 'Checkout · payment declined',
    condition: 'Items are reserved, but the payment provider declines the charge.',
    description: 'Release the reserved items. Do not save an order or send a receipt.',
    functions: ['order-api#0', 'orders#0', 'orders#1', 'orders#2', 'inventory#0', 'inventory#1', 'inventory#2', 'stock-store#0', 'stock-store#1', 'payment#0', 'db#0', 'db#1'],
  },
  {
    id: 'login', parent: 'login', name: 'Sign-in · correct credentials',
    condition: 'The account exists and the password matches.',
    description: 'Find the customer and create an active session.',
    functions: ['auth-api#0', 'users#0', 'users#1', 'customers#0', 'customers#1', 'db#0', 'db#1'],
  },
  {
    id: 'login-rejected', parent: 'login', name: 'Sign-in · incorrect credentials',
    condition: 'The account is missing or the password does not match.',
    description: 'Reject sign-in without creating or saving a session.',
    functions: ['auth-api#0', 'users#0', 'customers#0', 'db#0'],
  },
  {
    id: 'browse', parent: 'browse', name: 'Browse · matching products found',
    condition: 'Products match the selected category.',
    description: 'Read the product catalog and return matching products with availability.',
    functions: ['catalog-api#0', 'inventory#0', 'stock-store#0', 'db#0'],
  },
  {
    id: 'browse-empty', parent: 'browse', name: 'Browse · no matching products',
    condition: 'No products match the selected category.',
    description: 'Read the catalog and return an empty product list.',
    functions: ['catalog-api#0', 'inventory#0', 'stock-store#0', 'db#0'],
  },
];

function withPitchScenarios(model) {
  const functions = new Map(model.nodes.flatMap(n => n.functionDetails.map(f => [f.id, n.id])));
  const parents = new Map(model.workflows.map(w => [w.id, w]));
  return {
    ...model,
    workflows: scenarios.flatMap(scenario => {
      const parent = parents.get(scenario.parent);
      if (!parent) return [];
      const functionIds = scenario.functions.filter(id => functions.has(id));
      // Include hand-authored changes from later demo snapshots in successful checkout.
      if (scenario.id === 'checkout') {
        for (const id of ['deduplicate#0', 'fulfillment#0', 'notification-hub#0', 'audit-store#0'])
          if (functions.has(id)) functionIds.push(id);
      }
      if (scenario.id === 'login' && functions.has('identity-store#0')) functionIds.push('identity-store#0');
      const nodes = [...new Set(functionIds.map(id => functions.get(id)))];
      return [{
        ...parent, id: scenario.id, name: scenario.name,
        description: scenario.description,
        demoScenario: {condition: scenario.condition, outcome: scenario.description},
        trigger: {kind: 'demo-scenario', label: scenario.description},
        nodes, functionIds, steps: functionIds.length,
      }];
    }),
  };
}

export const createPitchDemo = () => withPitchScenarios(createDemo());
export const createPitchDemoHistory = () => {
  const history = createDemoHistory();
  return {...history, commits: history.commits.map(commit => ({...commit, model: withPitchScenarios(commit.model)}))};
};

// Demo copy follows the selected outcome instead of describing every branch.
export function presentPitchScenario(model, workflow) {
  if (!workflow?.demoScenario) return model;
  const overrides = workflow.id === 'checkout-payment-declined' ? {
    'orders#2': {
      title: 'Handle declined payment',
      summary: 'Payment is declined. Release the reserved stock and return a checkout error.',
      outputs: ['Payment declined error'],
      decisions: ['Payment declined → release reserved stock and stop'],
      effects: ['Releases reserved stock'],
    },
  } : {};
  return {...model, nodes: model.nodes.map(node => {
    const functionDetails = node.functionDetails.map(fn => ({...fn, ...overrides[fn.id]}));
    return {...node, functionDetails, functions: functionDetails.map(fn => fn.title)};
  })};
}
