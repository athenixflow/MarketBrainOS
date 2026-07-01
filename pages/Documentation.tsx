// Documentation — thin entry point. All content and routing live in the docs mini-app
// (components/docs/DocsApp.tsx): a searchable hub with per-topic sub-pages, each with its own
// table of contents. Mounted at the App.tsx route `/documentation/*`.

import React from 'react';
import DocsApp from '../components/docs/DocsApp';

const Documentation: React.FC = () => <DocsApp />;

export default Documentation;
