import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getConfiguration } from "../config.js";
import * as schema from "./schema.js";

const configuration = getConfiguration();
const queryClient = postgres(configuration.DATABASE_URL, { max: 5 });

export const db = drizzle(queryClient, { schema });
export { queryClient };
