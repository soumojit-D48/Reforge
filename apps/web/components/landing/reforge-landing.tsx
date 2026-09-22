"use client";

import { useEffect } from "react";
import { ComparisonSection } from "./comparison-section";
import { AudienceSection, IntegrationSection } from "./integration-audience";
import { Hero, ProofStrip } from "./hero-section";
import { ProblemSection } from "./problem-section";
import { ProductTour } from "./product-tour";
import { FinalCta, Footer, SiteHeader } from "./site-shell";
import { WorkflowSection } from "./workflow-section";

export function ReforgeLanding() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal, .observe-group"),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -5%" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="reforge-page">
      <SiteHeader />
      <main>
        <Hero />
        <ProofStrip />
        <ProblemSection />
        <WorkflowSection />
        <ComparisonSection />
        <ProductTour />
        <IntegrationSection />
        <AudienceSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
