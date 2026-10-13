import { defineCheck } from '../helpers.js';

const REVIEW_WIDGETS = /(trustpilot|elfsight|birdeye|yotpo|reviews\.io|judge\.me|stamped\.io|trustindex|feefo|okendo|bazaarvoice|podium|grade\.us|embedsocial)/i;
const REVIEW_TEXT = /\b(testimonials?|customer reviews|client reviews|what (our|my) (clients|customers|patients) say|★★★★|5[- ]star|rated \d(\.\d)? (out of|\/) 5)\b/i;

export default defineCheck({
  id: 'reviews-testimonials',
  category: 'trust',
  title: 'Reviews and testimonials',
  impact: 'medium',
  effort: 'medium',

  run({ page }) {
    const ratingNode = page.jsonLd.nodes.find((n) => n.types.some((t) => t === 'AggregateRating' || t === 'Review'));
    const widget = page.scriptSrcs.find((src) => REVIEW_WIDGETS.test(src)) ?? page.links.find((l) => REVIEW_WIDGETS.test(l.host))?.href;
    const textMatch = REVIEW_TEXT.exec(page.mainText)?.[0];

    let score = 0;
    let summary = 'No reviews or testimonials detected on this page.';
    if (ratingNode) {
      const rating = ratingNode.types.includes('AggregateRating') ? ratingNode.data : ratingNode.data.reviewRating;
      score = 100;
      summary = `Review schema found${rating?.ratingValue ? ` (rating ${rating.ratingValue}${rating.reviewCount ? ` from ${rating.reviewCount} reviews` : ''})` : ''}.`;
    } else if (widget) {
      score = 70;
      summary = `A third-party review widget was detected (${widget}), but there is no Review/AggregateRating schema.`;
    } else if (textMatch) {
      score = 60;
      summary = `Testimonial content found ("${textMatch}"), but it isn't marked up with Review schema.`;
    }

    return {
      score,
      details: { summary, hasReviewSchema: Boolean(ratingNode), widget: widget ?? null },
      recommendation:
        score === 100
          ? ''
          : score
            ? 'Mark up genuine first-party reviews with Review / AggregateRating schema (nested in your LocalBusiness or Product) so AI engines can read the rating.'
            : 'Show real customer testimonials or reviews (with names and context) and mark them up with Review schema. Social proof is a strong trust signal for local and commercial queries.',
    };
  },
});
