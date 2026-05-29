/**
 * Minimal async database interface used by every repository module.
 *
 * It is the exact subset of the `expo-sqlite` `SQLiteDatabase` API that this
 * app relies on. By depending on this interface (rather than importing
 * `expo-sqlite` directly), the repositories stay unit-testable on Node: tests
 * back it with the built-in `node:sqlite` engine, while the app wires in the
 * real expo-sqlite database at startup.
 */
export interface SqlRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface SqlDatabase {
  /** Runs a write statement (INSERT/UPDATE/DELETE). */
  runAsync(sql: string, params?: unknown[]): Promise<SqlRunResult>;
  /** Returns the first matching row, or null. */
  getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Returns all matching rows. */
  getAllAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Executes one or more statements with no parameters (migrations, pragmas). */
  execAsync(sql: string): Promise<void>;
}
