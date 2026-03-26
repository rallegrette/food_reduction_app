## FlexBite MVP Scope (Rule-Based + Mystery Basket)

### Platforms
- iOS consumer app (SwiftUI).
- Restaurant dashboard (web).
- Backend built around Supabase conventions:
  - Postgres schema (SQL migrations)
  - Server-side functions for pricing + order state changes
  - Stripe for consumer charges and restaurant payouts (transaction fee model)

### Fulfillment Mode
- Pickup-only (no delivery).
- Restaurants accept or reject pickup orders from the dashboard.

### Deal Types (Restaurant can enable one or more)
1. Regular deals
   - Restaurant defines time-based discount rules that adjust menu item prices during specific windows.
2. Mystery basket
   - Restaurant defines:
     - an eligible set of menu categories/items
     - a fixed bundle size (number of units)
     - a mystery discount formula (simple v1: percentage off the sum of base prices)
   - Users purchase the basket as a bundle; the restaurant fulfills from eligible inventory.
3. Both
   - Restaurant enables both regular deals and mystery baskets.

### Pricing Rules Supported in MVP (v1)
- Time-based discount (per item or per category):
  - Example: "Drop 20% after 8:00 PM"
- Time-based inventory gating:
  - Example: "Only apply discounts if inventory remains"
- Mystery basket pricing:
  - Basket price = (sum of base prices for basket components) * (1 - mysteryDiscountPercent)

### Inventory Model (v1)
- Inventory is tracked in "units" per menu item (or category grouping, depending on how a restaurant configures the item set).
- Orders reserve inventory at checkout and finalize reservation on payment success.
- Inventory is released if the restaurant rejects the order.

### Order Lifecycle (v1)
1. User checks out on an offer; user is charged immediately.
2. Backend creates an order in `pending_payment`, then `paid` after the payment webhook.
3. Restaurant accepts/rejects for pickup.
4. Accepted orders move to `accepted`; rejected orders move to `rejected` and inventory is released.

