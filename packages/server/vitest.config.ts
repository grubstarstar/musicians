import { defineConfig } from 'vitest/config';

// Server tests share a single Postgres test database (`musicians_test`) for
// the `.integration.test.ts` suites — notably `testRoutes` (which truncates
// + reseeds the whole fixture) and `musicianProfiles/router` (MUS-85, which
// writes its own rows against the same DB). Running vitest file-parallel
// across those two lets one worker truncate mid-assertion in the other, so
// we disable file parallelism at this layer.
//
// Tests within a single file still run in sequence by default, which is what
// we want. The pure-function unit tests don't touch the DB and would be
// happy to parallelise, but the correctness cost of a flaky integration
// test far outweighs the wall-clock saving on ~100 fast unit tests.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
