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
