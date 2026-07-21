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

        let hero = app.descendants(matching: .any)["today.hero"]
        XCTAssertTrue(hero.waitForExistence(timeout: 5))
        let details = app.staticTexts["today.details"]
        XCTAssertFalse(details.isHittable, "Details must stay below the initial viewport")
        XCTAssertTrue(app.tabBars.buttons["Today"].exists)
        XCTAssertTrue(app.tabBars.buttons["Nutrition"].exists)
        XCTAssertTrue(app.tabBars.buttons["History"].exists)

        app.scrollViews.firstMatch.swipeUp()
        XCTAssertTrue(details.waitForExistence(timeout: 3))
        XCTAssertTrue(details.isHittable)
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
    }
}
