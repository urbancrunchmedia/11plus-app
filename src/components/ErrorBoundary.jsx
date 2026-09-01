import React from "react";

// Catches any render/runtime error in the tree below it and shows a friendly,
// child-safe screen instead of a blank white page. Class component because only
// class components can be error boundaries in React.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log for debugging; in production this could go to an error service.
    console.error("App error boundary caught:", error, info);
  }

  handleReload = () => {
    // Clearing the remembered screen avoids reloading straight back into a
    // section that was mid-crash.
    try { localStorage.removeItem("11plus_last_screen"); } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="errscreen">
        <div className="errscreen-card">
          <div className="errscreen-emoji">🙈</div>
          <h1 className="errscreen-title">Oops — something went wobbly</h1>
          <p className="errscreen-sub">Don't worry, your stars and streak are safe. Let's start again.</p>
          <button className="errscreen-btn" onClick={this.handleReload}>Try again</button>
        </div>
      </div>
    );
  }
}
