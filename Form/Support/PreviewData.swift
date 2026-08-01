import Foundation

enum PreviewData {
    static let photoBase = EventBase(
        id: "photo-event",
        occurredAt: Date(timeIntervalSince1970: 1_752_710_400),
        timezone: "Europe/Prague",
        note: nil
    )
    static let measurementBase = EventBase(
        id: "measurement-event",
        occurredAt: Date(timeIntervalSince1970: 1_752_710_400),
        timezone: "Europe/Prague",
        note: nil
    )
    static let previousMeasurementBase = EventBase(
        id: "measurement-event-previous",
        occurredAt: Date(timeIntervalSince1970: 1_752_105_600),
        timezone: "Europe/Prague",
        note: nil
    )
    static let events: [TimelineEvent] = [
        .progressPhoto(photoBase, []),
        .measurements(measurementBase, BodyMeasurements(
            weightKg: 83.65, waistCm: 80, abdomenCm: 86, chestCm: 109, neckCm: nil,
            hipsCm: 102, forearmCm: 31, leftBicepCm: 38, rightBicepCm: 38,
            leftBicepFlexedCm: 42, rightBicepFlexedCm: 42, leftThighCm: 63,
            rightThighCm: 63, leftCalfCm: 40, rightCalfCm: 40
        )),
        .measurements(previousMeasurementBase, BodyMeasurements(
            weightKg: 84.4, waistCm: 80, abdomenCm: 86, chestCm: 109, neckCm: nil,
            hipsCm: 102, forearmCm: 31, leftBicepCm: 38, rightBicepCm: 38,
            leftBicepFlexedCm: 42, rightBicepFlexedCm: 42, leftThighCm: 63,
            rightThighCm: 63, leftCalfCm: 40, rightCalfCm: 40
        ))
    ]

    static let galleryEvents: [TimelineEvent] = [
        .progressPhoto(photoBase, [
            ProgressPhoto(id: "preview-photo-1", assetId: nil, url: nil, thumbnailUrl: nil, width: 1200, height: 1600, alt: "Front"),
            ProgressPhoto(id: "preview-photo-2", assetId: nil, url: nil, thumbnailUrl: nil, width: 1200, height: 1600, alt: "Side")
        ])
    ] + Array(events.dropFirst())
}
