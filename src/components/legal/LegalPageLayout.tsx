import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalPageLayoutProps = {
  title: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
  contactNote?: ReactNode;
};

export const LegalPageLayout = ({
  title,
  summary,
  effectiveDate,
  sections,
  contactNote,
}: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl rounded-[32px] border border-border bg-background/90 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Game Changrs Legal
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {summary}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Effective date: {effectiveDate}
            </p>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl space-y-6">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[28px] border border-border bg-gradient-card p-6 md:p-8"
              >
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  {section.title}
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
                    {paragraph}
                  </p>
                ))}

                {section.bullets?.length ? (
                  <ul className="mt-4 space-y-3 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="list-disc">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}

            {contactNote ? (
              <div className="rounded-[28px] border border-border bg-background p-6 text-sm leading-7 text-muted-foreground md:p-8 md:text-base">
                {contactNote}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
