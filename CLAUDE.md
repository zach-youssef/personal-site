# Notes for Claude

- Deploys delete from the server what the previous deploy shipped and the new one doesn't (by the bundle's `MANIFEST`), so renaming or removing a deployed file needs no extra step. `./deploy` is `./bundle` then `./ship`, which pipes the zip to `server-deploy` on the server; `server-deploy` must be put on the server once by hand before the first such deploy. Test `server-deploy` changes with `tests/deploy-test.sh`. See "Deployment" in README.md for the flow, the bootstrap and the paths deploys never delete.
