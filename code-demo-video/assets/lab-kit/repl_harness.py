"""repl_harness.py: run single-line statements the way the Python 3.13 interactive shell does.

stdin:  JSON list of statements (one per >>> prompt)
stdout: JSON list, one string per statement: exactly what the REPL would print after it
        (expression results via repr, print() output, or a 3.13-style traceback with the source
        line and ~~^^ markers, file name "<python-input-N>").
Used by lab-helpers.mjs (so the video's shell output is REAL) and by qa-editor.mjs (re-check).
"""
import contextlib
import io
import json
import linecache
import sys
import traceback

req = json.load(sys.stdin)
# {"stmts": [...], "vars": true} also returns the session's variables (name -> repr) after the last
# statement, for the shell beats' Variables panel (5.6 extended: students lost track of `ports`)
want_vars = isinstance(req, dict) and req.get("vars")
stmts = req["stmts"] if isinstance(req, dict) else req
env = {"__name__": "__main__"}
outs = []
for n, src in enumerate(stmts):
    fname = f"<python-input-{n}>"
    linecache.cache[fname] = (len(src), None, [src + "\n"], fname)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            code = compile(src + "\n", fname, "single")  # trailing newline = the blank line that ends a compound statement
            exec(code, env)
        except Exception as e:  # noqa: BLE001 - mirror the REPL, which prints any error
            tb = e.__traceback__.tb_next  # drop this harness frame
            lines = traceback.format_exception(type(e), e, tb)
            buf.write("".join(lines))
    outs.append(buf.getvalue().rstrip("\n"))
if want_vars:
    import types
    def show(v):
        # functions and modules: a stable label (their repr has a memory address or a file path)
        if isinstance(v, types.FunctionType):
            return f"<function {v.__name__}>"
        if isinstance(v, types.ModuleType):
            return f"<module {v.__name__}>"
        return repr(v)
    shown = {k: show(v) for k, v in env.items()
             if not k.startswith("_") and not isinstance(v, type)}
    json.dump({"outs": outs, "vars": shown}, sys.stdout)
else:
    json.dump(outs, sys.stdout)
