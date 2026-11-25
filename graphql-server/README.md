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

## Ktor 3 and coroutine gotchas

- **A failure while reading a multipart body cancels the whole call.** `receiveMultipart` parses in a coroutine of the scope it's called in, so a malformed body fails that scope before the handler can answer; receive and read the parts inside `supervisorScope { }` and catch the failure around it.
- **`RequestBodyLimit` refuses a Content-Length over its limit before the handler runs**, with an empty 413. For a limit the client gets a message for, cap the body in a route-scoped plugin on `ReceiveRequestBytes` and answer from the handler.
- **`copyAndClose` into a channel made by `reader { }` (`File.writeChannel()` among them) returns only once the reader's job ends**, and a write failure surfaces as the copy's failure, indistinguishable from a failed read of the source. Copy with a loop of your own to tell them apart.
- **`ImageIO.write(image, "png", file)` deletes `file` first**, so a failed write leaves no file rather than the old one.
- **`withTimeoutOrNull(t) { acquire() } == null` doesn't prove the acquire failed.** A block that suspended (waiting for the permit) and then finishes after the timeout has fired comes back as null, its result dropped, so a permit taken that way leaks. Record success in a variable the block sets once it has the permit. (A block that never suspended returns its value even past the timeout: kotlinx ignores a timeout that fires during an undispatched run.)

## Testing

```
./gradlew test
```

`test/ApplicationTest.kt` runs the real module over HTTP with Ktor's `testApplication`, through the `withApp` helper. Things to know when adding a test:

- `testApplication` loads `application.conf` itself, which installs the module a second time (DuplicatePluginException), so `withApp` sets its own config (`MapApplicationConfig`) before `application { module(testing = true) }`. Pass any config keys a test needs to `withApp`.
- The default client follows redirects; `withApp`'s doesn't, so tests see the 301s.
- Multipart uploads go through `client.submitFormWithBinaryData(formData { ... })`; read bodies with `bodyAsText()` / `bodyAsBytes()`.
- A test written `fun name() = runBlocking { ... }` must be declared `: Unit` when the block's last expression isn't `Unit` (an assertion that returns its value): JUnit 4 (`kotlin("test-junit")`) fails a test method that returns a value with `initializationError: Method <name>() should be void`.
- A test of a timeout race (an operation finishing just as `withTimeoutOrNull` fires) needs a fake that suspends first and then finishes past the timeout without suspending, such as a real `acquire()` followed by `Thread.sleep`: a fake that never suspends gets its value back, timeout or not (see above).
- Tests that need the gitignored frontend build or ZGAL's docs stand in files of their own (`withFrontendFile`) and remove them afterwards.

The tests at the end of `ApplicationTest` characterize behaviour that the port to Ktor 3 and the KGraphQL fork kept (GraphQL error shapes, enum and variable coercion, 404s, HEAD): change one only on purpose, and say so in the commit message.
