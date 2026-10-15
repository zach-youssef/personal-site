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

The end-to-end tests redirect the frontend's requests for `zyoussef.com` to the local backend, so they never touch the live site.
