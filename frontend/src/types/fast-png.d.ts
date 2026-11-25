// fast-png's types are reachable only through its package.json "exports", which the "node" module
// resolution in tsconfig.json ignores ("bundler" would read them, but react-hook-form 7's types
// break under it), so they are pointed at here
declare module 'fast-png' {
    export * from 'fast-png/lib/index';
}
