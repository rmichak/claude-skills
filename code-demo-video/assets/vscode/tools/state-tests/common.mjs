// The test program: capture the reference states (assets/vscode/reference/README.md) with exactly this file open,
// in a folder named pixel-demo.
export const PORT_CHECK = {
  1: "# port_check.py - classify a network port",
  2: "# Sample course - VS Code pixel test",
  5: "def classify_port(port):",
  6: "    if 0 <= port <= 1023:",
  7: '        return "well-known"',
  8: "    elif port <= 49151:",
  9: '        return "registered"',
  10: '    return "dynamic"',
  13: 'print(f"Port 443 is {classify_port(443)}")',
};
for (const n of [3, 4, 11, 12]) PORT_CHECK[n] = "";
// the long program for the smaller-font, wider-window states (editorFontSize 12, terminalFontSize 12, windowWidth 920):
// byte-for-byte the file to have open for reference/real-editor-12-w920.png and real-terminal-12-w920.png (folder: projects)
export const BMI = {
  1: "# bmi.py - body mass index calculator",
  2: "# Sample project: a bigger program",
  4: "def bmi(weight_kg, height_m):",
  5: "    return weight_kg / height_m ** 2",
  7: "def category(value):",
  8: "    if value < 18.5:",
  9: '        return "underweight"',
  10: "    elif value < 25:",
  11: '        return "healthy"',
  12: "    elif value < 30:",
  13: '        return "overweight"',
  14: '    return "obese"',
  16: 'people = [("Ana", 58, 1.65), ("Ben", 92, 1.80)]',
  17: "for name, kg, m in people:",
  18: "    score = bmi(kg, m)",
  19: '    print(f"{name}: BMI {score:.1f} ({category(score)})")',
};
for (const n of [3, 6, 15, 20]) BMI[n] = "";
export const SIZE12 = { editorFontSize: 12, terminalFontSize: 12, windowWidth: 920, statusRight: "Python 3.15.0" };
export const BASE = {
  mode: "walkthrough", branding: "neutral", course: "PIXEL TEST", editorLabel: "STATE TEST",
  statusRight: "Python 3.14.4 (homebrew)",
  title: { hero: "State", accent: "test", sub: "", chip: "TEST", ghost: false },
};
