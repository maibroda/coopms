import { config } from "dotenv";

// Point every test at the dedicated coopms_test database instead of the real dev/demo one —
// this file must run (via vitest's setupFiles) before any test imports src/lib/db, since that
// module reads process.env.DATABASE_URL once, at first import, to build its Prisma client.
config({ path: ".env.test" });
