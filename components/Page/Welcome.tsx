/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import ThemeToggleButton from '../Core/ThemeToggleButton.tsx';
import Scene from '../Package/Scene.tsx';

const Welcome = () => {
  const { theme } = useTheme();

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
  };

  return (
    <div style={styles.container}>
      {/* 3D Scene Layer */}
      <Scene />

      {/* UI Overlay Layer */}
      <ThemeToggleButton />
    </div>
  );
};

export default Welcome;