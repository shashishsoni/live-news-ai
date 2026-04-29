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
        <p>Use the email below for correction requests and source verification feedback.</p>
        <a className="button primary" href="mailto:shshshsoni2003@gmail.com?subject=Live%20Update%20News%20Correction">
          Email shshshsoni2003@gmail.com
        </a>
      </div>
    </section>
  );
}
