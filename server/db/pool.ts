import { Pool } from "pg";
import type { DbPool } from "../domain/repositories.js";

export function createPool(connectionString: string, options: { max?: number } = {}): DbPool {
  return new Pool({ connectionString, max: options.max ?? 1 });
}
