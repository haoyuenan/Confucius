declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'
  interface TexMathOptions {
    engine: {
      renderToString: (tex: string, options?: { displayMode?: boolean; throwOnError?: boolean }) => string
    }
    delimiters?: string | string[]
    katexOptions?: { throwOnError?: boolean }
  }
  const texmath: (md: MarkdownIt, options: TexMathOptions) => void
  export default texmath
}
