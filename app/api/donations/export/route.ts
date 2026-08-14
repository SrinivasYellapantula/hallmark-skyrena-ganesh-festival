import writeXlsxFile from "write-excel-file";
import { getD1 } from "../../../../db";
import { ensureDatabase } from "../../../../db/initialize";
import { authorize } from "../../../lib/auth";
import { BLOCKS, EVENT_ID } from "../../../lib/constants";
import { normalizeFlatNo } from "../../../lib/server";

type DonationRecord = {
  referenceNo: string;
  residentName: string;
  blockNo: string;
  flatNo: string;
  occupancy: string;
  phone: string | null;
  status: string;
  createdAt: string;
  festivalAmount: number;
  idolAmount: number;
  mahaprasadamAmount: number;
  totalAmount: number;
  inOccupiedMaster: number;
};

type FlatExport = {
  blockNo: string;
  flatNo: string;
  residentName: string;
  occupancy: string;
  phone: string;
  donationCount: number;
  festivalAmount: number;
  idolAmount: number;
  mahaprasadamAmount: number;
  totalAmount: number;
  statuses: Set<string>;
  latestDonation: string;
  references: string[];
  inOccupiedMaster: boolean;
};

const HEADER_STYLE = { backgroundColor: "#466A4A", color: "#FFFFFF", fontWeight: "bold", align: "center" as const, alignVertical: "center" as const, wrap: true };
const CURRENCY_FORMAT = "₹#,##0";
const COLUMN_WIDTHS = [14, 25, 14, 16, 13, 14, 14, 18, 18, 20, 18, 30, 19].map((width) => ({ width }));

export async function GET(request: Request) {
  const auth = await authorize(request, ["admin", "block"]);
  if ("response" in auth) return auth.response;

  await ensureDatabase();
  const d1 = getD1();
  const blockClause = auth.user.role === "block" ? "AND r.block_no=?" : "";
  const statement = d1.prepare(`SELECT r.reference_no referenceNo, r.resident_name residentName,
    r.block_no blockNo, r.flat_no flatNo, r.occupancy, r.phone, r.status, r.created_at createdAt,
    SUM(CASE WHEN d.category='festival' THEN d.amount ELSE 0 END) festivalAmount,
    SUM(CASE WHEN d.category='idol' THEN d.amount ELSE 0 END) idolAmount,
    SUM(CASE WHEN d.category='annadaanam' THEN d.amount ELSE 0 END) mahaprasadamAmount,
    SUM(d.amount) totalAmount,
    CASE WHEN EXISTS (
      SELECT 1 FROM flats f WHERE f.event_id=r.event_id AND f.occupied=1
        AND UPPER(TRIM(f.block_no))=UPPER(TRIM(r.block_no))
        AND CASE
          WHEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),1,1)=UPPER(TRIM(f.block_no))
            AND SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),2,1) BETWEEN '0' AND '9'
          THEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ',''),2)
          ELSE REPLACE(REPLACE(UPPER(TRIM(f.flat_no)),'-',''),' ','') END
        = CASE
          WHEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),1,1)=UPPER(TRIM(r.block_no))
            AND SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),2,1) BETWEEN '0' AND '9'
          THEN SUBSTR(REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ',''),2)
          ELSE REPLACE(REPLACE(UPPER(TRIM(r.flat_no)),'-',''),' ','') END
    ) THEN 1 ELSE 0 END inOccupiedMaster
    FROM registrations r JOIN donations d ON d.registration_id=r.id
    WHERE r.event_id=? AND r.status!='cancelled' ${blockClause}
    GROUP BY r.id ORDER BY r.created_at DESC`);
  const query = auth.user.role === "block"
    ? await statement.bind(EVENT_ID, auth.user.blockNo).all<DonationRecord>()
    : await statement.bind(EVENT_ID).all<DonationRecord>();

  const byBlock = groupByDonatedFlat(query.results ?? []);
  const exportBlocks = auth.user.role === "block"
    ? [auth.user.blockNo as (typeof BLOCKS)[number]]
    : [...BLOCKS];
  const sheets = exportBlocks.map((block) => createSheet(block, byBlock.get(block) ?? []));
  const columns = exportBlocks.map(() => COLUMN_WIDTHS);
  const workbook = await writeXlsxFile(sheets, {
    sheets: exportBlocks.map((block) => `Block ${block}`),
    columns,
    stickyRowsCount: 4,
    fontFamily: "Arial",
    fontSize: 10,
    showGridLines: false,
    orientation: "landscape",
  });
  const scope = auth.user.role === "block" ? `block-${auth.user.blockNo.toLowerCase()}` : "all-blocks";
  const filename = `hallmark-skyrena-donated-flats-${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(await workbook.arrayBuffer(), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

function groupByDonatedFlat(records: DonationRecord[]) {
  const grouped = new Map<string, FlatExport>();
  for (const record of records) {
    const blockNo = String(record.blockNo).trim().toUpperCase();
    const flatNo = normalizeFlatNo(record.flatNo, blockNo);
    const key = `${blockNo}:${flatNo}`;
    const current = grouped.get(key);
    if (current) {
      current.donationCount += 1;
      current.festivalAmount += Number(record.festivalAmount) || 0;
      current.idolAmount += Number(record.idolAmount) || 0;
      current.mahaprasadamAmount += Number(record.mahaprasadamAmount) || 0;
      current.totalAmount += Number(record.totalAmount) || 0;
      current.statuses.add(record.status);
      current.references.push(record.referenceNo);
      current.inOccupiedMaster ||= Boolean(record.inOccupiedMaster);
      continue;
    }
    grouped.set(key, {
      blockNo,
      flatNo,
      residentName: record.residentName,
      occupancy: record.occupancy || "Not recorded",
      phone: record.phone || "Not recorded",
      donationCount: 1,
      festivalAmount: Number(record.festivalAmount) || 0,
      idolAmount: Number(record.idolAmount) || 0,
      mahaprasadamAmount: Number(record.mahaprasadamAmount) || 0,
      totalAmount: Number(record.totalAmount) || 0,
      statuses: new Set([record.status]),
      latestDonation: record.createdAt,
      references: [record.referenceNo],
      inOccupiedMaster: Boolean(record.inOccupiedMaster),
    });
  }

  const byBlock = new Map<string, FlatExport[]>();
  for (const flat of grouped.values()) {
    const list = byBlock.get(flat.blockNo) ?? [];
    list.push(flat);
    byBlock.set(flat.blockNo, list);
  }
  for (const list of byBlock.values()) list.sort((a, b) => flatSort(a.flatNo) - flatSort(b.flatNo));
  return byBlock;
}

function createSheet(block: string, flats: FlatExport[]) {
  const title = `Donated Flats — Block ${block}`;
  const generated = `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Unique donated flats: ${flats.length} · Includes active records awaiting verification.`;
  const headers = ["Flat Number", "Resident Name", "Occupancy", "Phone", "Donation Entries", "Festival Donation", "Idol Donation", "Mahaprasadam Support", "Total Contribution", "Verification Status", "Latest Donation", "Reference Number(s)", "Occupied-Flat Master"];
  const rows = flats.map((flat) => [
    textCell(flat.flatNo), textCell(flat.residentName), textCell(titleCase(flat.occupancy)), textCell(flat.phone),
    numberCell(flat.donationCount, "#,##0"), numberCell(flat.festivalAmount), numberCell(flat.idolAmount),
    numberCell(flat.mahaprasadamAmount), numberCell(flat.totalAmount), textCell(verificationStatus(flat.statuses)),
    textCell(flat.latestDonation.slice(0, 10)), textCell(flat.references.join(", ")), textCell(flat.inOccupiedMaster ? "Included" : "Outside master"),
  ]);
  if (!rows.length) rows.push([{ value: "No donations recorded for this block.", span: headers.length, color: "#746B61", fontStyle: "italic" }, ...Array(headers.length - 1).fill(null)]);
  return [
    [{ value: title, span: headers.length, backgroundColor: "#B43120", color: "#FFFFFF", fontWeight: "bold", fontSize: 16, height: 30 }, ...Array(headers.length - 1).fill(null)],
    [{ value: generated, span: headers.length, backgroundColor: "#FFF4DA", color: "#554638", fontSize: 9, height: 24 }, ...Array(headers.length - 1).fill(null)],
    Array(headers.length).fill(null),
    headers.map((value) => ({ value, ...HEADER_STYLE, height: 32 })),
    ...rows,
  ];
}

function textCell(value: string) {
  return { value: String(value ?? ""), type: String, format: "@", wrap: true, alignVertical: "top" as const };
}

function numberCell(value: number, format = CURRENCY_FORMAT) {
  return { value: Number(value) || 0, type: Number, format, align: "right" as const };
}

function verificationStatus(statuses: Set<string>) {
  if ([...statuses].every((status) => status === "verified")) return "Verified";
  if (statuses.has("correction_requested")) return "Correction requested";
  if (statuses.has("verified")) return "Partly verified";
  return "Pending verification";
}

function titleCase(value: string) {
  if (!value || value === "Not recorded") return "Not recorded";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function flatSort(flatNo: string) {
  const normalized = flatNo.trim().toUpperCase();
  if (normalized.startsWith("G")) return Number(normalized.slice(1)) || 0;
  return (Number(normalized) || 99999) + 100;
}
