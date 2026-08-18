import { Pool } from "pg";
import type { DbPool } from "../domain/repositories.js";

export function createPool(connectionString: string): DbPool {
  return new Pool({ connectionString });
}
