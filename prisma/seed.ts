import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const schemes = [
    {
      scheme_name: "PM Kisan Samman Nidhi",
      slug: "pm-kisan-samman-nidhi",
      description:
        "Direct income support of ₹6,000 per year in three equal instalments to eligible farmer families.",
      min_age: 18,
      max_age: null as number | null,
      income_limit: null as number | null,
      gender: "any",
      occupation: "farmer",
      state: "any",
      benefit: "₹6,000 per year in three instalments credited to bank account.",
      documents_required:
        "Aadhaar; land ownership / cultivation records; bank account details; PM-KISAN registration (as applicable).",
      apply_link: "https://pmkisan.gov.in/",
    },
    {
      scheme_name: "PM Awas Yojana (PMAY)",
      slug: "pm-awas-yojana",
      description:
        "Credit-linked subsidy and assistance for construction or enhancement of a pucca house for eligible households.",
      min_age: 18,
      max_age: 59,
      income_limit: 1800000,
      gender: "any",
      occupation: "any",
      state: "any",
      benefit:
        "Interest subsidy on home loan (CLSS) and/or assistance for house construction based on eligibility category.",
      documents_required:
        "Aadhaar; income proof; address proof; property documents / allotment letter; bank statements as per lender norms.",
      apply_link: "https://pmaymis.gov.in/",
    },
    {
      scheme_name: "Ayushman Bharat (PM-JAY)",
      slug: "ayushman-bharat-pm-jay",
      description:
        "Health coverage up to ₹5 lakh per family per year for secondary and tertiary care hospitalisation.",
      min_age: null as number | null,
      max_age: null as number | null,
      income_limit: 500000,
      gender: "any",
      occupation: "any",
      state: "any",
      benefit: "Cashless treatment up to ₹5 lakh per family per year at empanelled hospitals.",
      documents_required:
        "Ayushman card / e-card; Aadhaar; ration card or SECC-based eligibility proof as per state guidelines.",
      apply_link: "https://pmjay.gov.in/",
    },
    {
      scheme_name: "PM Ujjwala Yojana",
      slug: "pm-ujjwala-yojana",
      description:
        "LPG connection with financial assistance to women from poor households to use clean cooking fuel.",
      min_age: 18,
      max_age: null as number | null,
      income_limit: null as number | null,
      gender: "female",
      occupation: "any",
      state: "any",
      benefit: "LPG connection with subsidy support; refill subsidies as per current government norms.",
      documents_required:
        "Aadhaar; BPL / ration card or other prescribed poverty-line proof; bank account (where applicable).",
      apply_link: "https://www.pmuy.gov.in/",
    },
  ];

  for (const s of schemes) {
    await prisma.scheme.upsert({
      where: { slug: s.slug },
      create: s,
      update: {
        scheme_name: s.scheme_name,
        description: s.description,
        min_age: s.min_age,
        max_age: s.max_age,
        income_limit: s.income_limit,
        gender: s.gender,
        occupation: s.occupation,
        state: s.state,
        benefit: s.benefit,
        documents_required: s.documents_required,
        apply_link: s.apply_link,
      },
    });
  }

  console.log(`Seeded ${schemes.length} schemes.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
