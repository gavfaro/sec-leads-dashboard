import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  try {
    const { cik, companyName, address, signer, executives } = await req.json();

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

    // 5. SAVE TO SUPABASE
    const { error } = await supabase.from("ai_profiles").upsert({
      cik: cik,
      website_url: websiteUrl,
      ai_summary: aiSummary,
      ceo_name: ceoName,
      ceo_linkedin: ceoLinkedin,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
