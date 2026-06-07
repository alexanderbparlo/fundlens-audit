import Anthropic from '@anthropic-ai/sdk'

// Singleton — import this everywhere, never reinstantiate.
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export default client
