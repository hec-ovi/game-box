import { describe, expect, it } from 'vitest'
import { DEFAULT_RATE, PlayerState, SECONDS_PER_DAY, type Weather } from '../src/index.ts'

const clockOf = (worldId = 'world_0001') => PlayerState.create(worldId).clock

describe('GameClock', () => {
  it('runs at its rate and rolls past midnight onto the next day', () => {
    const clock = clockOf()
    expect(clock.rate).toBe(DEFAULT_RATE)
    expect(clock.day).toBe(1)
    expect(clock.hour).toBe(8)

    // written against the rate rather than a tuning of it, so retuning the
    // clock does not send somebody editing arithmetic in a test
    const realSecondsPerGameHour = 3_600 / DEFAULT_RATE

    clock.advance(realSecondsPerGameHour * 4)
    expect(clock.day).toBe(1)
    expect(clock.hour).toBe(12)

    clock.advance((SECONDS_PER_DAY / DEFAULT_RATE) * 10)
    expect(clock.day).toBe(11)
    expect(clock.hour).toBe(12)

    expect(clock.setTime(23, 59).ok).toBe(true)
    clock.advance(realSecondsPerGameHour)
    expect(clock.day).toBe(12)
    expect(clock.hour).toBe(0)
  })

  it('holds still while paused, keeps the rate it ran at, and moves again on resume', () => {
    const clock = clockOf()
    expect(clock.setRate(60).ok).toBe(true)
    clock.pause()
    expect(clock.paused).toBe(true)
    expect(clock.rate).toBe(60)
    clock.advance(600)
    expect(clock.hour).toBe(8)
    expect(clock.minute).toBe(0)
    expect(clock.day).toBe(1)

    clock.resume()
    expect(clock.paused).toBe(false)
    clock.advance(60)
    expect(clock.hour).toBe(9)

    // a rate of 0 is the same pause; a positive rate runs
    expect(clock.setRate(0).ok).toBe(true)
    expect(clock.paused).toBe(true)
    expect(clock.rate).toBe(60)
    expect(clock.setRate(60).ok).toBe(true)
    expect(clock.paused).toBe(false)

    const bad = clock.setRate(-1)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.code).toBe('invalid-rate')
    expect(clock.rate).toBe(60)
  })

  it('jumps to a time and a day, and refuses values off the dial', () => {
    const clock = clockOf()
    expect(clock.setTime(21, 30).ok).toBe(true)
    expect(clock.setDay(4).ok).toBe(true)
    expect(clock.hour).toBe(21)
    expect(clock.minute).toBe(30)
    expect(clock.day).toBe(4)

    const lateHour = clock.setTime(24)
    expect(lateHour.ok).toBe(false)
    if (!lateHour.ok) expect(lateHour.error.code).toBe('invalid-time')

    const zeroDay = clock.setDay(0)
    expect(zeroDay.ok).toBe(false)
    if (!zeroDay.ok) expect(zeroDay.error.code).toBe('invalid-day')

    // a refused jump changes nothing
    expect(clock.hour).toBe(21)
    expect(clock.day).toBe(4)
  })

  it('remembers the weather and refuses one the renderer does not know', () => {
    const clock = clockOf()
    expect(clock.weather).toBe('clear')
    expect(clock.setWeather('rain').ok).toBe(true)
    expect(clock.weather).toBe('rain')

    const unknown = clock.setWeather('hail' as Weather)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe('unknown-weather')
    expect(clock.weather).toBe('rain')
  })

  it('is dark from 18:00 to 05:59 and reads the hour around the sun in plain words', () => {
    const clock = clockOf()
    const darkAt = (hour: number, minute = 0) => {
      clock.setTime(hour, minute)
      return clock.isDark
    }

    expect(darkAt(17, 59)).toBe(false)
    expect(darkAt(18)).toBe(true)
    expect(darkAt(3)).toBe(true)
    expect(darkAt(5, 59)).toBe(true)
    expect(darkAt(6)).toBe(false)
    expect(darkAt(13)).toBe(false)

    clock.setTime(20)
    expect(clock.phase).toBe('evening')
    expect(clock.reading).toBe('late evening')
    clock.setTime(4)
    expect(clock.phase).toBe('before-dawn')
    expect(clock.reading).toBe('just before dawn')
    clock.setTime(6)
    expect(clock.phase).toBe('dawn')
    clock.setTime(7, 25)
    expect(clock.phase).toBe('dawn')
    clock.setTime(16, 35)
    expect(clock.phase).toBe('dusk')
    clock.setTime(21)
    expect(clock.phase).toBe('night')
  })

  it('counts whole seconds since day one for the quest clock event', () => {
    const clock = clockOf()
    expect(clock.totalSeconds).toBe(8 * 3600)

    clock.setDay(3)
    clock.setTime(0, 30)
    expect(clock.totalSeconds).toBe(2 * SECONDS_PER_DAY + 1800)

    clock.setRate(1)
    clock.advance(0.5)
    expect(clock.totalSeconds).toBe(2 * SECONDS_PER_DAY + 1800)
    clock.advance(0.5)
    expect(clock.totalSeconds).toBe(2 * SECONDS_PER_DAY + 1801)
  })
})

describe('the clock in a save', () => {
  it('comes back at the hour, day, rate and weather it was saved at', () => {
    const player = PlayerState.create('world_0001')
    player.clock.setDay(6)
    player.clock.setTime(19, 45)
    player.clock.setRate(30)
    player.clock.setWeather('rain')
    const saved = JSON.parse(JSON.stringify(player.toJSON()))

    const loaded = PlayerState.load(saved, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.clock.day).toBe(6)
    expect(loaded.value.clock.hour).toBe(19)
    expect(loaded.value.clock.minute).toBe(45)
    expect(loaded.value.clock.rate).toBe(30)
    expect(loaded.value.clock.weather).toBe('rain')
  })

  it('written while paused, opens paused and resumes at the rate it ran at', () => {
    const player = PlayerState.create('world_0001')
    player.clock.setRate(30)
    player.clock.pause()
    const saved = JSON.parse(JSON.stringify(player.toJSON()))
    expect(saved.clock).toMatchObject({ rate: 30, paused: true })

    const loaded = PlayerState.load(saved, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.clock.paused).toBe(true)
    loaded.value.clock.advance(600)
    expect(loaded.value.clock.hour).toBe(8)
    loaded.value.clock.resume()
    expect(loaded.value.clock.rate).toBe(30)
    loaded.value.clock.advance(120)
    expect(loaded.value.clock.hour).toBe(9)

    // a save from before `paused` carried its pause as a rate of 0
    const frozen = PlayerState.load({ ...saved, clock: { ...saved.clock, rate: 0, paused: undefined } }, 'world_0001')
    expect(frozen.ok).toBe(true)
    if (!frozen.ok) return
    expect(frozen.value.clock.paused).toBe(true)
    expect(frozen.value.clock.rate).toBe(DEFAULT_RATE)
  })

  it('starts a save written before clocks at the default morning', () => {
    const player = PlayerState.create('world_0001')
    const { clock, ...old } = JSON.parse(JSON.stringify(player.toJSON()))
    expect(clock).toBeDefined()

    const loaded = PlayerState.load(old, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.clock.day).toBe(1)
    expect(loaded.value.clock.hour).toBe(8)
    expect(loaded.value.clock.rate).toBe(DEFAULT_RATE)
    expect(loaded.value.clock.weather).toBe('clear')
  })

  it('refuses a save whose clock is off the dial', () => {
    const player = PlayerState.create('world_0001')
    const saved = JSON.parse(JSON.stringify(player.toJSON()))
    saved.clock.secondsOfDay = SECONDS_PER_DAY

    const broken = PlayerState.load(saved, 'world_0001')
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.error.code).toBe('invalid-save')
  })
})
