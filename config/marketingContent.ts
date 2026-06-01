// Shared marketing copy reused across the FAQ page and homepage FAQ section.

export interface FaqItem { q: string; a: string; }

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What is MarketBrain OS?',
    a: 'MarketBrain OS is an AI-powered business intelligence platform — an operating system for marketing and business decisions. It analyzes ideas, offers, audiences, campaigns, funnels, and growth initiatives and returns structured, actionable strategic intelligence.',
  },
  {
    q: 'How do tokens work?',
    a: 'Each analysis consumes tokens. Free accounts start with a one-time allowance; Pro accounts receive 200 tokens every month and can top up at any time. Tokens are only charged when an analysis completes successfully — failed runs are automatically refunded.',
  },
  {
    q: 'How much does it cost?',
    a: 'The Free plan is $0. Pro is $7/month and includes 200 tokens monthly, every tool, priority support, and token top-ups. Top-ups are $5 for 100 tokens and never expire.',
  },
  {
    q: 'What tools are included?',
    a: 'Thirteen specialized analyzers across Marketing Intelligence, Sales Intelligence, Business Strategy, and Operations Intelligence — including Angle Miner, Audience Intelligence, Messaging Analyzer, Offer Analyzer, Conversion Doctor, Strategy Lab, Growth Analyzer, and more. See the Features page for the full list.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. You can create a free account and run your first analyses without entering any payment details. Upgrade to Pro whenever you are ready.',
  },
  {
    q: 'How is my data handled?',
    a: 'Your analyses are saved privately to your account so you can revisit them from your history. You can delete any saved analysis at any time.',
  },
];

export interface Testimonial { quote: string; name: string; role: string; }

// NOTE: illustrative sample testimonials — replace with real customer quotes before launch.
export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'We stopped guessing on launch copy. Running the angle and conversion analyses before spend changed how our whole team works.',
    name: 'Sample Persona — Founder',
    role: 'Early-stage SaaS',
  },
  {
    quote: 'The structured results make it easy to hand strategy to clients with confidence. It is like a second analyst on the team.',
    name: 'Sample Persona — Agency Lead',
    role: 'Growth Marketing Agency',
  },
  {
    quote: 'Strategy Lab and Growth Analyzer help us pressure-test initiatives in minutes instead of week-long debates.',
    name: 'Sample Persona — Head of Growth',
    role: 'DTC E-commerce',
  },
];
