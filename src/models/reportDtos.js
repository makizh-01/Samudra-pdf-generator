/**
 * DTO mappers — the only place that knows how DB rows map onto the
 * flat placeholder names inside the R-Series DOCX template.
 */
const fitBar = require('../utils/fitBar');
const dates = require('../utils/dates');

/** Normalize an array to an exact length, padding with a filler. */
function exact(arr, n, filler) {
  const out = (arr || []).slice(0, n);
  while (out.length < n) out.push(filler);
  return out;
}

function buildTemplateData({ candidate, scores, overlays, reportCode }) {
  const t = scores.traits || {};
  const fit = scores.fitScores || {};
  const ind = scores.industries || [];
  const iFit = scores.industryFit || {};
  const js = scores.jobfitSummary || {};
  const sz = scores.strengthZone || {};
  const vz = scores.variabilityZone || {};
  const ex = scores.executiveSummary || {};

  const sItems = exact(sz.items, 4, { title: '', text: '' });
  const vItems = exact(vz.items, 3, { title: '', text: '' });

  const data = {
    // header / candidate
    report_ref: scores.reportRef || '',
    report_date: dates.long(scores.assessmentDate),
    report_date_short: dates.short(scores.assessmentDate),
    candidate_name: candidate.name || '',
    education: candidate.education || '',
    job_applied: candidate.jobApplied || '',
    assessment_input: scores.assessmentInput || '',
    report_code: scores.reportCodeExt || reportCode,
    mobile: candidate.mobile || '',
    email: candidate.email || '',

    // traits
    t_s_score: t.S?.score ?? '', t_s_text: t.S?.text ?? '',
    t_a_score: t.A?.score ?? '', t_a_text: t.A?.text ?? '',
    t_m_score: t.M?.score ?? '', t_m_text: t.M?.text ?? '',
    t_u_score: t.U?.score ?? '', t_u_text: t.U?.text ?? '',
    t_d_score: t.D?.score ?? '', t_d_text: t.D?.text ?? '',
    t_r_score: t.R?.score ?? '', t_r_text: t.R?.text ?? '',
    t_ac_score: t.AC?.score ?? '', t_ac_text: t.AC?.text ?? '',

    // fit strip
    samudra_fit_score: `${fit.samudraFitScore ?? ''}%`,
    strongest_trait: fit.strongestTrait || '',
    strongest_trait_score: String(fit.strongestTraitScore ?? ''),
    focus_trait: fit.focusTrait || '',
    focus_trait_score: String(fit.focusTraitScore ?? ''),

    // jobfit evaluation
    jobfit_score: String(fit.jobfitScore ?? ''),
    jobfit_box_text: js.boxText || '',
    jobfit_summary_p1: js.p1 || '',
    jobfit_summary_p2: js.p2 || '',

    // industry mapping (docxtemplater loop)
    industries: ind.map((r) => ({
      name: r.name,
      fitPct: r.fitPct,
      fitBar: fitBar(r.fitPct),
      fitLevel: r.fitLevel,
    })),
    industry_fit_strong: iFit.strong || '',
    industry_fit_moderate: iFit.moderate || '',
    industry_fit_development: iFit.development || '',
    industry_fit_overall: iFit.overall || '',

    // zones
    strength_zone_summary: sz.summary || '',
    variability_zone_summary: vz.summary || '',

    // executive summary
    top_strength: ex.topStrength || '',
    key_variability: ex.keyVariability || '',
    best_industries: ex.bestIndustries || '',
    exec_summary_p1: ex.p1 || '',
    exec_summary_p2: ex.p2 || '',
    exec_summary_p3: ex.p3 || '',

    // overlays (loop)
    hasOverlays: overlays.length > 0,
    overlays: overlays.map((o) => ({ code: o.code, title: o.title, body: o.body })),
  };

  sItems.forEach((s, i) => { data[`s${i + 1}_title`] = s.title; data[`s${i + 1}_text`] = s.text; });
  vItems.forEach((v, i) => { data[`v${i + 1}_title`] = v.title; data[`v${i + 1}_text`] = v.text; });

  return data;
}

module.exports = { buildTemplateData };
