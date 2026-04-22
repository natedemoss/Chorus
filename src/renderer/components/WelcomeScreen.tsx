export function WelcomeScreen({ onPickRepo }: { onPickRepo: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-glyph">✻</div>
        <div className="welcome-title">chorus</div>
        <div className="welcome-sub">
          fan out one prompt to many Claude Code agents in parallel.
          each runs in its own git worktree. pick the winner; discard the rest.
        </div>
        <button className="welcome-btn" onClick={onPickRepo}>
          pick a git repo →
        </button>
        <div className="welcome-foot">
          needs a git repo · needs <code>claude</code> on your PATH
        </div>
      </div>
    </div>
  );
}
