// components/pdf/Book.tsx
import React from 'react';
import { Document } from '@react-pdf/renderer';
import { Cover } from './Cover';
import { ContentPage } from './ContentPage';
import { Footer } from './Footer';

interface BookProps {
  title: string;
  subtitle?: string;
  author?: string;
  content: string;
  images: {
    cover: string;
    scenes: string[];
  };
}

export const Book: React.FC<BookProps> = ({
  title,
  subtitle,
  author,
  content,
  images,
}) => {
  const paragraphs = content.split('\n\n');
  const half = Math.ceil(paragraphs.length / images.scenes.length);
  const pages = paragraphs.reduce<string[][]>((acc, para, idx) => {
    const pageIndex = Math.floor(idx / half);
    acc[pageIndex] = acc[pageIndex] || [];
    acc[pageIndex].push(para);
    return acc;
  }, []);

  const totalPages = 1 + pages.length + 1; // portada + contenido + contraportada

  return (
    <Document>
      <Cover
        title={title}
        subtitle={subtitle || (author ? `por ${author}` : undefined)}
        imageUrl={images.cover}
      />

      {pages.map((paras, i) => (
        <React.Fragment key={i}>
          <ContentPage imageUrl={images.scenes[i]} paragraphs={paras} />
          <Footer pageNumber={i + 2} totalPages={totalPages} />
        </React.Fragment>
      ))}

      {/* Back cover as a final page */}
      <Cover
        title={`Generado por Taleme!`}
        subtitle={new Date().getFullYear().toString()}
        imageUrl={images.cover /* o un fondo estático */}
      />
    </Document>
  );
};
