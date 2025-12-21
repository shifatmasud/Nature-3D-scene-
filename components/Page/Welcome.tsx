/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import ThemeToggleButton from '../Core/ThemeToggleButton.tsx';
import ProceduralBush from '../Package/ProceduralBush.tsx';
import { motion } from 'framer-motion';

const Welcome = () => {
  const { theme } = useTheme();

  const { tag: _h1, ...headingTypographyStyles } = theme.Type.Expressive.Display.M;
  const { tag: _p, ...subheadingTypographyStyles } = theme.Type.Readable.Body.L;

  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end', // Push text to bottom
      height: '100%',
      width: '100%',
      padding: theme.spacing['Space.XXL'],
      overflow: 'hidden',
      backgroundColor: theme.Color.Base.Surface[1],
      color: theme.Color.Base.Content[1],
    },
    overlay: {
      position: 'relative', // Stack on top of 3D
      zIndex: 10,
      textAlign: 'center',
      pointerEvents: 'none', // Let clicks pass through to 3D
      marginBottom: theme.spacing['Space.XL'],
    },
    heading: {
      ...headingTypographyStyles,
      color: theme.Color.Base.Content[1],
      margin: `0 0 ${theme.spacing['Space.S']} 0`,
      textShadow: `0 2px 10px ${theme.Color.Base.Surface[1]}`, // Readability
    },
    subheading: {
      ...subheadingTypographyStyles,
      color: theme.Color.Base.Content[2],
      margin: 0,
      maxWidth: '600px',
      textShadow: `0 1px 5px ${theme.Color.Base.Surface[1]}`,
    },
    controls: {
      pointerEvents: 'auto', // Re-enable clicks for buttons
    }
  };

  return (
    <div style={styles.container}>
      {/* 3D Scene Layer */}
      <ProceduralBush />

      {/* UI Overlay Layer */}
      <ThemeToggleButton />
      
      <motion.div 
        style={styles.overlay}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
      >
        <h1 style={styles.heading}>Procedural Nature</h1>
        <p style={styles.subheading}>
          A 200 instance procedural bush. 
          Features 3-stage LOD (High → Med → Low), vertex color tinting, and optimized Gouraud lighting.
          <br/><br/>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>DRAG TO ROTATE • SCROLL TO ZOOM OUT FOR LOD</span>
        </p>
      </motion.div>
    </div>
  );
};

export default Welcome;