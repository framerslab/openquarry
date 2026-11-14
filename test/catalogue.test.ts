import { describe, expect, it } from 'vitest'
import { type Catalogue, catalogueSchema, validateCatalogue } from '../src/index.js'

// A catalogue of two courses: Night navigation builds on Reading a map, and sits under two subjects.
const catalogue: Catalogue = {
  id: 'field-skills',
  title: 'Field skills',
  subjects: [
    { id: 'outdoors', title: 'Outdoors', broader: [] },
    { id: 'navigation', title: 'Navigation', broader: ['outdoors'] },
  ],
  entries: [
    { slug: 'reading-a-map', home: 'navigation', subjects: ['navigation'], requires: [] },
    { slug: 'night-navigation', home: 'navigation', subjects: ['navigation', 'outdoors'], requires: ['reading-a-map'] },
  ],
}
const [mapReading, nightNavigation] = catalogue.entries
const withEntries = (...entries: unknown[]) => ({ ...catalogue, entries })
const withSubjects = (...subjects: unknown[]) => ({ ...catalogue, subjects })

describe('validateCatalogue', () => {
  it('accepts a subject tree and one entry a weave', () => {
    expect(validateCatalogue(catalogue)).toEqual({ valid: true, errors: [] })
  })

  it('accepts a catalogue with nothing in it yet', () => {
    expect(validateCatalogue({ id: 'field-skills', title: 'Field skills', subjects: [], entries: [] })).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('reads the record against the schema titled Catalogue', () => {
    expect(catalogueSchema.title).toBe('Catalogue')
    expect(catalogueSchema.required).toEqual(['id', 'title', 'subjects', 'entries'])
  })
})

describe('a catalogue the schema refuses', () => {
  it('names a missing key', () => {
    const { entries: _entries, ...withoutEntries } = catalogue
    expect(validateCatalogue(withoutEntries)).toEqual({ valid: false, errors: ["/ must have required property 'entries'"] })
    const { home: _home, ...withoutHome } = mapReading
    expect(validateCatalogue(withEntries(withoutHome)).errors).toEqual(["/entries/0 must have required property 'home'"])
    expect(validateCatalogue(withSubjects({ id: 'outdoors', title: 'Outdoors' })).errors).toContain(
      "/subjects/0 must have required property 'broader'",
    )
  })

  it('names a key the record does not have, at every level', () => {
    expect(validateCatalogue({ ...catalogue, url: 'https://example.org/' }).errors).toEqual([
      '/ must NOT have additional properties: "url"',
    ])
    expect(validateCatalogue(withEntries({ ...mapReading, lessons: 12 })).errors).toEqual([
      '/entries/0 must NOT have additional properties: "lessons"',
    ])
    const subjects = [catalogue.subjects[0], { ...catalogue.subjects[1], colour: 'green' }]
    expect(validateCatalogue({ ...catalogue, subjects }).errors).toEqual([
      '/subjects/1 must NOT have additional properties: "colour"',
    ])
  })

  it('names a slug or an id that is not lowercase letters, digits and hyphens', () => {
    expect(validateCatalogue(withEntries({ ...mapReading, slug: 'Reading a map' })).errors).toEqual([
      '/entries/0/slug must match pattern "^[a-z0-9-]+$"',
    ])
    expect(validateCatalogue({ ...catalogue, id: 'Field Skills' }).errors).toEqual(['/id must match pattern "^[a-z0-9-]+$"'])
  })

  it('names an entry with no subject, a subject with no title and a link that is not a list', () => {
    expect(validateCatalogue(withEntries({ ...mapReading, subjects: [] })).errors).toEqual([
      '/entries/0/subjects must NOT have fewer than 1 items',
    ])
    const subjects = [{ id: 'outdoors', title: '', broader: [] }, catalogue.subjects[1]]
    expect(validateCatalogue({ ...catalogue, subjects }).errors).toEqual([
      '/subjects/0/title must NOT have fewer than 1 characters',
    ])
    expect(validateCatalogue(withEntries({ ...mapReading, requires: 'night-navigation' })).errors).toEqual([
      '/entries/0/requires must be array',
    ])
  })

  it('refuses a value that is not a record', () => {
    expect(validateCatalogue('field-skills')).toEqual({ valid: false, errors: ['/ must be object'] })
    expect(validateCatalogue(null).valid).toBe(false)
  })
})

describe('a catalogue whose links do not hold', () => {
  it("names a home that is not one of the entry's subjects", () => {
    expect(validateCatalogue(withEntries({ ...mapReading, home: 'outdoors' }))).toEqual({
      valid: false,
      errors: ['/entries/0/home must be one of the entry\'s subjects: "navigation"'],
    })
    expect(validateCatalogue(withEntries(mapReading, { ...nightNavigation, home: 'geology' })).errors).toEqual([
      '/entries/1/home must be one of the entry\'s subjects: "navigation", "outdoors"',
    ])
  })

  it('names a subject the catalogue does not list', () => {
    expect(validateCatalogue(withEntries({ ...mapReading, subjects: ['navigation', 'geology'] })).errors).toEqual([
      '/entries/0/subjects/1 names a subject the catalogue does not list: "geology"',
    ])
    const subjects = [catalogue.subjects[0], { id: 'navigation', title: 'Navigation', broader: ['outside'] }]
    expect(validateCatalogue({ ...catalogue, subjects }).errors).toEqual([
      '/subjects/1/broader/0 names a subject the catalogue does not list: "outside"',
    ])
  })

  it('names an entry the catalogue does not list', () => {
    expect(validateCatalogue(withEntries(mapReading, { ...nightNavigation, requires: ['reading-maps'] })).errors).toEqual([
      '/entries/1/requires/0 names an entry the catalogue does not list: "reading-maps"',
    ])
  })

  it('names what is listed twice', () => {
    expect(validateCatalogue(withEntries({ ...mapReading, subjects: ['navigation', 'navigation'] })).errors).toEqual([
      '/entries/0/subjects/1 is listed twice: "navigation"',
    ])
    expect(validateCatalogue(withEntries(mapReading, nightNavigation, mapReading)).errors).toEqual([
      '/entries/2/slug is listed twice: "reading-a-map"',
    ])
    const subjects = [...catalogue.subjects, { id: 'navigation', title: 'Finding the way', broader: [] }]
    expect(validateCatalogue({ ...catalogue, subjects }).errors).toEqual(['/subjects/2/id is listed twice: "navigation"'])
  })

  it('names a circle in what builds on what', () => {
    const circle = withEntries({ ...mapReading, requires: ['night-navigation'] }, nightNavigation)
    expect(validateCatalogue(circle).errors).toEqual([
      '/entries/0/requires makes a circle: "reading-a-map" > "night-navigation" > "reading-a-map"',
    ])
    expect(validateCatalogue(withEntries({ ...mapReading, requires: ['reading-a-map'] })).errors).toEqual([
      '/entries/0/requires makes a circle: "reading-a-map" > "reading-a-map"',
    ])
  })

  it('names a circle in the subject tree', () => {
    const subjects = [
      { id: 'outdoors', title: 'Outdoors', broader: ['wayfinding'] },
      { id: 'navigation', title: 'Navigation', broader: ['outdoors'] },
      { id: 'wayfinding', title: 'Wayfinding', broader: ['navigation'] },
    ]
    expect(validateCatalogue({ ...catalogue, subjects }).errors).toEqual([
      '/subjects/0/broader makes a circle: "outdoors" > "wayfinding" > "navigation" > "outdoors"',
    ])
  })

  it('takes a subject under two broader subjects, and two entries that build on one', () => {
    const subjects = [
      { id: 'outdoors', title: 'Outdoors', broader: [] },
      { id: 'geography', title: 'Geography', broader: [] },
      { id: 'navigation', title: 'Navigation', broader: ['outdoors', 'geography'] },
    ]
    const entries = [
      mapReading,
      nightNavigation,
      { slug: 'coastal-walks', home: 'outdoors', subjects: ['outdoors'], requires: ['reading-a-map'] },
      { slug: 'winter-routes', home: 'navigation', subjects: ['navigation'], requires: ['night-navigation', 'reading-a-map'] },
    ]
    expect(validateCatalogue({ ...catalogue, subjects, entries })).toEqual({ valid: true, errors: [] })
  })

  it('gives every line when several links fail', () => {
    const result = validateCatalogue(
      withEntries({ ...mapReading, home: 'outdoors' }, { ...nightNavigation, requires: ['reading-maps'] }),
    )
    expect(result).toEqual({
      valid: false,
      errors: [
        '/entries/0/home must be one of the entry\'s subjects: "navigation"',
        '/entries/1/requires/0 names an entry the catalogue does not list: "reading-maps"',
      ],
    })
  })
})
