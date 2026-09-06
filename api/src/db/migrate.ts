import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, queryClient } from "./client.js";

await migrate(db, { migrationsFolder: "drizzle" });
await queryClient.end();
