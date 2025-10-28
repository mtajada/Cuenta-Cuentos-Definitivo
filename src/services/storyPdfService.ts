import { supabase } from '../supabaseClient';
import { IMAGES_TYPE } from '../constants/story-images.constant';
import { PdfService } from './pdfService';
import { ImageGenerationService } from './ai/imageGenerationService';
import jsPDF from 'jspdf';
import { APP_CONFIG } from '../config/app';

interface ImageValidationResult {
  cover: boolean;
  scene_1: boolean;
  scene_2: boolean;
  allValid: boolean;
  missingImages: string[];
  imageUrls?: {
    cover?: string;
    scene_1?: string;
    scene_2?: string;
  };
}

interface StoryPdfGenerationOptions {
  title: string;
  author?: string;
  content: string;
  storyId: string;
  chapterId: string;
}

interface IllustratedPdfGenerationOptions extends StoryPdfGenerationOptions {
  imageUrls: {
    cover: string;
    scene_1: string;
    scene_2: string;
  };
}

/**
 * Interface for progress tracking during image generation
 */
export interface ImageGenerationProgress {
  currentStep: string;
  currentImageType?: string;
  completedImages: number;
  totalImages: number;
  progress: number; // 0-100
}

/**
 * Interface for complete illustrated PDF generation with automatic image generation
 */
interface CompleteIllustratedPdfOptions extends StoryPdfGenerationOptions {
  onProgress?: (progress: ImageGenerationProgress) => void;
}

/**
 * Service for handling story PDF generation with image validation and illustrated PDF creation
 */
export class StoryPdfService {
  private static readonly REQUIRED_IMAGES = [IMAGES_TYPE.COVER, IMAGES_TYPE.SCENE_1, IMAGES_TYPE.SCENE_2];
  private static readonly IMAGE_BUCKET = 'images-stories';



  /**
   * Validates that all required images exist in Supabase storage for illustrated PDF generation
   * @param storyId Story identifier
   * @param chapterId Chapter identifier
   * @returns Promise with validation results and image URLs if available
   */
  static async validateRequiredImages(storyId: string, chapterId: string): Promise<ImageValidationResult> {
    const validationResult: ImageValidationResult = {
      cover: false,
      scene_1: false,
      scene_2: false,
      allValid: false,
      missingImages: [],
      imageUrls: {}
    };

    try {
      console.log('[StoryPdfService] Validating images for story:', storyId, 'chapter:', chapterId);

      for (const imageType of this.REQUIRED_IMAGES) {
        const imagePath = `${storyId}/${chapterId}/${imageType}.jpeg`;
        
        // Get public URL from Supabase storage
        const { data } = supabase.storage
          .from(this.IMAGE_BUCKET)
          .getPublicUrl(imagePath);

        if (data?.publicUrl) {
          // Validate image accessibility with HTTP HEAD request
          try {
            const response = await fetch(data.publicUrl, { method: 'HEAD' });
            if (response.ok) {
              validationResult[imageType as keyof Omit<ImageValidationResult, 'allValid' | 'missingImages' | 'imageUrls'>] = true;
              validationResult.imageUrls![imageType as keyof NonNullable<ImageValidationResult['imageUrls']>] = data.publicUrl;
              console.log(`[StoryPdfService] ✅ Found ${imageType}: ${data.publicUrl}`);
            } else {
              console.log(`[StoryPdfService] ❌ Image ${imageType} not accessible:`, response.status);
              validationResult.missingImages.push(this.getImageDisplayName(imageType));
            }
          } catch (fetchError) {
            console.log(`[StoryPdfService] ❌ Error accessing ${imageType}:`, fetchError);
            validationResult.missingImages.push(this.getImageDisplayName(imageType));
          }
        } else {
          console.log(`[StoryPdfService] ❌ No public URL for ${imageType}`);
          validationResult.missingImages.push(this.getImageDisplayName(imageType));
        }
      }

      validationResult.allValid = validationResult.cover && validationResult.scene_1 && validationResult.scene_2;
      console.log('[StoryPdfService] Image validation results:', validationResult);
      
      return validationResult;
    } catch (error) {
      console.error('[StoryPdfService] Error validating images:', error);
      // Return all images as missing on error
      validationResult.missingImages = this.REQUIRED_IMAGES.map(this.getImageDisplayName);
      return validationResult;
    }
  }

  /**
   * Generates standard TaleMe format PDF (text only)
   * @param options PDF generation options
   * @returns Promise with generated PDF blob
   */
  static async generateStandardPdf(options: StoryPdfGenerationOptions): Promise<Blob> {
    try {
      console.log('[StoryPdfService] Generating standard PDF for:', options.title);
      
      const pdfBlob = await PdfService.generateStoryPdf({
        title: options.title,
        author: options.author,
        content: options.content
      });
      
      console.log('[StoryPdfService] Standard PDF generated successfully');
      return pdfBlob;
    } catch (error) {
      console.error('[StoryPdfService] Error generating standard PDF:', error);
      throw new Error(`Failed to generate standard PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates illustrated PDF with images from storage
   * @param options Illustrated PDF generation options with image URLs
   * @returns Promise with generated PDF blob
   */
  static async generateIllustratedPdf(options: IllustratedPdfGenerationOptions): Promise<Blob> {
    try {
      console.log('[StoryPdfService] Generating illustrated PDF for:', options.title);
      console.log('[StoryPdfService] Image URLs for PDF:', options.imageUrls);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Colors and styles for children's book
      const textColor = '#2c3e50'; // Darker text for better readability over images
      const titleColor = '#BB79D1';
      
      // Convert image URLs to base64 data URLs
      const coverImageData = await this.loadImageAsDataUrl(options.imageUrls.cover);
      const scene1ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_1);
      const scene2ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_2);
      
      // Add illustrated cover page
      await this.addIllustratedCoverPage(pdf, options.title, options.author, coverImageData);
      
      // Add illustrated content pages
      await this.addIllustratedContentPages(
        pdf, 
        options.content, 
        textColor, 
        options.title,
        scene1ImageData,
        scene2ImageData
      );
      
      // Add back cover (same as standard)
      await this.addBackCoverPage(pdf);
      
      // Add footer to all pages
      const totalPages = pdf.getNumberOfPages ? pdf.getNumberOfPages() : pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        this.addFooter(pdf, i, totalPages);
      }
      
      console.log('[StoryPdfService] Illustrated PDF generated successfully');
      return pdf.output('blob');
    } catch (error) {
      console.error('[StoryPdfService] Error generating illustrated PDF:', error);
      throw new Error(`Failed to generate illustrated PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Downloads a PDF blob with appropriate filename
   * @param pdfBlob PDF blob to download
   * @param title Story title for filename
   * @param isIllustrated Whether this is an illustrated PDF
   */
  static downloadPdf(pdfBlob: Blob, title: string, isIllustrated: boolean = false): void {
    try {
      const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const prefix = isIllustrated ? 'taleme-cuento-ilustrado' : 'taleme-cuento';
      const filename = `${prefix}-${safeName}.pdf`;
      
      PdfService.downloadPdf(pdfBlob, filename);
      console.log(`[StoryPdfService] PDF downloaded: ${filename}`);
    } catch (error) {
      console.error('[StoryPdfService] Error downloading PDF:', error);
      throw new Error(`Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets human-readable display name for image type
   * @param imageType Technical image type identifier
   * @returns Human-readable name in Spanish
   */
  private static getImageDisplayName(imageType: string): string {
    const displayNames: Record<string, string> = {
      [IMAGES_TYPE.COVER]: 'Portada',
      [IMAGES_TYPE.SCENE_1]: 'Escena 1',
      [IMAGES_TYPE.SCENE_2]: 'Escena 2',
      [IMAGES_TYPE.CHARACTER]: 'Personaje'
    };
    
    return displayNames[imageType] || imageType;
  }

  /**
   * Validates if illustrated PDF generation is possible for given story
   * @param storyId Story identifier
   * @param chapterId Chapter identifier
   * @returns Promise with validation result and details
   */
  static async canGenerateIllustratedPdf(storyId: string, chapterId: string): Promise<{
    canGenerate: boolean;
    reason?: string;
    missingImages?: string[];
  }> {
    try {
      const validation = await this.validateRequiredImages(storyId, chapterId);
      
      if (validation.allValid) {
        return { canGenerate: true };
      } else {
        return {
          canGenerate: false,
          reason: `Faltan imágenes necesarias: ${validation.missingImages.join(', ')}`,
          missingImages: validation.missingImages
        };
      }
    } catch (error) {
      console.error('[StoryPdfService] Error checking illustrated PDF capability:', error);
      return {
        canGenerate: false,
        reason: 'Error al verificar las imágenes disponibles'
      };
    }
  }

  /**
   * Loads an image from URL and converts it to base64 data URL
   * @param imageUrl Public URL of the image
   * @returns Promise with base64 data URL
   */
  private static async loadImageAsDataUrl(imageUrl: string): Promise<string> {
    try {
      console.log('[StoryPdfService] Loading image from URL:', imageUrl);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS
        
        img.onload = () => {
          try {
            // Create canvas to convert image to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);
            
            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            console.log('[StoryPdfService] Image loaded and converted to data URL');
            resolve(dataUrl);
          } catch (error) {
            console.error('[StoryPdfService] Error converting image to data URL:', error);
            reject(error);
          }
        };
        
        img.onerror = () => {
          console.error('[StoryPdfService] Error loading image from URL:', imageUrl);
          reject(new Error(`Failed to load image from URL: ${imageUrl}`));
        };
        
        img.src = imageUrl;
      });
    } catch (error) {
      console.error('[StoryPdfService] Error in loadImageAsDataUrl:', error);
      throw error;
    }
  }

    /**
   * Creates an illustrated cover page using the cover image
   * @param pdf jsPDF instance
   * @param title Story title
   * @param author Story author
   * @param coverImageData Base64 image data
   */
  private static async addIllustratedCoverPage(pdf: jsPDF, title: string, author?: string, coverImageData?: string): Promise<void> {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    try {
      if (coverImageData) {
        // Add cover image as full background - no overlays, image contains the title
        pdf.addImage(coverImageData, 'JPEG', 0, 0, pageWidth, pageHeight);
        
        // Only add TaleMe logo in corner for branding
        await this.addLogoToPage(pdf, 15, 15, 25);
      } else {
        // Fallback to standard cover if image fails
        pdf.setFillColor(255, 246, 224);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // If image fails, show title as fallback
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor('#BB79D1');
        const titleFontSize = Math.min(28, 800 / title.length);
        pdf.setFontSize(titleFontSize);
        pdf.text(title, pageWidth / 2, pageHeight / 2, { align: 'center' });
        
        if (author) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(14);
          pdf.setTextColor('#555555');
          pdf.text(`por ${author}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
        }
        
        await this.addLogoToPage(pdf, 15, 15, 30);
      }
      
    } catch (error) {
      console.error('[StoryPdfService] Error creating illustrated cover:', error);
      // Fallback to standard background on error
      pdf.setFillColor(255, 246, 224);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  }

  /**
   * Creates illustrated content pages with scene backgrounds
   * @param pdf jsPDF instance
   * @param content Story content
   * @param textColor Text color
   * @param title Story title
   * @param scene1ImageData Scene 1 image data
   * @param scene2ImageData Scene 2 image data
   */
  private static async addIllustratedContentPages(
    pdf: jsPDF,
    content: string,
    textColor: string,
    title: string,
    scene1ImageData: string,
    scene2ImageData: string
  ): Promise<void> {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const effectiveWidth = pageWidth - 2 * margin;
    
    // Split content into paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 1) {
      paragraphs.splice(0, 1, ...content.split('\n').filter(p => p.trim() !== ''));
    }
    
    // Pre-calculate approximate number of pages needed for proper image distribution
    const estimatedTotalPages = this.estimateRequiredPages(content, pageWidth, pageHeight, margin);
    const scene1Pages = Math.ceil(estimatedTotalPages / 2); // First half uses scene_1
    
    console.log(`[StoryPdfService] Estimated pages: ${estimatedTotalPages}, Scene1 pages: ${scene1Pages}, Scene2 pages: ${estimatedTotalPages - scene1Pages}`);
    
    let paragraphIndex = 0;
    let pageIndex = 0;
    const maxPages = Math.max(50, estimatedTotalPages * 2); // Safety limit to prevent infinite loops
    
    // Process all paragraphs, creating pages as needed
    while (paragraphIndex < paragraphs.length && pageIndex < maxPages) {
      pdf.addPage();
      
      // Determine which background image to use (first half scene_1, second half scene_2)
      const useScene1 = pageIndex < scene1Pages;
      const backgroundImage = useScene1 ? scene1ImageData : scene2ImageData;
      
      console.log(`[StoryPdfService] Page ${pageIndex + 1}/${maxPages}: Using ${useScene1 ? 'scene_1' : 'scene_2'} (Paragraph ${paragraphIndex + 1}/${paragraphs.length})`);
      
      // Add background image - clean, no overlays
      try {
        pdf.addImage(backgroundImage, 'JPEG', 0, 0, pageWidth, pageHeight);
      } catch (error) {
        console.error('[StoryPdfService] Error adding background image:', error);
        // Fallback to white background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      }
      
      // Add header with logo and title
      await this.addHeaderToPage(pdf, title);
      
      // Configure text style for children's book - clean black text over images
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22); // Large text for children's book readability over images
      pdf.setTextColor('#000000'); // Pure black for maximum contrast
       
      // Add paragraphs to this page with varied positioning
      let yPos = margin + 30; // Space for header
      let paragraphsAddedThisPage = 0;
       
      // Process paragraphs until we run out of space or paragraphs
      while (paragraphIndex < paragraphs.length && paragraphsAddedThisPage < 10) { // Max 10 paragraphs per page
        const paragraph = paragraphs[paragraphIndex];
        
        // Skip empty paragraphs
        if (!paragraph || paragraph.trim() === '') {
          paragraphIndex++;
          continue;
        }
        
        // Add some randomness to text positioning for children's book feel
        const randomOffset = (Math.random() - 0.5) * 10; // ±5mm random offset
        const adjustedMargin = Math.max(15, Math.min(25, margin + randomOffset));
        const adjustedWidth = pageWidth - 2 * adjustedMargin;
        
        // Split text to fit width
        const lines = pdf.splitTextToSize(paragraph, adjustedWidth);
        
        // Check if paragraph fits on current page (adjusted for larger text)
        const requiredSpace = lines.length * 15 + 25;
        const availableSpace = pageHeight - margin - yPos;
        
        if (requiredSpace > availableSpace) {
          // Paragraph doesn't fit, leave it for next page
          console.log(`[StoryPdfService] Paragraph ${paragraphIndex + 1} doesn't fit (needs ${requiredSpace}mm, available ${availableSpace}mm)`);
          break;
        }
        
        // Add paragraph text with white border for better visibility over images
        this.drawTextWithWhiteBorder(pdf, lines, adjustedMargin, yPos);
        
        // Update position for next paragraph with more spacing for larger text
        yPos += requiredSpace;
        paragraphIndex++;
        paragraphsAddedThisPage++;
      }
      
      // If no paragraphs were added to this page, force add one to prevent infinite loop
      if (paragraphsAddedThisPage === 0 && paragraphIndex < paragraphs.length) {
        console.warn(`[StoryPdfService] Force adding paragraph ${paragraphIndex + 1} to prevent infinite loop`);
        const paragraph = paragraphs[paragraphIndex];
        const adjustedWidth = pageWidth - 2 * margin;
        const lines = pdf.splitTextToSize(paragraph, adjustedWidth);
        
        // Take only what fits on the page
        const maxLines = Math.floor((pageHeight - margin - yPos) / 15);
        const fitLines = lines.slice(0, Math.max(1, maxLines));
        
        this.drawTextWithWhiteBorder(pdf, fitLines, margin, yPos);
        
        // Split the paragraph if needed
        if (lines.length > fitLines.length) {
          const remainingLines = lines.slice(fitLines.length);
          paragraphs[paragraphIndex] = remainingLines.join(' ');
        } else {
          paragraphIndex++;
        }
      }
       
      // Move to next page
      pageIndex++;
    }

    // Check if we hit the safety limit
    if (pageIndex >= maxPages) {
      console.warn(`[StoryPdfService] Hit maximum page limit (${maxPages}). Stopping generation to prevent infinite loop.`);
    }
  }

  /**
   * Adds back cover page (reuses standard logic from PdfService)
   */
  private static async addBackCoverPage(pdf: jsPDF): Promise<void> {
    pdf.addPage();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Set background color
    pdf.setFillColor(255, 246, 224);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Add logo
    await this.addLogoToPage(pdf, (pageWidth - 50) / 2, pageHeight / 3 - 25, 50);
    
    // Add TaleMe text
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor('#BB79D1');
    pdf.setFontSize(18);
    pdf.text(`Generado por ${APP_CONFIG.name}!`, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
    
    // Add current year
    const currentYear = new Date().getFullYear().toString();
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor('#777777');
    pdf.text(currentYear, pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });
  }

     /**
    * Adds header with logo and title to current page
    */
   private static async addHeaderToPage(pdf: jsPDF, title: string): Promise<void> {
     const pageWidth = pdf.internal.pageSize.getWidth();
     
     // Add logo
     await this.addLogoToPage(pdf, 10, 10, 15);
     
     // Add title - clean text without background for illustrated version
     if (title) {
       pdf.setFont('helvetica', 'bold');
       pdf.setFontSize(14); // Slightly larger to match increased content text
       pdf.setTextColor('#000000'); // Black text for visibility over images
       
       let displayTitle = title;
       if (displayTitle.length > 30) {
         displayTitle = displayTitle.substring(0, 27) + '...';
       }
       
       // Text with white border for visibility over image
       this.drawTextWithWhiteBorder(pdf, displayTitle, pageWidth - 15, 15, { align: 'right' });
     }
   }

  /**
   * Adds TaleMe logo to specified position
   */
  private static async addLogoToPage(pdf: jsPDF, x: number, y: number, width: number): Promise<void> {
    try {
      const logo = new Image();
      logo.src = '/logo_png.png';
      
      await new Promise<void>((resolve) => {
        logo.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const height = (logo.height / logo.width) * width;
            
            canvas.width = logo.width;
            canvas.height = logo.height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(logo, 0, 0, logo.width, logo.height);
              const logoData = canvas.toDataURL('image/png');
              pdf.addImage(logoData, 'PNG', x, y, width, height);
            }
          } catch (error) {
            console.error('[StoryPdfService] Error processing logo:', error);
          }
          resolve();
        };
        
        logo.onerror = () => {
          console.error('[StoryPdfService] Error loading logo');
          resolve();
        };
      });
    } catch (error) {
      console.error('[StoryPdfService] Error adding logo:', error);
    }
  }

  /**
   * Adds footer to current page
   */
  private static addFooter(pdf: jsPDF, currentPage: number, totalPages: number): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(8);
    pdf.setTextColor('#777777');
    
    // Add page number
    pdf.text(`${currentPage} / ${totalPages}`, pageWidth - 20, pageHeight - 10);
    
    // Add app name and version
    pdf.text(`${APP_CONFIG.name} v${APP_CONFIG.version}`, 20, pageHeight - 10);
  }

  /**
   * Estimates the number of pages required for the given content
   * @param content Story content
   * @param pageWidth PDF page width
   * @param pageHeight PDF page height
   * @param margin Page margin
   * @returns Estimated number of pages
   */
  private static estimateRequiredPages(content: string, pageWidth: number, pageHeight: number, margin: number): number {
    // Split content into paragraphs like in the actual generation
    const paragraphs = content.split('\n\n').filter(p => p.trim() !== '');
    let finalParagraphs = paragraphs;
    
    if (paragraphs.length === 1) {
      finalParagraphs = content.split('\n').filter(p => p.trim() !== '');
    }
    
    // Estimate based on content length and typical paragraph distribution
    const averageCharsPerLine = 70; // Approximate characters per line at 22pt font
    const linesPerPage = 12; // Conservative estimate for illustrated pages (with header space and larger text)
    const charsPerPage = averageCharsPerLine * linesPerPage;
    
    const totalChars = content.length;
    const estimatedPages = Math.max(1, Math.ceil(totalChars / charsPerPage));
    
    // Also estimate based on paragraph count (minimum 2-3 paragraphs per page)
    const paragraphBasedPages = Math.ceil(finalParagraphs.length / 2.5);
    
    // Use the higher estimate to be conservative
    const finalEstimate = Math.max(estimatedPages, paragraphBasedPages);
    
    console.log(`[StoryPdfService] Content estimation - Chars: ${totalChars}, Paragraphs: ${finalParagraphs.length}, Estimated pages: ${finalEstimate}`);
    
    return finalEstimate;
  }

  /**
   * Draws text with white outline/stroke for better visibility over images
   * @param pdf jsPDF instance
   * @param text Text to draw
   * @param x X position
   * @param y Y position
   * @param options Text options
   */
  private static drawTextWithWhiteBorder(
    pdf: jsPDF, 
    text: string | string[], 
    x: number, 
    y: number, 
    options?: { align?: 'left' | 'center' | 'right' }
  ): void {
    const borderWidth = 0.5; // White border width
    
    // Draw white border by drawing text multiple times with slight offsets
    const offsets = [
      [-borderWidth, -borderWidth], [0, -borderWidth], [borderWidth, -borderWidth],
      [-borderWidth, 0], [borderWidth, 0],
      [-borderWidth, borderWidth], [0, borderWidth], [borderWidth, borderWidth]
    ];
    
    // Draw white outline
    pdf.setTextColor('#FFFFFF');
    offsets.forEach(([offsetX, offsetY]) => {
      pdf.text(text, x + offsetX, y + offsetY, options);
    });
    
    // Draw black text on top
    pdf.setTextColor('#000000');
    pdf.text(text, x, y, options);
  }

  /**
   * Generates illustrated PDF with automatic image generation if needed
   * @param options Complete illustrated PDF options with progress callback
   * @returns Promise with generated PDF blob
   */
  static async generateCompleteIllustratedPdf(options: CompleteIllustratedPdfOptions): Promise<Blob> {
    const { title, author, content, storyId, chapterId, onProgress } = options;
    
    try {
      console.log('[StoryPdfService] Starting complete illustrated PDF generation for:', title);
      
      // Step 1: Validate existing images
      onProgress?.({
        currentStep: 'Validando imágenes existentes...',
        completedImages: 0,
        totalImages: 6,
        progress: 5
      });
      
      const imageValidation = await this.validateRequiredImages(storyId, chapterId);
      
      let imageUrls: { cover: string; scene_1: string; scene_2: string; scene_3: string; scene_4: string; closing: string };
      
      if (!imageValidation.allValid) {
        console.log('[StoryPdfService] Missing images detected, generating them...');
        
        // Step 2: Generate missing images with progress tracking
        onProgress?.({
          currentStep: 'Generando imágenes del cuento...',
          completedImages: 0,
          totalImages: 6,
          progress: 10
        });
        
        const generationResult = await this.generateImagesWithProgress(
          { storyId, chapterId },
          onProgress
        );
        
        if (!generationResult.success || !generationResult.imageUrls) {
          console.warn('[StoryPdfService] ⚠️ Image generation failed, proceeding with fallback PDF');
          
          // Fallback: Generate enhanced standard PDF
          onProgress?.({
            currentStep: 'Generando PDF con fondo blanco...',
            completedImages: 0,
            totalImages: 6,
            progress: 80
          });
          
          const fallbackPdf = await this.generateStandardPdf({
            title,
            author,
            content,
            storyId,
            chapterId
          });
          
          onProgress?.({
            currentStep: 'PDF fallback generado exitosamente',
            completedImages: 0,
            totalImages: 6,
            progress: 100
          });
          
          console.log('[StoryPdfService] ✅ Fallback PDF generated successfully');
          return fallbackPdf;
        }
        
        imageUrls = generationResult.imageUrls;
      } else {
        console.log('[StoryPdfService] All images exist, proceeding with PDF generation...');
        imageUrls = {
          cover: imageValidation.imageUrls!.cover!,
          scene_1: imageValidation.imageUrls!.scene_1!,
          scene_2: imageValidation.imageUrls!.scene_2!,
          scene_3: imageValidation.imageUrls!.scene_3!,
          scene_4: imageValidation.imageUrls!.scene_4!,
          closing: imageValidation.imageUrls!.closing!
        };
      }
      
      // Step 3: Generate illustrated PDF
      onProgress?.({
        currentStep: 'Generando PDF ilustrado...',
        completedImages: 6,
        totalImages: 6,
        progress: 85
      });
      
      const pdfBlob = await this.generateIllustratedPdf({
        title,
        author,
        content,
        storyId,
        chapterId,
        imageUrls
      });
      
      onProgress?.({
        currentStep: 'PDF generado exitosamente',
        completedImages: 6,
        totalImages: 6,
        progress: 100
      });
      
      console.log('[StoryPdfService] Complete illustrated PDF generated successfully');
      return pdfBlob;
      
    } catch (error) {
      console.error('[StoryPdfService] Error generating complete illustrated PDF:', error);
      throw new Error(`Failed to generate illustrated PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates all required images with progress tracking
   * @param options Image generation options
   * @param onProgress Progress callback function
   * @returns Promise with generation result and image URLs
   */
  private static async generateImagesWithProgress(
    options: { storyId: string; chapterId: string },
    onProgress?: (progress: ImageGenerationProgress) => void
  ): Promise<{ success: boolean; imageUrls?: { cover: string; scene_1: string; scene_2: string; scene_3: string; scene_4: string; closing: string }; error?: string }> {
    try {
      const { storyId, chapterId } = options;
      
      console.log('[StoryPdfService] Generating images with progress tracking...');
      
      // Update progress for generation start
      onProgress?.({
        currentStep: 'Iniciando generación de imágenes...',
        completedImages: 0,
        totalImages: 6,
        progress: 20
      });
      
      // 1. First, get scenes from database
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('scenes')
        .eq('id', storyId)
        .single();

      if (storyError || !storyData?.scenes) {
        throw new Error('No se encontraron los prompts de imágenes en la base de datos');
      }

      console.log('[StoryPdfService] Scenes retrieved from database:', Object.keys(storyData.scenes));
      
      // Incremental progress simulation based on 35 seconds max generation time
      let currentProgress = 20;
      const maxTime = 35000; // 35 seconds max
      const targetProgress = 75; // Target progress when images are generated
      const progressIncrement = (targetProgress - 20) / (maxTime / 1000); // Progress per second
      
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(targetProgress, currentProgress + progressIncrement);
        onProgress?.({
          currentStep: 'Generando imágenes con IA...',
          completedImages: 0,
          totalImages: 6,
          progress: Math.round(currentProgress)
        });
      }, 1000); // Update every second
      
      try {
        // 2. Generate images with prompts from database
        const result = await ImageGenerationService.generateStoryImages({
          storyId,
          chapterId,
          scenes: storyData.scenes
        });
        
        clearInterval(progressInterval);
        
        if (!result.success || result.images.length === 0) {
          return {
            success: false,
            error: result.error || 'No images were generated'
          };
        }
        
        // Map results to image URLs
        const imageUrls: { cover?: string; scene_1?: string; scene_2?: string; scene_3?: string; scene_4?: string; closing?: string } = {};
        
        result.images.forEach(img => {
          if (img.type === IMAGES_TYPE.COVER) {
            imageUrls.cover = img.url;
          } else if (img.type === IMAGES_TYPE.SCENE_1) {
            imageUrls.scene_1 = img.url;
          } else if (img.type === IMAGES_TYPE.SCENE_2) {
            imageUrls.scene_2 = img.url;
          } else if (img.type === IMAGES_TYPE.SCENE_3) {
            imageUrls.scene_3 = img.url;
          } else if (img.type === IMAGES_TYPE.SCENE_4) {
            imageUrls.scene_4 = img.url;
          } else if (img.type === IMAGES_TYPE.CLOSING) {
            imageUrls.closing = img.url;
          }
        });
        
        // Validate we have all required images
        const hasAllImages = imageUrls.cover && imageUrls.scene_1 && imageUrls.scene_2 && imageUrls.scene_3 && imageUrls.scene_4 && imageUrls.closing;
        
        if (!hasAllImages) {
          const missingImages: string[] = [];
          if (!imageUrls.cover) missingImages.push('Portada');
          if (!imageUrls.scene_1) missingImages.push('Escena 1');
          if (!imageUrls.scene_2) missingImages.push('Escena 2');
          if (!imageUrls.scene_3) missingImages.push('Escena 3');
          if (!imageUrls.scene_4) missingImages.push('Escena 4');
          if (!imageUrls.closing) missingImages.push('Cierre');
          
          return {
            success: false,
            error: `Faltan imágenes: ${missingImages.join(', ')}`
          };
        }
        
        onProgress?.({
          currentStep: 'Imágenes generadas exitosamente',
          completedImages: 6,
          totalImages: 6,
          progress: 80
        });
        
        return {
          success: true,
          imageUrls: {
            cover: imageUrls.cover!,
            scene_1: imageUrls.scene_1!,
            scene_2: imageUrls.scene_2!,
            scene_3: imageUrls.scene_3!,
            scene_4: imageUrls.scene_4!,
            closing: imageUrls.closing!
          }
        };
        
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
      
    } catch (error) {
      console.error('[StoryPdfService] Error generating images with progress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 