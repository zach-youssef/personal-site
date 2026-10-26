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

The Vulkan Retro PPU's page (`/projects/vkPPU`) runs its games in the browser on WebGPU. They are built from the [vk_ppu](https://github.com/zach-youssef/vk_ppu) submodule (`external/vk_ppu`, with its own `vulkan_test` submodule) by `./build-ppu` into `graphql-server/assets/ppu`, which git ignores and the backend serves as `/assets/ppu/<game>/`. Run it before the end-to-end tests or a local backend, and again after updating the submodule; `./bundle` (and so `./deploy`) runs it itself. Building needs what the PPU's `make web` needs: Racket 8 and Node 24 with npm.

ZGAL's page (`/projects/zgal`) likewise runs its particles example beside the program's source. `./build-zgal` builds ZGAL's examples that run in a browser (particles and scene) from the [vulkan_testing](https://github.com/zach-youssef/vulkan_testing) submodule (`external/zgal`) into `graphql-server/assets/zgal`, each served as `/assets/zgal/<name>/`: its page and scripts, the runtime, whatever it loads (scene's `assets/scene.gltf` and `scene.bin`, and any `*.wasm`), its source and a screenshot for browsers without WebGPU. Each screenshot is the last frame of a headless run under Node on the GPU (particles at 1024x640, scene at 1280x720, 240 frames each), compressed with `cwebp` (`brew install webp`); a program is added with one `copy_program` line in `./build-zgal`. It also builds ZGAL's Scribble documentation into `graphql-server/assets/zgal/docs`, which the backend serves at `/zgal/docs/` (and redirects `/zgal/docs` there, since the page links its stylesheets relative to itself); the ZGAL page links to it.

```
git submodule update --init --recursive
./build-ppu                 # or ./build-ppu <another ppu checkout>
./build-zgal                # or ./build-zgal <another zgal checkout>
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

## CI

GitHub Actions (`.github/workflows/ci.yml`) builds and tests every commit a push brings, each in its own job on `ubuntu-24.04`: on `master` the commits the push added, on any other branch every commit that `master` doesn't have; in either case the newest 20 at most. A newer push to a working branch cancels the checks still running for its older one, while every push to `master` is checked in full. Each job runs `tests/deploy-test.sh` (with its lock tests, as the runner has `flock`), the frontend tests, `./build-ppu`, `./build-zgal`, the backend tests and the end-to-end tests, and its commit gets a `CI / test` commit status, so a branch shows which of its commits pass.

- The public submodules are checked out over https. SeamCarving is private, so it's checked out with a read-only deploy key on [SeamCarving](https://github.com/zach-youssef/SeamCarving), whose private half is the repository secret `SEAMCARVING_DEPLOY_KEY`.
- Without a GPU, `./build-zgal` draws its screenshots on Mesa's software Vulkan driver (lavapipe), so they can differ from those drawn on a Mac. Each job uploads them as the `zgal-screenshots-<sha>` artifact (`<name>/screenshot.webp`).
- The WebGPU specs run Chromium's WebGPU on SwiftShader rather than a GPU, so CI and a Mac run them the same way (see `e2e/tests/webgpu.ts`).
- Tests print a dot each and their failures in full when `CI` is set. On a failure, the job uploads the Playwright report with the failures' traces (`e2e-report-<sha>`) and the backend's test report (`backend-test-report-<sha>`); `gh run download <run id>` fetches them.

Notes for editing the workflow:

- Status functions (`cancelled()`, `failure()`) are only allowed in `if:`. In `env:` they make the whole workflow fail to parse, as a 0 s "workflow file issue" run with no message; use `job.status` there.
- `git -c url.<https>.insteadOf=<ssh> submodule update --recursive` passes the rewrite on to nested submodules (through `GIT_CONFIG_PARAMETERS`), so it needs no global rewrite, which would also send the private SeamCarving over https.
- `gradle/actions/setup-gradle` stays on v5, the last MIT major: v6 accepts the Terms of Use of a closed-source caching component.
- The SeamCarving checkout, which holds the deploy key, runs before any npm, Gradle or build step, so no third-party script runs before the key is used and removed.
- Only jobs that run no code from the commits, npm, Gradle or third-party actions hold a token that can post statuses, as a job's steps share one user and file system (a build could plant a `gh` that a later step runs with the token). The test jobs get `contents: read` and no `GH_TOKEN`, and no checkout persists its credentials. The `pending` job marks every commit pending; the `statuses` job, which needs all the others, posts each commit's status from the conclusion of its job (named `Test <sha>`) in the run's jobs API, linked to that job: anything but success or failure (cancelled, timed out, skipped or unreadable) is an `error`, so none stays pending. Neither of the two checks anything out.

## Deployment

`./deploy` builds the site and deploys it to the server. It runs the two steps a deploy has, which can also run apart (e.g. building once and shipping the result later):

```
./bundle <out-dir>          # build into <out-dir>/site-bundle.zip, with a copy of its MANIFEST
./ship <bundle.zip>         # deploy that bundle
```

`./bundle` builds the frontend, the PPU's games, ZGAL's examples and the backend, and zips them with `server-restart`, `server-deploy` and `Caddyfile`, laid out as they go in the server's home directory. Of `graphql-server/assets` only the files git tracks ship, besides the PPU's and ZGAL's builds, so untracked local files don't. The zip's `MANIFEST` lists every file in it.

`./ship` sends the zip over ssh to `server-deploy` on the server, on its stdin, as the only command it runs, so it also works with a deploy key limited to `restrict,command="~/server-deploy"` in `~/.ssh/authorized_keys`. `server-deploy` unpacks the zip into `~/.deploy/staging` and checks it before changing anything, so a broken upload leaves the site as it was. It then moves the files into place, deletes the files the previous deploy's manifest (kept in `~/.deploy/MANIFEST`) listed and this one doesn't, keeps the new manifest and runs `server-restart`. A file it can't delete is reported and the deploy carries on, failing at the end. Once the upload is in, a dropped ssh session doesn't stop it; `~/.deploy/log` holds the last deploy's messages. Deploys run one at a time under a lock taken with `flock`, which the server needs (util-linux). Renaming or removing a file needs nothing more than the change itself: the next deploy deletes the old one from the server. That includes a path changing between file and directory: an old deploy's file or directory in the way is deleted before the install, while anything else in the way refuses the bundle. `tests/deploy-test.sh` tests `server-deploy` against temporary directories.

The server also holds files that no deploy ships but that are still in use: `resources/` (the backend's config and Sokoban levels), `assets/seamcarver/output/` (seam carver results), and the backend's logs (`callTrace.log`, `server.log`). `server-deploy` never deletes them, nor anything outside the home directory, and refuses a bundle that ships any of them or would write outside the home directory, with the server's symlinks resolved. It also refuses a bundle without `server-deploy` and `server-restart`, which deploys need. Anything else no manifest lists is left alone too, such as files earlier deploys left behind before deploys kept a manifest; those are deleted by hand.

`./ship` needs `server-deploy` on the server, which every deploy updates. To put it there the first time, run once from the repository root:

```
ssh ec2-user@zyoussef.com 'cat > server-deploy && chmod 755 server-deploy' < server-deploy
```

The first deploy after that keeps a manifest and deletes nothing; later ones delete by it.

On the server, [Caddy](https://caddyserver.com) serves the site over https on ports 80 and 443, with a Let's Encrypt certificate it obtains and renews itself, and forwards requests to the Ktor server on `127.0.0.1:8080`. Its config is `Caddyfile`, which `server-restart` installs on every deploy. Caddy is set up once per server with:

```
ssh ec2-user@zyoussef.com 'bash -s' < server-setup-caddy
```
