export function ConnectChannelButton({ label }: { label: string }) {
  return (
    <button type="button" className="connect" disabled>
      {label}
    </button>
  );
}
