/* fallback.js — デザインシステムバンドルのローダ。
   _ds_bundle.js があればそれを使い、未生成の間は .jsx ソースを
   その場で transpile して同じ namespace 形状 (window.__KM) を作る。
   その後 <script type="text/km-babel"> を transform + eval で実行する。 */
(function () {
  var script = document.currentScript;
  var root = new URL(".", script.src).href;
  function hasBundle() {
    var names = Object.getOwnPropertyNames(window);
    for (var i = 0; i < names.length; i++) {
      try { var v = window[names[i]]; if (v && typeof v === "object" && v.Button && v.RoleCard) return true; } catch (e) {}
    }
    return false;
  }
  var FILES = [
    "components/foundation/Icon.jsx", "components/foundation/EngravedRule.jsx", "components/foundation/AppShell.jsx", "components/foundation/PhaseBackdrop.jsx",
    "components/actions/Button.jsx", "components/actions/IconButton.jsx", "components/actions/SegmentedControl.jsx", "components/actions/TextField.jsx", "components/actions/CodeInput.jsx", "components/actions/HoldToConfirm.jsx",
    "components/information/StatusBadge.jsx", "components/information/PhaseHeader.jsx", "components/information/CountdownTimer.jsx", "components/information/RecorderMessage.jsx", "components/information/ConnectionBanner.jsx", "components/information/WaitingCount.jsx", "components/information/InlineNotice.jsx", "components/information/Toast.jsx",
    "components/game/RoleCard.jsx", "components/game/PrivacyCover.jsx", "components/game/PlayerRow.jsx", "components/game/PlayerList.jsx", "components/game/PlayerTargetSelector.jsx", "components/game/VoteBallot.jsx", "components/game/RoomCode.jsx", "components/game/QRJoinPanel.jsx",
    "components/overlays/BottomSheet.jsx", "components/overlays/Dialog.jsx", "components/overlays/ReconnectOverlay.jsx", "components/overlays/FullScreenReveal.jsx",
    "ui_kits/mobile/JoinScreen.jsx", "ui_kits/mobile/RoleScreen.jsx", "ui_kits/mobile/NightScreen.jsx", "ui_kits/mobile/DayScreen.jsx", "ui_kits/mobile/ReconnectScreen.jsx", "ui_kits/mobile/VictoryScreen.jsx",
  ];
  function runInline() {
    var scripts = document.querySelectorAll('script[type="text/km-babel"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var out = window.Babel.transform(scripts[i].textContent, { presets: [["react", { runtime: "classic" }]] }).code;
        (0, eval)(out);
      } catch (e) { console.error("inline km-babel failed:", e && e.message); }
    }
  }
  function buildFallback() {
    Promise.all(FILES.map(function (f) { return fetch(root + f).then(function (r) { return r.ok ? r.text() : ""; }); }))
      .then(function (srcs) {
        var code = srcs.join("\n")
          .replace(/^\s*import[^\n]*$/gm, "")
          .replace(/^\s*export\s+function\s+/gm, "function ");
        var names = [];
        code.replace(/^function ([A-Z][A-Za-z0-9]*)/gm, function (m, n) { if (names.indexOf(n) < 0) names.push(n); return m; });
        code = "(function(){\n" + code + "\nwindow.__KM={" + names.join(",") + "};\n})();";
        var out = window.Babel.transform(code, { presets: [["react", { runtime: "classic" }]] }).code;
        (0, eval)(out);
        window.dispatchEvent(new Event("km-ready"));
        runInline();
      })
      .catch(function (e) { console.warn("fallback loader failed:", e && e.message); });
  }
  function start() {
    if (hasBundle() || window.__KM) { runInline(); return; }
    buildFallback();
  }
  function ready() {
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", start);
    else start();
  }
  var probe = new XMLHttpRequest();
  probe.open("HEAD", root + "_ds_bundle.js", true);
  probe.onload = function () {
    if (probe.status === 200) {
      var s = document.createElement("script");
      s.src = root + "_ds_bundle.js";
      s.onload = ready; s.onerror = ready;
      document.head.appendChild(s);
    } else ready();
  };
  probe.onerror = function () { ready(); };
  probe.send();
})();
