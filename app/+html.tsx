import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#0D0F14" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var DARK = "#0D0F14";
  var LIGHT = "#F6F8FC";

  function ensureMeta() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    return meta;
  }

  function getThemeColor() {
    try {
      var bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") {
        return bodyBg;
      }
    } catch (e) {}

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
    } catch (e) {
      return DARK;
    }
  }

  function applyThemeColor() {
    ensureMeta().setAttribute("content", getThemeColor());
  }

  applyThemeColor();
  document.addEventListener("DOMContentLoaded", applyThemeColor);
  window.addEventListener("load", applyThemeColor);

  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) {
      media.addEventListener("change", applyThemeColor);
    } else if (media.addListener) {
      media.addListener(applyThemeColor);
    }
  } catch (e) {}

  var observer = new MutationObserver(function () {
    window.requestAnimationFrame(applyThemeColor);
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });

  document.addEventListener("visibilitychange", applyThemeColor);
})();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
