# Refined Card Position Editor Design

## Purpose

Provide a desktop-only editing view for aligning the Refined transparent character artwork over the existing role backgrounds. The editor produces a single copyable configuration covering all 25 cards, so the final card renderer can use the approved placements without manual transcription.

## Fixed Card Rendering

- Artwork: `00_transparent-illustrations-72-a-refined`
- Background: `backgrounds-72`, always enabled
- Composition: character PNG above its role background
- Language: Japanese and English remain switchable
- Card dimensions and typography remain unchanged

## Editor Layout

The gallery remains visible as the working surface. Clicking a card selects it and makes its character layer editable. A desktop side panel shows the selected role and provides:

- A scale slider plus a numeric value
- X and Y numeric offsets in percent
- Reset for the selected role
- Keyboard nudging: arrow keys move one percent; Shift + arrow keys move ten percent
- A status label indicating unsaved adjustments in the current browser session

The selected character can also be dragged directly inside its card. Dragging updates only that role's X/Y values. Mouse-wheel input over the selected card changes scale. Text overlays and the card container do not move.

## Data Model and Copy Contract

Each role uses a compact normalized transform:

```json
{
  "knights": { "scale": 1.08, "x": -3, "y": 2 }
}
```

`scale` is a multiplier; `x` and `y` are percentages of the layer size. The editor starts with the current baseline transform for every role and keeps edits in browser memory. A **Copy all positions** button writes the complete, formatted JSON to the clipboard. A second button resets every role to baseline.

## Safety and Accessibility

- Inputs have explicit labels and visible keyboard focus.
- Copy success and clipboard errors are announced in a live status region.
- Dragging is available with a mouse; numeric controls and arrow-key nudging provide a non-drag alternative.
- The page is optimized for desktop; it does not remove the existing read-only card viewer.

## Validation

- A regression test verifies the fixed Refined/background configuration, transform map, editor controls, and copy contract.
- Existing transparent-variant checks must remain green.
- Parse the inline JavaScript in both HTML files after implementation.
