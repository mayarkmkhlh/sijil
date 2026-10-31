import { useEffect, useState } from "react";

type Health =
  | { state: "loading" }
  | { state: "down" }
  | {
      state: "up";
      museSparkModel: string;
      modelApiConfigured: boolean;
    };

export function App() {
  const [health, setHealth] = useState<Health>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Health check failed");
        const body = (await response.json()) as {
          museSparkModel: string;
          modelApiConfigured: boolean;
        };
        setHealth({
          state: "up",
          museSparkModel: body.museSparkModel,
          modelApiConfigured: body.modelApiConfigured,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHealth({ state: "down" });
      });

    return () => controller.abort();
  }, []);

  return (
    <main>
      <p className="eyebrow">Mursal</p>
      <h1>Local setup</h1>
      <HealthLine health={health} />
    </main>
  );
}

function HealthLine({ health }: { health: Health }) {
  if (health.state === "loading") return <p>Checking the API…</p>;
  if (health.state === "down") {
    return <p>The API is not running. Start it with pnpm dev:api.</p>;
  }

  return (
    <ul>
      <li>API is up.</li>
      <li>Model: {health.museSparkModel}</li>
      <li>
        {health.modelApiConfigured
          ? "Model API key is set."
          : "Model API key is empty. Paste it into .env and restart the API."}
      </li>
    </ul>
  );
}
