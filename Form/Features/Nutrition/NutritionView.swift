import SwiftUI

/// Shared warm editorial background for the nutrition screen and every sheet it presents.
func nutritionBackgroundGradient() -> some View {
    LinearGradient(
        colors: [Color.black, Color(red: 0.10, green: 0.085, blue: 0.07), .black],
        startPoint: .topLeading, endPoint: .bottomTrailing
    ).ignoresSafeArea()
}

/// One-time column header ("Fat / Carbs / Protein / kcal") shown once at the top of a group of rows.
/// Columns share the row width equally (like MacroColumns below), so labels land directly above the
/// numbers in every subsequent row regardless of what precedes those rows.
struct MacroColumnsHeader: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("nutrition.fat.short").frame(maxWidth: .infinity, alignment: .trailing)
            Text("nutrition.carbohydrates.short").frame(maxWidth: .infinity, alignment: .trailing)
            Text("nutrition.protein.short").frame(maxWidth: .infinity, alignment: .trailing)
            Text("summary.calories.unit").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.caption2)
        .foregroundStyle(.tertiary)
        .textCase(.uppercase)
    }
}

/// Fat/carbs/protein/kcal values, numbers only (labels live in MacroColumnsHeader), spanning the
/// full row width in four equal columns — a standalone row, never sharing space with a title, icon,
/// or button, so it can never get crushed into character-wrapping on a real iPhone width. kcal is the
/// only emphasized column, so it stands in for a separate calorie headline wherever this row appears.
struct MacroColumns: View {
    let summary: NutritionSummary
    var font: Font = .subheadline

    var body: some View {
        HStack(spacing: 0) {
            value(summary.fat)
            value(summary.carbohydrates)
            value(summary.protein)
            value(summary.calories, emphasized: true)
        }
        .font(font)
    }

    private func value(_ value: Double, emphasized: Bool = false) -> some View {
        Text(value.formatted(.number.precision(.fractionLength(0))))
            .monospacedDigit()
            .foregroundStyle(emphasized ? .primary : .secondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

/// Reusable single-line item row for both logged entries and browsable products: a name, an optional
/// trailing caption (quantity or reference amount), and the macro breakdown beneath it. No secondary
/// title line — brand/store metadata isn't shown here, keeping lists compact and scannable.
struct NutritionItemRow: View {
    let title: String
    var trailingCaption: String?
    let summary: NutritionSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(title).font(.body).lineLimit(1)
                Spacer(minLength: 8)
                if let trailingCaption {
                    Text(trailingCaption).font(.caption).foregroundStyle(.secondary)
                }
                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
            }
            if summary.calories > 0 {
                MacroColumns(summary: summary, font: .caption)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

struct NutritionView: View {
    @Bindable var store: NutritionStore

    @State private var calendarPresented = false
    @State private var addMeal: MealType?
    @State private var selectedEntry: FoodEntry?
    @State private var nutrientsPresented = false
    @State private var collapsedMeals: Set<MealType> = []
    @State private var reportSharePayload: NutritionReportSharePayload?
    @State private var goalsEditorPresented = false
    @AppStorage("activity.stepGoal") private var stepGoal = 12_000
    @AppStorage("nutrition.goals") private var goals = NutritionGoals()

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 32) {
                    header
                    journal
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 100)
            }
            .background { nutritionBackgroundGradient() }
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
        .sheet(item: $reportSharePayload) { payload in
            NutritionReportShareSheet(text: payload.text, url: payload.url)
        }
        .sheet(isPresented: $goalsEditorPresented) {
            NutritionGoalsEditor(goals: $goals)
        }
        .sheet(isPresented: $nutrientsPresented) {
            NavigationStack {
                NutrientDetailsView(
                    title: String(localized: "nutrition.allNutrients"),
                    nutrients: store.entries.flatMap(\.productSnapshot.nutrients)
                )
            }
            .presentationDragIndicator(.visible)
        }
        .task(id: store.selectedDate) {
            if store.state == .idle { await store.load() }
        }
        .onAppear { Task { await store.load() } }
        .refreshable { await store.load() }
        .alert("nutrition.save.error", isPresented: Binding(
            get: { store.saveError != nil },
            set: { if !$0 { store.clearSaveError() } }
        )) {
            Button("common.ok") { store.clearSaveError() }
        } message: {
            Text(store.saveError ?? "")
        }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("nutrition.screen")
    }

    /// Compact date navigation and an overflow menu, gathered into the top-right corner — no page title.
    private var header: some View {
        HStack(spacing: 8) {
            Spacer()
            Menu {
                Button { nutrientsPresented = true } label: {
                    Label("nutrition.allNutrients", systemImage: "slider.horizontal.3")
                }
                Button { goalsEditorPresented = true } label: {
                    Label("nutrition.goals.edit", systemImage: "target")
                }
            } label: {
                Image(systemName: "ellipsis").frame(width: 36, height: 36)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("nutrition.moreOptions")
            .accessibilityIdentifier("nutrition.menu")

            Button { Task { await exportReport() } } label: {
                Group {
                    if store.isExportingReport {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
                .frame(width: 36, height: 36)
            }
            .buttonStyle(.glass)
            .disabled(store.isExportingReport || store.entries.isEmpty)
            .accessibilityLabel("nutrition.export")
            .accessibilityIdentifier("nutrition.export")

            HStack(spacing: 2) {
                Button { Task { await store.moveDay(-1) } } label: {
                    Image(systemName: "chevron.left").frame(width: 36, height: 36)
                }
                .accessibilityLabel("nutrition.previousDay")

                Button { calendarPresented = true } label: {
                    Text(dateLabel)
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 10)
                        .frame(height: 36)
                }
                .accessibilityLabel("nutrition.calendar")

                Button { Task { await store.moveDay(1) } } label: {
                    Image(systemName: "chevron.right").frame(width: 36, height: 36)
                }
                .accessibilityLabel("nutrition.nextDay")
            }
            .buttonStyle(.glass)
        }
        .padding(.top, 8)
    }

    private func exportReport() async {
        if let payload = await store.exportReport(stepGoal: stepGoal, goals: goals) {
            reportSharePayload = payload
        }
    }

    private var dateLabel: String {
        if Calendar.current.isDateInToday(store.selectedDate) {
            return String(localized: "nutrition.today")
        }
        return store.selectedDate.formatted(.dateTime.day().month(.abbreviated))
    }

    @ViewBuilder
    private var journal: some View {
        if store.state == .loading && store.entries.isEmpty {
            ProgressView("common.loading").frame(maxWidth: .infinity).padding(48)
        } else if store.state == .failed {
            ContentUnavailableView("nutrition.error", systemImage: "wifi.exclamationmark")
        } else {
            VStack(alignment: .leading, spacing: 32) {
                MacroColumnsHeader().padding(.leading, 26)
                ForEach(MealType.allCases, id: \.self) { meal in
                    mealSection(meal)
                }
            }
        }
    }

    private func mealSection(_ meal: MealType) -> some View {
        let values = store.entries(for: meal)
        let mealSummary = NutritionSummary(entries: values)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Button {
                    withAnimation(.snappy) {
                        if collapsedMeals.contains(meal) { collapsedMeals.remove(meal) }
                        else { collapsedMeals.insert(meal) }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: meal.icon).font(.subheadline).foregroundStyle(.secondary)
                        Text(meal.localizedKey).font(.title3.weight(.semibold))
                    }
                }
                .buttonStyle(.plain)
                Spacer(minLength: 8)
                Button { addMeal = meal } label: {
                    Image(systemName: "plus").font(.subheadline).frame(width: 30, height: 30)
                }
                .buttonStyle(.glass)
                .accessibilityLabel("nutrition.add")
                .accessibilityIdentifier("nutrition.add.\(meal.rawValue)")
            }
            if !values.isEmpty {
                MacroColumns(summary: mealSummary, font: .caption)
                    .padding(.leading, 26)
            }

            if !collapsedMeals.contains(meal) {
                if values.isEmpty {
                    Text("nutrition.meal.empty")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                        .padding(.top, 4)
                        .padding(.leading, 26)
                } else {
                    VStack(spacing: 0) {
                        ForEach(values) { entry in
                            Button { selectedEntry = entry } label: {
                                NutritionItemRow(
                                    title: entry.productSnapshot.name,
                                    trailingCaption: "\(entry.quantity.amount.formatted(.number.precision(.fractionLength(0...1)))) \(entry.quantity.unitLabel)",
                                    summary: NutritionSummary(nutrients: entry.productSnapshot.nutrients)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 6)
                    .padding(.leading, 26)
                }
            }
        }
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
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 28) {
                    MacroColumnsHeader()
                    if query.isEmpty {
                        browseSections
                    } else {
                        searchResults
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background { nutritionBackgroundGradient() }
            .scrollContentBackground(.hidden)
            .overlay {
                if isEmptyState {
                    ContentUnavailableView("nutrition.search.empty", systemImage: "magnifyingglass")
                }
            }
            .searchable(text: $query, prompt: "nutrition.search")
            .navigationTitle("nutrition.add")
            .navigationBarTitleDisplayMode(.inline)
            .task { await store.beginBrowsing(meal: meal) }
            .task(id: query) {
                guard !query.isEmpty else { return }
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
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    private var isEmptyState: Bool {
        if query.isEmpty {
            return store.mealHistoryProducts.isEmpty && store.discoverProducts.isEmpty
                && !store.isLoadingMealHistory && !store.isLoadingDiscover
        }
        return store.products.isEmpty && !store.isSearching
    }

    @ViewBuilder
    private var browseSections: some View {
        if !store.mealHistoryProducts.isEmpty {
            productSection(
                title: "nutrition.recentInMeal",
                products: store.mealHistoryProducts,
                hasMore: store.mealHistoryHasMore,
                isLoading: store.isLoadingMealHistory
            ) { await store.loadMoreMealHistory(meal: meal) }
        }
        if !store.discoverProducts.isEmpty {
            productSection(
                title: "nutrition.moreProducts",
                products: store.discoverProducts,
                hasMore: store.discoverHasMore,
                isLoading: store.isLoadingDiscover
            ) { await store.loadMoreDiscoverProducts() }
        }
    }

    private func productSection(
        title: LocalizedStringKey,
        products: [NutritionProduct],
        hasMore: Bool,
        isLoading: Bool,
        loadMore: @escaping () async -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.tertiary).textCase(.uppercase)
            VStack(spacing: 0) {
                ForEach(products) { product in
                    Button { selection = product } label: {
                        NutritionItemRow(
                            title: product.name,
                            trailingCaption: referenceCaption(for: product),
                            summary: product.referenceSummary
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            if hasMore {
                Button {
                    Task { await loadMore() }
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("nutrition.showMore")
                    }
                }
                .buttonStyle(.plain)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.top, 4)
            }
        }
    }

    private var searchResults: some View {
        VStack(spacing: 0) {
            ForEach(store.products) { product in
                Button { selection = product } label: {
                    NutritionItemRow(
                        title: product.name,
                        trailingCaption: referenceCaption(for: product),
                        summary: product.referenceSummary
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func referenceCaption(for product: NutritionProduct) -> String? {
        guard let base = product.referenceBase else { return nil }
        let unit = product.baseUnit == "ml" ? String(localized: "nutrition.milliliters.short") : String(localized: "nutrition.grams.short")
        return "\(String(localized: "nutrition.per")) \(base.amount.formatted(.number.precision(.fractionLength(0)))) \(unit)"
    }
}

private struct QuantityEditor: View {
    let product: NutritionProduct
    let meal: MealType
    let onSave: (FoodQuantity) async throws -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var amount = 100.0
    @State private var pieceSelection: PieceSizeOption?
    @State private var baseSelection: NutrientBase?
    @State private var saving = false
    @State private var nutrientsPresented = false
    @FocusState private var amountFocused: Bool

    private var unitLabel: String {
        product.baseUnit == "ml" ? String(localized: "nutrition.milliliters.short") : String(localized: "nutrition.grams.short")
    }

    private var quantity: FoodQuantity {
        if let pieceSelection { return .pieces(1, size: pieceSelection.size) }
        let effectiveAmount = baseSelection?.amount ?? amount
        return product.baseUnit == "ml" ? .milliliters(effectiveAmount) : .grams(effectiveAmount)
    }

    private var preview: NutritionSummary {
        if let baseSelection { return NutritionSummary(nutrients: baseSelection.nutrients) }
        return product.summary(for: quantity)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    topBar

                    VStack(alignment: .leading, spacing: 2) {
                        Text(product.name).font(.system(size: 28, weight: .regular, design: .serif))
                        if let brand = product.brand { Text(brand).foregroundStyle(.secondary) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: 8) {
                        MacroColumnsHeader()
                        MacroColumns(summary: preview, font: .title3)
                    }
                    .animation(.snappy, value: preview)

                    quickSelect

                    if pieceSelection == nil && baseSelection == nil {
                        amountField
                    }

                    Button { nutrientsPresented = true } label: {
                        HStack {
                            Text("nutrition.allNutrients")
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background { nutritionBackgroundGradient() }
            .scrollContentBackground(.hidden)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $nutrientsPresented) {
                NavigationStack {
                    NutrientDetailsView(title: product.name, nutrients: product.referenceBase?.nutrients ?? [])
                }
                .presentationDragIndicator(.visible)
            }
        }
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    private var topBar: some View {
        HStack {
            Button("common.cancel") { dismiss() }.foregroundStyle(.secondary)
            Spacer()
            Button("common.save") {
                saving = true
                Task {
                    try? await onSave(quantity)
                    saving = false
                }
            }
            .fontWeight(.semibold)
            .disabled(currentAmount <= 0 || saving)
        }
        .buttonStyle(.plain)
    }

    private var currentAmount: Double {
        if pieceSelection != nil { return 1 }
        if let baseSelection { return baseSelection.amount }
        return amount
    }

    /// servingSizes hints that don't already have a matching alternate nutrientBase (which would carry
    /// more accurate, directly stated values for the same amount) — avoids showing the same portion twice.
    private var dedupedServingSizes: [ServingSizeOption] {
        let baseAmounts = Set(product.alternateBases.map { $0.amount.rounded() })
        return product.servingSizes.filter { !baseAmounts.contains($0.amount.rounded()) }
    }

    @ViewBuilder
    private var quickSelect: some View {
        if !dedupedServingSizes.isEmpty || !product.pieceSizes.isEmpty || !product.alternateBases.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("nutrition.quickSelect").font(.caption).foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        chip(label: "100 \(unitLabel)", isSelected: pieceSelection == nil && baseSelection == nil && amount == 100) {
                            pieceSelection = nil
                            baseSelection = nil
                            amount = 100
                        }
                        ForEach(product.alternateBases) { base in
                            chip(label: base.label, isSelected: baseSelection == base) {
                                pieceSelection = nil
                                baseSelection = base
                            }
                        }
                        ForEach(dedupedServingSizes) { serving in
                            chip(label: serving.label, isSelected: pieceSelection == nil && baseSelection == nil && amount == serving.amount) {
                                pieceSelection = nil
                                baseSelection = nil
                                amount = serving.amount
                            }
                        }
                        ForEach(product.pieceSizes) { piece in
                            chip(label: pieceLabel(piece), isSelected: pieceSelection == piece) {
                                pieceSelection = piece
                                baseSelection = nil
                            }
                        }
                    }
                }
            }
        }
    }

    private func chip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(isSelected ? Color.black : Color.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background {
                    Capsule().fill(isSelected ? Color.white : Color.white.opacity(0.14))
                }
        }
        .buttonStyle(.plain)
    }

    private func pieceLabel(_ piece: PieceSizeOption) -> String {
        "1 · \(piece.size) (\(piece.grams.formatted(.number.precision(.fractionLength(0)))) \(String(localized: "nutrition.grams.short")))"
    }

    private var amountField: some View {
        HStack {
            Text("nutrition.quantity").foregroundStyle(.secondary)
            Spacer()
            TextField("nutrition.quantity", value: $amount, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .focused($amountFocused)
            Text(unitLabel).foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
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
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    topBar

                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.productSnapshot.name).font(.system(size: 28, weight: .regular, design: .serif))
                        if let brand = entry.productSnapshot.brand { Text(brand).foregroundStyle(.secondary) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Picker("nutrition.meal", selection: $meal) {
                        ForEach(MealType.allCases, id: \.self) { Text($0.localizedKey).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    HStack {
                        Text("nutrition.quantity").foregroundStyle(.secondary)
                        Spacer()
                        TextField("nutrition.quantity", value: $amount, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                        Text(entry.quantity.unitLabel).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)

                    DatePicker("nutrition.date", selection: $date, displayedComponents: .date)

                    NavigationLink("nutrition.allNutrients") {
                        NutrientDetailsView(title: entry.productSnapshot.name, nutrients: entry.productSnapshot.nutrients)
                    }
                    .foregroundStyle(.secondary)

                    Button("nutrition.delete", role: .destructive) { deleteConfirmation = true }
                        .buttonStyle(.plain)
                        .foregroundStyle(.red)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 40)
            }
            .background { nutritionBackgroundGradient() }
            .scrollContentBackground(.hidden)
            .toolbar(.hidden, for: .navigationBar)
            .confirmationDialog("nutrition.delete.confirm", isPresented: $deleteConfirmation) {
                Button("nutrition.delete", role: .destructive) {
                    Task {
                        try? await store.delete(entry: entry)
                        dismiss()
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    private var topBar: some View {
        HStack {
            Button("common.cancel") { dismiss() }.foregroundStyle(.secondary)
            Spacer()
            Button("common.save") {
                Task {
                    try? await store.update(entry: entry, meal: meal, quantity: updatedQuantity, date: date)
                    dismiss()
                }
            }
            .fontWeight(.semibold)
        }
        .buttonStyle(.plain)
    }

    private var updatedQuantity: FoodQuantity {
        switch entry.quantity {
        case .grams: .grams(amount)
        case .milliliters: .milliliters(amount)
        case let .pieces(_, size): .pieces(amount, size: size)
        case let .serving(_, label, servingSizeId): .serving(amount, label: label, servingSizeId: servingSizeId)
        case .asConsumed: entry.quantity
        }
    }
}

/// Optional daily macro targets, entirely user-set — every field can be left blank, and a blank field
/// simply means the exported report shows no achieved/under/over signal for that macro rather than
/// comparing against a target the person never actually configured.
private struct NutritionGoalsEditor: View {
    @Binding var goals: NutritionGoals
    @Environment(\.dismiss) private var dismiss

    @State private var caloriesText: String
    @State private var proteinText: String
    @State private var fatText: String
    @State private var carbsText: String

    init(goals: Binding<NutritionGoals>) {
        _goals = goals
        _caloriesText = State(initialValue: goals.wrappedValue.calories.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "")
        _proteinText = State(initialValue: goals.wrappedValue.protein.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "")
        _fatText = State(initialValue: goals.wrappedValue.fat.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "")
        _carbsText = State(initialValue: goals.wrappedValue.carbohydrates.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                topBar
                Text("nutrition.goals.message")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                field("summary.calories.unit", text: $caloriesText)
                field("nutrition.protein.short", text: $proteinText)
                field("nutrition.fat.short", text: $fatText)
                field("nutrition.carbohydrates.short", text: $carbsText)
                Spacer()
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 40)
            .background { nutritionBackgroundGradient() }
            .toolbar(.hidden, for: .navigationBar)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    private var topBar: some View {
        HStack {
            Text("nutrition.goals.title").font(.title3.weight(.semibold))
            Spacer()
            Button("common.save") {
                goals = NutritionGoals(
                    calories: Double(caloriesText), protein: Double(proteinText),
                    fat: Double(fatText), carbohydrates: Double(carbsText)
                )
                dismiss()
            }
            .fontWeight(.semibold)
        }
        .buttonStyle(.plain)
    }

    private func field(_ label: LocalizedStringKey, text: Binding<String>) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            TextField("nutrition.goals.placeholder", text: text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 8)
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
        .presentationDragIndicator(.visible)
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

#Preview("Quantity: quick select") {
    QuantityEditor(product: PreviewNutrition.proteinMilk, meal: .breakfast) { _ in }
}

#Preview("Quantity: piece sizes") {
    QuantityEditor(product: PreviewNutrition.banana, meal: .breakfast) { _ in }
}
