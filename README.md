# Zach's Personal Site

## Testing

```
# Backend unit and API tests
cd graphql-server && ./gradlew test

# Frontend component tests
cd frontend && npm test

# End-to-end tests: starts the backend and a production build of the frontend
cd e2e && npm install && npx playwright install chromium && npm test
```

The Vulkan Retro PPU's page (`/projects/vkPPU`) runs its games in the browser on WebGPU. They are built from the [vk_ppu](https://github.com/zach-youssef/vk_ppu) submodule (`external/vk_ppu`, with its own `vulkan_test` submodule) by `./build-ppu` into `graphql-server/assets/ppu`, which git ignores and the backend serves as `/assets/ppu/<game>/`. Run it before the end-to-end tests or a local backend, and again after updating the submodule; `./deploy` runs it itself. Building needs what the PPU's `make web` needs: Racket 8 and Node 24 with npm.

```
git submodule update --init --recursive
./build-ppu                 # or ./build-ppu <another ppu checkout>
```

The frontend requests the backend relative to the page, since the backend serves the site in production. The Vite dev and preview servers forward those requests to the backend at `BACKEND_URL`, which defaults to `http://localhost:8080`, the port the backend listens on when run locally:

```
# Local backend and frontend dev server, in separate terminals
cd graphql-server && ./gradlew run
cd frontend && npm start

# Frontend dev server against the live backend
cd frontend && BACKEND_URL=http://zyoussef.com npm start
```

The end-to-end tests point the preview server at the test backend, so they never touch the live site.

## Deployment

`./deploy` builds the frontend, the PPU's games and the backend, uploads them to the server and runs `server-restart` there.

The upload is unzipped over the server's home directory, which only adds and overwrites files, so anything a change makes obsolete (an old frontend bundle, a renamed asset, a file nothing reads any more) stays on the server until it's deleted. To delete such paths, add them to `.server_tombstones` in the repository root, one per line and relative to the server's home directory, e.g. `assets/index-DiuH75ZM.js`; a directory is deleted with everything in it. After the restart, `./deploy` deletes them on the server and then deletes the list. It refuses paths outside the home directory, skips any that the deploy itself ships, and keeps the list if the deletion fails. The list is ignored by git, since it only matters until the next deploy.

The server also holds files that no deploy ships but that are still in use, so don't list them: `resources/` (the backend's config and Sokoban levels), `assets/seamcarver/output/` (seam carver results), and the backend's logs `callTrace.log` and `server.log`.

On the server, [Caddy](https://caddyserver.com) serves the site over https on ports 80 and 443, with a Let's Encrypt certificate it obtains and renews itself, and forwards requests to the Ktor server on `127.0.0.1:8080`. Its config is `Caddyfile`, which `server-restart` installs on every deploy. Caddy is set up once per server with:

```
ssh ec2-user@zyoussef.com 'bash -s' < server-setup-caddy
```
