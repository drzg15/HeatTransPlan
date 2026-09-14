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
      title: 'Navigating the Map & UI',
      text: '1. Data collection tab.\n2. Search bar to center map.\n3. Lock map button disables panning for marker placement.\n4. Help/tutorial button. It is located at many place to explain different items for more information',
      image: '/assets/tutorial/slide-1.svg',
    },
    {
      title: 'Adding a Process',
      text: '1. Click + Add Process to create a group.\n2. Click Place to position it.\n3. Place the process on the map',
      image: '/assets/tutorial/slide-2.svg',
    },
    {
      title: 'Subprocesses',
      text: '1. Click to show subprocesses of the process\n2. Click + Add to create new subprocesses inside the parent process.',
      image: '/assets/tutorial/slide-3.svg',
    },
    {
      title: 'Connections & Streams',
      text: '1. Use next processes to draw arrows between boxes.\n2. Use streams to input thermodynamics (temperatures, mass flow, heat capacity).',
      image: '/assets/tutorial/slide-4.svg',
    },
    {
      title: 'The Potential Analysis Dashboard',
      text: '1. Switch to Potential Analysis tab.\n2. Toggle hot/cold streams in Streams Selection.\n3. Configure current energy supply (if available)',
      image: '/assets/tutorial/slide-5.svg',
    },
    {
      title: 'Pinch Analysis Curves',
      text: '1. Comparison table shows energy savings (kW and %).\n2. Composite curves plot temp vs enthalpy.\n3. Grand composite curve visualizes remaining demands.',
      image: '/assets/tutorial/slide-6.svg',
    },
    {
      title: 'Heat Pump Optimization',
      text: '1. Heat pump model table lists refrigerants & COPs.\n2. Filters panel for refining results.\n3. Chart displays actual heat pump cycles layered on pinch curves.',
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
      <div className={styles.tutorialHeader}>Quick tutorial.</div>
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
        
        {currentStep === steps.length - 1 && onLoadExample && (
          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            <button
              className="btn"
              onClick={onLoadExample}
              disabled={loadingExample}
              style={{ width: '100%', padding: '16px', background: 'var(--primary-gradient)', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius)' }}
            >
              {loadingExample ? 'Loading...' : 'Now test it with an example'}
            </button>
          </div>
        )}
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
