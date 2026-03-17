# Backend Conventions

## SQL
- Always use `?` parameterised placeholders — never interpolate user input into query strings.
- Enable foreign key enforcement on every connection: `PRAGMA foreign_keys = ON` inside `db.serialize()` at startup (SQLite does not enforce `REFERENCES` constraints by default).

## Input Validation
- Validate all user-supplied values before they reach the database:
  - Enum/range fields (e.g. `questionNumber`) must be checked against the allowed set and rejected with `400` if invalid.
  - Required string fields must be checked for presence and correct type.
- Return a `404` when an UPDATE/DELETE affects zero rows (i.e. the resource doesn't exist).

## File Uploads
- Always set a `fileSize` limit when registering `@fastify/multipart` to prevent memory exhaustion from oversized uploads.
