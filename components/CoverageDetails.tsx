import styles from "./CoverageDetails.module.css";

// This describes the owner's scheduled digest. It is not a public subscription form.
const sourceGroups = [
  {
    title: "News & industry",
    description: "Market activity, project launches, transactions and infrastructure.",
    sources: [
      ["ETRealty", "https://realty.economictimes.indiatimes.com/"],
      ["ET Infra", "https://infra.economictimes.indiatimes.com/"],
      ["Moneycontrol", "https://www.moneycontrol.com/real-estate-property/"],
      ["RealtyNXT", "https://realtynxt.com/"],
    ],
  },
  {
    title: "Property blogs & guides",
    description: "Local market perspectives, ownership, renting and property explainers.",
    sources: [
      ["NoBroker", "https://www.nobroker.in/blog/"],
      ["Square Yards", "https://www.squareyards.com/blog"],
      ["Housing.com", "https://housing.com/news/"],
      ["Magicbricks", "https://www.magicbricks.com/news"],
    ],
  },
  {
    title: "Research & market reports",
    description: "India-focused findings on demand, supply, investment and leasing.",
    sources: [
      ["CBRE India", "https://www.cbre.co.in/insights"],
      ["JLL India", "https://www.jll.com/en-in/insights"],
      ["Knight Frank India", "https://www.knightfrank.co.in/research"],
    ],
  },
  {
    title: "Policy & official notices",
    description: "Government releases, state RERA updates and city development notices.",
    sources: [
      ["Press Information Bureau", "https://www.pib.gov.in/"],
      ["Telangana RERA", "https://rera.telangana.gov.in/"],
      ["HMDA public notices", "https://www.hmda.gov.in/public-notices/"],
    ],
  },
];

export default function CoverageDetails() {
  return (
    <section className={styles.coverage} aria-labelledby="coverage-heading">
      <div className={styles.digest}>
        <div>
          <p className={styles.eyebrow}>The daily briefing</p>
          <h2 id="coverage-heading">A closer view of Hyderabad.</h2>
          <p>Hyderabad news, property blogs, research and official notices, brought together in the owner’s daily email digest.</p>
        </div>
        <div className={styles.schedule}>
          <span className={styles.label}>Scheduled daily</span>
          <strong>9:00 <span>AM IST</span></strong>
          <span>Delivered to the owner’s connected Gmail</span>
        </div>
      </div>

      <div className={styles.explainer}>
        <p><strong>Inside the digest.</strong> Key developments, city and category labels, concise summaries and original source links. Reports about the same event are grouped, and material updates are highlighted.</p>
        <p><strong>Hyderabad focus.</strong> Hyderabad and its surrounding property markets, including Kokapet, Neopolis, Raidurg, Gachibowli, Nanakramguda, Tellapur and Shamshabad. Telangana policy is included when it affects the city.</p>
      </div>

      <div className={styles.sourceHeader}>
        <h3>Daily digest source coverage</h3>
        <span>Public feeds, publisher pages & web searches</span>
      </div>
      <div className={styles.sources}>
        {sourceGroups.map((group) => (
          <article className={styles.sourceCard} key={group.title}>
            <h4>{group.title}</h4>
            <p>{group.description}</p>
            <ul>{group.sources.map(([name, url]) => (
              <li key={name}><a href={url} target="_blank" rel="noopener noreferrer">{name}<span className={styles.srOnly}> (opens in a new tab)</span><span aria-hidden="true"> ↗</span></a></li>
            ))}</ul>
          </article>
        ))}
      </div>
      <div className={styles.notes}>
        <p><strong>How coverage works.</strong> The feed above shows Hyderabad discoveries published within the past 30 days, with source excerpts or labelled AI summaries. The separately scheduled email digest also searches the wider sources listed here; listing a source does not mean every article is imported into the live feed.</p>
        <p>Coverage is best effort. Blocked pages and delayed indexing can cause gaps. The digest runs through the owner’s Codex automation and connected Gmail; meaningful new stories trigger an email. This site does not offer public email sign-ups.</p>
      </div>
    </section>
  );
}
