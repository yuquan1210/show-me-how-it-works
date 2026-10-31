# Ticket reservations explanation fixture

Open this directory in traceworks. Every TypeScript file is comment-free. This sample has no external services, credentials, or real payments.

To run independently: `npm install`, `npm run build`, then `npm start` (Node.js 20+).

## Explanation checks

- Creation normalizes email, validates the seat range, then delegates booking.
- Four or more seats receive a 10% discount; WELCOME subtracts another 500 cents. Four seats cost 8,500 cents.
- An already saved request returns its earlier reservation without another charge. This is not a concurrency-safe idempotency guarantee: simultaneous requests can race.
- Payment failure restores seats and rethrows the error. An unknown coupon fails before seats are taken.
- Cancellation checks the owner first, refunds before restoring seats, and does nothing further for an already cancelled booking.
- Refund failure prevents seat restoration and the cancelled status update.
- Data and simulated payments live in memory, not in a database. Restarting resets everything.
- Lower-level helpers rely on controller validation; they do not all independently validate inputs.

These expectations are deliberately outside the source files. The app's JavaScript/TypeScript import ignores this Markdown file, so AI receives implementation rather than these answers.
