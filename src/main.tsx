import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { runVersionMigration } from "./lib/versionMigration";
import { enforceFreshSignIn } from "./lib/freshSignIn";

runVersionMigration();
enforceFreshSignIn();

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
