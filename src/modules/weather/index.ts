import type { ModuleFactory, ModulePage, ModuleViewResult } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { logWeb } from '../../engine/weblog'
import { forecast, forecastText, forget } from './weather'
import html from './weather.html?raw'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    private timer: ReturnType<typeof setInterval> | null = null

    private home(): string {
      return typeof this.settings.place === 'string' ? this.settings.place.trim() : ''
    }

    private fahrenheit(): boolean {
      return this.settings.fahrenheit === true
    }

    async init(): Promise<void> {
      this.timer = setInterval(() => this.refreshView(), 30 * 60_000)
    }

    async dispose(): Promise<void> {
      if (this.timer) clearInterval(this.timer)
    }

    define(tools: { add(tool: ToolDef): void }): void {
      tools.add({
        name: 'weather',
        group: 'weather',
        needsWorkspace: false,
        command: true,
        activity: () => 'checking the weather',
        description: "The weather now and for the coming days. place null means the user's own town.",
        params: {
          type: 'object',
          properties: {
            place: { type: ['string', 'null'], description: 'A town or city, e.g. "Leeds, UK"' },
            days: { type: ['integer', 'null'], description: 'Days ahead, 1 to 16. null means 3' }
          }
        },
        execute: async (params, ctx) => {
          const place = sdk.params.optStr(params, 'place')?.trim() || this.home()
          if (!place) throw new sdk.ToolError("No place given, and the user hasn't set their town in Tools → Weather")
          const days = sdk.params.optInt(params, 'days') ?? 3
          try {
            const result = forecastText(await forecast(place, days, this.fahrenheit()))
            logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: `Open-Meteo weather for ${place}`, outcome: 'allowed' })
            return result
          } catch (err) {
            throw new sdk.ToolError(err instanceof Error ? err.message : String(err))
          }
        }
      })
    }

    async pageView(_type: string, _page: ModulePage): Promise<ModuleViewResult> {
      const place = this.home()
      if (!place) return { html, values: { error: 'Set your town in Tools → Weather.' } }
      try {
        return { html, values: await forecast(place, 6, this.fahrenheit()) }
      } catch (err) {
        return { html, values: { error: err instanceof Error ? err.message : String(err) } }
      }
    }

    async onPageAction(_type: string, _page: ModulePage, name: string): Promise<string | void> {
      if (name !== 'refresh') return
      forget()
      this.refreshView()
    }

    pageText(): string {
      return this.home() ? `The weather card for ${this.home()}. Use the weather tool for the forecast.` : 'The weather card. No town is set yet.'
    }
  }

export default factory
