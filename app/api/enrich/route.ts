import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// discovered_investors only grants `select` to the anon key (writes are meant to
// come from a trusted server) — the service role key is required to insert rows.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const INVESTOR_SEARCH_MAX_USES = 6;
const VALID_CONFIDENCE = ["high", "medium", "low"];

export async function POST(req: Request) {
  try {
    const {
      cik,
      accessionNumber,
      companyName,
      address,
      signer,
      executives,
      relatedPersons,
      industry,
      dateOfFirstSale,
      targetRaise,
      amountSold,
    } = await req.json();

    // 1. CLEARBIT: Find Website
    let websiteUrl = "Not Found";
    const cleanName = companyName
      .toLowerCase()
      .replace(
        /( inc\.| inc| corp\.| corp| llc| ltd\.| ltd| co\.| company|,)/g,
        "",
      )
      .trim();
    try {
      const cbRes = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${cleanName}`,
      );
      if (cbRes.ok) {
        const cbData = await cbRes.json();
        if (cbData && cbData.length > 0)
          websiteUrl = `https://${cbData[0].domain}`;
      }
    } catch (e) {
      /* Ignore Clearbit errors */
    }

    // 2. GEMINI FALLBACK: If Clearbit failed
    if (websiteUrl === "Not Found" && process.env.GEMINI_API_KEY) {
      const searchPrompt = `
        You are an expert corporate researcher. Your task is to find the official company website for a newly funded startup.
        Company Name: ${companyName}
        Physical Address: ${address}
        
        Instructions:
        1. Use Google Search to find the official, primary website domain for this exact company.
        2. Verify that the website belongs to a company matching this name and located at/near this address or in this general industry.
        3. DO NOT return aggregator sites, news articles, SEC links, Crunchbase profiles, or LinkedIn pages. We only want the official corporate website (e.g., https://www.example.com).
        4. ONLY reply with the raw, exact URL starting with http:// or https://. Do not add any conversational text, markdown formatting, or explanations.
        5. If you cannot confidently find their official corporate website, reply with exactly: 'Not Found'.
      `;
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: searchPrompt }] }],
            tools: [{ googleSearch: {} }],
          }),
        },
      );
      const geminiData = await geminiRes.json();
      const aiUrl =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (aiUrl && aiUrl.startsWith("http")) websiteUrl = aiUrl;
    }

    // 3. SCRAPE WEBSITE
    let aiSummary = "Website analysis failed or not found.";
    if (websiteUrl !== "Not Found" && process.env.GEMINI_API_KEY) {
      try {
        const scrapeRes = await fetch(websiteUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const html = await scrapeRes.text();
        const $ = cheerio.load(html);

        const socials = new Set<string>();
        const contacts = new Set<string>();

        $("a[href]").each((_, el) => {
          const href = $(el).attr("href") || "";
          const lower = href.toLowerCase();
          if (
            ["linkedin.com", "twitter.com", "x.com", "instagram.com"].some(
              (d) => lower.includes(d),
            )
          )
            socials.add(href);
          if (lower.startsWith("mailto:"))
            contacts.add(href.replace(/mailto:/i, "").trim());
          if (lower.startsWith("tel:"))
            contacts.add(href.replace(/tel:/i, "").trim());
        });

        $("script, style").remove();
        const rawText = $("body")
          .text()
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 10000);

        // Analyze with Gemini
        const analysisPrompt = `
          You are an expert startup analyst. I just scraped the homepage of a newly funded startup. 
          
          Here is the structured data we pulled from their website's code (${websiteUrl}):
          Found Social Links: ${Array.from(socials)}
          Found Contact Info: ${Array.from(contacts)}
          
          Here is the RAW WEBSITE TEXT:
          ${rawText}
          
          Based on all of this, provide a clean, professional profile with the following:
          1. **Summary:** Exactly what this company does in one clear sentence.
          2. **Target Customer:** Who their target customer is (B2B, B2C, Enterprise, etc.).
          3. **True Industry:** What their actual true industry/category is (e.g., EdTech, FinTech, Hardware, SaaS).
          4. **Contact & Socials:** Provide a clean list of their Social Media links and Contact Information. If none exist, state "None found".
        `;

        const summaryRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: analysisPrompt }] }],
            }),
          },
        );
        const summaryData = await summaryRes.json();
        aiSummary =
          summaryData.candidates?.[0]?.content?.parts?.[0]?.text || aiSummary;
      } catch (e) {
        aiSummary = "Failed to scrape or parse the website.";
      }
    }

    // 4. CLAUDE HAIKU: Find CEO LinkedIn
    let ceoName = "Unknown";
    let ceoLinkedin = "Not Found";

    if (process.env.ANTHROPIC_API_KEY) {
      const haikuPrompt = `Company: ${companyName}\nSigner: ${signer}\nKey Persons: ${executives}\n\nTask 1: Deduce who the CEO or primary Founder is based on the provided names.\nTask 2: Use the web_search tool to find that specific person's LinkedIn profile URL.\nTry this search angle specifically: "${companyName}" linkedin\n\nCRITICAL RULES:\n1. You are a strictly automated script — output NOTHING but valid JSON, no markdown fences, no commentary, no text before or after the JSON.\n2. NEVER invent or guess a URL. If search does not return a confirmed LinkedIn profile matching this person AND this company, set "url" to null.\n3. Output EXACTLY this JSON shape and nothing else:\n   {"name": "<deduced CEO name>", "url": "<linkedin url or null>"}`;

      const anthropicRes = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: haikuPrompt }],
            tools: [{ type: "web_search_20250305", name: "web_search" }],
          }),
        },
      );

      if (anthropicRes.ok) {
        const anthropicData = await anthropicRes.json();
        const textBlocks =
          anthropicData.content
            ?.filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("\n") || "";
        const cleanResponse = textBlocks
          .replace(/```json|```/g, "")
          .replace(/\[\d+\]/g, "")
          .trim();

        try {
          const match = cleanResponse.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.name) ceoName = parsed.name;
            if (parsed.url && parsed.url.includes("linkedin.com/in/"))
              ceoLinkedin = parsed.url;
          }
        } catch (e) {
          /* JSON parse error from Claude */
        }
      }
    }

    // 5. CLAUDE HAIKU: Investor Smart Search — hunt the open web for who
    // actually invested in this round via PR/news, since Form D itself never
    // discloses investor names.
    let round: { stage?: string; amount?: string; date?: string } = {};
    let roundSummary = "";
    let smartSearchInvestors: Array<{
      name: string;
      type: string;
      role: string;
      confidence: string;
      source_url: string;
      evidence: string;
    }> = [];

    if (process.env.ANTHROPIC_API_KEY) {
      const investorPrompt = `You are an investigative venture-capital researcher. A startup just filed an SEC Form D, which discloses the size of a fundraise but NOT who the investors are. Your job is to find the actual investors (VC funds, angels, accelerators, syndicates) using the public web.

COMPANY UNDER INVESTIGATION
Name: ${companyName}
Address: ${address}
Industry (per SEC): ${industry || "N/A"}
Date of first sale (approx. round date): ${dateOfFirstSale || "N/A"}
Target raise: ${targetRaise || "N/A"}
Amount sold so far: ${amountSold || "N/A"}
Form D signer: ${signer || "N/A"}
Key persons / execs on the filing: ${executives || "N/A"}

SEARCH STRATEGY — use the web_search tool, trying several angles:
- "${companyName}" raises / funding / seed / Series A / led by
- "${companyName}" press release / announces investment
- site:techcrunch.com OR axios.com OR businesswire.com OR prnewswire.com "${companyName}"
Use the address, industry, and round date to make sure you are reading about THIS exact company.

OUTPUT — return ONLY valid JSON, no markdown fences, no commentary, exactly this shape:
{"round": {"stage": "<seed/Series A/etc or unknown>", "amount": "<reported amount or unknown>", "date": "<announce date or unknown>"},
  "investors": [{"name": "<investor or fund>", "type": "<VC|Angel|Accelerator|CVC|Syndicate|Unknown>", "role": "<lead|participant|unknown>", "confidence": "<high|medium|low>", "source_url": "<url>", "evidence": "<short quote or paraphrase>"}],
  "summary": "<one sentence on what the public record shows about this round; say so plainly if nothing was found>"}`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [{ role: "user", content: investorPrompt }],
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: INVESTOR_SEARCH_MAX_USES,
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const textBlocks =
            data.content
              ?.filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n") || "";
          const clean = textBlocks
            .replace(/```json|```/g, "")
            .replace(/\[\d+\]/g, "")
            .trim();
          const match = clean.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            round = parsed.round || {};
            roundSummary = parsed.summary || "";
            smartSearchInvestors = (parsed.investors || []).filter(
              (i: any) => i?.name && i?.source_url,
            );
          }
        }
      } catch (e) {
        /* Investor smart search failed */
      }
    }

    // 6. BOARD SEAT HACK: the lead VC usually takes a board seat, so identify
    // it indirectly by looking up outside directors' fund affiliations.
    let vcsFound: Array<{
      director_name: string;
      vc_firm: string;
      role: string;
      evidence_url: string;
    }> = [];

    const outsideDirectors = ((relatedPersons || []) as Array<{
      name: string;
      relationships: string[];
    }>)
      .filter(
        (p) =>
          p.relationships?.some((r) => r.includes("Director")) &&
          !p.relationships?.some((r) => r.includes("Executive")),
      )
      .map((p) => p.name);

    if (outsideDirectors.length > 0 && process.env.ANTHROPIC_API_KEY) {
      const directorPrompt = `You are an elite venture capital researcher. A startup named "${companyName}" just filed an SEC Form D.
The institution names are hidden, but the lead VC usually takes a board seat.

Here are the outside directors listed on the SEC filing:
${outsideDirectors.join(", ")}

YOUR TASK: Use the web_search tool to look up these specific individuals. Determine if any of them are General Partners, Managing Directors, Principals, or Partners at a Venture Capital firm, Private Equity firm, or active institutional fund.

SEARCH TARGETS:
- "<Director Name>" venture capital OR partner OR fund
- "<Director Name>" "${companyName}" board

CRITICAL RULES:
1. Do not make assumptions. If an individual is an independent angel or a professor without a fund affiliation, do not label them as a VC firm.
2. Output strictly raw JSON in the exact structure requested. No markdown fences, no conversational prefix or suffix.

OUTPUT SCHEMA:
{"vcs_found": [{"director_name": "<name>", "vc_firm": "<firm name>", "role": "<partner/managing director/etc>", "evidence_url": "<url>"}]}`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: directorPrompt }],
            tools: [
              { type: "web_search_20250305", name: "web_search", max_uses: 4 },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const textBlocks =
            data.content
              ?.filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n") || "";
          const clean = textBlocks
            .replace(/```json|```/g, "")
            .replace(/\[\d+\]/g, "")
            .trim();
          const match = clean.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            vcsFound = (parsed.vcs_found || []).filter((v: any) => v?.vc_firm);
          }
        }
      } catch (e) {
        /* Board seat hack failed */
      }
    }

    // 7. SAVE TO SUPABASE. discovered_investors only grants inserts to the
    // service role, so both writes go through the service client.
    const svc = getServiceClient();

    const { error: profileError } = await svc.from("ai_profiles").upsert({
      cik: cik,
      website_url: websiteUrl,
      ai_summary: aiSummary,
      ceo_name: ceoName,
      ceo_linkedin: ceoLinkedin,
      round_stage: round.stage || null,
      round_amount: round.amount || null,
      round_date: round.date || null,
      round_summary: roundSummary || null,
      updated_at: new Date().toISOString(),
    });

    if (profileError) throw profileError;

    if (accessionNumber) {
      const investorRows = [
        ...smartSearchInvestors.map((inv) => {
          const confidence = (inv.confidence || "low").toLowerCase();
          return {
            cik,
            accession_number: accessionNumber,
            investor_name: inv.name,
            investor_type: inv.type || "Unknown",
            role: inv.role || "unknown",
            confidence: VALID_CONFIDENCE.includes(confidence)
              ? confidence
              : "low",
            source_url: inv.source_url,
            evidence: inv.evidence || "",
            discovery_method: "smart_search",
          };
        }),
        ...vcsFound.map((vc) => ({
          cik,
          accession_number: accessionNumber,
          investor_name: vc.vc_firm,
          investor_type: "VC",
          role: vc.role || "unknown",
          confidence: "medium",
          source_url: vc.evidence_url || null,
          evidence: `Director ${vc.director_name} affiliated with this firm`,
          discovery_method: "board_seat_hack",
        })),
      ];

      if (investorRows.length > 0) {
        const { error: investorsError } = await svc
          .from("discovered_investors")
          .upsert(investorRows, {
            onConflict: "accession_number,investor_name,discovery_method",
          });
        if (investorsError) throw investorsError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
