export type BuildPlanStatus = 'draft' | 'approved' | 'cancelled';

export interface ProjectSpecification {
  projectName: string;
  summary: string;
  audience: string;
  platform: string;
  features: string[];
  dataNeeds: string[];
  integrations: string[];
  designDirection: string;
}

export interface BuildPlan {
  id: string;
  request: string;
  title: string;
  summary: string;
  specification: ProjectSpecification;
  steps: string[];
  assumptions: string[];
  decisions: string[];
  status: BuildPlanStatus;
  version?: number;
  createdAt: string;
}

const featureKeywords: Array<[RegExp, string]> = [
  [/\b(auth|login|sign in|signup|account|user)\b/i, 'User authentication and account access'],
  [/\b(dashboard|analytics|metrics|admin)\b/i, 'Dashboard views with clear data states'],
  [/\b(store|shop|ecommerce|cart|checkout|product)\b/i, 'Product browsing and purchase flow'],
  [/\b(search|filter|sort)\b/i, 'Search, filtering, and useful empty states'],
  [/\b(booking|reservation|schedule|calendar)\b/i, 'Booking or scheduling workflow'],
  [/\b(payment|subscription|billing)\b/i, 'Payment or subscription-ready billing flow'],
  [/\b(notification|email|alert)\b/i, 'Notifications and user feedback states'],
  [/\b(api|integration|sync|github|supabase)\b/i, 'Integration boundary with loading and error handling'],
];

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function splitIdeas(input: string): string[] {
  return unique(
    input
      .split(/[.!?\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 12)
      .slice(0, 4),
  );
}

export function isSubstantialRequest(input: string, chatStarted: boolean, hasSelectedElement = false): boolean {
  if (chatStarted || hasSelectedElement) {
    return false;
  }

  const trimmed = input.trim();
  return (
    trimmed.split(/\s+/).length >= 8 ||
    trimmed.length >= 90 ||
    /\b(build|launch|website|web app|mobile app|dashboard|store|platform|marketplace|system|application|app)\b/i.test(
      trimmed,
    )
  );
}

export function createBuildPlan(request: string): BuildPlan {
  const trimmed = request.trim();
  const firstSentence = splitIdeas(trimmed)[0] || trimmed;
  const matchedFeatures = featureKeywords.filter(([pattern]) => pattern.test(trimmed)).map(([, label]) => label);
  const features = unique([...matchedFeatures, ...splitIdeas(trimmed)]).slice(0, 6);
  const platform = /\bmobile|ios|android|expo\b/i.test(trimmed)
    ? 'Responsive mobile-first app'
    : /\bapi|backend|server|database|supabase\b/i.test(trimmed)
      ? 'Web app with a server-backed data layer'
      : 'Responsive web app';
  const projectName = firstSentence
    .replace(/^(build|create|make|launch)\s+(me\s+)?/i, '')
    .replace(/\b(with|that|which)\b.*$/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .replace(/[,:-]+$/, '');

  return {
    id: `plan-${Date.now()}`,
    request: trimmed,
    title: projectName ? `${projectName} build plan` : 'New project build plan',
    summary: `Turn “${trimmed}” into a focused first release with a clear, responsive experience.`,
    specification: {
      projectName: projectName || 'New Neyla project',
      summary: firstSentence,
      audience: 'People who need a simple, useful first release',
      platform,
      features: features.length > 0 ? features : ['Core experience described in the request'],
      dataNeeds: /\b(data|database|records|content|users|products)\b/i.test(trimmed)
        ? ['Define the core records and their empty, loading, and error states']
        : ['Start with local state and keep the data boundary ready for persistence'],
      integrations: /\b(api|payment|github|supabase|email|notification)\b/i.test(trimmed)
        ? ['Confirm the required integration and keep credentials out of client code']
        : ['No external integration assumed for the first pass'],
      designDirection: 'Polished, accessible UI with clear hierarchy, responsive layout, and purposeful feedback',
    },
    steps: [
      'Set up the primary screen and navigation structure',
      'Build the core interaction and its success, empty, and error states',
      'Add responsive visual polish and accessibility details',
      'Run the app and verify the main path in the live preview',
    ],
    assumptions: [
      'The first release should prioritize one complete user journey over breadth',
      'Existing project conventions and the current preview engine remain in place',
    ],
    decisions: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

export function buildPlanPrompt(plan: BuildPlan): string {
  return [
    '[Neyla Build Plan — approved]',
    `Project: ${plan.specification.projectName}`,
    `Summary: ${plan.summary}`,
    `Platform: ${plan.specification.platform}`,
    `Audience: ${plan.specification.audience}`,
    'Features:',
    ...plan.specification.features.map((item) => `- ${item}`),
    'Data needs:',
    ...plan.specification.dataNeeds.map((item) => `- ${item}`),
    'Integrations:',
    ...plan.specification.integrations.map((item) => `- ${item}`),
    'Implementation steps:',
    ...plan.steps.map((item, index) => `${index + 1}. ${item}`),
    'Assumptions:',
    ...plan.assumptions.map((item) => `- ${item}`),
    plan.decisions.length > 0 ? 'Decisions:' : '',
    ...plan.decisions.map((item) => `- ${item}`),
    'Use this plan as the source of truth for the first implementation. Preserve its decisions unless the user explicitly changes them.',
    '[End Neyla Build Plan]',
  ]
    .filter(Boolean)
    .join('\n');
}