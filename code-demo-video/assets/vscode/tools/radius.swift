import AppKit
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
for style: NSWindow.StyleMask in [[.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], [.titled, .closable, .miniaturizable, .resizable]] {
  let win = NSWindow(contentRect: NSRect(x: -4000, y: -4000, width: 300, height: 200), styleMask: style, backing: .buffered, defer: false)
  win.titlebarAppearsTransparent = true
  for name in ["_cornerRadius", "_topCornerRadius", "_bottomCornerRadius"] {
    let sel = NSSelectorFromString(name)
    if win.responds(to: sel) {
      typealias F = @convention(c) (AnyObject, Selector) -> CGFloat
      let f = unsafeBitCast(win.method(for: sel), to: F.self)
      print(style.rawValue, name, f(win, sel))
    } else { print(style.rawValue, name, "n/a") }
  }
  if let frame = win.contentView?.superview, frame.responds(to: NSSelectorFromString("_cornerRadius")) {
    typealias F = @convention(c) (AnyObject, Selector) -> CGFloat
    let sel = NSSelectorFromString("_cornerRadius")
    print("themeFrame _cornerRadius", unsafeBitCast(frame.method(for: sel), to: F.self)(frame, sel))
  }
}
