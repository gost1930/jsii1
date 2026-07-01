# Scaffold Builder

A full-stack CRUD code generator. Define your data models, relations, and enums through an API or UI — the tool generates a complete Express + Prisma backend and a React + TanStack Query frontend.

## Quick Start

```bash
# Install dependencies
npm install

# Set up the database (SQLite — persists model definitions across restarts)
npx prisma db push

# Start the builder API server
npm run dev

# Open the builder UI (separate terminal)
cd ../client && npm install && npm run dev
```

Generated output lands in `./exported-project/` — both backend and client are fully scaffolded with `npm install` run automatically.

> **Model persistence:** Model definitions are stored in a local SQLite database (`dev.db`). They survive server restarts and page refreshes. To reset, delete `dev.db` and run `npx prisma db push` again.

## Data Model Definition

Every model has a name and an array of fields. A field has these properties:

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Field name |
| `type` | `string` | `String`, `Int`, `Float`, `Boolean`, `DateTime`, or an enum name |
| `isId` | `boolean` | Primary key field |
| `isRequired` | `boolean` | Required (non-nullable) |
| `isOptional` | `boolean` | Optional (nullable) |
| `isUnique` | `boolean` | Unique constraint |
| `hasDefault` | `boolean` | Has a default value |
| `defaultValue` | `string` | Default value (e.g. `"now()"`, `"true"`, `"autoincrement"`, `"uuid"`, `"cuid"`) |
| `relation` | `object` | Relation definition (see Relations) |
| `enumValues` | `string[]` | Enum values (see Enums) |

### ID Types

Three ID strategies are supported:

| `defaultValue` | Prisma output | Example |
|---|---|---|
| `"autoincrement"` | `Int @id @default(autoincrement())` | Auto-incrementing integer |
| `"uuid"` | `String @id @default(uuid())` | UUID v4 string |
| `"cuid"` | `String @id @default(cuid())` | CUID string |

Choose the ID type when creating a model in the builder UI.

### Model-level Settings

| Property | Type | Default | Description |
|---|---|---|---|
| `roles` | `string[]` | `[]` | Restrict private routes to these roles (e.g. `["ADMIN"]`) |
| `softDelete` | `boolean` | `false` | Adds `deletedAt DateTime?` and uses soft deletes instead of hard deletes |
| `enablePagination` | `boolean` | `true` | When false, `findAll` returns all records without pagination |

## Relations

Two relation types: `belongsTo` (FK on current model) and `hasMany` (reverse collection).

```json
// Product belongsTo Category → adds categoryId FK to Product
{
  "fieldName": "category",
  "type": "belongsTo",
  "model": "Category"
}

// Category hasMany Product → adds products collection to Category
{
  "fieldName": "products",
  "type": "hasMany",
  "model": "Product"
}
```

When you add **either** side of a relation, the reverse side is created automatically:

- `belongsTo category → Category` on Product → Category auto-gets `categories Product[]`
- `hasMany products → Product` on Category → Product auto-gets `categoryId Int` + `category Category @relation(...)`

Removing a relation also removes its reverse side from the other model.

## Enums

Add `enumValues` to any field to make it an enum. The enum type name is auto-derived from the field name (capitalized).

```json
{
  "name": "role",
  "type": "String",
  "isRequired": true,
  "hasDefault": true,
  "defaultValue": "USER",
  "enumValues": ["USER", "ADMIN", "MODERATOR"]
}
```

This generates:

```prisma
enum Role {
  USER
  ADMIN
  MODERATOR
}

model User {
  role Role @default(USER)
}
```

Validation schemas also use the enum values:

- Joi: `Joi.string().valid('USER', 'ADMIN', 'MODERATOR').required()`
- Zod: `z.enum(['USER', 'ADMIN', 'MODERATOR'])`

Multiple fields with the same enum name share the same Prisma enum definition.

## API Reference

All endpoints under `http://localhost:3000/api`.

### Models

| Method | Path | Description |
|---|---|---|
| `GET` | `/models` | List all models |
| `GET` | `/models/:name` | Get a single model with its fields |
| `POST` | `/generate` | Create a new model |
| `PUT` | `/models/:name` | Replace all fields of a model |
| `DELETE` | `/models/:name` | Delete a model |

### Fields

| Method | Path | Description |
|---|---|---|
| `POST` | `/models/:name/fields` | Add a field to a model |
| `DELETE` | `/models/:name/fields/:fieldName` | Remove a field |

### Relations

| Method | Path | Description |
|---|---|---|
| `POST` | `/models/:name/relations` | Add a relation (body: `{fieldName, type, model}`) |
| `DELETE` | `/models/:name/relations/:relationName` | Remove a relation |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |

## Generated Backend Structure

### `exported-project/backend/`

```
backend/
  package.json
  tsconfig.json
  .env                          # DATABASE_URL + JWT_SECRET
  prisma.config.ts              # Prisma 7 CLI config (datasource URL)
  prisma/schema.prisma          # Prisma schema with all models, relations, enums
  src/
    app.ts                      # Express app setup (cors, helmet, swagger)
    server.ts                   # Entry point
    router.ts                   # Top-level route aggregation
    config/prisma.ts            # PrismaClient with @prisma/adapter-pg
    middlewares/
      checkAuth.ts              # JWT Bearer token verification
      checkRole.ts              # Role-based access control
    core/
      app/base/
        schemas/                # Joi validation schemas per model
        dtos/                   # TypeScript DTO types per model
        try-catch-block.ts      # Async error wrapper
      domains/                  # Domain classes per model
      app/services/             # Service layer (validates, delegates to repos)
      interfaces/
        controllers/            # Express controllers (thin, delegate to services)
        infrastructure/
          repositories/         # All Prisma queries live here (findAll, findById, create, update, remove, bulkRemove, count)
    api/
      index.ts                  # Business logic route aggregator
      routes/{model}/
        index.ts                # Public/private split + checkAuth on private
        public/index.ts         # GET /, GET /:id
        private/index.ts        # POST, PUT, DELETE, POST /bulk-delete (role-guarded)
    utils/
      BadRequestError.ts        # ConstraintError class
      validate-input.ts         # Joi validation helper
```

### Architecture

```
Controller  →  Service  →  Repository  →  PrismaClient
  (parses req)   (validates)   (queries)     (database)
```

Each layer has a single responsibility:

- **Controller**: parse `req.query`/`req.body`/`req.params`, call service, return `res.json`
- **Service**: validate input with Joi, call repo methods, throw `ConstraintError` for domain errors
- **Repository**: all Prisma queries (no inline Prisma anywhere else)
- **Middleware**: `checkAuth` (JWT → `req.user`), `checkRole` (role check on `req.user.role`)

### Middleware Chain

Private routes flow through two middleware layers:

```
router.use('/private', checkAuth, privateRoutes)
  → checkAuth verifies JWT from Authorization header, sets req.user
  → private route handler (e.g. roleGuard checks req.user.role before controller)
```

When a model has `roles: ["ADMIN"]`, the generated private routes include:

```ts
router.post('/', roleGuard, ProductController.create);
```

### Generated API Endpoints

Each model produces these endpoints:

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/{models}/public` | None | List with pagination, sorting, search |
| `GET` | `/api/{models}/public/:id` | None | Get by ID |
| `POST` | `/api/{models}/private` | JWT + role | Create |
| `PUT` | `/api/{models}/private/:id` | JWT + role | Update |
| `DELETE` | `/api/{models}/private/:id` | JWT + role | Delete (or soft delete) |
| `POST` | `/api/{models}/private/bulk-delete` | JWT + role | Bulk delete by IDs |

## Generated Client Structure

### `exported-project/client/`

```
client/
  package.json
  vite.config.ts
  src/
    App.tsx
    main.tsx
    pages/            # Index, create, and edit pages per model
    components/       # Data table and form components per model
    hooks/            # TanStack Query hooks per model
    schemas/          # Zod validation schemas
    utils/api/        # API client and per-model API modules
    lib/              # Shared utilities (cn, api client)
    components/ui/    # Inline shadcn-style UI components
```

### Frontend Features

- Smart input mapping (Boolean → checkbox, enum → select, belongsTo → relational dropdown)
- Filter bar with searchable text inputs
- Sortable column headers
- Pagination controls
- Bulk delete with checkbox selection
- File/image/avatar upload support

## Builder Frontend

The UI at `http://localhost:5173` (started from `../client/`) provides a visual editor:

- **Sidebar**: list of existing models, create new ones (choose name + ID type)
- **Settings panel**: toggle soft delete, enable pagination, set allowed roles
- **Field editor**: add/remove fields, set type, toggle required/ID/unique
- **Enum toggle**: click the List icon to add enum values (comma-separated)
- **Relation editor**: add belongsTo/hasMany relations with target model selection
- **Save button**: changes are local until explicitly saved

## Generated .env

```
DATABASE_URL=postgresql://localhost:5432/mydb
JWT_SECRET=change-me-to-a-random-secret
```

The JWT secret is used by the generated `checkAuth` middleware to verify Bearer tokens on private routes.

## Persistence

### Builder Server Database

The builder uses a local **SQLite** database (`dev.db` in the project root) to persist model definitions across server restarts:

- A `StoredModel` table stores each model definition as a JSON blob
- Every mutation (create, update, delete model; add/remove field or relation) writes to SQLite
- On startup, models are loaded from the database before serving requests
- This means you can refresh the builder UI or restart the server without losing your work

To reset all data:

```bash
rm -f dev.db && npx prisma db push && npx prisma generate
```

### Generated Project Database

The generated backend uses **PostgreSQL** (configured via `.env`):

```
DATABASE_URL=postgresql://localhost:5432/mydb
```

The generated frontend is a static client that connects to the generated backend via the configured `VITE_API_URL`.
