// The fixed role list for the Call Sheet — a curated set, not something
// that grows per-campaign, so it lives here as plain config rather than
// a database table (see 0025_call_sheet.sql's own comment on why not an
// enum either). Each category renders as its own 4-across grid that
// wraps naturally, so a 5-role or 2-role category doesn't need special
// row-break handling — the count alone determines the shape.
export interface CallSheetRole {
  key: string;
  label: string;
}

export interface CallSheetCategory {
  key: string;
  label: string;
  roles: CallSheetRole[];
}

function roles(...pairs: [string, string][]): CallSheetRole[] {
  return pairs.map(([key, label]) => ({ key, label }));
}

export const CALL_SHEET_CATEGORIES: CallSheetCategory[] = [
  {
    key: "creative_leadership",
    label: "Creative Leadership",
    roles: roles(
      ["creative_director", "Creative Director"],
      ["art_director", "Art Director"],
      ["brand_director", "Brand Director"],
      ["design_director", "Design Director"],
    ),
  },
  {
    key: "production",
    label: "Production",
    roles: roles(
      ["executive_producer", "Executive Producer"],
      ["producer", "Producer"],
      ["production_manager", "Production Manager"],
      ["line_producer", "Line Producer"],
      ["production_coordinator", "Production Coordinator"],
      ["production_assistant", "Production Assistant"],
    ),
  },
  {
    key: "photography",
    label: "Photography",
    roles: roles(
      ["photographer", "Photographer"],
      ["first_assistant_photographer", "First Assistant Photographer"],
      ["second_assistant_photographer", "Second Assistant Photographer"],
      ["digital_technician", "Digital Technician (Digitech)"],
      ["photo_assistant", "Photo Assistant"],
    ),
  },
  {
    key: "styling",
    label: "Styling",
    roles: roles(
      ["stylist", "Stylist"],
      ["assistant_stylist", "Assistant Stylist"],
      ["wardrobe_assistant", "Wardrobe Assistant"],
      ["costume_supervisor", "Costume Supervisor"],
    ),
  },
  {
    key: "hair_makeup",
    label: "Hair & Makeup",
    roles: roles(
      ["hair_stylist", "Hair Stylist"],
      ["hair_assistant", "Hair Assistant"],
      ["makeup_artist", "Makeup Artist"],
      ["makeup_assistant", "Makeup Assistant"],
      ["groomer", "Groomer"],
      ["nail_artist", "Nail Artist"],
    ),
  },
  {
    key: "casting_talent",
    label: "Casting & Talent",
    roles: roles(
      ["casting_director", "Casting Director"],
      ["casting_associate", "Casting Associate"],
    ),
  },
  {
    key: "set_art",
    label: "Set & Art",
    roles: roles(
      ["set_designer", "Set Designer"],
      ["prop_stylist", "Prop Stylist"],
      ["floral_designer", "Floral Designer"],
      ["art_assistant", "Art Assistant"],
    ),
  },
  {
    key: "client",
    label: "Client",
    roles: roles(
      ["brand_representative", "Brand Representative"],
      ["marketing_manager", "Marketing Manager"],
      ["client_producer", "Client Producer"],
      ["merchandising_lead", "Merchandising Lead"],
    ),
  },
  {
    key: "post_production",
    label: "Post Production",
    roles: roles(
      ["retoucher", "Retoucher"],
      ["editor", "Editor"],
      ["colorist", "Colorist"],
      ["motion_designer", "Motion Designer"],
      ["cgi_artist", "CGI Artist"],
    ),
  },
  {
    key: "logistics",
    label: "Logistics",
    roles: roles(
      ["studio_manager", "Studio Manager"],
      ["location_manager", "Location Manager"],
      ["driver", "Driver"],
      ["catering", "Catering"],
      ["security", "Security"],
    ),
  },
  {
    key: "pr_communications",
    label: "PR & Communications",
    roles: roles(
      ["pr_representative", "PR Representative"],
      ["social_media_manager", "Social Media Manager"],
      ["publicist", "Publicist"],
    ),
  },
];

export const ALL_CALL_SHEET_ROLES: CallSheetRole[] = CALL_SHEET_CATEGORIES.flatMap(c => c.roles);
