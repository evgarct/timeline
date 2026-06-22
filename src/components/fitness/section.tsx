import type { ReactNode } from "react";

export function Section({
  title,
  action,
  children,
  id
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-20">
      <div className="flex items-end justify-between gap-4 px-1">
        <h2 className="text-[0.72rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

