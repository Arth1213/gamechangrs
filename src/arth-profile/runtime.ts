import academicsHtml from "./pages/academics.html?raw";
import cricketHtml from "./pages/cricket.html?raw";
import indexHtml from "./pages/index.html?raw";
import leadershipHtml from "./pages/leadership.html?raw";
import othersHtml from "./pages/others.html?raw";
import scoutsHtml from "./pages/scouts.html?raw";

const PROFILE_PAGES: Record<string, string> = {
  "/arth/": indexHtml,
  "/arth/index.html": indexHtml,
  "/arth/academics.html": academicsHtml,
  "/arth/leadership.html": leadershipHtml,
  "/arth/scouts.html": scoutsHtml,
  "/arth/cricket.html": cricketHtml,
  "/arth/others.html": othersHtml,
};

export function isArthProfilePath(pathname: string) {
  return pathname === "/arth" || pathname.startsWith("/arth/");
}

export function renderArthProfileDocument(pathname: string) {
  if (pathname === "/arth") {
    window.location.replace("/arth/");
    return;
  }

  const documentHtml = PROFILE_PAGES[pathname] || indexHtml;

  document.open();
  document.write(documentHtml);
  document.close();
}
