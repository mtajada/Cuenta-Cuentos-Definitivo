// components/pdf/ContentPage.tsx
import React from 'react';
import {
  Page,
  View,
  Image,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

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
  textCard: {
    position: 'absolute',
    bottom: 40,
    left: '10%',
    width: '80%',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
  },
  paragraph: {
    fontFamily: 'Merriweather',
    fontSize: 14,
    lineHeight: 1.4,
    color: '#333333',
    marginBottom: 8,
  },
  highlight: {
    fontFamily: 'Nunito',
    fontWeight: 'bold' as const,
    fontSize: 16,
    color: '#000000',
    marginBottom: 8,
  },
});

interface ContentPageProps {
  imageUrl: string;
  paragraphs: string[];
}

export const ContentPage: React.FC<ContentPageProps> = ({
  imageUrl,
  paragraphs,
}) => (
  <Page size="A4" style={styles.page}>
    <Image style={styles.background} src={imageUrl} />
    <View style={styles.textCard}>
      {paragraphs.map((p, i) => {
        const isHighlight = /^¡/.test(p);
        return (
          <Text key={i} style={isHighlight ? styles.highlight : styles.paragraph}>
            {p}
          </Text>
        );
      })}
    </View>
  </Page>
);
