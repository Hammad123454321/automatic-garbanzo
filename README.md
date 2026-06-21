# Multi-Vertical POS Platform

A production-ready, multi-tenant SaaS Point-of-Sale platform supporting **Retail**, **Restaurant**, and **Beauty/Nail Salon** businesses.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache/Pub-Sub | Redis 7 |
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Query |
| Real-time | Socket.io (store-scoped LAN rooms) |
| Auth | JWT (15m access + 7d refresh) + bcrypt + PIN login |
| AI | OpenAI GPT-4o (product descriptions) |

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + Redis)
- Node.js 20+
- npm 10+

### 1. Clone and install

```bash
git clone <repo-url> && cd pso
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set:
```
DATABASE_URL=postgresql://pos:pos_secret@localhost:5432/pos_db
JWT_SECRET=change-me-to-a-long-random-string-32-chars
JWT_REFRESH_SECRET=another-long-random-refresh-secret-here
```

### 3. Start database services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`
- Adminer (DB GUI) on `http://localhost:8080`

### 4. Run database migrations

```bash
npm run db:generate    # generate Prisma client
npm run db:migrate     # run migrations (creates all tables)
```

### 5. Seed demo data

```bash
npm run db:seed
```

This creates:
- Super Admin login
- 3 demo merchants (Retail, Restaurant, Salon)
- Staff accounts with roles and permissions
- Sample products, menu items, services
- Restaurant tables and floor layout
- A sample customer with loyalty points and gift card

The seed prints all login credentials when it finishes.

### 6. Start development servers

```bash
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

---

## Login Credentials (after seed)

### Super Admin Portal — `http://localhost:5173/login`
| Field | Value |
|---|---|
| Email | `admin@pos.local` |
| Password | `Admin1234!` |

### Staff POS — `http://localhost:5173/staff-login`

You'll need the **Store ID** from the Super Admin portal (Merchants → Store list).

| Role | Username | Password | PIN |
|---|---|---|---|
| Retail Manager | `manager` | `Manager123!` | `1234` |
| Retail Cashier | `cashier` | `Cashier123!` | `5678` |
| Restaurant Manager | `rest.manager` | `Manager123!` | `2468` |
| Salon Manager | `salon.manager` | `Manager123!` | `1357` |

---

## Project Structure

```
pso/
├── apps/
│   ├── api/              # Express API server (port 4000)
│   │   └── src/
│   │       ├── config/   # prisma singleton, env config
│   │       ├── middleware/  # auth, permissions, error handler
│   │       ├── routes/   # all REST endpoints
│   │       ├── utils/    # jwt, response helpers, permissions
│   │       ├── app.ts    # express app setup
│   │       └── index.ts  # http server + socket.io
│   └── web/              # React frontend (port 5173)
│       └── src/
│           ├── components/  # layout, POS components
│           ├── lib/         # axios client
│           ├── pages/       # all page components
│           │   ├── admin/   # back-office management
│           │   ├── pos/     # POS register, KDS, tables
│           │   └── superadmin/ # platform admin
│           └── stores/      # Zustand state stores
├── packages/
│   └── shared/           # shared TypeScript types
├── prisma/
│   ├── schema.prisma     # full database schema (50+ models)
│   └── seed.ts           # demo data seed
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints

All routes are prefixed with `/api`.

| Group | Base Path | Description |
|---|---|---|
| Auth | `/auth` | Login, PIN login, token refresh |
| Super Admin | `/super-admin` | Merchant CRUD, feature flags, billing |
| Stores | `/stores` | Store/device/printer management |
| Staff | `/staff` | Staff, roles, permissions, schedule |
| Products | `/products` | Categories, products, menu items, services |
| Orders | `/orders` | Full order lifecycle, hold/recall, splits |
| Payments | `/payments` | Process payment, refunds, terminal |
| Customers | `/customers` | CRM, loyalty, gift cards |
| Inventory | `/inventory` | Stock levels, adjustments, purchase orders |
| Restaurant | `/restaurant` | Tables, floor layout, reservations |
| Salon | `/salon` | Appointments, commissions |
| Time Clock | `/timeclock` | Clock in/out, payroll |
| Reports | `/reports` | Sales, staff, tax, tips, audit log |
| AI | `/ai` | Product descriptions, suggestions |
| Sync | `/sync` | Offline push/pull for devices |

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```env
DATABASE_URL=             # PostgreSQL connection string
JWT_SECRET=               # 32+ char random string
JWT_REFRESH_SECRET=       # separate 32+ char random string
SUPER_ADMIN_EMAIL=        # initial super admin email
SUPER_ADMIN_PASSWORD=     # initial super admin password
OPENAI_API_KEY=           # optional — for AI product descriptions
```

---

## Business Modes

Each store runs in one of three modes, set per-store:

| Mode | Features |
|---|---|
| `RETAIL` | Products, variants, inventory, barcode scanning |
| `RESTAURANT` | Menu items, table map, KDS, split bills, reservations |
| `BEAUTY` | Services, appointment calendar, commission tracking |

All three modes share: orders, payments, customers, loyalty, gift cards, staff, reports, payroll.

---

## Real-time Events (Socket.io)

Devices join a store room by `storeId`. Events emitted:

| Event | Trigger |
|---|---|
| `order:update` | Order status change |
| `table:update` | Table status change |
| `catalog:update` | Product/menu item change |
| `kds:order` | New order sent to kitchen |
| `customer-display:update` | Cart updated at register |

---

## Scripts

```bash
npm run dev           # start api + web in parallel
npm run dev:api       # api only
npm run dev:web       # web only
npm run build         # production build
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev
npm run db:seed       # seed demo data
npm run db:studio     # open Prisma Studio GUI
```

---

## Production Notes

- Set `NODE_ENV=production` and strong secrets in `.env`
- Run `npm run build` and serve `apps/web/dist` via a static host or CDN
- Use a managed PostgreSQL service (Supabase, RDS, Neon)
- Add SSL termination (NGINX or a load balancer) in front of the API
- The `/api/sync` routes support offline-first POS stations — devices queue actions locally and push when reconnected
