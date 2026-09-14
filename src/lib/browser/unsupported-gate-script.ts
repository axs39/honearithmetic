/**
 * Classic (ES5) inline script injected in <head>.
 * Must stay free of modern syntax — it has to parse on ancient WebKit.
 */
export const UNSUPPORTED_BROWSER_GATE_SCRIPT = `(function () {
  function iosMajor() {
    try {
      var ua = navigator.userAgent || "";
      var m = ua.match(/OS (\\d+)[_\\.](\\d+)/);
      if (m) return parseInt(m[1], 10);
    } catch (e) {}
    return null;
  }
  function chromeMajor() {
    try {
      var ua = navigator.userAgent || "";
      var m = ua.match(/Chrome\\/(\\d+)/);
      if (m && ua.indexOf("Edg/") === -1) return parseInt(m[1], 10);
      var e = ua.match(/Edg\\/(\\d+)/);
      if (e) return parseInt(e[1], 10);
      var f = ua.match(/Firefox\\/(\\d+)/);
      if (f) return parseInt(f[1], 10);
      var s = ua.match(/Version\\/(\\d+).*Safari/);
      if (s && ua.indexOf("Chrome") === -1 && ua.indexOf("CriOS") === -1) {
        return parseInt(s[1], 10);
      }
    } catch (e2) {}
    return null;
  }
  function featuresOk() {
    try {
      if (typeof Promise === "undefined") return false;
      if (typeof Symbol === "undefined") return false;
      if (typeof Proxy === "undefined") return false;
      if (typeof Map === "undefined" || typeof Set === "undefined") return false;
      if (typeof Object.assign !== "function") return false;
      if (typeof Array.prototype.includes !== "function") return false;
      if (typeof String.prototype.includes !== "function") return false;
      if (typeof window.fetch !== "function") return false;
      if (typeof URL === "undefined") return false;
      if (!window.CSS || typeof CSS.supports !== "function") return false;
      if (!CSS.supports("color", "var(--hone-probe)")) return false;
      if (!CSS.supports("display", "flex")) return false;
      if (typeof globalThis === "undefined") return false;
    } catch (e3) {
      return false;
    }
    return true;
  }
  function versionOk() {
    var ios = iosMajor();
    if (ios !== null && ios < 15) return false;
    var major = chromeMajor();
    // Desktop Safari Version/X — treat under 15 as unsupported when no Chrome token
    try {
      var ua = navigator.userAgent || "";
      if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg|Firefox|FxiOS/i.test(ua)) {
        var sm = ua.match(/Version\\/(\\d+)/);
        if (sm && parseInt(sm[1], 10) < 15) return false;
      }
    } catch (e4) {}
    if (major !== null && major < 90) return false;
    return true;
  }
  function show() {
    try {
      window.__HONE_UNSUPPORTED__ = true;
      var html = document.documentElement;
      html.className = (html.className ? html.className + " " : "") + "hone-unsupported";
      var css =
        "html.hone-unsupported,html.hone-unsupported body{margin:0;padding:0;background:#0a0b0d;color:#f4f2ec;}" +
        "html.hone-unsupported body>*{display:none !important;}" +
        "html.hone-unsupported #hone-unsupported{display:block !important;box-sizing:border-box;min-height:100vh;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
        "html.hone-unsupported #hone-unsupported h1{font-size:28px;line-height:1.2;margin:0 0 12px;font-weight:600;}" +
        "html.hone-unsupported #hone-unsupported p{font-size:16px;line-height:1.5;margin:0 0 12px;color:#c8c4bc;}" +
        "html.hone-unsupported #hone-unsupported .card{max-width:420px;margin:12vh auto 0;padding:28px 24px;border:1px solid #2a2d33;border-radius:16px;background:#121418;}" +
        "html.hone-unsupported #hone-unsupported .hint{font-size:13px;color:#8b8680;margin-top:20px;}";
      // Apply CSS immediately (before body) so SSR chrome never flashes.
      try {
        document.write('<style type="text/css">' + css + "</style>");
      } catch (ew) {
        var style = document.createElement("style");
        style.type = "text/css";
        if (style.styleSheet) style.styleSheet.cssText = css;
        else style.appendChild(document.createTextNode(css));
        if (document.head) document.head.appendChild(style);
        else html.appendChild(style);
      }
      var mount = function () {
        try {
          if (document.getElementById("hone-unsupported")) return;
          var wrap = document.createElement("div");
          wrap.id = "hone-unsupported";
          wrap.innerHTML =
            '<div class="card">' +
            "<h1>Please update your browser</h1>" +
            "<p>Hone needs a newer browser to run. This device&rsquo;s browser is too old for the trainer.</p>" +
            "<p>Update Safari / Chrome / your phone OS, then open <strong>honearithmetic.trade</strong> again.</p>" +
            '<p class="hint">Supported: recent Safari (iOS 15+), Chrome, Edge, and Firefox.</p>' +
            "</div>";
          if (document.body) {
            document.body.insertBefore(wrap, document.body.firstChild);
          }
        } catch (e5) {}
      };
      if (document.body) mount();
      else if (document.addEventListener)
        document.addEventListener("DOMContentLoaded", mount, false);
      else if (document.attachEvent)
        document.attachEvent("onreadystatechange", function () {
          if (document.readyState === "complete") mount();
        });
    } catch (e6) {}
  }
  try {
    if (!featuresOk() || !versionOk()) show();
  } catch (e7) {
    show();
  }
})();`;
