# Transparent Card Composite Variants

## Goal

Let the gallery and the detail viewer compose the supplied Lifelike and Refined character artwork over the existing role backgrounds.

## Implementation

1. Keep the existing `STYLE` × `MODE` gallery controls and use their selected state when opening the detail viewer.
2. Add `lifelike-trans` and `refined-trans` detail-viewer options, mapping each option to its supplied character folder.
3. Render Refined art directly from its alpha PNGs.
4. Render Lifelike art through a one-time browser canvas pass that removes the supplied blue-screen pixels, then draw the resulting transparent image above the role background.
5. Cache-bust both character and background URLs, and make the blue-key render cancellable when a role/style changes.

## Verification

Run `bash tests/card_transparent_variants_test.sh`, then visually check the Knights card in both composite variants and open it from the gallery.
