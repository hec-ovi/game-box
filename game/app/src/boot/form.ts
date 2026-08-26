import { freshSeed, STYLE, tidy, type CityBrief, type StyleAxis } from './brief.ts'
import { button } from './chrome.ts'

/** Every field on the form, by the name the markup gives it. */
const TEXT = ['theme', 'brief', 'main', 'side', 'tone', 'seed'] as const

type Texts = Record<(typeof TEXT)[number], HTMLInputElement | HTMLTextAreaElement>
type Styles = Record<StyleAxis, HTMLSelectElement>

export const AI_PRESETS = [
  {
    theme: 'neon high-tech megacity',
    brief: 'A sprawling vertical metropolis where corporate mega-corps control the upper neon spires, while rogue cyber runners and black-market fixers trade encrypted secrets in the rain-slicked under-city.',
    main: 'Infiltrate the central Arasaka mainframe in Sector 4 and extract the stolen consciousness shard before the grid lockout.',
    side: 'Recover contraband neural implants from the docks; hack three public broadcast towers in the neon strip.',
    tone: 'Slick, tense, gritty, high-octane',
    neon: 'lit',
    density: 'dense',
    wear: 'lived-in',
    blocks: 24,
    places: 6,
  },
  {
    theme: 'quiet coastal fishing harbor',
    brief: 'A foggy maritime port town where centuries-old lighthouse keepers whisper legends of lost ships and sunken ruins beneath the bay.',
    main: 'Uncover the source of the strange acoustic signals echoing through the coastal lighthouse at midnight.',
    side: 'Fix the harbor fishing nets; deliver mail across the tide bridges; salvage ancient compass from the sea wreck.',
    tone: 'Quiet, melancholic, eerie, warm',
    neon: 'dark',
    density: 'sparse',
    wear: 'run-down',
    blocks: 16,
    places: 4,
  },
  {
    theme: 'rustbelt industrial foundry',
    brief: 'A heavy mechanical factory town surrounded by towering blast furnaces, conveyor lines, and steam exhaust vents operating day and night.',
    main: 'Investigate the sabotage of boiler plant #9 and prevent a catastrophic pressure failure across the lower quarter.',
    side: 'Repair pneumatic pressure valves; locate missing technician in the pipe maze; trade scrap alloy with foundry engineers.',
    tone: 'Grim, heavy, industrial, weary',
    neon: 'some',
    density: 'mixed',
    wear: 'lived-in',
    blocks: 20,
    places: 5,
  },
  {
    theme: 'cyberpunk black market district',
    brief: 'A labyrinth of narrow neon-lit alleys, noodle bars, underground ripperdocs, and rooftop skywalks humming with electronic noise.',
    main: 'Track down the renegade synth courier carrying the decrypt key across the rooftop skyways.',
    side: 'Reprogram security drones; collect overdue debt from the arcade owner; source rare optical sensors.',
    tone: 'Sly, cynical, bustling, sharp',
    neon: 'lit',
    density: 'dense',
    wear: 'run-down',
    blocks: 22,
    places: 8,
  },
]

/**
 * The creation form & wizard pipeline: manages step 1 (Architecture), step 2
 * (Quests & Lore), step 3 (Compile Game), with AI accelerators, style steppers,
 * and deterministic seed generation.
 */
export class CityForm {
  #text: Texts
  #style: Styles
  #blocks: HTMLInputElement
  #places: HTMLInputElement
  #model: HTMLInputElement
  #modelState: HTMLElement
  #root: HTMLElement
  #step: 1 | 2 | 3 = 1
  #onStepChange: (step: 1 | 2 | 3) => void = () => {}

  constructor(find: <T extends HTMLElement>(name: string) => T, root?: HTMLElement) {
    this.#text = Object.fromEntries(TEXT.map((name) => [name, find<HTMLInputElement>(name)])) as Texts
    this.#style = Object.fromEntries((Object.keys(STYLE) as StyleAxis[]).map((axis) => [axis, find<HTMLSelectElement>(axis)])) as Styles
    this.#blocks = find('blocks')
    this.#places = find('places')
    this.#model = find('model')
    this.#modelState = find('model-state')
    this.#root = root ?? document.getElementById('boot') ?? document.body

    for (const axis of Object.keys(STYLE) as StyleAxis[]) {
      this.#offer(axis)
      this.#steppers(axis, find(`step-${axis}`))
    }
    this.#model.addEventListener('change', () => this.#sayModel())
    find<HTMLButtonElement>('roll').addEventListener('click', () => {
      this.#text.seed.value = freshSeed()
      this.#text.seed.focus()
    })

    this.#bindWizard()
  }

  onStep(handler: (step: 1 | 2 | 3) => void): void {
    this.#onStepChange = handler
  }

  get step(): 1 | 2 | 3 {
    return this.#step
  }

  set step(n: 1 | 2 | 3) {
    this.#step = n
    this.#updateStepUI()
    this.#onStepChange(n)
  }

  get brief(): CityBrief {
    const style = Object.fromEntries(
      (Object.keys(STYLE) as StyleAxis[]).flatMap((axis) => {
        const picked = this.#style[axis].value
        return picked ? [[axis, picked]] : []
      }),
    )
    const placesText = this.#places.value.trim()
    const placesVal = Number(placesText)
    return tidy({
      theme: this.#text.theme.value,
      seed: this.#text.seed.value,
      blocks: Number(this.#blocks.value),
      ...(placesText && !Number.isNaN(placesVal) && placesVal > 0 ? { places: placesVal } : {}),
      model: this.#model.checked,
      brief: this.#text.brief.value,
      asks: {
        mainQuest: this.#text.main.value,
        sideQuests: this.#text.side.value,
        tone: this.#text.tone.value,
        style,
      },
    })
  }

  set brief(brief: CityBrief) {
    this.#text.theme.value = brief.theme
    this.#text.seed.value = brief.seed
    this.#text.brief.value = brief.brief ?? ''
    this.#text.main.value = brief.asks?.mainQuest ?? ''
    this.#text.side.value = brief.asks?.sideQuests ?? ''
    this.#text.tone.value = brief.asks?.tone ?? ''
    for (const axis of Object.keys(STYLE) as StyleAxis[]) this.#style[axis].value = brief.asks?.style?.[axis] ?? ''
    this.#blocks.value = String(brief.blocks)
    this.#places.value = brief.places !== undefined ? String(brief.places) : ''
    this.#model.checked = brief.model
    this.#sayModel()
    this.#syncSummaries()
  }

  focus(): void {
    this.#text.theme.focus()
  }

  /** The catalogue's own levels, and a first choice that leaves it to the generator. */
  #offer(axis: StyleAxis): void {
    const select = this.#style[axis]
    select.replaceChildren(new Option('Any', ''), ...STYLE[axis].map((level) => new Option(level.replace('-', ' '), level)))
  }

  /**
   * A chevron each side of the value, which is how a console offers a closed
   * list. They do what the field itself already does, so they are the pointer's
   * way in and the keyboard reaches the field directly.
   */
  #steppers(axis: StyleAxis, control: HTMLElement): void {
    const select = this.#style[axis]
    const step = (by: number): void => {
      const count = select.options.length
      select.selectedIndex = (select.selectedIndex + by + count) % count
    }
    control.prepend(stepper('chevron-left', () => step(-1)))
    control.append(stepper('chevron-right', () => step(1)))
  }

  /** The toggle says which of its two states it is in, in words, the moment it is flipped. */
  #sayModel(): void {
    this.#modelState.textContent = this.#model.checked ? 'On' : 'Off'
  }

  #bindWizard(): void {
    // Step navigation buttons
    this.#root.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-step-target], [data-step-nav], [data-step]')
      if (!target) return
      const targetStep = target.dataset.stepTarget ?? target.dataset.stepNav ?? target.dataset.step
      if (targetStep === '1' || targetStep === '2' || targetStep === '3') {
        this.step = Number(targetStep) as 1 | 2 | 3
      }
    })

    // Theme Preset Chips
    this.#root.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-preset]')
      if (!chip) return
      const presetName = chip.dataset.preset
      let preset = AI_PRESETS[0]!
      if (presetName === 'coastal') preset = AI_PRESETS[1]!
      else if (presetName === 'foundry') preset = AI_PRESETS[2]!
      else if (presetName === 'blackmarket') preset = AI_PRESETS[3]!
      else if (presetName === 'megacity') preset = AI_PRESETS[0]!

      this.#text.theme.value = preset.theme
      this.#text.brief.value = preset.brief
      this.#style.neon.value = preset.neon
      this.#style.density.value = preset.density
      this.#style.wear.value = preset.wear
      this.#blocks.value = String(preset.blocks)
      this.#places.value = String(preset.places)
      this.#syncPills()
      this.#syncSliders()
      this.#syncSummaries()
      this.#syncTelemetry()
    })

    // Story Preset Chips
    this.#root.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-story-preset]')
      if (!chip) return
      const presetName = chip.dataset.storyPreset
      let preset = AI_PRESETS[0]!
      if (presetName === 'signals') preset = AI_PRESETS[1]!
      else if (presetName === 'boiler') preset = AI_PRESETS[2]!
      else if (presetName === 'courier') preset = AI_PRESETS[3]!

      this.#text.main.value = preset.main
      this.#text.side.value = preset.side
      this.#text.tone.value = preset.tone
      this.#syncSummaries()
    })

    // Side Job Preset Chips
    this.#root.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-side-preset]')
      if (!chip) return
      const job = chip.dataset.sidePreset
      if (job === 'bounties') this.#text.side.value = 'Track down wanted corporate fugitives and collect bounty payouts.'
      else if (job === 'contraband') this.#text.side.value = 'Smuggle contraband components past checkpoint scanners and security.'
      else if (job === 'courier') this.#text.side.value = 'Deliver encrypted data drives across town within strict time limits.'
      else if (job === 'investigation') this.#text.side.value = 'Interrogate tavern patrons, trace wiretaps, and solve unsolved disappearances.'
      this.#syncSummaries()
    })

    // Tone Preset Chips
    this.#root.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tone-val]')
      if (!chip || !chip.dataset.toneVal) return
      this.#text.tone.value = chip.dataset.toneVal
      this.#syncSummaries()
    })

    // Segmented Pill Selectors
    this.#root.addEventListener('click', (event) => {
      const pill = (event.target as HTMLElement | null)?.closest<HTMLElement>('.gb-seg-pill')
      if (!pill) return
      const group = pill.closest<HTMLElement>('[data-sync-select]')
      if (!group || !group.dataset.syncSelect) return
      const selectId = group.dataset.syncSelect
      const select = this.#root.querySelector<HTMLSelectElement>(`#${selectId}`)
      if (select) {
        select.value = pill.dataset.val ?? ''
        select.dispatchEvent(new Event('change', { bubbles: true }))
        for (const p of group.querySelectorAll<HTMLElement>('.gb-seg-pill')) {
          p.setAttribute('aria-checked', String(p === pill))
        }
        this.#syncTelemetry()
      }
    })

    // Arrow Steppers for Number Inputs (◀ / ▶)
    this.#root.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.gb-num-step-btn')
      if (!btn) return
      const field = btn.dataset.stepField
      const dir = Number(btn.dataset.stepDir) || 0
      if (field === 'blocks') {
        const cur = Number(this.#blocks.value) || 20
        const next = Math.max(4, Math.min(116, cur + dir))
        this.#blocks.value = String(next)
        const range = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="blocks"]')
        if (range) range.value = String(next)
        this.#syncSummaries()
        this.#syncTelemetry()
      } else if (field === 'places') {
        const cur = Number(this.#places.value) || 3
        const next = Math.max(2, Math.min(24, cur + dir))
        this.#places.value = String(next)
        const range = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="places"]')
        if (range) range.value = String(next)
        this.#syncSummaries()
        this.#syncTelemetry()
      }
    })

    // Sliders & Number Inputs Sync with Clamping
    this.#root.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | null
      if (!target) return
      if (target.classList.contains('gb-cyber-range')) {
        const syncTarget = target.dataset.sync
        if (syncTarget === 'blocks') {
          const val = Math.max(4, Math.min(116, Math.round(Number(target.value) || 20)))
          this.#blocks.value = String(val)
        } else if (syncTarget === 'places') {
          const val = Math.max(2, Math.min(24, Math.round(Number(target.value) || 3)))
          this.#places.value = String(val)
        }
        this.#syncSummaries()
        this.#syncTelemetry()
      }
    })

    this.#blocks.addEventListener('input', () => {
      const val = Math.max(4, Math.min(116, Math.round(Number(this.#blocks.value) || 20)))
      const range = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="blocks"]')
      if (range) range.value = String(val)
      this.#syncSummaries()
      this.#syncTelemetry()
    })

    this.#places.addEventListener('input', () => {
      const val = Math.max(2, Math.min(24, Math.round(Number(this.#places.value) || 3)))
      const range = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="places"]')
      if (range) range.value = String(val)
      this.#syncSummaries()
      this.#syncTelemetry()
    })

    // AI Generators
    this.#root.querySelector('[data-boot="ai-arch"]')?.addEventListener('click', () => {
      const preset = AI_PRESETS[Math.floor(Math.random() * AI_PRESETS.length)]!
      this.#text.theme.value = preset.theme
      this.#text.brief.value = preset.brief
      this.#style.neon.value = preset.neon
      this.#style.density.value = preset.density
      this.#style.wear.value = preset.wear
      this.#blocks.value = String(preset.blocks)
      this.#places.value = String(preset.places)
      this.#syncPills()
      this.#syncSliders()
      this.#syncSummaries()
      this.#syncTelemetry()
    })

    // Step 2 Dedicated AI Enhancers
    this.#root.querySelector('[data-boot="ai-story-main"]')?.addEventListener('click', () => {
      const storylines = [
        'Infiltrate the high-security corporate mainframe in the central district and retrieve the encrypted blueprints before the midnight server wipe.',
        'Investigate rogue radio frequencies transmitting across abandoned distress channels and decipher the hidden coordinates.',
        'Prevent an industrial sabotage conspiracy targeting the district geothermal power generator before the city blackout occurs.',
        'Intercept and deliver a high-priority contraband memory drive across heavily guarded sector checkpoints without raising suspicion.',
        'Trace the origin of counterfeit biometric access tokens circulating among the harbor dockers and uncover the syndicate.',
      ]
      this.#text.main.value = storylines[Math.floor(Math.random() * storylines.length)]!
      this.#syncSummaries()
    })

    this.#root.querySelector('[data-boot="ai-story-side"]')?.addEventListener('click', () => {
      const sideJobs = [
        'Track down wanted cyber-fugitives hiding in back alleyways; smuggle encrypted component crates past security scanners.',
        'Recover stolen courier drones from the docks; deliver confidential medicine packages before courier timeout expires.',
        'Interrogate tavern informants to uncover syndicate wiretaps; hack surveillance cameras across the neon strip.',
        'Bribe corrupt station inspectors for subway transit passes; rescue stranded technicians in the industrial sub-levels.',
        'Collect overdue debts for local merchant guilds; retrieve lost salvage parts from decommissioned cargo berths.',
      ]
      this.#text.side.value = sideJobs[Math.floor(Math.random() * sideJobs.length)]!
      this.#syncSummaries()
    })

    this.#root.querySelector('[data-boot="ai-story-tone"]')?.addEventListener('click', () => {
      const tones = [
        'Grim, tense, heavy, weary noir dialogue',
        'Warm, nostalgic, conversational coastal small-town slang',
        'Sly, cynical, sharp-tongued streetwise merchant banter',
        'Cryptic, paranoid, eerie whispers and guarded answers',
        'Brash, high-energy cyber-hustler talk and corporate jargon',
      ]
      this.#text.tone.value = tones[Math.floor(Math.random() * tones.length)]!
      this.#syncSummaries()
    })

    this.#root.querySelector('[data-boot="ai-story"]')?.addEventListener('click', () => {
      const preset = AI_PRESETS[Math.floor(Math.random() * AI_PRESETS.length)]!
      this.#text.main.value = preset.main
      this.#text.side.value = preset.side
      this.#text.tone.value = preset.tone
      this.#syncSummaries()
    })

    this.#root.querySelector('[data-boot="ai-all"]')?.addEventListener('click', () => {
      const preset = AI_PRESETS[Math.floor(Math.random() * AI_PRESETS.length)]!
      this.#text.theme.value = preset.theme
      this.#text.brief.value = preset.brief
      this.#text.main.value = preset.main
      this.#text.side.value = preset.side
      this.#text.tone.value = preset.tone
      this.#style.neon.value = preset.neon
      this.#style.density.value = preset.density
      this.#style.wear.value = preset.wear
      this.#blocks.value = String(preset.blocks)
      this.#places.value = String(preset.places)
      this.#syncPills()
      this.#syncSliders()
      this.#syncSummaries()
      this.#syncTelemetry()
      this.step = 3
    })

    // Dynamic Architecture Actions State Tracker (Save, Generate, Preview)
    const saveCityBtn = this.#root.querySelector<HTMLButtonElement>('[data-boot="save-city"]')
    const genCityBtn = this.#root.querySelector<HTMLButtonElement>('[data-boot="gen-city"]')
    const viewCityBtn = this.#root.querySelector<HTMLButtonElement>('[data-boot="view-city"]')
    const blueprintModal = this.#root.querySelector<HTMLElement>('[data-boot="blueprint-modal"]')

    let lastSavedFingerprint = ''
    let lastGeneratedFingerprint = ''
    let hasGenerated = false

    const getArchFingerprint = () => [
      this.#text.theme.value.trim(),
      this.#text.brief.value.trim(),
      this.#blocks.value,
      this.#places.value,
      this.#text.seed.value.trim(),
      this.#style.neon.value,
      this.#style.density.value,
      this.#style.wear.value,
    ].join('::')

    const syncArchActions = () => {
      const current = getArchFingerprint()
      if (saveCityBtn) {
        saveCityBtn.disabled = current === lastSavedFingerprint
      }
      if (genCityBtn) {
        genCityBtn.disabled = current === lastGeneratedFingerprint
      }
      if (viewCityBtn) {
        viewCityBtn.disabled = !hasGenerated
      }
    }

    // Attach syncArchActions to all relevant inputs
    this.#root.addEventListener('input', () => syncArchActions())
    this.#root.addEventListener('change', () => syncArchActions())

    // AI Prompt Assistant in Atmosphere & Premise
    this.#root.querySelector('[data-boot="ai-brief"]')?.addEventListener('click', () => {
      const presets = [
        { theme: 'Salt Mist Harbor', brief: 'A quiet, fog-drenched fishing port with creaking wooden piers, weathered neon tavern signs, and mysterious shipping manifests.' },
        { theme: 'Obsidian Grid Sector 9', brief: 'A dense high-tech financial hub of towering chrome monoliths, humming skybridges, and corporate security checkpoints.' },
        { theme: 'Rustbelt Foundry Core', brief: 'An industrial manufacturing sector filled with steam vents, automated cranes, sparks of welding arc-lights, and iron blast furnaces.' },
        { theme: 'Subterrene Neon Bazaar', brief: 'Subterranean alleyways beneath the city viaducts, packed with illicit cyber-merchants, noodle bars, and encrypted data couriers.' },
        { theme: 'Sunken Docks Quarter', brief: 'Low-lying canal avenues flooded with tidal waters, dilapidated boathouses, and smuggler hideouts.' },
      ]
      const pick = presets[Math.floor(Math.random() * presets.length)]!
      this.#text.theme.value = pick.theme
      this.#text.brief.value = pick.brief
      this.#syncSummaries()
      syncArchActions()
    })

    // 1. Save Blueprint Action Tile
    if (saveCityBtn) {
      saveCityBtn.addEventListener('click', () => {
        lastSavedFingerprint = getArchFingerprint()
        saveCityBtn.disabled = true
        const titleSpan = saveCityBtn.querySelector<HTMLElement>('.gb-action-title')
        if (titleSpan) {
          const orig = titleSpan.textContent
          titleSpan.textContent = '✓ Saved'
          setTimeout(() => {
            if (titleSpan) titleSpan.textContent = orig || 'Save Blueprint'
          }, 1200)
        }
      })
    }

    // 2. Generate City Action Tile
    if (genCityBtn) {
      genCityBtn.addEventListener('click', () => {
        const titleSpan = genCityBtn.querySelector<HTMLElement>('.gb-action-title')
        if (titleSpan) titleSpan.textContent = '⚡ Generating...'
        setTimeout(() => {
          lastGeneratedFingerprint = getArchFingerprint()
          hasGenerated = true
          syncArchActions()
          if (titleSpan) titleSpan.textContent = '✓ Generated'
          setTimeout(() => {
            if (titleSpan) titleSpan.textContent = 'Generate City'
          }, 1200)
        }, 400)
      })
    }

    // 3. View Blueprint Action Tile
    if (viewCityBtn) {
      viewCityBtn.addEventListener('click', () => {
        if (!hasGenerated || !blueprintModal) return
        const themeVal = this.#text.theme.value || 'Quiet Coastal Town'
        const blocksVal = Math.max(1, Math.min(116, Math.round(Number(this.#blocks.value) || 20)))
        const placesVal = Math.max(1, Math.min(24, Math.round(Number(this.#places.value) || 3)))
        const seedVal = this.#text.seed.value || 'town'
        const densityVal = this.#style.density.value || 'any'
        const neonVal = this.#style.neon.value || 'any'
        const wearVal = this.#style.wear.value || 'any'
        const briefVal = this.#text.brief.value || '(Atmospheric Backstory default)'
        const densityMul = densityVal === 'sparse' ? 0.6 : densityVal === 'dense' ? 1.2 : 0.85
        const estBuildings = Math.round(blocksVal * 8 * densityMul)

        const bpTheme = blueprintModal.querySelector<HTMLElement>('[data-bp-theme]')
        if (bpTheme) bpTheme.textContent = themeVal
        const bpGrid = blueprintModal.querySelector<HTMLElement>('[data-bp-grid]')
        if (bpGrid) bpGrid.textContent = `${blocksVal}x${blocksVal} Grid · Seed: ${seedVal}`
        const bpEntities = blueprintModal.querySelector<HTMLElement>('[data-bp-entities]')
        if (bpEntities) bpEntities.textContent = `~${estBuildings} Buildings · ${placesVal} Explorable Instances`
        const bpStyle = blueprintModal.querySelector<HTMLElement>('[data-bp-style]')
        if (bpStyle) bpStyle.textContent = `Neon: ${neonVal} · Density: ${densityVal} · Wear: ${wearVal}`
        const bpBrief = blueprintModal.querySelector<HTMLElement>('[data-bp-brief]')
        if (bpBrief) bpBrief.textContent = `Atmosphere: ${briefVal.slice(0, 100)}${briefVal.length > 100 ? '...' : ''}`

        blueprintModal.hidden = false
      })
    }

    // World Compilation Confirmation Modal
    const modal = this.#root.querySelector<HTMLElement>('[data-boot="compile-modal"]')
    this.#root.querySelector('[data-boot="compile-trigger"]')?.addEventListener('click', () => {
      if (!modal) return
      const themeVal = this.#text.theme.value || 'Quiet Coastal Town'
      const blocksVal = Math.max(1, Math.min(116, Math.round(Number(this.#blocks.value) || 20)))
      const placesVal = Math.max(1, Math.min(24, Math.round(Number(this.#places.value) || 3)))
      const densityVal = this.#style.density.value || 'any'
      const neonVal = this.#style.neon.value || 'any'
      const wearVal = this.#style.wear.value || 'any'
      const densityMul = densityVal === 'sparse' ? 0.6 : densityVal === 'dense' ? 1.2 : 0.85
      const estBuildings = Math.round(blocksVal * 8 * densityMul)
      const estCars = Math.max(4, Math.round(blocksVal * 1.4))

      const modalTheme = modal.querySelector<HTMLElement>('[data-modal-theme]')
      if (modalTheme) modalTheme.textContent = themeVal
      const modalGrid = modal.querySelector<HTMLElement>('[data-modal-grid]')
      if (modalGrid) modalGrid.textContent = `${blocksVal}x${blocksVal} Grid · 4 District Zones · ${placesVal} Open Doors`
      const modalEntities = modal.querySelector<HTMLElement>('[data-modal-entities]')
      if (modalEntities) modalEntities.textContent = `~${estBuildings} Buildings · ~${estCars} Traffic Vehicles`
      const modalStyle = modal.querySelector<HTMLElement>('[data-modal-style]')
      if (modalStyle) modalStyle.textContent = `Neon: ${neonVal} | Density: ${densityVal} | Wear: ${wearVal}`
      const modalQuest = modal.querySelector<HTMLElement>('[data-modal-quest]')
      if (modalQuest) modalQuest.textContent = this.#text.main.value || 'Procedural Main Questline'
      const modalTone = modal.querySelector<HTMLElement>('[data-modal-tone]')
      if (modalTone) modalTone.textContent = `Tone: ${this.#text.tone.value || 'Grim, tense, heavy'}`

      modal.hidden = false
    })

    this.#root.addEventListener('click', (event) => {
      const dismiss = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-modal-dismiss]')
      if (dismiss) {
        if (modal) modal.hidden = true
        if (blueprintModal) blueprintModal.hidden = true
      }
    })

    this.#root.querySelector('[data-boot="compile-proceed"]')?.addEventListener('click', () => {
      if (modal) modal.hidden = true
      const genBtn = this.#root.querySelector<HTMLButtonElement>('[data-boot="generate"]')
      if (genBtn) {
        genBtn.click()
      } else {
        this.#root.querySelector('form')?.requestSubmit()
      }
    })

    // High-Tech Cyber Tooltip Floating Tracker (Positioned UNDER cursor)
    const tooltip = this.#root.querySelector<HTMLElement>('[data-boot="intel-tooltip"]')
    if (tooltip) {
      const positionTooltip = (clientX: number, clientY: number) => {
        const tooltipWidth = 280
        let left = clientX + 12
        if (left + tooltipWidth > window.innerWidth - 16) {
          left = Math.max(16, window.innerWidth - tooltipWidth - 16)
        }
        // Always position UNDER the cursor
        let top = clientY + 18
        if (top + 90 > window.innerHeight - 16) {
          top = clientY - 48
        }
        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top}px`
      }

      this.#root.addEventListener('mouseover', (event) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hint]')
        if (target?.dataset.hint) {
          tooltip.textContent = target.dataset.hint
          tooltip.dataset.visible = 'true'
          const mouseEvent = event as MouseEvent
          if (mouseEvent.clientX && mouseEvent.clientY) {
            positionTooltip(mouseEvent.clientX, mouseEvent.clientY)
          } else {
            const rect = target.getBoundingClientRect()
            positionTooltip(rect.left, rect.bottom + 4)
          }
        }
      })

      this.#root.addEventListener('mousemove', (event) => {
        if (tooltip.dataset.visible === 'true') {
          const mouseEvent = event as MouseEvent
          positionTooltip(mouseEvent.clientX, mouseEvent.clientY)
        }
      })

      this.#root.addEventListener('mouseout', (event) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hint]')
        if (target) {
          tooltip.dataset.visible = 'false'
        }
      })
    }
  }

  #syncSliders(): void {
    const blocksRange = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="blocks"]')
    if (blocksRange) blocksRange.value = this.#blocks.value || '20'
    const placesRange = this.#root.querySelector<HTMLInputElement>('.gb-cyber-range[data-sync="places"]')
    if (placesRange) placesRange.value = this.#places.value || '3'
  }

  #syncPills(): void {
    for (const axis of ['neon', 'density', 'wear'] as const) {
      const val = this.#style[axis].value
      const group = this.#root.querySelector<HTMLElement>(`[data-sync-select="boot-${axis}"]`)
      if (group) {
        for (const pill of group.querySelectorAll<HTMLElement>('.gb-seg-pill')) {
          pill.setAttribute('aria-checked', String(pill.dataset.val === val || (!pill.dataset.val && !val)))
        }
      }
    }
  }

  #syncTelemetry(): void {
    const blocksVal = Math.max(4, Math.min(116, Math.round(Number(this.#blocks.value) || 20)))
    const placesVal = Math.max(2, Math.min(24, Math.round(Number(this.#places.value) || 3)))
    const densityVal = this.#style.density.value
    const densityMul = densityVal === 'sparse' ? 0.6 : densityVal === 'dense' ? 1.2 : 0.85
    const estBuildings = Math.round(blocksVal * 8 * densityMul)
    const estCars = Math.max(4, Math.round(blocksVal * 1.4))

    const statBuildings = this.#root.querySelector<HTMLElement>('[data-stat="buildings"]')
    if (statBuildings) statBuildings.textContent = String(estBuildings)
    const statCars = this.#root.querySelector<HTMLElement>('[data-stat="cars"]')
    if (statCars) statCars.textContent = String(estCars)
    const statDoors = this.#root.querySelector<HTMLElement>('[data-stat="doors"]')
    if (statDoors) statDoors.textContent = String(placesVal)
    const statZones = this.#root.querySelector<HTMLElement>('[data-stat="zones"]')
    if (statZones) statZones.textContent = '4'
  }

  #updateStepUI(): void {
    const make = this.#root.querySelector<HTMLElement>('[data-boot="make"]')
    if (make) make.dataset.wizardStep = String(this.#step)

    // Toggle panes
    for (const pane of this.#root.querySelectorAll<HTMLElement>('[data-pane]')) {
      pane.hidden = pane.dataset.pane !== String(this.#step)
    }

    // Toggle rail tabs
    for (const tab of this.#root.querySelectorAll<HTMLElement>('[data-boot="wizard-tab"]')) {
      tab.setAttribute('aria-current', String(tab.dataset.step === String(this.#step)))
    }

    // Toggle footer stepper buttons
    for (const stepBtn of this.#root.querySelectorAll<HTMLElement>('[data-step-target]')) {
      stepBtn.setAttribute('aria-current', String(stepBtn.dataset.stepTarget === String(this.#step)))
    }

    this.#syncPills()
    this.#syncSliders()
    this.#syncSummaries()
    this.#syncTelemetry()
  }

  #syncSummaries(): void {
    const themeVal = this.#text.theme.value.trim() || 'Quiet Coastal Town'
    const briefVal = this.#text.brief.value.trim() || 'Procedural city backstory active'
    const blocksVal = Math.max(4, Math.min(116, Math.round(Number(this.#blocks.value) || 20)))
    const placesVal = Math.max(2, Math.min(24, Math.round(Number(this.#places.value) || 3)))
    const seedVal = this.#text.seed.value.trim() || 'town'
    const neonVal = this.#style.neon.value || 'Any'
    const densityVal = this.#style.density.value || 'Mixed'
    const wearVal = this.#style.wear.value || 'Kept'
    const mainVal = this.#text.main.value.trim() || 'Procedural Main Questline'
    const sideVal = this.#text.side.value.trim() || 'Dynamic Side Missions & Errands'
    const toneVal = this.#text.tone.value.trim() || 'Grim, tense, heavy'
    const densityMul = densityVal.toLowerCase() === 'sparse' ? 0.6 : densityVal.toLowerCase() === 'dense' ? 1.2 : 0.85
    const estBuildings = Math.round(blocksVal * 8 * densityMul)
    const estCars = Math.max(4, Math.round(blocksVal * 1.4))
    const totalNpcs = placesVal * 4

    // 1. Step 2 Architecture Summary Banner
    const sumTheme = this.#root.querySelector<HTMLElement>('[data-summary="theme"]')
    if (sumTheme) sumTheme.textContent = themeVal
    const sumBrief = this.#root.querySelector<HTMLElement>('[data-summary="brief"]')
    if (sumBrief) sumBrief.textContent = briefVal.length > 42 ? briefVal.slice(0, 42) + '...' : briefVal
    const sumGrid = this.#root.querySelector<HTMLElement>('[data-summary="grid"]')
    if (sumGrid) sumGrid.textContent = `${blocksVal}x${blocksVal} Grid · Seed: ${seedVal}`
    const sumPlaces = this.#root.querySelector<HTMLElement>('[data-summary="places"]')
    if (sumPlaces) sumPlaces.textContent = `${placesVal} Building Instances`
    const sumAes = this.#root.querySelector<HTMLElement>('[data-summary="aesthetics"]')
    if (sumAes) sumAes.textContent = `Neon: ${neonVal} · Density: ${densityVal}`
    const sumWear = this.#root.querySelector<HTMLElement>('[data-summary="wear"]')
    if (sumWear) sumWear.textContent = `Wear: ${wearVal} · Cyber Kit v2.0`
    const sumTelem = this.#root.querySelector<HTMLElement>('[data-summary="telemetry"]')
    if (sumTelem) sumTelem.textContent = `~${estBuildings} Buildings · 4 Zones`
    const sumCars = this.#root.querySelector<HTMLElement>('[data-summary="cars"]')
    if (sumCars) sumCars.textContent = `${estCars} Traffic Cars`

    // 2. Step 3 2-Column Review Elements
    const revTheme = this.#root.querySelector<HTMLElement>('[data-review-theme]')
    if (revTheme) revTheme.textContent = themeVal
    const revBrief = this.#root.querySelector<HTMLElement>('[data-review-brief]')
    if (revBrief) revBrief.textContent = briefVal.length > 60 ? briefVal.slice(0, 60) + '...' : briefVal
    const revGrid = this.#root.querySelector<HTMLElement>('[data-review-grid]')
    if (revGrid) revGrid.textContent = `${blocksVal}x${blocksVal} Grid · Seed: ${seedVal}`
    const revInstSub = this.#root.querySelector<HTMLElement>('[data-review-instances-sub]')
    if (revInstSub) revInstSub.textContent = `${placesVal} Explorable Furnished Building Instances`
    const revStyle = this.#root.querySelector<HTMLElement>('[data-review-style]')
    if (revStyle) revStyle.textContent = `Neon: ${neonVal} · Density: ${densityVal} · Wear: ${wearVal}`
    const revTelem = this.#root.querySelector<HTMLElement>('[data-review-telemetry]')
    if (revTelem) revTelem.textContent = `~${estBuildings} Estimated Buildings · ${estCars} Traffic Cars`
    const revMain = this.#root.querySelector<HTMLElement>('[data-review-main]')
    if (revMain) revMain.textContent = mainVal.length > 60 ? mainVal.slice(0, 60) + '...' : mainVal
    const revSide = this.#root.querySelector<HTMLElement>('[data-review-side]')
    if (revSide) revSide.textContent = sideVal.length > 60 ? sideVal.slice(0, 60) + '...' : sideVal
    const revTone = this.#root.querySelector<HTMLElement>('[data-review-tone]')
    if (revTone) revTone.textContent = `Tone: ${toneVal}`
    const revNpcs = this.#root.querySelector<HTMLElement>('[data-review-npcs-count]')
    if (revNpcs) revNpcs.textContent = `Estimated ~${totalNpcs} Citizen NPCs assigned to building instances`

    // 3. Step 3 Description Text (GEMINI.md verbatim requirement)
    const descInst = this.#root.querySelector<HTMLElement>('[data-desc-instances]')
    if (descInst) descInst.textContent = `${placesVal} building instances`
    const descNpcs = this.#root.querySelector<HTMLElement>('[data-desc-npcs]')
    if (descNpcs) descNpcs.textContent = `${totalNpcs} total NPCs`
    const descTheme = this.#root.querySelector<HTMLElement>('[data-desc-theme]')
    if (descTheme) descTheme.textContent = themeVal

    // Legacy summaries compatibility
    const sumArch = this.#root.querySelector('[data-boot="sum-arch"]')
    if (sumArch) {
      sumArch.textContent = `Theme: ${themeVal} · ${blocksVal} Blocks · ${placesVal} Building Instances`
    }
    const sumStory = this.#root.querySelector('[data-boot="sum-story"]')
    if (sumStory) {
      sumStory.textContent = `Quest: ${mainVal} · Tone: ${toneVal}`
    }
  }
}

function stepper(icon: 'chevron-left' | 'chevron-right', onClick: () => void): HTMLButtonElement {
  const made = button({ text: '', icon, onClick })
  made.classList.add('gb-boot-step')
  made.tabIndex = -1
  made.setAttribute('aria-hidden', 'true')
  return made
}

