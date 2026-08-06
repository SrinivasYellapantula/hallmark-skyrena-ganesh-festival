import { getAppUser, isPortalOwner } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getAppUser(request);
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  return Response.json({ ...user, portalOwner: isPortalOwner(user) });
}
