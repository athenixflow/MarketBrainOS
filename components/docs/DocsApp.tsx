// Documentation mini-app: its own routing (hub, category, article) under a shared docs shell,
// wrapped in schema.org TechArticle markup for indexing. Mounted by pages/Documentation.tsx at
// the App.tsx route `/documentation/*`.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DocsLayout from './DocsLayout';
import DocsHome from './DocsHome';
import DocsCategory from './DocsCategory';
import DocArticle from './DocArticle';

const DocsApp: React.FC = () => (
  <div itemScope itemType="https://schema.org/TechArticle">
    <meta itemProp="headline" content="MarketBrain OS Documentation" />
    <meta itemProp="description" content="Complete guides for every MarketBrain OS tool, the token economy, plans and billing, collaboration layers, roles, and the admin console." />
    <Routes>
      <Route element={<DocsLayout />}>
        <Route index element={<DocsHome />} />
        <Route path=":categoryId" element={<DocsCategory />} />
        <Route path=":categoryId/:articleId" element={<DocArticle />} />
        <Route path="*" element={<Navigate to="/documentation" replace />} />
      </Route>
    </Routes>
  </div>
);

export default DocsApp;
