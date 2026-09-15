import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TutorialSidebar.module.css';

interface TutorialSidebarProps {
  onLoadExample?: () => void;
  loadingExample?: boolean;
}

export default function TutorialSidebar({ onLoadExample, loadingExample }: TutorialSidebarProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: t('tutorial.slide1_title'),
      text: t('tutorial.slide1_text'),
      image: '/assets/tutorial/slide-1.svg',
    },
    {
      title: t('tutorial.slide2_title'),
      text: t('tutorial.slide2_text'),
      image: '/assets/tutorial/slide-2.svg',
    },
    {
      title: t('tutorial.slide3_title'),
      text: t('tutorial.slide3_text'),
      image: '/assets/tutorial/slide-3.svg',
    },
    {
      title: t('tutorial.slide4_title'),
      text: t('tutorial.slide4_text'),
      image: '/assets/tutorial/slide-4.svg',
    },
    {
      title: t('tutorial.slide5_title'),
      text: t('tutorial.slide5_text'),
      image: '/assets/tutorial/slide-5.svg',
    },
    {
      title: t('tutorial.slide6_title'),
      text: t('tutorial.slide6_text'),
      image: '/assets/tutorial/slide-6.svg',
    },
    {
      title: t('tutorial.slide7_title'),
      text: t('tutorial.slide7_text'),
      image: '/assets/tutorial/slide-7.svg',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className={styles.tutorialContainer}>
      <div className={styles.tutorialHeader}>{t('tutorial.quick_title')}</div>
      <div className={styles.tutorialContent}>
        {steps[currentStep].image && (
          <img 
            src={steps[currentStep].image} 
            alt={steps[currentStep].title} 
            className={styles.slideImage}
          />
        )}
        <div className={styles.slideTitle}>{steps[currentStep].title}</div>
        <div className={styles.slideText}>
          <div dangerouslySetInnerHTML={{ __html: steps[currentStep].text }} />
          {currentStep === steps.length - 1 && onLoadExample && (
            <div style={{ marginTop: '16px' }}>
              <span
                onClick={!loadingExample ? onLoadExample : undefined}
                style={{ cursor: loadingExample ? 'wait' : 'pointer', color: 'var(--brand-magenta)', textDecoration: 'underline', fontWeight: 600 }}
              >
                {loadingExample ? t('tutorial.loading_example') : t('tutorial.test_example')}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.tutorialFooter}>
        <button
          className={styles.navBtn}
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          {t('tutorial.back')}
        </button>
        <div className={styles.stepDots}>
          {steps.map((_, index) => (
            <div
              key={index}
              className={`${styles.dot} ${
                index === currentStep ? styles.active : ''
              }`}
            />
          ))}
        </div>
        <button
          className={styles.navBtn}
          onClick={handleNext}
          disabled={currentStep === steps.length - 1}
        >
          {t('tutorial.next')}
        </button>
      </div>
    </div>
  );
}
