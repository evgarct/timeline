import XCTest

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
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["today.hero"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Today"].exists)
        XCTAssertTrue(app.tabBars.buttons["Nutrition"].exists)
        XCTAssertTrue(app.tabBars.buttons["History"].exists)
    }
}
