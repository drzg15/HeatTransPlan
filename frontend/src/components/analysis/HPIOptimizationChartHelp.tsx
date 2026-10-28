/** The long explanation behind the optimization chart's help button. */

import { useTranslation } from 'react-i18next';

export default function HPIOptimizationChartHelp() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t('optimization.desc_opt_chart_p1')}</p>
      <p>{t('optimization.desc_opt_chart_p2')}</p>
      <p>{t('optimization.desc_opt_chart_p3')}</p>
      <hr style={{ margin: '8px 0', borderColor: 'var(--border)' }} />
      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t('optimization.desc_opt_chart_how')}</p>
      <p style={{ fontSize: '0.8rem' }}>
        {t('optimization.desc_opt_chart_blue_1')}
        <b>{t('optimization.desc_opt_chart_blue_2')}</b>
        {t('optimization.desc_opt_chart_blue_3')}
        <br />
        <br />
        {t('optimization.desc_opt_chart_red_1')}
        <b>{t('optimization.desc_opt_chart_red_2')}</b>
        {t('optimization.desc_opt_chart_red_3')}
        <br />
        <br />
        {t('optimization.desc_opt_chart_aims_1')}
        <b>{t('optimization.desc_opt_chart_aims_2')}</b>
        {t('optimization.desc_opt_chart_aims_3')}
      </p>
      <hr style={{ margin: '8px 0', borderColor: 'var(--border)' }} />
      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t('optimization.desc_opt_chart_why')}</p>
      <p style={{ fontSize: '0.8rem' }}>
        {t('optimization.desc_opt_chart_off_1')}
        <b>{t('optimization.desc_opt_chart_off_2')}</b>
        {t('optimization.desc_opt_chart_off_3')}
        <i>{t('optimization.desc_opt_chart_off_4')}</i>
        {t('optimization.desc_opt_chart_off_5')}
        <br />
        <br />
        {t('optimization.desc_opt_chart_rest')}
      </p>
    </>
  );
}
