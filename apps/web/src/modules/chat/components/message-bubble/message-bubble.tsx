export function MessageBubble({
  author,
  text,
  time,
}: {
  author: "customer" | "seller";
  text: string;
  time: string;
}) {
  return (
    <article className={`bubble bubble-${author}`}>
      <p className="bubble-text" dir="auto">{text}</p>
      <p className="bubble-time">{time}</p>
    </article>
  );
}
