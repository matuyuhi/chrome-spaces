import { Global, css } from '@emotion/react'

// Global resets + CSS custom properties. Component styles read these
// via the tokens object in theme.ts (e.g. tokens.bg → var(--bg)).
const styles = css`
  :root {
    --fg: #1f2328;
    --muted: #656d76;
    --subtle: #8c959f;
    --border: #e1e4e8;
    --bg: #ffffff;
    --bg-soft: #f6f8fa;
    --bg-hover: #eef0f2;
    --bg-active: #ddf4ff;
    --accent: #0969da;
    --accent-soft: rgba(9, 105, 218, 0.12);
    --danger: #cf222e;
    --shadow: 0 6px 20px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);

    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
    font-size: 13px;
    color: var(--fg);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e6edf3;
      --muted: #8b949e;
      --subtle: #6e7681;
      --border: #21262d;
      --bg: #0d1117;
      --bg-soft: #181e25;
      --bg-hover: #1c2128;
      --bg-active: #1f3a5c;
      --accent: #58a6ff;
      --accent-soft: rgba(88, 166, 255, 0.16);
      --danger: #f85149;
      --shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  }

  /* When the active Space has a non-grey tint, the body is painted with
     an opaque saturated gradient (theme.ts COLOR_GRADIENT). This block
     gives surfaces an Arc-style frosted look: white text, translucent
     white buttons/pills that let the body color show through, and a
     near-black opaque --bg for menus/popovers so they stay readable
     when they float over the saturated body. grey (and the no-tint
     state) keeps the user's prefers-color-scheme. App.tsx writes
     data-space-tint on <html>; the attribute selector outranks the
     :root @media block on specificity. */
  html[data-space-tint]:not([data-space-tint='grey']) {
    --fg: #ffffff;
    --muted: rgba(255, 255, 255, 0.78);
    --subtle: rgba(255, 255, 255, 0.58);
    --border: rgba(255, 255, 255, 0.20);
    --bg: #15171c;
    --bg-soft: rgba(255, 255, 255, 0.12);
    --bg-hover: rgba(255, 255, 255, 0.22);
    --bg-active: rgba(255, 255, 255, 0.32);
    --accent: #ffffff;
    --accent-soft: rgba(255, 255, 255, 0.20);
    --danger: #ffd2cc;
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.32), 0 1px 3px rgba(0, 0, 0, 0.22);
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
    margin: 0;
    color: var(--fg);
  }

  /* #root must stay transparent or it would mask the body gradient
     (we used to set background: var(--bg) on it, which broke the tint). */
  html {
    background: var(--bg);
  }
  #root {
    background: transparent;
  }

  body {
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    /* Active Space ambient tint. App.tsx writes --space-tint (a CSS
       linear-gradient) when a Space is active; absence falls back to a
       plain --bg backdrop. */
    background-color: var(--bg);
    background-image: var(--space-tint, none);
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-size: cover;
    transition: background-image 240ms ease;
  }

  button {
    font-family: inherit;
  }
`

export function GlobalStyles() {
  return <Global styles={styles} />
}
