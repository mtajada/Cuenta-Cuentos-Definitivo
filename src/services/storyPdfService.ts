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
  scene_3: boolean;
  scene_4: boolean;
  closing: boolean;
  allValid: boolean;
  missingImages: string[];
  imageUrls?: {
    cover?: string;
    scene_1?: string;
    scene_2?: string;
    scene_3?: string;
    scene_4?: string;
    closing?: string;
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
    scene_3: string;
    scene_4: string;
    closing: string;
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
 * 
 * DEV MODE CONFIGURATION:
 * - Set DEV_MODE = true to use local preview images from /public/tale-preview/
 * - Set DEV_MODE = false to use production flow (Supabase storage + AI generation)
 * - In dev mode: image generation is skipped, validation always returns true, local images are used
 */
export class StoryPdfService {
  private static readonly REQUIRED_IMAGES = [IMAGES_TYPE.COVER, IMAGES_TYPE.SCENE_1, IMAGES_TYPE.SCENE_2, IMAGES_TYPE.SCENE_3, IMAGES_TYPE.SCENE_4, IMAGES_TYPE.CLOSING];
  private static readonly IMAGE_BUCKET = 'images-stories';
  
  // TEMPORARY: Development mode to use local preview images
  // TODO: Set to false when ready for production
  private static readonly DEV_MODE = process.env.VITE_PDF_TEST || false;
  private static readonly DEV_IMAGES_PATH = '/tale-preview';



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
      scene_3: false,
      scene_4: false,
      closing: false,
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

      validationResult.allValid = validationResult.cover && validationResult.scene_1 && validationResult.scene_2 && validationResult.scene_3 && validationResult.scene_4 && validationResult.closing;
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
      const textColor = '#2c3e50'; // Kept for compatibility
      const titleColor = '#BB79D1';
      
      // Convert image URLs to base64 data URLs
      const coverImageData = await this.loadImageAsDataUrl(options.imageUrls.cover);
      const scene1ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_1);
      const scene2ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_2);
      const scene3ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_3);
      const scene4ImageData = await this.loadImageAsDataUrl(options.imageUrls.scene_4);
      const closingImageData = await this.loadImageAsDataUrl(options.imageUrls.closing);
      
      // Add illustrated cover page
      await this.addIllustratedCoverPage(pdf, options.title, options.author, coverImageData);
      
      // Add illustrated content pages with alternating text/image structure
      await this.addIllustratedContentPages(
        pdf, 
        options.content, 
        textColor, 
        options.title,
        scene1ImageData,
        scene2ImageData,
        scene3ImageData,
        scene4ImageData
      );
      
      // Add closing image page
      await this.addClosingImagePage(pdf, closingImageData);
      
      // Add footer to all pages (excluding cover and closing pages)
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
      [IMAGES_TYPE.SCENE_3]: 'Escena 3',
      [IMAGES_TYPE.SCENE_4]: 'Escena 4',
      [IMAGES_TYPE.CLOSING]: 'Cierre',
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
   * Loads collaboration logo image if enabled
   * @returns Promise with logo data or null if disabled
   */
  private static async loadCollaborationLogo(): Promise<string | null> {
    if (!APP_CONFIG.pdfCollaboration.enabled || !APP_CONFIG.pdfCollaboration.logoName) {
      return null;
    }

    try {
      const logoUrl = `${APP_CONFIG.pdfCollaboration.logoPath}/${APP_CONFIG.pdfCollaboration.logoName}`;
      console.log('[StoryPdfService] Loading collaboration logo:', logoUrl);
      return await this.loadImageAsDataUrl(logoUrl);
    } catch (error) {
      console.error('[StoryPdfService] Error loading collaboration logo:', error);
      return null;
    }
  }

  /**
   * Loads image from URL and converts to base64 data URL
   * @param imageUrl URL of the image (can be remote or local)
   * @returns Promise with base64 data URL
   */
  private static async loadImageAsDataUrl(imageUrl: string): Promise<string> {
    try {
      console.log('[StoryPdfService] Loading image from URL:', imageUrl);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        // Only set crossOrigin for remote URLs, not for local dev images
        const isLocalUrl = imageUrl.startsWith('/') || imageUrl.startsWith(window.location.origin);
        if (!isLocalUrl) {
          img.crossOrigin = 'anonymous';
        }
        
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
            console.log('[StoryPdfService] ✅ Image loaded and converted to data URL');
            resolve(dataUrl);
          } catch (error) {
            console.error('[StoryPdfService] Error converting image to data URL:', error);
            reject(error);
          }
        };
        
        img.onerror = () => {
          console.error('[StoryPdfService] ❌ Error loading image from URL:', imageUrl);
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
        // Add cover image as full background
        pdf.addImage(coverImageData, 'JPEG', 0, 0, pageWidth, pageHeight);
        
        // Add discrete white footer strip at bottom
        const stripHeight = 25; // mm - discrete footer
        const stripY = pageHeight - stripHeight;
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, stripY, pageWidth, stripHeight, 'F');
        
        // Load collaboration logo if enabled
        const collabLogoData = await this.loadCollaborationLogo();
        
        // Calculate logo positioning (smaller, more discrete)
        const logoHeight = 12; // mm - reduced size for discretion
        const logoY = stripY + (stripHeight - logoHeight) / 2;
        const logoMargin = 15; // mm from edges
        
        if (collabLogoData) {
          // Two logos: collaboration logo on left, TaleMe logo on right
          const collabLogoX = logoMargin;
          
          // Add collaboration logo
          const collabLogo = new Image();
          collabLogo.src = collabLogoData;
          await new Promise<void>((resolve) => {
            collabLogo.onload = () => {
              const aspectRatio = collabLogo.width / collabLogo.height;
              const logoWidth = logoHeight * aspectRatio;
              pdf.addImage(collabLogoData, 'PNG', collabLogoX, logoY, logoWidth, logoHeight);
              resolve();
            };
            collabLogo.onerror = () => {
              console.error('[StoryPdfService] Error loading collaboration logo');
              resolve();
            };
          });
          
          // Load TaleMe logo to calculate its width based on aspect ratio
          const talemeLogo = new Image();
          talemeLogo.src = '/logotipos/logo-taleme-pdf.png';
          await new Promise<void>((resolve) => {
            talemeLogo.onload = () => {
              const talemeAspectRatio = talemeLogo.width / talemeLogo.height;
              const talemeLogoWidth = logoHeight * talemeAspectRatio;
              const talemeLogoX = pageWidth - logoMargin - talemeLogoWidth;
              
              // Add TaleMe logo on the right
              const canvas = document.createElement('canvas');
              canvas.width = talemeLogo.width;
              canvas.height = talemeLogo.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(talemeLogo, 0, 0);
                const logoData = canvas.toDataURL('image/png');
                pdf.addImage(logoData, 'PNG', talemeLogoX, logoY, talemeLogoWidth, logoHeight);
              }
              resolve();
            };
            talemeLogo.onerror = () => {
              console.error('[StoryPdfService] Error loading TaleMe logo');
              resolve();
            };
          });
        } else {
          // Only TaleMe logo, centered
          const talemeLogo = new Image();
          talemeLogo.src = '/logotipos/logo-taleme-pdf.png';
          await new Promise<void>((resolve) => {
            talemeLogo.onload = () => {
              const talemeAspectRatio = talemeLogo.width / talemeLogo.height;
              const talemeLogoWidth = logoHeight * talemeAspectRatio;
              const logoX = (pageWidth - talemeLogoWidth) / 2;
              
              const canvas = document.createElement('canvas');
              canvas.width = talemeLogo.width;
              canvas.height = talemeLogo.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(talemeLogo, 0, 0);
                const logoData = canvas.toDataURL('image/png');
                pdf.addImage(logoData, 'PNG', logoX, logoY, talemeLogoWidth, logoHeight);
              }
              resolve();
            };
            talemeLogo.onerror = () => {
              console.error('[StoryPdfService] Error loading TaleMe logo (centered)');
              resolve();
            };
          });
        }
        
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
        
        // Add logos in footer even in fallback
        const stripHeight = 25; // mm - discrete footer
        const stripY = pageHeight - stripHeight;
        const logoHeight = 12; // mm - reduced size
        const logoY = stripY + (stripHeight - logoHeight) / 2;
        const logoMargin = 15;
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, stripY, pageWidth, stripHeight, 'F');
        
        const collabLogoData = await this.loadCollaborationLogo();
        if (collabLogoData) {
          const collabLogoX = logoMargin;
          
          const collabLogo = new Image();
          collabLogo.src = collabLogoData;
          await new Promise<void>((resolve) => {
            collabLogo.onload = () => {
              const aspectRatio = collabLogo.width / collabLogo.height;
              const logoWidth = logoHeight * aspectRatio;
              pdf.addImage(collabLogoData, 'PNG', collabLogoX, logoY, logoWidth, logoHeight);
              resolve();
            };
            collabLogo.onerror = () => resolve();
          });
          
          // Load TaleMe logo to calculate its width based on aspect ratio
          const talemeLogo = new Image();
          talemeLogo.src = '/logotipos/logo-taleme-pdf.png';
          await new Promise<void>((resolve) => {
            talemeLogo.onload = () => {
              const talemeAspectRatio = talemeLogo.width / talemeLogo.height;
              const talemeLogoWidth = logoHeight * talemeAspectRatio;
              const talemeLogoX = pageWidth - logoMargin - talemeLogoWidth;
              
              const canvas = document.createElement('canvas');
              canvas.width = talemeLogo.width;
              canvas.height = talemeLogo.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(talemeLogo, 0, 0);
                const logoData = canvas.toDataURL('image/png');
                pdf.addImage(logoData, 'PNG', talemeLogoX, logoY, talemeLogoWidth, logoHeight);
              }
              resolve();
            };
            talemeLogo.onerror = () => {
              console.error('[StoryPdfService] Error loading TaleMe logo in fallback');
              resolve();
            };
          });
        } else {
          // Only TaleMe logo, centered (fallback case)
          const talemeLogo = new Image();
          talemeLogo.src = '/logotipos/logo-taleme-pdf.png';
          await new Promise<void>((resolve) => {
            talemeLogo.onload = () => {
              const talemeAspectRatio = talemeLogo.width / talemeLogo.height;
              const talemeLogoWidth = logoHeight * talemeAspectRatio;
              const logoX = (pageWidth - talemeLogoWidth) / 2;
              
              const canvas = document.createElement('canvas');
              canvas.width = talemeLogo.width;
              canvas.height = talemeLogo.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(talemeLogo, 0, 0);
                const logoData = canvas.toDataURL('image/png');
                pdf.addImage(logoData, 'PNG', logoX, logoY, talemeLogoWidth, logoHeight);
              }
              resolve();
            };
            talemeLogo.onerror = () => {
              console.error('[StoryPdfService] Error loading TaleMe logo (centered fallback)');
              resolve();
            };
          });
        }
      }
      
    } catch (error) {
      console.error('[StoryPdfService] Error creating illustrated cover:', error);
      // Fallback to standard background on error
      pdf.setFillColor(255, 246, 224);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  }

  /**
   * Splits story content into 4 sections for each scene
   * @param content Story content
   * @returns Array of 4 content sections
   */
  private static splitContentIntoSections(content: string): string[] {
    // Split content into paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim() !== '');
    
    // If no double line breaks, split by single line breaks
    const finalParagraphs = paragraphs.length > 1 
      ? paragraphs 
      : content.split('\n').filter(p => p.trim() !== '');
    
    const totalParagraphs = finalParagraphs.length;
    const paragraphsPerSection = Math.ceil(totalParagraphs / 4);
    
    console.log(`[StoryPdfService] Splitting ${totalParagraphs} paragraphs into 4 sections (~${paragraphsPerSection} paragraphs each)`);
    
    const sections: string[] = [];
    
    for (let i = 0; i < 4; i++) {
      const start = i * paragraphsPerSection;
      const end = Math.min(start + paragraphsPerSection, totalParagraphs);
      const sectionParagraphs = finalParagraphs.slice(start, end);
      sections.push(sectionParagraphs.join('\n\n'));
    }
    
    return sections;
  }

  /**
   * Creates illustrated content pages with alternating text and image pages
   * @param pdf jsPDF instance
   * @param content Story content
   * @param textColor Text color (kept for compatibility but not used with Georgia font)
   * @param title Story title (not used in new format)
   * @param scene1ImageData Scene 1 image data
   * @param scene2ImageData Scene 2 image data
   * @param scene3ImageData Scene 3 image data
   * @param scene4ImageData Scene 4 image data
   */
  private static async addIllustratedContentPages(
    pdf: jsPDF,
    content: string,
    textColor: string,
    title: string,
    scene1ImageData: string,
    scene2ImageData: string,
    scene3ImageData: string,
    scene4ImageData: string
  ): Promise<void> {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 25;
    const effectiveWidth = pageWidth - 2 * margin;
    
    // Split content into 4 sections, one for each scene
    const sections = this.splitContentIntoSections(content);
    const sceneImages = [scene1ImageData, scene2ImageData, scene3ImageData, scene4ImageData];
    
    console.log('[StoryPdfService] Creating alternating text and image pages for 4 sections');
    
    // For each section: add text page, then image page
    for (let i = 0; i < 4; i++) {
      const sectionContent = sections[i];
      const sceneImage = sceneImages[i];
      
      if (!sectionContent || sectionContent.trim() === '') {
        console.log(`[StoryPdfService] Section ${i + 1} is empty, skipping`);
        continue;
      }
      
      // --- TEXT PAGE ---
      console.log(`[StoryPdfService] Adding text page for section ${i + 1}`);
      pdf.addPage();
      
      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Set Georgia font (or fallback)
      // jsPDF supports: times, helvetica, courier - Georgia is not native but Times is similar
      pdf.setFont('times', 'normal');
      pdf.setFontSize(14);
      pdf.setTextColor('#000000');
      
      // Split section into paragraphs
      const paragraphs = sectionContent.split('\n\n').filter(p => p.trim() !== '');
      const finalParagraphs = paragraphs.length > 0 ? paragraphs : sectionContent.split('\n').filter(p => p.trim() !== '');
      
      // Add paragraphs to page
      let yPos = margin;
      
      for (const paragraph of finalParagraphs) {
        if (!paragraph || paragraph.trim() === '') continue;
        
        // Split text to fit width
        const lines = pdf.splitTextToSize(paragraph, effectiveWidth);
        
        // Calculate space needed
        const lineHeight = 7; // mm per line for 14pt font
        const paragraphSpacing = 5; // Extra space between paragraphs
        const requiredSpace = lines.length * lineHeight + paragraphSpacing;
        
        // Check if we need a new page
        if (yPos + requiredSpace > pageHeight - margin) {
          // Add another text page if content doesn't fit
          pdf.addPage();
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');
          pdf.setFont('times', 'normal');
          pdf.setFontSize(14);
          pdf.setTextColor('#000000');
          yPos = margin;
        }
        
        // Add text lines
        for (const line of lines) {
          pdf.text(line, margin, yPos);
          yPos += lineHeight;
        }
        
        yPos += paragraphSpacing; // Space between paragraphs
      }
      
      // --- IMAGE PAGE ---
      console.log(`[StoryPdfService] Adding image page for scene ${i + 1}`);
      pdf.addPage();
      
      // Add full-page image without margins
      try {
        pdf.addImage(sceneImage, 'JPEG', 0, 0, pageWidth, pageHeight);
      } catch (error) {
        console.error(`[StoryPdfService] Error adding scene ${i + 1} image:`, error);
        // Fallback to white page with error message
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor('#999999');
        pdf.text(`[Imagen de escena ${i + 1} no disponible]`, pageWidth / 2, pageHeight / 2, { align: 'center' });
      }
    }
    
    console.log('[StoryPdfService] Finished creating illustrated content pages');
  }

  /**
   * Adds closing image page showing character(s) walking away with TaleMe branding footer
   * @param pdf jsPDF instance
   * @param closingImageData Base64 closing image data
   */
  private static async addClosingImagePage(pdf: jsPDF, closingImageData: string): Promise<void> {
    pdf.addPage();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    try {
      
      // Add closing image as background
      pdf.addImage(closingImageData, 'JPEG', 0, 0, pageWidth, pageHeight);
      
      // Add white footer strip at bottom (similar to cover)
      const stripHeight = 25; // mm - discrete footer
      const stripY = pageHeight - stripHeight;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, stripY, pageWidth, stripHeight, 'F');
      
      // Calculate logo positioning
      const logoHeight = 12; // mm - reduced size for discretion
      const logoY = stripY + (stripHeight - logoHeight) / 2;
      
      // Load TaleMe logo
      const talemeLogo = new Image();
      talemeLogo.src = '/logotipos/logo-taleme-pdf.png';
      
      await new Promise<void>((resolve) => {
        talemeLogo.onload = () => {
          const talemeAspectRatio = talemeLogo.width / talemeLogo.height;
          const talemeLogoWidth = logoHeight * talemeAspectRatio;
          const logoX = 15; // mm from left edge
          
          // Add TaleMe logo on the left
          const canvas = document.createElement('canvas');
          canvas.width = talemeLogo.width;
          canvas.height = talemeLogo.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(talemeLogo, 0, 0);
            const logoData = canvas.toDataURL('image/png');
            pdf.addImage(logoData, 'PNG', logoX, logoY, talemeLogoWidth, logoHeight);
            
            // Add text aligned to the right
            const textY = stripY + stripHeight / 2;
            const rightMargin = 15; // mm from right edge
            
            // "Generado por TaleMe App" - aligned right
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor('#777777');
            pdf.text('Generado por TaleMe App', pageWidth - rightMargin, textY, { align: 'right' });
            
            // Year "2025" below - aligned right
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor('#777777');
            pdf.text('2025', pageWidth - rightMargin, textY + 5, { align: 'right' });
          }
          resolve();
        };
        
        talemeLogo.onerror = () => {
          console.error('[StoryPdfService] Error loading TaleMe logo for closing page');
          resolve();
        };
      });
      
    } catch (error) {
      console.error('[StoryPdfService] Error adding closing image:', error);
      // Fallback to white page with message
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor('#999999');
      pdf.text('[Imagen de cierre no disponible]', pageWidth / 2, pageHeight / 2, { align: 'center' });
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
      logo.src = '/logotipos/logo-taleme-pdf.png';
      
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
   * Adds footer to current page (skips cover and closing pages)
   */
  private static addFooter(pdf: jsPDF, currentPage: number, totalPages: number): void {
    // Skip footer on cover page (page 1) and closing page (last page)
    if (currentPage === 1 || currentPage === totalPages) {
      return;
    }
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFontSize(8);
    pdf.setTextColor('#777777');
    
    // Add page number
    pdf.text(`${currentPage} / ${totalPages}`, pageWidth - 20, pageHeight - 10);
    
    // Add app name only (version removed)
    pdf.text(`${APP_CONFIG.name}`, 20, pageHeight - 10);
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
      
      // TEMPORARY: In dev mode, skip image generation and use local images
      if (this.DEV_MODE) {
        console.log('[StoryPdfService] 🔧 DEV MODE: Skipping image generation, using local preview images');
        imageUrls = {
          cover: `${this.DEV_IMAGES_PATH}/cover.jpeg`,
          scene_1: `${this.DEV_IMAGES_PATH}/scene_1.jpeg`,
          scene_2: `${this.DEV_IMAGES_PATH}/scene_2.jpeg`,
          scene_3: `${this.DEV_IMAGES_PATH}/scene_3.jpeg`,
          scene_4: `${this.DEV_IMAGES_PATH}/scene_4.jpeg`,
          closing: `${this.DEV_IMAGES_PATH}/scene_4.jpeg`
        };
        
        onProgress?.({
          currentStep: 'Usando imágenes de ejemplo...',
          completedImages: 6,
          totalImages: 6,
          progress: 30
        });
      } else if (!imageValidation.allValid) {
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
        currentStep: 'Verificando datos de la historia...',
        completedImages: 0,
        totalImages: 6,
        progress: 5
      });
      
      // 1. First, get story data from database (scenes, content, title)
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('scenes, content, title')
        .eq('id', storyId)
        .single();

      if (storyError) {
        throw new Error('No se pudo cargar la historia desde la base de datos');
      }

      let scenes = storyData?.scenes;

      // 2. If scenes don't exist, generate them on-demand
      if (!scenes) {
        console.log('[StoryPdfService] ⚠️ No scenes found. Generating on-demand...');
        
        onProgress?.({
          currentStep: 'Generando prompts de imágenes con IA...',
          completedImages: 0,
          totalImages: 6,
          progress: 10
        });

        try {
          // Import generateScenesOnDemand dynamically to avoid circular dependency
          const { generateScenesOnDemand } = await import('./supabase');
          
          scenes = await generateScenesOnDemand(
            storyId,
            storyData.content,
            storyData.title
          );
          
          console.log('[StoryPdfService] ✓ Scenes generated successfully on-demand');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
          console.error('[StoryPdfService] Failed to generate scenes on-demand:', errorMsg);
          throw new Error(`No se pudieron generar los prompts de imágenes: ${errorMsg}`);
        }
      }

      console.log('[StoryPdfService] Scenes available:', Object.keys(scenes));
      
      // Update progress before image generation
      onProgress?.({
        currentStep: 'Iniciando generación de imágenes...',
        completedImages: 0,
        totalImages: 6,
        progress: 20
      });
      
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
        // 3. Generate images with prompts (from database or generated on-demand)
        const result = await ImageGenerationService.generateStoryImages({
          storyId,
          chapterId,
          scenes: scenes
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