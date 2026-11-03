export type IconName = "menu" | "spark" | "check" | "refresh" | "copy" | "chevron";

const paths: Record<IconName, string> = {
  menu: "M4 7h16M4 12h16M4 17h16",
  spark: "M12 3.5 13.6 9.2 19.5 12 13.6 14.8 12 20.5 10.4 14.8 4.5 12 10.4 9.2 12 3.5Z",
  check: "M5 12.5 9.2 17 19 7",
  refresh: "M19 12a7 7 0 1 1-2-4.9M19 4.5V8h-3.5",
  copy: "M9 9h10v10H9zM5 15V5h10",
  chevron: "M6 9.5 12 15.5 18 9.5",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
