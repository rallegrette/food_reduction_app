/**
 * FlexBite Pricing Engine (v1 - rule-based)
 *
 * Designed to be imported by Supabase Edge Functions.
 * Pure functions: given inputs -> compute effective price, availability, and (for mystery) selected basket items.
 */

/**
 * @typedef {Object} PricingRule
 * @property {"item"|"category"|"all"} targetScope
 * @property {string|null} [targetMenuItemId]
 * @property {string|null} [targetCategory]
 * @property {string} appliesAfterTime - "HH:MM" 24h
 * @property {number} discountPercent
 * @property {number|null} [stopDiscountIfSoldThroughGtePercent]
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} InventorySnapshot
 * @property {number} quantityTotal
 * @property {number} quantityRemaining
 */

/**
 * @typedef {Object} RegularOfferInput
 * @property {string} menuItemId
 * @property {string} menuItemCategory
 * @property {number} basePrice
 * @property {InventorySnapshot} inventory
 * @property {PricingRule[]} pricingRules
 * @property {Date} now
 */

/**
 * @typedef {Object} RegularOfferOutput
 * @property {boolean} available
 * @property {number} effectiveUnitPrice
 * @property {number} maxDiscountPercentUsed
 */

/**
 * @typedef {Object} MysteryEligibleItem
 * @property {string} menuItemId
 * @property {string} menuItemCategory
 * @property {number} basePrice
 * @property {InventorySnapshot} inventory
 */

/**
 * @typedef {Object} MysteryBasketOutput
 * @property {Array<{menuItemId:string, menuItemCategory:string, quantity:number, basePrice:number, effectiveUnitPrice:number}>} lineItems
 * @property {number} subtotalAmount
 * @property {number} discountAmount
 * @property {number} totalAmount
 */

function parseHHMMToMinutes(hhmm) {
  // Accept "HH:MM" (edge)
  const [hh, mm] = String(hhmm).split(':');
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function roundMoney(amount) {
  // MVP: 2-decimal rounding
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function soldThroughPercent(inventory) {
  const total = inventory.quantityTotal;
  const remaining = inventory.quantityRemaining;
  if (total <= 0) return 0;
  return ((total - remaining) / total) * 100;
}

function ruleApplies(rule, { menuItemId, menuItemCategory }) {
  if (rule.targetScope === 'all') return true;
  if (rule.targetScope === 'item') return rule.targetMenuItemId === menuItemId;
  if (rule.targetScope === 'category') return rule.targetCategory === menuItemCategory;
  return false;
}

/**
 * Compute the best applicable discount percent for a single item.
 * Strategy: choose the max discount that is currently active and not blocked by sold-through stop rules.
 */
export function computeRegularUnitOffer(input) {
  const { menuItemId, menuItemCategory, basePrice, inventory, pricingRules, now } = input;

  if (!inventory || inventory.quantityRemaining <= 0 || basePrice < 0) {
    return {
      available: false,
      effectiveUnitPrice: 0,
      maxDiscountPercentUsed: 0
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const soldThrough = soldThroughPercent(inventory);

  let maxDiscountPercentUsed = 0;

  for (const rule of pricingRules || []) {
    if (!rule || !rule.enabled) continue;
    const appliesAfterMinutes = parseHHMMToMinutes(rule.appliesAfterTime);
    if (nowMinutes < appliesAfterMinutes) continue;
    if (!ruleApplies(rule, { menuItemId, menuItemCategory })) continue;

    const stop = rule.stopDiscountIfSoldThroughGtePercent;
    if (typeof stop === 'number' && Number.isFinite(stop) && soldThrough >= stop) {
      continue; // blocked
    }

    maxDiscountPercentUsed = Math.max(maxDiscountPercentUsed, rule.discountPercent || 0);
  }

  const effectiveUnitPrice = roundMoney(basePrice * (1 - maxDiscountPercentUsed / 100));
  return {
    available: true,
    effectiveUnitPrice,
    maxDiscountPercentUsed
  };
}

/**
 * Select mystery basket line items from eligible items.
 *
 * Selection policy (v1):
 * - Only consider items with quantityRemaining > 0.
 * - Choose items at random among eligible candidates until bundle_size reached.
 * - Allows selecting the same menu item multiple times until it runs out.
 *
 * @param {Object} input
 * @param {MysteryEligibleItem[]} input.eligibleItems
 * @param {number} input.bundleSize
 * @param {number} input.mysteryDiscountPercent
 * @param {() => number} [input.rng] - optional RNG hook for deterministic tests
 * @returns {MysteryBasketOutput}
 */
export function computeMysteryBasket(input) {
  const { eligibleItems, bundleSize, mysteryDiscountPercent, rng = Math.random } = input;

  const pool = (eligibleItems || [])
    .map((it) => ({
      menuItemId: it.menuItemId,
      menuItemCategory: it.menuItemCategory,
      basePrice: it.basePrice,
      // track remaining within selection
      inventoryRemaining: Math.max(0, it.inventory?.quantityRemaining ?? 0)
    }))
    .filter((it) => it.inventoryRemaining > 0 && it.basePrice >= 0);

  if (bundleSize <= 0) {
    return {
      lineItems: [],
      subtotalAmount: 0,
      discountAmount: 0,
      totalAmount: 0
    };
  }

  const chosen = [];
  const maxIterations = bundleSize * 10;

  for (let i = 0; i < bundleSize; i++) {
    let iterations = 0;
    while (iterations < maxIterations) {
      iterations++;
      const candidates = pool.filter((p) => p.inventoryRemaining > 0);
      if (candidates.length === 0) break;
      const idx = Math.floor(rng() * candidates.length);
      const pick = candidates[idx];
      pick.inventoryRemaining -= 1;
      chosen.push(pick);
      break;
    }
  }

  // Aggregate identical menu items
  /** @type {Record<string, {menuItemCategory:string, quantity:number, basePrice:number, effectiveUnitPrice:number}>} */
  const aggregated = {};
  for (const c of chosen) {
    const key = c.menuItemId;
    if (!aggregated[key]) {
      const effectiveUnitPrice = roundMoney(c.basePrice * (1 - mysteryDiscountPercent / 100));
      aggregated[key] = {
        menuItemCategory: c.menuItemCategory,
        quantity: 0,
        basePrice: c.basePrice,
        effectiveUnitPrice
      };
    }
    aggregated[key].quantity += 1;
  }

  const lineItems = Object.entries(aggregated).map(([menuItemId, v]) => ({
    menuItemId,
    menuItemCategory: v.menuItemCategory,
    quantity: v.quantity,
    basePrice: v.basePrice,
    effectiveUnitPrice: v.effectiveUnitPrice
  }));

  const subtotalAmount = roundMoney(lineItems.reduce((sum, li) => sum + li.basePrice * li.quantity, 0));
  const discountAmount = roundMoney(subtotalAmount * (mysteryDiscountPercent / 100));
  const totalAmount = roundMoney(subtotalAmount - discountAmount);

  return { lineItems, subtotalAmount, discountAmount, totalAmount };
}

