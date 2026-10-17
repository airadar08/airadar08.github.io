// Bridge between the plain-JS AI Radar app and @samasante/liquid-glass (a React component).
// Bundled with React into ../app-beta/vendor/glass.js by `pnpm build`; the app calls
//   AIRadarGlass.wrap(element, { display, tint, optics })
// which turns an existing element into a liquid-glass surface. The element keeps its id, attributes and
// event listeners (it becomes a `display:contents` host); its class moves onto the Glass box, and its
// original child nodes are moved inside the glass unchanged, so the app's own code keeps working.
import React, { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Glass } from "@samasante/liquid-glass";

function Slot({ nodes }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    nodes.forEach((n) => ref.current.appendChild(n));
  }, []);
  return <span ref={ref} style={{ display: "contents" }} />;
}

function wrap(el, opts = {}) {
  if (!el || el.__glass) return false;
  el.__glass = true;
  const cls = el.className;
  const nodes = [...el.childNodes];
  nodes.forEach((n) => n.remove());
  el.className = "";
  el.style.display = "contents";
  el.setAttribute("data-glass-host", "");
  createRoot(el).render(
    <Glass className={cls} style={{ display: opts.display || "block", background: opts.tint }} optics={opts.optics}>
      <Slot nodes={nodes} />
    </Glass>
  );
  return true;
}

window.AIRadarGlass = { wrap, version: "0.1.1" };
document.dispatchEvent(new Event("airadar-glass-ready"));
