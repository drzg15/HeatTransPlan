/** The "?" in the header, beside the theme switch: tours the open page's own steps. */

import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageSteps, startTour } from '../../tour/guidedTour';

export default function PageTourButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { from, to } = pageSteps(useLocation().pathname);
  if (from < 0) return null;
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => startTour(navigate, t, from, to)}
      data-tip={t('tour.page_help')}
      aria-label={t('tour.page_help')}
    >
      <CircleHelp size={16} />
    </button>
  );
}
