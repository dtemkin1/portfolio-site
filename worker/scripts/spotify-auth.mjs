// One-time Spotify sign-in that saves a refresh token to worker/.dev.vars.
// Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in that file first, and
// http://127.0.0.1:8888/callback added as a redirect URI on the Spotify app.
/* global Buffer, URL, URLSearchParams, console, fetch, process */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const VARS = new URL("../.dev.vars", import.meta.url);
const REDIRECT = "http://127.0.0.1:8888/callback";
const SCOPE = "user-read-currently-playing";

const lines = readFileSync(VARS, "utf8").split(/\r?\n/);
const read = (name) =>
  lines.find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1);
const clientId = read("SPOTIFY_CLIENT_ID");
const clientSecret = read("SPOTIFY_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error(
    "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to worker/.dev.vars first.",
  );
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const signIn = new URL("https://accounts.spotify.com/authorize");
signIn.search = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  scope: SCOPE,
  redirect_uri: REDIRECT,
  state,
}).toString();

const server = createServer(async (request, response) => {
  const url = new URL(request.url, REDIRECT);
  if (url.pathname !== "/callback") return response.writeHead(404).end();

  const code = url.searchParams.get("code");
  if (url.searchParams.get("state") !== state || !code) {
    response
      .writeHead(400)
      .end("Sign-in failed. Close this tab and try again.");
    return;
  }

  const tokens = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
    }),
  }).then((r) => r.json());

  if (!tokens.refresh_token) {
    response.writeHead(500).end("Spotify didn't return a refresh token.");
    console.error("Spotify didn't return a refresh token:", tokens.error);
    process.exit(1);
  }

  const kept = lines.filter(
    (line) => line && !line.startsWith("SPOTIFY_REFRESH_TOKEN="),
  );
  writeFileSync(
    VARS,
    [...kept, `SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`, ""].join("\n"),
  );
  response.end("Signed in. You can close this tab.");
  console.log("Saved SPOTIFY_REFRESH_TOKEN to worker/.dev.vars.");
  server.close();
});

server.listen(8888, "127.0.0.1", () => {
  console.log("Open this link and sign in to Spotify:\n");
  console.log(signIn.href);
});
