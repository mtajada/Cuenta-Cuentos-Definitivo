// components/pdf/Footer.tsx
import React from 'react';
import { Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

Font.register({
  family: 'Merriweather',
  fonts: [{ src: '/fonts/Merriweather-Regular.ttf' }],
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  pageNumber: {
    fontSize: 8,
    color: '#777777',
    textAlign: 'center' as const,
    flex: 1,
  },
  logoContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  logo: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  logoText: {
    fontSize: 8,
    color: '#777777',
  },
});

interface FooterProps {
  pageNumber: number;
  totalPages: number;
}

export const Footer: React.FC<FooterProps> = ({ pageNumber, totalPages }) => (
  <View style={styles.container}>
    <View style={styles.logoContainer}>
      <Image style={styles.logo} src="/logo_png.png" />
      <Text style={styles.logoText}>Taleme v1.0</Text>
    </View>
    <Text style={styles.pageNumber}>
      {pageNumber} / {totalPages}
    </Text>
  </View>
);
