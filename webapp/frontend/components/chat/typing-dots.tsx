export function TypingDots() {
  return (
    <div className="flex items-center gap-1" aria-label="typing" role="status">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-dot-bounce"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}
