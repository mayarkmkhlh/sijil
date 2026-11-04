import { useState, type FormEvent } from "react";
import { Button } from "../../components/button/button.js";
import { Input } from "../../components/input/input.js";
import { Logo } from "../../components/logo/logo.js";
import type { Copy } from "../../hooks/use-language/copy.js";
import { accountError, login, signup, type SellerAccount } from "./account-api.js";

export function AuthScreen({
  copy,
  onSeller,
  onDemo,
}: {
  copy: Copy;
  onSeller: (seller: SellerAccount) => void;
  onDemo: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const seller =
        mode === "signup"
          ? await signup({ shopName, email, password })
          : await login({ email, password });
      onSeller(seller);
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      <Logo />
      {mode === "signup" ? (
        <Input label={copy.authShop} value={shopName} onChange={(event) => setShopName(event.target.value)} required />
      ) : null}
      <Input
        label={copy.authEmail}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Input
        label={copy.authPassword}
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        minLength={mode === "signup" ? 8 : 1}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error ? <p className="auth-error">{error}</p> : null}
      <Button className="btn-block" disabled={busy} type="submit">
        {mode === "signup" ? copy.authSignup : copy.authLogin}
      </Button>
      <Button
        variant="quiet"
        type="button"
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}
      >
        {mode === "signup" ? copy.authSwitchToLogin : copy.authSwitchToSignup}
      </Button>
      <Button variant="ghost" type="button" onClick={onDemo}>
        {copy.authDemo}
      </Button>
    </form>
  );
}
