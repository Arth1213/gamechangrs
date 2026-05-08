import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import academicsHtml from "../arth-profile/pages/academics.html?raw";
import cricketHtml from "../arth-profile/pages/cricket.html?raw";
import indexHtml from "../arth-profile/pages/index.html?raw";
import leadershipHtml from "../arth-profile/pages/leadership.html?raw";
import othersHtml from "../arth-profile/pages/others.html?raw";
import scoutsHtml from "../arth-profile/pages/scouts.html?raw";

type ArthProfilePage = {
  bodyHtml: string;
  scriptHref?: string;
  stylesheetHref: string;
  title: string;
};

function extractTagValue(documentHtml: string, pattern: RegExp, fallback: string) {
  return documentHtml.match(pattern)?.[1]?.trim() || fallback;
}

function parsePage(documentHtml: string): ArthProfilePage {
  return {
    title: extractTagValue(documentHtml, /<title>([\s\S]*?)<\/title>/i, "Arth Arun"),
    stylesheetHref: `/arth/${extractTagValue(documentHtml, /<link rel="stylesheet" href="\.\/([^"]+)"/i, "styles.css")}`,
    scriptHref: documentHtml.match(/<script src="\.\/([^"]+)"><\/script>/i)?.[1]
      ? `/arth/${documentHtml.match(/<script src="\.\/([^"]+)"><\/script>/i)?.[1]}`
      : undefined,
    bodyHtml: extractTagValue(documentHtml, /<body>([\s\S]*)<\/body>/i, ""),
  };
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

function upsertHeadLink(attributes: Record<string, string>) {
  const selector = `link[data-arth-profile-head="${attributes["data-arth-profile-head"]}"]`;
  let node = document.head.querySelector<HTMLLinkElement>(selector);

  if (!node) {
    node = document.createElement("link");
    document.head.appendChild(node);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    node?.setAttribute(key, value);
  });

  return node;
}

const ArthProfile = () => {
  const location = useLocation();

  if (location.pathname === "/arth") {
    return <Navigate replace to="/arth/" />;
  }

  const slug = location.pathname.replace(/^\/arth\/?/, "");
  const page = PROFILE_PAGES[slug];

  useEffect(() => {
    if (!page) {
      return undefined;
    }

    const previousTitle = document.title;
    document.title = page.title;

    const preconnectGoogle = upsertHeadLink({
      rel: "preconnect",
      href: "https://fonts.googleapis.com",
      "data-arth-profile-head": "fonts-googleapis",
    });
    const preconnectStatic = upsertHeadLink({
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossorigin: "",
      "data-arth-profile-head": "fonts-gstatic",
    });
    const fontStylesheet = upsertHeadLink({
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap",
      "data-arth-profile-head": "fonts-stylesheet",
    });
    const pageStylesheet = upsertHeadLink({
      rel: "stylesheet",
      href: page.stylesheetHref,
      "data-arth-profile-head": "page-stylesheet",
    });

    document.body.classList.remove("motion-ready");

    let scriptNode: HTMLScriptElement | undefined;
    if (page.scriptHref) {
      scriptNode = document.createElement("script");
      scriptNode.src = `${page.scriptHref}?v=1`;
      scriptNode.async = false;
      scriptNode.dataset.arthProfileHead = "page-script";
      document.body.appendChild(scriptNode);
    }

    if (location.hash) {
      requestAnimationFrame(() => {
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
      });
    } else {
      window.scrollTo(0, 0);
    }

    return () => {
      document.title = previousTitle;
      document.body.classList.remove("motion-ready");
      scriptNode?.remove();
      pageStylesheet.remove();
      fontStylesheet.remove();
      preconnectStatic.remove();
      preconnectGoogle.remove();
    };
  }, [location.hash, page]);

  if (!page) {
    return <Navigate replace to="/arth/" />;
  }

  return (
    <div
      data-arth-profile-page
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
    />
  );
};

export default ArthProfile;
