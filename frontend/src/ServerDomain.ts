// TODO: Set this flag from build arguments somehow
const isLocalDebug: Boolean = false;

const ServerUrl: String = isLocalDebug ? "localhost:8080" : "zyoussef.com";

export default ServerUrl;