# Environment setup log & cleanup

Everything installed for this project, and how to remove it.

| Item | How installed | Location | Remove |
|---|---|---|---|
| Kiro CLI 3.1.0 | official `curl -fsSL https://cli.kiro.dev/install \| bash` | `~/.local/bin/kiro-cli`, PATH line in `~/.zshrc` | delete `~/.local/bin/kiro-cli*`, the PATH line, `~/.kiro` |
| Colima 0.10.3, Docker CLI 29.9, docker-compose 5.7 | `brew install colima docker docker-compose` | `/opt/homebrew` | `colima delete && brew uninstall colima docker docker-compose` |
| Playwright Chromium headless shell | `npx playwright install chromium` | `~/Library/Caches/ms-playwright` | `rm -rf ~/Library/Caches/ms-playwright` |
| npm deps (phaser, gsap, howler, pdfjs-dist, vitest, fast-check, @playwright/test, three, @types/three, @fontsource/*) | `npm install` | `./node_modules` | `rm -rf node_modules` |

Notes
- Colima VM is **not started** yet. Start only for Moodle: `colima start --cpu 2 --memory 4`. Use `docker-compose` (standalone binary) — the `docker compose` plugin form needs `~/.docker/config.json` with `"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]` (optional).
- All Docker resources for this project will be prefixed `dd-` (containers, network, volumes) and use non-default ports.
- Nothing under `~/Developer/Projects/agent-hub*` is touched.
