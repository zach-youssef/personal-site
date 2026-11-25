# zyoussef.com Backend

The site's backend: a [Ktor](https://ktor.io) 3.6.1 server (Netty engine) in Kotlin 2.4.21 that serves the frontend's build, the assets and the GraphQL API, and carves images for the Seam Carver page. GraphQL runs on [KGraphQL](https://github.com/stuebingerb/KGraphQL), the maintained fork `de.stuebingerb:kgraphql` (the original `com.apurebase:kgraphql` stopped at Ktor 2).

The build uses a JDK 21 toolchain (`jvmToolchain(21)`), so building needs a JDK 21 installed (no toolchain resolver is configured to download one) and its classes need Java 21 to run, on the server too.

## Building & Running

```
./gradlew run       # serves on port 8080 (or $PORT), from this directory
./gradlew fatJar    # build/libs/*-standalone.jar, which ./bundle ships
```

The server reads files relative to its working directory: `assets/`, the frontend's `build/` (which `./bundle` fills) and `resources/` (config, Sokoban levels).

`/graphql` answers GraphQL POSTs; opened in a browser (GET) it shows GraphiQL, KGraphQL's playground, which loads its scripts from a CDN.

## Static files

`src/Application.kt` serves `/assets` and ZGAL's documentation (`/zgal/docs`) with Ktor's `staticFiles`, and the frontend's top-level files and its page (for any other path) with explicit GET routes, so only the listed files of `build/` are served.

- `staticFiles`' `contentType { }` types `.zgal` as UTF-8 text; returning null from it keeps the type Ktor guesses from the extension (e.g. `application/wasm`).
- `/assets` serves no directory index (`index = null`), and HEAD requests answer 404 (no automatic HEAD responses), as before Ktor 3; tests pin both.
- Caching is set in one place, the `CachingHeaders` plugin (`cachingOptions`): pages are revalidated on every visit, other files may be reused for a day. Files carry Last-Modified, so revalidation gets a 304.

## Testing

```
./gradlew test
```

`test/ApplicationTest.kt` runs the real module over HTTP with Ktor's `testApplication`, through the `withApp` helper. Things to know when adding a test:

- `testApplication` loads `application.conf` itself, which installs the module a second time (DuplicatePluginException), so `withApp` sets its own config (`MapApplicationConfig`) before `application { module(testing = true) }`. Pass config keys to `withApp`, e.g. `seamcarver.uploadDir`, the directory uploads are written to while they're carved (the system's temporary directory when unset), which a test sets to check that none is left behind.
- The default client follows redirects; `withApp`'s doesn't, so tests see the 301s.
- Multipart uploads go through `client.submitFormWithBinaryData(formData { ... })`; read bodies with `bodyAsText()` / `bodyAsBytes()`.
- Tests that need the gitignored frontend build or ZGAL's docs stand in files of their own (`withFrontendFile`) and remove them afterwards.

The tests at the end of `ApplicationTest` characterize behaviour that the port to Ktor 3 and the KGraphQL fork kept (GraphQL error shapes, enum and variable coercion, 404s, HEAD): change one only on purpose, and say so in the commit message.
