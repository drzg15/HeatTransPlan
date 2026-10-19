import { useTranslation } from 'react-i18next';

/** The explanation behind the custom COP formula's help button. */
export default function CopFormulaHelp() {
  const { t } = useTranslation();
  return (
    <>
      <p>
        {t('optimization.desc_opt_panel_c1')} <strong>{t('optimization.desc_opt_panel_c2')}</strong>
        {t('optimization.desc_opt_panel_c3')}
      </p>
      <p>{t('optimization.desc_opt_panel_c4')}</p>
      <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
        <li>
          <code>T_source</code>, <code>T_sink</code>
          {t('optimization.desc_opt_panel_c5')}
        </li>
        <li>
          <code>T_lift</code>
          {t('optimization.desc_opt_panel_c6')}
        </li>
        <li>
          <code>carnot</code>
          {t('optimization.desc_opt_panel_c7')}
        </li>
      </ul>
      <p>
        {t('optimization.desc_opt_panel_c8')} <code>0.5 * (T_sink + 273.15) / T_lift</code>
        {t('optimization.desc_opt_panel_c9')}
        <code>0.5 * carnot</code>
        {t('optimization.desc_opt_panel_c10')}
      </p>
      <p>
        {t('optimization.desc_opt_panel_c11')}
        <strong>{t('optimization.desc_opt_panel_c12')}</strong>
        {t('optimization.desc_opt_panel_c13')}{' '}
        <code>
          (0.5 * (T_sink + 273.15) / T_lift) if T_sink &lt;= 100 else (0.4 * (T_sink + 273.15) /
          T_lift)
        </code>
        {t('optimization.desc_opt_panel_c14')}
      </p>
      <p>
        {t('optimization.desc_opt_panel_c15')}
        <strong>{t('optimization.desc_opt_panel_c16')}</strong>
        {t('optimization.desc_opt_panel_c17')}
      </p>
    </>
  );
}
