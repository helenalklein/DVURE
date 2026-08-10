import MarkdownLegalPage from "./shared/MarkdownLegalPage";
import privacyContent from "../content/privacy.md?raw";

export default function PrivacyPage() {
  return <MarkdownLegalPage content={privacyContent}/>;
}
