import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app.js";
import { CustomerPage } from "./modules/shop/customer-page.js";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/styles.css";

function shopIdFromHash(): string | null {
  const match = /^#\/s\/([0-9a-f-]{36})$/i.exec(window.location.hash);
  return match?.[1] ?? null;
}

function Root() {
  const [shopId, setShopId] = useState(shopIdFromHash);
  useEffect(() => {
    const onHash = () => setShopId(shopIdFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (shopId) return <CustomerPage sellerId={shopId} />;
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
