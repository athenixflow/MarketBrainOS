// Documentation mini-app: its own routing (hub, category, article) under a shared docs shell,
// wrapped in schema.org TechArticle markup for indexing. Mounted by pages/Documentation.tsx at
// the App.tsx route `/documentation/*`.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DocsLayout from './DocsLayout';
import DocsHome from './DocsHome';
import DocsCategory from './DocsCategory';
import DocArticle from './DocArticle';

// Per-page SEO (title/description/canonical + TechArticle/BreadcrumbList JSON-LD) is emitted by the
// individual docs routes via <Seo>, so no static wrapper microdata here.
const DocsApp: React.FC = () => (
  <Routes>
    <Route element={<DocsLayout />}>
      <Route index element={<DocsHome />} />
      <Route path=":categoryId" element={<DocsCategory />} />
      <Route path=":categoryId/:articleId" element={<DocArticle />} />
      <Route path="*" element={<Navigate to="/documentation" replace />} />
    </Route>
  </Routes>
);

export default DocsApp;
