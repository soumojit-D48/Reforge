'use client';

import { use } from 'react';
import type { ReactNode } from 'react';
import { ProjectSocketProvider } from '../../../../hooks/use-project-socket';

export default function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}): React.JSX.Element {
  const { projectId } = use(params);

  return (
    <ProjectSocketProvider projectId={projectId}>
      {children}
    </ProjectSocketProvider>
  );
}
