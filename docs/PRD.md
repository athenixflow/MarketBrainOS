# MarketBrain OS — Master Product Requirements Document

> **Status:** Canonical source of truth for this project. All implementation plans must cite sections
> here (e.g. "PRD §28 Pro Plan"). Section numbers mirror the original Master PRD (Explained Version,
> Parts 1–4). See [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) for build status and [ROADMAP.md](./ROADMAP.md)
> for sequencing.

---

## 1. Product Overview

- **Product Name:** MarketBrain OS
- **Category:** AI-Powered Business Intelligence & Strategic Decision Platform
- **Mission:** Help founders, marketers, agencies, operators, startups, and businesses make better
  decisions through specialized AI-powered business analysis tools.
- **Core Value Proposition:** Transform raw business ideas, campaigns, workflows, funnels, offers, and
  growth initiatives into actionable strategic intelligence.
- **Core Promise:** "Turn uncertainty into clarity."
- **Ultimate Positioning:** "The Operating System for Business Decision Making."

**Target Users:** Startup Founders, Business Owners, Marketing Teams, Freelancers, Agencies,
Consultants, E-commerce Brands, SaaS Companies, Corporate Strategy Teams.

**Revenue Model:**
- Pro Subscription — **$7/month**
- Token Top-Ups — **$5 = 100 tokens**
- Free Plan — **5 tokens** (one-time, no monthly replenishment)
- Pro Plan — **200 tokens/month**
- **Pricing rule: 1 Analysis = 1 Token** (flat, regardless of tool)

---

## 2. Customer Journey

Seven stages, each with a goal:
1. **Discovery** — found via search, social, referrals, content, ads. *Goal: get them to visit.*
2. **Evaluation** — explores homepage, features, pricing, testimonials, FAQs. *Goal: communicate value.*
3. **Signup** — creates an account. *Goal: convert visitor → registered user.*
4. **Activation** — runs first analysis. *Goal: deliver value fast.*
5. **Engagement** — uses multiple tools. *Goal: create habit/dependency.*
6. **Monetization** — exhausts free tokens, upgrades. *Goal: free → paying.*
7. **Retention** — returns repeatedly. *Goal: recurring revenue + loyalty.*

---

## 3. Public Website

**Pages:** Homepage, Features, Pricing, About Us, FAQ, Contact, Terms, Privacy Policy, Login, Signup.

**Homepage sections:** Hero · Problem Statement · How It Works · Features Overview · Pricing Overview ·
Testimonials · FAQ · Call-To-Action.

- **Features Page:** detailed explanation of every analysis tool.
- **Pricing Page:** Free / Pro / Token Top-Ups; goal = conversion.
- **About:** mission, vision, story, team.
- **FAQ:** reduce confusion + support load.
- **Contact:** contact form, email, support resources.

---

## 4. Authentication System

Email Registration (name/email/password), Google Registration, Email Login, Google Login, Forgot
Password, Password Reset, Email Verification, Session Management, Logout.

**User States:** Guest · Registered · Verified · Free · Pro · Admin.

Email verification reduces spam accounts and improves security. Google auth reduces onboarding friction.

---

## 5. User Onboarding System

**Goal:** get users to their first successful analysis quickly.
Flow: Welcome Screen → Platform Introduction (what it is / problems solved) → Token Introduction (what
tokens are / how consumed) → Feature Overview (tools + use cases) → Dashboard Walkthrough (nav, token
balance, history) → First Analysis Guide (creates immediate value).

---

## 6. Dashboard

The user's command center — single location for managing activity.
**Widgets:** User Profile (name/plan/status) · Token Balance (balance/usage) · Subscription
(plan/renewal) · Recent Analysis (latest + quick access) · Quick Actions (start analysis, upgrade, buy
tokens) · Feature Access Grid · Notification Center.

---

## 7. Token Economy

- Free Plan: **5 tokens** (experience value; no replenishment).
- Pro Plan: **200 tokens/month** (regular business use).
- Consumption: **1 Analysis = 1 Token** (simple, transparent).
- Top-Ups: **$5 = 100 tokens** (continue after allocation exhausted).
- **Token Events:** Signup Bonus · Monthly Allocation · Top-Up Purchase · Analysis Consumption ·
  Admin Allocation.
- **Tracking:** Current Balance · Total Used · Monthly Usage · Lifetime Usage · Top-Up History.

---

## 8. Subscription System

- **Free Plan:** 5 tokens, full access until exhausted.
- **Pro Plan:** 200 monthly tokens, priority access, full usage.
- **Actions:** Upgrade · Renew · Cancel · Downgrade.
- **Billing Components:** Subscription Status · Next Billing Date · Billing History · Invoices · Receipts.
- **States:** Free · Active · Past Due · Cancelled · Expired.
- **Events:** New Subscription · Renewal · Cancellation · Failed Payment · Plan Upgrade · Plan Downgrade.

---

## 9. Feature Directory

Central navigation hub grouping tools by category: Marketing · Sales · Strategy · Growth · Operations ·
Market Research · Customer Intelligence.
Every tool entry includes: Description · Purpose · Input Requirements · Expected Outputs · Token Cost.

---

## 10. Core AI Analysis Engine

The heart of the platform. **Purpose:** transform user inputs into strategic business intelligence.

**Workflow (10 steps):** Select tool → Submit info → Validate inputs → Verify token availability →
Deduct 1 token → Create analysis job → AI processes → Structure results → Save results → Display results.

**Analysis States:** Queued · Processing · Completed · Failed.

---

## The 12 Analysis Tools (§11–22)

Each tool answers a specific business question and follows the universal result framework (§23).

### 11. Angle Miner
*"What are the most effective ways to present this offer to my market?"*
- **Inputs:** Product Name, Product Description, Target Audience, Market, Business Goal.
- **Analysis areas:** Customer Motivations, Market Desires/Frustrations, Buying Triggers, Competitive &
  Positioning Opportunities.
- **Outputs:** Primary/Secondary/Emotional/Logical/Curiosity/Authority/Urgency/Differentiation Angles.
- **Result sections:** Executive Summary · Top 10 Angles · Best Angle Recommendation · Campaign
  Opportunities · Messaging Suggestions · Action Plan.

### 12. Conversion Doctor
*"Why are visitors not becoming customers?"*
- **Inputs:** Landing Page Content, Offer Description, Funnel Description, Traffic Source, Conversion Goal.
- **Analysis areas:** Trust, Clarity, Offer Problems, Funnel Friction, CTA Effectiveness, Buyer Psychology.
- **Outputs:** Conversion Bottlenecks, Risk Areas, Optimization/Trust/Offer/CTA improvements.
- **Result sections:** Conversion Score · Problem Areas · Impact Ranking · Recommendations ·
  Optimization Roadmap.

### 13. Workflow Analyzer
*"Where is time, money, or effort being wasted?"*
- **Inputs:** Workflow Description, Process Steps, Team Structure, Objectives.
- **Areas:** Efficiency, Redundancy, Bottlenecks, Automation Opportunities, Communication Gaps.
- **Outputs:** Process Weaknesses, Efficiency Opportunities, Automation & Redesign suggestions.
- **Result sections:** Workflow Summary · Problem Areas · Improvement Plan · Implementation Recommendations.

### 14. Strategy Lab
*"Is this idea worth pursuing?"*
- **Inputs:** Business Idea, Campaign Concept, Growth Initiative, Expansion Plan.
- **Areas:** Feasibility, Opportunity, Risk, Competition, Execution Difficulty.
- **Outputs:** Opportunity/Risk Assessment, Growth Potential, Strategic Recommendations.
- **Result sections:** Executive Summary · Strengths · Weaknesses · Opportunities · Threats · Recommendation.

### 15. Offer Analyzer
*"Would customers find this offer compelling?"*
- **Inputs:** Offer Description, Pricing, Bonuses, Guarantees, Target Audience.
- **Areas:** Value Perception, Pricing Logic, Competitive Position, Offer Clarity/Appeal.
- **Outputs:** Offer Strength Rating, Weaknesses, Pricing Feedback, Value/Bonus improvements.
- **Result sections:** Offer Score · Offer Breakdown · Improvement Opportunities · Action Steps.

### 16. Audience Intelligence
*"What does my audience really want?"*
- **Inputs:** Industry, Product, Audience Description, Business Type.
- **Areas:** Demographics, Psychographics, Pain Points, Desires, Objections, Triggers.
- **Outputs:** Customer Personas, Pain Point Analysis, Desire Mapping, Buying Motivations, Behavior Insights.
- **Result sections:** Audience Summary · Primary Persona · Secondary Personas · Opportunity Map.

### 17. Market Intelligence
*"Where are the best opportunities in this market?"*
- **Inputs:** Industry, Market, Business Model, Target Segment.
- **Areas:** Market Trends/Size, Emerging Opportunities, Market Gaps, Threats.
- **Outputs:** Trend Analysis, Opportunity Map, Risk Areas, Expansion Opportunities.
- **Result sections:** Market Overview · Trend Report · Opportunity Report · Recommendations.

### 18. Competitor Analyzer
*"How do we compare to competitors?"*
- **Inputs:** Competitor Information, Business Information, Industry.
- **Areas:** Strengths, Weaknesses, Market Position, Differentiation.
- **Outputs:** Competitor Profiles, Competitive Advantages/Risks, Differentiation Opportunities.
- **Result sections:** Competitor Summary · Comparison Matrix · Advantage Opportunities.

### 19. Messaging Analyzer
*"Does this messaging persuade effectively?"*
- **Inputs:** Sales/Ad/Landing Page/Email Copy.
- **Areas:** Clarity, Persuasion, Trust, Emotion, Credibility.
- **Outputs:** Messaging Score, Persuasion/Trust Ratings, Improvement Suggestions.
- **Result sections:** Messaging Review · Problem Areas · Optimization Suggestions.

### 20. Content Strategy Tool
*"What content should I create?"*
- **Inputs:** Business Type, Industry, Audience, Objectives.
- **Outputs:** Content Pillars, Topic Ideas, Content Themes, Distribution Suggestions.
- **Result sections:** Content Roadmap · Publishing Strategy · Growth Opportunities.

### 21. Campaign Analyzer
*"How can this campaign perform better?"*
- **Inputs:** Campaign Details, Goals, Audience, Channels.
- **Outputs:** Campaign Score, Weaknesses, Optimization & Scaling recommendations.
- **Result sections:** Campaign Audit · Improvement Plan · Scaling Strategy.

### 22. Growth Analyzer
*"Where can we grow fastest?"*
- **Inputs:** Business Information, Current Performance, Growth Objectives.
- **Outputs:** Growth Opportunities, Expansion Ideas, Revenue Opportunities, Strategic Recommendations.
- **Result sections:** Growth Audit · Opportunity Map · Revenue Expansion Plan.

---

## 23. Universal Analysis Result Framework

Every tool produces the same 9-section structure:
1. Executive Summary · 2. Key Findings · 3. Strengths · 4. Weaknesses · 5. Opportunities · 6. Risks ·
7. Recommendations · 8. Action Plan · 9. Next Steps.

**Per-result user actions:** Save · Export · Share · Rerun · Delete.

---

## 24. Analysis Scoring System

Measurable scores (Conversion, Offer, Messaging, Campaign, Growth) on a 0–100 scale:
- 0–20 = Critical · 21–40 = Weak · 41–60 = Average · 61–80 = Strong · 81–100 = Excellent.

---

## 25. Analysis History System

Every completed analysis is saved. Users can View · Search · Filter · Sort · Delete · Reopen · Duplicate.
Stored: Analysis Type, Date, Inputs, Outputs, Token Usage. *Purpose: learn from past decisions.*

---

## 26–32. Monetization Detail

- **§26 Token Economy:** prevents unlimited AI usage; predictable costs; fair monetization; drives
  upgrades. Sources: Free allocation, Monthly Pro allocation, Top-ups, Promo bonuses, Admin allocations.
  Lifecycle: Allocated → Stored → Requested → Validated → Deducted → Runs → Stored.
- **§27 Free Plan:** 5 tokens; all tools, history, dashboard, basic support; no replenishment.
- **§28 Pro Plan:** $7/mo, 200 tokens/mo, all tools, monthly replenishment, history, priority support,
  future premium features. Renewal flow: Renews → Payment OK → 200 tokens allocated → continue.
- **§29 Token Top-Up:** $5 = 100 tokens, instant. Records date/amount/tokens/status.
- **§30 Subscription Management:** states Free/Active/Past Due/Cancelled/Expired; events New/Renewal/
  Cancel/Failed/Upgrade/Downgrade; controls View/Upgrade/Cancel/Billing History.
- **§31 Payment System:** subscription + top-up payments. Transaction record: ID, User ID, Amount,
  Currency, Status, Date, Type. Statuses: Pending/Successful/Failed/Refunded.
- **§32 Billing History:** subscription payments, token purchases, receipts, invoices.

---

## 33–40. User-Facing Systems

- **§33 Dashboard:** Token Overview · Subscription Overview · Recent Analyses · Quick Access Tools ·
  Notifications · Profile Summary.
- **§34 Token Balance Widget:** Current Balance, Monthly Allocation, Top-Up Balance, Used, Remaining.
- **§35 Subscription Widget:** Current Plan, Renewal Date, Benefits, Upgrade, Manage.
- **§36 Recent Analysis Widget:** Latest analyses, status, date, quick reopen.
- **§37 Quick Actions Panel:** Run New Analysis, Buy Tokens, Upgrade Plan, View History.
- **§38 User Profile:** Personal Info (name/email/photo), Business Info (company/industry/type), Security
  (password change, login activity, session management).
- **§39 Notification System:** categories = Analysis, Subscription, Token, Payment, System; channels =
  In-App, Email.
- **§40 Analysis History:** search/filter/sort/delete/reopen/duplicate; stores type/date/inputs/outputs/
  token usage.

---

## 41–50. Admin & Reporting

- **§41 Admin Dashboard:** User/Revenue/Token/Subscription Management, Analysis Monitoring, Support,
  Platform Analytics, System Health.
- **§42 User Management:** View/Search/Edit/Suspend/Delete/Restore; data: status, plan, token balance,
  analysis count, revenue contribution.
- **§43 Token Management:** Add/Remove/Adjust balances, View history; audit log tracks who/when/how
  many/why.
- **§44 Subscription Management:** views Active/Cancelled/Expired + Revenue; actions Upgrade/Downgrade/
  Grant Temporary Access.
- **§45 Analysis Monitoring:** Total/Completed/Failed, Avg Completion Time, Most Used Features.
- **§46 Revenue Management:** Monthly/Annual/Subscription/Top-Up revenue + Growth; reports daily→yearly.
- **§47 Platform Analytics:** Total/Active Users, Retention, Conversion, Subscription, Churn rates.
- **§48 Support Management:** ticket creation/assignment/resolution + feedback; statuses Open/Pending/
  Resolved/Closed.
- **§49 Audit Log:** records User/Admin/Payment/Token/Subscription events; benefits = security,
  transparency, troubleshooting, compliance.
- **§50 Reporting:** Revenue/User/Token/Subscription/Feature-usage reports; export PDF/CSV/Excel.

---

## 51–54. AI Infrastructure

- **§51 AI Infrastructure:** intelligence layer. Responsibilities: analyze, understand context, identify
  opportunities/risks, generate recommendations/plans, produce actionable outputs. Workflow: Input →
  Validate → Context → Prompt Construction → AI Analysis → Response Generation → Structuring → Delivery.
  Principles: Consistency, Accuracy, Business Relevance, Strategic Thinking, Actionability, Scalability.
- **§52 Prompt Engineering:** components = System Instructions, Tool Instructions, User Context, Analysis
  Framework, Output Structure. Benefits: consistent results, accuracy, fewer hallucinations, professional
  outputs.
- **§53 Response Processing:** Generated → Validation → Formatting → Section Organization → Storage →
  Delivery. Output structure mirrors §23.
- **§54 Analysis Job System:** Submit → Job Created → Queued → Processed → Results Generated → Stored →
  User Notified. Statuses: Queued/Processing/Completed/Failed/Cancelled.

---

## 55–62. Database Architecture

Core collections: Users, Analyses, Tokens, Subscriptions, Payments, Notifications, Support Tickets,
Audit Logs. Goals: Reliability, Scalability, Security, Fast Retrieval.
- **§56 Users:** ID, Name, Email, Plan, Token Balance, Subscription Status, Registration Date, Last Login.
- **§57 Analyses:** ID, User ID, Tool Used, Input Data, Generated Results, Status, Creation Date.
- **§58 Tokens:** Current Balance, Allocation/Consumption/Top-Up history.
- **§59 Subscriptions:** Plan Type, Status, Renewal Date, Billing Info.
- **§60 Payments:** Transaction IDs, Amounts, Status, Payment Type, User Reference.
- **§61 Notifications:** Type, Message, Status, Delivery Timestamp.
- **§62 Audit Logs:** Action Type, Actor, Timestamp, Affected Resource, Action Details.

---

## 63–68. Automation Engine

- **§63 Automation Engine:** Token Allocation, Subscription Renewal, Top-Up Processing, Notification
  Delivery, Analysis Completion, System Monitoring.
- **§64 Monthly Token Automation:** Renews → +200 tokens → balance updated → user notified.
- **§65 Top-Up Automation:** Payment OK → tokens added → balance updated → notified.
- **§66 Analysis Completion Automation:** Completed → results saved → notification → history updated.
- **§67 Email Automation:** Welcome, Verification, Password Reset, Analysis Complete, Payment,
  Subscription emails.
- **§68 System Monitoring:** API/Database/AI/Payment/Authentication health; goals = prevent downtime,
  detect early, improve reliability.

---

## 69–76. Security Framework

- **§69 Security Framework:** layers = Authentication, Authorization, Data, Payment, Infrastructure.
- **§70 Authentication Security:** Email Verification, Password Policies, Session Controls, Secure Login.
- **§71 Authorization Security:** access levels Guest/User/Pro User/Admin.
- **§72 Data Security:** Encrypted Storage/Transmission, Secure Access Controls, Data Isolation.
- **§73 API Security:** Rate Limiting, Request Validation, Abuse Detection, Access Restrictions.
- **§74 Payment Security:** Secure Processing, Transaction Validation, Fraud Monitoring, Audit Logging.
- **§75 Cybersecurity Framework:** Account/Infrastructure/Application/Database/Operational protection;
  monitoring = Threat/Suspicious-Activity/Anomaly/Access detection.
- **§76 Backup & Recovery:** Data Backups, Recovery Procedures, Disaster Recovery, Redundancy.

---

## 77–78. Scaling & Performance

- **§77 Scalability Architecture:** grow from hundreds to millions of users. Principles: Modular
  Architecture, Horizontal Scaling, Service Isolation, Performance Optimization.
- **§78 Performance Optimization:** Database Queries, AI Processing, Caching, API Responses, Frontend
  Loading.

---

## 79–90. Future Phases & Vision

- **§79–80 Team Workspaces (Phase 2):** shared workspace/analyses, team members, role permissions
  (Owner/Manager/Member/Viewer); permissions for Analysis/Billing/User/Workspace management.
- **§81–82 Agency Mode (Phase 3):** multiple clients, client workspaces/reports/billing; client
  creation/organization/reporting/history.
- **§83–84 Enterprise Platform (Phase 4):** enterprise workspaces, advanced controls, custom limits,
  dedicated support; White Label (custom branding/domains/appearance, client ownership).
- **§85 Advanced Analytics Suite:** Trend/Usage/Revenue/Growth forecasting.
- **§86 Marketplace Ecosystem (future):** third-party integrations, community templates, premium analysis
  packs, partner solutions.
- **§87 AI Model Expansion:** multiple models for specialization, accuracy, cost optimization, redundancy.
- **§88 Business Intelligence Layer:** Revenue Trends, User Behavior, Feature Adoption, Growth
  Opportunities.
- **§89 Platform OS Vision:** evolve into Decision/Growth/Marketing/Operational/Executive Intelligence.
- **§90 End State Vision:** become the central intelligence layer businesses rely on to analyze markets,
  evaluate offers, improve funnels, understand customers, develop strategies, scale, and make better
  decisions.

---

## Master Platform Flow

Visitor → Website → Signup → Onboarding → Dashboard → Feature Selection → Analysis Submission → Token
Consumption → AI Processing → Results Generation → Results Storage → Analysis History → Upgrade to Pro →
Monthly Token Allocation → Token Top-Ups → Continued Usage → Team Adoption → Agency Adoption → Enterprise
Adoption → Long-Term Retention.
