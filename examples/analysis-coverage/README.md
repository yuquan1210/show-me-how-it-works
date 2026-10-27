# Analysis coverage review sample

Open this folder in the app to review task 2. You can choose **Review analysis coverage** on the preparation screen without an AI key or sending code to a provider. The map still requires generated explanations before opening.

This is an analysis fixture, not an executable application. `example-payment-sdk` and `example-queue-sdk` deliberately have no supplied implementation. Do not install them.

Expected results:

- The root config references `tsconfig.app.json`, whose alias connects `main.ts` to `booking/index.ts`.
- Components shows **Application entry**, **Booking**, and **Startup**. The barrel, shared types, and shared state appear inside Booking's supporting details, without separate canvas boxes or a file-level view.
- The type definitions are marked shared with Application entry. Shared data and types do not create an invented call between their consumers.
- Application entry connects to Booking through the public exports. The coverage report retains the underlying re-export and type-only records without claiming direct execution.
- The call to create a booking resolves through the barrel to the service function.
- Creating the store resolves to its explicit constructor; saving resolves to its method.
- The payment and queue operations are outside the snapshot.
- The notification callback supplied by the caller is unresolved; the app does not invent an implementation.
- The timer receives one inline callback. Passing it is recorded separately, without a call-graph edge claiming that submit invokes it directly.
- The inline callback's call to the audit helper is mapped.

Use the report's module and category filters to inspect diagnostic records, reasons, and source references. Component details offer coverage for their combined implementation and supporting sources; function details offer a report limited to that operation. Counts describe the imported source snapshot, not runtime test coverage or every file in a repository. Only the existing Overview, Components, and Functions canvas levels are available.
