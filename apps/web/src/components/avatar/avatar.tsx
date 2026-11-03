const tones = ["a", "b", "c", "d"] as const;

export function avatarTone(name: string): (typeof tones)[number] {
  const code = name.codePointAt(0) ?? 0;
  return tones[code % tones.length] ?? "a";
}

export function Avatar({ name }: { name: string }) {
  const letter = Array.from(name)[0] ?? "?";
  return <span className={`avatar avatar-${avatarTone(name)}`}>{letter}</span>;
}
