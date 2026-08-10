import { DvureSignature } from "./ui";

// Shared by every plain-legal-doc page (Terms, Privacy) — content lives
// as markdown under src/content/, edit that file directly (any text
// editor, no code involved) to change what renders here. Only handles
// the small set of markdown these documents actually use (# / ##
// headings, blank-line paragraphs, **bold**) — not a general-purpose
// markdown renderer, so unusual syntax (tables, nested lists, links)
// won't render as expected.
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function renderMarkdown(md: string) {
  const blocks = md.trim().split(/\n\n+/);
  return blocks.map((block, i) => {
    if (block.startsWith("## ")) {
      return <h2 key={i} className="text-heading text-base mt-8 mb-2">{renderInline(block.slice(3))}</h2>;
    }
    if (block.startsWith("# ")) {
      return <h1 key={i} className="text-heading text-2xl mb-2">{renderInline(block.slice(2))}</h1>;
    }
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{renderInline(block)}</p>;
  });
}

export default function MarkdownLegalPage({ content }: { content: string }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4">
        <DvureSignature size={16}/>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        {renderMarkdown(content)}
      </div>
    </div>
  );
}
