import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function splitDocs(raw: string): string[] {
  return raw
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const tagDefs = [
    { slug: "farmer", label: "Farmers" },
    { slug: "women", label: "Women" },
    { slug: "student", label: "Students" },
    { slug: "senior_citizen", label: "Senior citizens" },
    { slug: "housing", label: "Housing" },
    { slug: "health", label: "Health" },
    { slug: "general", label: "General" },
  ];

  const tags = new Map<string, number>();
  for (const t of tagDefs) {
    const row = await prisma.tag.upsert({
      where: { slug: t.slug },
      create: t,
      update: { label: t.label },
    });
    tags.set(t.slug, row.id);
  }

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
      tagSlugs: ["farmer", "general"],
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
      tagSlugs: ["housing", "general"],
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
      tagSlugs: ["health", "general"],
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
      tagSlugs: ["women", "general"],
    },
  ];

  for (const s of schemes) {
    const { tagSlugs, ...core } = s;
    const scheme = await prisma.scheme.upsert({
      where: { slug: core.slug },
      create: core,
      update: {
        scheme_name: core.scheme_name,
        description: core.description,
        min_age: core.min_age,
        max_age: core.max_age,
        income_limit: core.income_limit,
        gender: core.gender,
        occupation: core.occupation,
        state: core.state,
        benefit: core.benefit,
        documents_required: core.documents_required,
        apply_link: core.apply_link,
      },
    });

    await prisma.schemeOnTag.deleteMany({ where: { schemeId: scheme.id } });
    for (const slug of tagSlugs) {
      const tid = tags.get(slug);
      if (tid)
        await prisma.schemeOnTag.create({
          data: { schemeId: scheme.id, tagId: tid },
        });
    }

    await prisma.schemeBenefit.deleteMany({ where: { schemeId: scheme.id } });
    await prisma.schemeBenefit.create({
      data: { schemeId: scheme.id, title: "Key benefit", body: scheme.benefit, sort: 0 },
    });

    await prisma.documentRequirement.deleteMany({ where: { schemeId: scheme.id } });
    const docs = splitDocs(scheme.documents_required);
    for (let i = 0; i < docs.length; i++) {
      await prisma.documentRequirement.create({
        data: { schemeId: scheme.id, name: docs[i], sort: i },
      });
    }

    await prisma.eligibilityRule.deleteMany({ where: { schemeId: scheme.id } });
    if (scheme.min_age != null) {
      await prisma.eligibilityRule.create({
        data: {
          schemeId: scheme.id,
          criterion: "age_gte",
          operator: "gte",
          value: String(scheme.min_age),
          weight: 15,
        },
      });
    }
    if (scheme.max_age != null) {
      await prisma.eligibilityRule.create({
        data: {
          schemeId: scheme.id,
          criterion: "age_lte",
          operator: "lte",
          value: String(scheme.max_age),
          weight: 15,
        },
      });
    }
    if (scheme.income_limit != null) {
      await prisma.eligibilityRule.create({
        data: {
          schemeId: scheme.id,
          criterion: "income_lte",
          operator: "lte",
          value: String(scheme.income_limit),
          weight: 25,
        },
      });
    }
    await prisma.eligibilityRule.createMany({
      data: [
        {
          schemeId: scheme.id,
          criterion: "gender_eq",
          operator: "eq",
          value: scheme.gender ?? "any",
          weight: 15,
        },
        {
          schemeId: scheme.id,
          criterion: "occupation_eq",
          operator: "eq",
          value: scheme.occupation ?? "any",
          weight: 20,
        },
        {
          schemeId: scheme.id,
          criterion: "state_eq",
          operator: "eq",
          value: scheme.state ?? "any",
          weight: 10,
        },
      ],
    });
    if (tagSlugs.length) {
      await prisma.eligibilityRule.create({
        data: {
          schemeId: scheme.id,
          criterion: "tag_any",
          operator: "in",
          value: JSON.stringify(tagSlugs),
          weight: 15,
        },
      });
    }
  }

  console.log(`Seeded ${schemes.length} schemes, tags, rules, benefits, documents.`);
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
