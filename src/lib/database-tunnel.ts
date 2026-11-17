import { createServer } from "node:net";
import { Client } from "ssh2";

let pending: Promise<number> | undefined;

/** One encrypted connection per warm serverless instance; PostgreSQL stays private. */
export function databaseTunnel(): Promise<number> {
  if (pending) return pending;
  pending = new Promise<number>((resolve, reject) => {
    const server = createServer((socket) => {
      const ssh = new Client();
      socket.on("error", () => ssh.end());
      socket.on("close", () => ssh.end());
      ssh.on("error", () => socket.destroy());
      ssh.on("close", () => socket.destroy());
      ssh.on("ready", () => ssh.forwardOut("127.0.0.1", 0, process.env.DB_SSH_TARGET!, 5432, (error, stream) => {
        if (error) { socket.destroy(error); return; }
        socket.on("error", () => stream.destroy());
        stream.on("error", () => socket.destroy());
        socket.pipe(stream).pipe(socket);
        socket.on("close", () => stream.destroy());
      }));
      ssh.connect({
      host: process.env.DB_SSH_HOST!,
      port: Number(process.env.DB_SSH_PORT || 22),
      username: "tajam-netlify",
      privateKey: Buffer.from(process.env.DB_SSH_KEY_BASE64!, "base64"),
      hostHash: "sha256",
      hostVerifier: (hash: string) => hash === process.env.DB_SSH_HOST_SHA256,
      readyTimeout: 10_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 2,
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      const address = server.address();
      if (address && typeof address !== "string") resolve(address.port);
    });
  });
  pending.catch(() => { pending = undefined; });
  return pending;
}
