import Foundation

final class FormSession: @unchecked Sendable {
    let urlSession: URLSession

    init(configuration: URLSessionConfiguration = .default) {
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.timeoutIntervalForRequest = 30
        configuration.requestCachePolicy = .reloadRevalidatingCacheData
        urlSession = URLSession(configuration: configuration)
    }
}
