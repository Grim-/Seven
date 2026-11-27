import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRemoteModel, isImageModel } from '../src/shared/remoteModels'
import {
  aspectRatioForDimensions,
  extractChatCompletionImage,
  isGptImageModel,
  isOpenRouterUrl,
  normalizeOpenAiImageSize
} from '../src/engine/image/client'

// Minimal 1x1 PNG bytes for decoding checks
const ONE_BY_ONE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2d8AAAAASUVORK5CYII='

test('classifyRemoteModel detects modern remote image model families', () => {
  assert.equal(classifyRemoteModel('gpt-image-1'), 'image')
  assert.equal(classifyRemoteModel('gpt-image-1-mini'), 'image')
  assert.equal(classifyRemoteModel('dall-e-3'), 'image')
  assert.equal(classifyRemoteModel('gemini-2.5-flash-image'), 'image')
  assert.equal(classifyRemoteModel('gemini-nano-banana-2.1'), 'image')
  assert.equal(classifyRemoteModel('black-forest-labs/flux.2-pro'), 'image')
  assert.equal(classifyRemoteModel('bytedance-seed/seedream-4.5'), 'image')
  assert.equal(classifyRemoteModel('recraft-v3'), 'image')
  assert.equal(classifyRemoteModel('ideogram-v3'), 'image')
  assert.equal(classifyRemoteModel('gpt-4.1-mini'), 'chat')
  assert.equal(classifyRemoteModel('claude-sonnet-4-5'), 'chat')
})

test('isImageModel respects explicit remote category override', () => {
  assert.equal(isImageModel({ remote: { model: 'my-custom-endpoint', category: 'image' } }), true)
  assert.equal(isImageModel({ remote: { model: 'gpt-image-1', category: 'chat' } }), false)
  assert.equal(isImageModel({ remote: { model: 'gpt-image-1' } }), true)
  assert.equal(isImageModel({ remote: { model: 'gpt-4.1-mini' } }), false)
})

test('normalizeOpenAiImageSize clamps sizes to supported provider dimensions', () => {
  assert.equal(normalizeOpenAiImageSize('gpt-image-1', 'https://api.openai.com/v1', 768, 768), '1024x1024')
  assert.equal(normalizeOpenAiImageSize('gpt-image-1', 'https://api.openai.com/v1', 1280, 720), '1536x1024')
  assert.equal(normalizeOpenAiImageSize('gpt-image-1', 'https://api.openai.com/v1', 720, 1280), '1024x1536')
  assert.equal(normalizeOpenAiImageSize('dall-e-3', 'https://api.openai.com/v1', 1600, 900), '1792x1024')
  assert.equal(normalizeOpenAiImageSize('dall-e-3', 'https://api.openai.com/v1', 900, 1600), '1024x1792')
  assert.equal(normalizeOpenAiImageSize('dall-e-2', 'https://api.openai.com/v1', 512, 512), '512x512')
  // Self-hosted / custom OpenAI-compatible proxy preserves arbitrary requested size
  assert.equal(normalizeOpenAiImageSize('my-local-flux', 'http://127.0.0.1:8000/v1', 832, 1216), '832x1216')
})

test('isGptImageModel and isOpenRouterUrl identify provider quirks accurately', () => {
  assert.equal(isGptImageModel('gpt-image-1'), true)
  assert.equal(isGptImageModel('openai/gpt-image-1-mini'), true)
  assert.equal(isGptImageModel('dall-e-3'), false)
  assert.equal(isOpenRouterUrl('https://openrouter.ai/api/v1'), true)
  assert.equal(isOpenRouterUrl('https://api.openai.com/v1'), false)
  assert.equal(aspectRatioForDimensions(1920, 1080), '16:9')
  assert.equal(aspectRatioForDimensions(1080, 1920), '9:16')
  assert.equal(aspectRatioForDimensions(1024, 1024), '1:1')
})

test('extractChatCompletionImage extracts OpenRouter message.images and content parts', async () => {
  const ctl = new AbortController()
  const fromImages = await extractChatCompletionImage(
    {
      choices: [
        {
          message: {
            content: 'Here is your image.',
            images: [{ image_url: { url: `data:image/png;base64,${ONE_BY_ONE_PNG_B64}` } }]
          }
        }
      ]
    },
    512,
    512,
    ctl.signal
  )
  assert.equal(fromImages.mime, 'image/png')
  assert.equal(fromImages.width, 1)
  assert.equal(fromImages.height, 1)

  const fromParts = await extractChatCompletionImage(
    {
      choices: [
        {
          message: {
            content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${ONE_BY_ONE_PNG_B64}` } }]
          }
        }
      ]
    },
    512,
    512,
    ctl.signal
  )
  assert.equal(fromParts.width, 1)
  assert.equal(fromParts.height, 1)

  await assert.rejects(
    () =>
      extractChatCompletionImage(
        { choices: [{ message: { content: 'I am a text-only model.' } }] },
        512,
        512,
        ctl.signal
      ),
    /Model replied with text instead of an image/
  )
})
