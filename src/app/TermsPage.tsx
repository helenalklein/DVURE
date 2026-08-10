import MarkdownLegalPage from "./shared/MarkdownLegalPage";
import tosContent from "../content/tos.md?raw";

export default function TermsPage() {
  return <MarkdownLegalPage content={tosContent}/>;
}
