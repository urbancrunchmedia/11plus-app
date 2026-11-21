import { describe, it, expect, beforeAll } from "vitest";
import { installDomGuard } from "./domGuard";

beforeAll(() => installDomGuard());

describe("DOM guard (browser translation moving React's nodes)", () => {
  it("removing a node that's no longer a child doesn't throw", () => {
    const parent = document.createElement("div");
    const child = document.createTextNode("Hello");
    parent.appendChild(child);
    // A translator replaces the text node with its own.
    const other = document.createElement("font");
    parent.replaceChild(other, child);
    expect(() => parent.removeChild(child)).not.toThrow();
    expect(parent.contains(other)).toBe(true);
  });
  it("inserting before a moved node appends instead of throwing", () => {
    const parent = document.createElement("div");
    const ref = document.createElement("span");
    const node = document.createElement("b");
    expect(() => parent.insertBefore(node, ref)).not.toThrow();
    expect(parent.lastChild).toBe(node);
  });
  it("normal removals and insertions still work", () => {
    const parent = document.createElement("div");
    const a = document.createElement("i"), b = document.createElement("u");
    parent.appendChild(a);
    parent.insertBefore(b, a);
    expect(parent.firstChild).toBe(b);
    parent.removeChild(b);
    expect(parent.childNodes.length).toBe(1);
  });
});
