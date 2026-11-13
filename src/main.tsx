import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { runVersionMigration } from "./lib/versionMigration";
import { enforceFreshSignIn } from "./lib/freshSignIn";
import { initGoogleOAuthTabBridge } from "./lib/googleOAuth";

runVersionMigration();
enforceFreshSignIn();
initGoogleOAuthTabBridge();

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
