/** Object URLs for files' bytes, kept per key until the file changes, and revoked together. */
export class ObjectURLs {
  readonly #urls = new Map<string, { url: string; modified: number }>()

  /** The URL made for `key`, if its file wasn't modified since. */
  get(key: string, modified: number): string | undefined {
    const cached = this.#urls.get(key)
    return cached?.modified === modified ? cached.url : undefined
  }

  /** Makes the URL for `key` from `blob`, as modified at `modified`, replacing any before. */
  set(key: string, blob: Blob, modified: number): string {
    const cached = this.#urls.get(key)
    if (cached) URL.revokeObjectURL(cached.url)
    const url = URL.createObjectURL(blob)
    this.#urls.set(key, { url, modified })
    return url
  }

  /** Revokes every URL. Images already showing stay. */
  clear(): void {
    for (const { url } of this.#urls.values()) URL.revokeObjectURL(url)
    this.#urls.clear()
  }
}
