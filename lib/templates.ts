export const SCHOOL_HOUSES = ["Atri", "Kashyapa", "Vashista", "Gautama"] as const;

export type SchoolHouse = (typeof SCHOOL_HOUSES)[number];

export const SCHOOL_VOTER_FIELDS = [
  { fieldName: "id_no", fieldLabel: "ID Number", isIdentifier: true, isRequired: true, sortOrder: 0 },
  { fieldName: "kutumba", fieldLabel: "House (Kutumba)", isIdentifier: false, isRequired: true, sortOrder: 1 },
  { fieldName: "enrollment_id", fieldLabel: "Enrollment ID", isIdentifier: false, isRequired: false, sortOrder: 2 },
  { fieldName: "name", fieldLabel: "Full Name", isIdentifier: false, isRequired: false, sortOrder: 3 },
  { fieldName: "class", fieldLabel: "Class", isIdentifier: false, isRequired: false, sortOrder: 4 },
];

// Default two-field auth for school template
export const SCHOOL_AUTH_FIELDS = ["id_no", "enrollment_id"];

export function buildSchoolPositions() {
  const positions = [];
  let sortOrder = 0;

  for (const house of SCHOOL_HOUSES) {
    positions.push({
      title: `${house} House Boy Captain`,
      description: `Boy House Captain for ${house}`,
      maxWinners: 1,
      maxVotes: 1,
      restrictions: { kutumba: house },
      sortOrder: sortOrder++,
    });
    positions.push({
      title: `${house} House Girl Captain`,
      description: `Girl House Captain for ${house}`,
      maxWinners: 1,
      maxVotes: 1,
      restrictions: { kutumba: house },
      sortOrder: sortOrder++,
    });
  }

  positions.push({
    title: "Sports Boy Captain",
    description: "Overall Sports Boy Captain (all houses)",
    maxWinners: 1,
    maxVotes: 1,
    restrictions: {},
    sortOrder: sortOrder++,
  });
  positions.push({
    title: "Sports Girl Captain",
    description: "Overall Sports Girl Captain (all houses)",
    maxWinners: 1,
    maxVotes: 1,
    restrictions: {},
    sortOrder: sortOrder++,
  });

  return positions;
}

/* ──────────────────────────────────────────────────────────────
   Template registry (Phase 2)
   Every template is a fully editable *starting point*. The custom
   builder loads one of these into its form state via `getTemplate(id)`.
   ────────────────────────────────────────────────────────────── */

export interface TemplateVoterField {
  fieldName: string;
  fieldLabel: string;
  isRequired: boolean;
}
export interface TemplateRule {
  field: string;
  value: string;
}
export interface TemplatePosition {
  title: string;
  description?: string;
  maxWinners: number;
  maxVotes: number;
  rules: TemplateRule[];
}
export interface TemplateCandidateField {
  fieldName: string;
  fieldLabel: string;
  isRequired: boolean;
}

export interface ElectionTemplateDef {
  id: string;
  name: string;
  tagline: string;
  category: string;
  /** Tailwind-friendly accent hue used by the gallery card. */
  accent: string;
  /** Opinionated, structure-locked variant (School Fixed). */
  fixed: boolean;
  /** Which server creation path to use. */
  baseTemplate: "GENERIC" | "SCHOOL";
  config: {
    authMode: "ACCESS_CODE" | "TWO_FIELDS";
    allowAbstain: boolean;
    voterFields: TemplateVoterField[];
    primaryIdentifier: string;
    secondaryIdentifier?: string;
    positions: TemplatePosition[];
    candidateFields: TemplateCandidateField[];
  };
}

// School positions in builder ({field,value} rules) form, for the editable variant.
function schoolPositionsForBuilder(): TemplatePosition[] {
  const out: TemplatePosition[] = [];
  for (const house of SCHOOL_HOUSES) {
    out.push({ title: `${house} House Boy Captain`, description: `Boy House Captain for ${house}`, maxWinners: 1, maxVotes: 1, rules: [{ field: "kutumba", value: house }] });
    out.push({ title: `${house} House Girl Captain`, description: `Girl House Captain for ${house}`, maxWinners: 1, maxVotes: 1, rules: [{ field: "kutumba", value: house }] });
  }
  out.push({ title: "Sports Boy Captain", description: "Overall (all houses)", maxWinners: 1, maxVotes: 1, rules: [] });
  out.push({ title: "Sports Girl Captain", description: "Overall (all houses)", maxWinners: 1, maxVotes: 1, rules: [] });
  return out;
}

const SCHOOL_BUILDER_VOTER_FIELDS: TemplateVoterField[] = SCHOOL_VOTER_FIELDS.map((f) => ({
  fieldName: f.fieldName, fieldLabel: f.fieldLabel, isRequired: f.isRequired,
}));

export const TEMPLATES: ElectionTemplateDef[] = [
  {
    id: "school-fixed",
    name: "School (Fixed)",
    tagline: "House captains, ready in one click.",
    category: "Education",
    accent: "#4A9EFF",
    fixed: true,
    baseTemplate: "SCHOOL",
    config: {
      authMode: "TWO_FIELDS",
      allowAbstain: true,
      voterFields: SCHOOL_BUILDER_VOTER_FIELDS,
      primaryIdentifier: "id_no",
      secondaryIdentifier: "enrollment_id",
      positions: schoolPositionsForBuilder(),
      candidateFields: [],
    },
  },
  {
    id: "school-custom",
    name: "School (Customizable)",
    tagline: "The school defaults — yours to reshape.",
    category: "Education",
    accent: "#7DC4FF",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "TWO_FIELDS",
      allowAbstain: true,
      voterFields: SCHOOL_BUILDER_VOTER_FIELDS,
      primaryIdentifier: "id_no",
      secondaryIdentifier: "enrollment_id",
      positions: schoolPositionsForBuilder(),
      candidateFields: [{ fieldName: "manifesto", fieldLabel: "Manifesto", isRequired: false }],
    },
  },
  {
    id: "university-council",
    name: "University Student Council",
    tagline: "President down to class reps.",
    category: "Education",
    accent: "#6C8CFF",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "TWO_FIELDS",
      allowAbstain: true,
      voterFields: [
        { fieldName: "student_id", fieldLabel: "Student ID", isRequired: true },
        { fieldName: "email", fieldLabel: "University Email", isRequired: true },
        { fieldName: "name", fieldLabel: "Full Name", isRequired: false },
        { fieldName: "department", fieldLabel: "Department", isRequired: false },
        { fieldName: "year", fieldLabel: "Year of Study", isRequired: false },
      ],
      primaryIdentifier: "student_id",
      secondaryIdentifier: "email",
      positions: [
        { title: "President", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Vice President", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "General Secretary", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Treasurer", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Class Representatives", description: "Multiple winners", maxWinners: 5, maxVotes: 5, rules: [] },
      ],
      candidateFields: [
        { fieldName: "manifesto", fieldLabel: "Manifesto", isRequired: false },
        { fieldName: "department", fieldLabel: "Department", isRequired: false },
      ],
    },
  },
  {
    id: "club",
    name: "Club Election",
    tagline: "Lightweight officer elections for any club.",
    category: "Community",
    accent: "#5AD1C7",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "ACCESS_CODE",
      allowAbstain: true,
      voterFields: [
        { fieldName: "membership_no", fieldLabel: "Membership Number", isRequired: true },
        { fieldName: "name", fieldLabel: "Name", isRequired: false },
      ],
      primaryIdentifier: "membership_no",
      positions: [
        { title: "Chairperson", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Secretary", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Treasurer", maxWinners: 1, maxVotes: 1, rules: [] },
      ],
      candidateFields: [{ fieldName: "pitch", fieldLabel: "Why me", isRequired: false }],
    },
  },
  {
    id: "corporate-board",
    name: "Corporate Board Election",
    tagline: "Board seats with shareholder eligibility.",
    category: "Corporate",
    accent: "#9B8CFF",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "TWO_FIELDS",
      allowAbstain: false,
      voterFields: [
        { fieldName: "shareholder_id", fieldLabel: "Shareholder ID", isRequired: true },
        { fieldName: "email", fieldLabel: "Email", isRequired: true },
        { fieldName: "name", fieldLabel: "Name", isRequired: false },
        { fieldName: "share_class", fieldLabel: "Share Class", isRequired: false },
      ],
      primaryIdentifier: "shareholder_id",
      secondaryIdentifier: "email",
      positions: [
        { title: "Board Directors", description: "Elect up to 7 directors", maxWinners: 7, maxVotes: 7, rules: [] },
        { title: "Board Chair", maxWinners: 1, maxVotes: 1, rules: [] },
      ],
      candidateFields: [
        { fieldName: "bio", fieldLabel: "Biography", isRequired: false },
        { fieldName: "tenure", fieldLabel: "Years on board", isRequired: false },
      ],
    },
  },
  {
    id: "community-association",
    name: "Community Association",
    tagline: "Resident-led committees, by zone.",
    category: "Community",
    accent: "#FF9F6C",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "TWO_FIELDS",
      allowAbstain: true,
      voterFields: [
        { fieldName: "registration_number", fieldLabel: "Registration Number", isRequired: true },
        { fieldName: "unit", fieldLabel: "Unit / House No.", isRequired: true },
        { fieldName: "name", fieldLabel: "Resident Name", isRequired: false },
        { fieldName: "zone", fieldLabel: "Zone", isRequired: false },
      ],
      primaryIdentifier: "registration_number",
      secondaryIdentifier: "unit",
      positions: [
        { title: "President", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Secretary", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Treasurer", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Zone Representatives", maxWinners: 4, maxVotes: 4, rules: [] },
      ],
      candidateFields: [{ fieldName: "agenda", fieldLabel: "Agenda", isRequired: false }],
    },
  },
  {
    id: "society",
    name: "Society Election",
    tagline: "Registered societies and member bodies.",
    category: "Community",
    accent: "#FF6CA5",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "ACCESS_CODE",
      allowAbstain: true,
      voterFields: [
        { fieldName: "member_id", fieldLabel: "Member ID", isRequired: true },
        { fieldName: "name", fieldLabel: "Member Name", isRequired: false },
        { fieldName: "category", fieldLabel: "Membership Category", isRequired: false },
      ],
      primaryIdentifier: "member_id",
      positions: [
        { title: "President", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Vice President", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Executive Committee", maxWinners: 6, maxVotes: 6, rules: [] },
      ],
      candidateFields: [{ fieldName: "statement", fieldLabel: "Candidate Statement", isRequired: false }],
    },
  },
  {
    id: "event-committee",
    name: "Event Committee Election",
    tagline: "Spin up an organising committee fast.",
    category: "Events",
    accent: "#5AD16C",
    fixed: false,
    baseTemplate: "GENERIC",
    config: {
      authMode: "ACCESS_CODE",
      allowAbstain: true,
      voterFields: [
        { fieldName: "participant_id", fieldLabel: "Participant ID", isRequired: true },
        { fieldName: "name", fieldLabel: "Name", isRequired: false },
      ],
      primaryIdentifier: "participant_id",
      positions: [
        { title: "Event Lead", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Logistics Head", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Volunteers Coordinator", maxWinners: 1, maxVotes: 1, rules: [] },
        { title: "Committee Members", maxWinners: 5, maxVotes: 5, rules: [] },
      ],
      candidateFields: [{ fieldName: "experience", fieldLabel: "Relevant experience", isRequired: false }],
    },
  },
];

export function getTemplate(id: string): ElectionTemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
