// Minimal Swift package scaffold for the FlexBite consumer app.
// Note: This is structured as a SwiftPM executable so you can iterate quickly in Cursor.
// You can later embed these sources into a proper Xcode iOS App target.

import PackageDescription

let package = Package(
  name: "FlexBite",
  platforms: [
    .iOS(.v16)
  ],
  products: [
    .executable(name: "FlexBite", targets: ["FlexBite"])
  ],
  targets: [
    .executableTarget(
      name: "FlexBite",
      path: "Sources/FlexBite",
      exclude: []
    )
  ]
)

