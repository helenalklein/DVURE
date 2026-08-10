import type { Talent, PaymentStatus, CardComment, Campaign, RunwayShow, Look, CrewMember, CampaignThreadMessage } from "./types";
import { formatCampaignDue } from "../../lib/formatDue";
import coverCrystalPalaceTransept from "../../assets/cover-crystal-palace-transept.jpg";
import galleryDP152207 from "../../assets/gallery/DP152207.jpg";
import galleryDP70292 from "../../assets/gallery/DP70292.jpg";
import galleryDP139298 from "../../assets/gallery/DP139298.jpg";
import coverBierstadt from "../../assets/gallery2/bierstadt-european-landscape.jpg";
import coverBirchSedgeleyPark from "../../assets/gallery2/birch-sedgeley-park.jpg";
import coverGuimardFacade from "../../assets/gallery2/guimard-facade-detail.jpg";
import coverGuardiCanalVenice from "../../assets/gallery2/guardi-canal-venice.jpg";
import coverBellottoCampo from "../../assets/gallery2/bellotto-campo-santi-giovanni-paolo.jpg";
import coverGuardiCapriccio from "../../assets/gallery2/guardi-capriccio-harbor.jpg";
import coverCanalettoCapriccio from "../../assets/gallery2/canaletto-english-capriccio.jpg";
import coverHobbemaWoodedLandscape from "../../assets/gallery2/hobbema-wooded-landscape.jpg";
import coverGainsboroughMountain from "../../assets/gallery2/gainsborough-mountain-landscape.jpg";
import coverTurnerMortlakeTerrace from "../../assets/gallery2/turner-mortlake-terrace.jpg";
import coverCorotForestCoubron from "../../assets/gallery2/corot-forest-of-coubron.jpg";
import coverBaldusLouvre from "../../assets/gallery2/baldus-view-of-louvre.jpg";
import coverCanevaRome from "../../assets/gallery2/caneva-view-of-rome.jpg";
import coverLeGrayPontCarrousel from "../../assets/gallery2/legray-pont-du-carrousel.jpg";
import coverBissonChaletHandeck from "../../assets/gallery2/bisson-chalet-de-handeck.jpg";
import coverMarvilleCloudPantheon from "../../assets/gallery2/marville-cloud-study-pantheon.jpg";
import coverVanDerHeydenAmsterdam from "../../assets/gallery2/vanderheyden-nieuwe-zijds-voorburgwal.jpg";
import coverRichardsRockyCoast from "../../assets/gallery2/richards-rocky-coast.jpg";
import coverWhampoaAnchorage from "../../assets/gallery2/unknown-whampoa-anchorage.jpg";
import coverAtgetLuxembourg from "../../assets/gallery2/atget-luxembourg-anne-brittany.jpg";
import photoZaraOkafor from "../../assets/talent/zara-okafor.jpg";
import photoAmaraDiallo from "../../assets/talent/amara-diallo.jpg";
import photoMilaTran from "../../assets/talent/mila-tran.jpg";
import photoPetraNovak from "../../assets/talent/petra-novak.jpg";
import photoInesFerreira from "../../assets/talent/ines-ferreira.jpg";
import photoNadiaPetrov from "../../assets/talent/nadia-petrov.jpg";
import photoCalebStone from "../../assets/talent/caleb-stone.jpg";
import photoSofiaBrandt from "../../assets/talent/sofia-brandt.jpg";
import photoJamesWhitfield from "../../assets/talent/james-whitfield.jpg";
import photoLenaVogel from "../../assets/talent/lena-vogel.jpg";
import photoAmirHassan from "../../assets/talent/amir-hassan.jpg";
import photoChiaraRusso from "../../assets/talent/chiara-russo.jpg";
import photoMayaChen from "../../assets/talent/maya-chen.jpg";
import photoPriyaSharma from "../../assets/talent/priya-sharma.jpg";

// Fixed "today" for demo purposes — drives talent-submission-window open/
// closed state (see Campaign.submissionOpen/submissionClose) and the
// due-date formatting below, without the demo silently drifting as real
// wall-clock time passes.
export const MOCK_NOW = new Date("2026-07-21");

// ─── TALENT / SUBMISSIONS ──────────────────────────────────────────────────
// Simplified pipeline vs. the original prototype: Submitted -> Approved/Rejected -> Booked.
// (Negotiation/counter-offer states are a deliberate Phase-1 cut, not an oversight.)

export const SAMPLE_TALENT: Talent[] = [
  { id:1,  name:"Zara Okafor",     photo:photoZaraOkafor,     agency:"Vantage Model Mgmt.", motherAgency:"Vantage Model Mgmt.", boutiqueAgency:"Kindred Talent", location:"New York, NY",    rate:"$980/day",   stage:"approved",  avail:"available", note:"Strong editorial presence.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"8 yrs",  score:5 },
  { id:2,  name:"Amara Diallo",    photo:photoAmaraDiallo,    agency:"Vantage Model Mgmt.", motherAgency:"Vantage Model Mgmt.", boutiqueAgency:"Bloom Agency", location:"Paris, FR",       rate:"$1,150/day", stage:"approved",  avail:"available", note:"Approved. Initiating booking.", height:`5'11"`, bust:`34"`, waist:`25"`, dress:"US 4",  exp:"10 yrs", score:5 },
  { id:3,  name:"Mila Tran",       photo:photoMilaTran,       agency:"Meridian Models",        motherAgency:"Meridian Models",        location:"Los Angeles, CA", rate:"$1,100/day", stage:"submitted", avail:"pending",   note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 2",  exp:"6 yrs",  score:4 },
  { id:4,  name:"Petra Novak",     photo:photoPetraNovak,     agency:"Nomad Models",      motherAgency:"Halcyon Models", boutiqueAgency:"Nomad Models", location:"Milan, IT",       rate:"$920/day",   stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 4",  exp:"5 yrs",  score:4 },
  { id:5,  name:"Ines Ferreira",   photo:photoInesFerreira,   agency:"Halcyon Models",      motherAgency:"Halcyon Models",      location:"London, UK",      rate:"$1,340/day", stage:"approved",  avail:"available", note:"Versatile.", height:`6'0"`,  bust:`35"`, waist:`25"`, dress:"US 6",  exp:"9 yrs",  score:5 },
  { id:6,  name:"Nadia Petrov",    photo:photoNadiaPetrov,    agency:"Anthem Models",       motherAgency:"Anthem Models",       location:"New York, NY",    rate:"$1,070/day", stage:"approved",  avail:"pending",   note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:7,  name:"Caleb Stone",     photo:photoCalebStone,     agency:"Solenne",        motherAgency:"Solenne",        location:"Chicago, IL",     rate:"$890/day",   stage:"submitted", avail:"available", note:"", height:`6'1"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"4 yrs",  score:4 },
  { id:8,  name:"Sofia Brandt",    photo:photoSofiaBrandt,    agency:"Vector Models",        motherAgency:"Vector Models",        location:"Miami, FL",       rate:"$1,200/day", stage:"booked",    avail:"available", note:"Contract executed. Shoot 07/22.", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"11 yrs", score:5 },
  { id:9,  name:"James Whitfield", photo:photoJamesWhitfield, agency:"Vantage Model Mgmt.", motherAgency:"Vantage Model Mgmt.", location:"New York, NY",    rate:"$950/day",   stage:"booked",    avail:"available", note:"Contract executed. Shoot 07/14.", height:`6'0"`,  bust:`38"`, waist:`30"`, dress:"US M",  exp:"6 yrs",  score:5 },
  { id:10, name:"Lena Vogel",      photo:photoLenaVogel,      agency:"Meridian Models",        motherAgency:"Meridian Models",        location:"Berlin, DE",      rate:"$780/day",   stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"3 yrs",  score:3 },
  { id:11, name:"Amir Hassan",     photo:photoAmirHassan,     agency:"Halcyon Models",      motherAgency:"Halcyon Models",      location:"London, UK",      rate:"$1,050/day", stage:"rejected",  avail:"unavailable", note:"Does not meet brief requirements.", height:`6'0"`,  bust:`37"`, waist:`29"`, dress:"US L",  exp:"5 yrs",  score:3 },
  { id:12, name:"Chiara Russo",    photo:photoChiaraRusso,    agency:"Anthem Models",       motherAgency:"Anthem Models",       location:"Rome, IT",        rate:"$860/day",   stage:"approved",  avail:"available", note:"Hold as backup.", height:`5'8"`,  bust:`33"`, waist:`23"`, dress:"US 2",  exp:"4 yrs",  score:4 },
  { id:13, name:"Maya Chen",       photo:photoMayaChen,       agency:"Vantage Model Mgmt.", motherAgency:"Vantage Model Mgmt.", location:"Los Angeles, CA", rate:"$1,080/day", stage:"submitted", avail:"available", note:"", height:`5'9"`,  bust:`33"`, waist:`24"`, dress:"US 4",  exp:"7 yrs",  score:4 },
  { id:14, name:"Priya Sharma",    photo:photoPriyaSharma,    agency:"Vector Models",        motherAgency:"Vector Models",        location:"New York, NY",    rate:"$920/day",   stage:"submitted", avail:"pending",   note:"", height:`5'10"`, bust:`34"`, waist:`24"`, dress:"US 4",  exp:"5 yrs",  score:4 },
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
  { id:"BK-0841", campaign:"AW25 Womenswear Campaign", brand:"Vellani", agency:"Vantage Model Mgmt.", model:"James Whitfield", dayRate:950,  days:3, shootDate:"07/14/2025", agencyPct:20, platformPct:3, paymentStatus:"paid" },
  { id:"BK-0842", campaign:"AW25 Womenswear Campaign", brand:"Vellani", agency:"Vantage Model Mgmt.", model:"Amara Diallo",    dayRate:1150, days:2, shootDate:"07/15/2025", agencyPct:20, platformPct:3, paymentStatus:"processing" },
  { id:"BK-0791", campaign:"SS25 Fragrance Launch",    brand:"Vellani", agency:"Meridian Models",        model:"Mila Tran",       dayRate:1100, days:1, shootDate:"07/20/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
  { id:"BK-0768", campaign:"FW24 Campaign",            brand:"Vellani", agency:"Vector Models",        model:"Sofia Brandt",    dayRate:1200, days:3, shootDate:"06/01/2025", agencyPct:20, platformPct:3, paymentStatus:"paid" },
  { id:"BK-0804", campaign:"Resort Lookbook 2025",     brand:"Vellani", agency:"Halcyon Models",      model:"Ines Ferreira",   dayRate:1340, days:2, shootDate:"07/22/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
  { id:"BK-0850", campaign:"Resort Lookbook 2025",     brand:"Vellani", agency:"Vantage Model Mgmt.", model:"James Whitfield", dayRate:950,  days:2, shootDate:"07/23/2025", agencyPct:20, platformPct:3, paymentStatus:"pending" },
];

// ─── ORG / DIRECTORY ────────────────────────────────────────────────────────

export const ORG_USERS = [
  { id:1, name:"Marcus Webb",   title:"Brand Director",    email:"marcus@acne.com",  phone:"+1 212 555 0100", access:"administrator", group:"Creative Leadership", org:"Vellani"      },
  { id:2, name:"Lena Chu",      title:"Campaign Manager",  email:"lena@acne.com",    phone:"+1 212 555 0101", access:"enhanced",      group:"Campaign Team",       org:"Vellani"      },
  { id:3, name:"Jake Torres",   title:"Art Director",      email:"jake@acne.com",    phone:"+1 212 555 0102", access:"enhanced",      group:"Creative Leadership", org:"Vellani"      },
  { id:4, name:"Priya Shah",    title:"Finance Lead",      email:"priya@acne.com",   phone:"+1 212 555 0103", access:"enhanced",      group:"Finance",             org:"Vellani"      },
  { id:5, name:"Sam Brooks",    title:"Creative Producer", email:"sam@acne.com",     phone:"+1 212 555 0104", access:"basic",         group:"Campaign Team",       org:"Vellani"      },
  { id:6, name:"Sofia Reyes",   title:"Legal Counsel",     email:"sofia@acne.com",   phone:"+1 212 555 0105", access:"administrator", group:"Legal",               org:"Vellani"      },
  { id:7, name:"Sophie Chen",   title:"Senior Agent",      email:"sophie@elite.com", phone:"+1 212 555 0200", access:"enhanced",      group:"Elite Team",          org:"Vantage Model Mgmt." },
  { id:8, name:"James Kirk",    title:"Booking Agent",     email:"james@elite.com",  phone:"+1 212 555 0201", access:"basic",         group:"Elite Team",          org:"Vantage Model Mgmt." },
];

export const ACCESS_BADGE: Record<string,"active"|"info"|"draft"> = { administrator:"active", enhanced:"info", basic:"draft" };

// ─── ACTIVITY / NOTIFICATIONS ───────────────────────────────────────────────

export const ACTIVITY_EVENTS = [
  { id:1, ts:"Jun 15, 2:05 PM",  actor:"Vellani",      type:"Talent approved",        detail:"Amara Diallo approved for booking.",           system:false },
  { id:2, ts:"Jun 15, 11:20 AM", actor:"Vantage Model Mgmt.", type:"Submission received",    detail:"4 talent submitted to AW25 Womenswear.",       system:false },
  { id:3, ts:"Jun 14, 4:01 PM",  actor:"System",            type:"Contract generated",     detail:"CF-2025-0841 generated for James Whitfield.",  system:true  },
  { id:4, ts:"Jun 14, 3:14 PM",  actor:"Vellani",      type:"Contract signed",        detail:"CF-2025-0841 countersigned by brand.",         system:false },
  { id:5, ts:"Jun 14, 11:30 AM", actor:"Vantage Model Mgmt.", type:"Contract signed",        detail:"Sophie Chen signed CF-2025-0841 for agency.",  system:false },
  { id:6, ts:"Jun 13, 1:22 PM",  actor:"Vellani",      type:"Talent approved",        detail:"Zara Okafor and Ines Ferreira approved.",      system:false },
  { id:7, ts:"Jun 12, 9:00 AM",  actor:"System",            type:"Payout released",        detail:"Vantage Model Mgmt. commission payout $2,940.",  system:true  },
  { id:8, ts:"Jun 10, 11:02 AM", actor:"Vantage Model Mgmt.", type:"Talent submitted",       detail:"4 talent submitted to campaign.",              system:false },
  { id:9, ts:"Jun 10, 9:14 AM",  actor:"System",            type:"Campaign published",     detail:"AW25 Womenswear distributed to 5 agencies.",   system:true  },
];

export const NOTIFS = [
  { id:1, text:"Vantage Model Mgmt. submitted 4 talent", sub:"AW25 Womenswear", ts:"2m ago", unread:true  },
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
// Hand-picked by the user from a 287-piece Smithsonian/Met/NGA/Rijksmuseum
// open-access picker, plus 4 keepers from the original set — 25 total,
// force-converted to true grayscale locally (no auto-contrast stretch;
// that made some pieces look worse, per direct feedback).
const CAMPAIGN_COVER_GALLERY: string[] = [
  coverCrystalPalaceTransept, // Hugh Owen, "View of Transept, Looking South", 1851 — Smithsonian
  galleryDP152207, // Carleton E. Watkins, "South Dome, 6,000 feet", ca. 1872 — Smithsonian
  galleryDP70292, // Charles Marville, "Allee bordee d'arbres", 1850-53 — Smithsonian
  galleryDP139298, // Edmond Bacot, "Rue des Petits Murs, Caen", 1852-54 — Smithsonian
  coverBierstadt, // Albert Bierstadt, "European Landscape", c. 1856-57 — Smithsonian
  coverBirchSedgeleyPark, // Thomas Birch, "Southeast View of Sedgeley Park" — Smithsonian
  coverGuimardFacade, // Hector Guimard (architect), facade detail, no. 122 — Smithsonian (cropped: source was a full scanned book page with border/caption)
  coverGuardiCanalVenice, // Follower of Francesco Guardi, "Canal in Venice" — Smithsonian
  coverBellottoCampo, // Bernardo Bellotto, "The Campo di SS. Giovanni e Paolo, Venice" — NGA
  coverGuardiCapriccio, // Francesco Guardi, "Capriccio of a Harbor" — NGA
  coverCanalettoCapriccio, // Canaletto, "English Landscape Capriccio with a Palace" — NGA
  coverHobbemaWoodedLandscape, // Meindert Hobbema, "A Wooded Landscape" — NGA
  coverGainsboroughMountain, // Thomas Gainsborough, "Mountain Landscape with Bridge" — NGA
  coverTurnerMortlakeTerrace, // J.M.W. Turner, "Mortlake Terrace" — NGA
  coverCorotForestCoubron, // Jean-Baptiste-Camille Corot, "The Forest of Coubron" — NGA
  coverBaldusLouvre, // Edouard-Denis Baldus, "View of the Louvre" — NGA
  coverCanevaRome, // Giacomo Caneva, "View of Rome" — NGA
  coverLeGrayPontCarrousel, // Gustave Le Gray, "The Pont du Carrousel, Paris" — NGA
  coverBissonChaletHandeck, // Bisson Freres, "Chalet de Handeck, Hasli Valley" — NGA
  coverMarvilleCloudPantheon, // Charles Marville, "Cloud Study over the Pantheon, Paris" — NGA
  coverVanDerHeydenAmsterdam, // Jan van der Heyden, "The Nieuwe Zijds Voorburgwal, Amsterdam" — Rijksmuseum
  coverRichardsRockyCoast, // William Trost Richards, "A Rocky Coast" — The Met
  coverWhampoaAnchorage, // Unknown artist, "View of the Whampoa Anchorage" — The Met
  coverAtgetLuxembourg, // Eugene Atget, "Luxembourg, Anne of Brittany", 1923-1926 — NGA
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
  { id:1, name:"AW25 Womenswear Campaign", type:"Campaign",     status:"active",   due:formatCampaignDue("2026-07-22", MOCK_NOW), dueDateISO:"2026-07-22", dueLabel:"Due tomorrow",     dueUrgency:"high",   submitted:14, approved:6,  booked:2, talentNeeded:4, budget:18000, committed:5150,  remaining:12850, submissionOpen:"May 1, 2026",  submissionClose:"Aug 15, 2026" },
  { id:2, name:"SS25 Fragrance Launch",    type:"Campaign",     status:"active",   due:formatCampaignDue("2026-07-26", MOCK_NOW), dueDateISO:"2026-07-26", dueLabel:"5 days remaining", dueUrgency:"medium", submitted:9,  approved:4,  booked:0, talentNeeded:2, budget:10000, committed:0,     remaining:10000, submissionOpen:"May 15, 2026", submissionClose:"Jul 25, 2026" },
  { id:3, name:"Resort Lookbook 2025",     type:"Campaign",     status:"active",   due:formatCampaignDue("2026-08-04", MOCK_NOW), dueDateISO:"2026-08-04", dueLabel:"14 days",          dueUrgency:"low",    submitted:21, approved:7,  booked:0, talentNeeded:3, budget:7000,  committed:0,     remaining:7000,  submissionOpen:"Jun 1, 2026",  submissionClose:"Aug 10, 2026" },
  { id:4, name:"FW24 Campaign",            type:"Campaign",     status:"archived", due:formatCampaignDue("2025-12-20", MOCK_NOW), dueDateISO:"2025-12-20", dueLabel:"Archived",         dueUrgency:"low",    submitted:41, approved:11, booked:3, talentNeeded:4, budget:15000, committed:15000, remaining:0,     submissionOpen:"Nov 1, 2025",  submissionClose:"Dec 15, 2025" },
  { id:5, name:"AW26 Runway Presentation", type:"Runway",       status:"active",   due:formatCampaignDue("2026-08-25", MOCK_NOW), dueDateISO:"2026-08-25", dueLabel:"5 weeks out",      dueUrgency:"medium", submitted:12, approved:8,  booked:6, talentNeeded:6, budget:42000, committed:26000, remaining:16000, submissionOpen:"Jun 1, 2026",  submissionClose:"Sep 30, 2026", runwayShowId:1 },
];

// One organization = one team = one home country, per the "Prada Berlin
// and Prada Portugal are separate logins" rule — an org never carries
// multiple flags; a brand/agency that operates in several countries is
// modeled as separate organizations, not one org with a country list.
export const ORG_COUNTRY: Record<string, string> = {
  "Vellani": "SE",
  "Vantage Model Mgmt.": "US",
  "Meridian Models": "US",
  "Halcyon Models": "UK",
  "Solenne": "US",
  "Vector Models": "US",
  "Anthem Models": "US",
  "Kindred Talent": "US",
  "Nomad Models": "UK",
  "Bloom Agency": "FR",
};

// ─── CAMPAIGN MESSAGING ─────────────────────────────────────────────────
// Which agencies are distributed on (invited to) a given campaign — the
// actual access gate for who can message the brand about it. Keyed by
// campaign id.
export const CAMPAIGN_AGENCIES: Record<number, string[]> = {
  1: ["Vantage Model Mgmt.", "Meridian Models", "Halcyon Models", "Solenne", "Vector Models", "Anthem Models"],
  2: ["Vantage Model Mgmt.", "Meridian Models"],
  3: ["Vantage Model Mgmt.", "Vector Models", "Anthem Models"],
  5: ["Vantage Model Mgmt.", "Meridian Models", "Halcyon Models"],
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
    "Vantage Model Mgmt.": [
      { id:1, from:"Sophie Chen", fromOrg:"Vantage Model Mgmt.", text:"Hi team — confirming Amara is available the full shoot window.", ts:"Jun 19, 10:05 AM" },
      { id:2, from:"Marcus Webb", fromOrg:"Vellani", text:"Perfect, thank you. We'll have contracts out today.", ts:"Jun 19, 10:40 AM" },
    ],
    "Meridian Models": [
      { id:1, from:"Diana Park", fromOrg:"Meridian Models", text:"Following up on rates for Mila and Petra's bookings.", ts:"Jun 17, 4:05 PM" },
    ],
    "Halcyon Models": [],
    "Solenne": [],
    "Vector Models": [],
    "Anthem Models": [],
  },
};

// ─── RUNWAY ─────────────────────────────────────────────────────────────────

// The physical show — not owned by any one brand. Vellani' campaign
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
