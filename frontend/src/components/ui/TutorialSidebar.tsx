import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TutorialSidebar.module.css';

export default function TutorialSidebar() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Navigating the Map & UI',
      text: '1. Data Collection tab.\n2. Search Bar to center map.\n3. Lock Map button disables panning for marker placement.\n4. Help/Tutorial button.',
      image: '/assets/tutorial/slide-1.png',
    },
    {
      title: 'Adding a Process',
      text: '1. Click + Add Process to create a group.\n2. Click Place to position it.\n3. The Process 1 marker appears on the map.',
      image: '/assets/tutorial/slide-2.png',
    },
    {
      title: 'Subprocesses',
      text: '1. Click Show on Map to zoom into subprocesses.\n2. Click + Add to create new subprocesses inside the parent process.',
      image: '/assets/tutorial/slide-3.png',
    },
    {
      title: 'Connections & Streams',
      text: '1. Use Next Processes to draw arrows between boxes.\n2. Use Streams to input thermodynamics (Temperatures, Mass flow, Heat capacity).',
      image: '/assets/tutorial/slide-4.png',
    },
    {
      title: 'The Potential Analysis Dashboard',
      text: '1. Switch to Potential Analysis tab.\n2. Toggle hot/cold streams in Streams Selection.\n3. Configure Current Energy Supply.',
      image: '/assets/tutorial/slide-5.png',
    },
    {
      title: 'Pinch Analysis Curves',
      text: '1. Comparison table shows energy savings (kW and %).\n2. Composite Curves plot Temp vs Enthalpy.\n3. Grand Composite Curve visualizes remaining demands.',
      image: '/assets/tutorial/slide-6.png',
    },
    {
      title: 'Heat Pump Optimization',
      text: '1. Heat Pump Model table lists refrigerants & COPs.\n2. Filters panel for refining results.\n3. Chart displays actual heat pump cycles layered on pinch curves.',
      image: '/assets/tutorial/slide-7.png',
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
