import React from 'react';
import { useTranslation } from 'react-i18next';
import './AnalysisHelp.css'; // Reusing the same styling

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CollectionHelp: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="analysis-help-panel">
      <div className="help-header">
        <h3>🔍 Collection Guide</h3>
        <button className="help-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="help-scroll">
        <section className="help-section">
          <h4>🗺️ Map & UI</h4>
          <p>
            Use the Search bar to center the map. The <strong>Lock map</strong> button disables panning so you can safely place markers without dragging the map.
          </p>
        </section>

        <section className="help-section">
          <h4>🏭 Adding a Process</h4>
          <p>
            Click <strong>+ Add Process</strong> to create a new industrial plant group. Then click <strong>Place</strong> and click anywhere on the map to position it.
          </p>
        </section>

        <section className="help-section">
          <h4>⚙️ Subprocesses</h4>
          <p>
            Expand a process to view its internals. Click <strong>+ Add</strong> to create new subprocesses inside the parent process.
          </p>
        </section>

        <section className="help-section">
          <h4>🔗 Connections & Streams</h4>
          <p>
            Use <em>next processes</em> to draw directional arrows between boxes on the map. Use the <em>streams</em> table to input thermodynamic data (temperatures, mass flow, heat capacity) for pinch analysis.
          </p>
        </section>

        <div className="help-footer">
          <p>
            ✨ <em>Once your data is collected, switch to the <strong>Potential Analysis</strong> tab to optimize your energy recovery.</em>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollectionHelp;
