/** Object URLs for files, kept per key until the file changes, and revoked together. */
export class ObjectURLs {
  readonly #urls = new Map<string, { url: string; modified: number }>()

  /** The URL for `file`, made again if it was modified since the last one for `key`. */
  url(key: string, file: File): string {
    const cached = this.#urls.get(key)
    if (cached?.modified === file.lastModified) return cached.url
    if (cached) URL.revokeObjectURL(cached.url)
    const url = URL.createObjectURL(file)
    this.#urls.set(key, { url, modified: file.lastModified })
    return url
  }

  /** Revokes every URL. Images already showing stay. */
  clear(): void {
    for (const { url } of this.#urls.values()) URL.revokeObjectURL(url)
    this.#urls.clear()
  }
}
