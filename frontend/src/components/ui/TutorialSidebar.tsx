import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TutorialSidebar.module.css';

export default function TutorialSidebar() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: t('tutorial.step0_title'),
      text: t('tutorial.step0_text'),
    },
    {
      title: t('tutorial.step1_title'),
      text: t('tutorial.step1_text'),
      image: '/tutorial_step1.png?v=3',
    },
    {
      title: t('tutorial.step2_title'),
      text: t('tutorial.step2_text'),
      image: '/tutorial_step2.png?v=3',
    },
    {
      title: t('tutorial.step3_title'),
      text: t('tutorial.step3_text'),
      image: '/tutorial_step3.png?v=3',
    },
    {
      title: t('tutorial.step4_title'),
      text: t('tutorial.step4_text'),
      image: '/tutorial_step4.png?v=4',
    },
    {
      title: t('tutorial.step5_title'),
      text: t('tutorial.step5_text'),
      image: '/tutorial_step5.png?v=4',
    },
    {
      title: t('tutorial.step6_title'),
      text: t('tutorial.step6_text'),
      image: '/tutorial_step6.png?v=4',
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
      <div className={styles.tutorialHeader}>{t('tutorial.header')}</div>
      <div className={styles.tutorialContent}>
        {steps[currentStep].image && (
          <img 
            src={steps[currentStep].image} 
            alt={steps[currentStep].title} 
            className={styles.slideImage}
          />
        )}
        <div className={styles.slideTitle}>{steps[currentStep].title}</div>
        <div className={styles.slideText}>{steps[currentStep].text}</div>
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
