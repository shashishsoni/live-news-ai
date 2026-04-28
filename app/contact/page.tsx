import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Live Update News for corrections, source suggestions, and verification feedback."
};

export default function ContactPage() {
  return (
    <section className="section-shell page-section contact-page">
      <span className="eyebrow">Corrections and source suggestions</span>
      <h1>Contact</h1>
      <p className="page-intro">Use this page for correction requests, source suggestions, and verification feedback. Include the article link, source link, and the issue you want reviewed.</p>
      <div className="contact-card glass-card">
        <h2>Editorial transparency inbox</h2>
        <p>Configure your production support address in this page before launch. For now, use the placeholder below.</p>
        <a className="button primary" href="mailto:corrections@example.com?subject=Live%20Update%20News%20Correction">
          Email corrections@example.com
        </a>
      </div>
    </section>
  );
}
