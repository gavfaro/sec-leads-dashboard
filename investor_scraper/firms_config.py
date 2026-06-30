"""
Portfolio page URLs for every target VC firm.

Fields:
  name            - canonical firm name stored in Supabase
  website         - firm root domain
  portfolio_url   - direct URL to portfolio/companies page (None = no public page)
  notes           - scraping hints or why a URL is missing
"""

FIRMS = [
    # ── Already done ──────────────────────────────────────────────────────────
    # Sequoia is handled by scrape_sequoia.py; kept here for reference only.
    # {"name": "Sequoia", "portfolio_url": "https://sequoiacap.com/our-companies/"},

    # ── Tier 1 (public portfolio pages confirmed) ──────────────────────────────
    {
        "name": "Andreessen Horowitz",
        "website": "https://a16z.com",
        "portfolio_url": "https://a16z.com/portfolio/",
    },
    {
        "name": "Accel",
        "website": "https://www.accel.com",
        "portfolio_url": "https://www.accel.com/companies",
    },
    {
        "name": "Index Ventures",
        "website": "https://www.indexventures.com",
        "portfolio_url": "https://www.indexventures.com/companies/",
    },
    {
        "name": "Lightspeed",
        "website": "https://lsvp.com",
        "portfolio_url": "https://lsvp.com/portfolio/",
    },
    {
        "name": "Thrive Capital",
        "website": "https://www.thrivecap.com",
        "portfolio_url": "https://www.thrivecap.com/portfolio",
    },
    {
        "name": "Founders Fund",
        "website": "https://foundersfund.com",
        "portfolio_url": "https://foundersfund.com/portfolio/",
    },
    {
        "name": "ICONIQ Growth",
        "website": "https://iconiqcapital.com",
        "portfolio_url": "https://iconiqcapital.com/growth/companies/",
    },
    {
        "name": "Kleiner Perkins",
        "website": "https://www.kleinerperkins.com",
        "portfolio_url": "https://www.kleinerperkins.com/companies/",
    },
    {
        "name": "NEA",
        "website": "https://www.nea.com",
        "portfolio_url": "https://www.nea.com/companies",
    },
    {
        "name": "Greylock",
        "website": "https://greylock.com",
        "portfolio_url": "https://greylock.com/portfolio-companies/",
    },
    {
        "name": "Benchmark",
        "website": "https://www.benchmark.com",
        "portfolio_url": "https://www.benchmark.com/companies/",
    },
    {
        "name": "Bessemer Venture Partners",
        "website": "https://www.bvp.com",
        "portfolio_url": "https://www.bvp.com/portfolio",
    },
    {
        "name": "Khosla Ventures",
        "website": "https://www.khoslaventures.com",
        "portfolio_url": "https://www.khoslaventures.com/portfolio",
    },
    {
        "name": "General Catalyst",
        "website": "https://www.generalcatalyst.com",
        "portfolio_url": "https://www.generalcatalyst.com/portfolio",
    },
    {
        "name": "General Atlantic",
        "website": "https://www.generalatlantic.com",
        "portfolio_url": "https://www.generalatlantic.com/portfolio/",
    },
    {
        "name": "IVP",
        "website": "https://www.ivp.com",
        "portfolio_url": "https://www.ivp.com/portfolio/",
    },
    {
        "name": "Mayfield",
        "website": "https://www.mayfield.com",
        "portfolio_url": "https://www.mayfield.com/portfolio",
    },
    {
        "name": "Sutter Hill Ventures",
        "website": "https://www.shv.com",
        "portfolio_url": "https://www.shv.com/portfolio/",
    },
    {
        "name": "OrbiMed",
        "website": "https://www.orbimed.com",
        "portfolio_url": "https://www.orbimed.com/portfolio/",
    },
    {
        "name": "Insight Partners",
        "website": "https://www.insightpartners.com",
        "portfolio_url": "https://www.insightpartners.com/portfolio/",
    },
    {
        "name": "Spark Capital",
        "website": "https://www.sparkcapital.com",
        "portfolio_url": "https://www.sparkcapital.com/portfolio",
    },
    {
        "name": "Battery Ventures",
        "website": "https://www.battery.com",
        "portfolio_url": "https://www.battery.com/portfolio/",
    },
    {
        "name": "Paradigm",
        "website": "https://www.paradigm.xyz",
        "portfolio_url": "https://www.paradigm.xyz/portfolio",
        "notes": "crypto-focused fund",
    },
    {
        "name": "Oak HC/FT",
        "website": "https://www.oakhcft.com",
        "portfolio_url": "https://www.oakhcft.com/portfolio/",
    },
    {
        "name": "Atlas Venture",
        "website": "https://www.atlasventure.com",
        "portfolio_url": "https://www.atlasventure.com/portfolio/",
    },
    {
        "name": "Venrock",
        "website": "https://www.venrock.com",
        "portfolio_url": "https://www.venrock.com/portfolio/",
    },
    {
        "name": "Meritech Capital",
        "website": "https://www.meritechcapital.com",
        "portfolio_url": "https://www.meritechcapital.com/portfolio/",
    },
    {
        "name": "Norwest Venture Partners",
        "website": "https://www.nvp.com",
        "portfolio_url": "https://www.nvp.com/portfolio/",
    },
    {
        "name": "CRV",
        "website": "https://www.crv.com",
        "portfolio_url": "https://www.crv.com/portfolio/",
    },
    {
        "name": "Bain Capital Ventures",
        "website": "https://www.baincapitalventures.com",
        "portfolio_url": "https://www.baincapitalventures.com/portfolio/",
    },
    {
        "name": "Menlo Ventures",
        "website": "https://www.menlovc.com",
        "portfolio_url": "https://www.menlovc.com/portfolio/",
    },
    {
        "name": "Pace Capital",
        "website": "https://www.pace.vc",
        "portfolio_url": "https://www.pace.vc/portfolio",
    },
    {
        "name": "8VC",
        "website": "https://8vc.com",
        "portfolio_url": "https://8vc.com/portfolio/",
    },
    {
        "name": "TCV",
        "website": "https://www.tcv.com",
        "portfolio_url": "https://www.tcv.com/portfolio/",
    },
    {
        "name": "Lux Capital",
        "website": "https://www.luxcapital.com",
        "portfolio_url": "https://www.luxcapital.com/portfolio/",
    },
    {
        "name": "ARCH Venture Partners",
        "website": "https://www.archventure.com",
        "portfolio_url": "https://www.archventure.com/",
        "notes": "portfolio may be on homepage or needs custom scraping",
    },
    {
        "name": "Union Square Ventures",
        "website": "https://www.usv.com",
        "portfolio_url": "https://www.usv.com/portfolio/",
    },
    {
        "name": "Notable Capital",
        "website": "https://notablecap.com",
        "portfolio_url": "https://notablecap.com/portfolio",
        "notes": "formerly Harris & Harris Group",
    },
    {
        "name": "Ribbit Capital",
        "website": "https://ribbitcap.com",
        "portfolio_url": "https://ribbitcap.com/",
        "notes": "portfolio may be embedded in homepage",
    },
    {
        "name": "Bedrock Capital",
        "website": "https://www.bedrockcap.com",
        "portfolio_url": "https://www.bedrockcap.com/portfolio",
    },

    # ── Needs URL verification — update before running ─────────────────────────
    {
        "name": "Altimeter Capital",
        "website": "https://www.altimetercapital.com",
        "portfolio_url": "https://www.altimetercapital.com/",
        "notes": "TODO: verify portfolio page path",
    },
    {
        "name": "Parkway Venture Capital",
        "website": "https://www.parkwayvc.com",
        "portfolio_url": "https://www.parkwayvc.com/portfolio",
        "notes": "TODO: confirm this is the right Parkway from your list",
    },
    {
        "name": "Inflection Ventures",
        "website": None,
        "portfolio_url": None,
        "notes": "TODO: confirm which Inflection Ventures this is and find URL",
    },
    {
        "name": "SVA",
        "website": None,
        "portfolio_url": None,
        "notes": "TODO: unclear which firm SVA refers to — confirm and add URL",
    },
    {
        "name": "Greenoaks Capital",
        "website": "https://www.greenoaks.com",
        "portfolio_url": None,
        "notes": "no public portfolio page; may require alternative data source",
    },

    # ── No public portfolio page ───────────────────────────────────────────────
    {
        "name": "DST Global",
        "website": "https://dst-global.com",
        "portfolio_url": None,
        "notes": "does not publish a public portfolio list",
    },
    {
        "name": "Tiger Global",
        "website": "https://www.tigerglobal.com",
        "portfolio_url": None,
        "notes": "does not publish a public portfolio list",
    },
    {
        "name": "Coatue",
        "website": "https://www.coatue.com",
        "portfolio_url": None,
        "notes": "does not publish a public portfolio list",
    },
    {
        "name": "Dragoneer",
        "website": "https://www.dragoneer.com",
        "portfolio_url": None,
        "notes": "does not publish a public portfolio list",
    },
]
