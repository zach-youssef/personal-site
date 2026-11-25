// Exits non-zero, with a message, when something already listens on the given port on localhost.
// The end-to-end suite's servers use fixed ports, and Playwright starts them before globalSetup
// runs, so their commands run this first: a run would otherwise fail to bind with an unrelated
// error, or test another checkout's servers.
//   node requireFreePort.mjs <port>
import { connect } from 'node:net';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
    console.error('usage: node requireFreePort.mjs <port>');
    process.exit(2);
}

// A connection that succeeds means a listener. Both loopback addresses, since a server may bind
// only one of them
const listening = host => new Promise(resolve => {
    const socket = connect({ host, port });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
});

const taken = (await Promise.all(['127.0.0.1', '::1'].map(listening))).some(Boolean);
if (taken) {
    console.error(`Port ${port} is already in use, most likely by another checkout's end-to-end run: `
        + `the suite's servers use fixed ports, so runs on one machine take turns. `
        + `Find the process with \`lsof -iTCP:${port} -sTCP:LISTEN\` and stop it, or wait for it.`);
    process.exit(1);
}
