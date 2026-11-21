// Browser translation (Safari/Chrome "Translate page") and some extensions
// rewrite the page's text nodes behind React's back. When React later removes
// or inserts next to a node that's no longer where it left it, the browser
// throws NotFoundError ("The object can not be found here") and the screen
// crashes. This is React's long-standing issue #11538; the widely used fix is
// to skip just that impossible removal/insertion instead of throwing.
export function installDomGuard(proto = typeof Node !== "undefined" ? Node.prototype : null) {
  if (!proto || proto.__domGuard) return;
  const removeChild = proto.removeChild;
  proto.removeChild = function (child) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  };
  const insertBefore = proto.insertBefore;
  proto.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null);
    return insertBefore.call(this, node, ref);
  };
  proto.__domGuard = true;
}
