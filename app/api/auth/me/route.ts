import { authorize } from "../../../lib/auth";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  return Response.json(auth.user);
}
