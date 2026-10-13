/**
 * Field rules for the schema.org types that matter most for AI answers.
 * `required` follows Google's structured-data requirements where they exist;
 * `recommended` are fields that help models understand and attribute content.
 */

const ARTICLE = { required: ['headline', 'author', 'datePublished'], recommended: ['dateModified', 'image', 'publisher', 'mainEntityOfPage', 'description'] };

export const SCHEMA_RULES = {
  Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs', 'description', 'contactPoint'] },
  LocalBusiness: { required: ['name', 'address'], recommended: ['telephone', 'url', 'openingHoursSpecification', 'geo', 'image', 'priceRange', 'sameAs'] },
  FAQPage: { required: ['mainEntity'], recommended: [] },
  HowTo: { required: ['name', 'step'], recommended: ['description', 'totalTime', 'supply', 'tool', 'image'] },
  Article: ARTICLE,
  BlogPosting: ARTICLE,
  NewsArticle: ARTICLE,
  Product: { required: ['name'], recommended: ['image', 'description', 'offers', 'aggregateRating', 'review', 'brand', 'sku'] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  Person: { required: ['name'], recommended: ['url', 'sameAs', 'jobTitle', 'image', 'description'] },
};

const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'Dentist', 'Physician', 'MedicalClinic', 'MedicalBusiness', 'Optician', 'Pharmacy', 'Hospital', 'VeterinaryCare',
  'Restaurant', 'FoodEstablishment', 'CafeOrCoffeeShop', 'Bakery', 'BarOrPub', 'FastFoodRestaurant',
  'Store', 'ClothingStore', 'ElectronicsStore', 'FurnitureStore', 'GroceryStore', 'HardwareStore', 'JewelryStore', 'AutoDealer',
  'LegalService', 'Attorney', 'Notary', 'AccountingService', 'FinancialService', 'InsuranceAgency', 'RealEstateAgent',
  'HomeAndConstructionBusiness', 'Plumber', 'Electrician', 'HVACBusiness', 'RoofingContractor', 'GeneralContractor', 'HousePainter', 'Locksmith', 'MovingCompany',
  'AutomotiveBusiness', 'AutoRepair', 'AutoBodyShop', 'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'DaySpa', 'NailSalon',
  'ExerciseGym', 'SportsActivityLocation', 'LodgingBusiness', 'Hotel', 'ProfessionalService', 'TravelAgency', 'ChildCare', 'DryCleaningOrLaundry',
  'EntertainmentBusiness', 'EmploymentAgency', 'SelfStorage', 'ShoppingCenter', 'TouristInformationCenter',
]);

const ORGANIZATION_TYPES = new Set([
  'Organization', 'Corporation', 'OnlineBusiness', 'OnlineStore', 'NGO', 'EducationalOrganization', 'CollegeOrUniversity', 'School',
  'MedicalOrganization', 'NewsMediaOrganization', 'GovernmentOrganization', 'SportsOrganization', 'Airline', 'Consortium', 'Project',
]);

/** Map a concrete type (e.g. "Dentist") to the rule key that validates it ("LocalBusiness"). */
export function ruleKeyFor(type) {
  if (SCHEMA_RULES[type]) return type;
  if (LOCAL_BUSINESS_TYPES.has(type)) return 'LocalBusiness';
  if (ORGANIZATION_TYPES.has(type)) return 'Organization';
  return null;
}

const hasValue = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value));

/** Extra type-specific validation beyond field presence. */
function customIssues(ruleKey, data) {
  const issues = [];
  if (ruleKey === 'FAQPage') {
    const questions = [data.mainEntity].flat().filter(Boolean);
    const incomplete = questions.filter((q) => !hasValue(q?.name) || !hasValue(q?.acceptedAnswer?.text ?? q?.acceptedAnswer));
    if (incomplete.length) issues.push(`${incomplete.length} FAQ question(s) are missing a name or acceptedAnswer.text`);
  }
  if (ruleKey === 'BreadcrumbList') {
    const items = [data.itemListElement].flat().filter(Boolean);
    const bad = items.filter((item) => item?.position == null || !hasValue(item?.name ?? item?.item?.name));
    if (bad.length) issues.push(`${bad.length} breadcrumb item(s) are missing position or name`);
  }
  if (ruleKey === 'Product' && !hasValue(data.offers) && !hasValue(data.review) && !hasValue(data.aggregateRating)) {
    issues.push('Product needs at least one of offers, review or aggregateRating');
  }
  if (['Article', 'BlogPosting', 'NewsArticle'].includes(ruleKey)) {
    for (const field of ['datePublished', 'dateModified']) {
      if (hasValue(data[field]) && !isIsoDate(data[field])) issues.push(`${field} is not an ISO 8601 date`);
    }
  }
  return issues;
}

/** Validate one JSON-LD node. Score: 70% required fields, 30% recommended, minus custom issues. */
export function validateNode(node) {
  const type = node.types.find(ruleKeyFor) ?? node.types[0];
  const ruleKey = ruleKeyFor(type);
  if (!ruleKey) return null;

  const rule = SCHEMA_RULES[ruleKey];
  const missingRequired = rule.required.filter((f) => !hasValue(node.data[f]));
  const missingRecommended = rule.recommended.filter((f) => !hasValue(node.data[f]));
  const issues = customIssues(ruleKey, node.data);

  const requiredScore = rule.required.length ? (rule.required.length - missingRequired.length) / rule.required.length : 1;
  const recommendedScore = rule.recommended.length ? (rule.recommended.length - missingRecommended.length) / rule.recommended.length : 1;
  const score = Math.max(0, Math.round(requiredScore * 70 + recommendedScore * 30 - issues.length * 15));

  return { type, ruleKey, nested: node.nested, missingRequired, missingRecommended, issues, score };
}

export { hasValue, isIsoDate };
