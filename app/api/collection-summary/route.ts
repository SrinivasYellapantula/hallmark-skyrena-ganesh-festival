import { getD1 } from "../../../db";
import { ensureDatabase } from "../../../db/initialize";
import { authorize } from "../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../lib/constants";

type OccupancyRow = { blockNo: string; occupiedFlats: number; donatedOccupiedFlats: number };
type CollectionRow = {
  blockNo: string;
  donatedFlats: number;
  totalCollection: number;
  verifiedCollection: number;
  festivalCollection: number;
  mahaprasadamCollection: number;
  maximumDonation: number;
  averageDonation: number;
};

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin", "block"]);
  if ("response" in auth) return auth.response;
  await ensureDatabase();

  const blockFilter = auth.user.role === "block" ? "AND f.block_no = ?" : "";
  const registrationFilter = auth.user.role === "block" ? "AND r.block_no = ?" : "";
  const d1 = getD1();

  const occupancyStatement = d1.prepare(
    `SELECT f.block_no blockNo, COUNT(*) occupiedFlats,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM registrations r JOIN donations d ON d.registration_id=r.id
        WHERE r.event_id=f.event_id AND r.block_no=f.block_no AND r.flat_no=f.flat_no
          AND r.status!='cancelled' AND d.status!='reversed' AND d.amount>0
      ) THEN 1 ELSE 0 END) donatedOccupiedFlats
     FROM flats f WHERE f.event_id=? AND f.occupied=1 ${blockFilter}
     GROUP BY f.block_no ORDER BY f.block_no`,
  );

  const collectionStatement = d1.prepare(
    `WITH registration_totals AS (
       SELECT r.block_no blockNo,r.flat_no flatNo,r.id,
         SUM(CASE WHEN d.status!='reversed' THEN d.amount ELSE 0 END) totalCollection,
         SUM(CASE WHEN r.status='verified' AND d.status='verified' THEN d.amount ELSE 0 END) verifiedCollection,
         SUM(CASE WHEN d.status!='reversed' AND d.category='festival' THEN d.amount ELSE 0 END) festivalCollection,
         SUM(CASE WHEN d.status!='reversed' AND d.category='annadaanam' THEN d.amount ELSE 0 END) mahaprasadamCollection
       FROM registrations r JOIN donations d ON d.registration_id=r.id
       WHERE r.event_id=? AND r.status!='cancelled' ${registrationFilter}
       GROUP BY r.id
     ), flat_totals AS (
       SELECT blockNo,flatNo,SUM(totalCollection) totalCollection,
         SUM(verifiedCollection) verifiedCollection,SUM(festivalCollection) festivalCollection,
         SUM(mahaprasadamCollection) mahaprasadamCollection
       FROM registration_totals GROUP BY blockNo,flatNo HAVING SUM(totalCollection)>0
     )
     SELECT blockNo,COUNT(*) donatedFlats,
       COALESCE(SUM(totalCollection),0) totalCollection,
       COALESCE(SUM(verifiedCollection),0) verifiedCollection,
       COALESCE(SUM(festivalCollection),0) festivalCollection,
       COALESCE(SUM(mahaprasadamCollection),0) mahaprasadamCollection,
       COALESCE(MAX(totalCollection),0) maximumDonation,
       COALESCE(ROUND(AVG(totalCollection)),0) averageDonation
     FROM flat_totals GROUP BY blockNo ORDER BY blockNo`,
  );

  const bindings = auth.user.role === "block" ? [EVENT_ID, auth.user.blockNo] : [EVENT_ID];
  const collectionBindings = auth.user.role === "block" ? [EVENT_ID, auth.user.blockNo] : [EVENT_ID];
  const [occupancy, collections] = await Promise.all([
    occupancyStatement.bind(...bindings).all<OccupancyRow>(),
    collectionStatement.bind(...collectionBindings).all<CollectionRow>(),
  ]);

  const occupancyByBlock = new Map(occupancy.results.map((row) => [row.blockNo, row]));
  const collectionByBlock = new Map(collections.results.map((row) => [row.blockNo, row]));
  const visibleBlocks = auth.user.role === "block" ? [String(auth.user.blockNo)] : [...BLOCKS];
  const blocks = visibleBlocks.map((blockNo) => {
    const occupied = occupancyByBlock.get(blockNo);
    const collection = collectionByBlock.get(blockNo);
    const occupiedFlats = Number(occupied?.occupiedFlats ?? 0);
    const donatedFlats = Number(occupied?.donatedOccupiedFlats ?? 0);
    return {
      blockNo,
      occupiedFlats,
      donatedFlats,
      pendingFlats: Math.max(occupiedFlats - donatedFlats, 0),
      totalCollection: Number(collection?.totalCollection ?? 0),
      verifiedCollection: Number(collection?.verifiedCollection ?? 0),
      festivalCollection: Number(collection?.festivalCollection ?? 0),
      mahaprasadamCollection: Number(collection?.mahaprasadamCollection ?? 0),
      maximumDonation: Number(collection?.maximumDonation ?? 0),
      averageDonation: Number(collection?.averageDonation ?? 0),
    };
  });

  const totalOccupied = blocks.reduce((sum, block) => sum + block.occupiedFlats, 0);
  const totalDonated = blocks.reduce((sum, block) => sum + block.donatedFlats, 0);
  const totalCollection = blocks.reduce((sum, block) => sum + block.totalCollection, 0);
  const overall = {
    blockNo: "Overall",
    occupiedFlats: totalOccupied,
    donatedFlats: totalDonated,
    pendingFlats: Math.max(totalOccupied - totalDonated, 0),
    totalCollection,
    verifiedCollection: blocks.reduce((sum, block) => sum + block.verifiedCollection, 0),
    festivalCollection: blocks.reduce((sum, block) => sum + block.festivalCollection, 0),
    mahaprasadamCollection: blocks.reduce((sum, block) => sum + block.mahaprasadamCollection, 0),
    maximumDonation: Math.max(0, ...blocks.map((block) => block.maximumDonation)),
    averageDonation: totalDonated ? Math.round(totalCollection / totalDonated) : 0,
  };

  return Response.json({ user: auth.user, blocks, overall });
}
