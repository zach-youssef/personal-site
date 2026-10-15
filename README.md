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

`./deploy` builds the frontend and backend, uploads them to the server and runs `server-restart` there.

On the server, [Caddy](https://caddyserver.com) serves the site over https on ports 80 and 443, with a Let's Encrypt certificate it obtains and renews itself, and forwards requests to the Ktor server on `127.0.0.1:8080`. Its config is `Caddyfile`, which `server-restart` installs on every deploy. Caddy is set up once per server with:

```
ssh ec2-user@zyoussef.com 'bash -s' < server-setup-caddy
```
