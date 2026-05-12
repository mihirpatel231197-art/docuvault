// Fake data matching the shapes documented in the DocuVault API.
window.DV_DATA = (() => {
  const cats = [
    { name: "Finance", count: 312 },
    { name: "Legal", count: 87 },
    { name: "Tax", count: 64 },
    { name: "Medical", count: 41 },
    { name: "Receipts", count: 218 },
    { name: "Travel", count: 39 },
    { name: "Insurance", count: 22 },
    { name: "Personal", count: 156 },
    { name: "Project", count: 274 },
    { name: "Reference", count: 134 },
  ];
  const stats = {
    total_documents: 1847,
    total_size_bytes: 13_200_000_000,
    pending_review: 23,
    watched_folders: 4,
    categories: Object.fromEntries(cats.map(c => [c.name, c.count])),
    classification: {
      rule_based_free: 1284,
      ai_classified: 563,
      estimated_api_cost: 4.18,
      cached_patterns: 47,
    },
  };
  const docs = [
    { id: "d1",  title: "Lease agreement — 2024 renewal",       file_path: "~/Documents/Apartments/lease-2024-renewal.pdf",         mime_type: "application/pdf",  category: "Legal",     subcategory: "Contract",   summary: "Apartment lease starting Apr 2024 for 12 months at $2,840/mo. Auto-renew with 60 days notice.", file_size: 2_140_000, ai_confidence: 0.94, document_date: "2024-03-12", indexed_at: "2 minutes ago",   tags: ["2024","renewal","apartment"], people:["Jane Doe","Mike Carter"], organizations:["Sunset Properties LLC"] },
    { id: "d2",  title: "Q3 board memo (final v2)",              file_path: "~/Work/board/Q3-memo-final-v2.docx",                    mime_type: "application/msword", category: "Project",  subcategory: "Memo",       summary: "Q3 strategy memo for the board on hiring plan and ARR targets.", file_size: 340_000, ai_confidence: 0.68, document_date: "2024-09-30", indexed_at: "12 minutes ago", tags: ["board","Q3","draft"], people:[], organizations:[] },
    { id: "d3",  title: "Federal tax return 2023",               file_path: "~/Documents/Tax/2023/1040-final.pdf",                   mime_type: "application/pdf",  category: "Tax",       subcategory: "Return",     summary: "1040 with Schedule A and B. AGI $182,440. Refund $1,204 deposited Apr 18, 2024.", file_size: 4_900_000, ai_confidence: 0.97, document_date: "2024-04-15", indexed_at: "an hour ago", tags: ["2023","federal","1040"], people:[], organizations:["IRS"] },
    { id: "d4",  title: "Health insurance card scan",            file_path: "~/Scans/insurance-card-2024.png",                        mime_type: "image/png",        category: "Medical",   subcategory: "Insurance",  summary: "Scanned health insurance card front and back. Member ID redacted in summary.", file_size: 1_800_000, ai_confidence: 0.61, document_date: "2024-01-22", indexed_at: "yesterday", tags: ["card","scan"], people:[], organizations:["BlueCross"] },
    { id: "d5",  title: "Trader Joe's receipt",                  file_path: "~/Photos/Receipts/2024-09-14_TJ.jpg",                    mime_type: "image/jpeg",       category: "Receipts",  subcategory: "Grocery",    summary: "Grocery receipt $87.42 on Sep 14, 2024. 14 line items.", file_size: 920_000, ai_confidence: 0.42, document_date: "2024-09-14", indexed_at: "2 days ago", tags: ["grocery"], people:[], organizations:["Trader Joe's"] },
    { id: "d6",  title: "Apartment Wi-Fi router setup",          file_path: "~/Notes/wifi-setup.md",                                  mime_type: "text/markdown",    category: "Reference", subcategory: "Howto",      summary: "Steps to set up the router with 2.4/5 GHz split SSIDs and a guest network.", file_size: 12_000, ai_confidence: 0.81, document_date: "2024-08-02", indexed_at: "3 days ago", tags: ["wifi","networking"], people:[], organizations:[] },
    { id: "d7",  title: "Software dev contract — Acme",          file_path: "~/Work/contracts/acme-dev-msa.pdf",                      mime_type: "application/pdf", category: "Legal",     subcategory: "MSA",        summary: "Master service agreement signed Jul 2023 with Acme Corp.", file_size: 1_120_000, ai_confidence: 0.89, document_date: "2023-07-11", indexed_at: "4 days ago", tags: ["msa","acme"], people:[], organizations:["Acme Corp"] },
    { id: "d8",  title: "Q3 OKRs.xlsx",                          file_path: "~/Work/2024/Q3-OKRs.xlsx",                                mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "Project", subcategory: "Tracking", summary: "Q3 OKR tracker with 14 KRs across 4 objectives.", file_size: 86_000, ai_confidence: 0.72, document_date: "2024-07-05", indexed_at: "5 days ago", tags: ["okr","Q3"], people:[], organizations:[] },
    { id: "d9",  title: "Renters insurance policy",              file_path: "~/Documents/Insurance/renters-2024.pdf",                 mime_type: "application/pdf", category: "Insurance", subcategory: "Policy",     summary: "Renters insurance policy effective Jan 1, 2024 — Dec 31, 2024.", file_size: 720_000, ai_confidence: 0.91, document_date: "2024-01-01", indexed_at: "a week ago", tags: ["renters","2024"], people:[], organizations:["Lemonade"] },
    { id: "d10", title: "Tokyo trip itinerary",                  file_path: "~/Travel/2024-tokyo/itinerary.pdf",                       mime_type: "application/pdf", category: "Travel",    subcategory: "Itinerary",  summary: "10-day Tokyo trip Oct 12–22 with hotel and JR pass details.", file_size: 1_400_000, ai_confidence: 0.86, document_date: "2024-10-12", indexed_at: "a week ago", tags: ["tokyo","2024","japan"], people:[], organizations:["ANA","Park Hyatt"] },
  ];
  const insights = [
    { type: "expiring",  severity: "warning", message: "3 contracts expire in the next 30 days",     details: "Lease renewal · Insurance policy · SaaS subscription" },
    { type: "duplicate", severity: "info",    message: "7 likely duplicates found",                  details: "Same hash across multiple folders — review to free 412 MiB" },
    { type: "review",    severity: "danger",  message: "23 documents below 50% confidence",          details: "AI is unsure how to classify these — review and label" },
  ];
  const duplicates = [
    { file_hash: "b3a1c9f7e2d4", count: 3, documents: [
      { id: "d3", title: "Federal tax return 2023.pdf", file_path: "~/Documents/Tax/2023/1040-final.pdf", file_size: 4_900_000, document_date: "2024-04-15", source: "Documents" },
      { id: "d3a", title: "1040-final.pdf",                file_path: "~/Downloads/1040-final.pdf",          file_size: 4_900_000, document_date: "2024-04-15", source: "Downloads" },
      { id: "d3b", title: "1040.pdf",                      file_path: "~/Desktop/Tax/1040.pdf",              file_size: 4_900_000, document_date: "2024-04-15", source: "Desktop" },
    ]},
    { file_hash: "f10e8c4d2a91", count: 2, documents: [
      { id: "d10", title: "Tokyo itinerary.pdf",       file_path: "~/Travel/2024-tokyo/itinerary.pdf", file_size: 1_400_000, document_date: "2024-10-12", source: "Travel" },
      { id: "d10a", title: "Tokyo itinerary copy.pdf", file_path: "~/Downloads/Tokyo itinerary copy.pdf", file_size: 1_400_000, document_date: "2024-10-12", source: "Downloads" },
    ]},
  ];
  const watched = [
    { id: "w1", path: "~/Documents",        last_scan: "2 minutes ago",  file_count: 1284 },
    { id: "w2", path: "~/Downloads",        last_scan: "an hour ago",    file_count: 432  },
    { id: "w3", path: "~/Desktop/Archive",  last_scan: "yesterday",      file_count: 87   },
    { id: "w4", path: "~/Work",             last_scan: "3 days ago",     file_count: 44   },
  ];
  return { stats, cats, docs, insights, duplicates, watched };
})();
