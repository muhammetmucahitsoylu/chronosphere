// Where the live archive API lives. Empty = same origin as this page (the API serves the page too).
// The static copy on GitHub Pages talks to the hosted API instead.
window.CHRONO_API = window.CHRONO_API
  || (location.hostname.endsWith('github.io') ? 'https://oxygen-striking-xhtml-enabling.trycloudflare.com' : '');
