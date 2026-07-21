import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 4 else {
    fputs("usage: normalize-progress-photo.swift input full.jpg thumbnail.jpg\n", stderr)
    exit(2)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let fullOutput = URL(fileURLWithPath: CommandLine.arguments[2])
let thumbnailOutput = URL(fileURLWithPath: CommandLine.arguments[3])

guard let source = CGImageSourceCreateWithURL(input as CFURL, nil) else {
    fputs("could not read image\n", stderr)
    exit(3)
}

func render(maxPixelSize: Int, to output: URL) throws -> (Int, Int) {
    let options: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
        throw NSError(domain: "FormPhoto", code: 1)
    }
    guard let destination = CGImageDestinationCreateWithURL(
        output as CFURL,
        UTType.jpeg.identifier as CFString,
        1,
        nil
    ) else {
        throw NSError(domain: "FormPhoto", code: 2)
    }
    CGImageDestinationAddImage(
        destination,
        image,
        [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary
    )
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "FormPhoto", code: 3)
    }
    return (image.width, image.height)
}

do {
    let full = try render(maxPixelSize: 3000, to: fullOutput)
    _ = try render(maxPixelSize: 720, to: thumbnailOutput)
    print("{\"width\":\(full.0),\"height\":\(full.1)}")
} catch {
    fputs("could not normalize image\n", stderr)
    exit(4)
}
