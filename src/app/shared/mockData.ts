import type { Talent, PaymentStatus, CardComment, Campaign, RunwayShow, CastingStageId, CastingEntry, Look, CrewMember, CampaignThreadMessage } from "./types";
import { formatCampaignDue } from "../../lib/formatDue";
import coverCrystalPalaceTransept from "../../assets/cover-crystal-palace-transept.jpg";
import galleryDP138588 from "../../assets/gallery/DP138588.jpg";
import galleryDP240624 from "../../assets/gallery/DP240624.jpg";
import galleryDP223650 from "../../assets/gallery/DP223650.jpg";
import galleryDP43768001 from "../../assets/gallery/DP-43768-001.jpg";
import galleryDP152207 from "../../assets/gallery/DP152207.jpg";
import galleryDP273004 from "../../assets/gallery/DP273004.jpg";
import galleryDP113942 from "../../assets/gallery/DP113942.jpg";
import galleryDP200352 from "../../assets/gallery/DP200352.jpg";
import galleryDT1165 from "../../assets/gallery/DT1165.jpg";
import galleryDT4002 from "../../assets/gallery/DT4002.jpg";
import galleryDP70292 from "../../assets/gallery/DP70292.jpg";
import galleryDT223780 from "../../assets/gallery/DT223780.jpg";
import galleryDP139275 from "../../assets/gallery/DP139275.jpg";
import galleryDP139298 from "../../assets/gallery/DP139298.jpg";
import galleryDP221452 from "../../assets/gallery/DP221452.jpg";
import galleryDP115235 from "../../assets/gallery/DP115235.jpg";
import galleryDP107953 from "../../assets/gallery/DP107953.jpg";
import galleryDP107961 from "../../assets/gallery/DP107961.jpg";
import galleryDP17115001 from "../../assets/gallery/DP-17115-001.jpg";
import galleryDP112689 from "../../assets/gallery/DP112689.jpg";
import seuratCover from "../../assets/gallery/seurat-cover.jpg";

// Fixed "today" for demo purposes — drives talent-submission-window open/
// closed state (see Campaign.submissionOpen/submissionClose) and the
// due-date formatting below, without the demo silently drifting as real
// wall-clock time passes.
export const MOCK_NOW = new Date("2026-07-21");

// ─── TALENT / SUBMISSIONS ──────────────────────────────────────────────────
// Simplified pipeline vs. the original prototype: Submitted -> Approved/Rejected -> Booked.
// (Negotiation/counter-offer states are a deliberate Phase-1 cut, not an oversight.)

export const SAMPLE_TALENT: Talent[] = [
  { id:1,  modelId:"mock-1",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Zara Okafor",     agency:"Halstead Model Mgmt.", submittedByName:"", submittedByEmail:"", motherAgency:"Halstead Model Mgmt.", boutiqueAgencies:["Larkspur Models"], duplicateFlag:false, submittedByAgencies:["Halstead Model Mgmt."], location:"New York, NY",    rate:"$980/day",   stage:"approved",  avail:"available", note:"Strong editorial presence.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"8 yrs",  score:5 },
  { id:2,  modelId:"mock-2",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Amara Diallo",    agency:"Halstead Model Mgmt.", submittedByName:"", submittedByEmail:"", motherAgency:"Halstead Model Mgmt.", boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Halstead Model Mgmt."], location:"Paris, FR",       rate:"$1,150/day", stage:"approved",  avail:"available", note:"Approved. Initiating booking.", height:`5'11"`, bust:`34"`, waist:`25"`, dress:"US 4",  exp:"10 yrs", score:5 },
  { id:3,  modelId:"mock-3",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Mila Tran",       agency:"Larkspur Models",        submittedByName:"", submittedByEmail:"", motherAgency:"Larkspur Models",        boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Larkspur Models"], location:"Los Angeles, CA", rate:"$1,100/day", stage:"submitted", avail:"pending",   note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 2",  exp:"6 yrs",  score:4 },
  { id:4,  modelId:"mock-4",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Petra Novak",     agency:"Larkspur Models",        submittedByName:"", submittedByEmail:"", motherAgency:"Northfield Models", boutiqueAgencies:["Larkspur Models"], duplicateFlag:false, submittedByAgencies:["Larkspur Models"], location:"Milan, IT",       rate:"$920/day",   stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 4",  exp:"5 yrs",  score:4 },
  { id:5,  modelId:"mock-5",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Ines Ferreira",   agency:"Northfield Models",      submittedByName:"", submittedByEmail:"", motherAgency:"Northfield Models",      boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Northfield Models"], location:"London, UK",      rate:"$1,340/day", stage:"approved",  avail:"available", note:"Versatile.", height:`6'0"`,  bust:`35"`, waist:`25"`, dress:"US 6",  exp:"9 yrs",  score:5 },
  { id:6,  modelId:"mock-6",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Nadia Petrov",    agency:"Aveline Models",       submittedByName:"", submittedByEmail:"", motherAgency:"Aveline Models",       boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Aveline Models"], location:"New York, NY",    rate:"$1,070/day", stage:"approved",  avail:"pending",   note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:7,  modelId:"mock-7",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Caleb Stone",     agency:"Ashgrove",        submittedByName:"", submittedByEmail:"", motherAgency:"Ashgrove",        boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Ashgrove"], location:"Chicago, IL",     rate:"$890/day",   stage:"submitted", avail:"available", note:"", height:`6'1"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"4 yrs",  score:4 },
  { id:8,  modelId:"mock-8",  photoUrl:"", modelEmail:"", modelPhone:"", name:"Sofia Brandt",    agency:"Cordell Models",        submittedByName:"", submittedByEmail:"", motherAgency:"Cordell Models",        boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Cordell Models"], location:"Miami, FL",       rate:"$1,200/day", stage:"booked",    avail:"available", note:"Contract executed. Shoot 07/22.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"11 yrs", score:5 },
  { id:9,  modelId:"mock-9",  photoUrl:"", modelEmail:"", modelPhone:"", name:"James Whitfield", agency:"Halstead Model Mgmt.", submittedByName:"", submittedByEmail:"", motherAgency:"Halstead Model Mgmt.", boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Halstead Model Mgmt."], location:"New York, NY",    rate:"$950/day",   stage:"booked",    avail:"available", note:"Contract executed. Shoot 07/14.", height:`6'0"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"6 yrs",  score:5 },
  { id:10, modelId:"mock-10", photoUrl:"", modelEmail:"", modelPhone:"", name:"Lena Vogel",      agency:"Larkspur Models",        submittedByName:"", submittedByEmail:"", motherAgency:"Larkspur Models",        boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Larkspur Models"], location:"Berlin, DE",      rate:"$780/day",   stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"3 yrs",  score:3 },
  { id:11, modelId:"mock-11", photoUrl:"", modelEmail:"", modelPhone:"", name:"Amir Hassan",     agency:"Northfield Models",      submittedByName:"", submittedByEmail:"", motherAgency:"Northfield Models",      boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Northfield Models"], location:"London, UK",      rate:"$1,050/day", stage:"rejected",  avail:"unavailable", note:"Does not meet brief requirements.", height:`6'0"`,  bust:`37"`, waist:`29"`, dress:"US L",  exp:"5 yrs",  score:3 },
  { id:12, modelId:"mock-12", photoUrl:"", modelEmail:"", modelPhone:"", name:"Chiara Russo",    agency:"Aveline Models",       submittedByName:"", submittedByEmail:"", motherAgency:"Aveline Models",       boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Aveline Models"], location:"Rome, IT",        rate:"$860/day",   stage:"approved",  avail:"available", note:"Hold as backup.", height:`5'8"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"4 yrs",  score:4 },
  { id:13, modelId:"mock-13", photoUrl:"", modelEmail:"", modelPhone:"", name:"Maya Chen",       agency:"Halstead Model Mgmt.", submittedByName:"", submittedByEmail:"", motherAgency:"Halstead Model Mgmt.", boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Halstead Model Mgmt."], location:"Los Angeles, CA", rate:"$1,080/day", stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:14, modelId:"mock-14", photoUrl:"", modelEmail:"", modelPhone:"", name:"Priya Sharma",    agency:"Cordell Models",        submittedByName:"", submittedByEmail:"", motherAgency:"Cordell Models",        boutiqueAgencies:[], duplicateFlag:false, submittedByAgencies:["Cordell Models"], location:"New York, NY",    rate:"$920/day",   stage:"submitted", avail:"pending",   note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"5 yrs",  score:4 },
];

// Sticky-note-style comments on individual candidate cards — separate
// from each talent's single "Notes" field. Threaded, multi-author.
export const CARD_COMMENTS: CardComment[] = [
  { id:1, talentId:2, author:"Marcus Webb", org:"Vellani", text:"Love the range in her book — strong pick for the hero shot.", ts:"Jun 13, 3:40 PM" },
  { id:2, talentId:2, author:"Jake Torres", org:"Vellani", text:"Agreed. Let's confirm her availability for the 14th before we lock the shortlist.", ts:"Jun 13, 4:02 PM" },
  { id:3, talentId:1, author:"Lena Chu", org:"Vellani", text:"Client specifically asked about her — flagging for priority review.", ts:"Jun 12, 11:15 AM" },
];

export const PIPELINE_STAGES: { id: Talent["stage"]; label: string }[] = [
  { id:"submitted", label:"Submitted" },
  { id:"approved",  label:"Approved"  },
  { id:"booked",    label:"Booked"    },
];

export const DECLINE_REASONS = ["Rate too high","Doesn't meet brief","Look not right","Dates conflict","Client preference","Agency preference","Other"];

// ─── BOOKINGS / PAYMENTS ───────────────────────────────────────────────────
// One shared dataset — Brand, Agency, and Model views each read a different
// slice of the same booking record. This is exactly the shape Supabase's
// `bookings` + `payments` tables take on in Milestone B, and the same
// Gross/Agency-Commission/Platform-Fee/Net-Earnings split Stripe Connect's
// "separate charges and transfers" pattern needs in Milestone C.

export interface Booking {
  id: string;
  campaign: string;
  brand: string;
  agency: string;
  model: string;
  dayRate: number;
  days: number;
  shootDate: string;
  agencyPct: number;   // agency commission, % of model fee
  platformPct: number; // platform fee, % of (model fee + agency fee)
  paymentStatus: PaymentStatus;
}

export function bookingBreakdown(b: Booking) {
  const modelFee = b.dayRate * b.days;
  const agencyFee = Math.round(modelFee * (b.agencyPct / 100));
  const base = modelFee + agencyFee;
  const platformFee = Math.round(base * (b.platformPct / 100));
  const grossBookingValue = base + platformFee;
  return { modelFee, agencyFee, platformFee, grossBookingValue };
}

export const BOOKINGS: Booking[] = [
  { id:"BK-0841", campaign:"AW25 Womenswear Campaign", brand:"Vellani", agency:"Halstead Model Mgmt.", model:"James Whitfield", dayRate:950,  days:3, shootDate:"07/14/2025", agencyPct:20, platformPct:3, paymentStatus:"paid" },
  { id:"BK-0842", campaign:"AW25 Womenswear Campaign", brand:"Vellani", agency:"Halstead Model Mgmt.", model:"Amara Diallo",    dayRate:1150, days:2, shootDate:"07/15/2025", agencyPct:20, platformPct:3, paymentStatus:"processing" },
  { id:"BK-0791", campaign:"SS25 Fragrance Launch",    brand:"Vellani", agency:"Larkspur Models",        model:"Mila Tran",       dayRate:1100, days:1, shootDate:"07/20/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
  { id:"BK-0768", campaign:"FW24 Campaign",            brand:"Vellani", agency:"Cordell Models",        model:"Sofia Brandt",    dayRate:1200, days:3, shootDate:"06/01/2025", agencyPct:20, platformPct:3, paymentStatus:"paid" },
  { id:"BK-0804", campaign:"Resort Lookbook 2025",     brand:"Vellani", agency:"Northfield Models",      model:"Ines Ferreira",   dayRate:1340, days:2, shootDate:"07/22/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
  { id:"BK-0850", campaign:"Resort Lookbook 2025",     brand:"Vellani", agency:"Halstead Model Mgmt.", model:"James Whitfield", dayRate:950,  days:2, shootDate:"07/23/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
];

// ─── ORG / DIRECTORY ────────────────────────────────────────────────────────

export const ORG_USERS = [
  { id:1, name:"Marcus Webb",   title:"Brand Director",    email:"marcus@vellani.com",  phone:"+1 212 555 0100", access:"administrator", group:"Creative Leadership", org:"Vellani"      },
  { id:2, name:"Lena Chu",      title:"Campaign Manager",  email:"lena@vellani.com",    phone:"+1 212 555 0101", access:"enhanced",      group:"Campaign Team",       org:"Vellani"      },
  { id:3, name:"Jake Torres",   title:"Art Director",      email:"jake@vellani.com",    phone:"+1 212 555 0102", access:"enhanced",      group:"Creative Leadership", org:"Vellani"      },
  { id:4, name:"Priya Shah",    title:"Finance Lead",      email:"priya@vellani.com",   phone:"+1 212 555 0103", access:"enhanced",      group:"Finance",             org:"Vellani"      },
  { id:5, name:"Sam Brooks",    title:"Creative Producer", email:"sam@vellani.com",     phone:"+1 212 555 0104", access:"basic",         group:"Campaign Team",       org:"Vellani"      },
  { id:6, name:"Sofia Reyes",   title:"Legal Counsel",     email:"sofia@vellani.com",   phone:"+1 212 555 0105", access:"administrator", group:"Legal",               org:"Vellani"      },
  { id:7, name:"Sophie Chen",   title:"Senior Agent",      email:"sophie@halstead.com", phone:"+1 212 555 0200", access:"enhanced",      group:"Elite Team",          org:"Halstead Model Mgmt." },
  { id:8, name:"James Kirk",    title:"Booking Agent",     email:"james@halstead.com",  phone:"+1 212 555 0201", access:"basic",         group:"Elite Team",          org:"Halstead Model Mgmt." },
];

export const ACCESS_BADGE: Record<string,"active"|"info"|"draft"> = { administrator:"active", enhanced:"info", basic:"draft" };

// ─── ACTIVITY / NOTIFICATIONS ───────────────────────────────────────────────

export const ACTIVITY_EVENTS = [
  { id:1, ts:"Jun 15, 2:05 PM",  actor:"Vellani",      type:"Talent approved",        detail:"Amara Diallo approved for booking.",           system:false },
  { id:2, ts:"Jun 15, 11:20 AM", actor:"Halstead Model Mgmt.", type:"Submission received",    detail:"4 talent submitted to AW25 Womenswear.",       system:false },
  { id:3, ts:"Jun 14, 4:01 PM",  actor:"System",            type:"Contract generated",     detail:"CF-2025-0841 generated for James Whitfield.",  system:true  },
  { id:4, ts:"Jun 14, 3:14 PM",  actor:"Vellani",      type:"Contract signed",        detail:"CF-2025-0841 countersigned by brand.",         system:false },
  { id:5, ts:"Jun 14, 11:30 AM", actor:"Halstead Model Mgmt.", type:"Contract signed",        detail:"Sophie Chen signed CF-2025-0841 for agency.",  system:false },
  { id:6, ts:"Jun 13, 1:22 PM",  actor:"Vellani",      type:"Talent approved",        detail:"Zara Okafor and Ines Ferreira approved.",      system:false },
  { id:7, ts:"Jun 12, 9:00 AM",  actor:"System",            type:"Payout released",        detail:"Halstead Model Mgmt. commission payout $2,940.",  system:true  },
  { id:8, ts:"Jun 10, 11:02 AM", actor:"Halstead Model Mgmt.", type:"Talent submitted",       detail:"4 talent submitted to campaign.",              system:false },
  { id:9, ts:"Jun 10, 9:14 AM",  actor:"System",            type:"Campaign published",     detail:"AW25 Womenswear distributed to 5 agencies.",   system:true  },
];

export const NOTIFS = [
  { id:1, text:"Halstead Model Mgmt. submitted 4 talent", sub:"AW25 Womenswear", ts:"2m ago", unread:true  },
  { id:2, text:"Amara Diallo approved",                 sub:"AW25 Womenswear", ts:"1h ago", unread:true  },
  { id:3, text:"Payout released",                       sub:"Booking #0841",   ts:"3h ago", unread:true  },
  { id:4, text:"Contract awaiting signature",           sub:"CF-2025-0842",    ts:"5h ago", unread:true  },
  { id:5, text:"Resort Lookbook — 6 new submissions",  sub:"Resort Lookbook", ts:"1d ago", unread:false },
];

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────
// Single shared source — Dashboard, CampaignsList, and CampaignWorkspace all
// read the same records instead of each keeping their own inline copy, and
// campaigns are now individually addressable by id.

// Real, public-domain photographs from The Met's Open Access collection —
// Pictorialism/Photo-Secession era (1850-1922). Every file here is a
// LOCAL asset (src/assets/gallery/), downloaded and force-converted to
// true neutral grayscale via PIL, not a live link to Met's own CDN —
// the raw Met files are frequently warm/sepia-toned (period albumen/
// salt prints), and linking directly to them was a real bug: only the
// picker PREVIEWS were ever grayscale-converted, never the production
// source, so the live gallery was showing sepia, not black-and-white.
// Any future addition MUST go through the same local-convert-then-
// import step, never a raw metmuseum.org URL.
const CAMPAIGN_COVER_GALLERY: string[] = [
  galleryDP138588, // Felix Teynard, "Esneh, Dattiers, Sycomore et Cafe Sur le Bord du Nil", 1851-54
  galleryDP240624, // Gustave Le Gray, "Brig on the Water", 1856
  galleryDP223650, // Gustave Le Gray, "[The Great Wave, Sete]", 1857
  galleryDP43768001, // Edouard Baldus, "Panorama de la Cite", 1860s
  coverCrystalPalaceTransept, // Hugh Owen, "View of Transept, Looking South", 1851
  galleryDP152207, // Carleton E. Watkins, "South Dome, 6,000 feet", ca. 1872
  galleryDP273004, // Charles Marville, "[Cloud Study over Paris]", 1856-57
  galleryDP113942, // Alfred Capel Cure, "Haughmond Abbey", 1858
  galleryDP200352, // Charles Marville, "La Bievre", ca. 1862
  galleryDT1165, // Edouard Baldus, "[Entrance to the Port of Boulogne]", 1855
  galleryDT4002, // Gustave Le Gray, "Mediterranean with Mount Agde", 1857
  galleryDP70292, // Charles Marville, "Allee bordee d'arbres", 1850-53
  galleryDT223780, // Constant Alexandre Famin, "[Man in a Forest Landscape]", ca. 1870
  galleryDP139275, // Edmond Bacot, "Vue generale de Rouen", 1852-54
  galleryDP139298, // Edmond Bacot, "Rue des Petits Murs, Caen", 1852-54
  galleryDP221452, // Joseph Vigier, "Sentier du chaos, St-Sauveur", 1853
  galleryDP115235, // Unknown, "[St. Pierre, Caen]", 1850s
  galleryDP107953, // Roger Fenton, "[Landscape with Clouds]", probably 1856
  galleryDP107961, // Roger Fenton, "Wharfe and Pool, Below the Strid", 1854
  galleryDP17115001, // John Beasley Greene, "[The Nile in front of the Theban Hills]", 1853-54
  galleryDP112689, // Francis Bedford, "Clovelly, The New Inn and Street", 1870s
];

// Assigns every campaign in one rendered list a DISTINCT photo — not just
// "deterministic by id" (the earlier version), which let two different
// ids collide on the same modulo bucket and show the identical photo on
// two cards at once. Walks forward to the next free slot on a collision.
// Still deterministic given a stable campaign order, still no
// Math.random() reshuffling on re-render.
export function assignCampaignCovers(ids: number[]): Map<number, string> {
  const n = CAMPAIGN_COVER_GALLERY.length;
  const used = new Set<number>();
  const result = new Map<number, string>();
  for (const id of ids) {
    let idx = ((id % n) + n) % n;
    while (used.has(idx)) idx = (idx + 1) % n;
    used.add(idx);
    result.set(id, CAMPAIGN_COVER_GALLERY[idx]);
  }
  return result;
}

export const CAMPAIGNS: Campaign[] = [
  { id:1, name:"AW25 Womenswear Campaign", type:"Campaign",     status:"active",   due:formatCampaignDue("2026-07-22", MOCK_NOW), dueDateISO:"2026-07-22", dueLabel:"Due tomorrow",     dueUrgency:"high",   submitted:14, approved:6,  booked:2, talentNeeded:4, budget:18000, committed:5150,  remaining:12850, submissionOpen:"May 1, 2026",  submissionClose:"Aug 15, 2026", coverPhoto:seuratCover /* Seurat, "Landscape at Saint-Ouen" — The Met, public domain — force-converted to true grayscale locally, same as the rest of the gallery (the raw file has a visible color cast) */ },
  { id:2, name:"SS25 Fragrance Launch",    type:"Campaign",     status:"active",   due:formatCampaignDue("2026-07-26", MOCK_NOW), dueDateISO:"2026-07-26", dueLabel:"5 days remaining", dueUrgency:"medium", submitted:9,  approved:4,  booked:0, talentNeeded:2, budget:10000, committed:0,     remaining:10000, submissionOpen:"May 15, 2026", submissionClose:"Jul 25, 2026" },
  { id:3, name:"Resort Lookbook 2025",     type:"Campaign",     status:"active",   due:formatCampaignDue("2026-08-04", MOCK_NOW), dueDateISO:"2026-08-04", dueLabel:"14 days",          dueUrgency:"low",    submitted:21, approved:7,  booked:0, talentNeeded:3, budget:7000,  committed:0,     remaining:7000,  submissionOpen:"Jun 1, 2026",  submissionClose:"Aug 10, 2026" },
  { id:4, name:"FW24 Campaign",            type:"Campaign",     status:"archived", due:formatCampaignDue("2025-12-20", MOCK_NOW), dueDateISO:"2025-12-20", dueLabel:"Archived",         dueUrgency:"low",    submitted:41, approved:11, booked:3, talentNeeded:4, budget:15000, committed:15000, remaining:0,     submissionOpen:"Nov 1, 2025",  submissionClose:"Dec 15, 2025" },
  { id:5, name:"AW26 Runway Presentation", type:"Runway",       status:"active",   due:formatCampaignDue("2026-08-25", MOCK_NOW), dueDateISO:"2026-08-25", dueLabel:"5 weeks out",      dueUrgency:"medium", submitted:12, approved:8,  booked:6, talentNeeded:6, budget:42000, committed:26000, remaining:16000, submissionOpen:"Jun 1, 2026",  submissionClose:"Sep 30, 2026", runwayShowId:1 },
];

// One organization = one team = one home country, per the "a luxury
// house's Berlin office and its Portugal office are separate logins"
// rule — an org never carries multiple flags; a brand/agency that
// operates in several countries is modeled as separate organizations,
// not one org with a country list.
export const ORG_COUNTRY: Record<string, string> = {
  "Vellani": "SE",
  "Halstead Model Mgmt.": "US",
  "Larkspur Models": "US",
  "Northfield Models": "UK",
  "Ashgrove": "US",
  "Cordell Models": "US",
  "Aveline Models": "US",
};

// ─── CAMPAIGN MESSAGING ─────────────────────────────────────────────────
// Which agencies are distributed on (invited to) a given campaign — the
// actual access gate for who can message the brand about it. Keyed by
// campaign id.
export const CAMPAIGN_AGENCIES: Record<number, string[]> = {
  1: ["Halstead Model Mgmt.", "Larkspur Models", "Northfield Models", "Ashgrove", "Cordell Models", "Aveline Models"],
  2: ["Halstead Model Mgmt.", "Larkspur Models"],
  3: ["Halstead Model Mgmt.", "Cordell Models", "Aveline Models"],
  5: ["Halstead Model Mgmt.", "Larkspur Models", "Northfield Models"],
};

// campaignId -> agency name -> that agency's private thread with the
// brand. Two agencies on the same campaign never share a thread. A
// message with broadcast:true was sent once by the brand to every
// agency's thread on that campaign at once (see sendCampaignBroadcast
// pattern used in BrandApp's Collaboration tab) — the one deliberate
// exception to threads being fully separate, for "call time changed"
// style logistics that need to reach everyone.
export const CAMPAIGN_AGENCY_THREADS: Record<number, Record<string, CampaignThreadMessage[]>> = {
  1: {
    "Halstead Model Mgmt.": [
      { id:1, from:"Sophie Chen", fromOrg:"Halstead Model Mgmt.", text:"Hi team — confirming Amara is available the full shoot window.", ts:"Jun 19, 10:05 AM" },
      { id:2, from:"Marcus Webb", fromOrg:"Vellani", text:"Perfect, thank you. We'll have contracts out today.", ts:"Jun 19, 10:40 AM" },
    ],
    "Larkspur Models": [
      { id:1, from:"Diana Park", fromOrg:"Larkspur Models", text:"Following up on rates for Mila and Petra's bookings.", ts:"Jun 17, 4:05 PM" },
    ],
    "Northfield Models": [],
    "Ashgrove": [],
    "Cordell Models": [],
    "Aveline Models": [],
  },
};

// ─── RUNWAY ─────────────────────────────────────────────────────────────────

// The physical show — not owned by any one brand. Vellani's campaign
// references it; otherBrands is read-only context proving the same show
// serves multiple brands independently, without pretending this brand can
// see into another brand's actual campaign (that'd be a real data-isolation
// bug, not a feature).
export const RUNWAY_SHOWS: RunwayShow[] = [
  { id:1, name:"New York Fashion Week — Day 3", venue:"Spring Studios", date:"02/14/2026", time:"18:00", timeZone:"ET", season:"AW26" },
];
export const RUNWAY_SHOW_OTHER_BRANDS: Record<number, string[]> = {
  1: ["Nocturne House", "Rivet & Sable"],
};

export const CASTING_STAGES: { id: CastingStageId; label: string }[] = [
  { id:"confirmed",         label:"Confirmed"          },
  { id:"optioned",          label:"Optioned"           },
  { id:"fittingComplete",   label:"Fitting Complete"   },
  { id:"rehearsalComplete", label:"Rehearsal Complete" },
  { id:"checkedIn",         label:"Checked In"         },
  { id:"walked",            label:"Walked"             },
  { id:"wrapComplete",      label:"Wrap Complete"      },
];

const allStages = (v: boolean) => CASTING_STAGES.reduce((acc,s) => ({ ...acc, [s.id]: v }), {} as Record<CastingStageId, boolean>);

export const CASTING_ENTRIES: CastingEntry[] = [
  { modelId:1,  campaignId:5, stages:{ ...allStages(true), checkedIn:false, walked:false, wrapComplete:false } },   // Zara Okafor — mid-progress
  { modelId:2,  campaignId:5, stages:{ ...allStages(true), wrapComplete:false } },                                  // Amara Diallo — near done
  { modelId:5,  campaignId:5, stages:{ ...allStages(false), confirmed:true, optioned:true } },                     // Ines Ferreira — early
  { modelId:6,  campaignId:5, stages:{ ...allStages(false), confirmed:true } },                                     // Nadia Petrov — just confirmed
  { modelId:12, campaignId:5, stages:{ ...allStages(false), confirmed:true, optioned:true, fittingComplete:true } },// Chiara Russo
  { modelId:9,  campaignId:5, stages:allStages(true) },                                                             // James Whitfield — fully wrapped
];

export const CREW: CrewMember[] = [
  { id:1,  name:"Priya Anand",    role:"hair" },
  { id:2,  name:"Marcus Reyes",   role:"hair" },
  { id:3,  name:"Dana Kwon",      role:"makeup" },
  { id:4,  name:"Théo Laurent",   role:"makeup" },
  { id:5,  name:"Ola Bello",      role:"dresser" },
  { id:6,  name:"Ren Fischer",    role:"dresser" },
  { id:7,  name:"Ibrahim Sy",     role:"photographer" },
  { id:8,  name:"Grace Whitman",  role:"production" },
  { id:9,  name:"Diego Cruz",     role:"security" },
  { id:10, name:"Nia Okoro",      role:"transportation" },
];

export const LOOKS: Look[] = [
  { id:1, campaignId:5, number:1, garments:"Ivory wool coat, black tailored trouser", shoes:"Black leather knee boot", jewelry:"Silver cuff", accessories:"Structured leather clutch", stylistNotes:"Lead look — check coat drape under stage lights.", dressingNotes:"Quick-change collar clip, no zipper.", assignedModelId:1, assignedHairId:1, assignedMakeupId:3, assignedDresserId:5 },
  { id:2, campaignId:5, number:2, garments:"Charcoal silk slip dress", shoes:"Nude satin pump", jewelry:"Drop earrings", accessories:"—", stylistNotes:"Steam before line-up, wrinkles easily.", dressingNotes:"Zip back, model needs help — allow 90 sec.", assignedModelId:2, assignedHairId:2, assignedMakeupId:3, assignedDresserId:5 },
  { id:3, campaignId:5, number:3, garments:"Cream cable knit sweater, wide-leg trouser", shoes:"White leather loafer", jewelry:"—", accessories:"Wool scarf, draped", assignedModelId:5, assignedHairId:1, assignedMakeupId:4, assignedDresserId:6, stylistNotes:"Scarf drape must match lookbook reference photo.", dressingNotes:"Pre-drape scarf backstage, pin in place." },
  { id:4, campaignId:5, number:4, garments:"Black leather trench", shoes:"Black combat boot", jewelry:"Chain belt", accessories:"Gloves", assignedModelId:6, assignedHairId:2, assignedMakeupId:4, assignedDresserId:6, stylistNotes:"Belt cinch — confirm waist measurement day-of.", dressingNotes:"Gloves on last, right before line-up." },
  { id:5, campaignId:5, number:5, garments:"Emerald green satin gown", shoes:"Metallic stiletto", jewelry:"Statement necklace", accessories:"—", assignedModelId:12, assignedHairId:1, assignedMakeupId:3, assignedDresserId:5, stylistNotes:"Train needs a handler at the top of the runway.", dressingNotes:"Necklace clasp is delicate — two-person dress." },
  { id:6, campaignId:5, number:6, garments:"Tailored pinstripe suit", shoes:"Black oxford", jewelry:"Cufflinks", accessories:"Pocket square", assignedModelId:9, assignedHairId:2, assignedMakeupId:4, assignedDresserId:6, stylistNotes:"Closing look — full lights, hold center stage 3 extra counts.", dressingNotes:"Pocket square folded on-site, not pre-set." },
];
