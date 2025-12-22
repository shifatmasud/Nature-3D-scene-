

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../Theme.tsx';
import type { PerformanceSettings } from '../Page/Welcome.tsx';

interface PerformanceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PerformanceSettings;
  setSettings: React.Dispatch<React.SetStateAction<PerformanceSettings>>;
}

const PerformanceSettingsPanel: React.FC<PerformanceSettingsPanelProps> = ({ isOpen, onClose, settings, setSettings }) => {
  const { theme } = useTheme();

  const styles: { [key: string]: React.CSSProperties } = {
    backdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 90,
    },
    panel: {
      position: 'fixed',
      top: `calc(${theme.spacing['Space.L']} + 44px + ${theme.spacing['Space.M']})`,
      right: theme.spacing['Space.L'],
      width: '280px',
      padding: theme.spacing['Space.L'],
      backgroundColor: theme.Color.Base.Surface['2'],
      borderRadius: theme.radius['Radius.L'],
      boxShadow: theme.effects['Effect.Shadow.Drop.3'],
      border: `1px solid ${theme.Color.Base.Surface['3']}`,
      color: theme.Color.Base.Content['1'],
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing['Space.M'],
    },
    title: {
      ...theme.Type.Readable.Title.S,
      margin: 0,
      color: theme.Color.Base.Content['1'],
    },
    settingRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      ...theme.Type.Readable.Body.M,
      color: theme.Color.Base.Content['2'],
    },
    buttonGroup: {
      display: 'flex',
      gap: theme.spacing['Space.XS'],
    },
    button: {
      ...theme.Type.Readable.Label.M,
      padding: `${theme.spacing['Space.XS']} ${theme.spacing['Space.S']}`,
      border: `1px solid ${theme.Color.Base.Surface['3']}`,
      borderRadius: theme.radius['Radius.M'],
      cursor: 'pointer',
      transition: `background-color ${theme.time['Time.2x']}, color ${theme.time['Time.2x']}`,
      backgroundColor: 'transparent',
      color: theme.Color.Base.Content['2'],
    },
    activeButton: {
      backgroundColor: theme.Color.Accent.Surface['1'],
      color: theme.Color.Accent.Content['1'],
      borderColor: theme.Color.Accent.Surface['1'],
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants = {
    hidden: { opacity: 0, y: -20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            style={styles.backdrop}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />
          <motion.div
            style={styles.panel}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <h3 style={styles.title}>Performance Settings</h3>
            
            <div style={styles.settingRow}>
                <span style={styles.label}>Resolution</span>
                <div style={styles.buttonGroup}>
                    {(['ultra', 'performance', 'balanced', 'high'] as const).map(res => (
                        <button 
                            key={res}
                            style={{...styles.button, ...(settings.resolution === res ? styles.activeButton : {})}}
                            onClick={() => setSettings(s => ({...s, resolution: res}))}
                        >
                            {res.charAt(0).toUpperCase() + res.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div style={styles.settingRow}>
                <span style={styles.label}>Shadows</span>
                <div style={styles.buttonGroup}>
                     <button 
                        style={{...styles.button, ...(!settings.shadows ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, shadows: false}))}
                    >Off</button>
                    <button 
                        style={{...styles.button, ...(settings.shadows ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, shadows: true}))}
                    >On</button>
                </div>
            </div>

             <div style={styles.settingRow}>
                <span style={styles.label}>Fireflies</span>
                <div style={styles.buttonGroup}>
                     <button 
                        style={{...styles.button, ...(!settings.effects ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, effects: false}))}
                    >Off</button>
                    <button 
                        style={{...styles.button, ...(settings.effects ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, effects: true}))}
                    >On</button>
                </div>
            </div>

            <div style={styles.settingRow}>
                <span style={styles.label}>Anti-aliasing</span>
                <div style={styles.buttonGroup}>
                     <button 
                        style={{...styles.button, ...(!settings.antiAliasing ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, antiAliasing: false}))}
                    >Off</button>
                    <button 
                        style={{...styles.button, ...(settings.antiAliasing ? styles.activeButton : {})}}
                        onClick={() => setSettings(s => ({...s, antiAliasing: true}))}
                    >On</button>
                </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PerformanceSettingsPanel;