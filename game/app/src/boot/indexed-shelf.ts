import type { Shelf, Shelved } from './library.ts'

const DATABASE = 'game-box'
const ENTRIES = 'worlds'
const DOCUMENTS = 'documents'

/**
 * The shelf in the browser's own database. A city file runs to megabytes, and
 * the database is the one store built for that; what the panel lists is kept
 * apart from the documents so opening the panel never reads a city.
 *
 * A browser that will not open the database (a private window, a blocked site)
 * gives an empty shelf that keeps nothing, so the game still starts and the
 * player is told nothing was kept rather than nothing at all.
 */
export class IndexedShelf implements Shelf {
  #opening: Promise<IDBDatabase | undefined> | undefined

  async list(): Promise<Shelved[]> {
    const db = await this.#open()
    if (!db) return []
    return request(db.transaction(ENTRIES, 'readonly').objectStore(ENTRIES).getAll()) as Promise<Shelved[]>
  }

  async document(key: string): Promise<unknown | undefined> {
    const db = await this.#open()
    if (!db) return undefined
    const found = await request(db.transaction(DOCUMENTS, 'readonly').objectStore(DOCUMENTS).get(key))
    return (found as { document: unknown } | undefined)?.document
  }

  async put(entry: Shelved, document: unknown): Promise<void> {
    const db = await this.#open()
    if (!db) return
    const transaction = db.transaction([ENTRIES, DOCUMENTS], 'readwrite')
    transaction.objectStore(ENTRIES).put(entry)
    transaction.objectStore(DOCUMENTS).put({ key: entry.key, document })
    await settled(transaction)
  }

  async remove(key: string): Promise<void> {
    const db = await this.#open()
    if (!db) return
    const transaction = db.transaction([ENTRIES, DOCUMENTS], 'readwrite')
    transaction.objectStore(ENTRIES).delete(key)
    transaction.objectStore(DOCUMENTS).delete(key)
    await settled(transaction)
  }

  #open(): Promise<IDBDatabase | undefined> {
    this.#opening ??= new Promise((resolve) => {
      let opening: IDBOpenDBRequest
      try {
        opening = indexedDB.open(DATABASE, 1)
      } catch (cause) {
        console.warn(`the library will not open (${String(cause)}); nothing is kept`)
        return resolve(undefined)
      }
      opening.onupgradeneeded = () => {
        const db = opening.result
        if (!db.objectStoreNames.contains(ENTRIES)) db.createObjectStore(ENTRIES, { keyPath: 'key' })
        if (!db.objectStoreNames.contains(DOCUMENTS)) db.createObjectStore(DOCUMENTS, { keyPath: 'key' })
      }
      opening.onsuccess = () => resolve(opening.result)
      opening.onerror = () => {
        console.warn(`the library will not open (${String(opening.error)}); nothing is kept`)
        resolve(undefined)
      }
    })
    return this.#opening
  }
}

function request<T>(asked: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    asked.onsuccess = () => resolve(asked.result)
    asked.onerror = () => reject(asked.error)
  })
}

function settled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
