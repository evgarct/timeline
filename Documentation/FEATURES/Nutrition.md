# Nutrition

## Product database

The catalog is private and owner-scoped. A product stores one or more nutrient bases and every readable label row, including unknown manufacturer nutrients. Each value retains its original label, unit, qualifier, optional daily-value percentage, and `stated`, `calculated`, or `estimated` provenance. Salt and sodium and individual fat/sugar types remain separate.

ChatGPT analyzes attached packaging or produce photos. The MCP server receives structured data only and does not store those images. Exact barcodes reuse a product. Without a barcode, only one exact normalized name/brand match may be reused.

## Journal

Breakfast, lunch, dinner, and snack entries are Timeline events. Entries accept grams, milliliters, or a product-specific piece size. Their full scaled nutrient snapshot is durable history. The native app can search the complete catalog, add food, and edit or delete journal entries on past, current, or future days.

The daily surface shows calories and protein/fat/carbohydrates without targets. Full macro- and micronutrient details are disclosed on demand and mark calculated or estimated data.
