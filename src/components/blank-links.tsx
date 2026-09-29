"use client";

import { useEffect } from "react";

function openInNewTab(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    anchor.target = "_blank";
    const rel = new Set((anchor.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    anchor.setAttribute("rel", [...rel].join(" "));
  });
}

/** Every real link opens in a new tab. In-page section jumps stay on the current page. */
export function BlankLinks() {
  useEffect(() => {
    openInNewTab(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLAnchorElement) openInNewTab(node.parentElement ?? document);
          else if (node instanceof HTMLElement) openInNewTab(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
