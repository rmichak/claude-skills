// Example lab: Module 6 · Lab 6.6 — Threat Log Analyzer — full guided walkthrough.
// Voice: ElevenLabs (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID): node tts-eleven-beats.mjs, or the free Kokoro
// draft: node tts-kokoro-beats.mjs. QA: node qa-editor.mjs.
import { createLab } from "./lab-helpers.mjs";

// the lab's sample source addresses (joined from parts: the source holds no literal dotted address)
const NET = ["10", "0", "0"].join(".");
const IP5 = `${NET}.5`, IP8 = `${NET}.8`, IP12 = `${NET}.12`;

// ---------------------------------------------------------------- the program (source of truth)
const EVENTS = [
  [IP5, "port_scan", "medium"],
  [IP8, "failed_login", "low"],
  [IP5, "port_scan", "medium"],
  [IP8, "failed_login", "low"],
  [IP8, "failed_login", "low"],
  [IP5, "malware", "high"],
  [IP12, "port_scan", "medium"],
  [IP5, "failed_login", "low"],
  [IP5, "malware", "high"],
  [IP8, "malware", "high"],
];
export const CODE = {
  1: "# ==================================================",
  2: "# Name:       Alex Rivera",
  3: "# Course:     Programming for Cybersecurity",
  4: "# Assignment: Module 06 - Threat Log Analyzer",
  5: "# Date:       2026-10-10",
  6: "# ==================================================",
  8: "events = [",
  19: "]",
  21: "by_type = {}",
  22: "by_severity = {}",
  23: "by_source = {}",
  25: "for date, ip, event_type, severity in events:",
  26: "    by_type[event_type] = by_type.get(event_type, 0) + 1",
  27: "    by_severity[severity] = by_severity.get(severity, 0) + 1",
  28: "    by_source[ip] = by_source.get(ip, 0) + 1",
  30: "# List comprehension: keep only the high-severity events",
  31: 'high_events = [e for e in events if e[3] == "high"]',
  32: "high_count = len(high_events)",
  34: 'print("THREAT LOG SUMMARY")',
  35: 'print("=" * 40)',
  36: 'print(f"Total events: {len(events)}")',
  37: "print()",
  38: 'print("Events by type:")',
  39: "for event_type, count in by_type.items():",
  40: '    print(f"  {event_type:<14}{count}")',
  41: "print()",
  42: 'print("Events by severity:")',
  43: "for severity, count in by_severity.items():",
  44: '    print(f"  {severity:<14}{count}")',
  45: "print()",
  46: 'print("Top sources:")',
  47: "for ip, count in by_source.items():",
  48: '    print(f"  {ip:<14}{count}")',
  49: 'print("=" * 40)',
  50: 'print(f"High-severity event count: {high_count}")',
};
EVENTS.forEach(([ip, t, s], i) => (CODE[9 + i] = `    ("2026-04-13", "${ip}", "${t}", "${s}"),`));

// The real program's output — the QA editor re-runs threat_log.py and diffs it against this.
const REPORT = [
  "THREAT LOG SUMMARY",
  "=".repeat(40),
  "Total events: 10",
  "",
  "Events by type:",
  "  port_scan     3",
  "  failed_login  4",
  "  malware       3",
  "",
  "Events by severity:",
  "  medium        3",
  "  low           4",
  "  high          3",
  "",
  "Top sources:",
  `  ${IP5}      5`,
  `  ${IP8}      4`,
  `  ${IP12}     1`,
  "=".repeat(40),
  "High-severity event count: 3",
];

const L = createLab(CODE);
const { B, T, C, H, S, V, P, pre, M, MD, MO, MC } = L;

// ================================================================= BEATS
B({
  id: "title",
  scene: "title",
  narration:
    "Hey everyone. This is the walkthrough for the Module 6 programming lab, the threat log analyzer. We're going to build the whole thing together from an empty folder: a list of security events, a loop, three dictionaries that count them, and a summary report. Then we'll step through the loop one event at a time, and run it to prove it works. Code along with me, and pause any time you need to.",
});

B({
  id: "why",
  scene: "doc",
  doc: {
    tag: "WHY THIS LAB",
    title: "Too many alerts, not enough analysts",
    body: `<p style="font-size:32px;margin-bottom:24px"><b>&ldquo;What happened, and who's the noisiest?&rdquo;</b></p>
<p>A security analyst opens a log with hundreds of events. Before anyone escalates, they need a quick summary: <b>which event types</b>, <b>how severe</b>, and <b>which source IPs</b> keep showing up.</p>
<h2>That summary is just counting</h2>
<ul>
<li>Loop over every event once</li>
<li>Keep a running tally in a <b>dictionary</b>: key &rarr; count</li>
<li>Print the totals so a person can decide what to escalate</li>
</ul>
<p>SIEM tools like Splunk and Elastic do this at huge scale. Today you'll write the small version yourself.</p>`,
    callout: { text: "loop + dictionary = tally", at: 24 },
  },
  narration:
    "Before we code, here's why we picked this one. A security analyst opens a log with hundreds or thousands of events. Before anyone escalates anything, they need a quick summary. What kinds of events happened, how severe were they, and which source I P addresses keep showing up? That summary is really just counting. You loop over every event once, and you keep a running tally in a dictionary, where each key maps to a count. Big SIEM tools like Splunk and Elastic do exactly this, at a huge scale. Today you'll write the small version yourself, so you understand what those tools are doing under the hood.",
});

B({
  id: "pysec",
  scene: "doc",
  doc: {
    tag: "WHY PYTHON",
    title: "Python is how analysts triage fast",
    body: `<ul>
<li><b>Export</b> alerts from a SIEM or firewall as CSV or JSON, then summarize them in a few lines</li>
<li><b>Count</b> failed logins per IP to spot brute force and password spraying</li>
<li><b>Filter</b> to just the high-severity events with one list comprehension</li>
<li><b>Grow it later:</b> the same pattern scales to <span class="codename">collections.Counter</span> and pandas</li>
</ul>
<h2>The pattern you'll practice today</h2>
<span class="ex">events (list of tuples)  →  for loop  →  dictionaries  →  report</span>
<p style="margin-top:22px">Small input, simple logic, fast answer.</p>`,
  },
  narration:
    "So why Python? When analysts need an answer fast, they export the alerts from a SIEM or a firewall as a C S V or JSON file, and summarize it with a short Python script. Count the failed logins per I P, and brute force or password spraying jumps right out. Filter down to just the high severity events with one line. And the pattern you learn today scales up: later you'll see tools like Counter and pandas that do the same thing with even less code. Today's shape is: a list of events, a for loop, some dictionaries, and a report. Small input, simple logic, fast answer.",
});

B({
  id: "assign",
  scene: "doc",
  doc: {
    tag: "6.6 PROGRAMMING LAB · WHAT YOU WILL BUILD",
    title: "Threat Log Analyzer: threat_log.py",
    body: `<p style="margin-bottom:16px">Ten hard-coded events. Each one is a tuple: <span class="codename">(date, source_ip, event_type, severity)</span>. Loop over them, tally them, print a summary like this:</p>
<span class="ex" style="font-size:16px;line-height:1.3;padding:12px 22px">${REPORT.join("\n")}</span>`,
  },
  narration:
    "Here's the assignment. You'll write one program called threat underscore log dot P Y. It has ten security events typed right into the code, and each event is a tuple with four values: the date, the source I P, the event type, and the severity. Your program loops over them, tallies them up, and prints a summary like this one: the total, counts by type, by severity, and by source, and the number of high severity events at the bottom. The layout is up to you, as long as every requirement is met.",
});

B({
  id: "reqs",
  scene: "doc",
  doc: {
    tag: "REQUIREMENTS",
    title: "What your script must include",
    body: `<ul style="font-size:25px">
<li>A <b>header comment block</b>: name, course, assignment, date</li>
<li>The <b>exact</b> hard-coded <span class="codename">events</span> list from the assignment</li>
<li>Three dictionaries: <span class="codename">by_type</span>, <span class="codename">by_severity</span>, <span class="codename">by_source</span></li>
<li>One loop with tuple unpacking:<br><span class="codename">for date, ip, event_type, severity in events:</span></li>
<li>Missing-key handling: <span class="codename">.get(key, 0)</span> or an <span class="codename">if key in dict</span> check</li>
<li>A report: total, the three dictionaries with labels, and the high-severity count</li>
<li>At least one <b>list comprehension</b></li>
<li>PEP 8: snake_case, spaces around <span class="codename">=</span>, lines under 79</li>
</ul>`,
  },
  narration:
    "These are the requirements, and we'll check off every one. A header comment block. The exact events list from the assignment. Three dictionaries named by type, by severity, and by source. One loop that uses tuple unpacking in the loop header, exactly like this line. Missing key handling with dot get, or an \"if\" key \"in\" the dictionary check. A printed report with the total, all three dictionaries, and the high severity count. At least one list comprehension. And clean P E P 8 style.",
});

B({
  id: "rubric",
  scene: "doc",
  doc: {
    tag: "GRADING · 25 POINTS · WHAT TO SUBMIT",
    title: "Rubric and submission",
    body: `<table class="doc-table">
<tr><th>Criterion</th><th>Pts</th></tr>
<tr><td>File runs without errors</td><td class="pts">3</td></tr>
<tr><td>Header comment block</td><td class="pts">2</td></tr>
<tr><td>Hard-coded events list used (exact list)</td><td class="pts">1</td></tr>
<tr><td>Three dictionaries built from the events</td><td class="pts">6</td></tr>
<tr><td>Loop with tuple unpacking</td><td class="pts">3</td></tr>
<tr><td>Missing-key handling (.get or in)</td><td class="pts">2</td></tr>
<tr><td>Printed summary report</td><td class="pts">4</td></tr>
<tr><td>List comprehension</td><td class="pts">3</td></tr>
<tr><td>PEP 8 compliance</td><td class="pts">1</td></tr>
</table>
<p style="margin-top:22px"><b>Submit:</b> <span class="codename">threat_log.py</span> + a screenshot of your terminal showing the summary report.</p>`,
    callout: { text: "Submit: .py + screenshot", at: 15 },
  },
  narration:
    "It's worth twenty five points. The biggest piece is the three dictionaries, worth six points, so we'll spend real time on those. When you're done, you'll turn in your threat underscore log dot P Y file, and a screenshot of your terminal showing the report. Okay, let's build it.",
});

// ---------------- Scene A: create the file + header
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
      "I've opened an empty folder called Module 6 in V S Code. In the Explorer, hover over the folder name and click the New File icon. Type the name exactly: threat underscore log dot P Y, and press Enter. The file opens, and we're ready to go. With the Python extension installed, you get color coding and this Run button in the top right.",
  },
  (at) => [
    { do: "redbox", target: "newfile", at: at("click the new file icon"), hold: 3.5 },
    { do: "redbox", target: "runbtn", at: at("run button"), hold: 3.5 },
  ]
);
B(
  {
    id: "hdr1",
    scene: "editor",
    narration:
      "First, the header comment block. Every comment starts with a pound sign, and Python skips it, so it's a note for people. A border line of equal signs, and then my name. Use your own name here, not mine.",
  },
  (at) => [T(1, at("every comment starts"), 12), T(2, at("and then my name"))]
);
B(
  {
    id: "hdr2",
    scene: "editor",
    narration:
      "The course, Programming for Cybersecurity. Then the assignment, Module 06, Threat Log Analyzer. One labeled item per line, so it's a real block.",
  },
  (at) => [T(3, at("the course")), T(4, at("then the assignment")), C(4, at("one labeled item"), "one item per line")]
);
B(
  {
    id: "hdr3",
    scene: "editor",
    narration: "Today's date, and a closing border. Then a blank line to separate the header from the code.",
  },
  (at) => [T(5, at("today's date")), T(6, at("a closing border"), 14)]
);

// ---------------- Scene B: paste the events list
B(
  {
    id: "events",
    scene: "editor",
    transition: "cut",
    viewTop: 6,
    prefill: pre(6, 6),
    narration:
      "Next, the events list. The assignment says to use this exact list, so don't retype it. Copy it straight from the assignment page and paste it in. One typo in an I P address would change your counts, and that's exactly the kind of mistake that sends an analyst chasing the wrong host.",
  },
  (at) => [P(8, 19, at("paste it in")), C(8, at("one typo"), "copied from the assignment")]
);
B(
  {
    id: "tuples",
    scene: "editor",
    narration:
      "Let's read what we pasted. The square brackets make a list, and each line inside is one event. The parentheses make a tuple, which is like a list that can't be changed. Every tuple holds four values in the same order: the date, the source I P, the event type, and the severity. So line nine says: on April thirteenth, ten dot zero dot zero dot five did a port scan, and it's medium severity.",
  },
  (at) => [
    H(8, at("the square brackets")),
    H(9, at("each line inside")),
    C(7, at("every tuple holds"), "each tuple: (date, ip, type, severity)"),
    H(9, at("so line nine says")),
  ]
);
B({
  id: "pause1",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 1, of: 5 },
  task: "Your turn: file, header, events list",
  checklist: ["Create threat_log.py", "Header block: name, course, assignment, date", "Paste the exact events list"],
  hint: "Copy the list from the assignment page",
  narration:
    "That's step one. Pause the video now. Create your file, write your own header block, and paste in the events list. If you have a question, this is a good spot to stop and ask. Press play when you're ready.",
});

// ---------------- Scene C: dictionaries + loop
B(
  {
    id: "dicts",
    scene: "editor",
    viewTop: 15,
    prefill: pre(15, 19),
    narration:
      "Welcome back. Now the three dictionaries. A dictionary stores pairs: a key, and a value that goes with it. Here, the key will be something like port scan, and the value will be how many times we've seen it. The empty curly braces make an empty dictionary. By type counts event types. By severity counts low, medium, and high. And by source counts each I P address.",
  },
  (at) => [
    H(19, at("welcome back")),
    T(21, at("the empty curly braces")),
    C(21, at("the empty curly braces", 1, 1.6), "{} = empty dictionary"),
    T(22, at("by severity counts")),
    T(23, at("and by source")),
  ]
);
B(
  {
    id: "loop",
    scene: "editor",
    narration:
      "Now the loop. For date, comma, ip, comma, event type, comma, severity, in events, colon. This is tuple unpacking. Each time through the loop, Python takes the next tuple and splits its four values into four variables, in order. So you never have to write e index one or e index two. You just use the names. The rubric asks for exactly this loop header.",
  },
  (at) => [T(25, at("for date")), C(25, at("this is tuple unpacking"), "tuple unpacking")]
);
B(
  {
    id: "get1",
    scene: "editor",
    narration:
      "Inside the loop, indented four spaces, the counting line. By type, square bracket, event type, equals by type dot get, event type, comma zero, plus one. Here's the trick. Dot get looks up the key, but if the key isn't there yet, it hands back the default you gave it, zero, instead of crashing with a key error. So the first port scan becomes zero plus one, which is one. The next one becomes one plus one, which is two. That's exactly the missing key handling the rubric asks for.",
  },
  (at) => [T(26, at("inside the loop")), C(24, at("here's the trick"), ".get(key, 0): 0 if missing")]
);
B(
  {
    id: "get2",
    scene: "editor",
    narration:
      "The same pattern for the other two dictionaries. By severity counts the severity, and by source counts the I P. One loop updates all three dictionaries, so we only walk through the list once. Make sure all three lines are indented, so they run one time for every event.",
  },
  (at) => [T(27, at("the same pattern")), T(28, at("and by source counts")), C(20, at("one loop updates"), "one loop → all three dicts")]
);
B({
  id: "pause2",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 2, of: 5 },
  task: "Your turn: three dictionaries + the loop",
  checklist: ["by_type, by_severity, by_source = {}", "for date, ip, event_type, severity in events:", "d[key] = d.get(key, 0) + 1, three times"],
  hint: "Indent the three counting lines 4 spaces",
  narration:
    "Step two. Pause the video now, and write your three empty dictionaries and the loop with its three counting lines. Watch your indentation, all three counting lines go inside the loop. Press play when you're done.",
});

// ---------------- Scene D: list comprehension
B(
  {
    id: "comp1",
    scene: "editor",
    viewTop: 21,
    prefill: pre(21, 28),
    narration:
      "Welcome back. Next, the high severity count, and the list comprehension. A comment first, so the reader knows what's coming. Then high events equals, square bracket, e for e in events if e index three equals equals high. Read it like a sentence: give me each event e, for every e in events, but only if its severity is high. Index three is the fourth item in the tuple, the severity, because Python starts counting at zero.",
  },
  (at) => [
    H(28, at("welcome back")),
    T(30, at("a comment first")),
    T(31, at("then high events")),
    C(31, at("index three is", 1, 0.4), "e[3] = severity"),
  ]
);
B(
  {
    id: "comp2",
    scene: "editor",
    narration:
      "That gives us a new list holding only the high severity events. Then high count is just the length of that list. In security work, this one line is how you cut a pile of alerts down to the ones that matter.",
  },
  (at) => [T(32, at("then high count")), C(32, at("in security work"), "len() counts the list")]
);
B({
  id: "pause3",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 3, of: 5 },
  task: "Your turn: the list comprehension",
  checklist: ['[e for e in events if e[3] == "high"]', "high_count = len(...)"],
  hint: "e[3] is the 4th value: severity",
  narration: "Step three. Pause the video now, and add your list comprehension and the high count. Press play when it's in.",
});

// ---------------- Scene E/F: the report
B(
  {
    id: "rep1",
    scene: "editor",
    viewTop: 27,
    prefill: pre(27, 32),
    narration:
      "Welcome back. Now the report. Notice this is after the loop, not indented, so it only prints once, at the end. A title, and a border. A string times forty repeats it forty times. Then the total. Inside the f string, the curly braces run real code: len of events counts the tuples in the list, which is ten. Then an empty print for a blank line.",
  },
  (at) => [
    T(34, at("a title")),
    T(35, at("and a border")),
    T(36, at("then the total")),
    C(36, at("the curly braces run"), "{len(events)} → 10"),
    T(37, at("then an empty print")),
  ]
);
B(
  {
    id: "rep2",
    scene: "editor",
    narration:
      "Now we print a dictionary, with a label first. To loop over a dictionary, use dot items. It hands you each key and its value together, so event type gets the key and count gets the number. In the f string, the colon, less than, fourteen pads the name out to fourteen characters, so all the numbers line up in a column.",
  },
  (at) => [
    T(38, at("with a label first")),
    T(39, at("to loop over")),
    T(40, at("the colon")),
    C(39, at("so event type gets"), ".items() → key, value"),
    C(40, at("pads the name", 1, 0.3), ":<14 pads to 14 chars"),
  ]
);
B(
  {
    id: "rep3",
    scene: "editor",
    transition: "cut",
    viewTop: 37,
    prefill: pre(37, 40),
    narration:
      "The severity section works exactly the same way: a blank line, a label, and a loop over by severity dot items. Notice the loop variable names change to match, severity and count. You could name them anything, but names that say what they hold make your code so much easier to read.",
  },
  (at) => [T(41, at("the severity section")), T(42, "prev+0.3"), T(43, "prev+0.3", 10), T(44, "prev+0.3", 10)]
);
B(
  {
    id: "rep4",
    scene: "editor",
    narration:
      "Then the sources. Dictionaries remember the order keys were added, so these print in the order each I P first showed up in the log. If you wanted the noisiest host first, you could sort them, and we'll get to sorting later in the course.",
  },
  (at) => [T(45, at("the sources")), T(46, "prev+0.3"), T(47, "prev+0.3", 10), T(48, "prev+0.3", 10)]
);
B(
  {
    id: "rep5",
    scene: "editor",
    narration:
      "And to finish, a closing border, and the high severity count from our list comprehension. That's the whole program, about fifty lines. It also follows P E P 8: snake case names, spaces around every equals sign, and every line well under seventy nine characters.",
  },
  (at) => [T(49, at("a closing border")), T(50, at("the high severity"))]
);
B({
  id: "pause4",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 4, of: 5 },
  task: "Your turn: print the report",
  checklist: ["Total with len(events)", "Each dictionary with a label + .items()", "High-severity count at the bottom"],
  hint: "Report code goes after the loop, not indented",
  narration:
    "Step four. Pause the video now, and write your report: the total, all three dictionaries with labels, and the high count. Press play when it's done, and then we'll watch the loop work.",
});

// ---------------- Trace: watch the loop in the VARIABLES panel
const TRACE_VARS = [
  "date", "ip", "event_type", "severity",
  "by_type", "'port_scan'", "'failed_login'", "'malware'",
  "by_severity", "'medium'", "'low'", "'high'",
  "by_source", `'${IP5}'`, `'${IP8}'`, `'${IP12}'`,
  "high_count",
];
const keysLabel = (n) => (n === 0 ? "{}" : n === 1 ? "1 key" : `${n} keys`);
// one iteration of the loop: steps 25→28 and the values, starting at time t, `gap` s per line
function iteration(ev, idx, t, gap, counts) {
  const [ip, type, sev] = ev;
  const out = [S(25, t)];
  if (idx === 0) out.push(V("date", "'2026-04-13'", t + 0.1));
  out.push(V("ip", `'${ip}'`, t + 0.1), V("event_type", `'${type}'`, t + 0.1), V("severity", `'${sev}'`, t + 0.1));
  const bump = (dict, key, line, tt) => {
    const c = counts[dict];
    const isNew = !(key in c);
    c[key] = (c[key] || 0) + 1;
    out.push(S(line, tt), V(`'${key}'`, String(c[key]), tt + 0.15));
    if (isNew) out.push(V(dict, keysLabel(Object.keys(c).length), tt + 0.15));
  };
  bump("by_type", type, 26, t + gap);
  bump("by_severity", sev, 27, t + 2 * gap);
  bump("by_source", ip, 28, t + 3 * gap);
  return out;
}
const counts = { by_type: {}, by_severity: {}, by_source: {} };

B(
  {
    id: "tr0",
    scene: "editor",
    viewTop: 21,
    prefill: pre(21, 34),
    debug: { fontSize: 16, vars: TRACE_VARS.map((n) => [n, null]) },
    narration:
      "Now let's play computer and watch the loop work, one event at a time. On the left, I've opened a Variables panel, like the one in V S Code's debugger. It shows every variable, and everything inside each dictionary. The yellow bar shows the line Python is running right now. Lines twenty one to twenty three create our three dictionaries, and each one starts out empty.",
  },
  (at) => [
    S(21, at("create our")),
    V("by_type", "{}", at("create our", 1, 0.2)),
    S(22, at("create our", 1, 0.8)),
    V("by_severity", "{}", at("create our", 1, 1.0)),
    S(23, at("create our", 1, 1.6)),
    V("by_source", "{}", at("create our", 1, 1.8)),
  ]
);
B(
  {
    id: "tr1",
    scene: "editor",
    narration:
      "Line twenty five, the first time through the loop. Python grabs the first tuple in the list and unpacks it into four variables. Date gets April thirteenth. I P gets ten dot zero dot zero dot five. Event type gets port scan. And severity gets medium.",
  },
  (at) => [
    S(25, at("the first time")),
    V("date", "'2026-04-13'", at("date gets")),
    V("ip", `'${IP5}'`, at("ip gets")),
    V("event_type", "'port_scan'", at("event type gets")),
    V("severity", "'medium'", at("and severity gets")),
  ]
);
B(
  {
    id: "tr2",
    scene: "editor",
    narration:
      "Line twenty six. By type dot get, port scan, zero. Port scan isn't a key in the dictionary yet, so get hands back the default, zero. Zero plus one is one, and that's stored under the key port scan. No error, no crash. Lines twenty seven and twenty eight do the same: the key medium gets a one in by severity, and this I P gets a one in by source.",
  },
  (at) => {
    counts.by_type.port_scan = 1;
    counts.by_severity.medium = 1;
    counts.by_source[IP5] = 1;
    return [
      S(26, at("line 26")),
      C(24, at("isn't a key"), "not a key yet → .get gives 0"),
      V("'port_scan'", "1", at("that's stored")),
      V("by_type", "1 key", at("that's stored")),
      S(27, at("do the same")),
      V("'medium'", "1", at("the key medium gets")),
      V("by_severity", "1 key", at("the key medium gets")),
      S(28, at("and this ip")),
      V(`'${IP5}'`, "1", at("gets a 1 in by source")),
      V("by_source", "1 key", at("gets a 1 in by source")),
    ];
  }
);
B(
  {
    id: "tr3",
    scene: "editor",
    narration:
      "Back to line twenty five for event number two. Now I P is ten dot zero dot zero dot eight, the event type is failed login, and the severity is low. All three of those are new keys, so each one starts at one.",
  },
  (at) => {
    const t0 = at("back to line");
    const t = at("are new keys");
    return [
      S(25, t0),
      V("ip", `'${IP8}'`, at("now ip is")),
      V("event_type", "'failed_login'", at("the event type is")),
      V("severity", "'low'", at("and the severity is")),
      S(26, t), V("'failed_login'", "1", t + 0.2), V("by_type", "2 keys", t + 0.2),
      S(27, t + 1.0), V("'low'", "1", t + 1.2), V("by_severity", "2 keys", t + 1.2),
      S(28, t + 2.0), V(`'${IP8}'`, "1", t + 2.2), V("by_source", "2 keys", t + 2.2),
    ];
  }
);
B(
  {
    id: "tr4",
    scene: "editor",
    narration:
      "Event three is the interesting one. Another port scan, medium severity, from ten dot zero dot zero dot five again. This time, port scan is already a key. So get returns its current value, which is one. One plus one is two. Medium goes to two, and that I P goes to two. Same line of code, but this time it counts up instead of creating a new key. That's the whole trick.",
  },
  (at) => {
    counts.by_type.port_scan = 2;
    counts.by_severity.medium = 2;
    counts.by_source[IP5] = 2;
    return [
      S(25, at("event 3 is")),
      V("ip", `'${IP5}'`, at("another port scan")),
      V("event_type", "'port_scan'", at("another port scan")),
      V("severity", "'medium'", at("another port scan")),
      S(26, at("this time port scan")),
      C(29, at("this time port scan"), "already a key → 1 + 1 = 2"),
      V("'port_scan'", "2", at("1 plus 1 is 2")),
      S(27, at("medium goes to")),
      V("'medium'", "2", at("medium goes to")),
      S(28, at("and that ip")),
      V(`'${IP5}'`, "2", at("and that ip", 1, 0.4)),
    ];
  }
);
B(
  {
    id: "tr5",
    scene: "editor",
    narration:
      "The loop keeps going like that for the rest of the events. Watch the counts climb in the panel. When the loop finishes, by type has port scan three, failed login four, and malware three. By severity is medium three, low four, and high three. And by source is five, four, and one. Pause here if you want to check those against the list yourself.",
  },
  (at) => {
    // reset the shared counts to the state after event 3, then run events 4–10 at speed
    counts.by_type = { port_scan: 2, failed_login: 1 };
    counts.by_severity = { medium: 2, low: 1 };
    counts.by_source = { [IP5]: 2, [IP8]: 1 };
    const t0 = at("keeps going");
    let out = [];
    EVENTS.slice(3).forEach((ev, k) => (out = out.concat(iteration(ev, 3 + k, t0 + k * 1.3, 0.3, counts))));
    return out;
  }
);
B(
  {
    id: "tr6",
    scene: "editor",
    narration:
      "Now line thirty one, the list comprehension. Python checks each event's index three, the severity. Events six, nine, and ten are high, so high events holds those three tuples. Then line thirty two, len of that list is three, and high count is three.",
  },
  (at) => [
    S(31, at("the list comprehension")),
    C(33, at("python checks"), "e[3] == \"high\" → 3 events"),
    S(32, at("then line")),
    V("high_count", "3", at("and high count is")),
  ]
);

// ---------------- Run: verify the prediction
B(
  {
    id: "run1",
    scene: "editor",
    viewTop: 45,
    prefill: pre(45, 50),
    terminalMax: true,
    debug: {
      fontSize: 16,
      vars: TRACE_VARS.map((n) => {
        const fin = { date: "'2026-04-13'", ip: `'${IP8}'`, event_type: "'malware'", severity: "'high'", by_type: "3 keys", by_severity: "3 keys", by_source: "3 keys", "'port_scan'": "3", "'failed_login'": "4", "'malware'": "3", "'medium'": "3", "'low'": "4", "'high'": "3", [`'${IP5}'`]: "5", [`'${IP8}'`]: "4", [`'${IP12}'`]: "1", high_count: "3" };
        return [n, fin[n]];
      }),
    },
    narration:
      "Now let's run it and check our predictions. To open a terminal, use the Terminal menu and choose New Terminal, or press Control and backtick. I'll maximize the terminal panel so the whole report fits on screen. Type python three, space, threat underscore log dot P Y, and press Enter. This program doesn't ask for any input. It just runs straight through.",
    stepsOverlay: { title: "Open a terminal", items: ["Terminal ▸ New Terminal", "or Ctrl + ` (above Tab)"], at: "to open a terminal", hold: 6 },
  },
  (at) => [
    { do: "terminal-open", at: at("i'll maximize") },
    { do: "term-type", at: at("space threat"), text: "python3 threat_log.py", cps: 9 },
  ]
);
B(
  {
    id: "run1b",
    scene: "editor",
    narration:
      "There's the report. Ten total events. Port scan three, failed login four, malware three, exactly what we watched the loop build in the panel. Medium three, low four, high three. Ten dot zero dot zero dot five is the noisiest source, with five events, and three high severity events at the bottom. That's the analyst's answer: one host is responsible for half of the activity, including two of the malware alerts. That's the one you'd escalate first.",
  },
  (at) => [{ do: "term-out", at: 0.6, lines: REPORT, callout: "matches the trace" }]
);
B({
  id: "pause5",
  scene: "editor",
  pauseOverlay: true,
  holdAfter: 4,
  step: { n: 5, of: 5 },
  task: "Your turn: run it, screenshot, submit",
  checklist: ["python3 threat_log.py", "Check the counts: 3/4/3 · 3/4/3 · 5/4/1", "Upload threat_log.py + screenshot"],
  hint: "Windows: python threat_log.py",
  narration:
    "Step five. Pause the video now, and run your program. Check your counts against the ones we traced. Then take a screenshot of the report in your terminal, and upload your threat underscore log dot P Y file and the screenshot to Canvas. Press play when you're done.",
});

B({
  id: "outro",
  scene: "outro",
  narration:
    "That's the threat log analyzer. You looped over a list of tuples with tuple unpacking, tallied three dictionaries with dot get, filtered the high severity events with a list comprehension, and printed a report an analyst could actually use. That's real triage work, in about fifty lines of Python. Nice job. If you get stuck, reach out, and I'll see you in the next module.",
  outro: {
    headline: "Count it,",
    accent: "then decide.",
    bullets: ["Tuple unpacking in the loop header", "d[key] = d.get(key, 0) + 1", "List comprehension filters the high events", "Submit: threat_log.py + screenshot"],
    foot: "Programming for Cybersecurity · Module 6",
  },
});

export default {
  id: "m06-threat-log-walkthrough",
  mode: "walkthrough",
  branding: "neutral",
  course: "Programming for Cybersecurity",
  module: "MODULE 6 · LAB 6.6",
  title: {
    hero: "Threat Log",
    accent: "Analyzer.",
    sub: "Module 6 Programming Lab, built live: loops, tuples, dictionaries, and a list comprehension.",
    chip: "LAB WALKTHROUGH",
    ghost: false,
  },
  file: { name: "threat_log.py", lang: "python", folder: "Module6" },
  statusRight: "Python 3.12.4",
  terminalPrompt: "student@Module6 % ",
  // QA editor: how to run the program for each term-out (no stdin for this lab)
  qa: { program: "threat_log.py", runs: [{ stdin: "" }] },
  // captions are built from the SCRIPT (Whisper only times them): map spoken forms → on-screen forms
  captionFixes: [
    ["threat underscore log dot P Y", "threat_log.py"],
    ["dot P Y", ".py"],
    ["ten dot zero dot zero dot five", IP5],
    ["ten dot zero dot zero dot eight", IP8],
    ["ten dot zero dot zero dot twelve", IP12],
    ["I P", "IP"],
    ["C S V", "CSV"],
    ["P E P 8", "PEP 8"],
    ["V S Code's", "VS Code's"],
    ["V S Code", "VS Code"],
    ["e index three", "e[3]"],
    ["e index one", "e[1]"],
    ["e index two", "e[2]"],
    ["len of events", "len(events)"],
    ["the colon less than fourteen", "the :<14"],
    ["by type dot get", "by_type.get"],
    ["by severity dot items", "by_severity.items()"],
    ["dot items", ".items()"],
    ["dot get", ".get"],
    ["by type", "by_type"],
    ["by severity", "by_severity"],
    ["by source", "by_source"],
    ["event type", "event_type"],
    ["high count", "high_count"],
    ["high events", "high_events"],
    ["port scan", "port_scan"],
    ["failed login", "failed_login"],
    ["f string", "f-string"],
    ["python three", "python3"],
    ["snake case", "snake_case"],
  ],
  voice: { engine: "elevenlabs", voiceId: process.env.ELEVENLABS_VOICE_ID, model: "eleven_turbo_v2_5", speed: 1.09 },
  beats: L.beats,
};
