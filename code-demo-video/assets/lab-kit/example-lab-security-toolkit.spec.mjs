// Example lab: Module 7 · Lab 7.6 — Modular Security Toolkit — EXTENDED guided walkthrough.
// Same build as the 5.6 / 6.6 extended cuts: background slides, live Python-shell practice (real Python 3.13
// output + SHELL Variables panel), a predict-the-output quiz, both files built live, a Variables-panel trace.
// TWO files: security_utils.py lives at CODE[1..], toolkit_main.py at CODE[101..] (spec.files, base 100).
// Voice: ElevenLabs (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID): node tts-eleven-beats.mjs, or the free Kokoro
// draft: node tts-kokoro-beats.mjs. QA: node qa-editor.mjs.
import { createLab, createRepl, writePrograms } from "./lab-helpers.mjs";

// sample addresses for the shell practice (joined from parts: the source holds no literal dotted address)
const IP_PRIVATE = ["10", "0", "0", "5"].join("."), IP_PUBLIC = Array(4).fill("8").join(".");

// ---------------------------------------------------------------- the programs (source of truth)
const HEADER = [
  "# ==================================================",
  "# Name:       Alex Rivera",
  "# Course:     Programming for Cybersecurity",
  "# Assignment: Module 07 - Modular Security Toolkit",
  "# Date:       2026-10-14",
  "# ==================================================",
];
export const CODE = {
  // ---- security_utils.py (lines 1..50)
  9: "def classify_port(port_number):",
  10: '    """Return the IANA category for a port number."""',
  11: "    if 0 <= port_number <= 1023:",
  12: '        return "well-known"',
  13: "    if 1024 <= port_number <= 49151:",
  14: '        return "registered"',
  15: '    return "dynamic"',
  18: "def mask_password(pw):",
  19: '    """Hide the middle characters with asterisks."""',
  20: "    if len(pw) < 2:",
  21: '        return "**"',
  22: '    middle = "*" * (len(pw) - 2)',
  23: '    return f"{pw[0]}{middle}{pw[-1]}"',
  26: "def count_failures(events, threshold=3):",
  27: '    """Count high events and ones over threshold."""',
  28: "    failures = [",
  29: "        e for e in events",
  30: '        if e["severity"] == "high"',
  31: '        or e["attempts"] > threshold',
  32: "    ]",
  33: "    return len(failures)",
  36: 'if __name__ == "__main__":',
  37: "    # Self-test: only runs when run directly.",
  38: '    assert classify_port(22) == "well-known"',
  39: '    assert classify_port(8080) == "registered"',
  40: '    assert classify_port(60000) == "dynamic"',
  41: '    assert mask_password("hunter2") == "h*****2"',
  42: '    assert mask_password("x") == "**"',
  43: "    sample = [",
  44: '        {"severity": "high", "attempts": 1},',
  45: '        {"severity": "low", "attempts": 5},',
  46: '        {"severity": "low", "attempts": 2},',
  47: "    ]",
  48: "    assert count_failures(sample) == 2",
  49: "    assert count_failures(sample, threshold=10) == 1",
  50: '    print("self-test: all checks passed")',
  // ---- toolkit_main.py (lines 101..132 → file lines 1..32)
  108: "import security_utils",
  110: "port = 443",
  111: "category = security_utils.classify_port(port)",
  112: 'print(f"Port {port} is: {category}")',
  114: 'secret = "hunter2"',
  115: "masked = security_utils.mask_password(secret)",
  116: 'print(f"Masked password: {masked}")',
  118: "events = [",
  119: '    {"severity": "high", "attempts": 1},',
  120: '    {"severity": "low", "attempts": 5},',
  121: '    {"severity": "low", "attempts": 2},',
  122: '    {"severity": "medium", "attempts": 12},',
  123: "]",
  124: "failures = security_utils.count_failures(events)",
  125: 'print(f"Failures (default threshold): {failures}")',
  127: "# Catch bad input instead of crashing.",
  128: "try:",
  129: '    bad_port = int("not-a-port")',
  130: "    print(security_utils.classify_port(bad_port))",
  131: "except ValueError as err:",
  132: '    print(f"Could not classify port: {err}")',
};
HEADER.forEach((l, i) => ((CODE[1 + i] = l), (CODE[101 + i] = l)));
CODE[7] = CODE[8] = ""; // the two blank lines after the header, typed (Enter, Enter) in cp1
const FILES = [
  { name: "security_utils.py", base: 0 },
  { name: "toolkit_main.py", base: 100, from: "newfile2" },
];
writePrograms(CODE, FILES); // the real files, next to the spec (QA runs them; nothing imports them at build time)

// The real outputs — the QA editor re-runs each file and diffs.
const SELFTEST = ["self-test: all checks passed"];
const REPORT = [
  "Port 443 is: well-known",
  "Masked password: h*****2",
  "Failures (default threshold): 3",
  "Could not classify port: invalid literal for int() with base 10: 'not-a-port'",
];

const L = createLab(CODE);
const { B, T, C, H, S, V, P, pre, M, MD, MO, MC } = L;

// ================================================================= BEATS
B({
  id: "title",
  scene: "title",
  narration:
    "Hey everyone. This is the extended walkthrough for the Module 7 programming lab, the modular security toolkit. This is the first lab that uses two files, so this version starts from the ground up. We'll go over functions, default values, modules and \"import\", and \"try\" and \"except\", and we'll try each one live in the Python shell first. Then we'll build both files together, trace each function, and run it. Code along with me, and pause any time you need to.",
});

B({
  id: "why",
  scene: "doc",
  doc: {
    tag: "WHY THIS LAB",
    title: "Write the check once, use it everywhere",
    body: `<p style="font-size:32px;margin-bottom:24px"><b>&ldquo;I already wrote that check. Why am I writing it again?&rdquo;</b></p>
<p>Security scripts keep doing the same small jobs: <b>classify a port</b>, <b>hide a password</b> before it reaches a log, <b>count failed logins</b>.</p>
<h2>Real tools are built from pieces</h2>
<ul>
<li>A <b>module</b> of reusable functions, written and tested once</li>
<li>Small <b>driver scripts</b> that import it and do one job each</li>
<li><b>Error handling</b>, so one bad input doesn't kill the whole run</li>
</ul>
<p>That's exactly the shape of this lab: <span class="codename">security_utils.py</span> + <span class="codename">toolkit_main.py</span>.</p>`,
  },
  narration:
    "Before we code: why split one lab into two files? Security scripts keep doing the same small jobs. Classify a port. Hide a password before it ends up in a log file. Count failed logins. If you copy and paste that code into every script, you'll fix a bug in one copy and forget the other five. Real tools are built from pieces. One module holds the reusable functions, written and tested once. Small driver scripts import that module and do one job each. And error handling keeps one bad input from killing the whole run. That's exactly the shape of this lab: a toolkit file and a main file.",
}, (at) => [
    MD("classify a port", at("classify a port")),
    MD("hide a password", at("hide a password")),
    MD("count failed logins", at("count failed logins")),
    MD("module", at("one module holds"), { whole: false }),
    MD("driver scripts", at("small driver scripts")),
    MD("Error handling", at("and error handling")),
    MD("security_utils.py", at("a toolkit file")),
    MD("toolkit_main.py", at("and a main file")),
  ]);

B({
  id: "pysec",
  scene: "doc",
  doc: {
    tag: "WHY PYTHON",
    title: "Python comes with modules, and you can write your own",
    body: `<ul>
<li><b>Built in:</b> <span class="codename">ipaddress</span>, <span class="codename">hashlib</span>, <span class="codename">socket</span> and <span class="codename">re</span> are modules you <span class="codename">import</span></li>
<li><b>Your own:</b> any <span class="codename">.py</span> file is a module too, imported the same way</li>
<li><b>Tested:</b> a module can test itself when you run it directly</li>
<li><b>Error handling:</b> <span class="codename">try</span> / <span class="codename">except</span> lets a scanner skip one bad host and keep going</li>
</ul>
<h2>The shape you'll practice today</h2>
<span class="ex">security_utils.py (functions + self-test)  →  import  →  toolkit_main.py (calls + try/except)</span>`,
  },
  narration:
    "So why Python for this? Mostly its modules. Things like I P address, hash lib, and socket come built in, and you pull them in with \"import\". And any Python file you write is a module too. You import it the same way. A module can even test itself when you run it directly. And \"try\" and \"except\" let a scanner skip one bad host and keep going, instead of crashing halfway through. Today's shape is a toolkit file with functions and a self-test, imported by a main file that calls them.",
}, (at) => [
    MD("ipaddress", at("things like")),
    MD("import", at("you pull them in")),
    MD(" any <span class=\"codename\">.py</span> file is a module too, imported the same way", at("any python file")),
    MD(" a module can test itself when you run it directly", at("a module can even")),
    MD("try", at("let a scanner", 1, -1.2)),
    MD("security_utils.py (functions + self-test)  →  import  →  toolkit_main.py (calls + try/except)", at("today's shape")),
  ]);

B({
  id: "assign",
  scene: "doc",
  doc: {
    tag: "7.6 PROGRAMMING LAB · WHAT YOU WILL BUILD",
    title: "Modular Security Toolkit: two files",
    body: `<table class="doc-table" style="font-size:22px">
<tr><th>File</th><th>What goes in it</th></tr>
<tr><td><span class="codename">security_utils.py</span></td><td><span class="codename">classify_port(port_number)</span> · <span class="codename">mask_password(pw)</span> · <span class="codename">count_failures(events, threshold=3)</span> · a self-test</td></tr>
<tr><td><span class="codename">toolkit_main.py</span></td><td><span class="codename">import security_utils</span>, call all three, one <span class="codename">try</span>/<span class="codename">except</span></td></tr>
</table>
<p style="margin-top:18px;margin-bottom:8px">Running each file (real output; on Windows, type <span class="codename">python</span>, not <span class="codename">python3</span>):</p>
<span class="ex" style="font-size:19px;line-height:1.35;padding:12px 22px">$ python3 security_utils.py
${SELFTEST.join("\n")}

$ python3 toolkit_main.py
${REPORT.join("\n")}</span>`,
  },
  narration:
    "Here's the assignment. You'll write two files. The first is security underscore utils dot P Y, the toolkit. It holds three functions: classify port, mask password, and count failures, plus a small self-test. The second is toolkit underscore main dot P Y. It imports the toolkit, calls all three functions, and has at least one \"try\" and \"except\". This is what running each file looks like. The toolkit on its own just runs its self-test. The main script prints the port category, the password with its middle hidden, a count of failures, and a friendly message for bad input instead of a crash.",
}, (at) => [
    MD("security_utils.py", at("the first is")),
    MD("classify_port(port_number)", at("3 functions classify")),
    MD("mask_password(pw)", at("3 functions classify", 1, 1.3)),
    MD("count_failures(events, threshold=3)", at("and count failures")),
    MD("toolkit_main.py", at("the second is")),
    MD("import security_utils", at("it imports the toolkit")),
    MD("self-test: all checks passed", at("on its own just")),
    MD("Port 443 is: well-known", at("the port category")),
    MD("Masked password: h*****2", at("the password with its")),
    MD("Failures (default threshold): 3", at("a count of failures")),
    MD("Could not classify port: invalid literal for int() with base 10: 'not-a-port'", at("a friendly message")),
  ]);

B({
  id: "reqs",
  scene: "doc",
  doc: {
    tag: "REQUIREMENTS",
    title: "What your submission must include",
    body: `<ul style="font-size:24px">
<li>A <b>header comment block</b> at the top of <b>each</b> file: name, course, assignment name, date</li>
<li>Three functions in <span class="codename">security_utils.py</span>, matching the signatures</li>
<li>At least one <b>default value</b>: <span class="codename">threshold=3</span> counts</li>
<li>At least one function that uses a <b>list comprehension</b> inside</li>
<li><span class="codename">toolkit_main.py</span> imports <span class="codename">security_utils</span> and calls all three</li>
<li>At least one <span class="codename">try</span> / <span class="codename">except</span> in <span class="codename">toolkit_main.py</span></li>
<li>An <span class="codename">if __name__ == "__main__":</span> guard that runs a self-test</li>
<li>PEP 8 on both files: snake_case, spacing, line length</li>
</ul>`,
  },
  narration:
    "These are the requirements, and we'll check off every one. A header comment block at the top of each file, both of them. Three functions that match the names and parameters in the assignment. At least one default value, and threshold equals three counts. At least one function with a list comprehension inside. A main file that imports the toolkit and calls all three functions. At least one \"try\" and \"except\" in the main file. A special guard, if dunder name equals dunder main, that runs a self-test. And clean P E P 8 style in both files.",
}, (at) => [
    MD("header comment block", at("a header comment")),
    MD("<b>each</b>", at("both of them")),
    MD("Three functions in", at("3 functions that")),
    MD("threshold=3", at("and threshold equals")),
    MD("list comprehension", at("with a list comprehension")),
    MD("security_utils", at("imports the toolkit"), { n: 2 }),
    MD("try", at("at least one try")),
    MD('if __name__ == "__main__":', at("a special guard")),
    MD("PEP 8 on both files: snake_case, spacing, line length", at("and clean")),
  ]);

B({
  id: "rubric",
  scene: "doc",
  doc: {
    tag: "GRADING · 30 POINTS · WHAT TO SUBMIT",
    title: "Rubric and submission",
    body: `<table class="doc-table" style="font-size:20px">
<tr><th>Criterion</th><th>Pts</th></tr>
<tr><td>Both files run without errors</td><td class="pts">5</td></tr>
<tr><td>Header comment blocks on both files</td><td class="pts">2</td></tr>
<tr><td>classify_port correct for all three ranges</td><td class="pts">4</td></tr>
<tr><td>mask_password correct including short-password edge case</td><td class="pts">4</td></tr>
<tr><td>count_failures uses list comprehension and or logic</td><td class="pts">5</td></tr>
<tr><td>Default parameter value present</td><td class="pts">2</td></tr>
<tr><td>import security_utils used in toolkit_main.py</td><td class="pts">2</td></tr>
<tr><td>try/except block present in toolkit_main.py (a real exception type, not bare except:)</td><td class="pts">3</td></tr>
<tr><td>if __name__ == "__main__": guard in security_utils.py</td><td class="pts">2</td></tr>
<tr><td>PEP 8 compliance on both files</td><td class="pts">1</td></tr>
</table>
<p style="margin-top:16px"><b>Submit:</b> <span class="codename">security_utils.py</span> + <span class="codename">toolkit_main.py</span> + a screenshot of <span class="codename">python toolkit_main.py</span> running.</p>`,
  },
  narration:
    "It's worth thirty points. The two biggest rows are five points for both files running, and five for count failures, which needs a list comprehension and \"or\" logic. Mask password needs its edge case for short passwords. And the \"try\" and \"except\" has to name a real exception type. A bare except doesn't count. When you're done, you'll turn in both files, and a screenshot of your terminal running the main script.",
}, (at) => [
    MD("Both files run without errors", at("5 points for both")),
    MD("count_failures uses list comprehension and or logic", at("and 5 for count")),
    MD("mask_password correct including short-password edge case", at("needs its edge case", 1, -1.2)),
    MD("try/except block present in toolkit_main.py (a real exception type, not bare except:)", at("has to name")),
    MD("security_utils.py", at("turn in both files"), { n: 2, hold: 1.6 }),
    MD("toolkit_main.py", at("turn in both files", 1, 0.5), { n: 3, hold: 1.2 }),
    MD("python toolkit_main.py", at("and a screenshot")),
  ]);

// ---------------- BACKGROUND: functions, defaults, modules, the guard, exceptions
B({
  id: "c0",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · BEFORE WE BUILD",
    title: "Four new tools this week",
    body: `<table class="doc-table" style="font-size:22px">
<tr><th>Tool</th><th>Looks like</th><th>What it does</th></tr>
<tr><td><b>function</b></td><td><span class="codename">def classify_port(port_number):</span></td><td>names a block of code you can call again and again</td></tr>
<tr><td><b>default value</b></td><td><span class="codename">threshold=3</span></td><td>a parameter the caller can skip</td></tr>
<tr><td><b>module</b></td><td><span class="codename">import security_utils</span></td><td>uses functions from another file</td></tr>
<tr><td><b>exception handling</b></td><td><span class="codename">try:</span> … <span class="codename">except ValueError:</span></td><td>handles an error instead of crashing</td></tr>
</table>
<p style="margin-top:22px">Plus one special line: <span class="codename">if __name__ == "__main__":</span>, which lets a module test itself.</p>`,
  },
  narration:
    "Before we build anything, let's slow down and review the four tools this lab is built on. The module reading covers them, but if they're new to you, that's okay. First, a function. You write it with def, give it a name, and then you can call it again and again. Second, a default value, a parameter the caller is allowed to skip. Third, a module. Import lets one file use the functions from another file. And fourth, exception handling. \"Try\" and \"except\" catch an error and handle it, instead of letting the program crash. Plus one special line, if dunder name equals dunder main, that lets a module test itself. We'll take them one at a time.",
}, (at) => [
    MD("def classify_port(port_number):", at("first a function")),
    MD("names a block of code you can call again and again", at("and then you can call")),
    MD("threshold=3", at("second a default")),
    MD("a parameter the caller can skip", at("a parameter the caller")),
    MD("import security_utils", at("third a module")),
    MD("uses functions from another file", at("import lets one")),
    MD("except ValueError:", at("and fourth exception")),
    MD("handles an error instead of crashing", at("handle it instead", 1, -1.4)),
    MD('if __name__ == "__main__":', at("plus one special")),
  ]);
B({
  id: "c1",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · FUNCTIONS",
    title: "A function: def, parameters, return",
    body: `<span class="ex" style="font-size:23px">def classify_port(port_number):        # def, a name, a parameter, a colon
    """Return the IANA category."""    # docstring: what it does
    if 0 &lt;= port_number &lt;= 1023:
        return "well-known"            # return hands the answer back

category = classify_port(443)          # call it: name(value)
category                               # "well-known"</span>
<h2>Return, don't just print</h2>
<ul>
<li><span class="codename">return</span> hands a value back to whoever called the function, and ends it</li>
<li><span class="codename">print</span> only shows text on the screen. The caller gets <span class="codename">None</span></li>
</ul>`,
  },
  narration:
    "Let's start with functions. A function starts with the keyword def, which is short for define. Then a name, then parameters in parentheses, and a colon. A parameter is an input. Here, port number is whatever port the caller hands in. The indented lines are the body. The first one is a docstring, a short description in triple quotes. Then the real work, and a return. Return hands the answer back to whoever called the function, and it ends the function right there. To call it, you write the name with a value in parentheses. Classify port, four forty three, gives back well-known, and we store it in category. One warning. Print is not the same as return. Print only shows text on the screen. The caller gets nothing back, which Python calls None.",
}, (at) => [
    MD("def classify_port(port_number):", at("a function starts with")),
    MD("# def, a name, a parameter, a colon", at("then a name")),
    MD("port_number", at("here port number"), { n: 1 }),
    MD('"""Return the IANA category."""', at("a docstring")),
    MD('return "well-known"', at("and a return")),
    MD("# return hands the answer back", at("return hands the")),
    MD("category = classify_port(443)", at("to call it")),
    MD('# "well-known"', at("and we store it")),
    MD(" only shows text on the screen. The caller gets <span class=\"codename\">None</span>", at("print only shows")),
  ]);
B({
  id: "c2",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · DEFAULT VALUES",
    title: "A default value: a parameter you can skip",
    body: `<span class="ex" style="font-size:23px">def count_failures(events, threshold=3):
    ...

count_failures(events)                  # threshold is 3 (the default)
count_failures(events, threshold=10)    # keyword argument: threshold is 10
count_failures(events, 10)              # same thing, by position</span>
<h2>Rules</h2>
<ul>
<li>Parameters with defaults go <b>after</b> the ones without</li>
<li>A <b>keyword argument</b> names the parameter, so the call reads like a sentence</li>
</ul>`,
  },
  narration:
    "Next, default values. Look at the second parameter: threshold equals three. That equals three is the default. If the caller doesn't pass a threshold, Python uses three. So count failures with just the events list gets three. But you can override it. Threshold equals ten, written inside the call, is a keyword argument. It names the parameter you're setting, so the call reads like a sentence. Passing ten by position does the same thing. One rule: parameters with defaults go after the ones without.",
}, (at) => [
    MD("threshold=3", at("look at the second")),
    MD("count_failures(events)", at("so count failures")),
    MD("# threshold is 3 (the default)", at("with just the events")),
    MD("count_failures(events, threshold=10)", at("threshold equals 10 written")),
    MD("# keyword argument: threshold is 10", at("is a keyword argument")),
    MD("count_failures(events, 10)", at("passing 10 by position")),
    MD("<b>after</b>", at("one rule")),
  ]);
B({
  id: "c3",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · MODULES",
    title: "A module is just a .py file",
    body: `<span class="ex" style="font-size:23px"># toolkit_main.py
import security_utils                  # runs security_utils.py once

result = security_utils.classify_port(443)
#        ↑ module      ↑ function inside it</span>
<h2>How import finds it</h2>
<ul>
<li>Write the module name with <b>no</b> <span class="codename">.py</span>: <span class="codename">import security_utils</span></li>
<li>Both files go in the <b>same folder</b>, or Python can't find it</li>
<li>Built-in modules work the same way: <span class="codename">import ipaddress</span></li>
</ul>`,
  },
  narration:
    "Next, modules. Any Python file is a module, and import lets another file use it. In toolkit main, import security utils runs the toolkit file once, which defines its three functions. Then you reach inside with a dot: the module name, a dot, and the function. So security utils dot classify port. Three rules. Write the module name without dot P Y. Keep both files in the same folder, or Python won't find the module. And built-in modules, like I P address, work exactly the same way.",
}, (at) => [
    MD("import security_utils", at("in toolkit main")),
    MD("# runs security_utils.py once", at("runs the toolkit file")),
    MD("security_utils.classify_port(443)", at("then you reach")),
    MD("↑ module      ↑ function inside it", at("the module name a dot")),
    MD("<b>no</b>", at("write the module name")),
    MD("same folder", at("keep both files")),
    MD("import ipaddress", at("and built-in modules")),
  ]);
B({
  id: "c4",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · THE MAIN GUARD",
    title: 'if __name__ == "__main__":',
    body: `<table class="doc-table" style="font-size:22px">
<tr><th>How the file runs</th><th>__name__ is</th><th>Guarded code</th></tr>
<tr><td><span class="codename">python3 security_utils.py</span><br><span style="font-size:17px">(Windows: python security_utils.py)</span></td><td><span class="codename">"__main__"</span></td><td><b>runs</b>: the self-test</td></tr>
<tr><td><span class="codename">import security_utils</span></td><td><span class="codename">"security_utils"</span></td><td><b>skipped</b></td></tr>
</table>
<span class="ex" style="font-size:22px;margin-top:18px">if __name__ == "__main__":
    assert classify_port(22) == "well-known"   # stops if False</span>
<p style="margin-top:14px"><span class="codename">assert</span> checks that something is True. If it isn't, Python stops with an <b>AssertionError</b>.</p>`,
  },
  narration:
    "Here's the special line. Every Python file has a hidden variable, dunder name. Dunder is short for double underscore. When you run a file directly, like python three security utils dot P Y, dunder name is set to dunder main. On Windows, that command is just python. But when another file imports it, dunder name is the module's own name, security utils. So code inside this \"if\" runs on a direct run, and gets skipped on an import. That's where the self-test goes. The test uses assert. Assert checks that something is True. If it is, nothing happens. If it isn't, Python stops with an assertion error, so you know a function is broken.",
}, (at) => [
    MD("__name__ is", at("a hidden variable")),
    MD("python3 security_utils.py", at("when you run a file")),
    MD('"__main__"', at("is set to dunder"), { n: 2 }),
    MD("import security_utils", at("but when another")),
    MD('"security_utils"', at("the module's own")),
    MD("<b>runs</b>: the self-test", at("so code inside")),
    MD("<b>skipped</b>", at("and gets skipped")),
    MD('assert classify_port(22) == "well-known"', at("the test uses")),
    MD("AssertionError", at("python stops with")),
  ]);
B({
  id: "c5",
  say: [[/\bint\b/gi, '"$&"']], // voice-only: quoted "int" was clean here in both Whisper models; unquoted it drifted to ant/ent/into
  scene: "doc",
  doc: {
    tag: "BACKGROUND · EXCEPTIONS",
    title: "try / except: handle the error, keep going",
    body: `<span class="ex" style="font-size:23px">int("443")          # 443
int("not-a-port")   # ValueError!   text that isn't a number
"443" + 1           # TypeError!    a string plus a number

try:
    bad_port = int("not-a-port")      # the risky line
except ValueError as err:             # catch THAT error type
    print(f"Could not classify port: {err}")</span>
<h2>Don't write a bare <span class="codename">except:</span></h2>
<p>It catches <i>everything</i>, even Ctrl+C, and hides the bugs you actually want to see.</p>`,
  },
  narration:
    "Last one, exceptions. Int turns text into a number, so int of four forty three in quotes gives you the number. But int of not a port can't, so Python raises a value error. Add a string to a number, and you get a type error. Normally an error like that crashes the program. \"Try\" and \"except\" let you handle it. Put the risky line inside \"try\". If it raises a value error, Python jumps to the matching \"except\", and runs that code instead. As err keeps the error, so you can print its message. And always name the error type. A bare except, with nothing after it, catches everything, even Control C, and hides the bugs you actually want to see.",
}, (at) => [
    MD('int("443")', at("int turns text")),
    MD("ValueError!", at("raises a value error")),
    MD("TypeError!", at("you get a type error")),
    MD("try:", at("let you handle", 1, -1.5)),
    MD("# the risky line", at("put the risky"), { hold: 1.4 }),
    MD("except ValueError as err:", at("python jumps to")),
    MD("as err", at("keeps the error", 1, -0.4)),
    MD("Don't write a bare", at("with nothing after", 1, -1.0)),
  ]);
B({
  id: "c6",
  scene: "doc",
  doc: {
    tag: "BACKGROUND · HOW THE TWO FILES FIT",
    title: "One library, one driver",
    body: `<table class="doc-table" style="font-size:22px">
<tr><th></th><th>security_utils.py</th><th>toolkit_main.py</th></tr>
<tr><td><b>Role</b></td><td>the library: reusable functions</td><td>the driver: does one job</td></tr>
<tr><td><b>Contains</b></td><td>3 functions + the guarded self-test</td><td>import, 3 calls, try/except</td></tr>
<tr><td><b>You run</b></td><td><span class="codename">python3 security_utils.py</span> → self-test<br><span style="font-size:17px">(Windows: python security_utils.py)</span></td><td><span class="codename">python3 toolkit_main.py</span> → the results<br><span style="font-size:17px">(Windows: python toolkit_main.py)</span></td></tr>
<tr><td><b>Prints</b></td><td><span class="codename">all checks passed</span></td><td>4 lines (no self-test, the guard skips it)</td></tr>
</table>
<p style="margin-top:22px">Build and test the library first. Then write the driver.</p>`,
  },
  narration:
    "Here's how the two files fit together. Security utils is the library. It holds the reusable functions and its own self-test. Toolkit main is the driver. It imports the library, calls the three functions, and handles bad input with \"try\" and \"except\". You'll run each file. On Windows, that's python instead of python three. The library prints all checks passed. The main file prints four lines of results, and no self-test, because the guard skips it on an import. So the order is: build and test the library first, then write the driver. Okay, that's the background. Let's see it all work for real.",
}, (at) => [
    MD("the library: reusable functions", at("is the library")),
    MD("3 functions + the guarded self-test", at("it holds the reusable")),
    MD("the driver: does one job", at("toolkit main is the")),
    MD("import, 3 calls, try/except", at("it imports the library")),
    MD("(Windows: python security_utils.py)", at("on windows that's"), { hold: 2.4 }),
    MD("(Windows: python toolkit_main.py)", at("on windows that's"), { hold: 2.4 }),
    MD("all checks passed", at("the library prints")),
    MD("4 lines (no self-test, the guard skips it)", at("the main file prints")),
    MD("Build and test the library first. Then write the driver.", at("so the order")),
  ]);

// ---------------- Scene A: create the first file
B(
  {
    id: "newfile",
    scene: "editor",
    transition: "zoom",
    viewTop: 1,
    fileCreate: true,
    fileCreateAt: "type the name exactly",
    fileOpenAt: "press enter",
    narration:
      "I've opened an empty folder called Module 7 in V S Code. In the Explorer, hover over the folder name and click the New File icon. Type the name exactly: security underscore utils dot P Y, and press Enter. The file opens. With the Python extension installed, you get color coding and this Run button in the top right.",
  },
  (at) => [
    { do: "redbox", target: "newfile", at: at("click the new file icon"), hold: 3.5 },
    { do: "redbox", target: "runbtn", at: at("run button"), hold: 3.5 },
  ]
);

// ---------------- PRACTICE: functions, defaults, strings, errors, modules in the Python shell
const RP = createRepl();
const REPL_BEAT = { scene: "editor", viewTop: 1, terminalMax: true };
B(...RP.shell(
  {
    id: "r0",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Before we write the toolkit, let's try these ideas live. Open a terminal from the Terminal menu, or press Control and backtick. Type python three and press Enter. If you're on Windows, type just python, without the three. This starts the Python shell. The three greater than signs are the prompt, and anything you type runs right away. On the left is the Variables panel, which shows everything the shell remembers. Type along with me.",
    stepsOverlay: { title: "Start the Python shell", items: ["Terminal ▸ New Terminal", "Mac: python3", "Windows: python"], at: "open a terminal", hold: 9 },
  },
  (at) => [
    { do: "terminal-open", at: at("or press") },
    { do: "term-type", at: at("type python 3"), text: "python3", cps: 9 },
    { do: "term-out", at: at("this starts the python"), lines: RP.banner(), noVerify: true },
    { do: "term-type", prompt: ">>> ", at: at("the 3 greater"), text: "", cps: 9 },
    MC("python3", at("this starts the python")),
    { do: "redbox", target: "debug", at: at("on the left is"), hold: 3.3 },
  ]
));
B(...RP.shell(
  {
    id: "r1",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Let's write a function. Def, greet, then the parameter, name, in parentheses, and a colon. The prompt changes to three dots, because Python is waiting for the body. Indent four spaces: return an f string that says hello, and the name. Press Enter on the empty line. Nothing runs yet. We only defined it. But look at the panel: greet is now in memory, as a function. To call it, type the name with a value: greet, analyst. Python runs the body with name set to analyst, and returns hello analyst. You can store what it returns, too. Message equals greet, admin. And message holds the returned string.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP.RB(["def greet(name):", '    return f"Hello, {name}"'], at("let's write a function"), 12, { ats: [at("def greet"), at("indent 4 spaces")], runAt: at("press enter on the empty") }),
    ...RP.R('greet("analyst")', at("to call it")),
    ...RP.R('message = greet("admin")', at("message equals"), 16),
    ...RP.R("message", at("and message holds", 1, -0.8), 14),
    { do: "redbox", target: "debug", at: at("but look at the panel"), hold: 3.3 },
    MO("'Hello, analyst'", at("and returns hello")),
    MO("'Hello, admin'", at("and message holds", 1, 0.6)),
  ]
));
B(...RP.shell(
  {
    id: "r2",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Here's the most common mix-up with functions: print versus return. This function, shout, prints the word in capitals, but it doesn't return anything. Watch. Result equals shout, alert. It prints ALERT on the screen. But look at the panel. Result is None. Print result, and it says None too. A function without a return hands back None. So if another file needs the answer, return it. Don't just print it. That's why all three toolkit functions use return.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP.RB(["def shout(word):", "    print(word.upper())"], at("this function shout"), 12, { runAt: at("but it doesn't return") }),
    ...RP.R('result = shout("alert")', at("result equals")),
    ...RP.R("print(result)", at("print result and"), 14),
    MO("ALERT", at("it prints alert")),
    { do: "redbox", target: "debug", at: at("but look at the panel"), hold: 3.3 },
    MO("None", at("and it says none")),
  ]
));
B(...RP.shell(
  {
    id: "r3",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Next, a default value. Too many takes two parameters: attempts, and limit equals three. That equals three is the default. The body returns attempts greater than limit, which is True or False. Call it with just five, and you get True, because limit fell back to three. Two gives False. Now override the default with a keyword argument: too many, five, comma, limit equals ten. Five isn't more than ten, so it's False. That's exactly how threshold works in count failures.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP.RB(["def too_many(attempts, limit=3):", "    return attempts > limit"], at("too many takes"), 14, { ats: [at("too many takes"), at("the body returns")], runAt: at("which is true or false") }),
    ...RP.R("too_many(5)", at("call it with just"), 14),
    ...RP.R("too_many(2)", at("2 gives false", 1, -0.6), 14),
    ...RP.R("too_many(5, limit=10)", at("now override")),
    MO("True", at("and you get true")),
    MO("False", at("2 gives false", 1, 0.6)),
    MC("limit=10", at("so it's false")),
  ]
));
B(...RP.shell(
  {
    id: "r4",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Mask password needs a few string tricks, so let's try them. P W equals hunter two. P W index zero is the first character, h. Index minus one is the last character, two. Len of P W is seven. And a string times a number repeats it. A star times five gives five stars. Now put it together. The first character, plus a star for each middle character, that's len minus two, plus the last character. That gives h, five stars, two. That's the whole idea behind mask password.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP.R('pw = "hunter2"', at("p w equals")),
    ...RP.R("pw[0]", at("p w index 0")),
    ...RP.R("pw[-1]", at("index minus 1")),
    ...RP.R("len(pw)", at("len of p w")),
    ...RP.R('"*" * 5', at("a string times")),
    ...RP.R('pw[0] + "*" * (len(pw) - 2) + pw[-1]', at("now put it together"), 18),
    MO("'h'", at("the first character h")),
    MO("'2'", at("the last character 2")),
    MO("7", at("is 7 and")),
    MO("'*****'", at("gives 5 stars")),
    MO("'h*****2'", at("that gives h")),
  ]
));
B(...RP.shell(
  {
    id: "r5",
    say: [[/\bint\b/gi, '"$&"']], // voice-only: quoted "int" was clean here in both Whisper models; unquoted it drifted to ant/ent/into
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Next, errors. Int of four forty three, in quotes, turns that text into the number four forty three. But int of not a port can't. Python raises a value error, and prints a traceback. Adding a string and a number is a different mistake, a type error. In a script, an error like that stops everything. That's what \"try\" and \"except\" are for. Try, colon. Then the risky line, indented. Except value error, colon. And what to do instead: print got bad input. Run it, and instead of a traceback, you get our message. Notice that port never showed up in the panel. The int call failed before anything was stored. Type exit with parentheses to leave the shell.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP.R('int("443")', at("next errors", 1, 0.9)),
    ...RP.R('int("not-a-port")', at("but int of not")),
    ...RP.R('"443" + 1', at("adding a string")),
    ...RP.RB(["try:", '    port = int("not-a-port")', "except ValueError:", '    print("got bad input")'], at("try colon"), 14, { ats: [at("try colon"), at("then the risky"), at("except value error"), at("and what to do")], runAt: at("run it and instead") }),
    { do: "term-type", prompt: ">>> ", at: at("type exit"), text: "exit()", cps: 9 },
    { do: "term-type", at: at("type exit", 1, 1.6), text: "", cps: 9 }, // back at the shell prompt
    MO("443", at("into the number")),
    MO("ValueError: invalid literal for int() with base 10: 'not-a-port'", at("python raises a value")),
    MO('TypeError: can only concatenate str (not "int") to str', at("a type error")),
    MO("got bad input", at("you get our message")),
    { do: "redbox", target: "debug", at: at("notice that port"), hold: 3.3 },
  ]
));
// ---------------- PRACTICE (cont.): modules + __name__ in a fresh shell, then predict-the-output
const RP2 = createRepl();
B(...RP2.shell(
  {
    id: "r6",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "One more topic, modules. I'll start python three again. Remember, on Windows it's just python. Fresh session, so the panel is empty. Python comes with lots of modules. Import I P address, all one word. The panel shows it, as a module. To use something inside a module, write the module name, a dot, and the name inside. I P address dot I P underscore address, ten dot zero dot zero dot five, dot is private. True, that's a private address. Eight dot eight dot eight dot eight is not. Now a special variable, dunder name. In the shell, it's dunder main, because this is what's running directly. But I P address dot dunder name is I P address, because it was imported. Remember that. It's the key to the guard in our toolkit.",
    stepsOverlay: { title: "Restart the Python shell", items: ["Mac: python3", "Windows: python"], at: "start python three", hold: 3.5 },
  },
  (at) => {
    const t = at("start python three");
    return [
      { do: "terminal-open", at: 0, instant: true },
      { do: "term-type", at: t, text: "python3", cps: 9 },
      { do: "term-out", at: at("fresh session"), lines: RP2.banner(), noVerify: true },
      ...RP2.R("import ipaddress", at("import i p address")),
      ...RP2.R(`ipaddress.ip_address("${IP_PRIVATE}").is_private`, at("i p address dot i p"), 18),
      ...RP2.R(`ipaddress.ip_address("${IP_PUBLIC}").is_private`, at("true that's a private"), 22),
      ...RP2.R("__name__", at("now a special variable")),
      ...RP2.R("ipaddress.__name__", at("but i p address dot")),
      { do: "redbox", target: "debug", at: at("the panel shows it"), hold: 3.3 },
      MO("True", at("true that's a private")),
      MO("False", at("is not")),
      MO("'__main__'", at("in the shell it's")),
      MO("'ipaddress'", at("because it was imported")),
    ];
  }
));
B({
  id: "quiz",
  scene: "doc",
  holdAfter: 4,
  doc: {
    tag: "CHECK YOURSELF · PREDICT THE OUTPUT",
    title: "What does each one give back?",
    body: `<span class="ex" style="font-size:22px">def check(port, limit=1024):
    if port &lt; limit:
        return "low"
    return "high"</span>
<ol style="font-size:26px;margin-top:20px;line-height:1.7">
<li><span class="codename">check(80)</span></li>
<li><span class="codename">check(8080)</span></li>
<li><span class="codename">check(8080, limit=10000)</span></li>
<li><span class="codename">int("22") + 1</span></li>
<li><span class="codename">int("ssh")</span></li>
</ol>`,
  },
  narration:
    "Quick check before we build. Here's a function called check, with a default limit. Below it are five lines of code. For each one, predict what Python gives back. Think about which value limit has when you don't pass one, what a keyword argument changes, and whether int can turn the text into a number. Pause the video now, and write down your five answers. Then press play, and we'll run them in the shell.",
}, (at) => [
    MD("def check(port, limit=1024):", at("here's a function called")),
    MD("limit=1024", at("with a default limit")),
    MD("check(80)", at("which value limit")),
    MD("check(8080, limit=10000)", at("what a keyword argument")),
    MD('int("ssh")', at("and whether int")),
  ]);
B(...RP2.shell(
  {
    id: "q1",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Let's check. I'll paste in the check function. It shows up in the panel on the left. Number one, check eighty, is low. Limit is the default, so eighty is less than the limit. Number two, check eight thousand eighty, is high. And number three passes limit equals ten thousand, so eight thousand eighty is under the new limit, and it's low.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    // pasted from the quiz slide (paste speed), so the reveals keep up with the voice
    ...RP2.RB(["def check(port, limit=1024):", "    if port < limit:", '        return "low"', '    return "high"'], at("i'll paste in"), 90),
    ...RP2.R("check(80)", at("number 1")),
    ...RP2.R("check(8080)", at("number 2")),
    ...RP2.R("check(8080, limit=10000)", at("and number 3"), 16),
    { do: "redbox", target: "debug", at: at("it shows up in the panel"), hold: 3.3 },
    MO("'low'", at("is low limit")),
    MO("'high'", at("is high")),
    MO("'low'", at("and it's low"), { n: 1 }),
  ]
));
B(...RP2.shell(
  {
    id: "q2",
    ...REPL_BEAT,
    transition: "cut",
    narration:
      "Number four. The text twenty two becomes the number twenty two, and plus one makes twenty three. And number five. The text S S H can't become a number, so it's a value error. How many did you get? Type exit to leave the shell.",
  },
  (at) => [
    { do: "terminal-open", at: 0, instant: true },
    ...RP2.R('int("22") + 1', at("number 4")),
    ...RP2.R('int("ssh")', at("and number 5")),
    { do: "term-type", prompt: ">>> ", at: at("type exit"), text: "exit()", cps: 9 },
    { do: "term-type", at: at("type exit", 1, 1.6), text: "", cps: 9 }, // back at the shell prompt
    MO("23", at("and plus 1")),
    MO("ValueError: invalid literal for int() with base 10: 'ssh'", at("so it's a value error")),
  ]
));
B({
  id: "pause0",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 1, of: 9 },
  task: "Your turn: try functions in the shell",
  checklist: ["def a function, call it, store the result", "A default value + a keyword argument", "Cause a ValueError, then catch it"],
  hint: "python3 to start (Windows: python) · exit() to leave",
  narration:
    "Step one. Pause the video now, open the Python shell yourself, with python three, or just python on Windows. Write a function and call it. Try a default value and a keyword argument. Then cause a value error on purpose, and catch it with \"try\" and \"except\". If you have a question, this is a good spot to stop and ask. Press play when you're ready, and we'll write the toolkit.",
});

// ---------------- Scene B: header
B(
  {
    id: "hdr1",
    scene: "editor",
    transition: "cut",
    viewTop: 1,
    narration:
      "First, the header comment block. Every comment starts with a pound sign, and Python skips it, so it's a note for people. A border line of equal signs, and then my name. Use your own name here, not mine.",
  },
  (at) => [T(1, at("every comment starts"), 16), T(2, at("and then my name"), 16),
    M(1, "#", at("starts with a pound")),
    M(1, "==================================================", at("of equal signs", 1, -0.8), { until: "and then my" }),
    M(2, "Alex Rivera", at("own name here")),
  ]
);
B(
  {
    id: "hdr2",
    scene: "editor",
    narration:
      "The course, Programming for Cybersecurity. Then the assignment, Module 07, Modular Security Toolkit. One labeled item per line, so it's a real block.",
  },
  (at) => [T(3, at("the course"), 14), T(4, at("then the assignment"), 14),
    M(4, "Assignment:", at("one labeled item")),
    M(3, "Course:", at("one labeled item")),
  ]
);
B(
  {
    id: "hdr3",
    scene: "editor",
    holdAfter: 0.8,
    narration: "Today's date, and a closing border. I'll just copy the first border line and paste it.",
  },
  (at) => [T(5, at("today's date"), 16), P(6, 6, at("and paste it")), M(1, "==================================================", at("copy the first")), M(6, "==================================================", at("and paste it", 1, 0.3))]
);

// ---------------- Scene C: classify_port
B(
  {
    id: "cp1",
    scene: "editor",
    transition: "cut",
    viewTop: 1, // the step-2 pause must show the header too (everything to type is on screen at a pause)
    prefill: pre(1, 6),
    narration:
      "Two blank lines after the header, because P E P 8 wants two blank lines before every function. Now the first function. Def, classify port, and in parentheses the parameter, port number, then a colon. Port number is the input. Whoever calls the function hands us a port, and we use it by that name. On the next line, indented four spaces, a docstring in triple quotes that says what the function does. V S Code shows it when you hover over the function, so it's worth the one line.",
  },
  (at) => [
    H(6, at("two blank lines after")),
    T(7, at("two blank lines after", 1, 0.6)), // Enter, Enter: the two blank rows exist when the voice says so
    T(8, at("two blank lines after", 1, 1.0)),
    T(9, at("def classify port"), 10),
    T(10, at("on the next line"), 16),
    C(8, at("two blank lines after", 1, 1.4), "2 blank lines before a def"),
    M(9, "def", at("def classify port")),
    M(9, "port_number", at("port number is the input")),
    M(9, ":", at("then a colon")),
    M(10, '"""Return the IANA category for a port number."""', at("v s code shows it")),
  ]
);
B(
  {
    id: "cp2",
    scene: "editor",
    narration:
      "Now the logic. If zero is less than or equal to port number, and port number is less than or equal to ten twenty three, colon. Python lets you chain comparisons like that, just like in math class. That's the well-known range. Inside, indented again, return well-known. Return hands the answer back, and it ends the function right there.",
  },
  (at) => [
    T(11, at("now the logic"), 12),
    T(12, at("inside indented again"), 14),
    C(11, at("python lets you chain"), "a chained comparison"),
    M(11, "0 <= port_number <= 1023", at("python lets you chain")),
    M(12, "return", at("return hands the")),
  ]
);
B(
  {
    id: "cp3",
    scene: "editor",
    narration:
      "The next range works the same way. If it's from ten twenty four up to forty nine one fifty one, return registered. And if neither \"if\" matched, we fall through to the last line: return dynamic. We don't need an \"else\" here. For the other two ranges, a return already ended the function.",
  },
  (at) => [
    T(13, at("the next range"), 16),
    T(14, at("return registered"), 14),
    T(15, at("and if neither"), 16),
    M(13, "1024 <= port_number <= 49151", at("if it's from")),
    M(15, 'return "dynamic"', at("to the last line")),
    M(12, 'return "well-known"', at("for the other 2"), { hold: 2.6 }),
    M(14, 'return "registered"', at("for the other 2"), { hold: 2.6 }),
  ]
);
B({
  id: "pause1",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 2, of: 9 },
  task: "Your turn: header + classify_port",
  checklist: ["Create security_utils.py with your header", "def classify_port(port_number): + docstring", "well-known, registered, else dynamic"],
  hint: "Two blank lines before each def",
  narration:
    "That's step two. Pause the video now. Create security utils dot P Y, write your own header, and the classify port function. Press play when you're ready.",
});

// ---------------- Scene D: mask_password
B(
  {
    id: "mp1",
    say: [[/\blen\b/gi, '"$&"']], // voice-only: unquoted, small.en heard "LAN" here; quoted was clean in both models (A/B 2026-10-15)
    scene: "editor",
    transition: "cut",
    viewTop: 11,
    prefill: pre(11, 15),
    narration:
      "Welcome back. Two blank lines, then the second function. Def, mask password, with one parameter, P W, for the password. A one line docstring. Then the edge case the assignment asks for. If len of P W is less than two, return two asterisks. A password that short has no middle to hide.",
  },
  (at) => [
    H(15, at("welcome back")),
    T(18, at("then the second function"), 10),
    T(19, at("for the password"), 16),
    T(20, "prev+0.1", 16),
    T(21, "prev+0.1", 16),
    C(17, at("a password that short"), 'len(pw) < 2 → "**"'),
    M(18, "pw", at("with one parameter")),
    M(20, "len(pw) < 2", at("if len of")),
    M(21, '"**"', at("return 2 asterisks", 1, 0.6)),
  ]
);
B(
  {
    id: "mp2",
    scene: "editor",
    narration:
      "Now the normal case. Middle equals a star times len of P W minus two, one star for every middle character. Then return an f string: P W index zero, the middle, and P W index minus one. So hunter two becomes h, five stars, two. We tried this in the shell a minute ago.",
  },
  (at) => [
    T(22, at("now the normal case"), 12),
    T(23, at("then return an f string"), 12),
    C(21, at("so hunter 2"), '"hunter2" → "h*****2"'),
    M(22, '"*" * (len(pw) - 2)', at("one star for every")),
    M(23, "{pw[0]}", at("p w index 0")),
    M(23, "{middle}", at("the middle and")),
    M(23, "{pw[-1]}", at("p w index minus")),
  ]
);
B({
  id: "pause2",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 3, of: 9 },
  task: "Your turn: mask_password",
  checklist: ['Short password: return "**"', 'middle = "*" * (len(pw) - 2)', "Return first + middle + last"],
  hint: "pw[0] is first · pw[-1] is last",
  narration: "Step three. Pause the video now, and write mask password, with the edge case first. Press play when it's in.",
});

// ---------------- Scene E: count_failures
B(
  {
    id: "cf1",
    scene: "editor",
    transition: "cut",
    viewTop: 21,
    prefill: pre(21, 23),
    narration:
      "Welcome back. The third function. Def, count failures, with two parameters: events, and threshold equals three. That equals three is the default value the rubric asks for. If a caller doesn't pass a threshold, it's three. Then the docstring.",
  },
  (at) => [
    H(23, at("welcome back")),
    T(26, at("def count failures"), 15),
    T(27, "prev+0.2", 16),
    C(25, at("that equals 3"), "threshold=3: a default value"),
    M(26, "events", at("2 parameters events")),
    M(26, "threshold=3", at("that equals 3")),
  ]
);
B(
  {
    id: "cf2",
    scene: "editor",
    narration:
      "Now the list comprehension. Failures equals, square bracket. I'm splitting it across lines so it's easy to read. Inside square brackets, Python lets you break a line anywhere. E for e in events: keep each event, e. Then the condition. If e, severity, equals equals high, or e, attempts, is greater than threshold. The \"or\" means either one is enough. A high severity event counts, and so does any event with too many attempts. Then close the bracket.",
  },
  (at) => [
    T(28, at("failures equals"), 12),
    T(29, at("e for e in"), 12),
    T(30, "prev+0.1", 16),
    T(31, "prev+0.1", 16),
    T(32, at("then close the bracket"), 12),
    C(31, at("the or means"), "or: one is enough"),
    M(28, "[", at("inside square brackets")),
    M(29, "e for e in events", at("keep each event")),
    M(30, 'e["severity"] == "high"', at("if e severity")),
    M(31, "or", at("the or means")),
    M(31, 'e["attempts"] > threshold', at("and so does any")),
  ]
);
B(
  {
    id: "cf3",
    scene: "editor",
    narration:
      "Then return len of failures, the number of events we kept. That's all three functions.",
  },
  (at) => [T(33, at("then return len"), 16),
    M(33, "len(failures)", at("the number of events")),
  ]
);
B({
  id: "pause3",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 4, of: 9 },
  task: "Your turn: count_failures",
  checklist: ["def count_failures(events, threshold=3):", "List comprehension with or", "return len(failures)"],
  hint: 'e["severity"] == "high" or e["attempts"] > threshold',
  narration: "Step four. Pause the video now, and write count failures with its default value and the list comprehension. Press play when it's done.",
});

// ---------------- Scene F: the main guard + self-test
B(
  {
    id: "mg1",
    scene: "editor",
    transition: "cut",
    viewTop: 33,
    prefill: pre(33, 33),
    narration:
      "Welcome back. Now the guard. At the left margin, not inside any function: if dunder name equals equals dunder main, colon. Remember the shell. Dunder name is dunder main only when this file is the program being run. When toolkit main imports this file, dunder name is security utils instead, so everything inside this \"if\" gets skipped. Inside, a comment that says so.",
  },
  (at) => [
    H(33, at("welcome back")),
    T(36, at("if dunder name"), 10),
    T(37, "prev+0.2", 16),
    C(35, at("remember the shell"), "direct run → __name__ is \"__main__\""),
    M(36, "__name__", at("dunder name is dunder main only")),
    M(36, '"__main__"', at("is the program being")),
    M(36, 'if __name__ == "__main__":', at("so everything inside")),
  ]
);
B(
  {
    id: "mg2",
    scene: "editor",
    narration:
      "Under the guard go the asserts. I'll type five of them, one for each answer we expect. Assert checks that something is True. If it is, nothing happens. If it isn't, Python stops with an assertion error, and you know that function is broken. So the first line checks that classify port twenty two equals equals well-known. Eight thousand eighty should be registered, and sixty thousand should be dynamic. Then mask password. Hunter two should come back as h, five stars, two. And a single x should come back as two asterisks. That's the edge case.",
  },
  (at) => [
    T(38, at("under the guard"), 16),
    T(39, "prev+0.1", 16),
    T(40, "prev+0.1", 16),
    T(41, "prev+0.1", 16),
    T(42, "prev+0.1", 16),
    M(38, 'classify_port(22) == "well-known"', at("so the first line")),
    M(39, "8080", at("should be registered", 1, -0.9)),
    M(40, "60000", at("and 60000"), {}),
    M(41, '"h*****2"', at("should come back as h")),
    M(42, '"**"', at("that's the edge case")),
    M(38, "assert", at("assert checks that")),
  ]
);
B(
  {
    id: "mg3",
    scene: "editor",
    transition: "cut",
    viewTop: 37,
    prefill: pre(37, 42),
    narration:
      "For count failures, a small sample list. I'll paste it, since it's just test data. Three events. With the default threshold of three, two of them count: the high one, and the one with five attempts. With threshold equals ten, only the high one counts. And if every assert passes, the last line prints a success message.",
  },
  (at) => [
    P(43, 47, at("i'll paste it")),
    T(48, at("3 events"), 16),
    T(49, "prev+0.1", 16),
    T(50, "prev+0.1", 16),
    M(44, '"high"', at("the high one and")),
    M(45, '"attempts": 5', at("the one with 5")),
    M(49, "threshold=10", at("with threshold equals 10", 1, 0.8)),
    M(50, 'print("self-test: all checks passed")', at("prints a success")),
  ]
);
B(
  {
    id: "runself",
    scene: "editor",
    transition: "cut",
    viewTop: 46,
    prefill: pre(46, 50),
    narration:
      "Let's run the self-test. Save the file first, with Command S, or Control S on Windows. Then open a terminal, and type python three, space, security underscore utils dot P Y. On Windows, type python, space, security underscore utils dot P Y instead. All checks passed. Every assert was True. If one had failed, you'd see an assertion error pointing at that line, and you'd know exactly which function to fix.",
    stepsOverlay: { title: "Run the self-test", items: ["Save: Cmd + S (Windows: Ctrl + S)", "Mac: python3 security_utils.py", "Windows: python security_utils.py"], at: "save the file first", hold: 16 },
  },
  (at) => [
    { do: "save", at: at("save the file first", 1, 0.6) },
    { do: "terminal-open", at: at("open a terminal") },
    { do: "term-type", at: at("and type python"), text: "python3 security_utils.py", cps: 10 },
    { do: "term-out", at: at("all checks passed"), lines: SELFTEST },
    MO("all checks passed", at("every assert was")),
  ]
);
B({
  id: "pause4",
  scene: "editor",
  transition: "cut",
  viewTop: 36, // terminal closed, the whole step on screen: guard + asserts, lines 36-50
  prefill: pre(36, 50),
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 5, of: 9 },
  task: "Your turn: the guard + self-test",
  checklist: ['if __name__ == "__main__":', "assert each function's answers", "python3 security_utils.py (Windows: python)"],
  hint: 'Expect: "self-test: all checks passed"',
  narration:
    "Step five. Pause the video now. Add the guard and your asserts, then run the file, with python three, or just python if you're on Windows. Make sure you see all checks passed. Press play when you do.",
});

// ---------------- Scene G: toolkit_main.py
B(
  {
    id: "newfile2",
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 101,
    fileCreate: true,
    fileCreateAt: "and name it",
    fileOpenAt: "it opens next to",
    before: { file: "security_utils.py", lines: pre(37, 50) }, // the finished toolkit stays on screen until the new file opens
    narration:
      "Welcome back. Now the second file. In the Explorer, click the New File icon again, and name it toolkit underscore main dot P Y. It opens next to the first one. See both files in the Explorer, and both tabs at the top? They have to be in the same folder, or the import won't find the toolkit.",
  },
  (at) => [
    { do: "redbox", target: "newfile", at: at("click the new file icon"), hold: 3.3 },
    { do: "redbox", target: "explorer", at: at("see both files"), hold: 3.3 },
    { do: "redbox", target: "tabs", at: at("and both tabs"), hold: 3.3 },
  ]
);
B(
  {
    id: "tm1",
    scene: "editor",
    file: "toolkit_main.py",
    narration:
      "First the header. I'll copy it from security utils, paste it here, and change nothing, since it's the same assignment. Then a blank line, and import security utils. No dot P Y, just the module name. That one line runs the whole toolkit file, which defines our three functions. And because of the guard, the self-test doesn't run.",
  },
  (at) => [
    P(101, 106, at("paste it here")),
    T(108, at("and import security"), 10),
    C(107, at("no dot p y"), "no .py in an import"),
    M(108, "security_utils", at("just the module name")),
    M(108, "import", at("that one line runs")),
  ]
);
B(
  {
    id: "tm2",
    scene: "editor",
    file: "toolkit_main.py",
    narration:
      "Now we call each function. Port equals four forty three. Category equals security utils dot classify port, port. To use a function from a module, it's the module name, a dot, then the function. Then print an f string: port, the port, is, and the category.",
  },
  (at) => [
    T(110, at("port equals")),
    T(111, at("category equals"), 14),
    T(112, at("then print an f string"), 14),
    M(111, "security_utils", at("it's the module name")),
    M(111, ".classify_port", at("a dot then the function")),
    M(112, "{category}", at("and the category")),
  ]
);
B({
  id: "pause5a",
  scene: "editor",
  file: "toolkit_main.py",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 6, of: 9 },
  task: "Your turn: header, import, port check",
  checklist: ["Copy your header from security_utils.py", "import security_utils", "classify_port(port), print it with an f⁠-⁠string"],
  hint: "Same folder as security_utils.py",
  narration:
    "Step six. Pause the video now, and start toolkit main: your header, the import, and the port check, printed with an f-string. Press play when they're in.",
});
B(
  {
    id: "tm3",
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 103,
    prefill: pre(103, 112),
    narration:
      "Same idea for the password. Secret equals hunter two. Masked equals security utils dot mask password, secret. Then print the label, masked password, and the masked value in curly braces. The real password never gets printed, only the masked one.",
  },
  (at) => [
    T(114, at("secret equals")),
    T(115, at("masked equals"), 14),
    T(116, at("then print the label"), 14),
    M(116, "{masked}", at("in curly braces")),
    M(114, "secret", at("the real password never")),
  ]
);
B(
  {
    id: "tm4",
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 112,
    prefill: pre(112, 116),
    narration:
      "Next, a list of events to count. I'll paste these four. Each event is a dictionary, with a severity and a number of attempts. Then failures equals security utils dot count failures, events. We're not passing a threshold, so it uses the default, three. And print the count.",
  },
  (at) => [
    P(118, 123, at("i'll paste these")),
    T(124, at("then failures equals"), 16),
    T(125, "prev+0.2", 16),
    M(119, '{"severity": "high", "attempts": 1}', at("each event is a")),
    M(124, "count_failures(events)", at("we're not passing")),
  ]
);
B({
  id: "pause5b",
  scene: "editor",
  file: "toolkit_main.py",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 7, of: 9 },
  task: "Your turn: mask_password + count_failures",
  checklist: ["mask_password(secret), print it", "The events list + count_failures(events)", "Print each with an f⁠-⁠string"],
  hint: "Type the events list exactly as it is on screen",
  narration:
    "Step seven. Pause the video now, and add the masked password, the events list, and count failures, each printed with an f-string. Press play when they're in.",
});
B(
  {
    id: "tm5",
    say: [[/\bint\b/gi, '"$&"']], // voice-only: quoted "int" was clean here in both Whisper models; unquoted it drifted to ant/ent/into
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 118, // the step-7 pause must show events = [ too
    prefill: pre(118, 125),
    narration:
      "Last, the \"try\" and \"except\". A comment first. Then try, colon. Inside, bad port equals int of not a port. That text can't become a number, so int will raise a value error, and the next line never gets its chance. Except value error as err, colon. As err stores the error, so we can print its message. Then print could not classify port, and the error. Notice we name the exact error type. Never write a bare except. It hides real bugs.",
  },
  (at) => [
    T(127, at("a comment first"), 16),
    T(128, at("then try colon")),
    T(129, at("inside bad port"), 12),
    T(130, at("that text can't"), 16),
    T(131, at("value error as"), 12),
    T(132, at("then print could not"), 14),
    M(129, 'int("not-a-port")', at("that text can't")),
    M(130, "print(security_utils.classify_port(bad_port))", at("and the next line")),
    M(131, "err", at("stores the error", 1, -0.5)),
    M(131, "ValueError", at("the exact error type", 1, -0.6)),
  ]
);
B({
  id: "pause5",
  scene: "editor",
  file: "toolkit_main.py",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 8, of: 9 },
  task: "Your turn: try / except",
  checklist: ['try: bad_port = int("not-a-port")', "print the result of classify_port(bad_port)", "except ValueError as err: print the error"],
  hint: "Catch ValueError, never a bare except:",
  narration:
    "Step eight. Pause the video now, and finish toolkit main with the \"try\" and \"except\". Press play when it's done, and then we'll watch the functions work.",
});

// ---------------- Trace: watch each function run in the VARIABLES panel
B(
  {
    id: "tr0",
    scene: "editor",
    transition: "cut",
    viewTop: 4,
    prefill: pre(4, 15),
    debug: { fontSize: 18, vars: [["port_number", null], ["returns", null]] },
    narration:
      "Now let's play computer and watch each function run. When toolkit main calls classify port with four forty three, Python jumps into the function, and the parameter port number gets four forty three. You can see it in the Variables panel on the left. Line eleven checks the range. Zero is less than or equal to four forty three, and four forty three is less than or equal to ten twenty three, so it's True. Line twelve returns well-known, and the function ends. Lines thirteen to fifteen never run.",
  },
  (at) => [
    { do: "save", all: true, at: 0 }, // a debug session starts: VS Code saves the open files first (debug.saveBeforeStart)
    S(9, at("python jumps into")),
    V("port_number", "443", at("the parameter port")),
    { do: "redbox", target: "debug", at: at("you can see it"), hold: 3.3 },
    S(11, at("line 11 checks")),
    S(12, at("line 12 returns")),
    V("returns", "'well-known'", at("line 12 returns", 1, 0.4)),
    M(11, "0 <= port_number <= 1023", at("line 11 checks")),
    M(12, 'return "well-known"', at("line 12 returns")),
    M(13, "if 1024 <= port_number <= 49151:", at("never run"), { to: 15 }),
  ]
);
B(
  {
    id: "tr1",
    scene: "editor",
    transition: "cut",
    viewTop: 13,
    prefill: pre(13, 23),
    debug: { fontSize: 18, vars: [["pw", null], ["len(pw)", null], ["middle", null], ["returns", null]] },
    narration:
      "Next, mask password with hunter two. P W gets hunter two, and its length is seven. Line twenty checks: is seven less than two? No, so we skip the edge case. Line twenty two builds the middle: seven minus two is five, so five stars. Line twenty three returns h, the five stars, and two. If P W had been a single x, the edge case would have returned two asterisks instead.",
  },
  (at) => [
    S(18, at("next mask underscore")),
    V("pw", "'hunter2'", at("p w gets")),
    V("len(pw)", "7", at("its length is")),
    S(20, at("is 7 less")),
    S(22, at("builds the middle")),
    V("middle", "'*****'", at("so 5 stars")),
    S(23, at("returns h the")),
    V("returns", "'h*****2'", at("returns h the", 1, 0.4)),
    M(20, "len(pw) < 2", at("is 7 less")),
    M(22, "len(pw) - 2", at("7 minus 2")),
    M(23, 'f"{pw[0]}{middle}{pw[-1]}"', at("returns h the")),
    M(21, 'return "**"', at("the edge case would")),
  ]
);
B(
  {
    id: "tr2",
    scene: "editor",
    transition: "cut",
    viewTop: 21,
    prefill: pre(21, 33),
    debug: { fontSize: 17, vars: [["threshold", null], ['e["severity"]', null], ['e["attempts"]', null], ["kept", null], ["returns", null]] },
    narration:
      "Now count failures, called with only the events list. No threshold was passed, so it takes the default, three. The comprehension looks at each event. Event one: severity is high, so the first half of the \"or\" is True. Kept. Event two: severity is low, so Python checks the other side. Attempts is five, more than three. Kept. Event three: low, with two attempts. Both sides are False, so it's skipped. Event four: medium, but twelve attempts. Kept. Three events made it into failures, so the function returns three.",
  },
  (at) => {
    const ev = (n, sev, att, keep, t, t2) => [
      S(29, t), V('e["severity"]', `'${sev}'`, t + 0.1), V('e["attempts"]', String(att), t + 0.1),
      S(30, t + 0.4), ...(t2 != null ? [S(31, t2)] : []),
      ...(keep != null ? [V("kept", keep, (t2 ?? t + 0.4) + 0.6)] : []),
    ];
    return [
      S(26, at("now count failures")),
      V("threshold", "3", at("it takes the default")),
      ...ev(1, "high", 1, "1 event", at("event 1"), null),
      ...ev(2, "low", 5, "2 events", at("event 2"), at("python checks the other")),
      ...ev(3, "low", 2, null, at("event 3"), at("both sides are")),
      ...ev(4, "medium", 12, "3 events", at("event 4"), at("but 12 attempts", 1, -0.4)),
      S(33, at("made it into", 1, -0.9)),
      V("returns", "3", at("returns 3")),
      M(26, "threshold=3", at("it takes the default")),
      M(30, 'e["severity"] == "high"', at("so the first half")),
      M(31, 'e["attempts"] > threshold', at("attempts is 5")),
      M(30, 'e["severity"] == "high"', at("both sides are"), { to: 31 }),
      M(33, "len(failures)", at("made it into", 1, -0.9)),
    ];
  }
);
B(
  {
    id: "tr3",
    say: [[/\bint\b/gi, '"$&"']], // voice-only: quoted "int" was clean here in both Whisper models; unquoted it drifted to ant/ent/into
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 119,
    prefill: pre(119, 132),
    debug: { fontSize: 18, vars: [["failures", "3"], ["bad_port", null], ["err", null]] },
    narration:
      "Last trace, the \"try\" block in toolkit main. Line twenty nine hands the text, not a port, to int. That can't become a number, so int raises a value error. Python stops the \"try\" block right there. Line thirty never runs, and bad port never gets a value. Python jumps to the \"except\" on line thirty one. The error is stored in err, and line thirty two prints our message. The script finishes normally instead of crashing.",
  },
  (at) => [
    S(128, at("last trace")),
    S(129, at("hands the text")),
    S(131, at("python jumps to")),
    V("err", "ValueError", at("the error is stored")),
    S(132, at("prints our message")),
    V("bad_port", "(never set)", at("and bad port never")),
    M(129, 'int("not-a-port")', at("hands the text")),
    M(130, "print(security_utils.classify_port(bad_port))", at("never runs")),
    M(131, "except ValueError as err:", at("python jumps to")),
    M(132, 'print(f"Could not classify port: {err}")', at("prints our message")),
  ]
);
B({
  id: "mistakes",
  scene: "doc",
  doc: {
    tag: "BEFORE YOU SUBMIT · COMMON MISTAKES",
    title: "Five mistakes to check for",
    body: `<ol style="font-size:24px">
<li><b>Printing instead of returning.</b> The main script gets <span class="codename">None</span>. Every toolkit function needs <span class="codename">return</span>.</li>
<li><b><span class="codename">&lt;= 1024</span> for well-known.</b> 1024 is registered. Well-known stops at <b>1023</b>.</li>
<li><b>Skipping the edge case.</b> <span class="codename">mask_password("x")</span> must return <span class="codename">"**"</span>.</li>
<li><b><span class="codename">and</span> instead of <span class="codename">or</span></b> in count_failures. Here it would count <b>0</b>, not 3.</li>
<li><b>The self-test outside the guard.</b> Then it runs on every import. And never a bare <span class="codename">except:</span>.</li>
</ol>
<p style="margin-top:16px">Check your output: <b>well-known · h*****2 · 3 · Could not classify port…</b></p>`,
  },
  narration:
    "Before you submit, here are five mistakes I see a lot on this lab. Number one: printing instead of returning. Then the main script gets None back, so every toolkit function needs a return. Number two: less than or equal to ten twenty four for well-known. Ten twenty four is registered, so well-known stops at ten twenty three. Number three: skipping the edge case. Mask password of a single x has to return two asterisks. Number four: \"and\" instead of \"or\" in count failures. With these events, \"and\" would count zero, not three. And number five: putting the self-test outside the guard, so it runs on every import. And never write a bare except. Then check your output against this line.",
}, (at) => [
    MD("Printing instead of returning.", at("number 1 printing")),
    MD("None", at("gets none back")),
    MD("&lt;= 1024", at("number 2 less")),
    MD("<b>1023</b>", at("so well-known stops")),
    MD("Skipping the edge case.", at("number 3 skipping")),
    MD('mask_password("x")', at("password of a single", 1, -1.0)),
    MD("and", at("number 4 and"), { whole: false }),
    MD("<b>0</b>", at("would count 0")),
    MD("The self-test outside the guard.", at("and number 5")),
    MD("well-known · h*****2 · 3 · Could not classify port…", at("then check your output")),
  ]);
// ---------------- Run the main script
B(
  {
    id: "run1",
    scene: "editor",
    file: "toolkit_main.py",
    transition: "cut",
    viewTop: 126,
    prefill: pre(126, 132),
    terminalMax: true,
    narration:
      "Now let's run the main script and check our predictions. To open a terminal, use the Terminal menu and choose New Terminal, or press Control and backtick. I'll maximize the terminal so the whole output fits. Type python three, space, toolkit underscore main dot P Y, and press Enter. On Windows, type python, space, toolkit underscore main dot P Y instead.",
    stepsOverlay: { title: "Run the main script", items: ["Terminal ▸ New Terminal", "or Ctrl + ` (above Tab)", "Mac: python3 toolkit_main.py", "Windows: python toolkit_main.py"], at: "to open a terminal", hold: 18 },
  },
  (at) => [
    { do: "terminal-open", at: at("i'll maximize") },
    { do: "term-type", at: at("space toolkit"), text: "python3 toolkit_main.py", cps: 9 },
  ]
);
B(
  {
    id: "run1b",
    scene: "editor",
    file: "toolkit_main.py",
    narration:
      "Four lines. Port four forty three is well-known. The masked password is h, five stars, two. Three failures, with the default threshold. And the bad port didn't crash anything. The \"except\" caught the value error and printed its message. Now notice what's missing: the self-test message. Import ran security utils, but dunder name wasn't dunder main, so the guard skipped it. That's the guard doing its job.",
  },
  (at) => [{ do: "term-out", at: 0.6, lines: REPORT, callout: "matches the trace" },
    MO("Port 443 is: well-known", at("4 lines")),
    MO("Masked password: h*****2", at("the masked password")),
    MO("Failures (default threshold): 3", at("3 failures with")),
    MO("Could not classify port: invalid literal for int() with base 10: 'not-a-port'", at("caught the value", 1, -0.4)),
  ]
);
B({
  id: "pause6",
  scene: "editor",
  file: "toolkit_main.py",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 9, of: 9 },
  task: "Your turn: run it, screenshot, submit",
  checklist: ["python3 toolkit_main.py (Windows: python)", "Check: well-known · h*****2 · 3 · error caught", "Upload both .py files + screenshot"],
  hint: "Windows: python toolkit_main.py",
  narration:
    "Step nine. Pause the video now, and run toolkit main, with python three, or just python if you're on Windows. Check your four lines against these. Then take a screenshot of the output, and upload both files and the screenshot to Canvas. Press play when you're done.",
});

B({
  id: "challenge",
  scene: "doc",
  doc: {
    tag: "OPTIONAL CHALLENGE · NOT GRADED",
    title: "Reject impossible ports",
    body: `<p>Real port numbers only go from 0 to 65535. Make <span class="codename">classify_port</span> <b>raise</b> its own error for anything else:</p>
<span class="ex" style="font-size:23px">def classify_port(port_number):
    if not 0 &lt;= port_number &lt;= 65535:
        raise ValueError(f"{port_number} is not a valid port")
    ...</span>
<p style="margin-top:16px">Then call <span class="codename">security_utils.classify_port(70000)</span> inside your <span class="codename">try</span>. Expected output:</p>
<span class="ex" style="font-size:23px">Could not classify port: 70000 is not a valid port</span>`,
  },
  narration:
    "If you finish early and want a challenge, try this one. It's optional and not graded. Port numbers only go up to sixty five thousand five hundred thirty five. So change classify port to raise its own value error for anything outside that range. Raise is how your own code reports a problem, the same way Python reported the bad text earlier. Then call it with seventy thousand inside your \"try\" block. Your \"except\" catches it and prints this line. That's how library code tells the caller something went wrong.",
}, (at) => [
    MD("if not 0 <= port_number <= 65535:", at("so change classify")),
    MD('raise ValueError(f"{port_number} is not a valid port")', at("raise is how")),
    MD("security_utils.classify_port(70000)", at("then call it")),
    MD("Could not classify port: 70000 is not a valid port", at("prints this line")),
  ]);
B({
  id: "recap",
  scene: "doc",
  doc: {
    tag: "RECAP · WHERE EACH ONE SHOWED UP",
    title: "This week's tools in the toolkit",
    body: `<table class="doc-table" style="font-size:23px">
<tr><th>Tool</th><th>Where</th><th>Why it fits</th></tr>
<tr><td><b>def + return</b></td><td>all three functions</td><td>write it once, call it anywhere</td></tr>
<tr><td><b>default value</b></td><td><span class="codename">threshold=3</span></td><td>callers can skip it</td></tr>
<tr><td><b>list comprehension + or</b></td><td><span class="codename">count_failures</span></td><td>filter in one statement</td></tr>
<tr><td><b>import</b></td><td><span class="codename">toolkit_main.py</span></td><td>use the library from another file</td></tr>
<tr><td><b>__name__ guard + assert</b></td><td>bottom of <span class="codename">security_utils.py</span></td><td>self-test on a direct run only</td></tr>
<tr><td><b>try / except ValueError</b></td><td><span class="codename">toolkit_main.py</span></td><td>bad input doesn't crash the script</td></tr>
</table>`,
  },
  narration:
    "Let's recap where each one showed up. Def and return, in all three functions, so you write the logic once and call it anywhere. The default value, threshold equals three. The list comprehension with \"or\", in count failures. Import, in toolkit main, to use the library from another file. The guard and the asserts at the bottom of security utils, so the self-test only runs on a direct run. And \"try\" and \"except\" with a value error, so bad input doesn't crash the script.",
}, (at) => [
    MD("all three functions", at("def and return in")),
    MD("threshold=3", at("the default value")),
    MD("count_failures", at("comprehension with or", 1, 0.8)),
    MD("toolkit_main.py", at("import in toolkit")),
    MD("bottom of <span class=\"codename\">security_utils.py</span>", at("the guard and the asserts")),
    MD("bad input doesn't crash the script", at("so bad input")),
  ]);
B({
  id: "outro",
  scene: "outro",
  narration:
    "That's the modular security toolkit. In the next module, you'll read real log files with these same tools. If you get stuck, reach out, and I'll see you there.",
  outro: {
    headline: "Write it once,",
    accent: "use it everywhere.",
    bullets: ["def + return: write it once, call it anywhere", "threshold=3: a default value", "import security_utils: one library, one driver", "The __name__ guard runs the self-test", "try / except ValueError, never bare except"],
    foot: "Programming for Cybersecurity · Module 7",
  },
});

export default {
  id: "m07-security-toolkit-extended",
  mode: "walkthrough",
  branding: "neutral",
  course: "Programming for Cybersecurity",
  module: "MODULE 7 · LAB 7.6",
  title: {
    hero: "Security",
    accent: "Toolkit.",
    sub: "Extended walkthrough: functions, default values, modules, the main guard and try/except from the ground up, then both files, built live.",
    chip: "EXTENDED WALKTHROUGH",
    ghost: false,
  },
  file: { name: "security_utils.py", lang: "python", folder: "Module7" },
  files: FILES,
  statusRight: "Python 3.13.2",
  // QA editor: each term-out is checked against the file its "python3 <file>.py" command ran
  qa: { program: "toolkit_main.py", runs: [{ stdin: "" }] },
  // voice-only: both Whisper models heard "mass password" in long takes (k dropped), even hyphenated;
  // the identifier said out loud tested clean (A/B 2026-10-14). Captions keep mask_password.
  say: [[/\bmask password\b/gi, "mask underscore password"], [/\berr\b/gi, "E R R"]], // err: the clone read it as "error"
  // captions are built from the SCRIPT (Whisper only times them): map spoken forms → on-screen forms
  captionFixes: [
    ["command s", "Command S"],
    ["control s", "Control S"],
    ["security underscore utils dot P Y", "security_utils.py"],
    ["toolkit underscore main dot P Y", "toolkit_main.py"],
    ["security utils dot P Y", "security_utils.py"],
    ["dot P Y", ".py"],
    ["security utils dot classify port", "security_utils.classify_port"],
    ["security utils dot mask password", "security_utils.mask_password"],
    ["security utils dot count failures", "security_utils.count_failures"],
    ["import security utils", "import security_utils"],
    ["security utils", "security_utils"],
    ["toolkit main", "toolkit_main"],
    ["classify port", "classify_port"],
    ["mask password", "mask_password"],
    ["count failures", "count_failures"],
    ["port number", "port_number"],
    ["bad port", "bad_port"],
    ["Too many takes", "too_many takes"],
    ["too many, five", "too_many, five"],
    ["if dunder name equals equals dunder main", 'if __name__ == "__main__"'],
    ["if dunder name equals dunder main", 'if __name__ == "__main__"'],
    ["I P address dot dunder name", "ipaddress.__name__"],
    ["dunder name", "__name__"],
    ["dunder main", '"__main__"'],
    ["Import I P address, all one word", "import ipaddress"],
    ["I P address dot I P underscore address", "ipaddress.ip_address"],
    ["dot is private", ".is_private"],
    ["I P address", "ipaddress"],
    ["ten dot zero dot zero dot five", IP_PRIVATE],
    ["eight dot eight dot eight dot eight", IP_PUBLIC],
    ["hash lib", "hashlib"],
    ["value error", "ValueError"],
    ["type error", "TypeError"],
    ["assertion error", "AssertionError"],
    ["As err", "as err"],
    ["P W index zero", "pw[0]"],
    ["P W index minus one", "pw[-1]"],
    ["P W", "pw"],
    ["len of P W", "len(pw)"],
    ["hunter two", "hunter2"],
    ["threshold equals three", "threshold=3"],
    ["threshold equals ten", "threshold=10"],
    ["limit equals three", "limit=3"],
    ["limit equals ten thousand", "limit=10000"],
    ["limit equals ten", "limit=10"],
    ["equals equals", "=="],
    ["S S H", "ssh"],
    ["python three", "python3"],
    ["P E P 8", "PEP 8"],
    ["V S Code", "VS Code"],
    ["f string", "f-string"],
    ["snake case", "snake_case"],
    ["Control C", "Ctrl+C"],
    ["four forty three", "443"],
    ["ten twenty three", "1023"],
    ["ten twenty four", "1024"],
    ["forty nine one fifty one", "49151"],
    ["eight thousand eighty", "8080"],
    ["sixty thousand", "60000"],
    ["seventy thousand", "70000"],
    ["sixty five thousand five hundred thirty five", "65535"],
    ["ten thousand", "10000"],
    ["twenty two", "22"],
    ["twenty three", "23"],
  ],
  voice: { engine: "elevenlabs", voiceId: process.env.ELEVENLABS_VOICE_ID, model: "eleven_turbo_v2_5", speed: 1.09 },
  beats: L.beats,
};
