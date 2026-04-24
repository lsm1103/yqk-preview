import type { PropsWithChildren, ReactNode } from "react";

interface ContentSectionProps extends PropsWithChildren {
  title: string;
  extra?: ReactNode;
}

export default function ContentSection({ title, extra, children }: ContentSectionProps) {
  return (
    <section className="content-section">
      <header className="section-header">
        <h2>{title}</h2>
        {extra ? <div className="section-extra">{extra}</div> : null}
      </header>
      {children}
    </section>
  );
}
