import { isArthProfilePath, renderArthProfileDocument } from "./arth-profile/runtime";

async function bootstrap() {
  if (isArthProfilePath(window.location.pathname)) {
    renderArthProfileDocument(window.location.pathname);
    return;
  }

  await import("./index.css");

  const [{ createRoot }, { default: App }] = await Promise.all([
    import("react-dom/client"),
    import("./App.tsx"),
  ]);

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
