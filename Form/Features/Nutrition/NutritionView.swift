import SwiftUI

struct NutritionView: View {
    @Bindable var store: NutritionStore

    @State private var calendarPresented = false
    @State private var addMeal: MealType?
    @State private var selectedEntry: FoodEntry?
    @State private var nutrientsPresented = false
    @State private var collapsedMeals: Set<MealType> = []

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 18) {
                    header
                    summary
                    nutrientButton
                    journal
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 100)
            }
            .background {
                LinearGradient(
                    colors: [Color.black, Color(red: 0.10, green: 0.085, blue: 0.07), .black],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ).ignoresSafeArea()
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $calendarPresented) {
            NutritionCalendarSheet(selection: store.selectedDate) { date in
                calendarPresented = false
                Task { await store.select(date: date) }
            }
        }
        .sheet(item: $addMeal) { meal in
            ProductSearchSheet(store: store, meal: meal)
        }
        .sheet(item: $selectedEntry) { entry in
            FoodEntryEditor(store: store, entry: entry)
        }
        .task(id: store.selectedDate) {
            if store.state == .idle { await store.load() }
        }
        .refreshable { await store.load() }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("nutrition.screen")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("tab.nutrition")
                        .font(.system(size: 48, weight: .regular, design: .serif))
                    Text(store.selectedDate.formatted(.dateTime.day().month(.wide).year()))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button { calendarPresented = true } label: {
                    Image(systemName: "calendar")
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("nutrition.calendar")
            }
            HStack {
                Button { Task { await store.moveDay(-1) } } label: {
                    Label("nutrition.previousDay", systemImage: "chevron.left")
                }
                Spacer()
                Button("nutrition.today") {
                    Task { await store.select(date: .now) }
                }
                Spacer()
                Button { Task { await store.moveDay(1) } } label: {
                    Label("nutrition.nextDay", systemImage: "chevron.right")
                        .labelStyle(.iconOnly)
                }
                .accessibilityLabel("nutrition.nextDay")
            }
            .buttonStyle(.glass)
        }
        .padding(.top, 16)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text(store.summary.calories.formatted(.number.precision(.fractionLength(0))))
                    .font(.system(size: 64, weight: .regular, design: .serif))
                    .contentTransition(.numericText())
                Text("summary.calories.unit").foregroundStyle(.secondary)
            }
            HStack(spacing: 18) {
                macro("nutrition.protein.short", value: store.summary.protein)
                macro("nutrition.fat.short", value: store.summary.fat)
                macro("nutrition.carbohydrates.short", value: store.summary.carbohydrates)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .glassEffect(.regular, in: .rect(cornerRadius: 28))
    }

    private func macro(_ key: LocalizedStringKey, value: Double) -> some View {
        HStack(spacing: 5) {
            Text(key).foregroundStyle(.secondary)
            Text(value.formatted(.number.precision(.fractionLength(0...1))))
            Text("nutrition.grams.short").foregroundStyle(.secondary)
        }.font(.subheadline)
    }

    @ViewBuilder
    private var journal: some View {
        if store.state == .loading && store.entries.isEmpty {
            ProgressView("common.loading").frame(maxWidth: .infinity).padding(48)
        } else if store.state == .failed {
            ContentUnavailableView("nutrition.error", systemImage: "wifi.exclamationmark")
        } else {
            VStack(spacing: 0) {
                ForEach(MealType.allCases, id: \.self) { meal in
                    mealSection(meal)
                    if meal != MealType.allCases.last { Divider().opacity(0.28) }
                }
            }
            .glassEffect(.regular, in: .rect(cornerRadius: 28))
        }
    }

    private func mealSection(_ meal: MealType) -> some View {
        let values = store.entries(for: meal)
        let mealSummary = NutritionSummary(entries: values)
        return VStack(spacing: 0) {
            HStack {
                Button {
                    withAnimation(.snappy) {
                        if collapsedMeals.contains(meal) { collapsedMeals.remove(meal) }
                        else { collapsedMeals.insert(meal) }
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: meal.icon)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(meal.localizedKey).font(.title3)
                            Text("\(mealSummary.calories.formatted(.number.precision(.fractionLength(0)))) \(String(localized: "summary.calories.unit"))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .buttonStyle(.plain)
                Spacer()
                Button { addMeal = meal } label: {
                    Image(systemName: "plus").frame(width: 38, height: 38)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("nutrition.add")
            }
            .padding(16)

            if !collapsedMeals.contains(meal) {
                if values.isEmpty {
                    Text("nutrition.meal.empty")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 52)
                        .padding(.bottom, 16)
                } else {
                    ForEach(values) { entry in
                        Button { selectedEntry = entry } label: {
                            FoodEntryRow(entry: entry)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var nutrientButton: some View {
        HStack {
            Label("nutrition.allNutrients", systemImage: "slider.horizontal.3")
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.secondary)
        }
        .padding(18)
        .contentShape(Rectangle())
        .onTapGesture { nutrientsPresented = true }
        .accessibilityAddTraits(.isButton)
        .sheet(isPresented: $nutrientsPresented) {
            NavigationStack {
                NutrientDetailsView(
                    title: String(localized: "nutrition.allNutrients"),
                    nutrients: store.entries.flatMap(\.productSnapshot.nutrients)
                )
            }
        }
    }
}

private struct FoodEntryRow: View {
    let entry: FoodEntry

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.productSnapshot.name).font(.body)
                if let brand = entry.productSnapshot.brand {
                    Text(brand).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text("\(entry.quantity.amount.formatted(.number.precision(.fractionLength(0...1)))) \(entry.quantity.unitLabel)")
                .foregroundStyle(.secondary)
            if let calories = entry.productSnapshot.nutrients.first(where: { $0.key == "energy_kcal" })?.value {
                Text(calories.formatted(.number.precision(.fractionLength(0))))
                    .frame(minWidth: 38, alignment: .trailing)
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

private struct ProductSearchSheet: View {
    @Bindable var store: NutritionStore
    let meal: MealType
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selection: NutritionProduct?

    var body: some View {
        NavigationStack {
            List(store.products) { product in
                Button {
                    selection = product
                } label: {
                    VStack(alignment: .leading) {
                        Text(product.name)
                        if let brand = product.brand { Text(brand).font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
            .overlay {
                if store.products.isEmpty && !store.isSearching {
                    ContentUnavailableView("nutrition.search.empty", systemImage: "magnifyingglass")
                }
            }
            .searchable(text: $query, prompt: "nutrition.search")
            .navigationTitle("nutrition.add")
            .task(id: query) {
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                await store.search(query)
            }
            .sheet(item: $selection) { product in
                QuantityEditor(product: product, meal: meal) { quantity in
                    try await store.add(product: product, meal: meal, quantity: quantity)
                    dismiss()
                }
            }
        }
    }
}

private struct QuantityEditor: View {
    let product: NutritionProduct
    let meal: MealType
    let onSave: (FoodQuantity) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var amount = 100.0
    @State private var usePieces = false
    @State private var selectedSize: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("nutrition.quantity", value: $amount, format: .number)
                        .keyboardType(.decimalPad)
                    if !product.pieceSizes.isEmpty {
                        Toggle("nutrition.units.pieces", isOn: $usePieces)
                        if usePieces {
                            Picker("nutrition.pieceSize", selection: $selectedSize) {
                                ForEach(product.pieceSizes) { option in
                                    Text(option.size).tag(Optional(option.size))
                                }
                            }
                        }
                    }
                }
                Section {
                    NavigationLink("nutrition.allNutrients") {
                        NutrientDetailsView(title: product.name, nutrients: product.nutrientBases.first?.nutrients ?? [])
                    }
                }
            }
            .navigationTitle(product.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("common.cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.save") {
                        saving = true
                        Task {
                            try? await onSave(quantity)
                            saving = false
                        }
                    }.disabled(amount <= 0 || saving)
                }
            }
            .onAppear { selectedSize = product.pieceSizes.first?.size }
        }
    }

    private var quantity: FoodQuantity {
        if usePieces, let selectedSize { return .pieces(amount, size: selectedSize) }
        return product.baseUnit == "ml" ? .milliliters(amount) : .grams(amount)
    }
}

private struct FoodEntryEditor: View {
    @Bindable var store: NutritionStore
    let entry: FoodEntry
    @Environment(\.dismiss) private var dismiss
    @State private var meal: MealType
    @State private var amount: Double
    @State private var date: Date
    @State private var deleteConfirmation = false

    init(store: NutritionStore, entry: FoodEntry) {
        self.store = store
        self.entry = entry
        _meal = State(initialValue: entry.mealType)
        _amount = State(initialValue: entry.quantity.amount)
        _date = State(initialValue: entry.occurredAt)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("nutrition.meal", selection: $meal) {
                    ForEach(MealType.allCases, id: \.self) { Text($0.localizedKey).tag($0) }
                }
                TextField("nutrition.quantity", value: $amount, format: .number)
                    .keyboardType(.decimalPad)
                DatePicker("nutrition.date", selection: $date, displayedComponents: .date)
                NavigationLink("nutrition.allNutrients") {
                    NutrientDetailsView(title: entry.productSnapshot.name, nutrients: entry.productSnapshot.nutrients)
                }
                Button("nutrition.delete", role: .destructive) { deleteConfirmation = true }
            }
            .navigationTitle(entry.productSnapshot.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("common.cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.save") {
                        Task {
                            try? await store.update(entry: entry, meal: meal, quantity: updatedQuantity, date: date)
                            dismiss()
                        }
                    }
                }
            }
            .confirmationDialog("nutrition.delete.confirm", isPresented: $deleteConfirmation) {
                Button("nutrition.delete", role: .destructive) {
                    Task {
                        try? await store.delete(entry: entry)
                        dismiss()
                    }
                }
            }
        }
    }

    private var updatedQuantity: FoodQuantity {
        switch entry.quantity {
        case .grams: .grams(amount)
        case .milliliters: .milliliters(amount)
        case let .pieces(_, size): .pieces(amount, size: size)
        }
    }
}

struct NutrientDetailsView: View {
    let title: String
    let nutrients: [NutrientValue]

    var body: some View {
        List {
            ForEach(grouped, id: \.0) { group, values in
                Section {
                    ForEach(values) { nutrient in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(nutrient.label)
                                if nutrient.provenance != .stated {
                                    if nutrient.provenance == .estimated {
                                        Text("nutrition.estimated").font(.caption).foregroundStyle(.secondary)
                                    } else {
                                        Text("nutrition.calculated").font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            Spacer()
                            Text(displayValue(nutrient)).foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .contain)
                        .accessibilityIdentifier("nutrition.nutrient.\(nutrient.key ?? nutrient.label)")
                    }
                } header: {
                    Text(groupTitle(group))
                }
            }
        }
        .navigationTitle(title)
        .accessibilityIdentifier("nutrition.nutrients.screen")
    }

    private var grouped: [(String, [NutrientValue])] {
        let values = Dictionary(grouping: aggregate(nutrients), by: nutrientGroup)
        return ["nutrition.group.macros", "nutrition.group.fats", "nutrition.group.carbohydrates",
                "nutrition.group.salt", "nutrition.group.vitamins", "nutrition.group.minerals", "nutrition.group.other"]
            .compactMap { key in values[key].map { (key, $0) } }
    }

    private func aggregate(_ values: [NutrientValue]) -> [NutrientValue] {
        Dictionary(grouping: values, by: { "\($0.key ?? $0.label)-\($0.unit)" })
            .values.map { group in
                let first = group[0]
                let numericValues = group.compactMap(\.value)
                return NutrientValue(
                    key: first.key,
                    label: first.label,
                    value: numericValues.isEmpty ? nil : numericValues.reduce(0, +),
                    unit: first.unit, qualifier: first.qualifier, originalText: first.originalText,
                    dailyValuePercent: nil,
                    provenance: group.contains(where: { $0.provenance == .estimated }) ? .estimated
                        : group.contains(where: { $0.provenance == .calculated }) ? .calculated : .stated
                )
            }
    }

    private func nutrientGroup(_ nutrient: NutrientValue) -> String {
        let key = nutrient.key ?? ""
        if ["energy_kcal", "protein"].contains(key) { return "nutrition.group.macros" }
        if key.contains("fat") || key == "cholesterol" { return "nutrition.group.fats" }
        if key.contains("carbohydrate") || key.contains("sugar") || key == "fiber" { return "nutrition.group.carbohydrates" }
        if key == "salt" || key == "sodium" { return "nutrition.group.salt" }
        if key.hasPrefix("vitamin") { return "nutrition.group.vitamins" }
        if ["potassium", "calcium", "iron", "magnesium", "zinc", "phosphorus", "iodine", "selenium"].contains(key) {
            return "nutrition.group.minerals"
        }
        return "nutrition.group.other"
    }

    private func groupTitle(_ key: String) -> LocalizedStringKey {
        switch key {
        case "nutrition.group.macros": "nutrition.group.macros"
        case "nutrition.group.fats": "nutrition.group.fats"
        case "nutrition.group.carbohydrates": "nutrition.group.carbohydrates"
        case "nutrition.group.salt": "nutrition.group.salt"
        case "nutrition.group.vitamins": "nutrition.group.vitamins"
        case "nutrition.group.minerals": "nutrition.group.minerals"
        default: "nutrition.group.other"
        }
    }

    private func displayValue(_ nutrient: NutrientValue) -> String {
        if nutrient.qualifier == "trace" { return nutrient.originalText ?? String(localized: "nutrition.trace") }
        let prefix = nutrient.qualifier == "less_than" ? "< " : nutrient.qualifier == "approximately" ? "≈ " : ""
        return "\(prefix)\(nutrient.value?.formatted(.number.precision(.fractionLength(0...2))) ?? "") \(nutrient.unit)"
    }
}

private struct NutritionCalendarSheet: View {
    @State var selection: Date
    let onSelect: (Date) -> Void

    var body: some View {
        NavigationStack {
            DatePicker("nutrition.date", selection: $selection, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding()
                .navigationTitle("nutrition.calendar")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("common.done") { onSelect(selection) }
                    }
                }
        }
        .presentationDetents([.medium])
    }
}

extension MealType {
    var id: String { rawValue }
    var localizedKey: LocalizedStringKey {
        switch self {
        case .breakfast: "nutrition.meal.breakfast"
        case .lunch: "nutrition.meal.lunch"
        case .dinner: "nutrition.meal.dinner"
        case .snack: "nutrition.meal.snack"
        }
    }
    var icon: String {
        switch self {
        case .breakfast: "sunrise"
        case .lunch: "sun.max"
        case .dinner: "sunset"
        case .snack: "moon"
        }
    }
}

extension MealType: Identifiable {}

#Preview("Nutrition populated") {
    NutritionView(store: NutritionStore(repository: PreviewNutritionRepository()))
}

#Preview("Nutrition empty") {
    NutritionView(store: NutritionStore(repository: PreviewNutritionRepository(entriesValue: [])))
}

#Preview("All nutrients") {
    NavigationStack {
        NutrientDetailsView(title: "Banana", nutrients: PreviewNutrition.nutrients)
    }
}
