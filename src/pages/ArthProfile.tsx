import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import academicsHtml from "../arth-profile/pages/academics.html?raw";
import cricketHtml from "../arth-profile/pages/cricket.html?raw";
import indexHtml from "../arth-profile/pages/index.html?raw";
import leadershipHtml from "../arth-profile/pages/leadership.html?raw";
import othersHtml from "../arth-profile/pages/others.html?raw";
import scoutsHtml from "../arth-profile/pages/scouts.html?raw";

type ArthProfilePage = {
  documentHtml: string;
  title: string;
};

function extractTagValue(documentHtml: string, pattern: RegExp, fallback: string) {
  return documentHtml.match(pattern)?.[1]?.trim() || fallback;
}

function parsePage(documentHtml: string): ArthProfilePage {
  return {
    documentHtml,
    title: extractTagValue(documentHtml, /<title>([\s\S]*?)<\/title>/i, "Arth Arun"),
  };
}

function rewriteInternalHtmlLinks(documentHtml: string) {
  return documentHtml
    .replace(/href="\.\/*index\.html"/g, 'href="/arth/" target="_top"')
    .replace(/href="\.\/*(academics|leadership|scouts|cricket|others)\.html"/g, 'href="/arth/$1.html" target="_top"');
}

function injectBaseHref(documentHtml: string) {
  return documentHtml.replace(
    /<head>/i,
    `<head><base href="/arth/" />`,
  );
}

function buildSrcDoc(documentHtml: string) {
  return injectBaseHref(rewriteInternalHtmlLinks(documentHtml));
}

const PROFILE_PAGES: Record<string, ArthProfilePage> = {
  "": parsePage(indexHtml),
  "index.html": parsePage(indexHtml),
  "academics.html": parsePage(academicsHtml),
  "leadership.html": parsePage(leadershipHtml),
  "scouts.html": parsePage(scoutsHtml),
  "cricket.html": parsePage(cricketHtml),
  "others.html": parsePage(othersHtml),
};

const ArthProfile = () => {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState(0);

  if (location.pathname === "/arth") {
    return <Navigate replace to="/arth/" />;
  }

  const slug = location.pathname.replace(/^\/arth\/?/, "");
  const page = PROFILE_PAGES[slug];
  const srcDoc = useMemo(() => (page ? buildSrcDoc(page.documentHtml) : ""), [page]);

  useEffect(() => {
    if (!page) {
      return undefined;
    }

    const previousTitle = document.title;
    document.title = page.title;

    return () => {
      document.title = previousTitle;
    };
  }, [page]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !page) {
      return undefined;
    }

    let resizeObserver: ResizeObserver | undefined;
    let resizeTimer: number | undefined;

    const updateHeight = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) {
        return;
      }

      const { body, documentElement } = iframeDocument;
      const nextHeight = Math.max(
        body?.scrollHeight || 0,
        body?.offsetHeight || 0,
        documentElement?.scrollHeight || 0,
        documentElement?.offsetHeight || 0,
      );

      if (nextHeight > 0) {
        setIframeHeight(nextHeight);
      }
    };

    const syncHashScroll = () => {
      if (!location.hash) {
        return;
      }

      const iframeDocument = iframe.contentDocument;
      iframeDocument?.getElementById(location.hash.slice(1))?.scrollIntoView();
    };

    const handleLoad = () => {
      updateHeight();
      syncHashScroll();

      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) {
        return;
      }

      resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updateHeight, 16);
      });

      resizeObserver.observe(iframeDocument.documentElement);
      if (iframeDocument.body) {
        resizeObserver.observe(iframeDocument.body);
      }
    };

    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
    };
  }, [location.hash, page, srcDoc]);

  if (!page) {
    return <Navigate replace to="/arth/" />;
  }

  return (
    <iframe
      ref={iframeRef}
      title={page.title}
      srcDoc={srcDoc}
      style={{
        border: "0",
        display: "block",
        height: `${iframeHeight || 1200}px`,
        width: "100%",
      }}
    />
  );
};

export default ArthProfile;
