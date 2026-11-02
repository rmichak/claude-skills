// activate <pid>: bring that app (by process id) to the front, so its window really has focus
import AppKit
let pid = pid_t(CommandLine.arguments[1])!
guard let app = NSRunningApplication(processIdentifier: pid) else { print("no app for pid"); exit(1) }
let ok = app.activate(options: [.activateAllWindows])
RunLoop.current.run(until: Date().addingTimeInterval(0.8))
print("activate:", ok, "active now:", app.isActive)
