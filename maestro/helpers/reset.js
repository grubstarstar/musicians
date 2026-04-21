// MUS-71: reset the e2e test DB before a Maestro journey starts.
// Posts to the test-only `/test/reset` endpoint on the e2e server (port 3002),
// which truncates every user-data table and reseeds the minimal fixture.
//
// Maestro's JS scripts run in a sandbox with the global `http` helper but no
// console.log of return values; we throw on non-200 so the Maestro run
// surfaces the failure instead of silently continuing against a stale DB.
const result = http.post('http://localhost:3002/test/reset', {
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
if (result.status !== 200) {
  throw new Error(
    'POST /test/reset failed (status ' +
      result.status +
      '). Is `pnpm e2e:server` running?'
  );
}
