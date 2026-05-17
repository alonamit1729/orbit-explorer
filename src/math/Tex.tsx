import katex from "katex";
import { useMemo } from "react";

interface TexProps {
  math: string;
  block?: boolean;
}

export function Tex({ math, block = false }: TexProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
        output: "html",
      });
    } catch (e) {
      return `<span style="color:red">${math}</span>`;
    }
  }, [math, block]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
