import { z } from "zod";

const configurationSchema = z.object({
  ABUSE_HASH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_ORIGIN: z.string().url().default("https://noai.eslee.io"),
  TURNSTILE_SECRET_KEY: z.string().min(1),
});

export type Configuration = z.infer<typeof configurationSchema>;

export function getConfiguration(): Configuration {
  return configurationSchema.parse(process.env);
}
