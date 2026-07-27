import Foundation

/// Locally persists which photo the user pinned as the cover for a given progress-photo event, so
/// Today keeps showing the chosen photo across relaunches instead of always defaulting to the first
/// one in the array. This is a client-only preference — the API has no cover-photo field yet.
final class CoverPhotoPreferences: @unchecked Sendable {
    static let shared = CoverPhotoPreferences()

    private let defaults: UserDefaults
    private let key = "today.coverPhotoByEvent"
    private let lock = NSLock()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func coverPhotoId(forEvent eventId: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        return storage[eventId]
    }

    func setCoverPhotoId(_ photoId: String, forEvent eventId: String) {
        lock.lock()
        var current = storage
        current[eventId] = photoId
        storage = current
        lock.unlock()
    }

    private var storage: [String: String] {
        get { (defaults.dictionary(forKey: key) as? [String: String]) ?? [:] }
        set { defaults.set(newValue, forKey: key) }
    }
}
