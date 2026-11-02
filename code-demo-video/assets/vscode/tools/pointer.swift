// pointer: save macOS's own arrow pointer (NSCursor.arrow) at 2x as PNG, and print its hot spot
import AppKit
let app = NSApplication.shared
let c = NSCursor.arrow
let img = c.image
var best: NSBitmapImageRep? = nil
for r in img.representations { if let b = r as? NSBitmapImageRep, b.pixelsWide >= (best?.pixelsWide ?? 0) { best = b } }
let size = img.size
print("raw size", size, "reps", img.representations.map { "\($0.pixelsWide)x\($0.pixelsHigh)" })
let W = Int(ceil(size.width * 2)), Hh = Int(ceil(size.height * 2))
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: max(W, 1), pixelsHigh: max(Hh, 1), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = size
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
img.draw(in: NSRect(origin: .zero, size: size))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("size pt", size, "hotspot", c.hotSpot)
