<p align="center">
  <img src="logo.svg" width="100" alt="listendeck Logo" />
</p>

<h1 align="center">listendeck.</h1>

<p align="center">
  <strong>Minimalist, client-side music utilities for your listening history.</strong>
</p>

<p align="center">
  <a href="https://listendeck.vercel.app"><img src="https://img.shields.io/badge/live-listendeck.vercel.app-6366f1?style=flat" alt="Live App" /></a>
  <a href="https://github.com/snw-mint/listendeck/activity"><img src="https://img.shields.io/github/last-commit/snw-mint/listendeck?style=flat&color=6366f1" alt="Last Commit" /></a>
  <a href="https://github.com/snw-mint/listendeck/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-6366f1?style=flat" alt="License" /></a>
  <img src="https://img.shields.io/badge/maintained-yes-22c55e?style=flat" alt="Maintained" />
</p>

## Utilities

- **01 · Charts** — Explore weekly and monthly top artists, tracks, and albums with real listening minutes, obsession peaks, and `1080×1920` Story recaps via **ListenBrainz**.
- **02 · Match** — Compare music taste, shared artists, and compatibility between two **ListenBrainz** profiles.
- **03 · Lyrics** — Search tracks via **LRCLIB**, select verses, translate inline, and export custom lyric cards in `1:1` or Story formats.
- **04 · Cards** — Generate minimal track and album cover cards with automatic artwork color extraction via **Deezer**.

## Architecture & Privacy

- **100% Client-Side:** Runs entirely in the browser as a static web application with no backend server, database, or user login required.
- **Local Caching:** Uses `localStorage` and `sessionStorage` strictly to speed up repeat lookups and respect public API rate limits.
- **Open Data:** Powered by [ListenBrainz](https://listenbrainz.org), [LRCLIB](https://lrclib.net), [Deezer](https://developers.deezer.com), and [Cover Art Archive](https://coverartarchive.org).

## Feedback & Contributions

- Found an issue? [Report a bug](https://github.com/snw-mint/listendeck/issues/new?template=bug.yml)
- Want to improve an existing tool? [Request a feature](https://github.com/snw-mint/listendeck/issues/new?template=feature.yml)
- Have an idea for a standalone utility? [Propose a new tool](https://github.com/snw-mint/listendeck/issues/new?template=new-tool.yml)

## License

Released under the [GNU General Public License v3.0](LICENSE) by **Snow Mint**.
