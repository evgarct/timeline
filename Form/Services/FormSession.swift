import Foundation

final class FormSession: @unchecked Sendable {
    let urlSession: URLSession

    init(configuration: URLSessionConfiguration = .default) {
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.timeoutIntervalForRequest = 30
        configuration.requestCachePolicy = .reloadRevalidatingCacheData
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        if
            let rawCookie = environment["FORM_UI_TEST_COOKIE"],
            let host = environment["FORM_UI_TEST_COOKIE_HOST"]
        {
            for pair in rawCookie.components(separatedBy: "; ") {
                let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                let properties: [HTTPCookiePropertyKey: Any] = [
                    .name: parts[0], .value: parts[1], .domain: host,
                    .path: "/", .secure: true
                ]
                if let cookie = HTTPCookie(properties: properties) {
                    configuration.httpCookieStorage?.setCookie(cookie)
                }
            }
        }
        #endif
        urlSession = URLSession(configuration: configuration)
    }
}
