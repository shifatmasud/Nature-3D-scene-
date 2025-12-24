

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: Corrected import statement for React and useState.
import React, { useState } from 'react';
import { useTheme } from '../../Theme.tsx';
import ThemeToggleButton from '../Core/ThemeToggleButton.tsx';
import Scene from '../Package/Scene.tsx';
import PerformanceSettingsPanel from '../Package/PerformanceSettings.tsx';
import { motion } from 'framer-motion';
import { useBreakpoint } from '../../hooks/useBreakpoint.tsx';

export type PerformanceSettings = {
  resolution: 'high' | 'balanced' | 'performance' | 'ultra';
  shadows: boolean;
  effects: boolean;
  antiAliasing: boolean;
  waterReflection: boolean;
};

const Welcome = () => {
  const { theme } = useTheme();
  const breakpoint = useBreakpoint();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>({
    resolution: 'ultra',
    shadows: false,
    effects: true, // Fireflies enabled by default
    antiAliasing: false,
    waterReflection: false,
  });

  const getSettingsButtonRight = () => {
    const baseOffset = `calc(${theme.spacing['Space.L']} + 44px`;
    switch (breakpoint) {
      case 'mobile':
        return `${baseOffset} + ${theme.spacing['Space.XS']})`;
      case 'tablet':
      case 'desktop':
      default:
        return `${baseOffset} + ${theme.spacing['Space.S']})`;
    }
  };

  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end', 
      height: '100%',
      width: '100%',
      padding: theme.spacing['Space.XXL'],
      overflow: 'hidden',
      backgroundColor: theme.Color.Base.Surface[1],
    },
    settingsButton: {
        position: 'absolute',
        top: theme.spacing['Space.L'],
        right: getSettingsButtonRight(),
        width: '44px',
        height: '44px',
        borderRadius: theme.radius['Radius.Full'],
        backgroundColor: theme.Color.Base.Surface['2'],
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.Color.Base.Content['2'],
        boxShadow: theme.effects['Effect.Shadow.Drop.1'],
        overflow: 'hidden',
        zIndex: 5,
    },
     icon: {
      fontSize: '24px',
      lineHeight: 0,
    }
  };

  return (
    <div style={styles.container}>
      <Scene performanceSettings={performanceSettings} />
      
      <motion.button
        style={styles.settingsButton}
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        aria-label="Open performance settings"
        whileHover={{ scale: 1.1, boxShadow: theme.effects['Effect.Shadow.Drop.2'] }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <i className="ph ph-gear" style={styles.icon} />
      </motion.button>
      
      <ThemeToggleButton />

      <PerformanceSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={performanceSettings}
        setSettings={setPerformanceSettings}
      />
    </div>
  );
};

export default Welcome;