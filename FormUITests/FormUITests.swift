import XCTest

@MainActor
final class FormUITests: XCTestCase {
    func testSignedOutLaunchShowsEmailEntry() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.textFields["auth.email"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["auth.submit"].exists)
    }

    func testTodayLaunchShowsHeroAndTabs() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        let hero = app.descendants(matching: .any)["today.hero"]
        XCTAssertTrue(hero.waitForExistence(timeout: 5))
        let details = app.staticTexts["today.details"]
        XCTAssertFalse(details.isHittable, "Details must stay below the initial viewport")
        XCTAssertTrue(app.tabBars.buttons["Today"].exists)
        XCTAssertTrue(app.tabBars.buttons["Nutrition"].exists)
        XCTAssertTrue(app.tabBars.buttons["Timeline"].exists)

        let activity = app.buttons["Refresh steps"]
        XCTAssertTrue(activity.exists)
        expectation(
            for: NSPredicate(format: "value CONTAINS %@", "9,420"),
            evaluatedWith: activity
        )
        waitForExpectations(timeout: 3)
        attach(XCUIScreen.main.screenshot(), name: "00 Today hero and summary")

        activity.press(forDuration: 0.8)
        let detailAction = app.buttons["activity.menu.detail"]
        XCTAssertTrue(detailAction.waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["activity.menu.goal"].exists)
        XCTAssertTrue(app.buttons["activity.menu.share"].exists)
        detailAction.tap()
        XCTAssertTrue(app.buttons["activity.detail.close"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.descendants(matching: .any)["activity.weekAverage"].exists)
        XCTAssertTrue(app.otherElements["activity.weekChart"].exists)
        XCTAssertTrue(app.buttons["activity.detail.share"].exists)
        let nextDay = app.buttons["activity.date.next"]
        XCTAssertFalse(nextDay.isEnabled)

        app.buttons["activity.date.previous"].tap()
        let selectedValue = app.descendants(matching: .any)["activity.selectedValue"]
        expectation(
            for: NSPredicate(format: "value CONTAINS %@", "6,870"),
            evaluatedWith: selectedValue
        )
        waitForExpectations(timeout: 3)
        XCTAssertTrue(nextDay.isEnabled)

        nextDay.tap()
        expectation(
            for: NSPredicate(format: "value CONTAINS %@", "9,420"),
            evaluatedWith: selectedValue
        )
        waitForExpectations(timeout: 3)
        XCTAssertFalse(nextDay.isEnabled)

        app.buttons["activity.date.select"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["activity.date.calendar"].waitForExistence(timeout: 3))
        app.buttons["Done"].tap()

        let activityAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        activityAttachment.name = "Form quiet activity date navigation"
        activityAttachment.lifetime = .keepAlways
        add(activityAttachment)
        app.buttons["activity.detail.close"].tap()

        activity.press(forDuration: 0.8)
        app.buttons["activity.menu.goal"].tap()
        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 3))
        XCTAssertTrue(app.textFields.firstMatch.exists)
        app.alerts.buttons["Cancel"].tap()

        app.scrollViews.firstMatch.swipeUp()
        XCTAssertTrue(details.waitForExistence(timeout: 3))
        XCTAssertTrue(details.isHittable)
    }

    func testActivityShareSheet() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        let activity = app.buttons["Refresh steps"]
        XCTAssertTrue(activity.waitForExistence(timeout: 5))
        activity.press(forDuration: 0.8)
        let shareAction = app.buttons["activity.menu.share"]
        XCTAssertTrue(shareAction.waitForExistence(timeout: 3))
        shareAction.tap()

        let shareSheet = app.otherElements["ActivityListView"]
        XCTAssertTrue(shareSheet.waitForExistence(timeout: 3))
        XCTAssertTrue(app.cells["Copy"].exists)
        app.buttons["header.closeButton"].tap()
        expectation(
            for: NSPredicate(format: "hittable == true"),
            evaluatedWith: activity
        )
        waitForExpectations(timeout: 3)
    }

    func testNutritionJournalSupportsDayNavigationAndFullNutrients() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        app.tabBars.buttons["Nutrition"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Breakfast"].exists)
        XCTAssertTrue(app.staticTexts["Banana"].exists)
        XCTAssertTrue(app.buttons["Next day"].isEnabled)

        app.buttons["nutrition.menu"].tap()
        app.buttons["All nutrients"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.nutrients.screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.nutrient.sugars"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.nutrient.fiber"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.nutrient.potassium"].exists)
    }

    func testNutritionGoalsSaveDoesNotCrash() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        app.tabBars.buttons["Nutrition"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.screen"].waitForExistence(timeout: 5))

        app.buttons["nutrition.menu"].tap()
        app.buttons["Macro goals"].tap()
        let editor = app.descendants(matching: .any)["nutrition.goals.screen"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))

        let fields = ["nutrition.goals.field.calories", "nutrition.goals.field.protein",
                      "nutrition.goals.field.fat", "nutrition.goals.field.carbs"]
        let values = ["2200", "150", "70", "220"]
        for (identifier, value) in zip(fields, values) {
            let field = app.textFields[identifier]
            XCTAssertTrue(field.waitForExistence(timeout: 3))
            field.tap()
            field.typeText(value)
        }

        app.buttons["nutrition.goals.save"].tap()
        // The crash under test is a stack overflow inside NutritionGoals' RawRepresentable/Codable
        // conformance on save, so surviving past the tap and finding the screen still alive is the point.
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.screen"].waitForExistence(timeout: 5))

        // Reopen to confirm the values actually persisted (round-tripped through AppStorage) rather
        // than silently resetting to blank, which was the original (non-crashing) grouping-separator bug.
        app.buttons["nutrition.menu"].tap()
        app.buttons["Macro goals"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["nutrition.goals.field.calories"].value as? String, "2200")
        XCTAssertEqual(app.textFields["nutrition.goals.field.protein"].value as? String, "150")
    }

    func testTimelineShowsGroupedBodyRecords() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        app.tabBars.buttons["Timeline"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["timeline.screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["timeline.photo.session"].exists)
        attach(XCUIScreen.main.screenshot(), name: "04 Timeline")

        app.scrollViews.firstMatch.swipeUp()
        attach(XCUIScreen.main.screenshot(), name: "05 Timeline measurement deltas")
        app.scrollViews.firstMatch.swipeDown()

        app.buttons["timeline.add.measurements"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["measurement.editor"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.textFields["measurement.field.0"].exists)
        XCTAssertTrue(app.textFields["measurement.field.9"].exists)
        attach(XCUIScreen.main.screenshot(), name: "06 Measurement editor")
    }

    func testNutritionVisualQAScreenshots() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-today")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        app.tabBars.buttons["Nutrition"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["nutrition.screen"].waitForExistence(timeout: 5))
        attach(XCUIScreen.main.screenshot(), name: "01 Nutrition journal")

        let addButton = app.buttons["nutrition.add.breakfast"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 5))
        addButton.tap()
        let searchRow = app.staticTexts["Protein Milk"]
        XCTAssertTrue(searchRow.waitForExistence(timeout: 5))
        attach(XCUIScreen.main.screenshot(), name: "02 Product search")

        searchRow.tap()
        XCTAssertTrue(app.staticTexts["Protein Milk"].waitForExistence(timeout: 5))
        attach(XCUIScreen.main.screenshot(), name: "03 Quantity editor - serving chips")
    }

    private func attach(_ screenshot: XCUIScreenshot, name: String) {
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testLiveTodayLayoutWhenSessionIsProvided() throws {
        let environment = ProcessInfo.processInfo.environment
        let cookie = environment["FORM_UI_TEST_COOKIE"] ?? (try? String(
            contentsOfFile: "/tmp/form-ui-test-cookie.txt",
            encoding: .utf8
        ).trimmingCharacters(in: .whitespacesAndNewlines))
        let cookieHost = environment["FORM_UI_TEST_COOKIE_HOST"] ?? (try? String(
            contentsOfFile: "/tmp/form-ui-test-cookie-host.txt",
            encoding: .utf8
        ).trimmingCharacters(in: .whitespacesAndNewlines))
        guard let cookie, !cookie.isEmpty, let cookieHost, !cookieHost.isEmpty else {
            throw XCTSkip("Live cookie is provided only by the private visual QA run")
        }
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing-no-healthkit")
        app.launchEnvironment["FORM_UI_TEST_COOKIE"] = cookie
        app.launchEnvironment["FORM_UI_TEST_COOKIE_HOST"] = cookieHost
        app.launch()

        let hero = app.descendants(matching: .any)["today.hero"]
        XCTAssertTrue(hero.waitForExistence(timeout: 12))
        XCTAssertFalse(app.staticTexts["today.details"].isHittable)
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Form Today iPhone 15 Pro"
        attachment.lifetime = .keepAlways
        add(attachment)

        app.scrollViews.firstMatch.swipeUp()
        XCTAssertTrue(app.staticTexts["today.details"].waitForExistence(timeout: 3))
        let scrolledAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        scrolledAttachment.name = "Form Today fixed photo after scroll"
        scrolledAttachment.lifetime = .keepAlways
        add(scrolledAttachment)
    }
}
