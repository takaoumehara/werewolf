import React from "react";
// Lucide line icons (1.5px stroke). Requires <script src="https://unpkg.com/lucide@latest"></script> on the page.
// name は PascalCase (例: "Moon", "WifiOff")。意味はラベル併記が原則。
export function Icon({ name, size = 20, color = "currentColor", strokeWidth = 1.5, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const lib = window.lucide;
    if (lib && lib.icons && lib.icons[name] && lib.createElement) {
      const svg = lib.createElement(lib.icons[name]);
      svg.setAttribute("width", size); svg.setAttribute("height", size);
      svg.setAttribute("stroke-width", strokeWidth);
      el.appendChild(svg);
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} aria-hidden="true" style={{ display: "inline-flex", width: size, height: size, color, flex: "none", ...style }} />;
}
