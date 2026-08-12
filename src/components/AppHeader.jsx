export function AppHeader({ favoriteCount, historyCount }) {
  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="MovieNightPick home">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <span>
          <strong>MOVIE</strong>
          <em>NIGHTPICK</em>
        </span>
      </a>

      <div className="header-stats" aria-label="Your movie collection summary">
        <span><b>{favoriteCount}</b> favorites</span>
        <span className="header-divider" />
        <span><b>{historyCount}</b> recent picks</span>
      </div>
    </header>
  );
}
