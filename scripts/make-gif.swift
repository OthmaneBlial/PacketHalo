import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift scripts/make-gif.swift INPUT_DIRECTORY OUTPUT.gif\n", stderr)
    exit(1)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let files = try FileManager.default.contentsOfDirectory(at: input, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !files.isEmpty else { throw NSError(domain: "PacketHaloDemo", code: 1, userInfo: [NSLocalizedDescriptionKey: "No PNG frames found"]) }
guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, files.count, nil) else {
    throw NSError(domain: "PacketHaloDemo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot create GIF destination"])
}
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
let frameProperties = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 0.15]] as CFDictionary
for file in files {
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { continue }
    CGImageDestinationAddImage(destination, image, frameProperties)
}
guard CGImageDestinationFinalize(destination) else {
    throw NSError(domain: "PacketHaloDemo", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot finalize GIF"])
}
