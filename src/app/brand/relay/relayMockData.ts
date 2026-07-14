// Relay — mock data only. No NFC/QR/hardware/backend here, by design:
// this models the UI and state exactly as if the real scanning
// infrastructure already exists, so the console can be built and
// judged on UX now and wired to real devices later without a rewrite.

export interface RelayStation {
  id: number;
  name: string;
  department: "Check-In" | "Hair" | "Makeup" | "Wardrobe" | "Lineup" | "Runway";
  currentModel: string | null;
  status: "Occupied" | "Available";
  lastEvent: string;
  eventsToday: number;
  online: boolean;
}

export interface RelayBand {
  id: string;
  assignedModel: string | null;
  status: "Assigned" | "Unassigned";
  currentShow: string | null;
  battery: number;
  lastSeen: string;
}

export interface RelayDevice {
  id: number;
  name: string;
  type: "Mobile" | "Tablet" | "Scanner" | "Desktop";
  status: "Online" | "Offline";
  currentStation: string | null;
  softwareVersion: string;
  lastSync: string;
}

export interface RelayEvent {
  id: number;
  ts: string;
  model: string;
  bandId: string;
  station: string;
  event: string;
  previousState: string;
  newState: string;
  operator: string;
  show: string;
}

export const RELAY_SHOW = "AW26 Runway Presentation";

// Same cast as the Casting Board — Relay is the day-of execution layer
// for the same show, not a disconnected demo world. "Emily Chen" is
// kept as an eighth model matching the example in the spec verbatim.
export const RELAY_MODELS = ["Emily Chen", "Zara Okafor", "Amara Diallo", "Ines Ferreira", "Nadia Petrov", "Chiara Russo", "James Whitfield"];

// Same crew as Looks assignment — operators scanning bands are the
// same hair/makeup/dresser roster already cast for this show.
export const RELAY_OPERATORS = ["Sarah Kim", "Priya Anand", "Marcus Reyes", "Dana Kwon", "Théo Laurent", "Ola Bello", "Ren Fischer"];

export const RELAY_STATIONS: RelayStation[] = [
  { id:1, name:"Check-In Station",   department:"Check-In", currentModel:null,             status:"Available", lastEvent:"09:41", eventsToday:38, online:true  },
  { id:2, name:"Hair Station 1",     department:"Hair",     currentModel:"Emily Chen",      status:"Occupied",  lastEvent:"09:42", eventsToday:23, online:true  },
  { id:3, name:"Hair Station 2",     department:"Hair",     currentModel:"Nadia Petrov",    status:"Occupied",  lastEvent:"09:38", eventsToday:19, online:true  },
  { id:4, name:"Makeup Station 1",   department:"Makeup",   currentModel:"Zara Okafor",     status:"Occupied",  lastEvent:"09:40", eventsToday:21, online:true  },
  { id:5, name:"Makeup Station 2",   department:"Makeup",   currentModel:null,              status:"Available", lastEvent:"09:25", eventsToday:17, online:true  },
  { id:6, name:"Wardrobe Station",   department:"Wardrobe", currentModel:"Amara Diallo",    status:"Occupied",  lastEvent:"09:36", eventsToday:14, online:true  },
  { id:7, name:"Lineup",             department:"Lineup",   currentModel:"Ines Ferreira",   status:"Occupied",  lastEvent:"09:33", eventsToday:9,  online:true  },
  { id:8, name:"Runway",             department:"Runway",   currentModel:null,              status:"Available", lastEvent:"09:20", eventsToday:6,  online:false },
];

export const RELAY_BANDS: RelayBand[] = [
  { id:"RB-0182", assignedModel:"Emily Chen",      status:"Assigned",   currentShow:RELAY_SHOW, battery:100, lastSeen:"09:42" },
  { id:"RB-0183", assignedModel:"Zara Okafor",     status:"Assigned",   currentShow:RELAY_SHOW, battery:92,  lastSeen:"09:40" },
  { id:"RB-0184", assignedModel:"Amara Diallo",    status:"Assigned",   currentShow:RELAY_SHOW, battery:88,  lastSeen:"09:36" },
  { id:"RB-0185", assignedModel:"Ines Ferreira",   status:"Assigned",   currentShow:RELAY_SHOW, battery:95,  lastSeen:"09:33" },
  { id:"RB-0186", assignedModel:"Nadia Petrov",    status:"Assigned",   currentShow:RELAY_SHOW, battery:100, lastSeen:"09:38" },
  { id:"RB-0187", assignedModel:"Chiara Russo",    status:"Assigned",   currentShow:RELAY_SHOW, battery:76,  lastSeen:"09:15" },
  { id:"RB-0188", assignedModel:"James Whitfield", status:"Assigned",   currentShow:RELAY_SHOW, battery:99,  lastSeen:"09:41" },
  { id:"RB-0189", assignedModel:null,              status:"Unassigned",currentShow:null,       battery:100, lastSeen:"08:02" },
];

export const RELAY_DEVICES: RelayDevice[] = [
  { id:1, name:"Sarah's iPhone",     type:"Mobile",  status:"Online",  currentStation:"Hair Station 1",   softwareVersion:"1.0.0", lastSync:"09:42" },
  { id:2, name:"Priya's iPhone",     type:"Mobile",  status:"Online",  currentStation:"Hair Station 2",   softwareVersion:"1.0.2", lastSync:"09:38" },
  { id:3, name:"Marcus's iPad",      type:"Tablet",  status:"Online",  currentStation:"Makeup Station 1", softwareVersion:"1.0.0", lastSync:"09:40" },
  { id:4, name:"Dana's iPad",        type:"Tablet",  status:"Online",  currentStation:"Makeup Station 2", softwareVersion:"1.0.0", lastSync:"09:25" },
  { id:5, name:"Wardrobe Tablet",    type:"Tablet",  status:"Offline", currentStation:"Wardrobe Station", softwareVersion:"0.9.8", lastSync:"08:55" },
  { id:6, name:"Front Desk Scanner", type:"Scanner", status:"Online",  currentStation:"Check-In Station", softwareVersion:"1.0.0", lastSync:"09:41" },
  { id:7, name:"Runway Monitor",     type:"Desktop", status:"Offline", currentStation:"Runway",           softwareVersion:"1.0.0", lastSync:"09:02" },
];

// Each template is one leg of a model's path through the show. The
// live feed picks a random template + model + operator to synthesize
// a new event every few seconds.
export const RELAY_EVENT_TEMPLATES: { event:string; previousState:string; newState:string; station:string }[] = [
  { event:"Checked In",     previousState:"Not Arrived",  newState:"Checked In", station:"Check-In Station" },
  { event:"Hair Started",   previousState:"Checked In",   newState:"Hair",       station:"Hair Station 1"   },
  { event:"Hair Completed", previousState:"Hair",         newState:"Makeup",     station:"Hair Station 1"   },
  { event:"Makeup Started", previousState:"Makeup",       newState:"Makeup",     station:"Makeup Station 1" },
  { event:"Wardrobe Started", previousState:"Makeup",     newState:"Wardrobe",   station:"Wardrobe Station" },
  { event:"Lineup",         previousState:"Wardrobe",     newState:"Lineup",     station:"Lineup"           },
  { event:"Walking",        previousState:"Lineup",       newState:"Walking",    station:"Runway"           },
  { event:"Returned",       previousState:"Walking",      newState:"Wrap",       station:"Runway"           },
];

const bandFor = (model: string) => RELAY_BANDS.find(b=>b.assignedModel===model)?.id ?? "RB-0000";

function nowTs() {
  return new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
}

let eventIdCounter = 1000;

export function makeRelayEvent(): RelayEvent {
  const template = RELAY_EVENT_TEMPLATES[Math.floor(Math.random()*RELAY_EVENT_TEMPLATES.length)];
  const model = RELAY_MODELS[Math.floor(Math.random()*RELAY_MODELS.length)];
  const operator = RELAY_OPERATORS[Math.floor(Math.random()*RELAY_OPERATORS.length)];
  eventIdCounter += 1;
  return {
    id: eventIdCounter,
    ts: nowTs(),
    model,
    bandId: bandFor(model),
    station: template.station,
    event: template.event,
    previousState: template.previousState,
    newState: template.newState,
    operator,
    show: RELAY_SHOW,
  };
}

// Seed feed so the page isn't empty on first load, oldest first so
// unshifting new ones keeps the array newest-first.
export const RELAY_INITIAL_EVENTS: RelayEvent[] = Array.from({ length: 10 }, () => makeRelayEvent())
  .map((e, i) => ({ ...e, id: 900 + i }));
