```markdown
# MCTIERS — Static site scaffold

This repository is a simple static website scaffold for the MCTIERS Minecraft PvP community.

What’s included
- index.html — Home page with server-status widget
- tiers.html — Tiers page (placeholder content)
- assets/styles.css — All site styles (change `--brand` variable for brand color)
- assets/app.js — Client-side Minecraft server status integration using https://api.mcsrvstat.us
- assets/logo.png — placeholder (add your logo file)

Quick edits you should make
1. Replace assets/logo.png with your real logo (same filename).
2. Update the CSS brand color: open assets/styles.css and change `--brand` at the top.
3. Update the server IP: edit assets/app.js and set `serverToCheck = "your.server.ip"` or include a port like "play.example.com:25565".
4. Replace placeholder images (assets/server-placeholder.png) or remove if not used.
5. Replace the placeholder tier text on tiers.html with your real content.

Deploying (GitHub Pages)
1. Create a new repository (for example: `Stkwharton1/mctiers-website`).
2. Commit these files to the repository.
3. Create a branch for the initial site (e.g. `feat/initial-site`) if you want a branch workflow.
4. On GitHub, go to Settings → Pages and choose the branch (main or feat/initial-site) and root folder to publish.
5. After a minute, the site will be available at https://<your-username>.github.io/<repo> or at your custom domain.

Notes about the server-status widget
- The widget uses the public API `https://api.mcsrvstat.us/2/<ip>`. If you run into CORS or rate-limit problems, you can:
  - Run your own small proxy endpoint that queries the Minecraft server info and returns JSON.
  - Use a different status API that you prefer.
- This is a client-side approach for convenience. If you build a backend later, consider moving server queries server-side for reliability and to avoid exposing API usage on the client.

If you want, I can:
- Push this scaffold into a new GitHub repo & create the `feat/initial-site` branch for you (I’ll need GitHub permission).
- Add an index of editable sections and a small admin-friendly README to make content updates easier.

```