export interface JsonSchema {
  type?: string | readonly string[]
  description?: string
  enum?: readonly unknown[]
  const?: unknown
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: readonly string[]
  oneOf?: readonly JsonSchema[]
  anyOf?: readonly JsonSchema[]
  additionalProperties?: boolean | JsonSchema
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  minLength?: number
  maxLength?: number
  format?: string
  [key: string]: unknown
}

export interface JsonObjectSchema extends JsonSchema {
  type: 'object'
  properties?: Record<string, JsonSchema>
}
