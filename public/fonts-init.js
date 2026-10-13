// Switches the Google Fonts stylesheet on once it has loaded, so it never blocks the
// first paint. Kept as a file (not an inline onload="") because the site's
// Content-Security-Policy only allows scripts from 'self'.
(function () {
  var l = document.getElementById("app-fonts");
  if (!l) return;
  function on() { l.media = "all"; }
  if (l.sheet) on(); else l.addEventListener("load", on);
})();
