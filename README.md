# FlexBite

FlexBite is a surplus food marketplace that connects consumers with restaurants offering time-based discounts and mystery baskets on unsold inventory. Restaurants manage deals through a web dashboard, and consumers discover and purchase offers via an iOS app. All orders are pickup-only.

## Features

- **Regular deals** — restaurants define time-based discount rules (e.g. "20% off after 8 PM") scoped to individual items, categories, or the full menu.
- **Mystery baskets** — bundled surprise meals at a flat discount, assembled from eligible inventory.
- **Inventory tracking** — per-item daily inventory with automatic reservation on checkout and release on rejection.
- **Order lifecycle** — `pending_payment` → `paid` → `reserved` → `accepted` / `rejected`, driven by Stripe webhooks and restaurant actions.
- **Stripe Connect payments** — consumers pay through Stripe; restaurants receive payouts minus a configurable platform fee.
- **JWT authentication** — all Edge Functions validate the caller's identity via Supabase Auth JWTs; user and restaurant ownership are derived from the token, never trusted from the request body.
- **Row Level Security** — Postgres RLS policies on every table enforce tenant isolation at the database level.

## Tech Stack

| Layer | Technology |
|---|---|
| Consumer app | Swift 5.9+, SwiftUI, iOS 16+, Stripe iOS SDK |
| Restaurant dashboard | TypeScript, React 19, Vite 8 |
| Backend | Supabase (Postgres, Auth, Edge Functions on Deno) |
| Payments | Stripe (PaymentIntents, Connect, Webhooks) |

## Project Structure

```
.
├── docs/
│   └── mvp.md                         # Product / MVP scope
├── apps/
│   ├── web-dashboard/                  # React restaurant dashboard
│   │   ├── src/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── .env.example
│   └── ios-flexbite/                   # SwiftUI consumer app
│       ├── Package.swift
│       └── Sources/FlexBite/
└── backend-supabase/
    ├── migrations/                     # Postgres schema (SQL)
    ├── functions/                      # Supabase Edge Functions (Deno)
    │   ├── _shared/                    # Shared helpers (auth, Stripe client, pricing engine)
    │   ├── create_order/
    │   ├── create_payment_intent/
    │   ├── stripe_webhook/
    │   ├── calculate_offers/
    │   ├── restaurant_accept_order/
    │   └── restaurant_reject_order/
    └── .env.example
```

## Getting Started

### Prerequisites

- A [Supabase](https://supabase.com) project with Auth enabled
- A [Stripe](https://stripe.com) account with Connect set up
- Node.js (for the web dashboard)
- Xcode (for the iOS app)

### 1. Database

Apply the SQL migrations in order from `backend-supabase/migrations/` using the Supabase SQL Editor or the Supabase CLI.

### 2. Edge Functions

Set up environment variables for the functions by copying the example file:

```sh
cp backend-supabase/.env.example backend-supabase/.env
```

Fill in the values:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret |
| `FLEXBITE_FEE_PERCENT` | Platform fee percentage (e.g. `10`) |

Deploy the functions with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
supabase functions deploy
```

### 3. Web Dashboard

```sh
cd apps/web-dashboard
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then:

```sh
npm install
npm run dev
```

The dashboard runs at `http://localhost:5173`.

### 4. iOS App

Open `apps/ios-flexbite/` in Xcode. Set the following keys in your `Info.plist`:

- `FLEXBITE_SUPABASE_URL`
- `FLEXBITE_SUPABASE_ANON_KEY`
- `FLEXBITE_STRIPE_PUBLISHABLE_KEY`

Build and run on a simulator or device targeting iOS 16+.

## License

ISC
