import { OAuth2Client } from "google-auth-library";

const getGoogleClientIds = () =>
  (process.env.GOOGLE_CLIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const verifyGoogleIdToken = async (idToken) => {
  const audiences = getGoogleClientIds();

  if (!audiences.length) {
    throw new Error("GOOGLE_CLIENT_IDS is not configured on the server");
  }

  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub) {
    throw new Error("Invalid Google token payload");
  }

  if (!payload.email) {
    throw new Error("Google account email is required");
  }

  if (payload.email_verified === false) {
    throw new Error("Google email is not verified");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.given_name || payload.email.split("@")[0],
    picture: payload.picture || null,
  };
};
