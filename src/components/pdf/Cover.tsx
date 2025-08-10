// components/pdf/Cover.tsx
import React from 'react';
import {
  Page,
  View,
  Image,
  Text,
  StyleSheet,
  Font,
  PDFViewerProps,
} from '@react-pdf/renderer';

Font.register({
  family: 'Nunito',
  fonts: [
    { src: '/fonts/Nunito-Regular.ttf' },
    { src: '/fonts/Nunito-Bold.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: '35%',
    left: '10%',
    width: '80%',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 8,
    textAlign: 'center' as const,
  },
  title: {
    fontFamily: 'Nunito',
    fontWeight: 'bold' as const,
    fontSize: 36,
    color: '#BB79D1',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Nunito',
    fontSize: 18,
    color: '#2c3e50',
  },
});

interface CoverProps {
  title: string;
  subtitle?: string;
  imageUrl: string;
}

export const Cover: React.FC<CoverProps> = ({ title, subtitle, imageUrl }) => (
  <Page size="A4" style={styles.page}>
    <Image style={styles.background} src={imageUrl} />
    <View style={styles.overlay}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  </Page>
);
