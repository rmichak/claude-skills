# Logo (placeholder)

This example brand ships **no logo**. To add yours:

1. Put the file in your brand folder, e.g. `logo.svg` (SVG preferred; PNG with a transparent background works).
2. Point `brand.json` at it: `"assets": { "lockup_light": "logo.svg", "lockup_dark": "logo.svg" }` and
   `"video": { "logo": "logo.svg" }`.
3. **Mode A (title card):** copy it into the build folder and set `TITLE_CARD.logo: "logo.svg"` in `build-data.mjs`.
4. **Mode B (slide lectures):** the logo the slides show comes from the deck's own template folder (whatever the
   deck links as `../../_template/<file>`); `build-module.sh --template <dir>` copies those images into `assets/`.

Only use a logo you have the right to use.
