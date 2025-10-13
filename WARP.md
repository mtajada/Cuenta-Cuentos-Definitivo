# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**TaleMe** is a personalized children's storytelling application that generates custom stories with AI voice narration and educational challenges. The app creates tales adapted to each child's age, interests, and personality.

**Current Version**: 1.1.4  
**Language**: Spanish (with multi-language support)  
**Architecture**: React SPA with Supabase backend and AI Edge Functions

## Development Commands

### Essential Commands
```bash
# Start development server (localhost:8080)
npm run dev

# Build for production
npm run build:prod

# Preview production build
npm run start:prod

# Deploy to production with PM2
npm run deploy
# OR
./deploy-pm2.sh

# Linting
npm run lint
```

### Environment Setup
Required environment variables in `.env`:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
VITE_ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Supabase Development
```bash
# Start local Supabase (if developing locally)
supabase start

# Deploy edge functions
supabase functions deploy

# Check edge function logs
supabase functions logs

# Set secrets for edge functions
supabase secrets set GEMINI_API_KEY="your-key"
```

### Testing Edge Functions
```bash
# Navigate to test directory
cd test-edge-functions

# Test story generation
deno run --allow-env --allow-net test-simple.js multiple

# Test story continuation
deno run --allow-env --allow-net test-simple.js continue-options

# Debug with verbose output
deno run --allow-env --allow-net test-simple.js multiple --verbose
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 18.3.1 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand with domain-separated stores
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **AI Services**: OpenAI (TTS), Google Gemini (story generation), ElevenLabs (voice synthesis)
- **Payments**: Stripe integration
- **Animations**: Framer Motion

### Key Application Flow

1. **User Authentication** → Supabase Auth
2. **Profile Setup** → Store child age, special needs, language preferences
3. **Character Creation** → Custom characters with personality, profession, hobbies
4. **Story Generation** → AI generates personalized stories via Edge Functions
5. **Voice Synthesis** → Convert text to speech with selected voice
6. **Educational Challenges** → Generate reading comprehension, math, language questions
7. **Story Continuation** → Multi-chapter storytelling system

### State Management Architecture

The application uses domain-separated Zustand stores:

- **`userStore`**: Authentication, profile settings, subscription status
- **`characterStore`**: Character management and customization  
- **`storiesStore`**: Story management and metadata
- **`chaptersStore`**: Individual story chapters
- **`audioStore`**: Audio playback and voice settings
- **`challengesStore`**: Educational challenges and progress
- **`storyOptionsStore`**: Story generation options and preferences

### Service Layer Architecture

**Services** (`/src/services/`) act as a abstraction layer between UI and backend:

- **Edge Function Wrappers**: Thin wrappers that call Supabase Edge Functions
  - `ChallengeService.ts` → challenge generation
  - `GenerateStoryService.ts` → story creation
  - `StoryContinuationService.ts` → story continuation
  - `ttsService.ts` → text-to-speech
  - `stripeService.ts` → payment processing

- **Database Layer**: Direct Supabase database operations
  - `supabase.ts` → CRUD operations with RLS security
  - `syncService.ts` → offline synchronization orchestration

### Edge Functions (Serverless)

All AI processing happens server-side for security and performance:

- **`generate-story`**: Creates initial personalized stories using Gemini AI
- **`challenge`**: Generates educational questions based on stories  
- **`story-continuation`**: Creates story continuations and options
- **`generate-audio`**: Converts text to speech using OpenAI TTS
- **Stripe functions**: Handle checkout sessions and webhooks

### Database Schema (Supabase PostgreSQL)

Key tables with Row Level Security (RLS):
- `profiles` - User profiles and subscription data
- `characters` - Custom story characters
- `stories` - Story metadata and content
- `story_chapters` - Multi-chapter story system
- `challenges` & `challenge_questions` - Educational content
- `audio_files` - Generated voice narrations
- `user_voices` - Voice preferences

## File Structure Context

### Component Organization
- `/src/components/ui/` - shadcn/ui reusable components (~49 files)
- `/src/components/` - App-specific components (audio players, story elements)
- `/src/pages/` - Route-based page components following user journey

### Critical Configuration Files
- `vite.config.ts` - Development server config (port 8080, path aliases)
- `supabase/config.toml` - Local Supabase configuration
- `ecosystem.config.cjs` - PM2 production deployment config
- `tailwind.config.ts` - Tailwind + shadcn/ui styling configuration

### Documentation
- `/docs/EDGE_FUNCTIONS.md` - Comprehensive Edge Function API documentation
- `/docs/services.md` - Service layer architecture guide
- `/docs/project_structure.md` - Detailed project organization
- `CLAUDE.md` - Complete project guide and best practices

## Common Development Patterns

### Adding New Features
1. Create/update types in `/src/types/`
2. Add database operations in `/src/services/supabase.ts`
3. Create/update Zustand store for state management
4. Build UI components following existing patterns
5. Test with edge function testing scripts if AI-related

### Working with AI Features
- Use Edge Functions for all AI operations (security + performance)
- Test AI features using `/test-edge-functions/` scripts
- Follow prompt engineering patterns in existing Edge Functions
- Handle AI response errors gracefully in the UI

### Database Operations
- All database access goes through `/src/services/supabase.ts`
- Ensure proper RLS policies are configured in Supabase
- Use the offline sync queue for write operations
- Handle authentication state changes properly

### Styling Approach
- Use Tailwind CSS utility classes
- Leverage shadcn/ui components for consistent design
- Follow the existing design system patterns
- Use Framer Motion for animations and transitions

## Deployment & Production

### PM2 Production Deployment
```bash
./deploy-pm2.sh
```
This script:
1. Installs dependencies
2. Builds for production
3. Configures PM2 with ecosystem.config.cjs
4. Starts the application on port 80

### Environment Considerations
- Development: `localhost:8080` 
- Production: Configured in PM2 ecosystem
- Supabase: Separate projects for dev/prod environments
- Edge Functions: Deploy to appropriate Supabase project

## Security Notes

- API keys are stored securely in Supabase secrets (never in frontend code)
- Database access protected by Row Level Security (RLS)
- User authentication required for all story generation
- Stripe webhooks handle subscription status updates
- Content filtering applied to AI-generated stories for child safety

## Key Debugging Tips

- Use browser dev tools to monitor Supabase client operations
- Check Edge Function logs in Supabase dashboard
- Test AI features with the provided Deno test scripts
- Monitor PM2 logs in production: `pm2 logs cuenta-cuentos`
- Verify RLS policies if database operations fail

This project emphasizes child safety, educational value, and seamless user experience through thoughtful AI integration and robust offline-first architecture.
