# CLAUDE.md - TaleMe Project Guide

## Project Overview

**TaleMe** is a personalized children's storytelling application that generates custom stories with voice narration and educational challenges. The app creates tales adapted to each child's age, interests, and personality, featuring professional voice narration and interactive learning elements.

**Current Version**: 1.1.4  
**Main Branch**: master  
**Project Type**: Single Page Application (SPA)  
**Language**: Spanish (with multi-language support)

## Technology Stack

### Frontend
- **React 18.3.1** with TypeScript
- **Vite** for build tooling and development server
- **Tailwind CSS** for styling with custom configuration
- **shadcn/ui** component library (extensive Radix UI components)
- **Framer Motion** for animations and transitions
- **Zustand** for state management
- **React Router DOM** for navigation
- **React Hook Form** with Zod validation
- **TanStack Query** for server state management

### Backend & Services
- **Supabase** as Backend-as-a-Service (BaaS)
  - Authentication and user management
  - PostgreSQL database with Row Level Security (RLS)
  - Edge Functions for serverless compute
  - File storage for audio and images
- **OpenAI** for AI-powered story generation and TTS
- **Google Generative AI** (Gemini) for story generation
- **Stripe** for payment processing and subscriptions
- **ElevenLabs** for voice synthesis (via API)

### Development Tools
- **TypeScript** with strict configuration
- **ESLint** with React and TypeScript rules
- **PostCSS** with Tailwind CSS
- **PM2** for production deployment
- **Bun** as package manager (with npm fallback)

## Project Structure

```
TaleMe/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # shadcn/ui components (~49 files)
│   │   └── [various].tsx    # App-specific components
│   ├── pages/               # Route-based page components
│   ├── services/            # API integration layer
│   │   ├── ai/             # AI service wrappers
│   │   └── [various].ts    # Database and third-party services
│   ├── store/              # Zustand state management
│   │   ├── character/      # Character management
│   │   ├── stories/        # Story-related state
│   │   ├── user/           # User profile and auth
│   │   └── core/           # Store utilities
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── config/             # App configuration
├── supabase/
│   ├── functions/          # Edge Functions
│   ├── migrations/         # Database migrations
│   └── sql-functions/      # Database functions
├── docs/                   # Project documentation
└── public/                 # Static assets
```

## Key Features

### Story Generation
- **Personalized Stories**: AI-generated tales based on character preferences, age, and interests
- **Chapter System**: Multi-chapter stories with continuation options
- **Multiple Genres**: Adventure, fantasy, educational, etc.
- **Character Customization**: Name, profession, personality, hobbies

### Audio Features
- **Text-to-Speech**: Professional voice narration using OpenAI TTS
- **Multiple Voices**: Different personality-matched voices
- **Audio Player**: Custom audio player with progress tracking
- **Voice Preview**: Sample voices before selection

### Image Generation
- **AI-Generated Images**: DALL-E 3 integration for story illustrations
- **Multiple Image Types**: Cover, scenes, character portraits
- **Automatic Generation**: Asynchronous image creation for stories

### Educational Elements
- **Challenges**: Reading comprehension, math, language questions
- **Multiple Languages**: Support for translation challenges
- **Adaptive Difficulty**: Age-appropriate content and questions

### User Management
- **Authentication**: Supabase Auth with email/password
- **Profiles**: User preferences and child information
- **Subscriptions**: Stripe-powered payment system
- **Usage Tracking**: Story and voice credit limits

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build:prod

# Preview production build
npm run start:prod
```

### Key Commands
- `npm run dev` - Start development server (localhost:8080)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and start production server

### Environment Setup
Required environment variables:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `VITE_ELEVENLABS_API_KEY` - ElevenLabs API key

## Architecture Patterns

### State Management
- **Zustand stores** for global state
- **Store separation** by domain (user, character, stories, etc.)
- **Persistence** with localStorage for offline support
- **Sync queue** for offline-first data handling

### Service Layer
- **Abstraction layer** between UI and backend
- **Edge Function wrappers** for AI services
- **Direct database access** with RLS security
- **Error handling** with standardized response format

### Component Architecture
- **Atomic design** with reusable components
- **Page-based routing** with React Router
- **Custom hooks** for shared logic
- **TypeScript** for type safety

## Database Schema

### Main Tables
- `profiles` - User profiles and preferences
- `characters` - Custom story characters
- `stories` - Generated stories with metadata
- `story_chapters` - Individual story chapters
- `audio_files` - Generated audio recordings
- `challenges` - Educational challenges
- `user_voices` - Voice preferences

### Security
- **Row Level Security (RLS)** on all tables
- **User-based access control**
- **Secure API key management** in Edge Functions

### SQL Documentation
For detailed SQL schema and RLS policies, consult:
- `/docs/supabase_tables.sql` - Complete table definitions and structure
- `/docs/supabase_RLS.sql` - Row Level Security policies and permissions

## Testing

**Note**: Currently no test framework is configured. The project uses:
- Manual testing in development
- TypeScript for compile-time validation
- ESLint for code quality
- Production monitoring for runtime issues

## Deployment

### Production Setup
- **PM2** for process management
- **Nginx** reverse proxy (not included in repo)
- **Environment variables** for configuration
- **Supabase Edge Functions** for serverless compute

### PM2 Configuration
```javascript
// ecosystem.config.cjs
{
  name: "cuenta-cuentos",
  script: "npm",
  args: "run start:prod",
  env: {
    NODE_ENV: "production",
    PORT: "8080"
  }
}
```

## Development Guidelines

### Code Style
- **TypeScript strict mode** enabled
- **ESLint** configuration with React rules
- **Consistent naming** (camelCase for JS, snake_case for DB)
- **Component organization** by feature/domain

### Best Practices
- **Prefer editing** existing files over creating new ones
- **Use absolute imports** with `@/` alias
- **Handle errors** gracefully with user feedback
- **Implement loading states** for async operations
- **Follow Tailwind CSS** utility-first approach

### State Management Rules
- **Single source of truth** for each domain
- **Immutable updates** using Zustand patterns
- **Async operations** with proper loading/error states
- **Persist critical data** to localStorage

## API Integration

### Edge Functions
- `generate-story` - AI story generation
- `story-continuation` - Story continuation options
- `challenge` - Educational challenge generation
- `generate-audio` - Text-to-speech conversion
- `upload-story-image` - Image generation and storage
- Stripe functions for payment processing

### External APIs
- **OpenAI** - GPT models and TTS
- **Google Generative AI** - Gemini models
- **Stripe** - Payment processing
- **ElevenLabs** - Voice synthesis

## Common Issues & Solutions

### Authentication
- **Race conditions** handled with auth guards
- **Session management** through Supabase client
- **Redirect handling** for auth callbacks

### Performance
- **Lazy loading** for route components
- **Image optimization** with proper formats
- **Audio streaming** for large files
- **State persistence** to avoid refetching

### Offline Support
- **Sync queue** for failed operations
- **localStorage persistence** for critical data
- **Network detection** for connectivity changes

## Future Considerations

### Potential Improvements
- **Unit testing** framework (Jest/Vitest)
- **E2E testing** with Cypress/Playwright
- **Performance monitoring** with analytics
- **Accessibility** improvements
- **PWA features** for offline usage

### Scaling Considerations
- **Database optimization** for large datasets
- **CDN integration** for static assets
- **Caching strategies** for API responses
- **Load balancing** for high traffic

---

**Last Updated**: January 2025  
**Version**: 1.1.4  
**Maintainer**: Development Team

For detailed implementation guides, see the `/docs` directory.