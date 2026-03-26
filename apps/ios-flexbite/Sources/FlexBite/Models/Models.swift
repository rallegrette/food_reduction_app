import Foundation

struct Restaurant: Identifiable, Hashable, Codable {
  var id: String
  var name: String
  var latitude: Double?
  var longitude: Double?
}

struct MysteryBasket: Identifiable, Hashable, Codable {
  var id: String
  var name: String?
  var bundleSize: Int
  var mysteryDiscountPercent: Double
}

struct MenuItem: Identifiable, Hashable, Codable {
  var id: String
  var name: String
  var category: String
  var basePrice: Double
}

struct InventorySnapshot: Codable, Hashable {
  var quantityTotal: Int
  var quantityRemaining: Int
}

struct PricingRule: Codable, Hashable {
  var targetScope: String // "item" | "category" | "all"
  var targetMenuItemId: String?
  var targetCategory: String?
  var appliesAfterTime: String // "HH:MM"
  var discountPercent: Double
  var stopDiscountIfSoldThroughGtePercent: Double?
  var enabled: Bool
}

struct Order: Identifiable, Hashable, Codable {
  var id: String
  var status: String
  var dealType: String
  var totalAmount: Double
  var createdAt: String?
}

enum FlexBiteError: Error, LocalizedError {
  case message(String)
  var errorDescription: String? {
    switch self {
    case .message(let msg): return msg
    }
  }
}

