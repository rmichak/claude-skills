# Design — course video overlay

This is the overlay system for a full-frame screen recording: a title card, closed captions and fly-in note
panels. The colours and fonts come from the brand folder's `brand.json`. `build-data.mjs` writes them into the
`BRAND` block of `index.html`. Without a brand file, the template's neutral slate/blue palette applies.

## Palette (CSS variables)

| Variable          | From `brand.json` `video.palette`        | Use                                                     |
| ----------------- | ---------------------------------------- | ------------------------------------------------------- |
| `--brand-bright`  | `primary`                                | Title gradient top                                      |
| `--brand-mid`     | mix of `primary` + `primary_dark`        | Title gradient middle                                   |
| `--brand-deep`    | `primary_dark`                           | Title gradient bottom                                   |
| `--brand-hill`    | `primary_dark`                           | The hill shape on the title card                        |
| `--brand-shadow`  | `primary_dark`, darkened                 | Deepest shadow / hill bottom                            |
| `--accent`        | `accent`                                 | Borders, dividers, the title-card rule                  |
| `--accent-bright` | `accent_bright`                          | Kickers, note titles, bullets (screen-bright accent)    |
| `--term`          | `term_green`                             | Terminal/mono accent (prompt, syntax/example blocks)    |
| `--panel-top/bottom` | `primary_dark` darkened → `canvas`    | Note-panel background (dark, so accent/mono text reads) |
| `--font-sans`     | `fonts.display`                          | Titles, body, captions                                  |
| `--font-mono`     | `fonts.mono`                             | Code, commands, terminal                                |

The screen recording is the canvas for the body. Overlays sit on top.

## Typography

- **Display / titles:** the brand sans, bold (700–800). Use a font the renderer can embed. Put the .woff2 files
  in the build's `fonts/` (the template's `@font-face` rules load `Inter-Variable.woff2` and
  `JetBrainsMono-Variable.woff2`; edit them for other faces). Arial is not embeddable, so it warns and falls back.
- **Body / captions:** the same sans, 600 weight.
- **Code / commands / terminal:** the brand mono.

## Captions (tutorial tone, basic CC)

- Bottom-centre area in a full-width absolute container. **White text on a semi-opaque black box** (no colour),
  painted on **word by word** as spoken.
- 50px, 600 weight, left-aligned within the box. One line/group at a time, with a hard `tl.set` kill at the end.

## Note panels (floating overlay, top-right)

- About 520px wide, top-right with a ~64px inset. Dark panel background, 3–4px **accent** left border, 18px
  radius, layered shadow.
- Unified card. Show only the fields a note provides: kicker · title (accent mono if `code`, else white sans
  bold) · subtitle · summary · Syntax/Example mono blocks · key/value rows · bullets · note.
- Slide and fade in from the right (expo.out 0.4s), hold while the topic is discussed, then slide and fade out.
  One panel at a time. Inactive panels are `visibility:hidden`, which keeps the WCAG checker honest and out of
  the video's way.

## Title card

A brand gradient with a radial accent glow and an optional oversized ghost watermark (`TITLE_CARD.ghost`, e.g.
the course code). Then an optional logo (`TITLE_CARD.logo`), the kicker, title and subtitle, an optional mono
prompt line with a blinking cursor, an accent divider, and corner registration marks. It runs about 4s and
crossfades into the recording.

## Do's and Don'ts

- **Do** keep the screen recording full-resolution and predominant. Overlays are accents.
- **Do** use the accent for note titles and borders, and the brand primary for structure.
- **Don't** invent colours outside the brand palette, or colour the captions (basic black and white).
- **Don't** cover the active area of the recording. Float notes top-right, captions at the bottom.
- **Don't** let two notes or two caption groups show at once.
