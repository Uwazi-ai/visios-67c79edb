import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { runVersionMigration } from "./lib/versionMigration";

runVersionMigration();

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
