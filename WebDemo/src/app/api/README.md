# API Structure Documentation

## Overview
The API has been refactored for better organization and maintainability. Each functionality is now separated into individual app modules.

## Directory Structure

```
src/app/api/
├── [[...route]]/
│   └── route.ts          # Main route handler that mounts all apps
├── apps/                 # Individual app modules
│   ├── hello.ts         # Simple greeting endpoint
│   ├── feedback.ts      # Feedback submission handling
│   ├── save-html.ts     # HTML content saving to Supabase
│   └── llm.ts           # AI text generation with Google Gemini
├── types/
│   └── index.ts         # Shared type definitions
├── utils/
│   └── index.ts         # Shared utilities and constants
└── README.md            # This documentation
```

## Endpoints

### `/api/hello`
- **Method**: GET
- **Description**: Returns a simple greeting message
- **Response**: `{ message: "Hello from API!" }`

### `/api/feedback`
- **Method**: POST
- **Description**: Handles feedback submission
- **Body**: `{ message: string, rating?: number, email?: string }`
- **Response**: `{ success: boolean, message: string }`

### `/api/save-html`
- **Method**: POST
- **Description**: Saves HTML content to Supabase database
- **Body**: `{ htmlId: string, htmlContent: string }`
- **Response**: `{ success: boolean, data?: any }`

### `/api/llm`
- **Method**: POST
- **Description**: Generates text using Google Gemini AI model
- **Body**: `{ promptType: 'slim' | 'flat' | 'hier', data: string, randomNumber?: number }`
- **Response**: `LLMResponse` with content, usage stats, and system prompt info

## Benefits of Refactoring

1. **Separation of Concerns**: Each app handles a specific functionality
2. **Maintainability**: Easier to update and debug individual features
3. **Reusability**: Shared types and utilities can be reused across apps
4. **Readability**: Main route file is now clean and simple
5. **Testing**: Individual apps can be tested independently

## Environment Variables Required

- `GOOGLE_GENERATIVE_AI_API_KEY`: For LLM functionality
- `NEXT_PUBLIC_SUPABASE_URL`: For database operations
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: For database authentication 