# Environment Setup

## Required Environment Variables

To run the Next-Eval application, you need to set up the following environment variables:

### 1. Copy the example environment file

```bash
cp .env.example .env
```

### 2. Configure the required variables

#### Google AI API Key (Required for LLM functionality)
- `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google Generative AI API key
- Get your API key from: https://makersuite.google.com/app/apikey

#### Supabase Configuration (Optional)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- Only needed if you plan to use Supabase for data storage

#### Other API Keys (For future use)
- `OPENAI_API_KEY`: OpenAI API key (not currently used)
- `ANTHROPIC_API_KEY`: Anthropic API key (not currently used)

## Installation

After setting up the environment variables:

1. Install dependencies:
```bash
bun install
```

2. Run the development server:
```bash
bun run dev
```

The application will be available at `http://localhost:3839/next-eval`

## Troubleshooting

### WASM Module Loading Issues
If you encounter issues with the WASM module:
1. Ensure the `rust_mdr_pkg` folder exists in `apps/web/public/`
2. Check that all WASM files are present (`.wasm`, `.js`, `.d.ts` files)
3. The WASM module is loaded from `/next-eval/rust_mdr_pkg/rust_mdr_utils.js`

### Missing Dependencies
If you get errors about missing packages:
1. Run `bun install` in the root directory
2. Ensure all workspace packages are properly linked
3. Check that `@next-eval/shared` is built and available

### API Key Issues
If LLM functionality isn't working:
1. Verify your Google AI API key is valid
2. Check that the `.env` file is in the root directory
3. Restart the development server after changing environment variables