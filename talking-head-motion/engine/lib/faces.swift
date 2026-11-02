// Face boxes for a folder of frames, with macOS Vision (no extra installs). Called by engine/faces.mjs.
//   swift engine/lib/faces.swift <dir of .jpg>
// Prints one line per frame: "<file> <cx> <cy> <w> <h>" (0–1, origin top-left) for the largest face, or "<file> -".
import Foundation
import Vision

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".jpg") }.sorted()
for f in files {
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(url: dir.appendingPathComponent(f), options: [:]).perform([req])
    let faces = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
    if let b = faces.first?.boundingBox {
        print(String(format: "%@ %.4f %.4f %.4f %.4f", f, b.midX, 1 - b.midY, b.width, b.height))
    } else {
        print("\(f) -")
    }
}
