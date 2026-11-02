// Render macOS's own standard window buttons (close/minimize/zoom) offscreen at 2x, dark appearance.
// No screen-recording permission needed: we draw our own window's views into a bitmap.
import AppKit
class ActiveApp: NSApplication { override var isActive: Bool { true } }
let app = ActiveApp.shared
app.setActivationPolicy(.accessory)
app.appearance = NSAppearance(named: .darkAqua)
let style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
class ActiveWindow: NSWindow { override var isKeyWindow: Bool { true }; override var isMainWindow: Bool { true }; override var canBecomeKey: Bool { true } }
let win = ActiveWindow(contentRect: NSRect(x: -4000, y: -4000, width: 300, height: 120), styleMask: style, backing: .buffered, defer: false)
win.titlebarAppearsTransparent = true
win.titleVisibility = .hidden
win.appearance = NSAppearance(named: .darkAqua)
win.backgroundColor = NSColor(srgbRed: 0x18/255.0, green: 0x18/255.0, blue: 0x18/255.0, alpha: 1)
win.isDocumentEdited = CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "edited"
win.orderFrontRegardless()
win.makeKey()
app.activate(ignoringOtherApps: true)
RunLoop.current.run(until: Date().addingTimeInterval(0.6))
var info: [String] = []
for (name, kind) in [("close", NSWindow.ButtonType.closeButton), ("min", .miniaturizeButton), ("zoom", .zoomButton)] {
  guard let b = win.standardWindowButton(kind) else { continue }
  let f = b.convert(b.bounds, to: nil)
  info.append("\(name) frame(in window, bottom-left origin)=\(f) winH=\(win.frame.height) isKey=\(win.isKeyWindow)")
}
// render the whole titlebar container (all three buttons, real spacing) at 2x
if let tb = win.standardWindowButton(.closeButton)?.superview {
  for v in tb.subviews { v.needsDisplay = true; v.layer?.setNeedsDisplay() }
  NotificationCenter.default.post(name: NSWindow.didBecomeKeyNotification, object: win)
  NotificationCenter.default.post(name: NSWindow.didBecomeMainNotification, object: win)
  RunLoop.current.run(until: Date().addingTimeInterval(0.3))
  let r = tb.bounds
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(r.width * 2), pixelsHigh: Int(r.height * 2), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  rep.size = r.size
  tb.cacheDisplay(in: r, to: rep)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "tlights-2x.png"))
  info.append("titlebar view bounds=\(r)")
}
print(info.joined(separator: "\n"))
