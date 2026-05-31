export function TypingDots() {
  return (
    <output className="flex items-center gap-1" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-gold-500/60 dark:bg-gold-400/70"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </output>
  );
}
