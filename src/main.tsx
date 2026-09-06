import { isArthProfilePath, renderArthProfileDocument } from "./arth-profile/runtime";

const RELOAD_FLAG = "lovable:stale-asset-reload";

function reloadOnceForStaleAssets() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}

// A new deploy invalidates the previously hashed JS/CSS chunks. When an old tab
// tries to preload a chunk that no longer exists, recover with a single reload.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleAssets();
});

async function bootstrap() {
  if (isArthProfilePath(window.location.pathname)) {
    renderArthProfileDocument(window.location.pathname);
    return;
  }

  try {
    await import("./index.css");

    const [{ createRoot }, { default: App }] = await Promise.all([
      import("react-dom/client"),
      import("./App.tsx"),
    ]);

    createRoot(document.getElementById("root")!).render(<App />);
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch (error) {
    console.error("Failed to bootstrap app", error);
    reloadOnceForStaleAssets();
  }
}

void bootstrap();

