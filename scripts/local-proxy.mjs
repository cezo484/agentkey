// Local forward proxy for Playwright tests in this sandbox.
//
// The VM reaches the internet through an egress proxy that needs
// Proxy-Authorization on the first CONNECT. curl sends it preemptively and
// works; Chromium waits for a 407 first, and the tunnel fails, so the
// sandboxed browser cannot reach any HTTPS host directly through it.
//
// This proxy listens on 127.0.0.1:18080 without auth, adds the upstream
// credentials preemptively, and forwards CONNECT tunnels to the egress
// proxy from the HTTPS_PROXY environment variable. No credential is stored
// in this file. Test-only; real users' browsers connect to the relay
// directly and never need this.
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.AGENTKEY_PROXY_PORT || 18080);

const upstreamRaw = process.env.HTTPS_PROXY || process.env.https_proxy || "";
if (!upstreamRaw) {
  console.error("local-proxy: HTTPS_PROXY is not set, nothing to forward to.");
  process.exit(1);
}
const upstream = new URL(upstreamRaw);
const auth =
  "Basic " +
  Buffer.from(
    `${decodeURIComponent(upstream.username)}:${decodeURIComponent(upstream.password)}`,
  ).toString("base64");

const server = http.createServer((req, res) => {
  // Plain HTTP requests are not expected (localhost bypasses the proxy and
  // every external call in the app is HTTPS), so refuse them plainly.
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("local-proxy only forwards CONNECT tunnels\n");
});

server.on("connect", (req, clientSocket, head) => {
  const target = req.url || "";
  const sock = net.connect(
    Number(upstream.port || 3128),
    upstream.hostname,
    () => {
      sock.write(
        `CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\nProxy-Authorization: ${auth}\r\nProxy-Connection: keep-alive\r\n\r\n`,
      );
    },
  );

  let established = false;
  let buffered = Buffer.alloc(0);

  const fail = () => {
    if (!clientSocket.destroyed) {
      try {
        clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      } catch {
        clientSocket.destroy();
      }
    }
    sock.destroy();
  };

  sock.on("data", (chunk) => {
    if (established) return;
    buffered = Buffer.concat([buffered, chunk]);
    const end = buffered.indexOf("\r\n\r\n");
    if (end === -1) {
      if (buffered.length > 8192) fail();
      return;
    }
    const header = buffered.subarray(0, end).toString();
    if (!/^HTTP\/1\.[01] 200/.test(header)) {
      console.error(`local-proxy: upstream refused CONNECT ${target}: ${header.split("\r\n")[0]}`);
      fail();
      return;
    }
    established = true;
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    const rest = buffered.subarray(end + 4);
    if (rest.length) clientSocket.write(rest);
    if (head && head.length) sock.write(head);
    sock.pipe(clientSocket);
    clientSocket.pipe(sock);
  });

  sock.on("error", fail);
  clientSocket.on("error", () => sock.destroy());
  sock.on("close", () => {
    if (!clientSocket.destroyed) clientSocket.destroy();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`local-proxy listening on 127.0.0.1:${PORT}`);
});
