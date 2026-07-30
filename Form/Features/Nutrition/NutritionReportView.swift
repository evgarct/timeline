import Charts
import SwiftUI
import UIKit

/// Fixed landscape size for the cover page — split into an activity half and a nutrition-summary half,
/// so both dimensions need to be fixed rather than left to flow like the detail page.
let reportCoverPageSize = CGSize(width: 1600, height: 1000)

/// Width for the detail page — landscape, matching the cover page's width. Height flows from content
/// (measured by `ImageRenderer`), since a day's entry count varies but every entry must appear (no
/// truncation) per the full-table requirement.
let reportDetailPageWidth: CGFloat = reportCoverPageSize.width

/// Square frame for the brand mark — matches `ActivityShareCard`'s proven 88×88 sizing so the logo
/// reads at the same scale everywhere it appears, with `aspectRatio` pinned explicitly (on top of the
/// asset's own `scaledToFit()`) so it can never be stretched or clipped by an enclosing layout pass.
private func brandMark(size: CGFloat) -> some View {
    TraceSymbol(appearance: .primary)
        .aspectRatio(1, contentMode: .fit)
        .frame(width: size, height: size)
}

// `String(localized:locale:)` does not reliably pick the requested locale's translation on-device
// (confirmed empirically: it fell back to the device's preferred language even with an explicit
// `locale:` argument) — every unit/format string here is built from `Text("key")` segments instead,
// which does correctly follow the `\.locale` environment value applied at the render call site.
private func gramsText(_ formattedValue: String) -> Text {
    Text(formattedValue) + Text(" ") + Text("nutrition.grams.short")
}

private func millilitersText(_ formattedValue: String) -> Text {
    Text(formattedValue) + Text(" ") + Text("nutrition.milliliters.short")
}

private func kcalText(_ formattedValue: String) -> Text {
    Text(formattedValue) + Text(" ") + Text("summary.calories.unit")
}

/// Achieved/under/over relative to a user-set goal — a ±10% band counts as "on target" so ordinary
/// day-to-day noise doesn't flip the signal. Only computed when a goal is actually set (see
/// `goalSignal(actual:goal:...)` below); there is no fallback/inferred goal.
private enum ReportGoalStatus {
    case onTarget
    case under(Double)
    case over(Double)

    init(actual: Double, goal: Double) {
        guard goal > 0 else { self = .onTarget; return }
        let ratio = actual / goal
        if ratio < 0.9 { self = .under(goal - actual) }
        else if ratio > 1.1 { self = .over(actual - goal) }
        else { self = .onTarget }
    }

    /// Monochrome — the report has no color language for status, so the three states are told apart by
    /// shape alone (down/check/up), not by hue.
    var symbolName: String {
        switch self {
        case .onTarget: "checkmark"
        case .under: "arrow.down"
        case .over: "arrow.up"
        }
    }
}

/// A compact achieved/under/over signal shown under a macro figure — only rendered when a goal is set
/// for that macro, per the "goals change too often to always compare against" constraint: the signal
/// is opt-in, never inferred.
@ViewBuilder
private func goalSignal(actual: Double, goal: Double?, palette: ActivityPalette, locale: Locale) -> some View {
    if let goal, goal > 0 {
        let status = ReportGoalStatus(actual: actual, goal: goal)
        HStack(spacing: 5) {
            Image(systemName: status.symbolName)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(palette.muted)
            goalDeltaText(status, locale: locale)
                .font(.caption2)
                .foregroundStyle(palette.muted)
        }
    }
}

@ViewBuilder
private func goalDeltaText(_ status: ReportGoalStatus, locale: Locale) -> some View {
    switch status {
    case .onTarget:
        Text("nutrition.report.goal.onTarget")
    case let .under(amount):
        Text(amount.formatted(.number.precision(.fractionLength(0)).locale(locale))) + Text(" ") + Text("nutrition.report.goal.under")
    case let .over(amount):
        Text(amount.formatted(.number.precision(.fractionLength(0)).locale(locale))) + Text(" ") + Text("nutrition.report.goal.over")
    }
}

/// Page 1 of the exported PDF: a landscape cover split into "Активность" (left) and "Питание" (right),
/// intended to work as a stand-alone at-a-glance summary even before the reader opens page 2's full
/// table. Always the light brand palette; logo-forward; no product name text; no comparison against
/// macro goals (those change too often to be worth printing).
struct NutritionReportCoverPage: View {
    let payload: NutritionReportPayload

    @Environment(\.locale) private var locale
    private let palette = ActivityPalette(colorScheme: .light)

    var body: some View {
        ZStack(alignment: .topLeading) {
            palette.background
            VStack(alignment: .leading, spacing: 56) {
                header
                HStack(alignment: .top, spacing: 64) {
                    if let activity = payload.activity {
                        ReportActivityBlock(snapshot: activity, stepGoal: payload.stepGoal, locale: locale, palette: palette)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Rectangle().fill(palette.track).frame(width: 1.5)
                    }
                    ReportNutritionSummaryBlock(payload: payload, locale: locale, palette: palette)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(64)
        }
        .frame(width: reportCoverPageSize.width, height: reportCoverPageSize.height)
        .environment(\.colorScheme, .light)
    }

    private var header: some View {
        HStack(alignment: .top) {
            brandMark(size: 88)
            Spacer()
            Text(payload.date.formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(locale)))
                .font(.system(size: 26, weight: .regular, design: .serif))
                .foregroundStyle(palette.muted)
        }
    }
}

/// Fixed width for the Ж/У/Б/ккал block on every table row (header, day total, meal subtotal, item) —
/// keeping this identical across all of them, regardless of what sits to its left, is what makes the
/// columns line up like a real table without drawing a single grid line.
private let reportTableMacroColumnWidth: CGFloat = 460

/// Shared height reserved for each cover-page half's content *above* its chart (hero, goal row,
/// any secondary figures, weekly-average line) — both `ReportActivityBlock` and
/// `ReportNutritionSummaryBlock` wrap that content in `.frame(minHeight:, alignment: .top)` at this
/// value, so the two charts start at the same Y regardless of which half has more rows above it
/// (nutrition has an extra Б/Ж/У row activity doesn't need).
private let reportCoverAboveChartHeight: CGFloat = 360

/// Fixed width for the leading name/label cell — deliberately NOT `maxWidth: .infinity`: letting it
/// stretch across the whole landscape page put the Ж/У/Б/ккал block far away from a short product
/// name. A fixed width keeps the numbers right next to what they describe.
private let reportTableNameColumnWidth: CGFloat = 640

/// Nutrient keys worth calling out per item when the product's label actually stated them (as opposed
/// to the canonical Б/Ж/У/ккал, which every row already shows) — mapped to a fixed Russian label since
/// the *scanned* label is often multi-language or in the product's original language.
private func reportNotableExtraKeys() -> [(key: String, label: LocalizedStringKey)] {
    [
        ("salt", "nutrition.report.extra.salt"),
        ("sodium", "nutrition.report.extra.sodium"),
        ("fiber", "nutrition.report.fiber"),
        ("sugars", "nutrition.report.extra.sugars"),
        ("saturated_fat", "nutrition.report.extra.saturatedFat")
    ]
}

/// A single table row: flexible leading content (name, meal label, "Итого за день"...) on the left,
/// the same fixed-width Ж/У/Б/ккал block on the right — reuses `MacroColumns`, the exact component the
/// in-app nutrition list uses, so the report's numbers are laid out identically to the app.
private struct ReportTableRow<Leading: View>: View {
    let summary: NutritionSummary
    var font: Font = .callout
    @ViewBuilder let leading: Leading

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 20) {
            leading.frame(width: reportTableNameColumnWidth, alignment: .leading)
            MacroColumns(summary: summary, font: font).frame(width: reportTableMacroColumnWidth)
        }
    }
}

/// Page 2+: the full day as one borderless table — landscape, matching the cover page's width. Every
/// logged item appears (no truncation), grouped by meal, with a day total at the top; product name and
/// quantity share one cell with the macro figures on the same row (no separate rows, no divider lines —
/// grouping comes from whitespace and the meal header alone).
struct NutritionReportDetailPage: View {
    let payload: NutritionReportPayload

    @Environment(\.locale) private var locale
    private let palette = ActivityPalette(colorScheme: .light)

    var body: some View {
        ZStack(alignment: .top) {
            palette.background
            VStack(alignment: .leading, spacing: 36) {
                header
                breakdownRow
                mealTable
            }
            .padding(64)
        }
        .frame(width: reportDetailPageWidth)
        .fixedSize(horizontal: false, vertical: true)
        .environment(\.colorScheme, .light)
    }

    private var header: some View {
        HStack(spacing: 16) {
            brandMark(size: 56)
            Text("nutrition.report.nutrition.title")
                .font(.title2.weight(.semibold))
                .foregroundStyle(palette.foreground)
            Spacer()
            Text(payload.date.formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(locale)))
                .font(.system(size: 20, weight: .regular, design: .serif))
                .foregroundStyle(palette.muted)
        }
    }

    /// Fiber/fat/carb breakdowns side by side (landscape has the width for it) — each only appears when
    /// its underlying nutrient was actually stated on at least one item today.
    @ViewBuilder
    private var breakdownRow: some View {
        let showFiber = payload.summary.hasFiber
        let showFat = payload.summary.hasSaturatedFat
        let showCarbs = payload.summary.hasSugars
        if showFiber || showFat || showCarbs {
            HStack(alignment: .top, spacing: 40) {
                if showFiber { fiberCallout.frame(maxWidth: .infinity, alignment: .leading) }
                if showFat { fatBreakdown.frame(maxWidth: .infinity, alignment: .leading) }
                if showCarbs { carbBreakdown.frame(maxWidth: .infinity, alignment: .leading) }
            }
        }
    }

    private var fiberCallout: some View {
        HStack(spacing: 20) {
            Image(systemName: "leaf.fill")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(palette.accent)
            VStack(alignment: .leading, spacing: 2) {
                gramsText(payload.summary.fiber.formatted(.number.precision(.fractionLength(0...1))))
                    .font(.system(size: 26, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(palette.foreground)
                Text("nutrition.report.fiber")
                    .font(.caption)
                    .foregroundStyle(palette.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(palette.track, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var fatBreakdown: some View {
        proxyBreakdown(
            title: "nutrition.report.fat.title",
            leftValue: payload.summary.saturatedFat, leftLabel: "nutrition.report.fat.saturated",
            rightValue: payload.summary.unsaturatedFat, rightLabel: "nutrition.report.fat.unsaturated",
            caption: "nutrition.report.fat.caption"
        )
    }

    private var carbBreakdown: some View {
        proxyBreakdown(
            title: "nutrition.report.carbs.title",
            leftValue: payload.summary.sugars, leftLabel: "nutrition.report.carbs.sugars",
            rightValue: payload.summary.complexCarbs, rightLabel: "nutrition.report.carbs.complex",
            caption: "nutrition.report.carbs.caption"
        )
    }

    /// A two-segment split (e.g. saturated/unsaturated fat, sugars/complex carbs) with a proportional
    /// bar and a hedged caption — these are composition-based proxies, not precise classifications.
    private func proxyBreakdown(
        title: LocalizedStringKey,
        leftValue: Double, leftLabel: LocalizedStringKey,
        rightValue: Double, rightLabel: LocalizedStringKey,
        caption: LocalizedStringKey
    ) -> some View {
        let total = max(leftValue + rightValue, 0.0001)
        return VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.foreground)
            GeometryReader { proxy in
                HStack(spacing: 3) {
                    Capsule().fill(palette.accent)
                        .frame(width: proxy.size.width * (leftValue / total))
                    Capsule().fill(palette.track)
                }
            }
            .frame(height: 14)
            VStack(alignment: .leading, spacing: 10) {
                breakdownFigure(value: leftValue, label: leftLabel, dot: palette.accent)
                breakdownFigure(value: rightValue, label: rightLabel, dot: palette.track)
            }
            Text(caption)
                .font(.caption2)
                .foregroundStyle(palette.muted)
        }
    }

    private func breakdownFigure(value: Double, label: LocalizedStringKey, dot: Color) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Circle().fill(dot).frame(width: 10, height: 10).padding(.top, 4)
            gramsText(value.formatted(.number.precision(.fractionLength(0...1))))
                .font(.callout.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(palette.foreground)
                .fixedSize()
            Text(label)
                .font(.caption)
                .foregroundStyle(palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var mealTable: some View {
        VStack(alignment: .leading, spacing: 34) {
            tableHeader
            ReportTableRow(summary: NutritionSummary(entries: payload.allEntries), font: .body.weight(.semibold)) {
                Text("nutrition.report.table.dayTotal")
                    .font(.headline)
                    .foregroundStyle(palette.foreground)
            }
            ForEach(MealType.allCases.filter { !payload.entries(for: $0).isEmpty }, id: \.self) { meal in
                mealSection(meal)
            }
        }
    }

    private var tableHeader: some View {
        HStack(spacing: 20) {
            Text("nutrition.report.table.item")
                .font(.caption2.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(palette.muted)
                .frame(width: reportTableNameColumnWidth, alignment: .leading)
            MacroColumnsHeader().frame(width: reportTableMacroColumnWidth)
        }
    }

    /// Meal rows get an accent band behind them (bleeding past the row's own bounds via negative
    /// padding, so it doesn't shift the row and break column alignment with everything else) — with
    /// borders off the table, this is what makes one meal visually distinct from the next.
    private func mealSection(_ meal: MealType) -> some View {
        let entries = payload.entries(for: meal)
        let mealSummary = NutritionSummary(entries: entries)
        return VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 6) {
                ReportTableRow(summary: mealSummary, font: .subheadline.weight(.semibold)) {
                    HStack(spacing: 8) {
                        Image(systemName: meal.icon).font(.subheadline).foregroundStyle(palette.foreground)
                        Text(meal.localizedKey).font(.subheadline.weight(.semibold)).foregroundStyle(palette.foreground)
                    }
                }
                dayShareRow(mealSummary)
            }
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(palette.track)
                    .padding(.horizontal, -16)
            )

            VStack(alignment: .leading, spacing: 22) {
                ForEach(entries) { entry in
                    VStack(alignment: .leading, spacing: 8) {
                        ReportTableRow(summary: NutritionSummary(nutrients: entry.productSnapshot.nutrients), font: .callout) {
                            itemLabel(entry)
                        }
                        extrasLine(entry)
                    }
                }
            }
        }
    }

    /// What share of the *day's own total* this meal made up for each macro, aligned under the same
    /// Ж/У/Б/ккал columns — e.g. "32% от дня" for calories. This is a same-day proportion, not a
    /// goal comparison (that's what the cover page's achieved/under/over signals are for).
    private func dayShareRow(_ mealSummary: NutritionSummary) -> some View {
        let dayTotal = payload.summary
        return HStack(spacing: 20) {
            Spacer(minLength: 0).frame(width: reportTableNameColumnWidth)
            HStack(spacing: 0) {
                dayShare(mealSummary.fat, dayTotal.fat)
                dayShare(mealSummary.carbohydrates, dayTotal.carbohydrates)
                dayShare(mealSummary.protein, dayTotal.protein)
                dayShare(mealSummary.calories, dayTotal.calories)
            }
            .frame(width: reportTableMacroColumnWidth)
        }
    }

    private func dayShare(_ value: Double, _ dayTotal: Double) -> some View {
        Group {
            if dayTotal > 0 {
                Text((value / dayTotal).formatted(.percent.precision(.fractionLength(0)).locale(locale))) + Text(" ") + Text("nutrition.report.table.ofDay")
            } else {
                Text("—")
            }
        }
        .font(.caption2)
        .foregroundStyle(palette.muted)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    /// Product name and quantity in one cell, on the same row as its Б/Ж/У/ккал. Prefers `genericName`
    /// resolved to the report's own locale (a brand-stripped translation) over the raw logged name, so a
    /// day mixing products originally named in different languages reads consistently in one language;
    /// falls back to the raw name when no translation was saved. The product's type (e.g. "Coffee"/
    /// "Кофе"), when set, shows as a small leading badge, also resolved to the report locale.
    ///
    /// Quantity always prefers `baseAmount` (the consumed amount converted to the product's own g/ml) —
    /// falling back to the raw logged quantity (a piece size, serving label like "1 капсула", or free
    /// text for ad-hoc entries) only when no conversion was captured, so a report never mixes weight/
    /// volume with arbitrary serving-count labels.
    private func itemLabel(_ entry: FoodEntry) -> some View {
        let displayName = entry.productSnapshot.genericName?.resolved(for: locale) ?? entry.productSnapshot.name
        let quantityText: Text
        if let baseAmount = entry.productSnapshot.baseAmount {
            let formatted = baseAmount.amount.formatted(.number.precision(.fractionLength(0...1)))
            quantityText = baseAmount.unit == "ml" ? millilitersText(formatted) : gramsText(formatted)
        } else {
            let raw = "\(entry.quantity.amount.formatted(.number.precision(.fractionLength(0...1)))) \(entry.quantity.unitLabel)"
            quantityText = Text(raw)
        }
        return HStack(spacing: 6) {
            if let type = entry.productSnapshot.type?.resolved(for: locale) {
                Text(type.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(palette.muted)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(palette.muted.opacity(0.12), in: Capsule())
                    .lineLimit(1)
                    .layoutPriority(1)
            }
            (Text(displayName) + Text(" · ") + quantityText)
                .font(.callout)
                .foregroundStyle(palette.foreground)
                .lineLimit(1)
        }
    }

    /// Notable nutrients this specific item's label explicitly stated (salt, fiber, sugars, saturated
    /// fat, sodium) — `provenance == .stated` only, so an estimated/calculated value never gets
    /// presented as if it were printed on the package.
    @ViewBuilder
    private func extrasLine(_ entry: FoodEntry) -> some View {
        let extras = reportNotableExtraKeys().compactMap { candidate -> (LocalizedStringKey, NutrientValue)? in
            guard let nutrient = entry.productSnapshot.nutrients.first(where: { $0.key == candidate.key }),
                  nutrient.provenance == .stated, nutrient.value != nil else { return nil }
            return (candidate.label, nutrient)
        }
        if !extras.isEmpty {
            HStack(spacing: 18) {
                ForEach(Array(extras.enumerated()), id: \.offset) { _, item in
                    let (label, nutrient) = item
                    HStack(spacing: 5) {
                        Circle().fill(palette.accent).frame(width: 4, height: 4)
                        Text(label).font(.caption2).foregroundStyle(palette.muted)
                        Text((nutrient.value ?? 0).formatted(.number.precision(.fractionLength(0...2))) + " " + nutrient.unit)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(palette.foreground)
                    }
                }
            }
        }
    }
}

/// Cap on workouts shown on the fixed-height cover page — see the overflow comment where it's used.
private let maxWorkoutsShownInCover = 3

/// Full activity detail, text-first (no small inline icons paired with numbers — only the weekly
/// chart, which is data, not decoration). Used on the cover page's left half.
private struct ReportActivityBlock: View {
    let snapshot: WeeklyActivitySnapshot
    let stepGoal: Int
    let locale: Locale
    let palette: ActivityPalette

    private var percentage: Double {
        guard stepGoal > 0 else { return 0 }
        return Double(snapshot.selectedSteps) / Double(stepGoal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Text("nutrition.report.activity.title")
                .font(.title3.weight(.semibold))
                .foregroundStyle(palette.foreground)

            VStack(alignment: .leading, spacing: 28) {
                HStack(alignment: .top, spacing: 0) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(snapshot.selectedSteps.formatted(.number.locale(locale)))
                            .font(.system(size: 84, weight: .regular, design: .serif))
                            .monospacedDigit()
                            .foregroundStyle(palette.foreground)
                        Text("nutrition.report.activity.steps")
                            .font(.caption.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundStyle(palette.muted)
                    }
                    // The wide gap to the right of the steps figure used to sit empty — a logged
                    // workout is a much better use of that space than a small line further down the
                    // page. Pushed toward the column's right edge, separated from the steps figure by
                    // space alone (no rule) — the gap itself reads as grouping here.
                    if !snapshot.workouts.isEmpty {
                        Spacer(minLength: 64)
                        // Capped rather than unbounded: the cover page is a fixed 1600×1000 canvas, and
                        // a day with several short workouts could otherwise push this column taller than
                        // its reserved height, shoving the chart/distance row past the page edge where
                        // ImageRenderer just clips it. Three fits comfortably; anything past that is
                        // summarized as a plain "+N" rather than silently dropped.
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(snapshot.workouts.prefix(maxWorkoutsShownInCover)) { workout in
                                workoutCallout(workout)
                            }
                            if snapshot.workouts.count > maxWorkoutsShownInCover {
                                Text("+\(snapshot.workouts.count - maxWorkoutsShownInCover)")
                                    .font(.callout.weight(.medium))
                                    .monospacedDigit()
                                    .foregroundStyle(palette.muted)
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        (Text("nutrition.report.activity.goal.prefix") + Text(stepGoal.formatted(.number.locale(locale))) + Text("nutrition.report.activity.goal.suffix"))
                            .foregroundStyle(palette.muted)
                        Spacer()
                        Text(percentage.formatted(.percent.precision(.fractionLength(0)).locale(locale)))
                            .fontWeight(.semibold)
                            .foregroundStyle(palette.foreground)
                    }
                    .font(.callout)
                    .monospacedDigit()
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(palette.track)
                            Capsule().fill(palette.accent).frame(width: proxy.size.width * min(percentage, 1))
                        }
                    }
                    .frame(height: 8)
                }

                (Text("nutrition.report.activity.average.prefix") + Text(snapshot.averageSteps.formatted(.number.locale(locale))) + Text("nutrition.report.activity.average.suffix"))
                    .font(.callout)
                    .monospacedDigit()
                    .foregroundStyle(palette.muted)
            }
            .frame(minHeight: reportCoverAboveChartHeight, alignment: .top)

            ActivityWeekChart(snapshot: snapshot, style: .share)
                .frame(height: 220)

            if let meters = snapshot.selectedDistanceMeters {
                (Text("nutrition.report.activity.distance.prefix")
                    + Text(Measurement(value: meters, unit: UnitLength.meters).formatted(.measurement(width: .wide).locale(locale))))
                    .font(.callout)
                    .foregroundStyle(palette.muted)
            }
        }
    }

    /// Stands out through type and spacing alone — no card background, per docs/DESIGN.md's "avoid
    /// boxed panels... use typography weight/size, color, and spacing/indentation instead" rule for
    /// native Form screens. Icon on the left of each row (not stacked above it) so a day with several
    /// workouts reads as a clean list — one icon per row lined up in its own column — rather than
    /// repeating the same icon-then-name-then-line block over and over down the page.
    private func workoutCallout(_ workout: WorkoutSummary) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: workout.kind.symbolName)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(palette.accent)
                .frame(width: 24, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(workout.kind.localizedKey)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(palette.foreground)
                HStack(spacing: 8) {
                    Text(Duration.seconds(workout.duration).formatted(.units(width: .narrow, maximumUnitCount: 2).locale(locale)))
                    if let kcal = workout.totalEnergyBurnedKcal {
                        Text("·")
                        kcalText(kcal.formatted(.number.precision(.fractionLength(0))))
                    }
                }
                .font(.callout)
                .monospacedDigit()
                .foregroundStyle(palette.muted)
            }
        }
    }
}

/// Brief day totals (calories + Б/Ж/У only) — fiber and the fat/carb type breakdowns are report-only
/// content that only makes sense with an explicit caption and hedge, so they live solely on the detail
/// page (and only when the underlying data was actually stated, never fabricated as a summary figure).
private struct ReportNutritionSummaryBlock: View {
    let payload: NutritionReportPayload
    let locale: Locale
    let palette: ActivityPalette

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Text("nutrition.report.nutrition.title")
                .font(.title3.weight(.semibold))
                .foregroundStyle(palette.foreground)

            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(payload.summary.calories.formatted(.number.precision(.fractionLength(0))))
                        .font(.system(size: 84, weight: .regular, design: .serif))
                        .monospacedDigit()
                        .foregroundStyle(palette.foreground)
                    Text("summary.calories.unit")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(palette.muted)
                }

                if let calorieGoal = payload.goals.calories, calorieGoal > 0 {
                    calorieGoalRow(goal: calorieGoal)
                }

                HStack(spacing: 40) {
                    figure(payload.summary.protein, "nutrition.protein.short", goal: payload.goals.protein)
                    figure(payload.summary.fat, "nutrition.fat.short", goal: payload.goals.fat)
                    figure(payload.summary.carbohydrates, "nutrition.carbohydrates.short", goal: payload.goals.carbohydrates)
                }

                if let weekly = payload.weeklyNutrition {
                    (Text("nutrition.report.activity.average.prefix")
                        + Text(weekly.averageCalories.formatted(.number.precision(.fractionLength(0)).locale(locale)))
                        + Text("nutrition.report.nutrition.average.suffix"))
                        .font(.callout)
                        .monospacedDigit()
                        .foregroundStyle(palette.muted)
                }
            }
            .frame(minHeight: reportCoverAboveChartHeight, alignment: .top)

            if let weekly = payload.weeklyNutrition {
                ReportNutritionWeekChart(snapshot: weekly, goal: payload.goals.calories, palette: palette, locale: locale)
                    .frame(height: 220)
            }
        }
    }

    /// Mirrors the activity block's goal row exactly (label + percent on one line, a capsule bar
    /// below) — the earlier version put a small icon+delta signal directly under the hero number,
    /// which read as a different style than activity's plain text+bar; this is the same treatment.
    private func calorieGoalRow(goal: Double) -> some View {
        let percentage = goal > 0 ? payload.summary.calories / goal : 0
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                (Text("nutrition.report.activity.goal.prefix")
                    + Text(goal.formatted(.number.precision(.fractionLength(0)).locale(locale)))
                    + Text(" ") + Text("summary.calories.unit"))
                    .foregroundStyle(palette.muted)
                Spacer()
                Text(percentage.formatted(.percent.precision(.fractionLength(0)).locale(locale)))
                    .fontWeight(.semibold)
                    .foregroundStyle(palette.foreground)
            }
            .font(.callout)
            .monospacedDigit()
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(palette.track)
                    Capsule().fill(palette.accent).frame(width: proxy.size.width * min(max(percentage, 0), 1))
                }
            }
            .frame(height: 8)
        }
    }

    private func figure(_ value: Double, _ label: LocalizedStringKey, goal: Double?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            gramsText(value.formatted(.number.precision(.fractionLength(0))))
                .font(.system(size: 32, weight: .medium, design: .serif))
                .monospacedDigit()
                .foregroundStyle(palette.foreground)
            Text(label)
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(palette.muted)
            goalSignal(actual: value, goal: goal, palette: palette, locale: locale)
        }
    }
}

/// Weekly calories trend, deliberately built the same way as `ActivityWeekChart` (area + line + point
/// marks, hidden Y axis, narrow weekday labels) so the cover page's two halves read as one system. The
/// dashed rule is the calorie goal, not the week's own average — the average is already shown as text
/// above the chart, so the rule line is reserved for the one number that's a comparison target.
private struct ReportNutritionWeekChart: View {
    let snapshot: WeeklyNutritionSnapshot
    let goal: Double?
    let palette: ActivityPalette
    let locale: Locale

    var body: some View {
        Chart {
            ForEach(snapshot.days) { day in
                if let calories = day.summary?.calories {
                    AreaMark(
                        x: .value("nutrition.report.chart.day", day.date),
                        yStart: .value("nutrition.report.chart.zero", 0),
                        yEnd: .value("nutrition.report.chart.calories", calories)
                    )
                    .foregroundStyle(LinearGradient(
                        colors: [palette.accent.opacity(0.18), palette.accent.opacity(0.01)],
                        startPoint: .top, endPoint: .bottom
                    ))
                    .interpolationMethod(.catmullRom)
                    LineMark(
                        x: .value("nutrition.report.chart.day", day.date),
                        y: .value("nutrition.report.chart.calories", calories)
                    )
                    .foregroundStyle(palette.accent)
                    .lineStyle(StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)
                    if Calendar.current.isDate(day.date, inSameDayAs: snapshot.selectedDate) {
                        PointMark(x: .value("nutrition.report.chart.day", day.date), y: .value("nutrition.report.chart.calories", calories))
                            .foregroundStyle(palette.foreground)
                            .symbolSize(230)
                        PointMark(x: .value("nutrition.report.chart.day", day.date), y: .value("nutrition.report.chart.calories", calories))
                            .foregroundStyle(palette.background)
                            .symbolSize(95)
                    } else {
                        PointMark(x: .value("nutrition.report.chart.day", day.date), y: .value("nutrition.report.chart.calories", calories))
                            .foregroundStyle(palette.foreground.opacity(0.48))
                            .symbolSize(95)
                    }
                }
            }
            if let goal, goal > 0 {
                RuleMark(y: .value("nutrition.report.chart.goal", goal))
                    .foregroundStyle(palette.foreground.opacity(0.3))
                    .lineStyle(StrokeStyle(lineWidth: 3, dash: [6, 7]))
            }
        }
        .chartXScale(domain: chartDomain)
        .chartXAxis {
            AxisMarks(values: snapshot.days.map(\.date)) { value in
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(date.formatted(.dateTime.weekday(.narrow).locale(locale)))
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(palette.muted)
                    }
                }
            }
        }
        .chartYAxis(.hidden)
    }

    private var chartDomain: ClosedRange<Date> {
        let first = snapshot.days.first?.date ?? snapshot.selectedDate
        let last = snapshot.days.last?.date ?? snapshot.selectedDate
        return first.addingTimeInterval(-43_200)...last.addingTimeInterval(43_200)
    }
}

/// A separate, distinct composition for the Telegram/social link-preview image — legible at thumbnail
/// size, not a downscaled crop of the report pages. Mirrors the cover page's activity-then-nutrition
/// order and text-first activity treatment for visual consistency across all three artifacts.
struct NutritionReportOGCard: View {
    let payload: NutritionReportPayload

    @Environment(\.locale) private var locale
    private let palette = ActivityPalette(colorScheme: .light)

    var body: some View {
        ZStack(alignment: .topLeading) {
            palette.background
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    brandMark(size: 76)
                    Spacer()
                    Text(payload.date.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(locale)))
                        .font(.system(size: 30, weight: .regular, design: .serif))
                        .foregroundStyle(palette.muted)
                }
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            }
            .padding(64)
        }
        .frame(width: 1200, height: 630)
        .environment(\.colorScheme, .light)
    }

    /// Three columns (steps · calories · macros) laid out within a *fixed* width matching the card's
    /// available content area (1200pt canvas minus the 64pt outer padding on each side) — never
    /// `fixedSize()`, so the two hero numbers (`lineLimit(1)` + `minimumScaleFactor`) shrink instead of
    /// overflowing the card when steps/calories run to more digits than usual. An unconstrained
    /// intrinsic-width HStack was tried first and discarded: at 108pt the steps + calories figures
    /// alone could exceed 1200pt, which silently overflowed the fixed canvas — pushing the block off
    ///-center and clipping the macro labels at the right edge instead of wrapping or shrinking.
    private var content: some View {
        HStack(alignment: .center, spacing: 0) {
            if let activity = payload.activity {
                VStack(alignment: .leading, spacing: 14) {
                    Image(systemName: "shoeprints.fill")
                        .font(.system(size: 32, weight: .light))
                        .foregroundStyle(palette.accent)
                    Text(activity.selectedSteps.formatted(.number.locale(locale)))
                        .font(.system(size: 84, weight: .regular, design: .serif))
                        .monospacedDigit()
                        .foregroundStyle(palette.foreground)
                        .lineLimit(1)
                        .minimumScaleFactor(0.4)
                }
                Spacer(minLength: 32)
                Rectangle().fill(palette.track).frame(width: 2, height: 190)
                Spacer(minLength: 32)
            }
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: "fork.knife")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(palette.accent)
                kcalText(payload.summary.calories.formatted(.number.precision(.fractionLength(0))))
                    .font(.system(size: 84, weight: .regular, design: .serif))
                    .monospacedDigit()
                    .foregroundStyle(palette.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
            }
            Spacer(minLength: 32)
            Rectangle().fill(palette.track).frame(width: 2, height: 190)
            Spacer(minLength: 32)
            VStack(alignment: .leading, spacing: 32) {
                ogFigure(payload.summary.protein, "nutrition.protein.short")
                ogFigure(payload.summary.fat, "nutrition.fat.short")
                ogFigure(payload.summary.carbohydrates, "nutrition.carbohydrates.short")
            }
        }
    }

    private func ogFigure(_ value: Double, _ label: LocalizedStringKey) -> some View {
        HStack(spacing: 14) {
            gramsText(value.formatted(.number.precision(.fractionLength(0))))
                .font(.system(size: 40, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(palette.foreground)
                .frame(width: 130, alignment: .leading)
            Text(label)
                .font(.title3.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(palette.muted)
        }
    }
}

struct NutritionReportSharePayload: Identifiable {
    let id = UUID()
    let text: String
    let url: URL
}

struct NutritionReportShareSheet: UIViewControllerRepresentable {
    let text: String
    let url: URL

    /// A single combined string rather than separate `text`/`url` items: passed separately, Telegram's
    /// share extension has been observed to drop the text item and post only the link.
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: ["\(text)\n\(url.absoluteString)"], applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview("Cover page") {
    NutritionReportCoverPage(payload: .preview())
        .environment(\.locale, Locale(identifier: "ru_RU"))
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 512, height: 320, alignment: .topLeading)
}

#Preview("Detail page") {
    NutritionReportDetailPage(payload: .preview())
        .environment(\.locale, Locale(identifier: "ru_RU"))
        .scaleEffect(0.35, anchor: .topLeading)
        .frame(width: 378, alignment: .topLeading)
}

#Preview("Cover page, no activity") {
    NutritionReportCoverPage(payload: .preview(activity: nil))
        .environment(\.locale, Locale(identifier: "ru_RU"))
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 512, height: 320, alignment: .topLeading)
}

#Preview("Report share preview") {
    NutritionReportOGCard(payload: .preview())
        .environment(\.locale, Locale(identifier: "ru_RU"))
        .scaleEffect(0.32, anchor: .topLeading)
        .frame(width: 384, height: 202, alignment: .topLeading)
}

private extension NutritionReportPayload {
    static func preview(activity: WeeklyActivitySnapshot? = .preview()) -> NutritionReportPayload {
        NutritionReportPayload(
            date: .now,
            entries: PreviewNutrition.entries + PreviewNutrition.entries.map { entry in
                FoodEntry(
                    id: entry.id + "-lunch", type: entry.type, occurredAt: entry.occurredAt,
                    timezone: entry.timezone, note: entry.note, productId: entry.productId,
                    mealType: .lunch, quantity: entry.quantity, productSnapshot: entry.productSnapshot
                )
            },
            activity: activity,
            stepGoal: 12_000
        )
    }
}
